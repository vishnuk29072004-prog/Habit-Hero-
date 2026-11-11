import {
  CheckCircle2,
  CircleDot,
  ListChecks,
  Percent,
} from 'lucide-react'
import './QuickInsights.css'

function QuickInsights({ summary }) {
  const items = [
    {
      id: 'rate',
      label: 'Goal Completion Rate',
      value: `${summary.completionRate}%`,
      icon: Percent,
      tone: 'blue',
    },
    {
      id: 'total',
      label: 'Total Goals',
      value: summary.total,
      icon: ListChecks,
      tone: 'slate',
    },
    {
      id: 'active',
      label: 'Active Goals',
      value: summary.active,
      icon: CircleDot,
      tone: 'blue',
    },
    {
      id: 'completed',
      label: 'Completed Goals',
      value: summary.completed,
      icon: CheckCircle2,
      tone: 'green',
    },
  ]

  return (
    <section className="quick-insights card">
      <h2>Quick Insights</h2>
      <ul>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id} className={`tone-${item.tone}`}>
              <span aria-hidden="true">
                <Icon size={16} />
              </span>
              <em>{item.label}</em>
              <strong>{item.value}</strong>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default QuickInsights
