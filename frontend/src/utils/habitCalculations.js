import {
  addDays,
  eachDayOfInterval,
  format,
  getDay,
  isAfter,
  isBefore,
  startOfDay,
  subDays,
} from 'date-fns'
import { isFutureDate, toDateKey } from './dateUtils'

export const SUCCESS_THRESHOLD = 80

export const HABIT_CATEGORIES = [
  'Health',
  'Work',
  'Learning',
  'Productivity',
  'Mental Health',
]

export const CATEGORY_COLORS = {
  Health: '#0B4FCC',
  Work: '#FF5148',
  Learning: '#1463F3',
  Productivity: '#60A5FA',
  'Mental Health': '#8B5CF6',
}

/** Soft badge styles for habit category tags (UI chips). */
export const CATEGORY_BADGE_COLORS = {
  Health: { bg: '#FEE2E2', text: '#DC2626' },
  Work: { bg: '#FFEDD5', text: '#EA580C' },
  Learning: { bg: '#DBEAFE', text: '#2563EB' },
  Productivity: { bg: '#EDE9FE', text: '#7C3AED' },
  'Mental Health': { bg: '#F3E8FF', text: '#7C3AED' },
}

/**
 * Portfolio share of non-archived habits by category (count-based).
 * Used by Habit Management donut — not day completion rates.
 */
export function getCategoryDistribution(habits) {
  const list = (habits || []).filter((habit) => !habit.archived)
  const total = list.length
  if (!total) return []

  return HABIT_CATEGORIES.map((name) => {
    const count = list.filter((habit) => habit.category === name).length
    return {
      name,
      count,
      value: Math.round((count / total) * 100),
      color: CATEGORY_COLORS[name],
    }
  }).filter((item) => item.count > 0)
}

export function isHabitScheduledOnDate(habit, date) {
  if (!habit || habit.archived) return false
  const key = toDateKey(date)
  const startKey = habit.startDate || key
  if (key < startKey) return false

  const frequency = habit.frequency || 'Daily'
  if (frequency === 'Daily') return true

  if (frequency === 'Weekly') {
    const weekDay =
      typeof habit.weekDay === 'number'
        ? habit.weekDay
        : getDay(parseStart(startKey))
    return getDay(startOfDay(date)) === weekDay
  }

  return true
}

function parseStart(key) {
  const [y, m, d] = key.split('-').map(Number)
  return startOfDay(new Date(y, m - 1, d))
}

export function getScheduledHabits(habits, date) {
  return (habits || []).filter((habit) => isHabitScheduledOnDate(habit, date))
}

export function getDayCompletionStats(habits, date) {
  if (isFutureDate(date)) {
    return { scheduled: 0, completed: 0, rate: 0 }
  }

  const scheduled = getScheduledHabits(habits, date)
  if (!scheduled.length) {
    return { scheduled: 0, completed: 0, rate: 0 }
  }

  const key = toDateKey(date)
  const completed = scheduled.filter(
    (habit) => habit.checkins?.[key]?.completed
  ).length
  const rate = Math.round((completed / scheduled.length) * 100)

  return { scheduled: scheduled.length, completed, rate }
}

export function getDayCompletionRate(habits, date) {
  return getDayCompletionStats(habits, date).rate
}

export function isSuccessfulDay(habits, date) {
  const { scheduled, rate } = getDayCompletionStats(habits, date)
  if (scheduled === 0) return false
  return rate >= SUCCESS_THRESHOLD
}

export function getCategoryStats(habits, date) {
  const scheduled = getScheduledHabits(habits, date)
  const key = toDateKey(date)

  return HABIT_CATEGORIES.map((name) => {
    const inCategory = scheduled.filter((h) => h.category === name)
    const completed = inCategory.filter(
      (h) => h.checkins?.[key]?.completed
    ).length
    const total = inCategory.length
    return {
      name,
      color: CATEGORY_COLORS[name],
      total,
      completed,
      value: total ? Math.round((completed / total) * 100) : 0,
    }
  }).filter((item) => item.total > 0)
}

export function getWeeklyProgress(habits, selectedDate) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const day = startOfDay(selectedDate)
  const jsDay = day.getDay()
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  const monday = addDays(day, mondayOffset)

  return labels.map((label, index) => {
    const date = addDays(monday, index)
    const future = isFutureDate(date)
    const stats = getDayCompletionStats(habits, date)
    return {
      day: label,
      value: future ? 0 : stats.rate,
      dateKey: toDateKey(date),
      isFuture: future,
      scheduled: stats.scheduled,
      completed: stats.completed,
    }
  })
}

export function getWeeklyConsistency(habits, selectedDate) {
  const week = getWeeklyProgress(habits, selectedDate).filter((d) => !d.isFuture)
  if (!week.length) return 0
  const avg = week.reduce((sum, item) => sum + item.value, 0) / week.length
  return Math.round(avg)
}

export function getTrendData(habits, selectedDate, range = '7D') {
  const end = startOfDay(selectedDate)
  const daysBack = range === '90D' ? 89 : range === '30D' ? 29 : 6
  const start = subDays(end, daysBack)
  const points = []

  for (let i = 0; i <= daysBack; i += 1) {
    const date = addDays(start, i)
    if (isAfter(date, end)) break
    const stats = getDayCompletionStats(habits, date)
    points.push({
      label: format(date, range === '7D' ? 'EEE' : 'MMM d'),
      value: isFutureDate(date) ? 0 : stats.rate,
      dateKey: toDateKey(date),
      scheduled: stats.scheduled,
      completed: stats.completed,
    })
  }

  return points
}

export function getMonthlyStats(habits, monthDate) {
  const start = startOfDay(
    new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  )
  const end = startOfDay(
    new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  )
  const today = startOfDay(new Date())
  const last = isBefore(end, today) ? end : today

  if (isAfter(start, today)) {
    return { daysCompleted: 0, monthlyRate: 0, longestStreak: 0 }
  }

  const days = eachDayOfInterval({ start, end: last })
  let daysCompleted = 0
  let longest = 0
  let current = 0

  days.forEach((day) => {
    if (isSuccessfulDay(habits, day)) {
      daysCompleted += 1
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  })

  return {
    daysCompleted,
    monthlyRate: days.length
      ? Math.round((daysCompleted / days.length) * 100)
      : 0,
    longestStreak: longest,
  }
}

export function getBestPerformingDay(habits, selectedDate, lookback = 30) {
  const end = startOfDay(selectedDate)
  let best = null

  for (let i = 0; i < lookback; i += 1) {
    const date = subDays(end, i)
    if (isFutureDate(date)) continue
    const stats = getDayCompletionStats(habits, date)
    if (!stats.scheduled) continue
    if (!best || stats.rate > best.rate) {
      best = {
        date,
        dateKey: toDateKey(date),
        rate: stats.rate,
        label: format(date, 'EEE, MMM d'),
      }
    }
  }

  return best
}

export function getHabitProgress(habit, asOfDate = new Date(), days = 30) {
  if (!habit) return { completedDays: 0, scheduledDays: 0, rate: 0 }
  const end = startOfDay(asOfDate)
  let scheduledDays = 0
  let completedDays = 0

  for (let i = 0; i < days; i += 1) {
    const date = subDays(end, i)
    if (isFutureDate(date)) continue
    if (!isHabitScheduledOnDate(habit, date)) continue
    scheduledDays += 1
    const key = toDateKey(date)
    if (habit.checkins?.[key]?.completed) completedDays += 1
  }

  return {
    completedDays,
    scheduledDays,
    rate: scheduledDays
      ? Math.round((completedDays / scheduledDays) * 100)
      : 0,
  }
}
