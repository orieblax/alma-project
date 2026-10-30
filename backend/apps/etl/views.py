import os
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.chatbots.models import Chatbot
from .models import Document, DocumentChunk
from .serializers import DocumentSerializer, DocumentUploadSerializer, DocumentChunkSerializer
from .services import process_document_pipeline

class DocumentListUploadView(APIView):
    """
    GET: List all documents uploaded to a specific chatbot.
    POST: Upload a new document (.pdf, .docx, .txt, .md) and execute ETL processing.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_chatbot(self, chatbot_id, user):
        return get_object_or_404(Chatbot, id=chatbot_id, user=user)

    def get(self, request, chatbot_id):
        chatbot = self.get_chatbot(chatbot_id, request.user)
        documents = chatbot.documents.all()
        serializer = DocumentSerializer(documents, many=True)
        return Response(
            {
                'status': 'success',
                'chatbot_id': str(chatbot.id),
                'count': documents.count(),
                'documents': serializer.data,
            },
            status=status.HTTP_200_OK
        )

    def post(self, request, chatbot_id):
        chatbot = self.get_chatbot(chatbot_id, request.user)
        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación en la subida del documento.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = serializer.validated_data['file']
        filename = uploaded_file.name
        ext = os.path.splitext(filename)[1].lower().lstrip('.')

        document = Document.objects.create(
            chatbot=chatbot,
            file=uploaded_file,
            file_name=filename,
            file_type=ext,
            file_size=uploaded_file.size,
            status=Document.STATUS_PENDING,
        )

        try:
            total_chunks = process_document_pipeline(document)
            document.refresh_from_db()
            return Response(
                {
                    'status': 'success',
                    'message': f"Documento '{filename}' procesado e indexado exitosamente.",
                    'document': DocumentSerializer(document).data,
                    'chunks_indexed': total_chunks,
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as exc:
            document.refresh_from_db()
            return Response(
                {
                    'status': 'error',
                    'message': f"Ocurrió un error al procesar el archivo: {str(exc)}",
                    'document': DocumentSerializer(document).data,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DocumentDetailView(APIView):
    """Retrieve document details and chunks or delete document."""
    permission_classes = [permissions.IsAuthenticated]

    def get_document(self, chatbot_id, document_id, user):
        chatbot = get_object_or_404(Chatbot, id=chatbot_id, user=user)
        return get_object_or_404(Document, id=document_id, chatbot=chatbot)

    def get(self, request, chatbot_id, document_id):
        doc = self.get_document(chatbot_id, document_id, request.user)
        serializer = DocumentSerializer(doc)
        chunks = doc.chunks.all()
        chunks_data = DocumentChunkSerializer(chunks, many=True).data

        return Response(
            {
                'status': 'success',
                'document': serializer.data,
                'chunks': chunks_data,
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, chatbot_id, document_id):
        doc = self.get_document(chatbot_id, document_id, request.user)
        file_name = doc.file_name
        doc.delete()
        return Response(
            {
                'status': 'success',
                'message': f"Documento '{file_name}' eliminado exitosamente.",
            },
            status=status.HTTP_200_OK
        )
