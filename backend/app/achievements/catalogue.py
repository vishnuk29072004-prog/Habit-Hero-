"""Achievement catalogue mirrored from frontend ACHIEVEMENT_DEFS (8 badges)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional


@dataclass(frozen=True)
class AchievementDef:
    id: str
    title: str
    body: str
    icon: str
    test: Callable[[dict[str, Any]], bool]


def _first_goal_completed(ctx: dict[str, Any]) -> bool:
    return ctx["summary"]["completed"] >= 1


def _streak_at_least(n: int) -> Callable[[dict[str, Any]], bool]:
    def _test(ctx: dict[str, Any]) -> bool:
        return ctx["streak_days"] >= n or ctx["longest_streak"] >= n

    return _test


def _five_goals(ctx: dict[str, Any]) -> bool:
    return ctx["summary"]["completed"] >= 5


def _completion_milestone_50(ctx: dict[str, Any]) -> bool:
    summary = ctx["summary"]
    return summary["completion_rate"] >= 50 and summary["total"] > 0


def _personal_best(ctx: dict[str, Any]) -> bool:
    streak = ctx["streak_days"]
    longest = ctx["longest_streak"]
    return streak > 0 and streak >= longest and longest >= 3


ACHIEVEMENT_DEFS: list[AchievementDef] = [
    AchievementDef(
        id="first_goal_completed",
        title="First Goal Completed",
        body="You finished your first habit goal!",
        icon="trophy",
        test=_first_goal_completed,
    ),
    AchievementDef(
        id="streak_7",
        title="7-Day Streak",
        body="You've stayed consistent for 7 days!",
        icon="flame",
        test=_streak_at_least(7),
    ),
    AchievementDef(
        id="streak_12",
        title="12-Day Streak",
        body="You've stayed consistent for 12 days!",
        icon="flame",
        test=_streak_at_least(12),
    ),
    AchievementDef(
        id="streak_15",
        title="15-Day Streak",
        body="You've stayed consistent for 15 days!",
        icon="flame",
        test=_streak_at_least(15),
    ),
    AchievementDef(
        id="streak_30",
        title="30-Day Streak",
        body="You've stayed consistent for 30 days!",
        icon="flame",
        test=_streak_at_least(30),
    ),
    AchievementDef(
        id="five_goals_completed",
        title="Five Goals Completed",
        body="Five goals down — keep building!",
        icon="trophy",
        test=_five_goals,
    ),
    AchievementDef(
        id="completion_milestone_50",
        title="Goal Completion Milestone",
        body="You reached 50% overall goal completion.",
        icon="target",
        test=_completion_milestone_50,
    ),
    AchievementDef(
        id="personal_best_streak",
        title="Personal Best Streak",
        body="Your current streak matches your personal best!",
        icon="flame",
        test=_personal_best,
    ),
]


def get_achievement_def(achievement_id: str) -> Optional[AchievementDef]:
    for item in ACHIEVEMENT_DEFS:
        if item.id == achievement_id:
            return item
    return None
