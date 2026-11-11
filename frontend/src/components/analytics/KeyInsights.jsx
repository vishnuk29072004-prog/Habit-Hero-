import {
  Flame,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import EmptyState from '../common/EmptyState'
import './KeyInsights.css'

const TONE_ICON = {
  green: TrendingUp,
  red: TrendingDown,
  blue: Lightbulb,
  orange: Lightbulb,
  purple: Flame,
}

function KeyInsights({ insights, limit = 3 }) {
  const items = (insights || []).slice(0, limit)

  return (
    <section className="key-insights card">
      <div className="key-insights__head">
        <h2>Key Insights</h2>
        <p>Rule-based takeaways from this date range.</p>
      </div>

      {!items.length ? (
        <EmptyState
          title="No insights yet"
          description="Keep checking in — insights appear as your history grows."
        />
      ) : (
        <ul className="key-insights__list">
          {items.map((insight) => {
            const Icon = TONE_ICON[insight.tone] || Sparkles
            return (
              <li key={insight.id} className={`tone-${insight.tone || 'blue'}`}>
                <span className="key-insights__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default KeyInsights
