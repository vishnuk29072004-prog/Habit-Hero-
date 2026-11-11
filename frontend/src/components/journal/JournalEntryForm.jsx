import { useState } from 'react'
import Modal from '../common/Modal'
import { JOURNAL_MOODS, JOURNAL_TAGS } from '../../utils/journalCalculations'
import './JournalEntryForm.css'

function buildForm(entry, defaultDate) {
  return {
    date: entry?.date || defaultDate,
    habitId: entry?.habitId || '',
    title: entry?.title || '',
    content: entry?.content || '',
    mood: entry?.mood || 'neutral',
    tags: entry?.tags || [],
  }
}

function JournalEntryForm({
  mode = 'create',
  entry = null,
  habits = [],
  defaultDate,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => buildForm(entry, defaultDate))
  const [error, setError] = useState('')

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  const toggleTag = (tag) => {
    setForm((prev) => {
      const has = prev.tags.includes(tag)
      return {
        ...prev,
        tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      }
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (submitting) return
    if (!form.date) {
      setError('Date is required.')
      return
    }
    if (!form.content.trim()) {
      setError('Journal description is required.')
      return
    }

    const habit = habits.find((h) => h.id === form.habitId)
    onSubmit({
      date: form.date,
      habitId: form.habitId || null,
      title: form.title.trim() || habit?.name || 'Daily Reflection',
      content: form.content.trim(),
      mood: form.mood,
      tags: form.tags,
    })
  }

  return (
    <Modal
      title={mode === 'edit' ? 'Edit Journal Entry' : 'New Journal Entry'}
      onClose={onCancel}
      wide
    >
      <form className="journal-entry-form" onSubmit={handleSubmit}>
        <div className="journal-entry-form__row">
          <label>
            Select Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              required
            />
          </label>
          <label>
            Select Habit
            <select
              value={form.habitId}
              onChange={(e) => update('habitId', e.target.value)}
            >
              <option value="">General daily entry</option>
              {habits
                .filter((h) => !h.archived)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <label>
          Journal Title (optional)
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Optional title"
          />
        </label>

        <label>
          Journal Description
          <textarea
            rows={4}
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
            placeholder="Reflect on your progress..."
            required
          />
        </label>

        <fieldset className="journal-entry-form__moods">
          <legend>Mood</legend>
          <div>
            {JOURNAL_MOODS.map((mood) => (
              <button
                key={mood.id}
                type="button"
                className={form.mood === mood.id ? 'is-active' : ''}
                onClick={() => update('mood', mood.id)}
              >
                {mood.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="journal-entry-form__tags">
          <legend>Tags (optional)</legend>
          <div>
            {JOURNAL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={form.tags.includes(tag) ? 'is-active' : ''}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="journal-entry-form__error">{error}</p>}

        <div className="journal-entry-form__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {mode === 'edit' ? 'Save Changes' : 'Save Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default JournalEntryForm
