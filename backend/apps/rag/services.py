import math
import time
import re
import unicodedata
import logging
from typing import List, Dict, Any, Tuple, Optional
import requests
from django.conf import settings
from django.db import connection
from apps.chatbots.models import Chatbot
from apps.etl.models import Document, DocumentChunk
from apps.etl.services import EmbeddingService

logger = logging.getLogger(__name__)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a < 1e-9 or norm_b < 1e-9:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))

class RAGReranker:
    """
    Two-stage re-ranking engine combining dense vector similarity with lexical term density,
    exact phrase matching, and reciprocal rank weighting.
    Also computes information retrieval metrics including Precision@K.
    """

    SPANISH_STOPWORDS = {
        'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
        'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'o',
        'este', 'si', 'porque', 'esta', 'son', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'tambien',
        'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno',
        'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mi', 'antes',
        'algunos', 'que', 'unos', 'yo', 'otro', 'otras', 'otra', 'el', 'cual', 'cuales'
    }

    @staticmethod
    def strip_accents(text: str) -> str:
        """Removes diacritical marks for robust Spanish search matching."""
        if not text:
            return ""
        return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        clean = cls.strip_accents(text.lower())
        words = re.findall(r'\b[a-z0-9]{2,}\b', clean)
        return [w for w in words if w not in cls.SPANISH_STOPWORDS]

    @classmethod
    def compute_lexical_score(cls, query_tokens: List[str], doc_text: str) -> float:
        """Computes BM25-like TF/overlap score of query tokens within document text."""
        if not query_tokens or not doc_text:
            return 0.0
        doc_tokens = cls.tokenize(doc_text)
        if not doc_tokens:
            return 0.0

        doc_token_counts = {}
        for token in doc_tokens:
            doc_token_counts[token] = doc_token_counts.get(token, 0) + 1

        matched_score = 0.0
        for q in query_tokens:
            if q in doc_token_counts:
                tf = doc_token_counts[q]
                matched_score += 1.0 + math.log(tf) * 0.3

        return min(1.0, matched_score / max(len(query_tokens), 1))

    @classmethod
    def compute_phrase_bonus(cls, query: str, doc_text: str) -> float:
        """Awards a bonus if exact multi-word query sequences appear in the text."""
        cleaned_query = cls.strip_accents(query.lower().strip())
        cleaned_doc = cls.strip_accents(doc_text.lower())
        if len(cleaned_query) > 8 and cleaned_query in cleaned_doc:
            return 1.0

        words = [w for w in cleaned_query.split() if len(w) > 3]
        if len(words) >= 2:
            matches = 0
            total_pairs = len(words) - 1
            for i in range(total_pairs):
                bigram = f"{words[i]} {words[i+1]}"
                if bigram in cleaned_doc:
                    matches += 1
            return matches / max(total_pairs, 1)
        return 0.0

    @classmethod
    def rerank_candidates(
        cls,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 4,
        relevance_threshold: float = 0.45,
        dense_weight: float = 0.60,
        lexical_weight: float = 0.30,
        phrase_weight: float = 0.10
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Re-ranks top candidates and computes Precision@K.
        Returns (reranked_chunks, precision_at_k_dict).
        """
        if not candidates:
            return [], {
                'k': top_k,
                'precision': 0.0,
                'relevant_count': 0,
                'total_evaluated': 0,
                'threshold': relevance_threshold
            }

        query_tokens = cls.tokenize(query)

        scored = []
        for cand in candidates:
            initial_score = float(cand.get('score', 0.0))
            full_text = cand.get('full_content') or cand.get('snippet', '')

            lexical_score = cls.compute_lexical_score(query_tokens, full_text)
            phrase_score = cls.compute_phrase_bonus(query, full_text)

            composite_score = (
                dense_weight * initial_score +
                lexical_weight * lexical_score +
                phrase_weight * phrase_score
            )
            composite_score = round(min(1.0, max(0.0, composite_score)), 4)

            enriched = dict(cand)
            enriched['initial_score'] = initial_score
            enriched['rerank_score'] = composite_score
            enriched['score'] = composite_score
            enriched['is_relevant'] = composite_score >= relevance_threshold
            scored.append(enriched)

        scored.sort(key=lambda x: x['rerank_score'], reverse=True)
        top_results = scored[:top_k]

        for idx, item in enumerate(top_results, start=1):
            item['rank'] = idx

        total_eval = len(top_results)
        relevant_count = sum(1 for item in top_results if item['is_relevant'])
        precision = round(relevant_count / max(total_eval, 1), 4) if total_eval > 0 else 0.0

        precision_metrics = {
            'k': top_k,
            'precision': precision,
            'relevant_count': relevant_count,
            'total_evaluated': total_eval,
            'threshold': relevance_threshold
        }

        return top_results, precision_metrics


class RAGEngine:
    """High-performance RAG Retrieval and Synthesis Engine with Re-ranking and Ollama LLM support."""

    def __init__(
        self,
        top_k: int = 4,
        min_score: float = 0.05,
        candidate_k: int = 10,
        relevance_threshold: float = 0.45
    ):
        self.top_k = top_k
        self.min_score = min_score
        self.candidate_k = max(candidate_k, top_k)
        self.relevance_threshold = relevance_threshold
        self.last_precision_metrics: Dict[str, Any] = {
            'k': top_k,
            'precision': 0.0,
            'relevant_count': 0,
            'total_evaluated': 0,
            'threshold': relevance_threshold
        }

    def retrieve(self, chatbot: Chatbot, query: str) -> List[Dict[str, Any]]:
        """
        Retrieves top-k most semantically and lexically relevant chunks using a two-stage pipeline:
        Stage 1: pgvector CosineDistance on Supabase (or in-memory vector search on SQLite).
        Stage 2: Hybrid re-ranking and Precision@K evaluation.
        """
        query_embedding = EmbeddingService.generate_embedding(query)
        chunks_qs = DocumentChunk.objects.filter(
            document__chatbot=chatbot,
            document__status=Document.STATUS_COMPLETED
        ).select_related('document')

        if not chunks_qs.exists():
            self.last_precision_metrics = {
                'k': self.top_k,
                'precision': 0.0,
                'relevant_count': 0,
                'total_evaluated': 0,
                'threshold': self.relevance_threshold
            }
            return []

        results = []
        is_postgres = connection.vendor == 'postgresql'

        if is_postgres:
            try:
                from pgvector.django import CosineDistance
                annotated = chunks_qs.annotate(
                    distance=CosineDistance('embedding', query_embedding)
                ).order_by('distance')[:self.candidate_k]

                for item in annotated:
                    # Cosine distance = 1 - cosine similarity
                    distance = float(item.distance) if item.distance is not None else 1.0
                    similarity = max(0.0, 1.0 - distance)
                    if similarity >= self.min_score:
                        results.append(self._format_source_chunk(item, similarity))
            except Exception as e:
                logger.warning(f"pgvector query error ({e}), falling back to memory cosine.")

        # Fallback in-memory cosine computation (SQLite or error fallback)
        if not results:
            scored_chunks = []
            for chunk in chunks_qs:
                vec = chunk.embedding
                if vec is None:
                    continue
                if isinstance(vec, str):
                    import json
                    try:
                        vec = json.loads(vec)
                    except Exception:
                        continue
                sim = cosine_similarity(query_embedding, list(vec))
                if sim >= self.min_score:
                    scored_chunks.append((chunk, sim))

            scored_chunks.sort(key=lambda x: x[1], reverse=True)
            for chunk, sim in scored_chunks[:self.candidate_k]:
                results.append(self._format_source_chunk(chunk, sim))

        # Stage 2: Re-ranking and Precision@K calculation
        reranked_chunks, precision_metrics = RAGReranker.rerank_candidates(
            query=query,
            candidates=results,
            top_k=self.top_k,
            relevance_threshold=self.relevance_threshold
        )
        self.last_precision_metrics = precision_metrics
        return reranked_chunks

    def _format_source_chunk(self, chunk: DocumentChunk, score: float) -> Dict[str, Any]:
        return {
            'document_id': str(chunk.document.id),
            'document_name': chunk.document.file_name,
            'chunk_id': str(chunk.id),
            'chunk_index': chunk.chunk_index,
            'score': round(float(score), 4),
            'snippet': chunk.content[:200] + ('...' if len(chunk.content) > 200 else ''),
            'full_content': chunk.content,
        }

    def _call_ollama(self, system_content: str, user_query: str) -> Optional[Tuple[str, int]]:
        """
        Sends chat completion request to local Ollama API (qwen3.5:9b).
        Returns (response_text, tokens_used) on success, or None on connection error/timeout.
        """
        use_ollama = getattr(settings, 'USE_OLLAMA', True)
        if not use_ollama:
            return None

        api_url = getattr(settings, 'OLLAMA_API_URL', 'http://localhost:11434/v1/chat/completions')
        model = getattr(settings, 'OLLAMA_MODEL', 'qwen3.5:9b')
        timeout = getattr(settings, 'OLLAMA_TIMEOUT_SECONDS', 60)

        payload = {
            'model': model,
            'messages': [
                {'role': 'system', 'content': system_content},
                {'role': 'user', 'content': user_query}
            ],
            'temperature': 0.3,
        }

        try:
            response = requests.post(
                api_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=timeout
            )
            if response.status_code == 200:
                data = response.json()
                choices = data.get('choices', [])
                if choices and 'message' in choices[0]:
                    content = choices[0]['message'].get('content', '').strip()
                    usage = data.get('usage', {})
                    tokens = usage.get('total_tokens')
                    if tokens is None or tokens <= 0:
                        tokens = len(system_content.split()) + len(user_query.split()) + len(content.split())
                    return content, int(tokens)
            else:
                logger.warning(
                    f"Ollama respondió con error HTTP {response.status_code}: {response.text[:200]}"
                )
        except requests.exceptions.RequestException as e:
            logger.info(f"Ollama no disponible en {api_url} ({e}). Utilizando fallback determinístico.")
        except Exception as e:
            logger.warning(f"Error inesperado al conectar con Ollama: {e}. Utilizando fallback determinístico.")

        return None

    def generate_response(
        self,
        chatbot: Chatbot,
        user_query: str,
        sources: List[Dict[str, Any]]
    ) -> Tuple[str, int]:
        """
        Synthesizes an augmented answer using Ollama (qwen3.5:9b) with retrieved sources,
        or resorts to a resilient deterministic generator if Ollama is unreachable.
        Returns (response_text, estimated_tokens).
        """
        system_prompt = chatbot.system_prompt or "Eres un asistente virtual profesional y preciso."

        if not sources:
            # Try Ollama with empty context note
            system_content = (
                f"{system_prompt}\n\n"
                "NOTA: Actualmente este chatbot no dispone de documentos indexados con información sobre la pregunta del usuario. "
                "Informa de manera amable, cordial y profesional que no cuentas con información cargada sobre este tema "
                "e invita al usuario a subir manuales o documentación relevante."
            )
            ollama_result = self._call_ollama(system_content, user_query)
            if ollama_result is not None:
                return ollama_result

            # Fallback deterministic response
            response_text = (
                f"{system_prompt}\n\n"
                f"He analizado tu consulta '{user_query}', pero actualmente este chatbot no cuenta con "
                f"documentos indexados con información sobre ese tema. "
                f"Por favor sube documentos relevantes en formato PDF, Word (.docx), TXT o Markdown para que pueda responderte con base en tu información."
            )
            estimated_tokens = len(system_prompt.split()) + len(user_query.split()) + len(response_text.split())
            return response_text, estimated_tokens

        # Synthesize context blocks from verified sources
        context_blocks = []
        for i, src in enumerate(sources, 1):
            context_blocks.append(
                f"[Fuente {i}: {src['document_name']} (fragmento #{src['chunk_index']})]\n{src['full_content']}"
            )
        context_str = "\n\n".join(context_blocks)

        # 1. Try Ollama synthesis with retrieved context
        system_content = (
            f"{system_prompt}\n\n"
            f"CONTEXTO DOCUMENTAL RECUPERADO:\n{context_str}\n\n"
            "INSTRUCCIONES OBLIGATORIAS:\n"
            "1. Responde a la pregunta del usuario basándote principalmente en el CONTEXTO DOCUMENTAL provisto.\n"
            "2. Sé claro, conciso, educado y profesional.\n"
            "3. Menciona las fuentes consultadas al fundamentar tu respuesta.\n"
            "4. Si la respuesta no está en el contexto provisto, indícalo claramente."
        )

        ollama_result = self._call_ollama(system_content, user_query)
        if ollama_result is not None:
            llm_text, tokens = ollama_result
            # Check if source reference is mentioned, otherwise append summary citation
            source_names = list({src['document_name'] for src in sources})
            if not any(name in llm_text for name in source_names):
                llm_text += f"\n\n*Fuentes consultadas: {', '.join(source_names)}*"
            return llm_text, tokens

        # 2. Resilient Deterministic Fallback Synthesis
        primary_source = sources[0]
        response_text = (
            f"Basado en la documentación analizada para **{chatbot.name}**:\n\n"
            f"{primary_source['full_content'].strip()}\n\n"
        )

        if len(sources) > 1:
            additional_snippets = []
            for src in sources[1:3]:
                additional_snippets.append(f"- **{src['document_name']}**: {src['snippet']}")
            response_text += "Información complementaria detectada:\n" + "\n".join(additional_snippets) + "\n\n"

        response_text += f"*Respuesta generada a partir de {len(sources)} fuente(s) verificada(s).*"

        prompt_tokens = len(system_prompt.split()) + len(context_str.split()) + len(user_query.split())
        completion_tokens = len(response_text.split())
        total_tokens = prompt_tokens + completion_tokens

        return response_text, total_tokens

    def execute_rag(self, chatbot: Chatbot, user_query: str) -> Dict[str, Any]:
        """Full end-to-end RAG pipeline with high-precision timing."""
        start_time = time.perf_counter()

        sources = self.retrieve(chatbot, user_query)
        response_text, tokens_used = self.generate_response(chatbot, user_query, sources)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        # Strip full_content from the final output payload to keep it lean
        clean_sources = [
            {k: v for k, v in src.items() if k != 'full_content'}
            for src in sources
        ]

        return {
            'response': response_text,
            'sources': clean_sources,
            'precision_at_k': self.last_precision_metrics,
            'response_time_ms': elapsed_ms,
            'tokens_used': tokens_used,
        }
