from fastapi import APIRouter

from app.api.v1.endpoints import (
    achievements,
    analytics,
    auth,
    calendar,
    checkins,
    goals,
    habits,
    health,
    journal,
    notifications,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(habits.router)
api_router.include_router(checkins.router)
api_router.include_router(calendar.router)
api_router.include_router(analytics.router)
api_router.include_router(goals.router)
api_router.include_router(achievements.router)
api_router.include_router(journal.router)
api_router.include_router(notifications.router)
