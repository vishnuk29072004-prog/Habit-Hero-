import { useHabits } from '../../context/HabitContext'
import './NextGoal.css'

function NextGoal() {
  const { nextActiveGoal } = useHabits()

  if (!nextActiveGoal) {
    return (
      <section className="next-goal card card-deco-red-tr">
        <h2>Next Goal</h2>
        <p className="next-goal__title">No active goals yet</p>
        <p className="next-goal__remaining">
          Create a goal on the Goals page to track progress here.
        </p>
      </section>
    )
  }

  const progress = nextActiveGoal.progress || {
    current: 0,
    target: nextActiveGoal.targetValue || 1,
    rate: 0,
    label: '0 / 0',
  }
  const percentage = progress.rate ?? 0
  const remaining = Math.max(
    0,
    Math.ceil((progress.target || 0) - (progress.current || 0))
  )

  return (
    <section className="next-goal card card-deco-red-tr">
      <h2>Next Goal</h2>
      <p className="next-goal__title">{nextActiveGoal.name}</p>

      <div
        className="next-goal__bar"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="next-goal__fill" style={{ width: `${percentage}%` }} />
      </div>

      <div className="next-goal__meta">
        <span>{progress.label || `${progress.current} / ${progress.target}`}</span>
        <strong>{percentage}%</strong>
      </div>
      <p className="next-goal__remaining">
        {percentage >= 100
          ? 'Goal reached. Keep going!'
          : remaining === 0
            ? progress.label || 'Keep progressing'
            : `${remaining} ${progress.unit || 'units'} remaining`}
      </p>
    </section>
  )
}

export default NextGoal
