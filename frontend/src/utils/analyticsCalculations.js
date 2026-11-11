import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import { isFutureDate, toDateKey } from './dateUtils'
import {
  CATEGORY_COLORS,
  HABIT_CATEGORIES,
  getDayCompletionStats,
  isHabitScheduledOnDate,
} from './habitCalculations'
import { getCurrentStreak, getLongestStreak } from './streakCalculations'
import { getMonthlyCalendarDays } from './calendarCalculations'

export const ANALYTICS_PRESETS = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'prevMonth', label: 'Previous Month' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
]

function clampEnd(end, today = new Date()) {
  const t = startOfDay(today)
  const e = startOfDay(end)
  return isAfter(e, t) ? t : e
}

export function resolveDateRange(preset, anchorDate = new Date(), custom) {
  const today = startOfDay(new Date())
  const anchor = startOfDay(anchorDate || today)

  if (preset === 'custom' && custom?.start && custom?.end) {
    let start = startOfDay(custom.start)
    let end = startOfDay(custom.end)
    if (isAfter(start, end)) {
      const tmp = start
      start = end
      end = tmp
    }
    return { start, end: clampEnd(end, today), preset: 'custom' }
  }

  switch (preset) {
    case '7d':
      return { start: subDays(today, 6), end: today, preset }
    case '30d':
      return { start: subDays(today, 29), end: today, preset }
    case '90d':
      return { start: subDays(today, 89), end: today, preset }
    case 'prevMonth': {
      const prev = subMonths(anchor, 1)
      return {
        start: startOfMonth(prev),
        end: clampEnd(endOfMonth(prev), today),
        preset,
      }
    }
    case 'thisYear':
      return {
        start: startOfYear(today),
        end: today,
        preset,
      }
    case 'thisMonth':
    default:
      return {
        start: startOfMonth(anchor),
        end: clampEnd(endOfMonth(anchor), today),
        preset: 'thisMonth',
      }
  }
}

export function getPeriodOccurrenceStats(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  if (isAfter(from, to)) {
    return { scheduled: 0, completed: 0, rate: 0, days: 0 }
  }

  const days = eachDayOfInterval({ start: from, end: to })
  let scheduled = 0
  let completed = 0
  let countedDays = 0

  days.forEach((day) => {
    if (isFutureDate(day)) return
    const stats = getDayCompletionStats(habits, day)
    if (!stats.scheduled) return
    scheduled += stats.scheduled
    completed += stats.completed
    countedDays += 1
  })

  return {
    scheduled,
    completed,
    rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    days: countedDays,
  }
}

export function getPeriodComparison(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const current = getPeriodOccurrenceStats(habits, from, to)
  const length = differenceInCalendarDays(to, from)
  const prevEnd = subDays(from, 1)
  const prevStart = subDays(prevEnd, length)
  const previous = getPeriodOccurrenceStats(habits, prevStart, prevEnd)

  if (!previous.scheduled) {
    return {
      current,
      previous,
      deltaPoints: null,
    }
  }

  return {
    current,
    previous,
    deltaPoints: current.rate - previous.rate,
  }
}

export function getDailyCompletionTrend(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const span = differenceInCalendarDays(to, from) + 1
  const useShortLabel = span <= 14
  const useMonthDay = span <= 100

  return eachDayOfInterval({ start: from, end: to }).map((date) => {
    const stats = getDayCompletionStats(habits, date)
    const future = isFutureDate(date)
    return {
      date,
      dateKey: toDateKey(date),
      label: format(
        date,
        useShortLabel ? 'EEE' : useMonthDay ? 'MMM d' : 'MMM'
      ),
      value: future ? 0 : stats.rate,
      scheduled: stats.scheduled,
      completed: stats.completed,
      isFuture: future,
    }
  })
}

export function getWeeklyCompletionTrend(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const weeks = []
  let cursor = startOfWeek(from, { weekStartsOn: 1 })

  while (!isAfter(cursor, to)) {
    const weekEnd = addDays(cursor, 6)
    const rangeStart = isBefore(cursor, from) ? from : cursor
    const rangeEnd = isAfter(weekEnd, to) ? to : weekEnd
    const stats = getPeriodOccurrenceStats(habits, rangeStart, rangeEnd)
    weeks.push({
      label: format(cursor, 'MMM d'),
      value: stats.rate,
      scheduled: stats.scheduled,
      completed: stats.completed,
      start: rangeStart,
      end: rangeEnd,
    })
    cursor = addDays(cursor, 7)
  }

  return weeks
}

export function getMonthlyCompletionTrend(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const months = []
  let cursor = startOfMonth(from)

  while (!isAfter(cursor, to)) {
    const monthEnd = endOfMonth(cursor)
    const rangeStart = isBefore(cursor, from) ? from : cursor
    const rangeEnd = isAfter(monthEnd, to) ? to : monthEnd
    const stats = getPeriodOccurrenceStats(habits, rangeStart, rangeEnd)
    months.push({
      label: format(cursor, 'MMM yyyy'),
      value: stats.rate,
      scheduled: stats.scheduled,
      completed: stats.completed,
    })
    cursor = startOfMonth(addDays(monthEnd, 1))
  }

  return months
}

