import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import ProfileMenu from '../common/ProfileMenu'
import './Navbar.css'

function Navbar() {
  const { setSidebarOpen } = useHabits()
  const location = useLocation()
  const showProfile =
    location.pathname !== '/' &&
    location.pathname !== '/habits' &&
    location.pathname !== '/calendar' &&
    location.pathname !== '/analytics' &&
    location.pathname !== '/goals' &&
    location.pathname !== '/journal'

  return (
    <div className={`navbar ${showProfile ? 'has-profile' : ''}`}>
      <button
        type="button"
        className="navbar__menu"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="navbar__spacer" />
      {showProfile && (
        <div className="navbar__profile">
          <ProfileMenu />
        </div>
      )}
    </div>
  )
}

export default Navbar
