from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from io import BytesIO

from app.api.deps import CurrentUser, DbSession
from app.services import pdf_report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "/progress/pdf",
    summary="Download personal progress PDF report",
    response_class=StreamingResponse,
)
def download_progress_pdf(
    current_user: CurrentUser,
    db: DbSession,
    start_date: str = Query(..., description="Inclusive start date YYYY-MM-DD"),
    end_date: str = Query(..., description="Inclusive end date YYYY-MM-DD"),
) -> StreamingResponse:
    pdf_bytes = pdf_report_service.build_progress_pdf(
        db,
        current_user,
        start_date=start_date,
        end_date=end_date,
    )
    filename = pdf_report_service.progress_pdf_filename(start_date, end_date)
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )
