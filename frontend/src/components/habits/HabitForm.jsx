import { useState } from 'react'
import { HABIT_CATEGORIES } from '../../utils/habitCalculations'
import './HabitForm.css'

const emptyForm = {
  name: '',
  description: '',
  category: 'Health',
  frequency: 'Daily',
  startDate: '',
  notes: '',
}

export function buildHabitForm(habit, fallbackDate) {
  if (!habit) {
    return { ...emptyForm, startDate: fallbackDate || '' }
  }
  return {
    name: habit.name || '',
    description: habit.description || '',
    category: habit.category || 'Health',
    frequency: habit.frequency || 'Daily',
    startDate: habit.startDate || fallbackDate || '',
    notes: habit.notes || '',
  }
}

function HabitForm({
  mode = 'create',
  initialValues,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initialValues || emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name.trim()) {
      setError('Habit name is required.')
      return
    }
    if (!form.category) {
      setError('Category is required.')
      return
    }
    if (!form.frequency) {
      setError('Frequency is required.')
      return
    }
    if (!form.startDate) {
      setError('Start date is required.')
      return
    }

    setSaving(true)
    try {
      await Promise.resolve(
        onSubmit({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          frequency: form.frequency,
          startDate: form.startDate,
          notes: form.notes.trim(),
        })
      )
      setSuccess(
        mode === 'create'
          ? 'Habit created successfully.'
          : 'Habit updated successfully.'
      )
      window.setTimeout(() => {
        onCancel()
      }, 550)
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form className="habit-form" onSubmit={handleSubmit}>
      {error && <div className="habit-form__error">{error}</div>}
      {success && <div className="habit-form__success">{success}</div>}

      <label>
        Habit Name
        <input
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="e.g. Morning Workout"
          required
          autoFocus
          disabled={saving}
        />
      </label>

      <label>
        Description
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="What does this habit involve?"
          disabled={saving}
        />
      </label>

      <div className="habit-form__row">
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            required
            disabled={saving}
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
            value={form.frequency}
            onChange={(e) => updateField('frequency', e.target.value)}
            required
            disabled={saving}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
        </label>
      </div>

      <label>
        Start Date
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => updateField('startDate', e.target.value)}
          required
          disabled={saving}
        />
      </label>

      <label>
        Optional Notes
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Any extra notes for this habit"
          disabled={saving}
        />
      </label>

      <div className="habit-form__actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving
            ? 'Saving...'
            : mode === 'create'
              ? 'Create Habit'
              : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

export default HabitForm
