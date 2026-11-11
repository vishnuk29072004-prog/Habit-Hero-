import {
  eachDayOfInterval,
  endOfMonth,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns'
import { isFutureDate, parseDateKey, toDateKey } from './dateUtils'
import { getMonthlyCalendarDays } from './calendarCalculations'

export const JOURNAL_MOODS = [
  { id: 'happy', label: 'Happy' },
  { id: 'productive', label: 'Productive' },
  { id: 'motivated', label: 'Motivated' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'tired', label: 'Tired' },
  { id: 'stressed', label: 'Stressed' },
  { id: 'sad', label: 'Sad' },
]

export const JOURNAL_TAGS = [
  'Productivity',
  'Health',
  'Learning',
  'Personal Growth',
  'Motivation',
  'Reflection',
]

export const JOURNAL_OVERVIEW_PERIODS = [
  { id: 'thisWeek', label: 'This Week' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'thisYear', label: 'This Year' },
]

export function normalizeJournalEntry(entry, today = new Date()) {
  const todayKey = toDateKey(today)
  const moodIds = JOURNAL_MOODS.map((m) => m.id)
  return {
    id: entry.id || `j-${Date.now()}`,
    date: entry.date || todayKey,
    habitId: entry.habitId || null,
    title: (entry.title || '').trim(),
    content: (entry.content || '').trim(),
    mood: moodIds.includes(entry.mood) ? entry.mood : 'neutral',
    tags: Array.isArray(entry.tags)
      ? entry.tags.filter((t) => JOURNAL_TAGS.includes(t))
      : [],
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
  }
}

export function getEntriesForDate(entries, dateKey) {
  return (entries || [])
    .filter((e) => e.date === dateKey)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

function uniqueJournalDates(entries) {
  return [
    ...new Set((entries || []).map((e) => e.date).filter(Boolean)),
  ].sort()
}

export function getJournalCurrentStreak(entries, asOf = new Date()) {
  if (isFutureDate(asOf)) return 0
  const dates = new Set(uniqueJournalDates(entries))
  let streak = 0
  let cursor = startOfDay(asOf)

  while (true) {
    const key = toDateKey(cursor)
    if (!dates.has(key)) break
    streak += 1
    cursor = subDays(cursor, 1)
    if (streak > 730) break
  }
  return streak
}

export function getJournalLongestStreak(entries, asOf = new Date()) {
  const dates = uniqueJournalDates(entries).filter(
    (key) => !isFutureDate(parseDateKey(key), asOf)
  )
  if (!dates.length) return 0

  let longest = 1
  let current = 1
  for (let i = 1; i < dates.length; i += 1) {
    const prev = parseDateKey(dates[i - 1])
    const next = parseDateKey(dates[i])
    const diff = Math.round((next - prev) / (1000 * 60 * 60 * 24))
    if (diff === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

export function getJournalStats(entries, asOf = new Date()) {
  const list = entries || []
  const dates = uniqueJournalDates(list)
  return {
    totalEntries: list.length,
    activeDays: dates.length,
    currentStreak: getJournalCurrentStreak(list, asOf),
    longestStreak: getJournalLongestStreak(list, asOf),
  }
}

function resolveOverviewRange(period, asOf = new Date()) {
  const today = startOfDay(asOf)
  switch (period) {
    case 'thisWeek':
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: today,
      }
    case 'lastMonth': {
      const prev = subMonths(today, 1)
      return {
        start: startOfMonth(prev),
        end: endOfMonth(prev),
      }
    }
    case 'thisYear':
      return { start: startOfYear(today), end: today }
    case 'thisMonth':
    default:
      return { start: startOfMonth(today), end: today }
  }
}

export function getJournalOverview(entries, period = 'thisMonth', asOf = new Date()) {
  const today = startOfDay(asOf)
  let { start, end } = resolveOverviewRange(period, asOf)
  if (isAfter(end, today)) end = today
  if (isAfter(start, end)) {
    return {
      journaledDays: 0,
      missedDays: 0,
      totalDays: 0,
      rate: 0,
    }
  }

  const days = eachDayOfInterval({ start, end })
  const dateSet = new Set(uniqueJournalDates(entries))
  let journaled = 0
  let missed = 0

  days.forEach((day) => {
    if (isFutureDate(day, asOf)) return
    const key = toDateKey(day)
    if (dateSet.has(key)) journaled += 1
    else missed += 1
  })

  const totalDays = journaled + missed
  return {
    journaledDays: journaled,
    missedDays: missed,
    totalDays,
    rate: totalDays ? Math.round((journaled / totalDays) * 100) : 0,
  }
}

export function getJournalCalendarDays(viewMonth, entries, selectedDate) {
  const dateSet = new Set(uniqueJournalDates(entries))
  const selectedKey = toDateKey(selectedDate)
  return getMonthlyCalendarDays(viewMonth).map((cell) => ({
    ...cell,
    hasEntries: dateSet.has(cell.dateKey),
    isSelected: cell.dateKey === selectedKey,
    isFuture: isFutureDate(cell.date),
  }))
}

export function getRecentJournalDates(entries, limit = 3) {
  const map = {}
  ;(entries || []).forEach((e) => {
    if (!e.date) return
    map[e.date] = (map[e.date] || 0) + 1
  })
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

export function resolveEntryHabit(entry, habits) {
  if (!entry?.habitId) {
    return {
      name: entry?.title || 'Daily Reflection',
      icon: 'pen',
      missing: false,
      general: true,
    }
  }
  const habit = (habits || []).find((h) => h.id === entry.habitId)
  if (!habit) {
    return {
      name: entry.title || 'Archived habit',
      icon: 'sparkles',
      missing: true,
      general: false,
    }
  }
  return {
    name: habit.name,
    icon: habit.icon || 'sparkles',
    missing: false,
    general: false,
    habit,
  }
}

export function getEntryCompletionStatus(entry, habits, dateKey) {
  const resolved = resolveEntryHabit(entry, habits)
  if (resolved.general || resolved.missing || !resolved.habit) {
    return null
  }
  const key = dateKey || entry.date
  const completed = Boolean(resolved.habit.checkins?.[key]?.completed)
  return completed ? 'completed' : 'pending'
}

export function filterJournalEntries(
  entries,
  habits,
  {
    query = '',
    habitId = 'all',
    mood = 'all',
    tag = 'all',
    startDate = '',
    endDate = '',
    sort = 'newest',
  } = {}
) {
  const q = query.trim().toLowerCase()
  let list = (entries || []).filter((entry) => {
    if (habitId === 'general' && entry.habitId) return false
    if (habitId !== 'all' && habitId !== 'general' && entry.habitId !== habitId) {
      return false
    }
    if (mood !== 'all' && entry.mood !== mood) return false
    if (tag !== 'all' && !(entry.tags || []).includes(tag)) return false
    if (startDate && entry.date < startDate) return false
    if (endDate && entry.date > endDate) return false

    if (!q) return true
    const resolved = resolveEntryHabit(entry, habits)
    const hay = [
      entry.title,
      entry.content,
      resolved.name,
      ...(entry.tags || []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  list = [...list]
  if (sort === 'oldest') {
    list.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.createdAt || '').localeCompare(b.createdAt || '')
    )
  } else {
    list.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    )
  }
  return list
}

export function createDefaultJournalEntries(today = new Date()) {
  const end = startOfDay(today)
  const templates = [
    {
      habitId: 'h1',
      title: 'Morning Workout',
      content: 'Great workout today! Felt more energetic than yesterday.',
      mood: 'motivated',
      tags: ['Health', 'Motivation'],
    },
    {
      habitId: 'h2',
      title: 'Read (30 mins)',
      content: 'Read 20 pages of Atomic Habits. Learned a few practical tips.',
      mood: 'productive',
      tags: ['Learning', 'Personal Growth'],
    },
    {
      habitId: 'h3',
      title: 'Drink Water (2L)',
      content: 'Had around 1.2L so far. Need to complete the remaining.',
      mood: 'neutral',
      tags: ['Health'],
    },
    {
      habitId: 'h4',
      title: 'Code / Learn',
      content: 'Shipped a small feature and reviewed React patterns.',
      mood: 'productive',
      tags: ['Learning', 'Productivity'],
    },
    {
      habitId: 'h5',
      title: 'Sleep before 11 PM',
      content: 'Wind-down routine felt smoother tonight.',
      mood: 'happy',
      tags: ['Health', 'Reflection'],
    },
    {
      habitId: 'h6',
      title: 'Meditation',
      content: 'Ten mindful minutes helped clear mental clutter.',
      mood: 'motivated',
      tags: ['Reflection', 'Motivation'],
    },
  ]

  const entries = []
  let id = 1
  for (let offset = 0; offset < 16; offset += 1) {
    const day = subDays(end, offset)
    const date = toDateKey(day)
    const count = offset === 0 ? 4 : offset % 5 === 0 ? 2 : 3
    for (let i = 0; i < count; i += 1) {
      const tmpl = templates[(offset + i) % templates.length]
      const createdAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        8 + i,
        15
      ).toISOString()
      entries.push(
        normalizeJournalEntry(
          {
            id: `j-seed-${id}`,
            date,
            habitId: tmpl.habitId,
            title: tmpl.title,
            content: tmpl.content,
            mood: tmpl.mood,
            tags: tmpl.tags,
            createdAt,
            updatedAt: createdAt,
          },
          today
        )
      )
      id += 1
    }
  }
  return entries
}
