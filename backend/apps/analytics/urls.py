from django.urls import path
from .views import KPIAnalyticsView, FeedbackView

urlpatterns = [
    path('kpis/', KPIAnalyticsView.as_view(), name='analytics-kpis'),
    path('feedback/', FeedbackView.as_view(), name='analytics-feedback'),
]
