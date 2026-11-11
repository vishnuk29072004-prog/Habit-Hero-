/**
 * Map FastAPI journal schemas ↔ Journal UI (camelCase).
 */

export function mapJournalEntryFromApi(row) {
  if (!row) return null
  return {
    id: row.id,
    date: row.date,
    habitId: row.habit_id || null,
    title: row.title || '',
    content: row.content || '',
    mood: row.mood || 'neutral',
    tags: Array.isArray(row.tags) ? [...row.tags] : [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }
}

export function toJournalCreatePayload(payload) {
  const body = {
    date: payload.date,
    title: (payload.title || '').trim(),
    content: (payload.content || '').trim(),
    mood: payload.mood || 'neutral',
    tags: Array.isArray(payload.tags) ? [...new Set(payload.tags)] : [],
  }
  if (payload.habitId) {
    body.habit_id = payload.habitId
  }
  return body
}

export function toJournalUpdatePayload(patch) {
  if (!patch || typeof patch !== 'object') return {}
  const body = {}
  if (patch.date != null) body.date = patch.date
  if (patch.title != null) body.title = String(patch.title).trim()
  if (patch.content != null) body.content = String(patch.content).trim()
  if (patch.mood != null) body.mood = patch.mood
  if (Array.isArray(patch.tags)) {
    body.tags = [...new Set(patch.tags)]
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'habitId')) {
    if (patch.habitId) {
      body.habit_id = patch.habitId
    } else {
      body.clear_habit = true
    }
  }
  return body
}

export function mapJournalSummaryFromApi(data) {
  if (!data) {
    return {
      totalEntries: 0,
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      overview: {
        period: 'thisMonth',
        startDate: '',
        endDate: '',
        journaledDays: 0,
        missedDays: 0,
        totalDays: 0,
        rate: 0,
      },
      moodBreakdown: [],
      tagBreakdown: [],
      recentDates: [],
      moods: [],
      tags: [],
    }
  }

  const overview = data.overview || {}
  return {
    totalEntries: data.total_entries ?? 0,
    activeDays: data.active_days ?? 0,
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    overview: {
      period: overview.period || 'thisMonth',
      startDate: overview.start_date || '',
      endDate: overview.end_date || '',
      journaledDays: overview.journaled_days ?? 0,
      missedDays: overview.missed_days ?? 0,
      totalDays: overview.total_days ?? 0,
      rate: overview.rate ?? 0,
    },
    moodBreakdown: Array.isArray(data.mood_breakdown)
      ? data.mood_breakdown.map((m) => ({
          mood: m.mood,
          count: m.count ?? 0,
        }))
      : [],
    tagBreakdown: Array.isArray(data.tag_breakdown)
      ? data.tag_breakdown.map((t) => ({
          tag: t.tag,
          count: t.count ?? 0,
        }))
      : [],
    recentDates: Array.isArray(data.recent_dates)
      ? data.recent_dates.map((d) => ({
          date: d.date,
          count: d.count ?? 0,
        }))
      : [],
    moods: Array.isArray(data.moods) ? data.moods : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
  }
}

/** Build GET /journal query params from JournalHistory filters. */
export function toJournalListParams(filters = {}, { page = 1, pageSize = 20 } = {}) {
  const params = {
    page,
    page_size: pageSize,
    sort: filters.sort === 'oldest' ? 'oldest' : 'newest',
  }
  if (filters.query?.trim()) params.search = filters.query.trim()
  if (filters.startDate) params.start_date = filters.startDate
  if (filters.endDate) params.end_date = filters.endDate
  if (filters.mood && filters.mood !== 'all') params.mood = filters.mood
  if (filters.tag && filters.tag !== 'all') params.tag = filters.tag
  if (filters.habitId && filters.habitId !== 'all') {
    params.habit_id = filters.habitId
  }
  return params
}

export default {
  mapJournalEntryFromApi,
  toJournalCreatePayload,
  toJournalUpdatePayload,
  mapJournalSummaryFromApi,
  toJournalListParams,
}
