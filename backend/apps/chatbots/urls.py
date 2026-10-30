from django.urls import path
from .views import ChatbotListCreateView, ChatbotDetailView
from apps.etl.views import DocumentListUploadView, DocumentDetailView
from apps.rag.views import ChatbotRAGView

urlpatterns = [
    # Chatbot CRUD
    path('', ChatbotListCreateView.as_view(), name='chatbot-list-create'),
    path('<uuid:chatbot_id>/', ChatbotDetailView.as_view(), name='chatbot-detail'),

    # ETL & Document Management
    path('<uuid:chatbot_id>/documents/', DocumentListUploadView.as_view(), name='chatbot-documents-list-upload'),
    path('<uuid:chatbot_id>/documents/<uuid:document_id>/', DocumentDetailView.as_view(), name='chatbot-documents-detail'),

    # RAG Chat Engine
    path('<uuid:chatbot_id>/chat/', ChatbotRAGView.as_view(), name='chatbot-chat-rag'),
]
