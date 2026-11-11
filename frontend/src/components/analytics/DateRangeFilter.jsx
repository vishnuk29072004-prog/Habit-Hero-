import { useRef, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import {
  ANALYTICS_PRESETS,
  formatRangeLabel,
  resolveDateRange,
} from '../../utils/analyticsCalculations'
import { useClickOutside } from '../../hooks/useClickOutside'
import { toDateKey, parseDateKey } from '../../utils/dateUtils'
import './DateRangeFilter.css'

function DateRangeFilter({ range, onChange, anchorDate }) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(toDateKey(range.start))
  const [customEnd, setCustomEnd] = useState(toDateKey(range.end))
  const [error, setError] = useState('')
  const ref = useRef(null)

  useClickOutside(ref, () => setOpen(false))

  const applyPreset = (preset) => {
    if (preset === 'custom') {
      setCustomStart(toDateKey(range.start))
      setCustomEnd(toDateKey(range.end))
      onChange(resolveDateRange('custom', anchorDate, {
        start: range.start,
        end: range.end,
      }))
      return
    }
    setError('')
    onChange(resolveDateRange(preset, anchorDate))
    setOpen(false)
  }

  const applyCustom = () => {
    if (!customStart || !customEnd) {
      setError('Both dates are required.')
      return
    }
    const start = parseDateKey(customStart)
    const end = parseDateKey(customEnd)
    if (start > end) {
      setError('Start date must be on or before end date.')
      return
    }
    setError('')
    onChange(resolveDateRange('custom', anchorDate, { start, end }))
    setOpen(false)
  }

  return (
    <div className="date-range-filter" ref={ref}>
      <button
        type="button"
        className="date-range-filter__trigger"
        aria-expanded={open}
        aria-label="Select date range"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={18} />
        <span>{formatRangeLabel(range.start, range.end)}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="date-range-filter__panel">
          <ul className="date-range-filter__presets">
            {ANALYTICS_PRESETS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={range.preset === item.id ? 'is-active' : ''}
                  onClick={() => applyPreset(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          {(range.preset === 'custom' || open) && (
            <div className="date-range-filter__custom">
              <label>
                Start
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <label>
                End
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
              {error && <p className="date-range-filter__error">{error}</p>}
              <button type="button" className="btn-primary" onClick={applyCustom}>
                Apply range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DateRangeFilter
