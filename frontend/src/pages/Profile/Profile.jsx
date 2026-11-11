import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  ALLOWED_IMAGE_TYPES,
  validateProfileImage,
} from '../../services/profileImageService'
import Loader from '../../components/common/Loader'
import './Profile.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isStrongPassword(value) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

function Profile() {
  const {
    user,
    avatarUrl,
    updateProfile,
    changePassword,
    logout,
    saveAvatar,
    removeAvatar,
  } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setFullName(user?.fullName || '')
    setEmail(user?.email || '')
  }, [user])

  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true)
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setError('')
    setMessage('')
    if (!file) return

    const validationError = validateProfileImage(file)
    if (validationError) {
      setError(validationError)
      setPendingFile(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    setPendingFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleSaveAvatar = async () => {
    if (!pendingFile) {
      setError('Choose an image to upload first.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await saveAvatar(pendingFile)
      setMessage('Profile image updated.')
      setPendingFile(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    } catch (err) {
      setError(err.message || 'Unable to save profile image.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await removeAvatar()
      setPendingFile(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setMessage('Profile image removed.')
    } catch (err) {
      setError(err.message || 'Unable to remove profile image.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!fullName.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!emailPattern.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      await updateProfile({ fullName, email })
      setMessage('Profile updated successfully.')
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Unable to update profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.')
      return
    }
    if (!isStrongPassword(newPassword)) {
      setError(
        'New password must be at least 8 characters and include uppercase, lowercase, a digit, and a special character.'
      )
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setMessage('Password changed successfully. Your session was refreshed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Unable to change password.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayImage = previewUrl || avatarUrl

  return (
    <div className="profile-page">
      <header className="profile-page__header">
        <div>
          <h1>Profile</h1>
          <p>Manage your Habit Hero account details.</p>
        </div>
        <button type="button" className="profile-page__logout" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {error && <div className="profile-page__alert is-error">{error}</div>}
      {message && <div className="profile-page__alert is-success">{message}</div>}

      <section className="profile-page__card card">
        <h2>Profile image</h2>
        <div className="profile-page__avatar-row">
          <div className="profile-page__avatar-preview">
            {displayImage ? (
              <img src={displayImage} alt="Profile preview" />
            ) : (
              <UserRound size={36} />
            )}
          </div>
          <div className="profile-page__avatar-controls">
            <label className="profile-page__file">
              Choose image
              <input
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={handleFileChange}
              />
            </label>
            <div className="profile-page__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveAvatar}
                disabled={loading || !pendingFile}
              >
                {loading ? <Loader label="Saving..." /> : 'Save image'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRemoveAvatar}
                disabled={loading || (!avatarUrl && !previewUrl)}
              >
                Remove image
              </button>
            </div>
            <p className="profile-page__hint">
              JPG, JPEG, PNG, or WebP. Max 2 MB.
            </p>
          </div>
        </div>
      </section>

      <section className="profile-page__card card">
        <div className="profile-page__card-head">
          <h2>Account</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          )}
        </div>

        {!editing ? (
          <div className="profile-page__view">
            <div>
              <span>Full name</span>
              <strong>{user?.fullName}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email}</strong>
            </div>
          </div>
        ) : (
          <form className="profile-page__form" onSubmit={handleSaveProfile}>
            <label>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <div className="profile-page__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditing(false)
                  setFullName(user?.fullName || '')
                  setEmail(user?.email || '')
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Loader label="Saving..." /> : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="profile-page__card card">
        <h2>Change password</h2>
        <form className="profile-page__form" onSubmit={handleChangePassword}>
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <div className="profile-page__actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader label="Updating..." /> : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default Profile
