import EmptyState from '../common/EmptyState'
import GoalFilters from './GoalFilters'
import GoalCard from './GoalCard'
import './GoalList.css'

function GoalList({
  goals,
  tab,
  sort,
  counts,
  onTabChange,
  onSortChange,
  onEdit,
  onDelete,
}) {
  return (
    <section className="goal-list card">
      <div className="goal-list__head">
        <div>
          <h2>Your Goals</h2>
          <p>Track and manage your habit goals.</p>
        </div>
      </div>

      <GoalFilters
        tab={tab}
        sort={sort}
        counts={counts}
        onTabChange={onTabChange}
        onSortChange={onSortChange}
      />

      {!goals.length ? (
        <EmptyState
          title="No goals in this view"
          description="Create a goal or switch filters to see your targets."
        />
      ) : (
        <div className="goal-list__items">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default GoalList
