import { Pencil, Trash2 } from 'lucide-react'
import { getHabitIcon } from '../habits/habitIcons'
import './GoalCard.css'

const STATUS_LABEL = {
  in_progress: 'In Progress',
  completed: 'Completed',
  not_started: 'Not Started',
  overdue: 'Overdue',
}

function GoalCard({ goal, onEdit, onDelete }) {
  const Icon = getHabitIcon(goal.icon || 'target')
  const progress = goal.progress || { rate: 0, label: '0 / 0', current: 0, target: 0 }
  const status = goal.status || 'not_started'

  return (
    <article className="goal-card">
      <div className="goal-card__icon" aria-hidden="true">
        <Icon size={20} />
      </div>

      <div className="goal-card__main">
        <div className="goal-card__top">
          <div>
            <h3>{goal.name}</h3>
            <p>{goal.description || 'No description'}</p>
          </div>
          <span className={`goal-card__badge status-${status}`}>
            {STATUS_LABEL[status] || status}
          </span>
        </div>

        <div className="goal-card__progress">
          <div className="goal-card__meta">
            <span>{progress.label}</span>
            <strong>{progress.rate}%</strong>
          </div>
          <div
            className="goal-card__bar"
            role="progressbar"
            aria-valuenow={progress.rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${progress.rate}%` }} />
          </div>
        </div>
      </div>

      <div className="goal-card__actions">
        <button
          type="button"
          aria-label={`Edit ${goal.name}`}
          onClick={() => onEdit(goal)}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="is-danger"
          aria-label={`Delete ${goal.name}`}
          onClick={() => onDelete(goal)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}

export default GoalCard
