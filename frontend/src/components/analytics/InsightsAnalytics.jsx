import {
  Flame,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import EmptyState from '../common/EmptyState'
import './InsightsAnalytics.css'

const GROUPS = [
  { id: 'performance', label: 'Performance' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'categories', label: 'Categories' },
  { id: 'recommendations', label: 'Recommendations' },
]

const TONE_ICON = {
  green: TrendingUp,
  red: TrendingDown,
  blue: Lightbulb,
  orange: Lightbulb,
  purple: Flame,
}

function InsightsAnalytics({ insights }) {
  if (!insights?.length) {
    return (
      <EmptyState
        title="No insights yet"
        description="Keep logging check-ins — rule-based insights appear as patterns emerge."
      />
    )
  }

  return (
    <div className="insights-analytics">
      {GROUPS.map((group) => {
        const items = insights.filter((i) => i.group === group.id)
        if (!items.length) return null
        return (
          <section key={group.id} className="card insights-analytics__section">
            <h2>{group.label}</h2>
            <ul>
              {items.map((insight) => {
                const Icon = TONE_ICON[insight.tone] || Sparkles
                return (
                  <li key={insight.id} className={`tone-${insight.tone || 'blue'}`}>
                    <span aria-hidden="true">
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
          </section>
        )
      })}
    </div>
  )
}

export default InsightsAnalytics
