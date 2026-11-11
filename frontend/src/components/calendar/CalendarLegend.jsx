import { Check } from 'lucide-react'
import './CalendarLegend.css'

const ITEMS = [
  {
    id: 'today',
    label: 'Today',
    description: 'Current date highlight',
    swatch: 'today',
  },
  {
    id: 'completed',
    label: 'Completed Day',
    description: 'At least 80% of scheduled habits done',
    swatch: 'completed',
    mark: 'check',
  },
  {
    id: 'partial',
    label: 'Partial Day',
    description: 'Some habits done, below 80%',
    swatch: 'partial',
    mark: 'partial',
  },
  {
    id: 'upcoming',
    label: 'Upcoming Day',
    description: 'Future date — not missed',
    swatch: 'upcoming',
  },
  {
    id: 'pastEmpty',
    label: 'Past Day',
    description: 'Past date with no qualifying activity',
    swatch: 'pastEmpty',
  },
]

function CalendarLegend() {
  return (
    <section className="calendar-legend card">
      <h2>Calendar Legend</h2>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <span className={`calendar-legend__swatch is-${item.swatch}`}>
              {item.mark === 'check' && <Check size={11} strokeWidth={3} />}
              {item.mark === 'partial' && (
                <span className="calendar-legend__partial" />
              )}
            </span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default CalendarLegend
