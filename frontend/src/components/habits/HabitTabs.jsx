import './HabitTabs.css'

function HabitTabs({ activeTab, counts, onChange }) {
  const tabs = [
    { id: 'all', label: `All Habits (${counts.all})` },
    { id: 'active', label: `Active (${counts.active})` },
    { id: 'completed', label: `Completed (${counts.completed})` },
    { id: 'archived', label: `Archived (${counts.archived})` },
  ]

  return (
    <div className="habit-tabs" role="tablist" aria-label="Habit status">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`habit-tabs__btn ${activeTab === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default HabitTabs
