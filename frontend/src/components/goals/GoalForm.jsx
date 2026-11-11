import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import Modal from '../common/Modal'
import {
  GOAL_CATEGORIES,
  GOAL_TARGET_TYPES,
} from '../../utils/goalCalculations'
import { toDateKey } from '../../utils/dateUtils'
import './GoalForm.css'

function defaultEndKey(todayKey) {
  try {
    return format(addDays(parseISO(todayKey), 29), 'yyyy-MM-dd')
  } catch {
    return todayKey
  }
}

function buildForm(goal, todayKey) {
  return {
    name: goal?.name || '',
    description: goal?.description || '',
    category: goal?.category || 'Health',
    linkedHabitId: goal?.linkedHabitId || '',
    targetType: goal?.targetType || 'completion_count',
    targetValue: String(goal?.targetValue ?? 15),
    startDate: goal?.startDate || todayKey,
    endDate: goal?.endDate || defaultEndKey(todayKey),
    notes: goal?.notes || '',
    icon: goal?.icon || '',
  }
}

function GoalForm({
  mode = 'create',
  goal = null,
  habits = [],
  todayKey,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => buildForm(goal, todayKey))
  const [error, setError] = useState('')

  const needsHabit = form.targetType !== 'completion_percentage'

  const habitOptions = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits]
  )

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (submitting) return

    const name = form.name.trim()
    if (!name) {
      setError('Goal name is required.')
      return
    }
    if (!form.category) {
      setError('Category is required.')
      return
    }
    if (!form.targetType) {
      setError('Target type is required.')
      return
    }
    const targetValue = Number(form.targetValue)
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError('Target value must be a positive number.')
      return
    }
    if (!form.startDate) {
      setError('Start date is required.')
      return
    }
    if (!form.endDate) {
      setError('End date is required.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('End date must not be before start date.')
      return
    }
    if (needsHabit && !form.linkedHabitId) {
      setError('Select a linked habit for this target type.')
      return
    }
    if (
      form.linkedHabitId &&
      !habitOptions.some((h) => h.id === form.linkedHabitId)
    ) {
      setError('Linked habit must exist.')
      return
    }

    const linked = habitOptions.find((h) => h.id === form.linkedHabitId)
    onSubmit({
      name,
      description: form.description.trim(),
      category: form.category,
      linkedHabitId: form.linkedHabitId || null,
      targetType: form.targetType,
      targetValue,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes.trim(),
      icon: form.icon || linked?.icon || 'target',
    })
  }

  return (
    <Modal
      title={mode === 'edit' ? 'Edit Goal' : 'Create New Goal'}
      onClose={onCancel}
      wide
    >
      <form className="goal-form" onSubmit={handleSubmit}>
        <label>
          Goal Name
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Read Daily"
            required
          />
        </label>

        <label>
          Description
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Short description of this goal"
          />
        </label>

        <div className="goal-form__row">
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            >
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Linked Habit {needsHabit ? '' : '(optional)'}
            <select
              value={form.linkedHabitId}
              onChange={(e) => update('linkedHabitId', e.target.value)}
            >
              <option value="">
                {needsHabit ? 'Select a habit' : 'Overall habits'}
              </option>
              {habitOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="goal-form__row">
          <label>
            Target Type
            <select
              value={form.targetType}
              onChange={(e) => update('targetType', e.target.value)}
            >
              {GOAL_TARGET_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Target Value
            <input
              type="number"
              min="1"
              value={form.targetValue}
              onChange={(e) => update('targetValue', e.target.value)}
            />
          </label>
        </div>

        <div className="goal-form__row">
          <label>
            Start Date
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </label>
          <label>
            End Date
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </label>
        </div>

        <label>
          Notes (optional)
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </label>

        {error && <p className="goal-form__error">{error}</p>}

        <div className="goal-form__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {mode === 'edit' ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function buildGoalForm(goal, today = new Date()) {
  return buildForm(goal, toDateKey(today))
}

export default GoalForm
