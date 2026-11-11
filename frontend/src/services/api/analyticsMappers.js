/**
 * Map FastAPI analytics payloads → Dashboard / Analytics UI shapes.
 * Presentation-only transforms (labels, colors, chart keys).
 */

import { format, startOfWeek, addDays } from 'date-fns'
import { CATEGORY_COLORS } from '../../utils/habitCalculations'
import { getHeatmapBucket } from '../../utils/analyticsCalculations'
import { getMonthlyCalendarDays } from '../../utils/calendarCalculations'
import { isFutureDate, parseDateKey, toDateKey } from '../../utils/dateUtils'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function mapOverviewToStatCards(overview) {
  if (!overview) {
    return [
      {
        id: 'completion',
        label: "Today's Completion",
        value: '0%',
        icon: 'check',
        accent: 'blue',
      },
      {
        id: 'streak',
        label: 'Current Streak',
        value: '0 Days',
        icon: 'flame',
        accent: 'red',
      },
      {
        id: 'habits',
        label: 'Habits Completed',
        value: '0 / 0',
        icon: 'target',
        accent: 'blue',
      },
      {
        id: 'consistency',
        label: 'Overall Completion',
        value: '0%',
        icon: 'chart',
        accent: 'blue',
      },
    ]
  }

  return [
    {
      id: 'completion',
      label: "Today's Completion",
      value: `${overview.today_completion_percentage ?? 0}%`,
      icon: 'check',
      accent: 'blue',
    },
    {
      id: 'streak',
      label: 'Current Streak',
      value: `${overview.current_streak ?? 0} Days`,
      icon: 'flame',
      accent: 'red',
    },
    {
      id: 'habits',
      label: 'Habits Completed',
      value: `${overview.today_completed ?? 0} / ${overview.today_scheduled ?? 0}`,
      icon: 'target',
      accent: 'blue',
    },
    {
      id: 'consistency',
      label: 'Overall Completion',
      value: `${overview.overall_completion_percentage ?? 0}%`,
      icon: 'chart',
      accent: 'blue',
    },
  ]
}

/** Weekly API days → bar chart [{ day, value, dateKey, ... }] Mon→Sun */
export function mapWeeklyToChart(weekly) {
  const days = Array.isArray(weekly?.days) ? weekly.days : []
  if (!days.length) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      value: 0,
      dateKey: '',
      isFuture: false,
      scheduled: 0,
      completed: 0,
    }))
  }

  // Backend days are chronological for the week; map to Mon-first labels.
  const byKey = Object.fromEntries(days.map((d) => [d.date, d]))
  const weekStart = weekly.week_start
    ? parseDateKey(weekly.week_start)
    : startOfWeek(parseDateKey(days[0].date), { weekStartsOn: 1 })

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => {
    const date = addDays(weekStart, index)
    const key = toDateKey(date)
    const point = byKey[key]
    return {
      day: label,
      value: point?.is_future ? 0 : point?.completion_percentage ?? 0,
      dateKey: key,
      isFuture: Boolean(point?.is_future),
      scheduled: point?.scheduled ?? 0,
      completed: point?.completed ?? 0,
    }
  })
}

export function mapCategoriesToPie(categoryData) {
  const items = Array.isArray(categoryData?.categories)
    ? categoryData.categories
    : []
  return items.map((item) => ({
    name: item.category,
    color: CATEGORY_COLORS[item.category] || '#1463F3',
    total: item.habit_count ?? 0,
    completed: item.completed ?? 0,
    scheduled: item.scheduled ?? 0,
    value: item.completion_percentage ?? 0,
    rate: item.completion_percentage ?? 0,
  }))
}

export function mapCategoriesForAnalytics(categoryData) {
  return mapCategoriesToPie(categoryData)
}

export function mapMonthlyOverviewStats(monthly, streaks) {
  const days = Array.isArray(monthly?.daily_trend) ? monthly.daily_trend : []
  const todayKey = toDateKey(new Date())
  let daysCompleted = 0
  for (const day of days) {
    if (!day?.date || day.date > todayKey || day.is_future) continue
    if ((day.scheduled || 0) > 0 && (day.completion_percentage || 0) >= 80) {
      daysCompleted += 1
    }
  }
  return {
    daysCompleted,
    monthlyRate: monthly?.completion_percentage ?? 0,
    longestStreak: streaks?.longest_streak ?? 0,
  }
}

