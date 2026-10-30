from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Chatbot
from .serializers import ChatbotSerializer

class ChatbotListCreateView(APIView):
    """List all chatbots belonging to the authenticated user or create a new one."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        chatbots = Chatbot.objects.filter(user=request.user)
        serializer = ChatbotSerializer(chatbots, many=True)
        return Response(
            {
                'status': 'success',
                'count': chatbots.count(),
                'results': serializer.data,
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = ChatbotSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación al crear el chatbot.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        chatbot = serializer.save(user=request.user)
        return Response(
            {
                'status': 'success',
                'message': 'Chatbot creado exitosamente.',
                'chatbot': ChatbotSerializer(chatbot).data,
            },
            status=status.HTTP_201_CREATED
        )

class ChatbotDetailView(APIView):
    """Retrieve, update or delete a specific chatbot belonging to the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, chatbot_id, user):
        return get_object_or_404(Chatbot, id=chatbot_id, user=user)

    def get(self, request, chatbot_id):
        chatbot = self.get_object(chatbot_id, request.user)
        serializer = ChatbotSerializer(chatbot)
        return Response(
            {
                'status': 'success',
                'chatbot': serializer.data,
            },
            status=status.HTTP_200_OK
        )

    def put(self, request, chatbot_id):
        chatbot = self.get_object(chatbot_id, request.user)
        serializer = ChatbotSerializer(chatbot, data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación al actualizar el chatbot.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        updated = serializer.save()
        return Response(
            {
                'status': 'success',
                'message': 'Chatbot actualizado exitosamente.',
                'chatbot': ChatbotSerializer(updated).data,
            },
            status=status.HTTP_200_OK
        )

    def patch(self, request, chatbot_id):
        chatbot = self.get_object(chatbot_id, request.user)
        serializer = ChatbotSerializer(chatbot, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación al actualizar parcialmente el chatbot.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        updated = serializer.save()
        return Response(
            {
                'status': 'success',
                'message': 'Chatbot actualizado exitosamente.',
                'chatbot': ChatbotSerializer(updated).data,
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, chatbot_id):
        chatbot = self.get_object(chatbot_id, request.user)
        chatbot_name = chatbot.name
        chatbot.delete()
        return Response(
            {
                'status': 'success',
                'message': f"Chatbot '{chatbot_name}' eliminado exitosamente.",
            },
            status=status.HTTP_200_OK
        )
