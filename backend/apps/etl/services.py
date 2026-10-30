import io
import math
import hashlib
import logging
from typing import List, Optional, Union
import requests
from django.conf import settings
from .models import Document, DocumentChunk

logger = logging.getLogger(__name__)

class TextExtractor:
    """Extracts raw text from multiple document formats (.pdf, .docx, .txt, .md)."""

    @staticmethod
    def extract(file_obj, file_type: str) -> str:
        file_type = file_type.lower().strip().lstrip('.')
        text = ""

        if file_type == 'pdf':
            import pypdf
            reader = pypdf.PdfReader(file_obj)
            pages_text = []
            for i, page in enumerate(reader.pages):
                extracted = page.extract_text() or ""
                if extracted.strip():
                    pages_text.append(extracted.strip())
            text = "\n\n".join(pages_text)

        elif file_type == 'docx':
            import docx
            doc = docx.Document(file_obj)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n\n".join(paragraphs)

        elif file_type in ['txt', 'md', 'markdown']:
            if hasattr(file_obj, 'read'):
                content = file_obj.read()
            else:
                with open(file_obj, 'rb') as f:
                    content = f.read()

            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                text = content.decode('latin-1', errors='replace')
        else:
            raise ValueError(f"Formato de archivo no soportado: .{file_type}")

        return TextExtractor.clean_text(text)

    @staticmethod
    def clean_text(raw_text: str) -> str:
        """Sanitizes text removing null bytes and collapsing excessive whitespace."""
        if not raw_text:
            return ""
        # Remove null bytes and carriage returns
        cleaned = raw_text.replace('\x00', '').replace('\r\n', '\n').replace('\r', '\n')
        # Collapse excessive newlines
        lines = [line.strip() for line in cleaned.split('\n')]
        # Rejoin paragraphs
        result = []
        for line in lines:
            if line:
                result.append(line)
            elif result and result[-1] != '':
                result.append('')
        return "\n".join(result).strip()


