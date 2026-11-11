/**
 * Map FastAPI goal schemas ↔ Goals UI (camelCase + progress/status from API).
 */

import {
  eachDayOfInterval,
  format,
  isAfter,
  startOfDay,
} from 'date-fns'
import { isFutureDate, toDateKey } from '../../utils/dateUtils'

export function mapGoalFromApi(apiGoal) {
  if (!apiGoal) return null
  const progress = apiGoal.progress || {}
  return {
    id: apiGoal.id,
    name: apiGoal.name,
    description: apiGoal.description || '',
    category: apiGoal.category,
    icon: apiGoal.icon || 'target',
    linkedHabitId: apiGoal.linked_habit_id || null,
    targetType: apiGoal.target_type,
    targetValue: apiGoal.target_value,
    startDate: apiGoal.start_date,
    endDate: apiGoal.end_date,
    createdAt: apiGoal.created_at
      ? String(apiGoal.created_at).slice(0, 10)
      : apiGoal.start_date,
    notes: apiGoal.notes || '',
    archived: Boolean(apiGoal.archived),
    completedAt: apiGoal.completed_at
      ? String(apiGoal.completed_at).slice(0, 10)
      : null,
    updatedAt: apiGoal.updated_at,
    status: apiGoal.status,
    progress: {
      current: progress.current ?? 0,
      target: progress.target ?? apiGoal.target_value ?? 0,
      rate: progress.rate ?? 0,
      unit: progress.unit || '',
      label: progress.label || '0 / 0',
      met: progress.met,
      actualRate: progress.actual_rate,
      currentStreak: progress.current_streak,
    },
  }
}

export function toGoalCreatePayload(payload) {
  const body = {
    name: (payload.name || '').trim(),
    description: (payload.description || '').trim(),
    category: payload.category || 'Health',
    icon: payload.icon || 'target',
    target_type: payload.targetType || 'completion_count',
    target_value: Math.max(1, Number(payload.targetValue) || 1),
    start_date: payload.startDate,
    end_date: payload.endDate,
    notes: (payload.notes || '').trim(),
  }
  if (payload.linkedHabitId) {
    body.linked_habit_id = payload.linkedHabitId
  }
  return body
}

export function toGoalUpdatePayload(patch) {
  if (!patch || typeof patch !== 'object') return {}
  const body = {}
  if (patch.name != null) body.name = String(patch.name).trim()
  if (patch.description != null) {
    body.description = String(patch.description).trim()
  }
  if (patch.category != null) body.category = patch.category
  if (patch.icon != null) body.icon = patch.icon
  if (patch.targetType != null) body.target_type = patch.targetType
  if (patch.targetValue != null) {
    body.target_value = Math.max(1, Number(patch.targetValue) || 1)
  }
  if (patch.startDate != null) body.start_date = patch.startDate
  if (patch.endDate != null) body.end_date = patch.endDate
  if (patch.notes != null) body.notes = String(patch.notes).trim()
  if (patch.archived != null) body.archived = Boolean(patch.archived)

  if (Object.prototype.hasOwnProperty.call(patch, 'linkedHabitId')) {
    if (patch.linkedHabitId) {
      body.linked_habit_id = patch.linkedHabitId
    } else {
      body.clear_linked_habit = true
    }
  }
  return body
}

export function mapGoalSummaryFromApi(data) {
  if (!data) {
    return {
      total: 0,
      active: 0,
      completed: 0,
      notStarted: 0,
      overdue: 0,
      completionRate: 0,
      goals: [],
    }
  }
  return {
    total: data.total ?? 0,
    active: data.active ?? 0,
    completed: data.completed ?? 0,
    notStarted: data.not_started ?? 0,
    overdue: data.overdue ?? 0,
    completionRate: data.completion_rate ?? 0,
    goals: Array.isArray(data.goals)
      ? data.goals.map(mapGoalFromApi).filter(Boolean)
      : [],
  }
}

/**
 * Filter/sort using backend status + progress (no client recalculation).
 */
export function filterAndSortApiGoals(
  goals,
  { tab = 'all', sort = 'newest' } = {}
) {
  const list = (goals || []).filter((g) => !g.archived)

  let filtered = list
  if (tab === 'active') {
    filtered = list.filter(
      (g) =>
        g.status === 'in_progress' ||
        g.status === 'not_started' ||
        g.status === 'overdue'
    )
  } else if (tab === 'completed') {
    filtered = list.filter((g) => g.status === 'completed')
  }

  const sorted = [...filtered]
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      break
    case 'highest':
      sorted.sort((a, b) => (b.progress?.rate || 0) - (a.progress?.rate || 0))
      break
    case 'lowest':
      sorted.sort((a, b) => (a.progress?.rate || 0) - (b.progress?.rate || 0))
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

/**
 * Chart points from backend fields only (completed_at / window), not progress math.
 */
export function getGoalStatusTrendFromApi(goals, start, end) {
  const from = startOfDay(start)
  const to = startOfDay(end)
  if (isAfter(from, to)) return []

  const list = (goals || []).filter((g) => !g.archived)

  return eachDayOfInterval({ start: from, end: to }).map((day) => {
    const key = toDateKey(day)
    if (isFutureDate(day)) {
      return {
        date: day,
        dateKey: key,
        label: format(day, 'MMM d'),
        value: 0,
        isFuture: true,
      }
    }

    const eligible = list.filter((g) => (g.startDate || key) <= key)
    if (!eligible.length) {
      return {
        date: day,
        dateKey: key,
        label: format(day, 'MMM d'),
        value: 0,
        isFuture: false,
      }
    }

    const completed = eligible.filter((g) => {
      if (g.status === 'completed' || g.completedAt) {
        return (g.completedAt || g.endDate || key) <= key
      }
      return false
    }).length

    return {
      date: day,
      dateKey: key,
      label: format(day, 'MMM d'),
      value: Math.round((completed / eligible.length) * 100),
      isFuture: false,
    }
  })
}

export default {
  mapGoalFromApi,
  toGoalCreatePayload,
  toGoalUpdatePayload,
  mapGoalSummaryFromApi,
  filterAndSortApiGoals,
  getGoalStatusTrendFromApi,
}
