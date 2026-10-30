import io
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from apps.chatbots.models import Chatbot
from apps.etl.models import Document, DocumentChunk
from apps.etl.services import TextExtractor, SemanticChunker, EmbeddingService, process_document_pipeline
from apps.authentication.authentication import generate_tokens_for_user

class EtlPipelineTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='etl_tester',
            email='etl@almaproject.com',
            password='Password123!'
        )
        tokens = generate_tokens_for_user(self.user)
        self.token = tokens['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        self.chatbot = Chatbot.objects.create(
            user=self.user,
            name='Documentation Bot',
            system_prompt='You are an assistant for project documentation.'
        )
        self.upload_url = f'/api/chatbots/{self.chatbot.id}/documents/'

    def test_text_extractor_txt_and_md(self):
        sample_txt = io.BytesIO("Este es el contenido de prueba.\nLínea 2.\r\nLínea 3.".encode('utf-8'))
        extracted = TextExtractor.extract(sample_txt, 'txt')
        self.assertIn("Línea 2", extracted)
        self.assertIn("Línea 3", extracted)

    def test_semantic_chunker_overlap(self):
        text = (
            "El sistema Alma Project es una plataforma de chatbots con arquitectura RAG avanzada. "
            "Permite indexar documentos en formato PDF, Word, TXT y Markdown. "
            "Los fragmentos se almacenan con embeddings vectoriales de 384 dimensiones. "
            "La búsqueda semántica utiliza distancia coseno para recuperar el contexto más preciso. "
            "Todo el pipeline es rápido, confiable y seguro."
        )
        chunker = SemanticChunker(chunk_size=120, overlap=30)
        chunks = chunker.split_text(text)
        self.assertTrue(len(chunks) >= 2)
        for chunk in chunks:
            self.assertTrue(len(chunk) > 10)

    def test_embedding_service_dimensions_and_norm(self):
        sample_text = "Inteligencia artificial generativa para empresas."
        embedding = EmbeddingService.generate_embedding(sample_text)
        self.assertEqual(len(embedding), 384)
        # Check L2 unit norm approx 1.0
        norm = sum(x * x for x in embedding) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=3)

    def test_upload_document_endpoint_success(self):
        file_content = (
            "Guía de usuario para Alma Project.\n"
            "Capítulo 1: Configuración de la base de datos PostgreSQL con pgvector.\n"
            "Capítulo 2: Subida y extracción semántica de documentos.\n"
            "Capítulo 3: Respuestas aumentadas mediante recuperación de información."
        ).encode('utf-8')

        uploaded = SimpleUploadedFile("manual_alma.txt", file_content, content_type="text/plain")

        response = self.client.post(self.upload_url, {'file': uploaded}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('chunks_indexed', response.data)
        self.assertTrue(response.data['chunks_indexed'] > 0)

        # Check DB records
        doc = Document.objects.get(chatbot=self.chatbot, file_name='manual_alma.txt')
        self.assertEqual(doc.status, Document.STATUS_COMPLETED)
        self.assertTrue(doc.chunks.count() > 0)
        first_chunk = doc.chunks.first()
        self.assertEqual(len(first_chunk.embedding), 384)

    def test_upload_invalid_file_extension_rejected(self):
        bad_file = SimpleUploadedFile("script.sh", b"#!/bin/bash\necho hello", content_type="application/x-sh")
        response = self.client.post(self.upload_url, {'file': bad_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.data)

    def test_list_chatbot_documents(self):
        # Create a document
        Document.objects.create(
            chatbot=self.chatbot,
            file_name='test_doc.md',
            file_type='md',
            file_size=1024,
            status=Document.STATUS_COMPLETED
        )
        response = self.client.get(self.upload_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['documents'][0]['file_name'], 'test_doc.md')
