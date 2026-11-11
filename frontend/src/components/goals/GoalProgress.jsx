import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import EmptyState from '../common/EmptyState'
import './GoalProgress.css'

function GoalProgress({ summary }) {
  const { completed, active, notStarted, overdue, completionRate, total } =
    summary
  const inProgress = active + overdue

  const gaugeData = [
    { name: 'done', value: completionRate },
    { name: 'rest', value: Math.max(0, 100 - completionRate) },
  ]

  return (
    <section className="goal-progress card">
      <div className="goal-progress__head">
        <h2>Goal Progress</h2>
        <p>Your overall goal completion this month.</p>
      </div>

      {!total ? (
        <EmptyState
          title="No goals yet"
          description="Create a goal to track overall completion."
        />
      ) : (
        <div className="goal-progress__body">
          <div className="goal-progress__gauge">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  dataKey="value"
                  startAngle={210}
                  endAngle={-30}
                  innerRadius="72%"
                  outerRadius="92%"
                  stroke="none"
                >
                  <Cell fill="#1463F3" />
                  <Cell fill="#E8EEF8" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="goal-progress__center">
              <strong>{completionRate}%</strong>
              <span>Goal Completion</span>
            </div>
          </div>

          <ul className="goal-progress__legend">
            <li>
              <span style={{ background: '#16A34A' }} />
              <em>Completed</em>
              <strong>{completed}</strong>
            </li>
            <li>
              <span style={{ background: '#1463F3' }} />
              <em>In Progress</em>
              <strong>{inProgress}</strong>
            </li>
            <li>
              <span style={{ background: '#CBD5E1' }} />
              <em>Not Started</em>
              <strong>{notStarted}</strong>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}

export default GoalProgress
