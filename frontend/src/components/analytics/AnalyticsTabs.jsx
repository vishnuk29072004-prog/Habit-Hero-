import './AnalyticsTabs.css'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'habits', label: 'Habits' },
  { id: 'categories', label: 'Categories' },
  { id: 'trends', label: 'Trends' },
  { id: 'insights', label: 'Insights' },
]

function AnalyticsTabs({ active, onChange }) {
  return (
    <div className="analytics-tabs" role="tablist" aria-label="Analytics sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default AnalyticsTabs
