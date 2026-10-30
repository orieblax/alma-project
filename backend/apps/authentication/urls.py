from django.urls import path
from .views import RegisterView, LoginView, GitHubAuthView, UserProfileView, RefreshTokenView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('github/', GitHubAuthView.as_view(), name='auth-github'),
    path('me/', UserProfileView.as_view(), name='auth-me'),
    path('refresh/', RefreshTokenView.as_view(), name='auth-refresh'),
]
