import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Repeat,
  CalendarDays,
  BarChart3,
  Target,
  BookOpen,
  Sparkles,
  Settings,
  X,
} from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import BrandLogo from '../common/BrandLogo'
import './Sidebar.css'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/habits', label: 'Habit Management', icon: Repeat },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/ai-insights', label: 'AI Insights', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useHabits()

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <>
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`}
        onClick={closeSidebar}
        aria-hidden={!sidebarOpen}
      />

      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <BrandLogo to="/" size="md" />
          </div>
          <button
            type="button"
            className="sidebar__close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'is-active' : ''}`
              }
              onClick={closeSidebar}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__promo card">
          <h3>Build Better Habits</h3>
          <p>Track • Analyze • Grow</p>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