/** Calendar summary / daily_trend → ProgressTrend / CompletionTrend points */
export function mapTrendPoints(dailyTrend, labelMode = 'short') {
  const points = Array.isArray(dailyTrend) ? dailyTrend : []
  return points.map((point) => {
    const date = parseDateKey(point.date)
    let label
    if (labelMode === 'weekday') label = format(date, 'EEE')
    else if (labelMode === 'month') label = format(date, 'MMM')
    else label = format(date, 'MMM d')
    return {
      label,
      value: point.is_future ? 0 : point.completion_percentage ?? 0,
      dateKey: point.date,
      scheduled: point.scheduled ?? 0,
      completed: point.completed ?? 0,
      missed: point.missed ?? 0,
      pending: point.pending ?? 0,
    }
  })
}

export function mapWeeklyBucketsToChart(buckets) {
  const items = Array.isArray(buckets) ? buckets : []
  return items.map((week) => ({
    label: format(parseDateKey(week.week_start), 'MMM d'),
    value: week.completion_percentage ?? 0,
    weekStart: week.week_start,
    weekEnd: week.week_end,
    scheduled: week.scheduled ?? 0,
    completed: week.completed ?? 0,
  }))
}

export function mapHabitAnalyticsFromApi(data) {
  if (!data) {
    return {
      scheduled: 0,
      completed: 0,
      missed: 0,
      rate: 0,
      currentStreak: 0,
      longestStreak: 0,
      trend: [],
    }
  }
  const trend = (data.daily_trend || [])
    .filter((d) => (d.scheduled || 0) > 0 && !d.is_future)
    .map((d) => ({
      label: format(parseDateKey(d.date), 'MMM d'),
      value: (d.completed || 0) > 0 ? 100 : 0,
      dateKey: d.date,
    }))

  return {
    scheduled: data.total_scheduled ?? 0,
    completed: data.total_completed ?? 0,
    missed: data.total_missed ?? 0,
    rate: data.completion_percentage ?? 0,
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    trend,
  }
}

export function mapTopHabitsFromMonthly(monthly, limit = 4) {
  const list = Array.isArray(monthly?.habit_performance)
    ? monthly.habit_performance
    : []
  return list.slice(0, limit).map((h) => ({
    id: h.habit_id,
    name: h.name,
    icon: h.icon || 'sparkles',
    category: h.category,
    scheduled: h.scheduled ?? 0,
    completed: h.completed ?? 0,
    rate: h.completion_percentage ?? 0,
  }))
}

export function mapBestDays(bestDaysData) {
  const days = Array.isArray(bestDaysData?.days) ? bestDaysData.days : []
  return days.map((d) => ({
    weekday: d.weekday || WEEKDAY_SHORT[d.weekday_index] || '',
    weekdayIndex: d.weekday_index,
    scheduled: d.scheduled ?? 0,
    completed: d.completed ?? 0,
    rate: d.completion_percentage ?? 0,
    rank: d.rank,
  }))
}

export function mapHeatmapFromMonthlyDays(monthlyDays, viewMonth) {
  const byKey = {}
  for (const day of monthlyDays || []) {
    if (day?.date) byKey[day.date] = day
  }
  return getMonthlyCalendarDays(viewMonth).map((cell) => {
    const summary = byKey[cell.dateKey]
    const future = isFutureDate(cell.date)
    const scheduled = future ? 0 : summary?.total_habits ?? 0
    const rate = future ? 0 : summary?.completion_percentage ?? 0
    const completed = future ? 0 : summary?.completed ?? 0
    return {
      ...cell,
      rate,
      scheduled,
      completed,
      bucket: cell.inMonth
        ? future
          ? 'none'
          : getHeatmapBucket(rate, scheduled)
        : 'outside',
      isFuture: future,
    }
  })
}

