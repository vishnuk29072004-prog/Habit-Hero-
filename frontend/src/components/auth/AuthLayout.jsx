import BrandLogo from '../common/BrandLogo'
import './AuthLayout.css'

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <BrandLogo to={null} size="lg" />
        <h1>{title}</h1>
        <p className="auth-layout__subtitle">{subtitle}</p>
        {children}
      </div>
      <div className="auth-layout__aside" aria-hidden="true">
        <div className="auth-layout__glow" />
        <h2>Build better habits every day</h2>
        <p>Track • Analyze • Grow with Habit Hero</p>
      </div>
    </div>
  )
}

export default AuthLayout
