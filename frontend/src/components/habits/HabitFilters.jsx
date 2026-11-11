import { LayoutGrid, List, Search } from 'lucide-react'
import { HABIT_CATEGORIES } from '../../utils/habitCalculations'
import './HabitFilters.css'

function HabitFilters({
  query,
  category,
  frequency,
  view,
  onQueryChange,
  onCategoryChange,
  onFrequencyChange,
  onViewChange,
}) {
  return (
    <div className="habit-filters">
      <div className="habit-filters__search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search habits..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search habits"
        />
      </div>

      <div className="habit-filters__controls">
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="All">All Categories</option>
          {HABIT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value)}
          aria-label="Filter by frequency"
        >
          <option value="All">All Frequencies</option>
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
        </select>

        <div className="habit-filters__view" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === 'list' ? 'is-active' : ''}
            onClick={() => onViewChange('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className={view === 'grid' ? 'is-active' : ''}
            onClick={() => onViewChange('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default HabitFilters
