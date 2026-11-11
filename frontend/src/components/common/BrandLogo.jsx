import { Link } from 'react-router-dom'
import './BrandLogo.css'

function BrandLogo({ to = '/', size = 'md', className = '' }) {
  const content = (
    <span className={`brand-logo brand-logo--${size} ${className}`.trim()}>
      <span className="brand-logo__habit">HABIT</span>
      <span className="brand-logo__hero">HERO</span>
    </span>
  )

  if (to) {
    return (
      <Link to={to} className="brand-logo-link" aria-label="Habit Hero home">
        {content}
      </Link>
    )
  }

  return content
}

export default BrandLogo
