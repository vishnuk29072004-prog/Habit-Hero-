import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../../components/auth/AuthLayout'
import Loader from '../../components/common/Loader'
import { useAuth } from '../../context/AuthContext'
import './Login.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Login() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
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

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    if (!emailPattern.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      await login({ email, password })
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to log in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue tracking your habits."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="auth-form__error">{error}</div>}

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
              placeholder="Enter your password"
              autoComplete="current-password"
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

        <button type="submit" className="auth-form__submit" disabled={loading}>
          {loading ? <Loader label="Signing in..." /> : 'Log In'}
        </button>

        <p className="auth-form__footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default Login
