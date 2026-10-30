import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import authentication, exceptions

def generate_tokens_for_user(user: User):
    """Generates access and refresh JWT tokens for a given User."""
    now = datetime.now(timezone.utc)
    
    access_exp = now + timedelta(minutes=settings.JWT_ACCESS_EXPIRATION_MINUTES)
    refresh_exp = now + timedelta(days=settings.JWT_REFRESH_EXPIRATION_DAYS)

    access_payload = {
        'user_id': user.id,
        'email': user.email,
        'username': user.username,
        'token_type': 'access',
        'iat': int(now.timestamp()),
        'exp': int(access_exp.timestamp()),
    }

    refresh_payload = {
        'user_id': user.id,
        'token_type': 'refresh',
        'iat': int(now.timestamp()),
        'exp': int(refresh_exp.timestamp()),
    }

    access_token = jwt.encode(access_payload, settings.JWT_SECRET, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, settings.JWT_SECRET, algorithm='HS256')

    return {
        'access': access_token,
        'refresh': refresh_token,
        'expires_in': settings.JWT_ACCESS_EXPIRATION_MINUTES * 60,
    }

def decode_token(token: str, expected_type: str = 'access'):
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
        if payload.get('token_type') != expected_type:
            raise exceptions.AuthenticationFailed('Tipo de token inválido.')
        return payload
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed('El token ha expirado.')
    except jwt.InvalidTokenError:
        raise exceptions.AuthenticationFailed('Token de autenticación inválido.')

class JWTAuthentication(authentication.BaseAuthentication):
    """Custom DRF Authentication class for Bearer JWT tokens."""

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        raw_token = parts[1]
        payload = decode_token(raw_token, expected_type='access')

        user_id = payload.get('user_id')
        if not user_id:
            raise exceptions.AuthenticationFailed('Token sin identificador de usuario.')

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('Usuario no encontrado o inactivo.')

        return (user, raw_token)

    def authenticate_header(self, request):
        return 'Bearer'

