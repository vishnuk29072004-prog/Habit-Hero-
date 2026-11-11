import {
  Archive,
  CheckCircle2,
  Filter,
  ListChecks,
  Pencil,
  Percent,
  PlusCircle,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import './FeatureStatus.css'

const FEATURES = [
  { id: 'view', name: 'View Habits', icon: ListChecks, status: 'completed' },
  { id: 'add', name: 'Add Habit', icon: PlusCircle, status: 'completed' },
  { id: 'edit', name: 'Edit Habit', icon: Pencil, status: 'completed' },
  { id: 'delete', name: 'Delete Habit', icon: Trash2, status: 'completed' },
  { id: 'search', name: 'Search', icon: Search, status: 'completed' },
  { id: 'category', name: 'Category Filter', icon: Filter, status: 'completed' },
  { id: 'frequency', name: 'Frequency Filter', icon: Archive, status: 'completed' },
  { id: 'completion', name: 'Completion', icon: CheckCircle2, status: 'completed' },
  { id: 'progress', name: 'Progress', icon: Percent, status: 'completed' },
  { id: 'persistence', name: 'Persistence', icon: Save, status: 'completed' },
]

const STATUS_LABEL = {
  completed: 'Completed',
  progress: 'In Progress',
  pending: 'Pending',
}

function FeatureStatus() {
  return (
    <section className="feature-status card">
      <div className="feature-status__header">
        <h2>Feature Status</h2>
      </div>

      <div className="feature-status__table-wrap">
        <table className="feature-status__table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Functionality</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <tr key={feature.id}>
                  <td>
                    <span className="feature-status__name">
                      <Icon size={15} />
                      {feature.name}
                    </span>
                  </td>
                  <td>Available</td>
                  <td>
                    <span
                      className={`feature-status__badge is-${feature.status}`}
                    >
                      {STATUS_LABEL[feature.status]}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default FeatureStatus
