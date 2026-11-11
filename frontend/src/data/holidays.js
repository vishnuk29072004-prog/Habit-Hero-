/**
 * Manually configured holidays keyed by YYYY-MM-DD.
 * Holidays take priority over weekday/weekend calendar colors.
 */
export const holidays = {
  '2026-01-01': 'New Year’s Day',
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-26': 'Ugadi',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Labour Day',
  '2026-08-15': 'Independence Day',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Diwali',
  '2026-11-08': 'Gurpurab',
  '2026-12-25': 'Christmas Day',
}

export function getHolidayName(dateKey) {
  return holidays[dateKey] || null
}

export function isHoliday(dateKey) {
  return Boolean(holidays[dateKey])
}
