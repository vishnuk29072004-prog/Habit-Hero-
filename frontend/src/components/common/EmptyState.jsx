import './EmptyState.css'

function EmptyState({
  title = 'No activity yet',
  description = 'There is nothing to show for this date.',
  icon: Icon,
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state__icon">
          <Icon size={22} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

export default EmptyState
