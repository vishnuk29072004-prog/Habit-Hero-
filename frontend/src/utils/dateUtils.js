import {
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
} from 'date-fns'

export function toDateKey(date) {
  return format(startOfDay(date), 'yyyy-MM-dd')
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return startOfDay(new Date(y, m - 1, d))
}

export function isFutureDate(date, today = new Date()) {
  return isAfter(startOfDay(date), startOfDay(today))
}

export function isPastDate(date, today = new Date()) {
  return isBefore(startOfDay(date), startOfDay(today))
}

export function isTodayDate(date, today = new Date()) {
  return isSameDay(startOfDay(date), startOfDay(today))
}

export function getCalendarDayKind(date, today = new Date()) {
  if (isTodayDate(date, today)) return 'today'
  if (isPastDate(date, today)) return 'past'
  return 'future'
}
