import {
  eachDayOfInterval,
  format,
  isAfter,
  startOfDay,
} from 'date-fns'
import { isFutureDate, parseDateKey, toDateKey } from './dateUtils'
import {
  getDayCompletionStats,
  isHabitScheduledOnDate,
} from './habitCalculations'
import { getPeriodOccurrenceStats } from './analyticsCalculations'

export const GOAL_CATEGORIES = [
  'Health',
  'Work',
  'Learning',
  'Productivity',
  'Mental Health',
  'Personal Development',
]

export const GOAL_TARGET_TYPES = [
  {
    id: 'completion_count',
    label: 'Complete a specific number of times',
    unit: 'times',
  },
  {
    id: 'consecutive_days',
    label: 'Maintain a consecutive-day streak',
    unit: 'days',
  },
  {
    id: 'days_completed',
    label: 'Complete on a number of days',
    unit: 'days',
  },
  {
    id: 'completion_percentage',
    label: 'Achieve a completion percentage',
    unit: '%',
  },
]

export const GOAL_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'highest', label: 'Highest Progress' },
  { id: 'lowest', label: 'Lowest Progress' },
  { id: 'name', label: 'Name A–Z' },
]

function clampWindow(goal, asOf = new Date()) {
  const today = startOfDay(asOf)
  const start = parseDateKey(goal.startDate || toDateKey(today))
  const endRaw = parseDateKey(goal.endDate || toDateKey(today))
  let end = endRaw
  if (isAfter(end, today)) end = today
  if (isAfter(start, end)) {
    return { start, end: start, empty: true }
  }
  return { start, end, empty: false }
}

function findLinkedHabit(habits, linkedHabitId) {
  if (!linkedHabitId) return null
  return (habits || []).find((h) => h.id === linkedHabitId) || null
}

function countCompletions(habit, start, end) {
  if (!habit) return { current: 0, scheduled: 0 }
  let current = 0
  let scheduled = 0
  eachDayOfInterval({ start, end }).forEach((day) => {
    if (isFutureDate(day)) return
    if (!isHabitScheduledOnDate(habit, day)) return
    scheduled += 1
    if (habit.checkins?.[toDateKey(day)]?.completed) current += 1
  })
  return { current, scheduled }
}

function bestConsecutiveScheduled(habit, start, end) {
  if (!habit) return 0
  let best = 0
  let run = 0
  eachDayOfInterval({ start, end }).forEach((day) => {
    if (isFutureDate(day)) return
    if (!isHabitScheduledOnDate(habit, day)) return
    if (habit.checkins?.[toDateKey(day)]?.completed) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  })
  return best
}

function currentConsecutiveScheduled(habit, start, end) {
  if (!habit) return 0
  const days = eachDayOfInterval({ start, end }).filter(
    (day) => !isFutureDate(day) && isHabitScheduledOnDate(habit, day)
  )
  let run = 0
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const key = toDateKey(days[i])
    if (habit.checkins?.[key]?.completed) run += 1
    else break
  }
  return run
}

export function getGoalProgressDetail(goal, habits, asOf = new Date()) {
  const target = Math.max(1, Number(goal.targetValue) || 1)
  const { start, end, empty } = clampWindow(goal, asOf)
  if (empty) {
    return {
      current: 0,
      target,
      rate: 0,
      unit: unitForType(goal.targetType),
      label: `0 / ${target} ${unitForType(goal.targetType)}`,
    }
  }

  const habit = findLinkedHabit(habits, goal.linkedHabitId)
  const type = goal.targetType || 'completion_count'

  if (type === 'completion_count') {
    const { current } = countCompletions(habit, start, end)
    const capped = Math.min(current, target)
    return {
      current: capped,
      target,
      rate: Math.min(100, Math.round((capped / target) * 100)),
      unit: 'times',
      label: `${capped} / ${target} times`,
    }
  }

  if (type === 'consecutive_days') {
    const best = bestConsecutiveScheduled(habit, start, end)
    const current = Math.min(best, target)
    return {
      current,
      target,
      rate: Math.min(100, Math.round((current / target) * 100)),
      unit: 'days',
      label: `${current} / ${target} days`,
      currentStreak: currentConsecutiveScheduled(habit, start, end),
    }
  }

  if (type === 'days_completed') {
    const { current } = countCompletions(habit, start, end)
    const capped = Math.min(current, target)
    return {
      current: capped,
      target,
      rate: Math.min(100, Math.round((capped / target) * 100)),
      unit: 'days',
      label: `${capped} / ${target} days`,
    }
  }

  // completion_percentage
  let rate = 0
  if (habit && !habit.archived) {
    const { current, scheduled } = countCompletions(habit, start, end)
    rate = scheduled ? Math.round((current / scheduled) * 100) : 0
  } else {
    const stats = getPeriodOccurrenceStats(habits, start, end)
    rate = stats.rate
  }
  const met = rate >= target
  return {
    current: rate,
    target,
    rate: Math.min(100, Math.round((Math.min(rate, target) / target) * 100)),
    actualRate: rate,
    unit: '%',
    label: `${rate}% / ${target}%`,
    met,
  }
}

