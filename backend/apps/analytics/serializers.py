from rest_framework import serializers
from .models import ChatSession, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'session',
            'sender',
            'text',
            'response_time_ms',
            'tokens_used',
            'feedback_rating',
            'feedback_comment',
            'created_at',
        ]

class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    messages_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id',
            'chatbot',
            'user',
            'session_key',
            'messages_count',
            'messages',
            'created_at',
            'updated_at',
        ]

    def get_messages_count(self, obj):
        return obj.messages.count()

class FeedbackSerializer(serializers.Serializer):
    message_id = serializers.UUIDField(required=True)
    rating = serializers.IntegerField(required=True, min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default='')

class KPISerializer(serializers.Serializer):
    total_chatbots = serializers.IntegerField()
    total_documents = serializers.IntegerField()
    total_chunks = serializers.IntegerField()
    total_queries = serializers.IntegerField()
    avg_response_time_ms = serializers.FloatField()
    satisfaction_score = serializers.FloatField()
    active_chatbots = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
