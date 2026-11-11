import Modal from '../common/Modal'
import './DeleteJournalModal.css'

function DeleteJournalModal({ entry, onCancel, onConfirm }) {
  if (!entry) return null

  return (
    <Modal title="Delete Journal Entry" onClose={onCancel}>
      <div className="delete-journal-modal">
        <p>Are you sure you want to delete this journal entry?</p>
        <div className="delete-journal-modal__actions">
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

export default DeleteJournalModal
