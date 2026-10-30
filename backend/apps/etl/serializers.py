import os
from rest_framework import serializers
from .models import Document, DocumentChunk

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md'}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ['id', 'chunk_index', 'content', 'created_at']

class DocumentSerializer(serializers.ModelSerializer):
    chunks_count = serializers.SerializerMethodField()
    file_size_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'chatbot',
            'file',
            'file_name',
            'file_type',
            'file_size',
            'file_size_formatted',
            'status',
            'error_message',
            'chunks_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'chatbot', 'file_name', 'file_type', 'file_size',
            'status', 'error_message', 'chunks_count', 'created_at', 'updated_at'
        ]

    def get_chunks_count(self, obj):
        return obj.chunks.count()

    def get_file_size_formatted(self, obj):
        size = obj.file_size or 0
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        return f"{size / (1024 * 1024):.2f} MB"

class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

    def validate_file(self, value):
        filename = value.name
        ext = os.path.splitext(filename)[1].lower().lstrip('.')
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Formato no permitido: '.{ext}'. Formatos soportados: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
            )

        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"El archivo excede el tamaño máximo permitido de 25MB (Tamaño actual: {value.size / (1024 * 1024):.1f}MB)."
            )

        return value
