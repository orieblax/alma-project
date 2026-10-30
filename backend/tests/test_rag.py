from unittest.mock import patch, MagicMock
import requests
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from apps.chatbots.models import Chatbot
from apps.etl.models import Document, DocumentChunk
from apps.etl.services import EmbeddingService, process_document_pipeline
from apps.rag.services import RAGEngine, RAGReranker
from apps.analytics.models import ChatSession, ChatMessage

class RAGChatTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='rag_tester',
            email='rag@almaproject.com',
            password='Password123!'
        )
        self.chatbot = Chatbot.objects.create(
            user=self.user,
            name='Politicas de Devolucion',
            system_prompt='Eres el asistente oficial de devoluciones de Alma Store.',
            is_active=True
        )
        self.chat_url = f'/api/chatbots/{self.chatbot.id}/chat/'

        # Create an indexed document with specific chunks
        content_bytes = (
            "Politica de Devoluciones de Alma Store:\n"
            "El cliente tiene un plazo maximo de 30 dias para solicitar la devolucion.\n"
            "El producto debe encontrarse en su empaque original sin señales de uso.\n"
            "Los reembolsos se procesan en un plazo de 3 a 5 dias habiles al metodo de pago original."
        ).encode('utf-8')
        uploaded = SimpleUploadedFile("politicas.txt", content_bytes, content_type="text/plain")

        self.doc = Document.objects.create(
            chatbot=self.chatbot,
            file=uploaded,
            file_name="politicas.txt",
            file_type="txt",
            file_size=len(content_bytes),
            status=Document.STATUS_PENDING
        )
        process_document_pipeline(self.doc)

    def test_rag_query_with_sources(self):
        payload = {'message': 'Cual es el plazo para solicitar una devolucion?'}
        response = self.client.post(self.chat_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('response', response.data)
        self.assertIn('sources', response.data)
        self.assertIn('precision_at_k', response.data)
        self.assertIn('response_time_ms', response.data)
        self.assertIn('tokens_used', response.data)
        self.assertTrue(response.data['response_time_ms'] >= 0)
        self.assertTrue(response.data['tokens_used'] > 0)

        # Check precision_at_k structure
        precision_data = response.data['precision_at_k']
        self.assertIn('k', precision_data)
        self.assertIn('precision', precision_data)
        self.assertIn('relevant_count', precision_data)
        self.assertIn('total_evaluated', precision_data)
        self.assertIn('threshold', precision_data)
        self.assertGreaterEqual(precision_data['precision'], 0.0)
        self.assertLessEqual(precision_data['precision'], 1.0)

        # Check source citation with re-ranking fields
        self.assertTrue(len(response.data['sources']) > 0)
        source = response.data['sources'][0]
        self.assertEqual(source['document_name'], 'politicas.txt')
        self.assertIn('score', source)
        self.assertIn('rerank_score', source)
        self.assertIn('initial_score', source)
        self.assertIn('rank', source)
        self.assertIn('snippet', source)

        # Verify chat session and messages created in analytics
        self.assertTrue(ChatSession.objects.filter(chatbot=self.chatbot).exists())
        self.assertTrue(ChatMessage.objects.filter(sender=ChatMessage.SENDER_USER).exists())
        self.assertTrue(ChatMessage.objects.filter(sender=ChatMessage.SENDER_BOT).exists())

    @patch.object(RAGEngine, '_call_ollama', return_value=('El plazo máximo para devoluciones en Alma Store es de 30 días calendario según politicas.txt.', 165))
    def test_ollama_integration_success(self, mock_call):
        payload = {'message': 'Cuantos dias tengo para devolver un articulo?'}
        response = self.client.post(self.chat_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('30 días', response.data['response'])
        self.assertEqual(response.data['tokens_used'], 165)
        self.assertTrue(mock_call.called)

    @patch.object(RAGEngine, '_call_ollama', return_value=None)
    def test_ollama_resilient_fallback_on_network_error(self, mock_call):
        """Ensures that if Ollama LLM service is unreachable, the system falls back gracefully."""
        payload = {'message': 'Cual es el plazo para devolucion?'}
        response = self.client.post(self.chat_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('response', response.data)
        self.assertTrue(len(response.data['sources']) > 0)
        self.assertIn('politicas.txt', response.data['sources'][0]['document_name'])

    def test_rag_query_empty_message_rejected(self):
        response = self.client.post(self.chat_url, {'message': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rag_query_inactive_chatbot_rejected(self):
        self.chatbot.is_active = False
        self.chatbot.save()

        response = self.client.post(self.chat_url, {'message': 'Hola'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inactivo', response.data['message'])

    @override_settings(USE_OLLAMA=False)
    def test_rag_query_without_documents_deterministic_fallback(self):
        empty_bot = Chatbot.objects.create(
            user=self.user,
            name='Bot Vacio',
            is_active=True
        )
        url = f'/api/chatbots/{empty_bot.id}/chat/'
        response = self.client.post(url, {'message': 'Pregunta cualquiera'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['sources']), 0)
        self.assertIn('no cuenta con documentos indexados', response.data['response'])


class RAGRerankingAndPrecisionTestCase(TestCase):
    def test_reranker_tokenization(self):
        tokens = RAGReranker.tokenize("¿Cuál es el plazo para la devolución de artículos?")
        self.assertIn("plazo", tokens)
        self.assertIn("devolucion", tokens)
        self.assertIn("articulos", tokens)
        self.assertNotIn("el", tokens)
        self.assertNotIn("la", tokens)
        self.assertNotIn("de", tokens)

    def test_reranker_lexical_scoring(self):
        query_tokens = ["plazo", "devolucion", "dias"]
        doc_relevant = "El plazo máximo de devolucion es de 30 dias hábiles."
        doc_irrelevant = "Nuestro horario de atención es de lunes a viernes."

        score_rel = RAGReranker.compute_lexical_score(query_tokens, doc_relevant)
        score_irrel = RAGReranker.compute_lexical_score(query_tokens, doc_irrelevant)

        self.assertGreater(score_rel, score_irrel)
        self.assertGreater(score_rel, 0.4)

    def test_reranker_phrase_bonus(self):
        query = "plazo maximo de devolucion"
        doc_exact = "Informamos que el plazo maximo de devolucion concluye a los 30 días."
        doc_split = "El plazo fijado no tiene relación con el trámite de devolucion."

        bonus_exact = RAGReranker.compute_phrase_bonus(query, doc_exact)
        bonus_split = RAGReranker.compute_phrase_bonus(query, doc_split)

        self.assertEqual(bonus_exact, 1.0)
        self.assertLess(bonus_split, bonus_exact)

    def test_reranker_reorders_and_computes_precision_at_k(self):
        candidates = [
            {
                'document_name': 'doc_a.txt',
                'snippet': 'Horarios generales de la tienda en fines de semana.',
                'full_content': 'Horarios generales de la tienda en fines de semana.',
                'score': 0.60,
            },
            {
                'document_name': 'doc_b.txt',
                'snippet': 'Política de devoluciones: el plazo máximo para solicitar devolución es 30 días.',
                'full_content': 'Política de devoluciones: el plazo máximo para solicitar devolución es 30 días.',
                'score': 0.55,
            },
            {
                'document_name': 'doc_c.txt',
                'snippet': 'El trámite y plazo de devolución requiere el recibo original de compra.',
                'full_content': 'El trámite y plazo de devolución requiere el recibo original de compra.',
                'score': 0.52,
            },
            {
                'document_name': 'doc_d.txt',
                'snippet': 'Términos de envío y paquetería express.',
                'full_content': 'Términos de envío y paquetería express.',
                'score': 0.40,
            },
        ]

        query = "plazo máximo de devolución"
        top_k = 3
        reranked, metrics = RAGReranker.rerank_candidates(
            query=query,
            candidates=candidates,
            top_k=top_k,
            relevance_threshold=0.45
        )

        self.assertEqual(len(reranked), 3)
        # doc_b should be promoted to #1 because of strong lexical & phrase match
        self.assertEqual(reranked[0]['document_name'], 'doc_b.txt')
        self.assertEqual(reranked[0]['rank'], 1)

        # Check Precision@K metrics
        self.assertEqual(metrics['k'], 3)
        self.assertEqual(metrics['total_evaluated'], 3)
        self.assertGreaterEqual(metrics['precision'], 0.66)
        self.assertGreaterEqual(metrics['relevant_count'], 2)
