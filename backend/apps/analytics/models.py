import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.chatbots.models import Chatbot

class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chatbot = models.ForeignKey(Chatbot, on_delete=models.CASCADE, related_name='sessions')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='chat_sessions')
    session_key = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Sesión de Chat'
        verbose_name_plural = 'Sesiones de Chat'
        ordering = ['-created_at']

    def __str__(self):
        return f"Session {self.id} [{self.chatbot.name}]"

class ChatMessage(models.Model):
    SENDER_USER = 'user'
    SENDER_BOT = 'bot'

    SENDER_CHOICES = [
        (SENDER_USER, 'Usuario'),
        (SENDER_BOT, 'Bot'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    text = models.TextField()
    response_time_ms = models.FloatField(default=0.0)
    tokens_used = models.PositiveIntegerField(default=0)
    feedback_rating = models.IntegerField(null=True, blank=True, help_text="Calificación 1 a 5 estrellas")
    feedback_comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensaje de Chat'
        verbose_name_plural = 'Mensajes de Chat'
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.sender}] {self.text[:40]}"
