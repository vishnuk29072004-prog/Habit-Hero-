"""Generate Habit Hero personal progress PDF reports (ReportLab, in-memory)."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any, List, Optional, Sequence

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import (
    achievement_service,
    analytics_service,
    calendar_service,
    goal_service,
    habit_service,
    user_service,
)
from app.utils.date_keys import parse_date_key, today_key

# Habit Hero brand-ish palette (print-safe)
BLUE = colors.Color(0.15, 0.39, 0.75)
BLUE_LIGHT = colors.Color(0.90, 0.94, 0.99)
INK = colors.Color(0.12, 0.14, 0.18)
MUTED = colors.Color(0.35, 0.40, 0.48)
LINE = colors.Color(0.82, 0.86, 0.91)
WHITE = colors.white


def validate_report_range(start_date: str, end_date: str) -> tuple[str, str]:
    try:
        start = parse_date_key(start_date).isoformat()
        end = parse_date_key(end_date).isoformat()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date and end_date must be YYYY-MM-DD",
        ) from exc
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must not precede start_date",
        )
    return start, end


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=BLUE,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=4,
            leading=15,
        ),
        "h1": ParagraphStyle(
            "section_h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=13,
            textColor=BLUE,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            textColor=INK,
            leading=13,
            spaceAfter=4,
        ),
        "muted": ParagraphStyle(
            "muted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=MUTED,
            leading=12,
            spaceAfter=3,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=INK,
            leading=10,
        ),
        "cell_h": ParagraphStyle(
            "cell_h",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=WHITE,
            leading=10,
        ),
    }


def _header_footer(canvas, doc) -> None:  # noqa: ANN001
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, height - 12 * mm, width - 18 * mm, height - 12 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, height - 10 * mm, "Habit Hero · Personal Progress Report")
    canvas.line(18 * mm, 12 * mm, width - 18 * mm, 12 * mm)
    canvas.drawRightString(width - 18 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _section_title(styles: dict, text: str):
    return KeepTogether(
        [
            Paragraph(text, styles["h1"]),
            HRFlowable(
                width="100%", thickness=0.8, color=BLUE, spaceBefore=0, spaceAfter=8
            ),
        ]
    )


def _kv_table(rows: Sequence[tuple[str, str]], styles: dict) -> Table:
    data = [
        [Paragraph(k, styles["muted"]), Paragraph(str(v), styles["body"])]
        for k, v in rows
    ]
    table = Table(data, colWidths=[55 * mm, 115 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return table


def _progress_bar(pct: float, width: float = 120) -> Table:
    pct = max(0.0, min(100.0, float(pct or 0)))
    fill = max(1, int(width * pct / 100.0)) if pct > 0 else 0
    empty = width - fill
    data = [["", ""]] if fill and empty else ([[""]] if fill else [["", ""]])
    if fill and empty:
        data = [["", ""]]
        t = Table(data, colWidths=[fill, empty], rowHeights=[8])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), BLUE),
                    ("BACKGROUND", (1, 0), (1, 0), BLUE_LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                ]
            )
        )
        return t
    if fill:
        t = Table([[""]], colWidths=[width], rowHeights=[8])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), BLUE),
                    ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                ]
            )
        )
        return t
    t = Table([[""]], colWidths=[width], rowHeights=[8])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BLUE_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.4, LINE),
            ]
        )
    )
    return t


def _data_table(headers: Sequence[str], rows: Sequence[Sequence[Any]], styles: dict) -> Table:
    head = [Paragraph(h, styles["cell_h"]) for h in headers]
    body = []
    for row in rows:
        body.append([Paragraph(str(c), styles["cell"]) for c in row])
    table = Table([head, *body], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BLUE_LIGHT]),
    ]
    table.setStyle(TableStyle(style_cmds))
    return table


def _gather_report_data(
    db: Session, user: User, start: str, end: str
) -> dict[str, Any]:
    profile = user_service.get_profile(user)
    period = calendar_service.get_date_range_summary(
        db, user, start_date=start, end_date=end
    )
    overview = analytics_service.get_overview(db, user)
    streaks = analytics_service.get_streak_analytics(db, user)
    categories = analytics_service.get_category_analytics(
        db, user, start_date=start, end_date=end
    )

    habits_page = habit_service.list_habits(
        db, user, status_filter="active", page=1, page_size=100
    )
    habit_rows = []
    for item in habits_page.items:
        ha = analytics_service.get_habit_analytics(
            db, user, item.id, start_date=start, end_date=end
        )
        habit_rows.append(
            {
                "name": ha.habit.name,
                "category": ha.habit.category,
                "frequency": ha.habit.frequency,
                "completed": ha.total_completed,
                "missed": ha.total_missed,
                "pending": ha.total_pending,
                "rate": ha.completion_percentage,
            }
        )

    goals_page = goal_service.list_goals(
        db, user, archived=False, page=1, page_size=100
    )
    achievements = achievement_service.list_earned(db, user)

    return {
        "profile": profile,
        "period": period,
        "overview": overview,
        "streaks": streaks,
        "categories": categories,
        "habits": habit_rows,
        "goals": goals_page.items,
        "achievements": achievements,
        "active_habit_count": overview.active_habits
        if hasattr(overview, "active_habits")
        else len(habit_rows),
    }


def _build_story(
    data: dict[str, Any],
    *,
    start: str,
    end: str,
    generated_at: str,
) -> list:
    styles = _styles()
    story: list = []
    profile = data["profile"]
    period = data["period"]
    streaks = data["streaks"]
    overview = data["overview"]
    name = profile.full_name or "Habit Hero User"

    # --- Cover ---
    story.append(Spacer(1, 28 * mm))
    story.append(Paragraph("HABIT HERO", styles["cover_brand"]))
    story.append(Paragraph("PERSONAL PROGRESS REPORT", styles["cover_title"]))
    story.append(
        Paragraph(
            "Small consistent steps compound into lasting growth.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(f"<b>{name}</b>", styles["cover_sub"]))
    story.append(
        Paragraph(f"Reporting period: {start} → {end}", styles["cover_sub"])
    )
    story.append(Paragraph(f"Generated: {generated_at}", styles["cover_sub"]))
    story.append(Spacer(1, 16 * mm))
    story.append(
        HRFlowable(width="60%", thickness=1.2, color=BLUE, spaceBefore=4, spaceAfter=4)
    )

    # --- User info ---
    story.append(_section_title(styles, "1. User Information"))
    story.append(
        _kv_table(
            [
                ("Name", name),
                ("Email", profile.email or "—"),
                ("Report period", f"{start} to {end}"),
                ("Generated", generated_at),
            ],
            styles,
        )
    )

    # --- Overall summary ---
    story.append(_section_title(styles, "2. Overall Habit Summary"))
    active_count = getattr(overview, "active_habits", None)
    if active_count is None:
        active_count = data["active_habit_count"]
    story.append(
        _kv_table(
            [
                ("Active habits", str(active_count)),
                ("Scheduled occurrences", str(period.total_scheduled)),
                ("Completed", str(period.completed)),
                ("Missed", str(period.missed)),
                ("Pending", str(period.pending)),
                ("Completion rate", f"{period.completion_percentage}%"),
                ("Current streak", f"{streaks.current_streak} day(s)"),
                ("Longest streak", f"{streaks.longest_streak} day(s)"),
            ],
            styles,
        )
    )
    story.append(Spacer(1, 4))
    story.append(Paragraph("Period completion", styles["muted"]))
    story.append(_progress_bar(period.completion_percentage))

    # --- Individual habits ---
    story.append(_section_title(styles, "3. Individual Habit Performance"))
    habits = data["habits"]
    if not habits:
        story.append(
            Paragraph(
                "No active habits in this account for the selected period.",
                styles["muted"],
            )
        )
    else:
        rows = [
            [
                h["name"],
                h["category"],
                h["frequency"],
                h["completed"],
                h["missed"],
                f"{h['rate']}%",
            ]
            for h in habits
        ]
        story.append(
            _data_table(
                ["Habit", "Category", "Frequency", "Completed", "Missed", "Success Rate"],
                rows,
                styles,
            )
        )

    # --- Streaks ---
    story.append(_section_title(styles, "4. Streak Analysis"))
    best = streaks.best_performing_habit
    best_name = best.name if best else "—"
    needing = [
        p.name
        for p in (streaks.per_habit or [])
        if p.current_streak == 0 and p.longest_streak >= 0
    ][:5]
    low_rate = sorted(habits, key=lambda h: h["rate"])[:3]
    consistency_names = [h["name"] for h in low_rate if h["rate"] < 70]
    if not consistency_names and needing:
        consistency_names = needing
    story.append(
        _kv_table(
            [
                ("Current streak", f"{streaks.current_streak} day(s)"),
                ("Longest streak", f"{streaks.longest_streak} day(s)"),
                ("Best-performing habit", best_name),
                (
                    "Needs more consistency",
                    ", ".join(consistency_names) if consistency_names else "None flagged",
                ),
            ],
            styles,
        )
    )

    # --- Calendar / period distribution ---
    story.append(_section_title(styles, "5. Calendar Progress"))
    trend = list(period.daily_trend or [])
    completed_days = sum(
        1 for d in trend if d.scheduled > 0 and d.completed == d.scheduled and d.missed == 0
    )
    missed_days = sum(1 for d in trend if d.scheduled > 0 and d.missed > 0)
    pending_days = sum(1 for d in trend if d.scheduled > 0 and d.pending > 0)
    story.append(
        _kv_table(
            [
                ("Active days (with schedule)", str(period.active_days)),
                ("Fully completed days", str(completed_days)),
                ("Days with misses", str(missed_days)),
                ("Days with pending", str(pending_days)),
                ("Best weekday (period)", period.best_performing_day or "—"),
                ("Period completion", f"{period.completion_percentage}%"),
            ],
            styles,
        )
    )
    # Compact weekly-ish sample of daily trend (cap rows)
    sample = [d for d in trend if d.scheduled > 0][:21]
    if sample:
        story.append(Spacer(1, 4))
        story.append(Paragraph("Daily distribution (scheduled days, up to 21)", styles["muted"]))
        cal_rows = [
            [
                d.date,
                d.scheduled,
                d.completed,
                d.missed,
                d.pending,
                f"{d.completion_percentage}%",
            ]
            for d in sample
        ]
        story.append(
            _data_table(
                ["Date", "Scheduled", "Done", "Missed", "Pending", "Rate"],
                cal_rows,
                styles,
            )
        )
    else:
        story.append(
            Paragraph(
                "No scheduled habit occurrences in this reporting period.",
                styles["muted"],
            )
        )

    # --- Categories ---
    story.append(_section_title(styles, "6. Category-wise Performance"))
    cats = list(data["categories"].categories or [])
    if not cats:
        story.append(
            Paragraph("No category performance data for this period.", styles["muted"])
        )
    else:
        cat_rows = [
            [
                c.category,
                c.habit_count,
                c.completed,
                f"{c.completion_percentage}%",
            ]
            for c in cats
        ]
        story.append(
            _data_table(
                ["Category", "Habits", "Completed", "Completion %"],
                cat_rows,
                styles,
            )
        )
        story.append(Spacer(1, 6))
        for c in cats:
            story.append(
                Paragraph(
                    f"{c.category}: {c.completion_percentage}%",
                    styles["muted"],
                )
            )
            story.append(_progress_bar(c.completion_percentage, width=160))
            story.append(Spacer(1, 3))

    # --- Goals ---
    story.append(_section_title(styles, "7. Goal Progress"))
    goals = data["goals"]
    if not goals:
        story.append(Paragraph("No active goals to include.", styles["muted"]))
    else:
        for g in goals:
            progress = g.progress
            desc = (g.description or "").strip() or "—"
            story.append(Paragraph(f"<b>{g.name}</b>", styles["body"]))
            story.append(
                _kv_table(
                    [
                        ("Description", desc[:240]),
                        ("Target", f"{progress.target} {progress.unit}".strip()),
                        ("Current", f"{progress.current} ({progress.label})"),
                        ("Completion", f"{progress.rate}%"),
                        ("Status", g.status),
                        ("Deadline", g.end_date or "—"),
                    ],
                    styles,
                )
            )
            story.append(_progress_bar(progress.rate))
            story.append(Spacer(1, 6))

    # --- Achievements ---
    story.append(_section_title(styles, "8. Achievements"))
    achievements = data["achievements"]
    if not achievements:
        story.append(Paragraph("No achievements earned yet.", styles["muted"]))
    else:
        ach_rows = [
            [
                a.title,
                (a.body or "")[:80],
                (a.unlocked_at or "")[:10] or "—",
            ]
            for a in achievements
        ]
        story.append(
            _data_table(
                ["Achievement", "Description", "Awarded"],
                ach_rows,
                styles,
            )
        )

    # Section 9 AI Insights — omitted (ephemeral; no Gemini during PDF)

    # --- Final summary ---
    story.append(_section_title(styles, "9. Final Summary"))
    strongest = "—"
    if cats:
        top = max(cats, key=lambda c: (c.completion_percentage, c.completed))
        strongest = f"{top.category} ({top.completion_percentage}%)"
    improve = "—"
    if cats:
        weak = min(cats, key=lambda c: (c.completion_percentage, -c.scheduled))
        if weak.completion_percentage < 80:
            improve = f"{weak.category} ({weak.completion_percentage}%)"
    elif consistency_names:
        improve = ", ".join(consistency_names[:3])

    rate = period.completion_percentage
    if rate >= 80:
        close = "Outstanding consistency — keep protecting the routines that already work."
    elif rate >= 50:
        close = "Solid progress. Tighten one weak spot this week and your streak will follow."
    elif period.total_scheduled == 0:
        close = "Start with one small daily habit — momentum begins with a single check-in."
    else:
        close = "Every restart counts. Pick one habit, show up tomorrow, and rebuild from there."

    story.append(
        Paragraph(
            f"Across {start} to {end}, you completed {period.completed} of "
            f"{period.total_scheduled} scheduled occurrences ({rate}%).",
            styles["body"],
        )
    )
    story.append(
        _kv_table(
            [
                ("Strongest area", strongest),
                ("Focus area", improve),
                ("Closing note", close),
            ],
            styles,
        )
    )

    return story


def build_progress_pdf(
    db: Session,
    user: User,
    *,
    start_date: str,
    end_date: str,
) -> bytes:
    """
    Build an in-memory PDF progress report for the authenticated user.

    Does not persist files. Does not call Gemini.
    """
    start, end = validate_report_range(start_date, end_date)
    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )
    try:
        data = _gather_report_data(db, user, start, end)
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title="Habit Hero Personal Progress Report",
            author="Habit Hero",
        )
        story = _build_story(
            data, start=start, end=end, generated_at=generated_at
        )
        doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
        return buffer.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate the progress report. Please try again.",
        ) from exc


def progress_pdf_filename(start_date: str, end_date: str) -> str:
    start, end = validate_report_range(start_date, end_date)
    return f"HabitHero_Progress_Report_{start}_to_{end}.pdf"
