from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from apps.chatbots.models import Chatbot
from apps.analytics.models import ChatSession, ChatMessage
from apps.authentication.authentication import generate_tokens_for_user

class AnalyticsAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='analytics_user',
            email='analytics@almaproject.com',
            password='Password123!'
        )
        tokens = generate_tokens_for_user(self.user)
        self.token = tokens['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        self.chatbot = Chatbot.objects.create(
            user=self.user,
            name='Analytics Test Bot'
        )

        self.kpi_url = '/api/analytics/kpis/'
        self.feedback_url = '/api/analytics/feedback/'

    def test_kpi_analytics_endpoint(self):
        # Create a session with user and bot message
        session = ChatSession.objects.create(chatbot=self.chatbot, user=self.user)
        ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_USER,
            text='Cual es el horario de atencion?'
        )
        bot_msg = ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_BOT,
            text='Nuestro horario es de 9:00 a 18:00.',
            response_time_ms=125.5,
            tokens_used=180,
            feedback_rating=5
        )

        response = self.client.get(self.kpi_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        kpis = response.data['kpis']

        self.assertEqual(kpis['total_chatbots'], 1)
        self.assertEqual(kpis['total_queries'], 1)
        self.assertAlmostEqual(kpis['avg_response_time_ms'], 125.5, places=1)
        self.assertEqual(kpis['satisfaction_score'], 5.0)
        self.assertTrue(len(response.data['recent_activity']) > 0)

    def test_feedback_submission_success(self):
        session = ChatSession.objects.create(chatbot=self.chatbot)
        bot_msg = ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_BOT,
            text='Respuesta de prueba.'
        )

        feedback_data = {
            'message_id': str(bot_msg.id),
            'rating': 5,
            'comment': 'Excelente respuesta, muy rapida y precisa.'
        }

        response = self.client.post(self.feedback_url, feedback_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        bot_msg.refresh_from_db()
        self.assertEqual(bot_msg.feedback_rating, 5)
        self.assertEqual(bot_msg.feedback_comment, feedback_data['comment'])

    def test_feedback_invalid_rating_rejected(self):
        session = ChatSession.objects.create(chatbot=self.chatbot)
        bot_msg = ChatMessage.objects.create(
            session=session,
            sender=ChatMessage.SENDER_BOT,
            text='Respuesta de prueba.'
        )

        # Rating must be between 1 and 5
        bad_feedback = {
            'message_id': str(bot_msg.id),
            'rating': 10,
        }
        response = self.client.post(self.feedback_url, bad_feedback, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
