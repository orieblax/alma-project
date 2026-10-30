import uuid
from django.db import models
from django.contrib.auth.models import User

class Chatbot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chatbots')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    system_prompt = models.TextField(
        blank=True,
        default='Eres un asistente inteligente cordial, preciso y profesional. Responde utilizando el contexto suministrado.'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Chatbot'
        verbose_name_plural = 'Chatbots'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.id})"
