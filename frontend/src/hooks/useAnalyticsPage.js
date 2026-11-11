import { useEffect, useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, format, subDays } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useHabits } from '../context/HabitContext'
import { analyticsApi } from '../services/api/analyticsApi'
import { calendarApi } from '../services/api/calendarApi'
import {
  groupDailyTrendByMonth,
  groupDailyTrendByWeek,
  mapBestDays,
  mapCategoriesForAnalytics,
  mapInsightsFromApi,
  mapPeriodStatsFromSummary,
  mapTopHabitsFromMonthly,
  mapTrendPoints,
} from '../services/api/analyticsMappers'
import { parseDateKey, toDateKey } from '../utils/dateUtils'

/**
 * Analytics page data for a selected date range.
 * Uses analytics + calendar summary APIs; stale responses ignored via generation.
 */
export function useAnalyticsPage(range) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { calendarTick, activeHabits } = useHabits()
  const [state, setState] = useState({
    overview: null,
    categories: null,
    bestDays: null,
    streaks: null,
    summary: null,
    prevSummary: null,
    monthly: null,
    loading: false,
    error: null,
  })
  const [topHabitsExtra, setTopHabitsExtra] = useState([])
  const genRef = useRef(0)

  const startKey = range?.start ? toDateKey(range.start) : null
  const endKey = range?.end ? toDateKey(range.end) : null

  useEffect(() => {
    if (authLoading) return
    const generation = ++genRef.current

    if (!isAuthenticated || !startKey || !endKey) {
      setState((prev) => ({
        ...prev,
        overview: null,
        categories: null,
        bestDays: null,
        streaks: null,
        summary: null,
        prevSummary: null,
        monthly: null,
        loading: false,
        error: null,
      }))
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const length = Math.max(
      0,
      differenceInCalendarDays(range.end, range.start)
    )
    const prevEnd = subDays(range.start, 1)
    const prevStart = subDays(prevEnd, length)
    const prevStartKey = toDateKey(prevStart)
    const prevEndKey = toDateKey(prevEnd)

    const sameMonth =
      range.start.getMonth() === range.end.getMonth() &&
      range.start.getFullYear() === range.end.getFullYear()

    ;(async () => {
      try {
        const requests = [
          analyticsApi.overview(),
          analyticsApi.categories({
            start_date: startKey,
            end_date: endKey,
          }),
          analyticsApi.bestDays({ start_date: startKey, end_date: endKey }),
          analyticsApi.streaks(),
          calendarApi.summary({ start_date: startKey, end_date: endKey }),
          calendarApi.summary({
            start_date: prevStartKey,
            end_date: prevEndKey,
          }),
        ]
        if (sameMonth) {
          requests.push(
            analyticsApi.monthly({
              month: range.end.getMonth() + 1,
              year: range.end.getFullYear(),
            })
          )
        }

        const results = await Promise.all(requests)
        if (cancelled || generation !== genRef.current) return

        const overviewRes = results[0]
        const categoriesRes = results[1]
        const bestDaysRes = results[2]
        const streaksRes = results[3]
        const summaryRes = results[4]
        const prevSummaryRes = results[5]
        const monthlyRes = sameMonth ? results[6] : null

        setState({
          overview: overviewRes?.data || null,
          categories: categoriesRes?.data || null,
          bestDays: bestDaysRes?.data || null,
          streaks: streaksRes?.data || null,
          summary: summaryRes?.data || null,
          prevSummary: prevSummaryRes?.data || null,
          monthly: monthlyRes?.data || null,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled || generation !== genRef.current) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Unable to load analytics.',
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    isAuthenticated,
    startKey,
    endKey,
    calendarTick,
    range?.start,
    range?.end,
  ])

  const categories = useMemo(
    () => mapCategoriesForAnalytics(state.categories),
    [state.categories]
  )
  const bestDays = useMemo(() => mapBestDays(state.bestDays), [state.bestDays])
  const period = useMemo(
    () => mapPeriodStatsFromSummary(state.summary),
    [state.summary]
  )
  const prevPeriod = useMemo(
    () => mapPeriodStatsFromSummary(state.prevSummary),
    [state.prevSummary]
  )
  const comparison = useMemo(() => {
    const delta =
      prevPeriod.scheduled > 0 ? period.rate - prevPeriod.rate : null
    return {
      current: period,
      previous: prevPeriod,
      deltaPoints: delta,
    }
  }, [period, prevPeriod])

  const dailyTrend = useMemo(
    () => mapTrendPoints(state.summary?.daily_trend, 'short'),
    [state.summary]
  )
  const weeklyTrend = useMemo(
    () =>
      state.monthly?.weekly_breakdown?.length
        ? state.monthly.weekly_breakdown.map((w) => ({
            label: format(parseDateKey(w.week_start), 'MMM d'),
            value: w.completion_percentage ?? 0,
            scheduled: w.scheduled,
            completed: w.completed,
          }))
        : groupDailyTrendByWeek(state.summary?.daily_trend),
    [state.monthly, state.summary]
  )
  const monthlyTrend = useMemo(
    () => groupDailyTrendByMonth(state.summary?.daily_trend),
    [state.summary]
  )

  useEffect(() => {
    if (state.monthly || !isAuthenticated || !startKey || !endKey) {
      setTopHabitsExtra([])
      return
    }
    const habits = activeHabits.slice(0, 12)
    if (!habits.length) {
      setTopHabitsExtra([])
      return
    }
    let cancelled = false
    Promise.all(
      habits.map((h) =>
        analyticsApi
          .habit(h.id, { start_date: startKey, end_date: endKey })
          .then((res) => ({ habit: h, data: res?.data }))
          .catch(() => null)
      )
    ).then((rows) => {
      if (cancelled) return
      const ranked = rows
        .filter(Boolean)
        .map(({ habit, data }) => ({
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          category: habit.category,
          scheduled: data?.total_scheduled ?? 0,
          completed: data?.total_completed ?? 0,
          rate: data?.completion_percentage ?? 0,
        }))
        .filter((h) => h.scheduled > 0)
        .sort((a, b) => b.rate - a.rate || b.completed - a.completed)
        .slice(0, 4)
      setTopHabitsExtra(ranked)
    })
    return () => {
      cancelled = true
    }
  }, [
    state.monthly,
    isAuthenticated,
    startKey,
    endKey,
    activeHabits,
    calendarTick,
  ])

  const topHabits = useMemo(() => {
    if (state.monthly) return mapTopHabitsFromMonthly(state.monthly, 4)
    return topHabitsExtra
  }, [state.monthly, topHabitsExtra])

  const insights = useMemo(
    () =>
      mapInsightsFromApi({
        overview: state.overview,
        categories,
        bestDays,
        streaks: state.streaks,
        comparisonDelta: comparison.deltaPoints,
      }),
    [state.overview, categories, bestDays, state.streaks, comparison.deltaPoints]
  )

  return {
    loading: state.loading,
    error: state.error,
    overview: state.overview,
    streaks: state.streaks,
    categories,
    bestDays,
    comparison,
    period,
    dailyTrend,
    weeklyTrend,
    monthlyTrend,
    topHabits,
    insights,
    summary: state.summary,
    monthly: state.monthly,
    activeHabits,
    streakDays: state.streaks?.current_streak ?? 0,
    longestStreak: state.streaks?.longest_streak ?? 0,
    totalHabits:
      state.overview?.active_habits ?? activeHabits.length,
    totalCompletedCheckins: state.overview?.total_completed_checkins ?? 0,
    overallCompletion: state.overview?.overall_completion_percentage ?? 0,
  }
}

export default useAnalyticsPage
