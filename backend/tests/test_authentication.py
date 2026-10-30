from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import UserProfile
from apps.authentication.authentication import generate_tokens_for_user

class AuthenticationAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        self.github_url = '/api/auth/github/'
        self.me_url = '/api/auth/me/'
        self.refresh_url = '/api/auth/refresh/'

        self.user_data = {
            'email': 'developer@almaproject.com',
            'name': 'Alma Developer',
            'password': 'SecurePassword123!',
        }

    def test_user_registration_success(self):
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertEqual(response.data['user']['email'], self.user_data['email'])
        self.assertTrue(User.objects.filter(email=self.user_data['email']).exists())
        self.assertTrue(UserProfile.objects.filter(user__email=self.user_data['email']).exists())

    def test_duplicate_registration_fails(self):
        self.client.post(self.register_url, self.user_data, format='json')
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.data)

    def test_registration_validation_short_password(self):
        bad_data = {
            'email': 'test2@almaproject.com',
            'name': 'Test User',
            'password': '123',
        }
        response = self.client.post(self.register_url, bad_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        self.client.post(self.register_url, self.user_data, format='json')
        login_data = {
            'email': self.user_data['email'],
            'password': self.user_data['password'],
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

    def test_user_login_invalid_password(self):
        self.client.post(self.register_url, self.user_data, format='json')
        login_data = {
            'email': self.user_data['email'],
            'password': 'WrongPassword!',
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_endpoint_with_jwt_token(self):
        reg_resp = self.client.post(self.register_url, self.user_data, format='json')
        token = reg_resp.data['tokens']['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], self.user_data['email'])

    def test_me_endpoint_unauthorized_without_token(self):
        self.client.credentials()  # Clear credentials
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_github_auth_new_user(self):
        gh_data = {
            'github_id': 'gh_99887766',
            'email': 'githubber@almaproject.com',
            'name': 'Octocat Developer',
            'avatar_url': 'https://avatars.githubusercontent.com/u/99887766',
        }
        response = self.client.post(self.github_url, gh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertTrue(UserProfile.objects.filter(github_id='gh_99887766').exists())

    def test_token_refresh(self):
        reg_resp = self.client.post(self.register_url, self.user_data, format='json')
        refresh_token = reg_resp.data['tokens']['refresh']

        response = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
