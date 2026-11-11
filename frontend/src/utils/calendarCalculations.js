import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  isFutureDate,
  isPastDate,
  isTodayDate,
  toDateKey,
} from './dateUtils'
import {
  SUCCESS_THRESHOLD,
  getDayCompletionStats,
  isSuccessfulDay,
} from './habitCalculations'
import { getLongestStreak } from './streakCalculations'

const WEEK_STARTS_ON = 1 // Monday

/**
 * Build Mon-first calendar grid days for a month.
 */
export function getMonthlyCalendarDays(viewMonth) {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON })
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    dateKey: toDateKey(date),
    inMonth: isSameMonth(date, viewMonth),
    dayNumber: date.getDate(),
  }))
}

/**
 * Calendar cell status for habit completion coloring.
 * Returns: outside | upcoming | today | completed | partial | pastEmpty
 */
export function getDateStatus(habits, date, today = new Date(), inMonth = true) {
  if (!inMonth) return 'outside'

  const day = startOfDay(date)
  if (isFutureDate(day, today)) return 'upcoming'
  if (isTodayDate(day, today)) return 'today'

  const stats = getDayCompletionStats(habits, day)
  if (stats.scheduled === 0 || stats.rate === 0) return 'pastEmpty'
  if (stats.rate >= SUCCESS_THRESHOLD) return 'completed'
  return 'partial'
}

export function getDailyHabitSummary(habits, date) {
  const stats = getDayCompletionStats(habits, date)
  const pending = Math.max(0, stats.scheduled - stats.completed)
  return {
    scheduled: stats.scheduled,
    completed: stats.completed,
    pending,
    rate: stats.rate,
    isFuture: isFutureDate(date),
    isSuccessful: isSuccessfulDay(habits, date),
  }
}

/**
 * Monthly statistics for the Calendar page (viewed month).
 */
export function getCalendarMonthlyStatistics(habits, viewMonth, today = new Date()) {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const todayStart = startOfDay(today)

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  let completedDays = 0
  let missedDays = 0
  let scheduledInstances = 0
  let completedInstances = 0

  daysInMonth.forEach((day) => {
    if (isFutureDate(day, todayStart)) return
    const stats = getDayCompletionStats(habits, day)
    scheduledInstances += stats.scheduled
    completedInstances += stats.completed

    if (stats.scheduled === 0) return
    if (isSuccessfulDay(habits, day)) {
      completedDays += 1
    } else {
      missedDays += 1
    }
  })

  const monthlyRate = scheduledInstances
    ? Math.round((completedInstances / scheduledInstances) * 100)
    : 0

  return {
    completedDays,
    missedDays,
    monthlyRate,
    longestStreak: getLongestStreak(habits, todayStart),
    bestPerformingDay: getBestWeekdayInMonth(habits, viewMonth, todayStart),
    scheduledInstances,
    completedInstances,
  }
}

/**
 * Weekday with highest average completion rate in the month.
 */
export function getBestWeekdayInMonth(habits, viewMonth, today = new Date()) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  days.forEach((day) => {
    if (isFutureDate(day, today)) return
    const stats = getDayCompletionStats(habits, day)
    if (!stats.scheduled) return
    const weekday = getDay(day)
    buckets[weekday].sum += stats.rate
    buckets[weekday].count += 1
  })

  let bestIndex = -1
  let bestAvg = -1
  buckets.forEach((bucket, index) => {
    if (!bucket.count) return
    const avg = bucket.sum / bucket.count
    if (avg > bestAvg) {
      bestAvg = avg
      bestIndex = index
    }
  })

  if (bestIndex < 0) return '—'
  return labels[bestIndex]
}

export function getCompletedDaysCount(habits, viewMonth, today = new Date()) {
  return getCalendarMonthlyStatistics(habits, viewMonth, today).completedDays
}

export function getMissedDaysCount(habits, viewMonth, today = new Date()) {
  return getCalendarMonthlyStatistics(habits, viewMonth, today).missedDays
}

export function getMonthlyCompletionRate(habits, viewMonth, today = new Date()) {
  return getCalendarMonthlyStatistics(habits, viewMonth, today).monthlyRate
}

export { SUCCESS_THRESHOLD }
