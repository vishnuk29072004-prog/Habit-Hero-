import Modal from '../common/Modal'
import './DeleteGoalModal.css'

function DeleteGoalModal({ goal, onCancel, onConfirm }) {
  if (!goal) return null

  return (
    <Modal title="Delete Goal" onClose={onCancel}>
      <div className="delete-goal-modal">
        <p>
          Are you sure you want to delete <strong>{goal.name}</strong>? The
          linked habit and its check-in history will not be removed.
        </p>
        <div className="delete-goal-modal__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeleteGoalModal
