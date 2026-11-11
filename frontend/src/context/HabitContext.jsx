import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns'
import {
  STORAGE_KEY,
  completionGrowth,
  nextGoalTarget,
  weeklyConsistencyGrowth,
} from '../data/mockData'
import { isFutureDate, toDateKey } from '../utils/dateUtils'
import {
  getCategoryStats,
  getDayCompletionStats,
  getMonthlyStats,
  getScheduledHabits,
  getTrendData,
  getWeeklyConsistency,
  getWeeklyProgress,
} from '../utils/habitCalculations'
import {
  getCurrentStreak,
  getGoalProgress,
  getLongestStreak,
} from '../utils/streakCalculations'
import { useAuth } from './AuthContext'
import { habitApi } from '../services/api/habitApi'
import { calendarApi } from '../services/api/calendarApi'
import { goalApi } from '../services/api/goalApi'
import { achievementApi } from '../services/api/achievementApi'
import { journalApi } from '../services/api/journalApi'
import { notificationApi } from '../services/api/notificationApi'
import {
  mapHabitFromApi,
  toHabitCreatePayload,
  toHabitUpdatePayload,
} from '../services/api/habitMappers'
import {
  mapCheckinFromApi,
  mapCheckinsListToNested,
  toCheckinCreatePayload,
  toCheckinUpdatePayload,
} from '../services/api/checkinMappers'
import {
  mapGoalFromApi,
  mapGoalSummaryFromApi,
  toGoalCreatePayload,
  toGoalUpdatePayload,
} from '../services/api/goalMappers'
import { mapAchievementSummaryFromApi } from '../services/api/achievementMappers'
import {
  mapJournalEntryFromApi,
  mapJournalSummaryFromApi,
  toJournalCreatePayload,
  toJournalListParams,
  toJournalUpdatePayload,
} from '../services/api/journalMappers'
import {
  mapNotificationFromApi,
  mapNotificationListFromApi,
  mapNotificationSummaryFromApi,
} from '../services/api/notificationMappers'

const NOTIFICATION_PAGE_SIZE = 20
const NOTIFICATION_REFRESH_COOLDOWN_MS = 60_000

const HabitContext = createContext(null)

/**
 * Load non-API domain state from localStorage.
 * Domain data is API-backed (E–I). Legacy blob keys preserved, not source of truth.
 */
const loadState = () => {
  const fallback = {
    selectedDate: startOfDay(new Date()),
    goalTarget: nextGoalTarget,
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw)
    return {
      selectedDate: parsed.selectedDate
        ? startOfDay(new Date(parsed.selectedDate))
        : startOfDay(new Date()),
      goalTarget: parsed.goalTarget || nextGoalTarget,
    }
  } catch {
    return fallback
  }
}

/**
 * Persist UI prefs only. Preserve legacy domain keys (including journalEntries).
 */
