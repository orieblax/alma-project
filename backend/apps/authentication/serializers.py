import re
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'avatar_url', 'github_id', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'profile']

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.username

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    name = serializers.CharField(required=True, min_length=2, max_length=150)

    def validate_email(self, value):
        email_clean = value.lower().strip()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("Este correo electrónico ya se encuentra registrado.")
        return email_clean

    def validate_name(self, value):
        name_clean = value.strip()
        if len(name_clean) < 2:
            raise serializers.ValidationError("El nombre debe tener al menos 2 caracteres.")
        return name_clean

    def create(self, validated_data):
        email = validated_data['email']
        password = validated_data['password']
        name = validated_data['name']

        # Determine username from email or sanitized string
        username_base = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
        username = username_base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{username_base}{counter}"
            counter += 1

        first_name = name
        last_name = ''
        if ' ' in name:
            parts = name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1]

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        UserProfile.objects.create(user=user)
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password')

        try:
            user_obj = User.objects.get(email__iexact=email)
            username = user_obj.username
        except User.DoesNotExist:
            raise serializers.ValidationError("Credenciales incorrectas. Verifique su correo y contraseña.")

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Credenciales incorrectas. Verifique su correo y contraseña.")

        if not user.is_active:
            raise serializers.ValidationError("La cuenta se encuentra inactiva.")

        attrs['user'] = user
        return attrs

class GitHubAuthSerializer(serializers.Serializer):
    github_token = serializers.CharField(required=False, allow_blank=True)
    github_id = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)
    avatar_url = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('github_token') and not attrs.get('github_id'):
            raise serializers.ValidationError("Se requiere al menos 'github_token' o 'github_id'.")
        return attrs
