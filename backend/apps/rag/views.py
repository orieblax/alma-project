import uuid
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.chatbots.models import Chatbot
from apps.analytics.models import ChatSession, ChatMessage
from .services import RAGEngine

class ChatbotRAGView(APIView):
    """
    POST /api/chatbots/<chatbot_id>/chat/
    Accepts a user query, queries semantic vectors in pgvector/memory,
    builds an augmented response citing verified sources, and records analytics.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, chatbot_id):
        chatbot = get_object_or_404(Chatbot, id=chatbot_id)

        if not chatbot.is_active:
            return Response(
                {
                    'status': 'error',
                    'message': 'Este chatbot se encuentra actualmente inactivo.',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response(
                {
                    'status': 'error',
                    'message': 'El campo "message" es obligatorio y no puede estar vacío.',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(message_text) > 4000:
            return Response(
                {
                    'status': 'error',
                    'message': 'El mensaje no puede exceder los 4000 caracteres.',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Session tracking
        session_id = request.data.get('session_id')
        user = request.user if request.user.is_authenticated else None

        session = None
        if session_id:
            try:
                session = ChatSession.objects.filter(id=session_id, chatbot=chatbot).first()
            except Exception:
                session = None

        if not session:
            session = ChatSession.objects.create(
                chatbot=chatbot,
                user=user,
                session_key=str(uuid.uuid4())
            )

        # Save user message
        ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_USER,
            text=message_text,
        )

        # Run RAG execution
        rag_engine = RAGEngine(top_k=4)
        rag_output = rag_engine.execute_rag(chatbot=chatbot, user_query=message_text)

        # Save bot response message
        bot_message = ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_BOT,
            text=rag_output['response'],
            response_time_ms=rag_output['response_time_ms'],
            tokens_used=rag_output['tokens_used'],
        )

        return Response(
            {
                'status': 'success',
                'session_id': str(session.id),
                'message_id': str(bot_message.id),
                'response': rag_output['response'],
                'sources': rag_output['sources'],
                'precision_at_k': rag_output.get('precision_at_k', {}),
                'response_time_ms': rag_output['response_time_ms'],
                'tokens_used': rag_output['tokens_used'],
            },
            status=status.HTTP_200_OK
        )
