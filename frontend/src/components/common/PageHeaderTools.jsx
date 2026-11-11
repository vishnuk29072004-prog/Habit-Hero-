import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Bell, CalendarDays, ChevronDown, X } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import DatePicker from './DatePicker'
import ProfileMenu from './ProfileMenu'
import { useClickOutside } from '../../hooks/useClickOutside'
import './PageHeaderTools.css'

function PageHeaderTools({ showDate = true }) {
  const {
    selectedDate,
    setSelectedDate,
    goPrevDay,
    goNextDay,
    notifications,
    notificationTotal,
    notificationUnread,
    notificationsLoading,
    notificationsError,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useHabits()
  const [notifOpen, setNotifOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const notifRef = useRef(null)
  const dateRef = useRef(null)

  useClickOutside(notifRef, () => setNotifOpen(false))
  useClickOutside(dateRef, () => setDateOpen(false))

  const openNotifications = async () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) {
      try {
        await loadNotifications({ page: 1, append: false })
      } catch {
        // Error shown in dropdown.
      }
    }
  }

  const markAllRead = async () => {
    if (markingAll || notificationUnread === 0) return
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
    } catch (err) {
      window.alert(err?.message || 'Unable to mark notifications as read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleSelect = async (item) => {
    if (!item?.unread) return
    try {
      await markNotificationRead(item.id)
    } catch (err) {
      window.alert(err?.message || 'Unable to mark notification as read.')
    }
  }

  const handleDelete = async (event, item) => {
    event.stopPropagation()
    try {
      await deleteNotification(item.id)
    } catch (err) {
      window.alert(err?.message || 'Unable to delete notification.')
    }
  }

  const loadMore = async () => {
    if (notificationsLoading) return
    if (notifications.length >= notificationTotal) return
    try {
      await loadNotifications({
        page: Math.floor(notifications.length / 20) + 1,
        append: true,
        forceRefresh: false,
      })
    } catch {
      // Error shown in dropdown.
    }
  }

  const hasMore = notifications.length < notificationTotal

  return (
    <div className="page-header-tools">
      {showDate && (
        <div className="page-header-tools__date-wrap" ref={dateRef}>
          <button
            type="button"
            className="page-header-tools__date"
            aria-label="Select date"
            aria-expanded={dateOpen}
            onClick={() => setDateOpen((open) => !open)}
          >
            <CalendarDays size={18} />
            <span>{format(selectedDate, 'EEE, MMM d, yyyy')}</span>
            <ChevronDown size={16} />
          </button>

          {dateOpen && (
            <div className="page-header-tools__datepicker">
              <DatePicker
                selectedDate={selectedDate}
                onSelect={(day) => {
                  setSelectedDate(day)
                  setDateOpen(false)
                }}
                onPrevDay={goPrevDay}
                onNextDay={goNextDay}
              />
            </div>
          )}
        </div>
      )}

      <div className="page-header-tools__notif" ref={notifRef}>
        <button
          type="button"
          className="page-header-tools__icon-btn"
          onClick={openNotifications}
          aria-label="Notifications"
          aria-expanded={notifOpen}
        >
          <Bell size={18} />
          {notificationUnread > 0 && (
            <span className="page-header-tools__dot" />
          )}
        </button>

        {notifOpen && (
          <div className="page-header-tools__dropdown">
            <div className="page-header-tools__dropdown-head">
              <h4>Notifications</h4>
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll || notificationUnread === 0}
              >
                Mark all read
              </button>
            </div>

            {notificationsError && (
              <div className="page-header-tools__status" role="alert">
                <span>{notificationsError}</span>
                <button
                  type="button"
                  onClick={() =>
                    loadNotifications({
                      page: 1,
                      append: false,
                      forceRefresh: true,
                    })
                  }
                >
                  Retry
                </button>
              </div>
            )}

            {!notificationsError &&
              notificationsLoading &&
              !notifications.length && (
                <p className="page-header-tools__empty">Loading…</p>
              )}

            {!notificationsError &&
              !notificationsLoading &&
              !notifications.length && (
                <p className="page-header-tools__empty">
                  You&apos;re all caught up. No notifications yet.
                </p>
              )}

            {notifications.length > 0 && (
              <ul aria-busy={notificationsLoading || undefined}>
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className={item.unread ? 'is-unread' : ''}
                  >
                    <button
                      type="button"
                      className="page-header-tools__item"
                      onClick={() => handleSelect(item)}
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                      </div>
                      <span>{item.time}</span>
                    </button>
                    <button
                      type="button"
                      className="page-header-tools__dismiss"
                      aria-label={`Delete ${item.title}`}
                      onClick={(event) => handleDelete(event, item)}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <button
                type="button"
                className="page-header-tools__more"
                disabled={notificationsLoading}
                onClick={loadMore}
              >
                {notificationsLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      <ProfileMenu />
    </div>
  )
}

export default PageHeaderTools
