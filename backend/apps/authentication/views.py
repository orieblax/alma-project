import re
import uuid
from django.contrib.auth.models import User
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    GitHubAuthSerializer,
    UserSerializer,
)
from .models import UserProfile
from .authentication import generate_tokens_for_user, decode_token

class RegisterView(APIView):
    """Register a new user with email, name and password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Error de validación en el registro.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.save()
        tokens = generate_tokens_for_user(user)

        return Response(
            {
                'status': 'success',
                'message': 'Usuario registrado exitosamente.',
                'tokens': tokens,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED
        )

class LoginView(APIView):
    """Authenticate a user using email and password, returning JWT tokens."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'No se pudo iniciar sesión.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.validated_data['user']
        tokens = generate_tokens_for_user(user)

        return Response(
            {
                'status': 'success',
                'message': 'Inicio de sesión exitoso.',
                'tokens': tokens,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_200_OK
        )

class GitHubAuthView(APIView):
    """Authenticate or bind a user using GitHub OAuth / token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = GitHubAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'status': 'error',
                    'message': 'Datos de GitHub inválidos.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        github_id = data.get('github_id') or f"gh_{uuid.uuid4().hex[:12]}"
        email = data.get('email') or f"github_{github_id}@alma-project.local"
        name = data.get('name') or f"GitHub User {github_id}"
        avatar_url = data.get('avatar_url') or ''

        # Check if user with this github_id exists
        user_profile = UserProfile.objects.filter(github_id=github_id).first()
        if user_profile:
            user = user_profile.user
        else:
            # Check if user with this email exists
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                base_username = re.sub(r'[^a-zA-Z0-9_]', '', name.lower().replace(' ', '_')) or 'gh_user'
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                first_name = name.split(' ')[0] if name else 'GitHub'
                last_name = name.split(' ', 1)[1] if ' ' in name else 'User'

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.set_unusable_password()
                user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.github_id = github_id
            if avatar_url:
                profile.avatar_url = avatar_url
            profile.save()

        tokens = generate_tokens_for_user(user)

        return Response(
            {
                'status': 'success',
                'message': 'Autenticación con GitHub exitosa.',
                'tokens': tokens,
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_200_OK
        )

class UserProfileView(APIView):
    """Retrieve current authenticated user's profile details."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Ensure profile exists
        UserProfile.objects.get_or_create(user=request.user)
        return Response(
            {
                'status': 'success',
                'user': UserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK
        )

class RefreshTokenView(APIView):
    """Refreshes an access token given a valid refresh token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'status': 'error', 'message': 'Se requiere el parámetro refresh token.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payload = decode_token(refresh_token, expected_type='refresh')
        user_id = payload.get('user_id')

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'status': 'error', 'message': 'Usuario no encontrado o inactivo.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        tokens = generate_tokens_for_user(user)
        return Response(
            {
                'status': 'success',
                'tokens': tokens,
            },
            status=status.HTTP_200_OK
        )
