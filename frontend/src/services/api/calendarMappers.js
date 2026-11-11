/**
 * Map calendar API day summaries ↔ Calendar UI cell statuses.
 * UI statuses: outside | upcoming | today | completed | partial | pastEmpty
 */

import { startOfDay } from 'date-fns'
import { isFutureDate, isTodayDate, toDateKey } from '../../utils/dateUtils'
import { SUCCESS_THRESHOLD } from '../../utils/habitCalculations'

/**
 * @param {object|undefined} daySummary - CalendarDaySummary
 */
export function mapDaySummaryToUiStatus(
  daySummary,
  date,
  today = new Date(),
  inMonth = true
) {
  if (!inMonth) return 'outside'

  const day = startOfDay(date)
  if (isFutureDate(day, today)) return 'upcoming'
  if (isTodayDate(day, today)) return 'today'

  if (!daySummary || !daySummary.total_habits) return 'pastEmpty'
  if (daySummary.completion_percentage >= SUCCESS_THRESHOLD) return 'completed'
  if (daySummary.completed > 0) return 'partial'
  return 'pastEmpty'
}

/** Index monthly API days by date key. */
export function indexMonthlyDays(monthlyData) {
  const map = {}
  const days = monthlyData?.days
  if (!Array.isArray(days)) return map
  for (const day of days) {
    if (day?.date) map[day.date] = day
  }
  return map
}

/**
 * Map DailyCalendarData habits → DailyHabitList / scheduledDayHabits shape.
 */
export function mapDailyHabitsFromApi(dailyData) {
  const habits = Array.isArray(dailyData?.habits) ? dailyData.habits : []
  return habits
    .filter((h) => h.scheduled && h.status !== 'not_scheduled')
    .map((h) => ({
      id: h.habit_id,
      name: h.name,
      category: h.category,
      icon: h.icon || 'sparkles',
      frequency: h.frequency,
      weekDay: typeof h.week_day === 'number' ? h.week_day : undefined,
      completed: h.status === 'completed',
      notes: h.checkin_notes || '',
      checkinId: h.checkin_id ?? null,
      calendarStatus: h.status,
    }))
}

export function mapDailySummaryFromApi(dailyData, isFuture = false) {
  const summary = dailyData?.summary
  if (!summary) {
    return {
      scheduled: 0,
      completed: 0,
      pending: 0,
      rate: 0,
      isFuture,
      isSuccessful: false,
      hasJournal: false,
      hasNotes: false,
    }
  }
  return {
    scheduled: summary.total_habits || 0,
    completed: summary.completed || 0,
    pending: summary.pending || 0,
    rate: summary.completion_percentage || 0,
    isFuture,
    isSuccessful: (summary.completion_percentage || 0) >= SUCCESS_THRESHOLD,
    hasJournal: Boolean(summary.has_journal),
    hasNotes: Boolean(summary.has_notes),
  }
}

/** Best weekday label from monthly day summaries (local Sun=0). */
export function mapBestWeekdayFromMonthly(monthlyData) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = Array.isArray(monthlyData?.days) ? monthlyData.days : []
  const buckets = labels.map(() => ({ scheduled: 0, completed: 0 }))

  for (const day of days) {
    if (!day?.date || !day.total_habits) continue
    const [y, m, d] = day.date.split('-').map(Number)
    if (!y || !m || !d) continue
    const wd = new Date(y, m - 1, d).getDay()
    buckets[wd].scheduled += day.total_habits || 0
    buckets[wd].completed += day.completed || 0
  }

  let best = null
  let bestRate = -1
  buckets.forEach((bucket, index) => {
    if (!bucket.scheduled) return
    const rate = bucket.completed / bucket.scheduled
    if (rate > bestRate) {
      bestRate = rate
      best = labels[index]
    }
  })
  return best || '—'
}

/** Derive month stats from monthly calendar days (past/today only). */
export function mapMonthlyStatisticsFromApi(monthlyData, today = new Date()) {
  const days = Array.isArray(monthlyData?.days) ? monthlyData.days : []
  const todayKey = toDateKey(today)
  let completedDays = 0
  let missedDays = 0
  let scheduledInstances = 0
  let completedInstances = 0

  for (const day of days) {
    if (!day?.date || day.date > todayKey) continue
    scheduledInstances += day.total_habits || 0
    completedInstances += day.completed || 0
    if (!day.total_habits) continue
    if ((day.completion_percentage || 0) >= SUCCESS_THRESHOLD) {
      completedDays += 1
    } else {
      missedDays += 1
    }
  }

  const monthlyRate = scheduledInstances
    ? Math.round((completedInstances / scheduledInstances) * 100)
    : 0

  return {
    completedDays,
    missedDays,
    monthlyRate,
    scheduledInstances,
    completedInstances,
  }
}

export default {
  mapDaySummaryToUiStatus,
  indexMonthlyDays,
  mapDailyHabitsFromApi,
  mapDailySummaryFromApi,
  mapMonthlyStatisticsFromApi,
}
