import { GOAL_SORT_OPTIONS } from '../../utils/goalCalculations'
import './GoalFilters.css'

function GoalFilters({ tab, sort, counts, onTabChange, onSortChange }) {
  const tabs = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'active', label: `Active (${counts.active})` },
    { id: 'completed', label: `Completed (${counts.completed})` },
  ]

  return (
    <div className="goal-filters">
      <div className="goal-filters__tabs" role="tablist" aria-label="Goal status">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="goal-filters__sort">
        <span className="sr-only">Sort goals</span>
        <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
          {GOAL_SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default GoalFilters