function unitForType(type) {
  if (type === 'completion_percentage') return '%'
  if (type === 'completion_count') return 'times'
  return 'days'
}

export function getGoalStatus(detail, goal, today = new Date()) {
  if (goal.archived) return 'archived'
  const todayKey = toDateKey(today)
  const endKey = goal.endDate || todayKey
  const startKey = goal.startDate || todayKey
  const rate = detail?.rate || 0
  const current = detail?.current || 0
  const type = goal.targetType || 'completion_count'

  const isComplete =
    Boolean(goal.completedAt) ||
    rate >= 100 ||
    (type === 'completion_percentage' && detail?.met && todayKey >= endKey)

  if (isComplete) return 'completed'
  if (todayKey > endKey) return 'overdue'
  if (current === 0 && todayKey < startKey) return 'not_started'
  if (current === 0) return 'not_started'
  return 'in_progress'
}

export function enrichGoal(goal, habits, asOf = new Date()) {
  const progress = getGoalProgressDetail(goal, habits, asOf)
  const status = getGoalStatus(progress, goal, asOf)
  return { ...goal, progress, status }
}

export function syncGoalCompletion(goal, habits, asOf = new Date()) {
  const progress = getGoalProgressDetail(goal, habits, asOf)
  const type = goal.targetType || 'completion_count'
  const todayKey = toDateKey(asOf)
  const endKey = goal.endDate || todayKey

  const shouldComplete =
    progress.rate >= 100 ||
    (type === 'completion_percentage' &&
      progress.met &&
      todayKey >= endKey)

  if (shouldComplete) {
    if (goal.completedAt) return goal
    return { ...goal, completedAt: todayKey }
  }

  if (goal.completedAt && progress.rate < 100 && !progress.met) {
    return { ...goal, completedAt: null }
  }

  return goal
}

export function syncAllGoalsCompletion(goals, habits, asOf = new Date()) {
  return (goals || []).map((g) => syncGoalCompletion(g, habits, asOf))
}

export function getGoalsSummary(goals, habits, asOf = new Date()) {
  const list = (goals || []).filter((g) => !g.archived)
  let active = 0
  let completed = 0
  let notStarted = 0
  let overdue = 0

  list.forEach((goal) => {
    const enriched = enrichGoal(goal, habits, asOf)
    if (enriched.status === 'completed') completed += 1
    else if (enriched.status === 'overdue') overdue += 1
    else if (enriched.status === 'not_started') notStarted += 1
    else active += 1
  })

  const total = list.length
  const completionRate = total
    ? Math.round((completed / total) * 100)
    : 0

  return {
    total,
    active,
    completed,
    notStarted,
    overdue,
    completionRate,
  }
}

export function getGoalCompletionTrend(goals, habits, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  if (isAfter(from, to)) return []

  const list = (goals || []).filter((g) => !g.archived)

  return eachDayOfInterval({ start: from, end: to }).map((day) => {
    if (isFutureDate(day)) {
      return {
        date: day,
        dateKey: toDateKey(day),
        label: format(day, 'MMM d'),
        value: 0,
        isFuture: true,
      }
    }

    const eligible = list.filter((g) => {
      const startKey = g.startDate || toDateKey(day)
      return toDateKey(day) >= startKey
    })

    if (!eligible.length) {
      return {
        date: day,
        dateKey: toDateKey(day),
        label: format(day, 'MMM d'),
        value: 0,
        isFuture: false,
      }
    }

    const sum = eligible.reduce((acc, goal) => {
      return acc + getGoalProgressDetail(goal, habits, day).rate
    }, 0)

    return {
      date: day,
      dateKey: toDateKey(day),
      label: format(day, 'MMM d'),
      value: Math.round(sum / eligible.length),
      isFuture: false,
    }
  })
}

