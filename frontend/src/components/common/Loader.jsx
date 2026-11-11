import './Loader.css'

function Loader({ label = 'Loading...' }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader__spinner" />
      <span>{label}</span>
    </div>
  )
}

export default Loader
