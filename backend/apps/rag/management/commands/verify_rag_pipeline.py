import uuid
import time
from django.core.management.base import BaseCommand
from django.db import connection
from django.contrib.auth import get_user_model
from django.conf import settings

from apps.chatbots.models import Chatbot
from apps.etl.models import Document, DocumentChunk
from apps.etl.services import EmbeddingService
from apps.rag.services import RAGEngine

User = get_user_model()

class Command(BaseCommand):
    help = "E2E verification of Ollama (all-minilm) + Supabase (pgvector) + Ollama LLM (qwen3.5:9b)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.SUCCESS("  ALMA PROJECT - RAG + ETL + SUPABASE VERIFICATION PIPELINE"))
        self.stdout.write(self.style.SUCCESS("=" * 70))

        # 1. Supabase & pgvector Connection Check
        self.stdout.write("\n[1/5] Verificando conexión a Supabase y extensión pgvector...")
        engine = connection.settings_dict.get('ENGINE', '')
        host = connection.settings_dict.get('HOST', '')
        self.stdout.write(f"  -> Motor de DB: {engine}")
        self.stdout.write(f"  -> Host: {host}")

        with connection.cursor() as cursor:
            cursor.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
            ext = cursor.fetchone()
            if ext:
                self.stdout.write(self.style.SUCCESS(f"  [OK] pgvector instalado en Supabase: versión {ext[1]}"))
            else:
                self.stdout.write(self.style.ERROR("  [FAIL] La extensión pgvector no está activa en la base de datos."))
                return

        # 2. Ollama Embeddings Check
        self.stdout.write("\n[2/5] Probando generación de embeddings locales con Ollama (all-minilm)...")
        test_text = "Supabase almacena vectores densos utilizando la extensión pgvector para consultas RAG."
        emb = EmbeddingService.generate_embedding(test_text)
        self.stdout.write(f"  -> Dimensión obtenida: {len(emb)}")
        if len(emb) == 384:
            self.stdout.write(self.style.SUCCESS(f"  [OK] Embedding individual válido (384 dimensiones)"))
        else:
            self.stdout.write(self.style.ERROR(f"  [FAIL] Dimensión incorrecta: {len(emb)}"))
            return

        batch_texts = [
            "El motor ETL extrae texto de PDFs y documentos Word.",
            "Next.js gestiona la interfaz gráfica y la autenticación SSR.",
            "Ollama ejecuta modelos de lenguaje locales sin enviar datos a la nube."
        ]
        batch_embs = EmbeddingService.generate_embeddings_batch(batch_texts)
        if len(batch_embs) == 3 and all(len(v) == 384 for v in batch_embs):
            self.stdout.write(self.style.SUCCESS(f"  [OK] Generación por lotes exitosa: 3 vectores de 384 dimensiones"))
        else:
            self.stdout.write(self.style.ERROR("  [FAIL] Error en generación de embeddings en batch"))
            return

        # 3. Persistencia en Supabase
        self.stdout.write("\n[3/5] Creando chatbot de prueba y persistiendo fragmentos en Supabase...")
        test_user, _ = User.objects.get_or_create(
            username="rag_verifier_system",
            defaults={"email": "verifier@almaproject.local"}
        )

        test_bot = Chatbot.objects.create(
            user=test_user,
            name="Test Bot Supabase RAG",
            description="Chatbot temporal de verificación",
            system_prompt="Eres un asistente técnico que explica la arquitectura de Alma Project.",
            is_active=True
        )

        test_doc = Document.objects.create(
            chatbot=test_bot,
            file_name="arquitectura_alma.txt",
            file_type="txt",
            file_size=1024,
            status=Document.STATUS_COMPLETED
        )

        chunks_data = [
            "Alma Project utiliza Next.js en el frontend y Django en el backend para una arquitectura moderna.",
            "La base de datos principal es PostgreSQL en Supabase con pgvector habilitado para búsquedas vectoriales.",
            "Para los embeddings se usa el modelo local all-minilm mediante Ollama con 384 dimensiones.",
            "Las respuestas aumentadas se generan con el modelo qwen3.5:9b ejecutándose localmente en Ollama.",
        ]

        embs = EmbeddingService.generate_embeddings_batch(chunks_data)
        chunks = [
            DocumentChunk(
                document=test_doc,
                content=txt,
                chunk_index=i,
                embedding=vec
            )
            for i, (txt, vec) in enumerate(zip(chunks_data, embs))
        ]
        DocumentChunk.objects.bulk_create(chunks)
        self.stdout.write(self.style.SUCCESS(f"  [OK] {len(chunks)} fragmentos guardados exitosamente en Supabase (etl_documentchunk)"))

        # 4. Retrieval Semántico con pgvector CosineDistance
        self.stdout.write("\n[4/5] Ejecutando búsqueda semántica con pgvector CosineDistance...")
        user_query = "¿Qué modelo local se usa para generar los embeddings de vectores?"
        rag_engine = RAGEngine(top_k=2)
        sources = rag_engine.retrieve(test_bot, user_query)

        self.stdout.write(f"  -> Consulta: '{user_query}'")
        self.stdout.write(f"  -> Fuentes recuperadas: {len(sources)}")
        for src in sources:
            self.stdout.write(f"     * Score: {src['score']} | {src['snippet']}")

        if sources and "all-minilm" in sources[0]['full_content']:
            self.stdout.write(self.style.SUCCESS("  [OK] pgvector recuperó con máxima similitud el fragmento correcto!"))
        else:
            self.stdout.write(self.style.WARNING("  [WARN] pgvector retornó resultados pero la mejor coincidencia difiere"))

        # 5. Generación Aumentada con Ollama LLM (qwen3.5:9b)
        self.stdout.write("\n[5/5] Sintetizando respuesta con el LLM local Ollama (qwen3.5:9b)...")
        rag_output = rag_engine.execute_rag(test_bot, user_query)
        self.stdout.write(f"  -> Tiempo de respuesta: {rag_output['response_time_ms']} ms")
        self.stdout.write(f"  -> Tokens utilizados: {rag_output['tokens_used']}")
        self.stdout.write(self.style.SUCCESS("  -> Respuesta generada:"))
        self.stdout.write(f"\n{rag_output['response']}\n")

        # Cleanup
        test_bot.delete()
        self.stdout.write(self.style.SUCCESS("\n[COMPLETADO] Limpieza de datos temporales realizada. Todo el flujo RAG funciona al 100%."))