class SemanticChunker:
    """Splits continuous text into overlapping semantic fragments."""

    def __init__(self, chunk_size: int = 500, overlap: int = 100):
        self.chunk_size = max(chunk_size, 100)
        self.overlap = min(overlap, self.chunk_size // 2)

    def split_text(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []

        # Split into initial paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        current_chunk = ""

        for paragraph in paragraphs:
            # If a single paragraph is larger than chunk_size, split by sentences or punctuation
            if len(paragraph) > self.chunk_size:
                sentences = self._split_sentences(paragraph)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                            # Apply overlap from the tail of current_chunk
                            overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                            current_chunk = f"{overlap_text} {sentence}".strip()
                        else:
                            # Sentence itself is bigger than chunk_size, hard slice
                            for i in range(0, len(sentence), self.chunk_size - self.overlap):
                                chunks.append(sentence[i:i + self.chunk_size])
                            current_chunk = ""
            else:
                if len(current_chunk) + len(paragraph) + 2 <= self.chunk_size:
                    current_chunk = f"{current_chunk}\n\n{paragraph}".strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                        overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                        current_chunk = f"{overlap_text}\n\n{paragraph}".strip()
                    else:
                        current_chunk = paragraph

        if current_chunk:
            chunks.append(current_chunk)

        return [c.strip() for c in chunks if len(c.strip()) > 10]

    def _split_sentences(self, text: str) -> List[str]:
        """Splits text on sentence boundaries."""
        import re
        parts = re.split(r'(?<=[.!?])\s+', text)
        return [p.strip() for p in parts if p.strip()]


class EmbeddingService:
    """
    Generates 384-dimensional dense vectors using local Ollama (all-minilm).
    Supports high-speed batch generation (/api/embed) and single vector generation,
    with an automatic mathematical fallback if Ollama is unreachable.
    """

    DIMENSIONS = 384

    @classmethod
    def _call_ollama_embed(cls, input_data: Union[str, List[str]]) -> Optional[List[List[float]]]:
        """Calls local Ollama API to generate embeddings for a text or batch of texts."""
        base_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')
        embed_model = getattr(settings, 'OLLAMA_EMBED_MODEL', 'all-minilm')
        timeout = getattr(settings, 'OLLAMA_EMBED_TIMEOUT', 30)

        # 1. Try batch endpoint: /api/embed
        try:
            url = f"{base_url}/api/embed"
            payload = {
                'model': embed_model,
                'input': input_data,
            }
            res = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=timeout)
            if res.status_code == 200:
                data = res.json()
                embeddings = data.get('embeddings')
                if embeddings and isinstance(embeddings, list):
                    return [[float(x) for x in vec] for vec in embeddings]
        except Exception as e:
            logger.debug(f"Ollama /api/embed call failed: {e}")

        # 2. Fallback to /api/embeddings for single text string
        if isinstance(input_data, str):
            try:
                url = f"{base_url}/api/embeddings"
                payload = {
                    'model': embed_model,
                    'prompt': input_data,
                }
                res = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=timeout)
                if res.status_code == 200:
                    data = res.json()
                    emb = data.get('embedding')
                    if emb and isinstance(emb, list):
                        return [[float(x) for x in emb]]
            except Exception as e:
                logger.debug(f"Ollama /api/embeddings call failed: {e}")

        return None

    @classmethod
    def generate_embedding(cls, text: str) -> List[float]:
        """Returns a single 384-dimensional unit-normalized float vector."""
        if not text or not text.strip():
            return [0.0] * cls.DIMENSIONS

        vectors = cls._call_ollama_embed(text)
        if vectors and len(vectors) > 0 and len(vectors[0]) == cls.DIMENSIONS:
            return vectors[0]

        logger.warning(
            f"Ollama no devolvió embedding de {cls.DIMENSIONS} dims. Usando fallback matemático determinístico."
        )
        return cls._mathematical_embedding_fallback(text)

    @classmethod
    def generate_embeddings_batch(cls, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """
        Generates 384-dimensional embeddings for a list of texts in optimized batches.
        Drastically speeds up ETL indexing for multi-chunk documents.
        """
        if not texts:
            return []

        results: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            chunk_slice = texts[i:i + batch_size]
            clean_slice = [t if t and t.strip() else " " for t in chunk_slice]

            batch_vectors = cls._call_ollama_embed(clean_slice)
            if batch_vectors and len(batch_vectors) == len(chunk_slice):
                results.extend(batch_vectors)
            else:
                for text in chunk_slice:
                    results.append(cls.generate_embedding(text))

        return results

    @classmethod
    def _mathematical_embedding_fallback(cls, text: str) -> List[float]:
        """
        Deterministic, seed-hashing n-gram vectorizer with L2 normalization.
        Guarantees 384 dimensions and consistent cosine similarities for textual overlap.
        """
        vector = [0.0] * cls.DIMENSIONS
        words = [w.lower().strip() for w in text.split() if w.strip()]

        if not words:
            return vector

        tokens = list(words)
        for i in range(len(words) - 1):
            tokens.append(f"{words[i]}_{words[i+1]}")

        for token in tokens:
            h = hashlib.md5(token.encode('utf-8')).digest()
            for i in range(0, len(h), 4):
                val = int.from_bytes(h[i:i+4], byteorder='little', signed=True)
                dim_idx = abs(val) % cls.DIMENSIONS
                sign = 1.0 if (val & 1) == 0 else -1.0
                weight = 1.0 / (1.0 + math.log(len(token) + 1))
                vector[dim_idx] += sign * weight

        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 1e-9:
            vector = [float(x / norm) for x in vector]
        else:
            vector = [0.0] * cls.DIMENSIONS

        return vector


def process_document_pipeline(document: Document) -> int:
    """
    Executes the full ETL pipeline for a Document:
    1. Extracts text from file.
    2. Splits into semantic overlapping chunks.
    3. Computes 384-dim embeddings.
    4. Persists DocumentChunk models.
    5. Updates Document status.
    """
    try:
        document.status = Document.STATUS_PROCESSING
        document.error_message = ''
        document.save(update_fields=['status', 'error_message', 'updated_at'])

        # 1. Extraction
        file_obj = document.file
        file_obj.seek(0)
        text = TextExtractor.extract(file_obj, document.file_type)

        if not text.strip():
            raise ValueError("El archivo está vacío o no contiene texto procesable.")

        # 2. Semantic Chunking
        chunker = SemanticChunker(chunk_size=500, overlap=100)
        chunks = chunker.split_text(text)

        if not chunks:
            raise ValueError("No se pudieron generar fragmentos a partir del texto extraído.")

        # 3. Clean previous chunks if re-processing
        document.chunks.all().delete()

        # 4. Generate Embeddings in batch using local Ollama (all-minilm)
        embeddings = EmbeddingService.generate_embeddings_batch(chunks)

        # 5. Build DocumentChunk instances & Persist to Supabase pgvector
        chunk_instances = []
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_instances.append(
                DocumentChunk(
                    document=document,
                    content=chunk_text,
                    chunk_index=idx,
                    embedding=embedding
                )
            )

        DocumentChunk.objects.bulk_create(chunk_instances)

        document.status = Document.STATUS_COMPLETED
        document.error_message = ''
        document.save(update_fields=['status', 'error_message', 'updated_at'])
        return len(chunk_instances)

    except Exception as exc:
        logger.exception(f"Error procesando documento {document.id}: {exc}")
        document.status = Document.STATUS_ERROR
        document.error_message = str(exc)
        document.save(update_fields=['status', 'error_message', 'updated_at'])
        raise exc
