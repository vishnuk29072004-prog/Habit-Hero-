import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Link2, RefreshCw, Unplug } from 'lucide-react'
import { googleCalendarApi } from '../../services/api/googleCalendarApi'
import Loader from '../common/Loader'
import './GoogleCalendarSettings.css'

function GoogleCalendarSettings() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    const res = await googleCalendarApi.status()
    setStatus(res?.data || res)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    refresh()
      .catch((err) => {
        if (active) setError(err?.message || 'Unable to load Google Calendar status.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'connected') {
      setMessage('Google Calendar connected successfully.')
      params.delete('google')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
    return () => {
      active = false
    }
  }, [refresh])

  const handleConnect = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await googleCalendarApi.connect()
      const url = res?.data?.authorization_url
      if (!url) throw new Error('Missing Google authorization URL.')
      window.location.assign(url)
    } catch (err) {
      setError(err?.message || 'Unable to start Google Calendar connection.')
      setBusy(false)
    }
  }

  const handleSync = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await googleCalendarApi.sync()
      const data = res?.data || {}
      setMessage(
        `Sync complete — created ${data.created ?? 0}, updated ${data.updated ?? 0}, removed ${data.deleted ?? 0}.`
      )
      await refresh()
    } catch (err) {
      setError(err?.message || 'Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (busy) return
    const ok = window.confirm('Disconnect Google Calendar from Habit Hero?')
    if (!ok) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await googleCalendarApi.disconnect()
      setMessage('Google Calendar disconnected.')
      await refresh()
    } catch (err) {
      setError(err?.message || 'Unable to disconnect.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="card settings-page__card google-cal-settings">
        <Loader label="Loading Google Calendar…" />
      </section>
    )
  }

  const connected = Boolean(status?.connected)
  const configured = status?.configured !== false

  return (
    <section className="card settings-page__card google-cal-settings">
      <div className="google-cal-settings__head">
        <h2>
          <CalendarDays size={18} aria-hidden="true" /> Google Calendar
        </h2>
        <p>
          Sync active Habit Hero habits as recurring events on your primary Google
          Calendar. Habit Hero remains the source of truth.
        </p>
      </div>

      {error && <div className="settings-page__alert is-error">{error}</div>}
      {message && <div className="settings-page__alert is-success">{message}</div>}

      {!configured && (
        <p className="google-cal-settings__note">
          Google Calendar is not configured on the server. Ask an admin to set
          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and
          TOKEN_ENCRYPTION_KEY.
        </p>
      )}

      <dl className="google-cal-settings__status">
        <div>
          <dt>Status</dt>
          <dd>{connected ? 'Connected' : 'Not connected'}</dd>
        </div>
        {connected && (
          <>
            <div>
              <dt>Account</dt>
              <dd>{status.email || 'Google account'}</dd>
            </div>
            <div>
              <dt>Last sync</dt>
              <dd>
                {status.last_sync_at || 'Never'}
                {status.last_sync_status ? ` (${status.last_sync_status})` : ''}
              </dd>
            </div>
          </>
        )}
      </dl>

      <div className="google-cal-settings__actions">
        {!connected ? (
          <button
            type="button"
            className="btn-primary"
            onClick={handleConnect}
            disabled={busy || !configured}
          >
            <Link2 size={16} aria-hidden="true" />
            {busy ? 'Redirecting…' : 'Connect Google Calendar'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSync}
              disabled={busy}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {busy ? 'Working…' : 'Sync Now'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDisconnect}
              disabled={busy}
            >
              <Unplug size={16} aria-hidden="true" />
              Disconnect
            </button>
          </>
        )}
      </div>
    </section>
  )
}

export default GoogleCalendarSettings
