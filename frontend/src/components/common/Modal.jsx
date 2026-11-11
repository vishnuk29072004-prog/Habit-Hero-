import { X } from 'lucide-react'
import './Modal.css'

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal__backdrop" onClick={onClose} />
      <div className={`app-modal__panel ${wide ? 'is-wide' : ''}`}>
        <div className="app-modal__head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="app-modal__body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
