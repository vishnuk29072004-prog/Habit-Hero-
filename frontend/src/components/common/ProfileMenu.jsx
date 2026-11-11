import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import './ProfileMenu.css'

function ProfileMenu() {
  const { user, avatarUrl, isAuthenticated, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useClickOutside(ref, () => setOpen(false))

  const handleAvatarClick = () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setOpen((value) => !value)
  }

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="profile-menu__avatar"
        aria-label="User profile"
        aria-expanded={open}
        onClick={handleAvatarClick}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="profile-menu__image" />
        ) : (
          <UserRound size={18} />
        )}
      </button>

      {open && isAuthenticated && (
        <div className="profile-menu__dropdown">
          <div className="profile-menu__user">
            <strong>{user?.fullName}</strong>
            <span>{user?.email}</span>
          </div>
          <Link to="/profile" onClick={() => setOpen(false)}>
            View profile
          </Link>
          <Link to="/profile?edit=1" onClick={() => setOpen(false)}>
            Edit profile
          </Link>
          <button type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