function persistDomainState(fields) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let prev = {}
    if (raw) {
      try {
        prev = JSON.parse(raw) || {}
      } catch {
        prev = {}
      }
    }

    const next = {
      ...prev,
      selectedDate: fields.selectedDate,
      goalTarget: fields.goalTarget,
    }

    if (Object.prototype.hasOwnProperty.call(prev, 'habits')) {
      next.habits = prev.habits
    }
    if (Object.prototype.hasOwnProperty.call(prev, 'dayNotes')) {
      next.dayNotes = prev.dayNotes
    }
    if (Object.prototype.hasOwnProperty.call(prev, 'goals')) {
      next.goals = prev.goals
    }
    if (Object.prototype.hasOwnProperty.call(prev, 'unlockedAchievements')) {
      next.unlockedAchievements = prev.unlockedAchievements
    }
    if (Object.prototype.hasOwnProperty.call(prev, 'journalEntries')) {
      next.journalEntries = prev.journalEntries
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

async function fetchAllJournalFromApi(extraParams = {}) {
  const pageSize = 100
  let page = 1
  let total = Infinity
  const items = []
  while (items.length < total) {
    const response = await journalApi.list({
      ...extraParams,
      page,
      page_size: pageSize,
      sort: extraParams.sort || 'newest',
    })
    const data = response?.data
    const batch = Array.isArray(data?.items) ? data.items : []
    total = typeof data?.total === 'number' ? data.total : batch.length
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
    page += 1
    if (page > 50) break
  }
  return items.map(mapJournalEntryFromApi).filter(Boolean)
}

async function fetchAllGoalsFromApi() {
  const pageSize = 100
  let page = 1
  let total = Infinity
  const items = []
  while (items.length < total) {
    const response = await goalApi.list({
      archived: false,
      page,
      page_size: pageSize,
    })
    const data = response?.data
    const batch = Array.isArray(data?.items) ? data.items : []
    total = typeof data?.total === 'number' ? data.total : batch.length
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
    page += 1
    if (page > 50) break
  }
  return items.map(mapGoalFromApi).filter(Boolean)
}

async function fetchAllHabitsFromApi() {
  const pageSize = 100
  let page = 1
  let total = Infinity
  const items = []

  while (items.length < total) {
    const response = await habitApi.list({
      status: 'all',
      page,
      page_size: pageSize,
    })
    const data = response?.data
    const batch = Array.isArray(data?.items) ? data.items : []
    total = typeof data?.total === 'number' ? data.total : batch.length
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
    page += 1
    if (page > 50) break
  }

  return items
}

async function fetchAllCheckinsForHabit(habitId) {
  const pageSize = 100
  let page = 1
  let total = Infinity
  const items = []

  while (items.length < total) {
    const response = await habitApi.listCheckins(habitId, {
      page,
      page_size: pageSize,
    })
    const data = response?.data
    const batch = Array.isArray(data?.items) ? data.items : []
    total = typeof data?.total === 'number' ? data.total : batch.length
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
    page += 1
    if (page > 50) break
  }

  return mapCheckinsListToNested(items)
}

async function hydrateHabitsWithCheckins(apiHabits) {
  return Promise.all(
    apiHabits.map(async (item) => {
      try {
        const checkins = await fetchAllCheckinsForHabit(item.id)
        return mapHabitFromApi(item, checkins)
      } catch {
        return mapHabitFromApi(item, {})
      }
    })
  )
}

async function loadDayNotesMap() {
  const response = await calendarApi.listNotes()
  const rows = Array.isArray(response?.data) ? response.data : []
  const notes = {}
  const ids = {}
  for (const row of rows) {
    if (!row?.date) continue
    notes[row.date] = row.notes || ''
    ids[row.date] = row.id
  }
  return { notes, ids }
}

function mergeCheckins(prevHabits, apiHabit) {
  const existing = prevHabits.find((h) => h.id === apiHabit.id)
  return existing?.checkins && typeof existing.checkins === 'object'
    ? existing.checkins
    : {}
}

function patchHabitCheckin(habits, habitId, dateKey, entry) {
  return habits.map((habit) => {
    if (habit.id !== habitId) return habit
    const checkins = { ...(habit.checkins || {}) }
    if (entry == null) {
      delete checkins[dateKey]
    } else {
      checkins[dateKey] = entry
    }
    return { ...habit, checkins }
  })
}

export function HabitProvider({ children }) {
  const { user, token, loading: authLoading, isAuthenticated } = useAuth()
  const initial = loadState()
  const [habits, setHabits] = useState([])
  const [habitsLoading, setHabitsLoading] = useState(false)
  const [habitsError, setHabitsError] = useState(null)
  const [selectedDate, setSelectedDateState] = useState(initial.selectedDate)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [goalTarget, setGoalTarget] = useState(initial.goalTarget)
  const [dayNotes, setDayNotes] = useState({})
  const [dayNoteIds, setDayNoteIds] = useState({})
  const [calendarTick, setCalendarTick] = useState(0)
  const [goals, setGoals] = useState([])
  const [goalsSummary, setGoalsSummary] = useState(() =>
    mapGoalSummaryFromApi(null)
  )
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [goalsError, setGoalsError] = useState(null)
  const [unlockedAchievements, setUnlockedAchievements] = useState([])
  const [achievementCatalogue, setAchievementCatalogue] = useState([])
  const [achievementSummary, setAchievementSummary] = useState(null)
  const [journalEntries, setJournalEntries] = useState([])
  const [journalSummary, setJournalSummary] = useState(() =>
    mapJournalSummaryFromApi(null)
  )
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalError, setJournalError] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notificationSummary, setNotificationSummary] = useState(() =>
    mapNotificationSummaryFromApi(null)
  )
  const [notificationTotal, setNotificationTotal] = useState(0)
  const [notificationPage, setNotificationPage] = useState(1)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState(null)
  const habitsRef = useRef(habits)
  const dayNoteIdsRef = useRef(dayNoteIds)
  habitsRef.current = habits
  dayNoteIdsRef.current = dayNoteIds
  const loadGenerationRef = useRef(0)
  const goalsGenRef = useRef(0)
  const journalGenRef = useRef(0)
  const journalSummaryGenRef = useRef(0)
  const notificationsGenRef = useRef(0)
  const lastNotifRefreshAtRef = useRef(0)
  const markingReadIdsRef = useRef(new Set())

  const bumpCalendar = useCallback(() => {
    setCalendarTick((tick) => tick + 1)
  }, [])

  useEffect(() => {
    persistDomainState({
      selectedDate: selectedDate.toISOString(),
      goalTarget,
    })
  }, [selectedDate, goalTarget])

  const clearHabitsState = useCallback(() => {
    setHabits([])
    setHabitsError(null)
    setHabitsLoading(false)
    setDayNotes({})
    setDayNoteIds({})
    setGoals([])
    setGoalsSummary(mapGoalSummaryFromApi(null))
    setGoalsError(null)
    setGoalsLoading(false)
    setUnlockedAchievements([])
    setAchievementCatalogue([])
    setAchievementSummary(null)
    setJournalEntries([])
    setJournalSummary(mapJournalSummaryFromApi(null))
    setJournalError(null)
    setJournalLoading(false)
    setNotifications([])
    setNotificationSummary(mapNotificationSummaryFromApi(null))
    setNotificationTotal(0)
    setNotificationPage(1)
    setNotificationsError(null)
    setNotificationsLoading(false)
    lastNotifRefreshAtRef.current = 0
    markingReadIdsRef.current = new Set()
    bumpCalendar()
  }, [bumpCalendar])

  const refreshJournal = useCallback(async (period = 'thisMonth') => {
    const generation = ++journalGenRef.current
    const summaryGeneration = ++journalSummaryGenRef.current
    setJournalLoading(true)
    setJournalError(null)
    try {
      const [entries, summaryRes] = await Promise.all([
        fetchAllJournalFromApi(),
        journalApi.summary({ period }),
      ])
      if (generation !== journalGenRef.current) return null
      setJournalEntries(entries)
      if (summaryGeneration === journalSummaryGenRef.current) {
        setJournalSummary(mapJournalSummaryFromApi(summaryRes?.data))
      }
      return { entries, summary: summaryRes?.data }
    } catch (err) {
      if (generation !== journalGenRef.current) return null
      setJournalError(err?.message || 'Unable to load journal.')
      throw err
    } finally {
      if (generation === journalGenRef.current) setJournalLoading(false)
    }
  }, [])

  const refreshJournalSummary = useCallback(async (period = 'thisMonth') => {
    const generation = ++journalSummaryGenRef.current
    try {
      const summaryRes = await journalApi.summary({ period })
      if (generation !== journalSummaryGenRef.current) return null
      setJournalSummary(mapJournalSummaryFromApi(summaryRes?.data))
      return summaryRes?.data
    } catch (err) {
      if (generation !== journalSummaryGenRef.current) return null
      setJournalError(err?.message || 'Unable to load journal summary.')
      throw err
    }
  }, [])

  const searchJournalEntries = useCallback(async (filters, page = 1, pageSize = 20) => {
    const params = toJournalListParams(filters, { page, pageSize })
    const response = await journalApi.list(params)
    const data = response?.data
    return {
      items: Array.isArray(data?.items)
        ? data.items.map(mapJournalEntryFromApi).filter(Boolean)
        : [],
      total: data?.total ?? 0,
      page: data?.page ?? page,
      pageSize: data?.page_size ?? pageSize,
    }
  }, [])

  const refreshNotificationSummary = useCallback(async ({ refresh = false } = {}) => {
    const generation = ++notificationsGenRef.current
    try {
      const summaryRes = await notificationApi.summary({ refresh })
      if (generation !== notificationsGenRef.current) return null
      const mapped = mapNotificationSummaryFromApi(summaryRes?.data)
      setNotificationSummary(mapped)
      return mapped
    } catch (err) {
      if (generation !== notificationsGenRef.current) return null
      setNotificationsError(err?.message || 'Unable to load notification summary.')
      throw err
    }
  }, [])

  const loadNotifications = useCallback(
    async ({ page = 1, append = false, forceRefresh = false } = {}) => {
      const generation = ++notificationsGenRef.current
      setNotificationsLoading(true)
      setNotificationsError(null)
      const now = Date.now()
      // Never regenerate while appending pages — avoids duplicates mid-pagination.
      const shouldRefresh =
        !append &&
        (forceRefresh ||
          now - lastNotifRefreshAtRef.current >= NOTIFICATION_REFRESH_COOLDOWN_MS)
      if (shouldRefresh) {
        lastNotifRefreshAtRef.current = now
      }
      try {
        const response = await notificationApi.list({
          refresh: shouldRefresh,
          page,
          page_size: NOTIFICATION_PAGE_SIZE,
        })
        if (generation !== notificationsGenRef.current) return null
        const mapped = mapNotificationListFromApi(response?.data)
        setNotifications((prev) =>
          append ? [...prev, ...mapped.items] : mapped.items
        )
        setNotificationTotal(mapped.total)
        setNotificationPage(mapped.page)
        setNotificationSummary({
          total: mapped.total,
          unread: mapped.unread,
        })
        return mapped
      } catch (err) {
        if (generation !== notificationsGenRef.current) return null
        setNotificationsError(
          err?.message || 'Unable to load notifications.'
        )
        throw err
      } finally {
        if (generation === notificationsGenRef.current) {
          setNotificationsLoading(false)
        }
      }
    },
    []
  )

  const markNotificationRead = useCallback(async (id) => {
    if (!id || markingReadIdsRef.current.has(id)) return null
    markingReadIdsRef.current.add(id)
    try {
      const response = await notificationApi.markRead(id)
      const mapped = mapNotificationFromApi(response?.data)
      if (!mapped) throw new Error('Mark-read returned no data.')
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? mapped : item))
      )
      setNotificationSummary((prev) => ({
        ...prev,
        unread: Math.max(0, (prev.unread || 0) - (mapped.unread ? 0 : 1)),
      }))
      // Reconcile unread from server without regenerating.
      try {
        const summaryRes = await notificationApi.summary({ refresh: false })
        setNotificationSummary(mapNotificationSummaryFromApi(summaryRes?.data))
      } catch {
        // Local unread already adjusted.
      }
      return mapped
    } finally {
      markingReadIdsRef.current.delete(id)
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    const response = await notificationApi.markAllRead()
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false, readAt: item.readAt || new Date().toISOString() }))
    )
    setNotificationSummary((prev) => ({ ...prev, unread: 0 }))
    try {
      const summaryRes = await notificationApi.summary({ refresh: false })
      setNotificationSummary(mapNotificationSummaryFromApi(summaryRes?.data))
    } catch {
      // Local unread already cleared.
    }
    return response?.data
  }, [])

  const deleteNotification = useCallback(async (id) => {
    if (!id) return false
    const target = notifications.find((item) => item.id === id)
    const wasUnread = Boolean(target?.unread)
    await notificationApi.remove(id)
    setNotifications((prev) => prev.filter((item) => item.id !== id))
    setNotificationTotal((prev) => Math.max(0, prev - 1))
    setNotificationSummary((prev) => ({
      total: Math.max(0, (prev.total || 0) - 1),
      unread: Math.max(0, (prev.unread || 0) - (wasUnread ? 1 : 0)),
    }))
    try {
      const summaryRes = await notificationApi.summary({ refresh: false })
      setNotificationSummary(mapNotificationSummaryFromApi(summaryRes?.data))
    } catch {
      // Local counts already adjusted.
    }
    return true
  }, [notifications])

  const refreshGoalsAndAchievements = useCallback(async () => {
    const generation = ++goalsGenRef.current
    setGoalsLoading(true)
    setGoalsError(null)
    try {
      const [goalItems, summaryRes, achievementRes] = await Promise.all([
        fetchAllGoalsFromApi(),
        goalApi.summary(),
        achievementApi.summary(),
      ])
      if (generation !== goalsGenRef.current) return null
      setGoals(goalItems)
      setGoalsSummary(mapGoalSummaryFromApi(summaryRes?.data))
      const mappedAchievements = mapAchievementSummaryFromApi(
        achievementRes?.data
      )
      setUnlockedAchievements(mappedAchievements.unlocked)
      setAchievementCatalogue(mappedAchievements.catalogue)
      setAchievementSummary(mappedAchievements)
      return { goals: goalItems, summary: summaryRes?.data }
    } catch (err) {
      if (generation !== goalsGenRef.current) return null
      setGoalsError(err?.message || 'Unable to load goals.')
      throw err
    } finally {
      if (generation === goalsGenRef.current) setGoalsLoading(false)
    }
  }, [])

  const refreshHabits = useCallback(async () => {
    setHabitsLoading(true)
    setHabitsError(null)
    try {
      const responseItems = await fetchAllHabitsFromApi()
      const hydrated = await hydrateHabitsWithCheckins(responseItems)
      setHabits(hydrated)
      bumpCalendar()
      return hydrated
    } catch (err) {
      setHabitsError(
        err?.message || 'Unable to load habits. Please try again.'
      )
      throw err
    } finally {
      setHabitsLoading(false)
    }
  }, [bumpCalendar])

  // Load habits + check-ins + day notes after auth; clear on logout / switch.
  useEffect(() => {
    if (authLoading) return

    const generation = ++loadGenerationRef.current

    if (!isAuthenticated || !user?.id || !token) {
      clearHabitsState()
      return
    }

    let cancelled = false
    setHabitsLoading(true)
    setHabitsError(null)
    setHabits([])
    setDayNotes({})
    setDayNoteIds({})
    setGoals([])
    setUnlockedAchievements([])
    setAchievementCatalogue([])
    setJournalEntries([])
    setJournalSummary(mapJournalSummaryFromApi(null))
    setNotifications([])
    setNotificationSummary(mapNotificationSummaryFromApi(null))
    setNotificationTotal(0)
    setNotificationPage(1)

    ;(async () => {
      try {
        const items = await fetchAllHabitsFromApi()
        if (cancelled || generation !== loadGenerationRef.current) return
        const hydrated = await hydrateHabitsWithCheckins(items)
        if (cancelled || generation !== loadGenerationRef.current) return
        setHabits(hydrated)
        setHabitsError(null)
        try {
          const { notes, ids } = await loadDayNotesMap()
          if (cancelled || generation !== loadGenerationRef.current) return
          setDayNotes(notes)
          setDayNoteIds(ids)
        } catch {
          // Day notes are non-fatal for boot.
        }
        try {
          await refreshGoalsAndAchievements()
        } catch {
          // Goals/achievements non-fatal for boot.
        }
        try {
          await refreshJournal('thisMonth')
        } catch {
          // Journal non-fatal for boot.
        }
        try {
          await refreshNotificationSummary({ refresh: false })
        } catch {
          // Notifications non-fatal for boot.
        }
        if (cancelled || generation !== loadGenerationRef.current) return
        bumpCalendar()
      } catch (err) {
        if (cancelled || generation !== loadGenerationRef.current) return
        setHabits([])
        setHabitsError(
          err?.message || 'Unable to load habits. Please try again.'
        )
      } finally {
        if (!cancelled && generation === loadGenerationRef.current) {
          setHabitsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    isAuthenticated,
    user?.id,
    token,
    clearHabitsState,
    bumpCalendar,
    refreshGoalsAndAchievements,
    refreshJournal,
    refreshNotificationSummary,
  ])

  // Refresh goals/achievements after check-ins and habit mutations.
  const lastGoalsTickRef = useRef(null)
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      lastGoalsTickRef.current = null
      return
    }
    if (lastGoalsTickRef.current === null) {
      lastGoalsTickRef.current = calendarTick
      return
    }
    if (lastGoalsTickRef.current === calendarTick) return
    lastGoalsTickRef.current = calendarTick
    refreshGoalsAndAchievements().catch(() => {})
  }, [calendarTick, authLoading, isAuthenticated, refreshGoalsAndAchievements])

  const dateKey = toDateKey(selectedDate)
  const isFuture = isFutureDate(selectedDate)
  const isToday = isSameDay(selectedDate, new Date())

  const activeHabits = useMemo(
    () => habits.filter((habit) => !habit.archived),
    [habits]
  )

  const scheduledDayHabits = useMemo(() => {
    return getScheduledHabits(activeHabits, selectedDate).map((habit) => ({
      ...habit,
      completed: Boolean(habit.checkins?.[dateKey]?.completed),
      notes: habit.checkins?.[dateKey]?.notes || '',
    }))
  }, [activeHabits, selectedDate, dateKey])

  const dayStats = useMemo(
    () => getDayCompletionStats(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const streakDays = useMemo(
    () => getCurrentStreak(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const longestStreak = useMemo(
    () => getLongestStreak(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const goalProgress = useMemo(
    () => getGoalProgress(streakDays, goalTarget),
    [streakDays, goalTarget]
  )

  const weeklyProgressData = useMemo(
    () => getWeeklyProgress(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const weeklyConsistency = useMemo(
    () => getWeeklyConsistency(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const monthlyStats = useMemo(
    () => getMonthlyStats(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const categoryStats = useMemo(
    () => getCategoryStats(activeHabits, selectedDate),
    [activeHabits, selectedDate]
  )

  const stats = useMemo(
    () => [
      {
        id: 'completion',
        label: isToday ? "Today's Completion" : 'Day Completion',
        value: `${dayStats.rate}%`,
        growth: isToday ? completionGrowth : undefined,
        icon: 'check',
        accent: 'blue',
      },
      {
        id: 'streak',
        label: 'Current Streak',
        value: `${streakDays} Days`,
        icon: 'flame',
        accent: 'red',
      },
      {
        id: 'habits',
        label: 'Habits Completed',
        value: `${dayStats.completed} / ${dayStats.scheduled}`,
        icon: 'target',
        accent: 'blue',
      },
      {
        id: 'consistency',
        label: 'Weekly Consistency',
        value: `${weeklyConsistency}%`,
        growth: isToday ? weeklyConsistencyGrowth : undefined,
        icon: 'chart',
        accent: 'blue',
      },
    ],
    [dayStats, isToday, streakDays, weeklyConsistency]
  )

  const setSelectedDate = (date) => {
    setSelectedDateState(startOfDay(date))
  }

  const goPrevDay = () => setSelectedDate(subDays(selectedDate, 1))
  const goNextDay = () => setSelectedDate(addDays(selectedDate, 1))

  const toggleHabit = useCallback(
    async (id) => {
      if (isFuture) return

      const habit = habitsRef.current.find((h) => h.id === id)
      if (!habit || habit.archived) return

      const existing = habit.checkins?.[dateKey]
      const currentlyCompleted = Boolean(existing?.completed)
      const nextCompleted = !currentlyCompleted
      const notes = existing?.notes || ''

      try {
        let mapped
        if (existing?.id) {
          const response = await habitApi.updateCheckin(
            id,
            existing.id,
            toCheckinUpdatePayload({ completed: nextCompleted })
          )
          mapped = mapCheckinFromApi(response?.data)
        } else if (nextCompleted) {
          try {
            const response = await habitApi.createCheckin(
              id,
              toCheckinCreatePayload({
                date: dateKey,
                completed: true,
                notes,
              })
            )
            mapped = mapCheckinFromApi(response?.data)
          } catch (err) {
            // Race / duplicate: fetch by date and patch to completed.
            if (err?.status === 409) {
              const existingRes = await habitApi.getCheckinByDate(id, dateKey)
              const row = existingRes?.data
              if (!row?.id) throw err
              const response = await habitApi.updateCheckin(
                id,
                row.id,
                toCheckinUpdatePayload({ completed: true })
              )
              mapped = mapCheckinFromApi(response?.data)
            } else {
              throw err
            }
          }
        } else {
          // Nothing to undo.
          return
        }

        if (!mapped) throw new Error('Check-in update returned no data.')
        setHabits((prev) => patchHabitCheckin(prev, id, dateKey, mapped))
        bumpCalendar()
        return mapped
      } catch (err) {
        setHabitsError(err?.message || 'Unable to update check-in.')
        throw err
      }
    },
    [dateKey, isFuture, bumpCalendar]
  )

  const setHabitNotes = useCallback(
    async (id, notes) => {
      if (isFuture) return

      const habit = habitsRef.current.find((h) => h.id === id)
      if (!habit || habit.archived) return

      const existing = habit.checkins?.[dateKey]
      const trimmed = notes == null ? '' : String(notes)

      try {
        let mapped
        if (existing?.id) {
          const response = await habitApi.updateCheckin(
            id,
            existing.id,
            toCheckinUpdatePayload({ notes: trimmed })
          )
          mapped = mapCheckinFromApi(response?.data)
        } else {
          const response = await habitApi.createCheckin(
            id,
            toCheckinCreatePayload({
              date: dateKey,
              completed: false,
              notes: trimmed,
            })
          )
          mapped = mapCheckinFromApi(response?.data)
        }
        if (!mapped) throw new Error('Check-in notes update returned no data.')
        setHabits((prev) => patchHabitCheckin(prev, id, dateKey, mapped))
        bumpCalendar()
        return mapped
      } catch (err) {
        setHabitsError(err?.message || 'Unable to save check-in notes.')
        throw err
      }
    },
    [dateKey, isFuture, bumpCalendar]
  )

  const setDayNote = useCallback(
    async (key, notes) => {
      const targetKey = key || dateKey
      const trimmed = (notes || '').trim()
      const existingId = dayNoteIdsRef.current[targetKey]

      try {
        if (!trimmed) {
          if (existingId != null) {
            await calendarApi.deleteNote(existingId)
            setDayNotes((prev) => {
              const next = { ...prev }
              delete next[targetKey]
              return next
            })
            setDayNoteIds((prev) => {
              const next = { ...prev }
              delete next[targetKey]
              return next
            })
            bumpCalendar()
          }
          return null
        }

        let row
        if (existingId != null) {
          const response = await calendarApi.updateNote(existingId, {
            notes: trimmed,
          })
          row = response?.data
        } else {
          try {
            const response = await calendarApi.createNote({
              date: targetKey,
              notes: trimmed,
            })
            row = response?.data
          } catch (err) {
            if (err?.status === 409) {
              const listed = await calendarApi.listNotes({ date: targetKey })
              const found = Array.isArray(listed?.data)
                ? listed.data.find((n) => n.date === targetKey)
                : null
              if (!found?.id) throw err
              const response = await calendarApi.updateNote(found.id, {
                notes: trimmed,
              })
              row = response?.data
            } else {
              throw err
            }
          }
        }

        if (!row) throw new Error('Day note save returned no data.')
        setDayNotes((prev) => ({ ...prev, [targetKey]: row.notes || '' }))
        setDayNoteIds((prev) => ({ ...prev, [targetKey]: row.id }))
        bumpCalendar()
        return row
      } catch (err) {
        setHabitsError(err?.message || 'Unable to save day note.')
        throw err
      }
    },
    [dateKey, bumpCalendar]
  )

  const addHabit = useCallback(
    async (payload) => {
      const name = payload.name?.trim()
      if (!name) {
        throw new Error('Habit name is required.')
      }

      const body = toHabitCreatePayload(payload, dateKey)
      const response = await habitApi.create(body)
      const habit = mapHabitFromApi(response?.data, {})
      if (!habit) {
        throw new Error('Habit create returned no data.')
      }

      setHabits((prev) => [...prev, habit])
      setHabitsError(null)
      bumpCalendar()
      return habit
    },
    [dateKey, bumpCalendar]
  )

  const updateHabit = useCallback(async (id, patch) => {
    const body = toHabitUpdatePayload(patch)
    const response = await habitApi.update(id, body)
    const mapped = mapHabitFromApi(
      response?.data,
      mergeCheckins(habitsRef.current, response?.data || { id })
    )
    if (!mapped) {
      throw new Error('Habit update returned no data.')
    }
    setHabits((prev) => prev.map((habit) => (habit.id === id ? mapped : habit)))
    setHabitsError(null)
    bumpCalendar()
    return mapped
  }, [bumpCalendar])

  const archiveHabit = useCallback(async (id) => {
    const response = await habitApi.archive(id)
    const mapped = mapHabitFromApi(
      response?.data,
      mergeCheckins(habitsRef.current, response?.data || { id })
    )
    if (!mapped) {
      throw new Error('Archive returned no data.')
    }
    setHabits((prev) => prev.map((habit) => (habit.id === id ? mapped : habit)))
    setHabitsError(null)
    bumpCalendar()
    return mapped
  }, [bumpCalendar])

  const unarchiveHabit = useCallback(async (id) => {
    const response = await habitApi.restore(id)
    const mapped = mapHabitFromApi(
      response?.data,
      mergeCheckins(habitsRef.current, response?.data || { id })
    )
    if (!mapped) {
      throw new Error('Restore returned no data.')
    }
    setHabits((prev) => prev.map((habit) => (habit.id === id ? mapped : habit)))
    setHabitsError(null)
    bumpCalendar()
    return mapped
  }, [bumpCalendar])

  const deleteHabit = useCallback(async (id) => {
    const response = await habitApi.remove(id)
    const action = response?.data?.action
    if (action === 'deleted') {
      setHabits((prev) => prev.filter((habit) => habit.id !== id))
    } else if (action === 'archived' && response?.data?.habit) {
      const mapped = mapHabitFromApi(
        response.data.habit,
        mergeCheckins(habitsRef.current, response.data.habit)
      )
      setHabits((prev) =>
        prev.map((habit) => (habit.id === id ? mapped : habit))
      )
    } else {
      await refreshHabits()
    }
    setHabitsError(null)
    bumpCalendar()
    return response?.data
  }, [refreshHabits, bumpCalendar])

  const addGoal = useCallback(
    async (payload) => {
      const name = payload.name?.trim()
      if (!name) throw new Error('Goal name is required.')
      const response = await goalApi.create(toGoalCreatePayload(payload))
      const mapped = mapGoalFromApi(response?.data)
      if (!mapped) throw new Error('Goal create returned no data.')
      await refreshGoalsAndAchievements()
      return mapped
    },
    [refreshGoalsAndAchievements]
  )

  const updateGoal = useCallback(
    async (id, patch) => {
      const response = await goalApi.update(id, toGoalUpdatePayload(patch))
      const mapped = mapGoalFromApi(response?.data)
      if (!mapped) throw new Error('Goal update returned no data.')
      await refreshGoalsAndAchievements()
      return mapped
    },
    [refreshGoalsAndAchievements]
  )

  const deleteGoal = useCallback(
    async (id) => {
      await goalApi.remove(id)
      await refreshGoalsAndAchievements()
      return true
    },
    [refreshGoalsAndAchievements]
  )

  const nextActiveGoal = useMemo(() => {
    const active = goals.filter(
      (g) =>
        !g.archived &&
        (g.status === 'in_progress' ||
          g.status === 'not_started' ||
          g.status === 'overdue')
    )
    if (!active.length) return null
    return [...active].sort(
      (a, b) => (b.progress?.rate || 0) - (a.progress?.rate || 0)
    )[0]
  }, [goals])

  const addJournalEntry = useCallback(
    async (payload) => {
      const content = payload.content?.trim()
      if (!content) throw new Error('Journal content is required.')
      if (!payload.date) throw new Error('Journal date is required.')
      const response = await journalApi.create(toJournalCreatePayload(payload))
      const mapped = mapJournalEntryFromApi(response?.data)
      if (!mapped) throw new Error('Journal create returned no data.')
      await refreshJournal(journalSummary?.overview?.period || 'thisMonth')
      bumpCalendar()
      return mapped
    },
    [refreshJournal, bumpCalendar, journalSummary?.overview?.period]
  )

  const updateJournalEntry = useCallback(
    async (id, patch) => {
      const response = await journalApi.update(id, toJournalUpdatePayload(patch))
      const mapped = mapJournalEntryFromApi(response?.data)
      if (!mapped) throw new Error('Journal update returned no data.')
      await refreshJournal(journalSummary?.overview?.period || 'thisMonth')
      bumpCalendar()
      return mapped
    },
    [refreshJournal, bumpCalendar, journalSummary?.overview?.period]
  )

  const deleteJournalEntry = useCallback(
    async (id) => {
      await journalApi.remove(id)
      await refreshJournal(journalSummary?.overview?.period || 'thisMonth')
      bumpCalendar()
      return true
    },
    [refreshJournal, bumpCalendar, journalSummary?.overview?.period]
  )

  const getTrend = (range) => getTrendData(activeHabits, selectedDate, range)

  const value = {
    habits,
    habitsLoading,
    habitsError,
    refreshHabits,
    activeHabits,
    dayHabits: scheduledDayHabits,
    scheduledDayHabits,
    stats,
    completedCount: dayStats.completed,
    totalCount: dayStats.scheduled,
    completionRate: dayStats.rate,
    dayStats,
    streakDays,
    longestStreak,
    goalProgress,
    nextGoalTarget: goalTarget,
    setGoalTarget,
    sidebarOpen,
    setSidebarOpen,
    selectedDate,
    dateKey,
    isFuture,
    isToday,
    weeklyProgressData,
    weeklyConsistency,
    monthlyStats,
    categoryStats,
    setSelectedDate,
    goPrevDay,
    goNextDay,
    toggleHabit,
    setHabitNotes,
    dayNotes,
    dayNoteIds,
    setDayNote,
    selectedDayNote: dayNotes[dateKey] || '',
    calendarTick,
    bumpCalendar,
    addHabit,
    updateHabit,
    archiveHabit,
    unarchiveHabit,
    deleteHabit,
    goals,
    goalsSummary,
    goalsLoading,
    goalsError,
    refreshGoalsAndAchievements,
    unlockedAchievements,
    achievementCatalogue,
    achievementSummary,
    nextActiveGoal,
    addGoal,
    updateGoal,
    deleteGoal,
    journalEntries,
    journalSummary,
    journalLoading,
    journalError,
    refreshJournal,
    refreshJournalSummary,
    searchJournalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    notifications,
    notificationSummary,
    notificationTotal,
    notificationPage,
    notificationsLoading,
    notificationsError,
    notificationUnread: notificationSummary?.unread || 0,
    loadNotifications,
    refreshNotificationSummary,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    getTrend,
    getDayCompletionRate: (date) =>
      getDayCompletionStats(activeHabits, date).rate,
  }

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}

export function useHabits() {
  const context = useContext(HabitContext)
  if (!context) {
    throw new Error('useHabits must be used within HabitProvider')
  }
  return context
}
