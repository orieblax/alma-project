from django.urls import path
from .views import ChatbotRAGView

urlpatterns = [
    path('<uuid:chatbot_id>/chat/', ChatbotRAGView.as_view(), name='chatbot-chat-rag'),
]
