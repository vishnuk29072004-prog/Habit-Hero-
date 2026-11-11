import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { STORAGE_KEY } from '../../data/mockData'
import Loader from '../../components/common/Loader'
import GoogleCalendarSettings from '../../components/settings/GoogleCalendarSettings'
import './Settings.css'

const REMINDER_FIELDS = [
  { key: 'notificationsEnabled', label: 'Enable notifications' },
  { key: 'remindHabitsDaily', label: 'Daily habit reminders' },
  { key: 'remindHabitsWeekly', label: 'Weekly habit reminders' },
  { key: 'remindHabitsUpcoming', label: 'Upcoming habit reminders' },
  { key: 'remindHabitsOverdue', label: 'Overdue habit reminders' },
  { key: 'remindGoalDeadlines', label: 'Goal deadline reminders' },
  { key: 'remindStreakMilestones', label: 'Streak milestone reminders' },
  { key: 'remindWeeklySummary', label: 'Weekly summary' },
]

function Settings() {
  const { user, settings, refreshSettings, updateSettings } = useAuth()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    refreshSettings()
      .then((prefs) => {
        if (active) setForm(prefs)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshSettings])

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const dirtyPatch = useMemo(() => {
    if (!form || !settings) return {}
    const patch = {}
    if (form.streakGoalTarget !== settings.streakGoalTarget) {
      patch.streakGoalTarget = Number(form.streakGoalTarget)
    }
    for (const field of REMINDER_FIELDS) {
      if (form[field.key] !== settings[field.key]) {
        patch[field.key] = Boolean(form[field.key])
      }
    }
    return patch
  }, [form, settings])

  const clearHabitData = () => {
    const confirmed = window.confirm(
      'Clear local habit tracking data? This cannot be undone on this device.'
    )
    if (!confirmed) return
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!Object.keys(dirtyPatch).length) {
      setMessage('No changes to save.')
      return
    }
    const target = dirtyPatch.streakGoalTarget
    if (
      target != null &&
      (!Number.isInteger(target) || target < 1 || target > 365)
    ) {
      setError('Streak goal target must be an integer between 1 and 365.')
      return
    }

    setSaving(true)
    try {
      const saved = await updateSettings(dirtyPatch)
      setForm(saved)
      setMessage('Settings saved successfully.')
    } catch (err) {
      setError(err.message || 'Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <header>
        <h1>Settings</h1>
        <p>Manage preferences and account options.</p>
      </header>

      {error && <div className="settings-page__alert is-error">{error}</div>}
      {message && (
        <div className="settings-page__alert is-success">{message}</div>
      )}

      <section className="card settings-page__card">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{user?.fullName}</strong> ({user?.email})
        </p>
        <Link to="/profile" className="btn-primary">
          Open profile
        </Link>
      </section>

      <section className="card settings-page__card">
        <h2>Preferences</h2>
        {loading || !form ? (
          <Loader label="Loading settings..." />
        ) : (
          <form className="settings-page__form" onSubmit={handleSave}>
            <label className="settings-page__field">
              Streak goal target (days)
              <input
                type="number"
                min={1}
                max={365}
                value={form.streakGoalTarget}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    streakGoalTarget: Number(e.target.value),
                  }))
                }
              />
            </label>

            <fieldset className="settings-page__fieldset">
              <legend>Reminders</legend>
              {REMINDER_FIELDS.map((field) => (
                <label key={field.key} className="settings-page__check">
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.key])}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.checked,
                      }))
                    }
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader label="Saving..." /> : 'Save preferences'}
            </button>
          </form>
        )}
      </section>

      <GoogleCalendarSettings />

      <section className="card settings-page__card">
        <h2>Data</h2>
        <p>
          Habit check-ins are still stored locally in this browser until habit
          sync is connected. Clearing data resets that local history only.
        </p>
        <button type="button" className="btn-danger" onClick={clearHabitData}>
          Clear habit data
        </button>
      </section>
    </div>
  )
}

export default Settings