export function filterAndSortGoals(
  goals,
  habits,
  { tab = 'all', sort = 'newest' } = {},
  asOf = new Date()
) {
  const enriched = (goals || [])
    .filter((g) => !g.archived)
    .map((g) => enrichGoal(g, habits, asOf))

  let filtered = enriched
  if (tab === 'active') {
    filtered = enriched.filter(
      (g) => g.status === 'in_progress' || g.status === 'not_started' || g.status === 'overdue'
    )
  } else if (tab === 'completed') {
    filtered = enriched.filter((g) => g.status === 'completed')
  }

  const sorted = [...filtered]
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      break
    case 'highest':
      sorted.sort((a, b) => b.progress.rate - a.progress.rate)
      break
    case 'lowest':
      sorted.sort((a, b) => a.progress.rate - b.progress.rate)
      break
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'newest':
    default:
      sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      break
  }

  return sorted
}

export const ACHIEVEMENT_DEFS = [
  {
    id: 'first_goal_completed',
    title: 'First Goal Completed',
    body: 'You finished your first habit goal!',
    icon: 'trophy',
    test: ({ summary }) => summary.completed >= 1,
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    body: "You've stayed consistent for 7 days!",
    icon: 'flame',
    test: ({ streakDays, longestStreak }) =>
      streakDays >= 7 || longestStreak >= 7,
  },
  {
    id: 'streak_12',
    title: '12-Day Streak',
    body: "You've stayed consistent for 12 days!",
    icon: 'flame',
    test: ({ streakDays, longestStreak }) =>
      streakDays >= 12 || longestStreak >= 12,
  },
  {
    id: 'streak_15',
    title: '15-Day Streak',
    body: "You've stayed consistent for 15 days!",
    icon: 'flame',
    test: ({ streakDays, longestStreak }) =>
      streakDays >= 15 || longestStreak >= 15,
  },
  {
    id: 'streak_30',
    title: '30-Day Streak',
    body: "You've stayed consistent for 30 days!",
    icon: 'flame',
    test: ({ streakDays, longestStreak }) =>
      streakDays >= 30 || longestStreak >= 30,
  },
  {
    id: 'five_goals_completed',
    title: 'Five Goals Completed',
    body: 'Five goals down — keep building!',
    icon: 'trophy',
    test: ({ summary }) => summary.completed >= 5,
  },
  {
    id: 'completion_milestone_50',
    title: 'Goal Completion Milestone',
    body: 'You reached 50% overall goal completion.',
    icon: 'target',
    test: ({ summary }) => summary.completionRate >= 50 && summary.total > 0,
  },
  {
    id: 'personal_best_streak',
    title: 'Personal Best Streak',
    body: 'Your current streak matches your personal best!',
    icon: 'flame',
    test: ({ streakDays, longestStreak }) =>
      streakDays > 0 && streakDays >= longestStreak && longestStreak >= 3,
  },
]

export function evaluateAchievements({
  streakDays,
  longestStreak,
  goals,
  habits,
  unlocked = [],
  asOf = new Date(),
}) {
  const unlockedIds = new Set((unlocked || []).map((u) => u.id))
  const summary = getGoalsSummary(goals, habits, asOf)
  const ctx = { streakDays, longestStreak, summary, goals, habits }
  const todayKey = toDateKey(asOf)
  const newly = []

  ACHIEVEMENT_DEFS.forEach((def) => {
    if (unlockedIds.has(def.id)) return
    if (!def.test(ctx)) return
    newly.push({
      id: def.id,
      title: def.title,
      body: def.body,
      icon: def.icon,
      unlockedAt: todayKey,
    })
  })

  return newly
}

export function getLatestAchievement(unlocked = []) {
  if (!unlocked?.length) return null
  return [...unlocked].sort((a, b) =>
    (b.unlockedAt || '').localeCompare(a.unlockedAt || '')
  )[0]
}

export function normalizeGoal(goal, today = new Date()) {
  const todayKey = toDateKey(today)
  const targetType = GOAL_TARGET_TYPES.some((t) => t.id === goal.targetType)
    ? goal.targetType
    : 'completion_count'
  return {
    id: goal.id || `g-${Date.now()}`,
    name: (goal.name || 'Untitled Goal').trim(),
    description: goal.description || '',
    category: GOAL_CATEGORIES.includes(goal.category)
      ? goal.category
      : 'Health',
    icon: goal.icon || '',
    linkedHabitId: goal.linkedHabitId || null,
    targetType,
    targetValue: Math.max(1, Number(goal.targetValue) || 1),
    startDate: goal.startDate || todayKey,
    endDate: goal.endDate || todayKey,
    createdAt: goal.createdAt || todayKey,
    notes: goal.notes || '',
    archived: Boolean(goal.archived),
    completedAt: goal.completedAt || null,
  }
}
