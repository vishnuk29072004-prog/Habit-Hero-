import { Flame, Target, Trophy } from 'lucide-react'
import { getLatestAchievement } from '../../utils/goalCalculations'
import EmptyState from '../common/EmptyState'
import './Achievements.css'

const ICONS = {
  flame: Flame,
  trophy: Trophy,
  target: Target,
}

function Achievements({ unlocked, catalogue = [], summary = null }) {
  const latest = getLatestAchievement(unlocked)
  const Icon = latest ? ICONS[latest.icon] || Trophy : Trophy
  const earned = summary?.totalEarned ?? unlocked?.length ?? 0
  const available = summary?.totalAvailable ?? catalogue.length ?? 8

  return (
    <section className="achievements card">
      <h2>Achievements</h2>
      <p className="achievements__count">
        {earned} / {available} unlocked
      </p>
      {!latest ? (
        <EmptyState
          title="No achievements yet"
          description="Complete your first goal or build a streak to unlock badges."
        />
      ) : (
        <div className="achievements__body">
          <div className="achievements__badge" aria-hidden="true">
            <Icon size={28} />
          </div>
          <div>
            <strong>{latest.title}</strong>
            <p>{latest.body}</p>
            {latest.unlockedAt && (
              <small>Unlocked {latest.unlockedAt}</small>
            )}
          </div>
        </div>
      )}

      {catalogue.length > 0 && (
        <ul className="achievements__catalogue" aria-label="Achievement catalogue">
          {catalogue.map((item) => {
            const ItemIcon = ICONS[item.icon] || Trophy
            return (
              <li
                key={item.id}
                className={item.earned ? 'is-earned' : 'is-locked'}
              >
                <span aria-hidden="true">
                  <ItemIcon size={14} />
                </span>
                <em>{item.title}</em>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default Achievements
