/**
 * Map FastAPI habit schemas ↔ Habit Management UI (camelCase).
 *
 * Backend: start_date, week_day (Sun=0…Sat=6), is_archived
 * Frontend: startDate, weekDay, archived + nested checkins (Step F)
 */

import { getDay, startOfDay } from 'date-fns'
import { normalizeHabit } from '../../data/mockData'

/**
 * @param {object} apiHabit - HabitResponse
 * @param {Record<string, { completed?: boolean, notes?: string }>|undefined} checkins
 */
export function mapHabitFromApi(apiHabit, checkins = {}) {
  if (!apiHabit) return null

  return normalizeHabit({
    id: apiHabit.id,
    name: apiHabit.name,
    description: apiHabit.description ?? '',
    notes: apiHabit.notes ?? '',
    icon: apiHabit.icon || 'sparkles',
    category: apiHabit.category,
    frequency: apiHabit.frequency === 'Weekly' ? 'Weekly' : 'Daily',
    startDate: apiHabit.start_date,
    createdAt: apiHabit.created_at
      ? String(apiHabit.created_at).slice(0, 10)
      : apiHabit.start_date,
    archived: Boolean(apiHabit.is_archived),
    weekDay:
      typeof apiHabit.week_day === 'number' ? apiHabit.week_day : undefined,
    checkins: checkins && typeof checkins === 'object' ? checkins : {},
  })
}

/**
 * Build POST /habits body from HabitForm / addHabit payload.
 * Weekly week_day: explicit weekDay, else date-fns getDay(startDate) (Sun=0).
 */
export function toHabitCreatePayload(payload, fallbackStartDate) {
  const startDate = payload.startDate || fallbackStartDate
  const frequency = payload.frequency === 'Weekly' ? 'Weekly' : 'Daily'

  const body = {
    name: (payload.name || '').trim(),
    description: (payload.description || '').trim(),
    notes: (payload.notes || '').trim(),
    icon: payload.icon || 'sparkles',
    category: payload.category || 'Health',
    frequency,
    start_date: startDate,
  }

  if (frequency === 'Weekly') {
    body.week_day =
      typeof payload.weekDay === 'number'
        ? payload.weekDay
        : getDay(startOfDay(new Date(startDate)))
  }

  return body
}

/**
 * Build PATCH /habits/{id} body from a partial frontend patch.
 * Only includes defined fields.
 */
export function toHabitUpdatePayload(patch) {
  if (!patch || typeof patch !== 'object') return {}

  const body = {}

  if (patch.name != null) body.name = String(patch.name).trim()
  if (patch.description != null) {
    body.description = String(patch.description).trim()
  }
  if (patch.notes != null) body.notes = String(patch.notes).trim()
  if (patch.icon != null) body.icon = patch.icon
  if (patch.category != null) body.category = patch.category
  if (patch.frequency != null) {
    body.frequency = patch.frequency === 'Weekly' ? 'Weekly' : 'Daily'
  }
  if (patch.startDate != null) body.start_date = patch.startDate
  if (typeof patch.weekDay === 'number') body.week_day = patch.weekDay

  // When switching to Weekly without weekDay, derive from startDate if present.
  if (body.frequency === 'Weekly' && body.week_day == null) {
    const start = body.start_date || patch.startDate
    if (start) {
      body.week_day = getDay(startOfDay(new Date(start)))
    }
  }
  if (body.frequency === 'Daily') {
    body.week_day = null
  }

  return body
}

export default {
  mapHabitFromApi,
  toHabitCreatePayload,
  toHabitUpdatePayload,
}