export function getCategoryPerformance(habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const days = eachDayOfInterval({ start: from, end: to })
  const map = Object.fromEntries(
    HABIT_CATEGORIES.map((name) => [
      name,
      { name, scheduled: 0, completed: 0, color: CATEGORY_COLORS[name] },
    ])
  )

  days.forEach((day) => {
    if (isFutureDate(day)) return
    const key = toDateKey(day)
    ;(habits || []).forEach((habit) => {
      if (!isHabitScheduledOnDate(habit, day)) return
      const cat = habit.category || 'Health'
      if (!map[cat]) return
      map[cat].scheduled += 1
      if (habit.checkins?.[key]?.completed) map[cat].completed += 1
    })
  })

  return HABIT_CATEGORIES.map((name) => {
    const item = map[name]
    return {
      ...item,
      rate: item.scheduled
        ? Math.round((item.completed / item.scheduled) * 100)
        : 0,
      value: item.scheduled
        ? Math.round((item.completed / item.scheduled) * 100)
        : 0,
    }
  }).filter((item) => item.scheduled > 0)
}

export function getTopPerformingHabits(habits, start, end, limit = 4) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  const days = eachDayOfInterval({ start: from, end: to })

  const ranked = (habits || [])
    .filter((h) => !h.archived)
    .map((habit) => {
      let scheduled = 0
      let completed = 0
      days.forEach((day) => {
        if (isFutureDate(day)) return
        if (!isHabitScheduledOnDate(habit, day)) return
        scheduled += 1
        if (habit.checkins?.[toDateKey(day)]?.completed) completed += 1
      })
      return {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        category: habit.category,
        scheduled,
        completed,
        rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
      }
    })
    .filter((item) => item.scheduled > 0)
    .sort((a, b) => b.rate - a.rate || b.completed - a.completed)

  return ranked.slice(0, limit)
}

export function getHeatmapBucket(rate, scheduled) {
  if (!scheduled) return 'none'
  if (rate >= 100) return '100'
  if (rate >= 75) return '75'
  if (rate >= 25) return '25'
  if (rate >= 1) return '1'
  return '0'
}

export function getConsistencyHeatmapDays(habits, viewMonth) {
  return getMonthlyCalendarDays(viewMonth).map((cell) => {
    const stats = getDayCompletionStats(habits, cell.date)
    const future = isFutureDate(cell.date)
    const rate = future ? 0 : stats.rate
    const scheduled = future ? 0 : stats.scheduled
    return {
      ...cell,
      rate,
      scheduled,
      completed: future ? 0 : stats.completed,
      bucket: cell.inMonth
        ? future
          ? 'none'
          : getHeatmapBucket(rate, scheduled)
        : 'outside',
      isFuture: future,
    }
  })
}

export function getHabitAnalytics(habit, start, end) {
  if (!habit) {
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

  const from = startOfDay(start)
  const to = startOfDay(end)
  const days = eachDayOfInterval({ start: from, end: to })
  let scheduled = 0
  let completed = 0
  const trend = []

  days.forEach((day) => {
    if (isFutureDate(day)) return
    if (!isHabitScheduledOnDate(habit, day)) return
    scheduled += 1
    const done = Boolean(habit.checkins?.[toDateKey(day)]?.completed)
    if (done) completed += 1
    trend.push({
      label: format(day, 'MMM d'),
      value: done ? 100 : 0,
      dateKey: toDateKey(day),
    })
  })

  const solo = [habit]
  return {
    scheduled,
    completed,
    missed: Math.max(0, scheduled - completed),
    rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    currentStreak: getCurrentStreak(solo, to),
    longestStreak: getLongestStreak(solo, to, 365),
    trend,
  }
}

export function getBestWeekdayInRange(habits, start, end) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  const from = startOfDay(start)
  const to = startOfDay(end)

  eachDayOfInterval({ start: from, end: to }).forEach((day) => {
    if (isFutureDate(day)) return
    const stats = getDayCompletionStats(habits, day)
    if (!stats.scheduled) return
    const wd = getDay(day)
    buckets[wd].sum += stats.rate
    buckets[wd].count += 1
  })

  let best = -1
  let bestAvg = -1
  buckets.forEach((b, i) => {
    if (!b.count) return
    const avg = b.sum / b.count
    if (avg > bestAvg) {
      bestAvg = avg
      best = i
    }
  })

  if (best < 0) return null
  return { label: labels[best], average: Math.round(bestAvg), weekday: best }
}

