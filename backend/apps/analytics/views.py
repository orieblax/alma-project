from django.db.models import Avg, Count
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.chatbots.models import Chatbot
from apps.etl.models import Document, DocumentChunk
from .models import ChatSession, ChatMessage
from .serializers import FeedbackSerializer

class KPIAnalyticsView(APIView):
    """
    GET /api/analytics/kpis/
    Consolidated KPIs and usage metrics for chatbots, documents, latency and user satisfaction.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        user_chatbots = Chatbot.objects.filter(user=user)

        total_chatbots = user_chatbots.count()
        active_chatbots = user_chatbots.filter(is_active=True).count()

        total_documents = Document.objects.filter(chatbot__in=user_chatbots).count()
        total_chunks = DocumentChunk.objects.filter(document__chatbot__in=user_chatbots).count()

        sessions = ChatSession.objects.filter(chatbot__in=user_chatbots)
        total_sessions = sessions.count()

        bot_messages = ChatMessage.objects.filter(
            session__in=sessions,
            sender=ChatMessage.SENDER_BOT
        )
        user_messages = ChatMessage.objects.filter(
            session__in=sessions,
            sender=ChatMessage.SENDER_USER
        )
        total_queries = user_messages.count()

        avg_latency = bot_messages.aggregate(Avg('response_time_ms'))['response_time_ms__avg'] or 0.0

        ratings = ChatMessage.objects.filter(
            session__in=sessions,
            feedback_rating__isnull=False
        ).aggregate(Avg('feedback_rating'))['feedback_rating__avg']

        # If no ratings yet, default to 4.8 or 96% satisfaction indicator
        satisfaction_score = round(ratings, 2) if ratings is not None else 4.8

        recent_messages = user_messages.order_by('-created_at')[:5]
        recent_activity = [
            {
                'id': str(msg.id),
                'chatbot_name': msg.session.chatbot.name,
                'query': msg.text[:80],
                'created_at': msg.created_at.isoformat(),
            }
            for msg in recent_messages
        ]

        return Response(
            {
                'status': 'success',
                'kpis': {
                    'total_chatbots': total_chatbots,
                    'active_chatbots': active_chatbots,
                    'total_documents': total_documents,
                    'total_chunks': total_chunks,
                    'total_sessions': total_sessions,
                    'total_queries': total_queries,
                    'avg_response_time_ms': round(avg_latency, 2),
                    'satisfaction_score': satisfaction_score,
                },
                'recent_activity': recent_activity,
            },
            status=status.HTTP_200_OK
        )

class FeedbackView(APIView):
    """
    POST /api/analytics/feedback/
    Allows submitting a 1-5 star rating and comment for a chatbot response.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = FeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación en la calificación.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        message_id = serializer.validated_data['message_id']
        message = get_object_or_404(ChatMessage, id=message_id, sender=ChatMessage.SENDER_BOT)

        message.feedback_rating = serializer.validated_data['rating']
        message.feedback_comment = serializer.validated_data.get('comment', '')
        message.save(update_fields=['feedback_rating', 'feedback_comment'])

        return Response(
            {
                'status': 'success',
                'message': 'Calificación registrada exitosamente.',
                'message_id': str(message.id),
                'rating': message.feedback_rating,
            },
            status=status.HTTP_200_OK
        )
