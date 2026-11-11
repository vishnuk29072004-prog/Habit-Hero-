import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../../components/auth/AuthLayout'
import Loader from '../../components/common/Loader'
import { useAuth } from '../../context/AuthContext'
import './Signup.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Signup() {
  const { signup, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) {
    return (
      <div className="auth-boot">
        <Loader label="Loading..." />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }
    if (!emailPattern.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        'Password must include uppercase, lowercase, a digit, and a special character.'
      )
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await signup({ fullName, email, password })
      setSuccess('Account created successfully. Redirecting...')
      setTimeout(() => navigate('/', { replace: true }), 600)
    } catch (err) {
      setError(err.message || 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building better habits with Habit Hero."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="auth-form__error">{error}</div>}
        {success && <div className="auth-form__success">{success}</div>}

        <label>
          Full name
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Vishnu"
            autoComplete="name"
            required
          />
        </label>

        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <div className="auth-form__password">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="auth-form__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <label>
          Confirm password
          <div className="auth-form__password">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="auth-form__toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button type="submit" className="auth-form__submit" disabled={loading}>
          {loading ? <Loader label="Creating account..." /> : 'Sign Up'}
        </button>

        <p className="auth-form__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default Signup
