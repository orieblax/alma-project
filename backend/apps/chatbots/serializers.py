from rest_framework import serializers
from .models import Chatbot

class ChatbotSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    documents_count = serializers.SerializerMethodField()
    chunks_count = serializers.SerializerMethodField()

    class Meta:
        model = Chatbot
        fields = [
            'id',
            'user',
            'user_email',
            'name',
            'description',
            'system_prompt',
            'is_active',
            'documents_count',
            'chunks_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'documents_count', 'chunks_count']

    def get_documents_count(self, obj):
        return getattr(obj, 'documents', None).count() if hasattr(obj, 'documents') else 0

    def get_chunks_count(self, obj):
        if not hasattr(obj, 'documents'):
            return 0
        from apps.etl.models import DocumentChunk
        return DocumentChunk.objects.filter(document__chatbot=obj).count()

    def validate_name(self, value):
        name_clean = value.strip()
        if len(name_clean) < 2:
            raise serializers.ValidationError("El nombre del chatbot debe tener al menos 2 caracteres.")
        if len(name_clean) > 255:
            raise serializers.ValidationError("El nombre del chatbot no puede exceder 255 caracteres.")
        return name_clean

    def validate_system_prompt(self, value):
        if not value or not value.strip():
            return "Eres un asistente inteligente cordial, preciso y profesional. Responde utilizando el contexto suministrado."
        return value.strip()
