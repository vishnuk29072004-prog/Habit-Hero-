/**
 * Map AI habit suggestion API payloads ↔ UI.
 */

export function mapHabitSuggestionFromApi(row) {
  if (!row) return null
  return {
    name: row.name || '',
    description: row.description || '',
    category: row.category || 'Health',
    frequency: row.frequency === 'Weekly' ? 'Weekly' : 'Daily',
    reason: row.reason || '',
    recommendedStartDate: row.recommended_start_date || '',
  }
}

export function mapHabitSuggestionsResponse(data) {
  const items = Array.isArray(data?.suggestions) ? data.suggestions : []
  return {
    suggestions: items.map(mapHabitSuggestionFromApi).filter(Boolean),
    count: data?.count ?? items.length,
  }
}

/** Map a suggestion into HabitContext.addHabit / HabitForm shape. */
export function suggestionToHabitPayload(suggestion) {
  return {
    name: suggestion.name,
    description: suggestion.description || '',
    category: suggestion.category || 'Health',
    frequency: suggestion.frequency === 'Weekly' ? 'Weekly' : 'Daily',
    startDate: suggestion.recommendedStartDate,
    notes: '',
    icon: 'sparkles',
  }
}

function asStringList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

/** Validate / normalize mood-analysis request dates for UI + smoke tests. */
export function toMoodAnalysisPayload({ startDate, endDate } = {}) {
  const start_date = String(startDate || '').trim()
  const end_date = String(endDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    throw new Error('startDate must be YYYY-MM-DD')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    throw new Error('endDate must be YYYY-MM-DD')
  }
  if (end_date < start_date) {
    throw new Error('endDate must not precede startDate')
  }
  return { start_date, end_date }
}

export function mapMoodAnalysisFromApi(data) {
  if (!data) return null
  const patterns = data.mood_patterns || {}
  return {
    overallMood: data.overall_mood || '',
    moodSummary: data.mood_summary || '',
    moodPatterns: {
      positive: asStringList(patterns.positive),
      challenging: asStringList(patterns.challenging),
    },
    motivationPatterns: asStringList(data.motivation_patterns),
    positiveObservations: asStringList(data.positive_observations),
    areasToImprove: asStringList(data.areas_to_improve),
    recommendations: asStringList(data.recommendations),
    summary: data.summary || '',
    entriesAnalyzed: data.entries_analyzed ?? 0,
    analysisPeriod: {
      startDate: data.analysis_period?.start_date || '',
      endDate: data.analysis_period?.end_date || '',
    },
  }
}

export default {
  mapHabitSuggestionFromApi,
  mapHabitSuggestionsResponse,
  suggestionToHabitPayload,
  toMoodAnalysisPayload,
  mapMoodAnalysisFromApi,
}
