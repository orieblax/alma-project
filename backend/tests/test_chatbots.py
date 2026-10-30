import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from apps.chatbots.models import Chatbot
from apps.authentication.authentication import generate_tokens_for_user

class ChatbotsAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='Password123!'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='Password123!'
        )

        tokens1 = generate_tokens_for_user(self.user1)
        self.token1 = tokens1['access']

        tokens2 = generate_tokens_for_user(self.user2)
        self.token2 = tokens2['access']

        self.list_url = '/api/chatbots/'

    def test_create_chatbot(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1}')
        payload = {
            'name': 'Customer Support Assistant',
            'description': 'Handles inquiries about orders and returns.',
            'system_prompt': 'You are a polite customer support agent.',
            'is_active': True,
        }
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['chatbot']['name'], payload['name'])
        self.assertEqual(response.data['chatbot']['user_email'], self.user1.email)

    def test_list_chatbots_isolated_by_user(self):
        # Create bot for user1
        Chatbot.objects.create(user=self.user1, name='Bot 1')
        # Create bot for user2
        Chatbot.objects.create(user=self.user2, name='Bot 2')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1}')
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Bot 1')

    def test_chatbot_detail_and_update(self):
        bot = Chatbot.objects.create(user=self.user1, name='Original Name')
        detail_url = f'/api/chatbots/{bot.id}/'

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1}')
        # GET
        get_resp = self.client.get(detail_url)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['chatbot']['name'], 'Original Name')

        # PATCH
        patch_resp = self.client.patch(detail_url, {'name': 'Updated Name'}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['chatbot']['name'], 'Updated Name')

    def test_chatbot_cannot_be_accessed_by_other_user(self):
        bot = Chatbot.objects.create(user=self.user1, name='Private Bot')
        detail_url = f'/api/chatbots/{bot.id}/'

        # user2 tries to access user1's bot
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token2}')
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_chatbot(self):
        bot = Chatbot.objects.create(user=self.user1, name='To Delete')
        detail_url = f'/api/chatbots/{bot.id}/'

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1}')
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Chatbot.objects.filter(id=bot.id).exists())