export function getLowestWeekdayInRange(habits, start, end) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  const from = startOfDay(start)
  const to = startOfDay(end)

  eachDayOfInterval({ start: from, end: to }).forEach((day) => {
    if (isFutureDate(day)) return
    const stats = getDayCompletionStats(habits, day)
    if (!stats.scheduled) return
    const wd = getDay(day)
    buckets[wd].sum += stats.rate
    buckets[wd].count += 1
  })

  let worst = -1
  let worstAvg = Infinity
  buckets.forEach((b, i) => {
    if (!b.count) return
    const avg = b.sum / b.count
    if (avg < worstAvg) {
      worstAvg = avg
      worst = i
    }
  })

  if (worst < 0) return null
  return { label: labels[worst], average: Math.round(worstAvg), weekday: worst }
}

export function getPerformanceInsights({
  habits,
  start,
  end,
  streakDays,
  longestStreak,
  goalTarget = 15,
}) {
  const insights = []
  const comparison = getPeriodComparison(habits, start, end)
  const bestDay = getBestWeekdayInRange(habits, start, end)
  const lowDay = getLowestWeekdayInRange(habits, start, end)
  const categories = getCategoryPerformance(habits, start, end)
  const topHabits = getTopPerformingHabits(habits, start, end, 1)
  const weakHabits = getTopPerformingHabits(habits, start, end, 50)
    .slice()
    .reverse()
    .filter((h) => h.rate < 70)

  if (comparison.deltaPoints != null && comparison.previous.scheduled > 0) {
    const delta = comparison.deltaPoints
    if (delta > 0) {
      insights.push({
        id: 'improve',
        group: 'performance',
        title: `+${delta}% better than previous period`,
        body: `Completion rose from ${comparison.previous.rate}% to ${comparison.current.rate}%.`,
        tone: 'green',
      })
    } else if (delta < 0) {
      insights.push({
        id: 'decline',
        group: 'performance',
        title: `${delta}% vs previous period`,
        body: `Completion fell from ${comparison.previous.rate}% to ${comparison.current.rate}%.`,
        tone: 'red',
      })
    }
  }

  const weekdayNames = [
    'Sundays',
    'Mondays',
    'Tuesdays',
    'Wednesdays',
    'Thursdays',
    'Fridays',
    'Saturdays',
  ]

  if (bestDay) {
    insights.push({
      id: 'best-day',
      group: 'consistency',
      title: `Most consistent day: ${bestDay.label}`,
      body: `Average completion on ${weekdayNames[bestDay.weekday]} is ${bestDay.average}%.`,
      tone: 'blue',
    })
  }

  if (lowDay && (!bestDay || lowDay.weekday !== bestDay.weekday)) {
    insights.push({
      id: 'low-day',
      group: 'consistency',
      title: `Softest day: ${lowDay.label}`,
      body: `${weekdayNames[lowDay.weekday]} average ${lowDay.average}% — a chance to improve.`,
      tone: 'orange',
    })
  }

  if (streakDays > 0) {
    const remaining = Math.max(0, (longestStreak || goalTarget) - streakDays)
    insights.push({
      id: 'streak',
      group: 'streaks',
      title: 'Keep the streak going!',
      body:
        remaining > 0
          ? `You're on a ${streakDays}-day streak. ${remaining} more day${remaining === 1 ? '' : 's'} to beat your best (${longestStreak} days).`
          : `You're on a ${streakDays}-day streak — matching or beating your best!`,
      tone: 'purple',
    })
  }

  if (categories.length) {
    const bestCat = [...categories].sort((a, b) => b.rate - a.rate)[0]
    const worstCat = [...categories].sort((a, b) => a.rate - b.rate)[0]
    insights.push({
      id: 'best-cat',
      group: 'categories',
      title: `${bestCat.name} is your strongest category`,
      body: `${bestCat.rate}% completion (${bestCat.completed}/${bestCat.scheduled}).`,
      tone: 'blue',
    })
    if (worstCat.name !== bestCat.name && worstCat.rate < 80) {
      insights.push({
        id: 'weak-cat',
        group: 'recommendations',
        title: `${worstCat.name} needs more consistency`,
        body: `Currently at ${worstCat.rate}% (${worstCat.completed}/${worstCat.scheduled}).`,
        tone: 'orange',
      })
    }
  }

  if (topHabits[0]) {
    insights.push({
      id: 'top-habit',
      group: 'performance',
      title: `${topHabits[0].name} leads the pack`,
      body: `${topHabits[0].rate}% completion this period.`,
      tone: 'green',
    })
  }

  if (weakHabits[0]) {
    insights.push({
      id: 'improve-habit',
      group: 'recommendations',
      title: `Focus on ${weakHabits[0].name}`,
      body: `Only ${weakHabits[0].rate}% completed — small wins add up.`,
      tone: 'orange',
    })
  }

  return insights.slice(0, 8)
}

export function formatRangeLabel(start, end) {
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

export function getTrendPresetRange(preset, endDate = new Date()) {
  const end = startOfDay(endDate)
  const map = { '7D': 6, '30D': 29, '90D': 89, '1Y': 364 }
  const back = map[preset] ?? 29
  return { start: subDays(end, back), end }
}
