import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Brain,
  CalendarX2,
  Check,
  ClipboardList,
  Code2,
  Droplets,
  Dumbbell,
  Moon,
  PenLine,
  Plus,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { useHabits } from '../../context/HabitContext'
import { HABIT_CATEGORIES } from '../../utils/habitCalculations'
import EmptyState from '../common/EmptyState'
import './TodayHabits.css'

const iconComponents = {
  dumbbell: Dumbbell,
  book: BookOpen,
  droplets: Droplets,
  code: Code2,
  moon: Moon,
  brain: Brain,
  clipboard: ClipboardList,
  shield: Shield,
  pen: PenLine,
  activity: Activity,
  sparkles: Sparkles,
}

function TodayHabits() {
  const {
    dayHabits,
    completedCount,
    totalCount,
    toggleHabit,
    addHabit,
    isFuture,
    isToday,
    selectedDate,
  } = useHabits()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Health')
  const [frequency, setFrequency] = useState('Daily')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!name.trim()) return
    addHabit({ name, category, frequency })
    setName('')
    setCategory('Health')
    setFrequency('Daily')
    setModalOpen(false)
  }

  const title = isToday ? "Today's Habits" : 'Habits for Day'
  const emptyTitle = isFuture ? 'Future date' : 'No habits tracked'
  const emptyDescription = isFuture
    ? 'Future dates cannot show completed activity. Pick today or a past date.'
    : `No habit activity recorded for ${format(selectedDate, 'MMM d, yyyy')}.`

  return (
    <section className="today-habits card">
      <div className="today-habits__header">
        <div>
          <h2>{title}</h2>
          <p>
            {isFuture
              ? 'Unavailable for future dates'
              : `${completedCount} of ${totalCount} completed`}
          </p>
        </div>
        <button
          type="button"
          className="today-habits__add"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Habit
        </button>
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No habits yet"
          description="Add your first habit to start tracking."
        />
      ) : (
        <>
          {isFuture && (
            <EmptyState
              icon={CalendarX2}
              title={emptyTitle}
              description={emptyDescription}
            />
          )}
          {!isFuture && (
            <ul className="today-habits__list">
              {dayHabits.map((habit) => {
                const Icon = iconComponents[habit.icon] || Sparkles
                return (
                  <li key={habit.id} className={habit.completed ? 'is-done' : ''}>
                    <div className="today-habits__icon">
                      <Icon size={18} />
                    </div>
                    <span className="today-habits__name">{habit.name}</span>
                    <button
                      type="button"
                      className={`today-habits__check ${habit.completed ? 'is-checked' : ''}`}
                      onClick={() => toggleHabit(habit.id)}
                      aria-label={`Mark ${habit.name} as ${habit.completed ? 'incomplete' : 'complete'}`}
                    >
                      {habit.completed && <Check size={14} strokeWidth={3} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {modalOpen && (
        <div className="habit-modal" role="dialog" aria-modal="true">
          <div className="habit-modal__backdrop" onClick={() => setModalOpen(false)} />
          <div className="habit-modal__panel">
            <div className="habit-modal__head">
              <h3>Add New Habit</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <label>
                Habit name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Evening Walk"
                  autoFocus
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {HABIT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frequency
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </label>
              <div className="habit-modal__actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default TodayHabits
