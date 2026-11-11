import {
  CalendarCheck2,
  CheckCircle,
  Flame,
  Target,
  ChartNoAxesColumnIncreasing,
  Trophy,
  TrendingUp,
  NotebookPen,
} from 'lucide-react'
import './StatCard.css'

const iconMap = {
  check: CheckCircle,
  flame: Flame,
  target: Target,
  chart: ChartNoAxesColumnIncreasing,
  calendarCheck: CalendarCheck2,
  trophy: Trophy,
  notebook: NotebookPen,
}

function StatCard({ label, value, growth, icon = 'check', accent = 'blue' }) {
  const Icon = iconMap[icon] || CheckCircle
  const deco =
    accent === 'green' || accent === 'purple' || accent === 'orange'
      ? 'blue'
      : accent

  return (
    <article className={`stat-card card card-deco-${deco} accent-${accent}`}>
      <div className={`stat-card__icon accent-${accent}`}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value-row">
          <h3>{value}</h3>
          {growth === null && (
            <span className="stat-card__growth is-neutral">—</span>
          )}
          {typeof growth === 'number' && (
            <span
              className={`stat-card__growth ${
                growth < 0 ? 'is-down' : growth === 0 ? 'is-neutral' : ''
              }`}
            >
              {growth >= 0 && <TrendingUp size={14} />}
              {growth > 0 ? '+' : ''}
              {growth}%
            </span>
          )}
          {typeof growth === 'string' && (
            <span className="stat-card__growth is-neutral">{growth}</span>
          )}
        </div>
        <p>{label}</p>
      </div>
    </article>
  )
}

export default StatCard
