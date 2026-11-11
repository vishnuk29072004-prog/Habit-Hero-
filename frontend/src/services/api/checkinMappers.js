/**
 * Map FastAPI check-in schemas ↔ nested UI checkins shape.
 *
 * Backend: { id, habit_id, date, status: 'completed'|'incomplete', notes }
 * Frontend: habit.checkins[dateKey] = { id, completed: boolean, notes }
 */

export function mapCheckinFromApi(apiCheckin) {
  if (!apiCheckin) return null
  return {
    id: apiCheckin.id,
    completed: apiCheckin.status === 'completed',
    notes: apiCheckin.notes || '',
    status: apiCheckin.status,
  }
}

/** @param {Array<object>} items */
export function mapCheckinsListToNested(items) {
  const nested = {}
  if (!Array.isArray(items)) return nested
  for (const item of items) {
    if (!item?.date) continue
    nested[item.date] = mapCheckinFromApi(item)
  }
  return nested
}

export function toCheckinCreatePayload({ date, completed = true, notes = '' }) {
  return {
    date,
    status: completed ? 'completed' : 'incomplete',
    notes: notes || '',
  }
}

export function toCheckinUpdatePayload({ completed, notes }) {
  const body = {}
  if (typeof completed === 'boolean') {
    body.status = completed ? 'completed' : 'incomplete'
  }
  if (notes != null) body.notes = String(notes)
  return body
}

export default {
  mapCheckinFromApi,
  mapCheckinsListToNested,
  toCheckinCreatePayload,
  toCheckinUpdatePayload,
}
