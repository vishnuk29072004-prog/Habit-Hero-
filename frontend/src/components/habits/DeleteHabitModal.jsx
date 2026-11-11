import Modal from '../common/Modal'
import './DeleteHabitModal.css'

function DeleteHabitModal({ habit, onCancel, onConfirm }) {
  if (!habit) return null

  return (
    <Modal title="Delete Habit" onClose={onCancel}>
      <div className="delete-habit-modal">
        <p>
          Are you sure you want to delete <strong>{habit.name}</strong>? This
          removes the habit and its check-in history.
        </p>
        <div className="delete-habit-modal__actions">
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

export default DeleteHabitModal
