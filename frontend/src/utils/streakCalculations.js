import { startOfDay, subDays } from 'date-fns'
import { isFutureDate } from './dateUtils'
import { isSuccessfulDay } from './habitCalculations'

export function getCurrentStreak(habits, asOfDate) {
  if (!habits?.length || isFutureDate(asOfDate)) return 0

  let streak = 0
  let cursor = startOfDay(asOfDate)

  while (true) {
    if (!isSuccessfulDay(habits, cursor)) break
    streak += 1
    cursor = subDays(cursor, 1)
    if (streak > 730) break
  }

  return streak
}

export function getLongestStreak(habits, asOfDate = new Date(), lookback = 365) {
  if (!habits?.length) return 0

  let longest = 0
  let current = 0
  const end = startOfDay(asOfDate)

  for (let i = lookback - 1; i >= 0; i -= 1) {
    const date = subDays(end, i)
    if (isFutureDate(date)) continue
    if (isSuccessfulDay(habits, date)) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }

  return longest
}

export function getGoalProgress(currentStreak, target) {
  const safeTarget = Math.max(1, Number(target) || 1)
  const streak = Math.max(0, Number(currentStreak) || 0)
  const percentage = Math.min(100, Math.round((streak / safeTarget) * 100))
  return {
    current: streak,
    target: safeTarget,
    percentage,
    remaining: Math.max(0, safeTarget - streak),
  }
}
