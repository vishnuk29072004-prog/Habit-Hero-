import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Hourglass, MoreHorizontal, Pencil } from 'lucide-react'
import { getHabitIcon } from '../habits/habitIcons'
import {
  getEntryCompletionStatus,
  resolveEntryHabit,
} from '../../utils/journalCalculations'
import './JournalEntryCard.css'

function JournalEntryCard({ entry, habits, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const resolved = resolveEntryHabit(entry, habits)
  const status = getEntryCompletionStatus(entry, habits, entry.date)
  const Icon = getHabitIcon(resolved.icon)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDoc = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <article className="journal-entry-card card">
      <div className="journal-entry-card__icon" aria-hidden="true">
        <Icon size={20} />
      </div>

      <div className="journal-entry-card__body">
        <div className="journal-entry-card__top">
          <div>
            <h3>{resolved.name}</h3>
            {entry.title && entry.title !== resolved.name && (
              <p className="journal-entry-card__subtitle">{entry.title}</p>
            )}
          </div>
          {status && (
            <span className={`journal-entry-card__status is-${status}`}>
              {status === 'completed' ? (
                <CheckCircle2 size={14} />
              ) : (
                <Hourglass size={14} />
              )}
              {status === 'completed' ? 'Completed' : 'Pending'}
            </span>
          )}
          {resolved.general && (
            <span className="journal-entry-card__status is-general">General</span>
          )}
        </div>

        <div className="journal-entry-card__note">
          <p>{entry.content}</p>
        </div>
      </div>

      <div className="journal-entry-card__actions">
        <button
          type="button"
          aria-label={`Edit ${resolved.name} entry`}
          onClick={() => onEdit(entry)}
        >
          <Pencil size={16} />
        </button>
        <div className="journal-entry-card__more" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="journal-entry-card__menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit(entry)
                }}
              >
                Edit Entry
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(entry)
                }}
              >
                Delete Entry
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default JournalEntryCard
