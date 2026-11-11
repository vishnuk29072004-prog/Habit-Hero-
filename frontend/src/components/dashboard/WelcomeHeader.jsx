import { format } from 'date-fns'
import { useHabits } from '../../context/HabitContext'
import { useAuth } from '../../context/AuthContext'
import PageHeaderTools from '../common/PageHeaderTools'
import './WelcomeHeader.css'

function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function WelcomeHeader() {
  const { user } = useAuth()
  const { selectedDate, isToday } = useHabits()
  const userName = user?.fullName?.split(' ')[0] || 'there'

  const subtitle = isToday
    ? "Here's your habit progress and insights for today."
    : `Here's your habit progress and insights for ${format(selectedDate, 'MMM d, yyyy')}.`

  return (
    <section className="welcome-header">
      <div className="welcome-header__text">
        <h1>
          {getGreeting()}, {userName}{' '}
          <span aria-hidden="true">👋</span>
        </h1>
        <p>{subtitle}</p>
      </div>

      <PageHeaderTools />
    </section>
  )
}

export default WelcomeHeader
