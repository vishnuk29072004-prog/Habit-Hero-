/**
 * Habit Hero API layer (Step B+).
 * Auth / profile / habits contexts consume these modules.
 */

export {
  apiClient,
  getApiBaseUrl,
  apiGet,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  apiPostForm,
  apiGetBlob,
} from './apiClient'

export { ApiError, isApiError, toApiError } from './apiError'

export {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  setOnTokensCleared,
  hydrateTokensFromSession,
} from './tokenStore'

export { authApi } from './authApi'
export { userApi } from './userApi'
export { habitApi } from './habitApi'
export {
  mapHabitFromApi,
  toHabitCreatePayload,
  toHabitUpdatePayload,
} from './habitMappers'
export {
  mapCheckinFromApi,
  mapCheckinsListToNested,
  toCheckinCreatePayload,
  toCheckinUpdatePayload,
} from './checkinMappers'
export {
  mapDaySummaryToUiStatus,
  indexMonthlyDays,
  mapDailyHabitsFromApi,
  mapDailySummaryFromApi,
  mapMonthlyStatisticsFromApi,
  mapBestWeekdayFromMonthly,
} from './calendarMappers'
export { analyticsApi } from './analyticsApi'
export { calendarApi } from './calendarApi'
export {
  mapGoalFromApi,
  toGoalCreatePayload,
  toGoalUpdatePayload,
  mapGoalSummaryFromApi,
  filterAndSortApiGoals,
  getGoalStatusTrendFromApi,
} from './goalMappers'
export {
  mapAchievementFromApi,
  mapCatalogueItemFromApi,
  mapAchievementSummaryFromApi,
} from './achievementMappers'
export { goalApi } from './goalApi'
export { achievementApi } from './achievementApi'
export { journalApi } from './journalApi'
export {
  mapJournalEntryFromApi,
  toJournalCreatePayload,
  toJournalUpdatePayload,
  mapJournalSummaryFromApi,
  toJournalListParams,
} from './journalMappers'
export { notificationApi } from './notificationApi'
export { aiApi } from './aiApi'
export {
  mapHabitSuggestionFromApi,
  mapHabitSuggestionsResponse,
  suggestionToHabitPayload,
  toMoodAnalysisPayload,
  mapMoodAnalysisFromApi,
} from './aiMappers'
export { reportApi, toProgressPdfParams } from './reportApi'
export { googleCalendarApi } from './googleCalendarApi'
export {
  formatNotificationTime,
  mapNotificationFromApi,
  mapNotificationListFromApi,
  mapNotificationSummaryFromApi,
} from './notificationMappers'
