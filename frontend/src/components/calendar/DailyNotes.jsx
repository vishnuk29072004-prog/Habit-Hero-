import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import './DailyNotes.css'

function DailyNotes({ dateKey, note, onSave, disabled = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note || '')

  useEffect(() => {
    setDraft(note || '')
    setEditing(false)
  }, [dateKey, note])

  const handleSave = async () => {
    try {
      await Promise.resolve(onSave(dateKey, draft.trim()))
      setEditing(false)
    } catch {
      // Parent surfaces errors; keep editor open for retry.
    }
  }

  return (
    <section className="daily-notes">
      <div className="daily-notes__header">
        <h3>Notes</h3>
        {!disabled && (
          <button
            type="button"
            onClick={() => (editing ? handleSave() : setEditing(true))}
            aria-label={editing ? 'Save notes' : 'Edit notes'}
          >
            <Pencil size={15} />
            {editing ? 'Save' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          className="daily-notes__input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for this day..."
          autoFocus
        />
      ) : note ? (
        <p className="daily-notes__text">{note}</p>
      ) : (
        <p className="daily-notes__empty">No notes for this date yet.</p>
      )}
    </section>
  )
}

export default DailyNotes
