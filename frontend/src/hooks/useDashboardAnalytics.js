import { useEffect, useMemo, useRef, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useHabits } from '../context/HabitContext'
import { analyticsApi } from '../services/api/analyticsApi'
import { calendarApi } from '../services/api/calendarApi'
import {
  mapCategoriesToPie,
  mapMonthlyOverviewStats,
  mapOverviewToStatCards,
  mapTrendPoints,
  mapWeeklyToChart,
} from '../services/api/analyticsMappers'
import { toDateKey } from '../utils/dateUtils'

const empty = {
  overview: null,
  weekly: null,
  categories: null,
  streaks: null,
  monthly: null,
}

/**
 * Dashboard analytics from FastAPI. Refreshes on calendarTick / date change.
 */
export function useDashboardAnalytics() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { dateKey, selectedDate, calendarTick } = useHabits()
  const [payload, setPayload] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const genRef = useRef(0)

  const month = selectedDate.getMonth() + 1
  const year = selectedDate.getFullYear()
  const monthStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd')

  useEffect(() => {
    if (authLoading) return
    const generation = ++genRef.current

    if (!isAuthenticated) {
      setPayload(empty)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [overviewRes, weeklyRes, categoriesRes, streaksRes, monthlyRes] =
          await Promise.all([
            analyticsApi.overview(),
            analyticsApi.weekly({ date: dateKey }),
            analyticsApi.categories({
              start_date: monthStart,
              end_date: dateKey,
            }),
            analyticsApi.streaks(),
            analyticsApi.monthly({ month, year }),
          ])
        if (cancelled || generation !== genRef.current) return
        setPayload({
          overview: overviewRes?.data || null,
          weekly: weeklyRes?.data || null,
          categories: categoriesRes?.data || null,
          streaks: streaksRes?.data || null,
          monthly: monthlyRes?.data || null,
        })
      } catch (err) {
        if (cancelled || generation !== genRef.current) return
        setError(err?.message || 'Unable to load dashboard analytics.')
        setPayload(empty)
      } finally {
        if (!cancelled && generation === genRef.current) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    isAuthenticated,
    dateKey,
    monthStart,
    month,
    year,
    calendarTick,
  ])

  const stats = useMemo(
    () => mapOverviewToStatCards(payload.overview),
    [payload.overview]
  )
  const weeklyProgressData = useMemo(
    () => mapWeeklyToChart(payload.weekly),
    [payload.weekly]
  )
  const categoryStats = useMemo(
    () => mapCategoriesToPie(payload.categories),
    [payload.categories]
  )
  const monthlyStats = useMemo(
    () => mapMonthlyOverviewStats(payload.monthly, payload.streaks),
    [payload.monthly, payload.streaks]
  )
  const streakDays = payload.streaks?.current_streak ?? 0
  const longestStreak = payload.streaks?.longest_streak ?? 0
  const totalCount =
    payload.overview?.today_scheduled ??
    categoryStats.reduce((sum, c) => sum + (c.total || 0), 0)

  return {
    loading,
    error,
    overview: payload.overview,
    weekly: payload.weekly,
    categories: payload.categories,
    streaks: payload.streaks,
    monthly: payload.monthly,
    stats,
    weeklyProgressData,
    categoryStats,
    monthlyStats,
    streakDays,
    longestStreak,
    totalCount,
  }
}

/**
 * Progress trend for Dashboard (7D / 30D / 90D) via calendar summary.
 */
export function useProgressTrend(rangeKey = '7D') {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { selectedDate, calendarTick } = useHabits()
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const genRef = useRef(0)

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setPoints([])
      return
    }
    const generation = ++genRef.current
    const end = toDateKey(selectedDate)
    const daysBack = rangeKey === '90D' ? 89 : rangeKey === '30D' ? 29 : 6
    const endDate = selectedDate
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - daysBack)
    const start = toDateKey(startDate)

    let cancelled = false
    setLoading(true)
    calendarApi
      .summary({ start_date: start, end_date: end })
      .then((res) => {
        if (cancelled || generation !== genRef.current) return
        const labelMode = rangeKey === '7D' ? 'weekday' : 'short'
        setPoints(mapTrendPoints(res?.data?.daily_trend, labelMode))
      })
      .catch(() => {
        if (cancelled || generation !== genRef.current) return
        setPoints([])
      })
      .finally(() => {
        if (!cancelled && generation === genRef.current) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, selectedDate, rangeKey, calendarTick])

  return { points, loading }
}

/**
 * Monthly analytics for a specific view month (MonthlyOverview nav).
 */
export function useMonthlyAnalytics(viewMonth) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { calendarTick } = useHabits()
  const [monthly, setMonthly] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [loading, setLoading] = useState(false)
  const genRef = useRef(0)

  const month = viewMonth.getMonth() + 1
  const year = viewMonth.getFullYear()

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setMonthly(null)
      setStreaks(null)
      return
    }
    const generation = ++genRef.current
    let cancelled = false
    setLoading(true)
    Promise.all([
      analyticsApi.monthly({ month, year }),
      analyticsApi.streaks(),
    ])
      .then(([monthlyRes, streaksRes]) => {
        if (cancelled || generation !== genRef.current) return
        setMonthly(monthlyRes?.data || null)
        setStreaks(streaksRes?.data || null)
      })
      .catch(() => {
        if (cancelled || generation !== genRef.current) return
        setMonthly(null)
      })
      .finally(() => {
        if (!cancelled && generation === genRef.current) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, month, year, calendarTick])

  const stats = useMemo(
    () => mapMonthlyOverviewStats(monthly, streaks),
    [monthly, streaks]
  )

  return { monthly, streaks, stats, loading }
}

export default useDashboardAnalytics
