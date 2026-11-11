import { Flame } from 'lucide-react'
import './CurrentStreak.css'

function CurrentStreak({ streakDays = 0 }) {
  return (
    <section className="current-streak card card-deco-red">
      <h2>Current Streak</h2>
      <div className="current-streak__body">
        <div className="current-streak__icon">
          <Flame size={26} strokeWidth={2.2} />
        </div>
        <div>
          <strong>{streakDays} Days</strong>
          <p>Keep going! You&apos;re on fire!</p>
        </div>
      </div>
    </section>
  )
}

export default CurrentStreak
