from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

from app.api.deps import CurrentUser, DbSession
from app.services import google_calendar_service

router = APIRouter(prefix="/calendar/google", tags=["google-calendar"])


@router.get("/status", summary="Google Calendar connection status")
def google_status(current_user: CurrentUser, db: DbSession):
    data = google_calendar_service.connection_status(db, current_user)
    return {"success": True, "message": "OK", "data": data}


@router.get("/connect", summary="Start Google Calendar OAuth")
def google_connect(current_user: CurrentUser):
    data = google_calendar_service.build_connect_url(current_user)
    return {
        "success": True,
        "message": "Open authorization_url to connect Google Calendar",
        "data": {"authorization_url": data["authorization_url"]},
    }


@router.get("/callback", summary="Google OAuth callback", include_in_schema=True)
def google_callback(
    db: DbSession,
    code: str = Query(...),
    state: str = Query(...),
):
    result = google_calendar_service.exchange_code(db, code=code, state=state)
    return RedirectResponse(url=result["frontend_redirect"], status_code=302)


@router.post("/disconnect", summary="Disconnect Google Calendar")
def google_disconnect(current_user: CurrentUser, db: DbSession):
    data = google_calendar_service.disconnect(db, current_user)
    return {"success": True, "message": data["message"], "data": data}


@router.post("/sync", summary="Synchronize habits to Google Calendar")
def google_sync(current_user: CurrentUser, db: DbSession):
    data = google_calendar_service.sync_habits(db, current_user)
    return {
        "success": True,
        "message": "Google Calendar sync completed",
        "data": data,
    }


@router.get("/events", summary="List mapped Google Calendar events")
def google_events(current_user: CurrentUser, db: DbSession):
    items = google_calendar_service.list_mapped_events(db, current_user)
    return {
        "success": True,
        "message": "OK",
        "data": {"items": items, "total": len(items)},
    }


@router.delete("/events/{event_id}", summary="Delete a mapped Google event")
def google_delete_event(event_id: str, current_user: CurrentUser, db: DbSession):
    data = google_calendar_service.delete_mapped_event(db, current_user, event_id)
    return {"success": True, "message": "Event deleted", "data": data}