/** Build insight cards from API aggregates (presentation only). */
export function mapInsightsFromApi({
  overview,
  categories,
  bestDays,
  streaks,
  comparisonDelta,
}) {
  const insights = []
  if (comparisonDelta != null && comparisonDelta !== 0) {
    insights.push({
      id: 'improve',
      group: 'performance',
      title:
        comparisonDelta > 0
          ? `+${comparisonDelta}% better than previous period`
          : `${comparisonDelta}% vs previous period`,
      body: 'Compared to the previous period of equal length.',
      tone: comparisonDelta > 0 ? 'green' : 'red',
    })
  }
  const best = (bestDays || []).find((d) => d.rank === 1) || bestDays?.[0]
  if (best && best.scheduled > 0) {
    insights.push({
      id: 'best-day',
      group: 'consistency',
      title: `${best.weekday} is your strongest day`,
      body: `${best.rate}% completion across scheduled habits.`,
      tone: 'blue',
    })
  }
  const cats = categories || []
  if (cats.length) {
    const ranked = [...cats].sort((a, b) => b.rate - a.rate)
    insights.push({
      id: 'best-cat',
      group: 'categories',
      title: `${ranked[0].name} leads categories`,
      body: `${ranked[0].rate}% completion in this range.`,
      tone: 'purple',
    })
  }
  if (streaks?.current_streak != null) {
    insights.push({
      id: 'streak',
      group: 'streaks',
      title: `${streaks.current_streak}-day current streak`,
      body: `Longest streak: ${streaks.longest_streak ?? 0} days.`,
      tone: 'orange',
    })
  }
  if (overview?.overall_completion_percentage != null) {
    insights.push({
      id: 'overall',
      group: 'performance',
      title: `${overview.overall_completion_percentage}% overall completion`,
      body: `${overview.total_completed_checkins ?? 0} completed check-ins across ${overview.active_habits ?? 0} active habits.`,
      tone: 'blue',
    })
  }
  return insights
}

export function mapPeriodStatsFromSummary(summary) {
  if (!summary) {
    return { scheduled: 0, completed: 0, rate: 0, missed: 0, pending: 0 }
  }
  return {
    scheduled: summary.total_scheduled ?? 0,
    completed: summary.completed ?? 0,
    missed: summary.missed ?? 0,
    pending: summary.pending ?? 0,
    rate: summary.completion_percentage ?? 0,
    days: summary.active_days ?? 0,
  }
}

/** Group daily trend into weekly averages for charts (presentation). */
export function groupDailyTrendByWeek(dailyTrend) {
  const points = Array.isArray(dailyTrend) ? dailyTrend : []
  const buckets = new Map()
  for (const point of points) {
    if (!point?.date || point.is_future) continue
    const date = parseDateKey(point.date)
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    const key = toDateKey(monday)
    if (!buckets.has(key)) {
      buckets.set(key, { scheduled: 0, completed: 0, label: format(monday, 'MMM d') })
    }
    const b = buckets.get(key)
    b.scheduled += point.scheduled || 0
    b.completed += point.completed || 0
  }
  return [...buckets.entries()].map(([, b]) => ({
    label: b.label,
    value: b.scheduled ? Math.round((b.completed / b.scheduled) * 100) : 0,
    scheduled: b.scheduled,
    completed: b.completed,
  }))
}

/** Group daily trend by calendar month (presentation). */
export function groupDailyTrendByMonth(dailyTrend) {
  const points = Array.isArray(dailyTrend) ? dailyTrend : []
  const buckets = new Map()
  for (const point of points) {
    if (!point?.date || point.is_future) continue
    const date = parseDateKey(point.date)
    const key = format(date, 'yyyy-MM')
    if (!buckets.has(key)) {
      buckets.set(key, {
        scheduled: 0,
        completed: 0,
        label: format(date, 'MMM'),
      })
    }
    const b = buckets.get(key)
    b.scheduled += point.scheduled || 0
    b.completed += point.completed || 0
  }
  return [...buckets.values()].map((b) => ({
    label: b.label,
    value: b.scheduled ? Math.round((b.completed / b.scheduled) * 100) : 0,
    scheduled: b.scheduled,
    completed: b.completed,
  }))
}
