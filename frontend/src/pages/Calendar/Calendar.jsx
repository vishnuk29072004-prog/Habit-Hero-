import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { startOfMonth } from 'date-fns'
import { completionGrowth } from '../../data/mockData'
import { useHabits } from '../../context/HabitContext'
import { calendarApi } from '../../services/api/calendarApi'
import {
  indexMonthlyDays,
  mapBestWeekdayFromMonthly,
  mapDailyHabitsFromApi,
  mapDailySummaryFromApi,
  mapMonthlyStatisticsFromApi,
} from '../../services/api/calendarMappers'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import CalendarStats from '../../components/calendar/CalendarStats'
import MonthlyCalendar from '../../components/calendar/MonthlyCalendar'
import DailySummary from '../../components/calendar/DailySummary'
import MonthlyStatistics from '../../components/calendar/MonthlyStatistics'
import CalendarLegend from '../../components/calendar/CalendarLegend'
import './Calendar.css'

function Calendar() {
  const {
    selectedDate,
    setSelectedDate,
    streakDays,
    longestStreak,
    isFuture,
    toggleHabit,
    dayNotes,
    setDayNote,
    dateKey,
    calendarTick,
  } = useHabits()

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedDate || new Date())
  )
  const [monthlyData, setMonthlyData] = useState(null)
  const [dailyData, setDailyData] = useState(null)
  const [calendarError, setCalendarError] = useState(null)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [loadingDaily, setLoadingDaily] = useState(false)

  useEffect(() => {
    setViewMonth(startOfMonth(selectedDate))
  }, [selectedDate])

  const month = viewMonth.getMonth() + 1
  const year = viewMonth.getFullYear()

  useEffect(() => {
    let cancelled = false
    setLoadingMonth(true)
    setCalendarError(null)
    calendarApi
      .monthly({ month, year })
      .then((res) => {
        if (!cancelled) setMonthlyData(res?.data || null)
      })
      .catch((err) => {
        if (!cancelled) {
          setMonthlyData(null)
          setCalendarError(err?.message || 'Unable to load monthly calendar.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, year, calendarTick])

  useEffect(() => {
    let cancelled = false
    setLoadingDaily(true)
    calendarApi
      .daily({ date: dateKey })
      .then((res) => {
        if (!cancelled) setDailyData(res?.data || null)
      })
      .catch((err) => {
        if (!cancelled) {
          setDailyData(null)
          setCalendarError(err?.message || 'Unable to load daily calendar.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDaily(false)
      })
    return () => {
      cancelled = true
    }
  }, [dateKey, calendarTick])

  const daySummariesByDate = useMemo(
    () => indexMonthlyDays(monthlyData),
    [monthlyData]
  )

  const monthStats = useMemo(() => {
    const fromApi = mapMonthlyStatisticsFromApi(monthlyData)
    return {
      ...fromApi,
      longestStreak,
      bestPerformingDay: mapBestWeekdayFromMonthly(monthlyData),
    }
  }, [monthlyData, longestStreak])

  const dailySummary = useMemo(
    () => mapDailySummaryFromApi(dailyData, isFuture),
    [dailyData, isFuture]
  )

  const dailyHabits = useMemo(
    () => mapDailyHabitsFromApi(dailyData),
    [dailyData]
  )

  const handleSelectToday = (today, monthStart) => {
    setSelectedDate(today)
    setViewMonth(monthStart)
  }

  const handleToggle = async (habitId) => {
    try {
      await toggleHabit(habitId)
    } catch (err) {
      window.alert(err?.message || 'Unable to update check-in.')
    }
  }

  const handleSaveNote = async (key, notes) => {
    try {
      await setDayNote(key, notes)
    } catch (err) {
      window.alert(err?.message || 'Unable to save day note.')
    }
  }

  return (
    <div className="calendar-page">
      <header className="calendar-page__header">
        <div className="calendar-page__title">
          <span className="calendar-page__icon" aria-hidden="true">
            <CalendarDays size={26} />
          </span>
          <div>
            <h1>Calendar</h1>
            <p>Track your daily, weekly, and monthly habit completion.</p>
          </div>
        </div>
        <PageHeaderTools />
      </header>

      {calendarError && (
        <div className="calendar-page__banner" role="alert">
          {calendarError}
        </div>
      )}

      <CalendarStats
        completedDays={monthStats.completedDays}
        monthlyRate={monthStats.monthlyRate}
        streakDays={streakDays}
        longestStreak={longestStreak}
        growth={completionGrowth}
      />

      <div className="calendar-page__mid">
        <MonthlyCalendar
          viewMonth={viewMonth}
          onViewMonthChange={setViewMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          daySummariesByDate={daySummariesByDate}
          loading={loadingMonth}
        />

        <DailySummary
          selectedDate={selectedDate}
          summary={dailySummary}
          habits={dailyHabits}
          isFuture={isFuture}
          dayNote={dayNotes[dateKey] || ''}
          onSelectToday={handleSelectToday}
          onToggle={handleToggle}
          onSaveNote={handleSaveNote}
          loading={loadingDaily}
        />

        <aside className="calendar-page__aside">
          <MonthlyStatistics stats={monthStats} />
          <CalendarLegend />
        </aside>
      </div>
    </div>
  )
}

export default Calendar
