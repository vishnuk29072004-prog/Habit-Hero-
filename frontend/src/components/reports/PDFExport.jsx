import { useState } from 'react'
import { Download, FileDown } from 'lucide-react'
import Modal from '../common/Modal'
import { reportApi, toProgressPdfParams } from '../../services/api/reportApi'
import './PDFExport.css'

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || 'HabitHero_Progress_Report.pdf'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function PDFExport({
  open,
  onClose,
  defaultStartDate,
  defaultEndDate,
}) {
  const [startDate, setStartDate] = useState(defaultStartDate || '')
  const [endDate, setEndDate] = useState(defaultEndDate || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')

  if (!open) return null

  const handleDownload = async () => {
    if (loading) return
    setError(null)
    setSuccess('')
    try {
      toProgressPdfParams({ startDate, endDate })
    } catch (err) {
      setError(err?.message || 'Invalid date range')
      return
    }

    setLoading(true)
    try {
      const { blob, filename } = await reportApi.downloadProgressPdf({
        startDate,
        endDate,
      })
      if (!(blob instanceof Blob) || blob.size < 5) {
        throw new Error('The server returned an empty report.')
      }
      // Guard against JSON error payloads mislabeled as blobs.
      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Unable to download the progress report.'
        try {
          const parsed = JSON.parse(text)
          message = parsed.message || parsed.detail || message
        } catch {
          /* keep default */
        }
        throw new Error(message)
      }
      triggerBlobDownload(
        blob,
        filename || `HabitHero_Progress_Report_${startDate}_to_${endDate}.pdf`
      )
      setSuccess('Report downloaded successfully.')
    } catch (err) {
      setError(err?.message || 'Unable to download the progress report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Export Progress Report" onClose={loading ? () => {} : onClose}>
      <div className="pdf-export">
        <p className="pdf-export__intro">
          Download a Habit Hero PDF summarizing habits, streaks, categories, goals,
          and achievements for the selected period.
        </p>

        <div className="pdf-export__fields">
          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>

        {error && (
          <div className="pdf-export__banner is-error" role="alert">
            <span>{error}</span>
            <button type="button" className="btn-secondary" onClick={handleDownload} disabled={loading}>
              Retry
            </button>
          </div>
        )}

        {success && (
          <div className="pdf-export__banner is-success" role="status">
            {success}
          </div>
        )}

        {loading && (
          <div className="pdf-export__loading" aria-busy="true">
            Generating your PDF report…
          </div>
        )}

        <div className="pdf-export__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownload}
            disabled={loading}
          >
            <FileDown size={16} aria-hidden="true" />
            {loading ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function PDFExportButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="btn-secondary pdf-export-trigger"
      onClick={onClick}
      disabled={disabled}
    >
      <Download size={16} aria-hidden="true" />
      Export Report
    </button>
  )
}

export default PDFExport
