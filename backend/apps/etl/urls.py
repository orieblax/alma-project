from django.urls import path
from .views import DocumentListUploadView, DocumentDetailView

urlpatterns = [
    path('<uuid:chatbot_id>/documents/', DocumentListUploadView.as_view(), name='chatbot-documents-list-upload'),
    path('<uuid:chatbot_id>/documents/<uuid:document_id>/', DocumentDetailView.as_view(), name='chatbot-documents-detail'),
]
