import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import EmptyState from '../common/EmptyState'
import './CategoryPerformance.css'

function CategoryPerformance({ categories }) {
  const totalScheduled = categories.reduce((sum, c) => sum + c.scheduled, 0)

  return (
    <section className="category-performance card">
      <div className="category-performance__head">
        <h2>Category Performance</h2>
        <p>Completion by category in this range.</p>
      </div>

      {!categories.length ? (
        <EmptyState
          title="No category data"
          description="Schedule habits in this range to see category completion."
        />
      ) : (
        <div className="category-performance__body">
          <div className="category-performance__donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {categories.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value}% (${props.payload.completed}/${props.payload.scheduled})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="category-performance__center">
              <strong>{totalScheduled}</strong>
              <span>Scheduled</span>
            </div>
          </div>

          <ul className="category-performance__legend">
            {categories.map((item) => (
              <li key={item.name}>
                <span style={{ background: item.color }} />
                <em>{item.name}</em>
                <strong>
                  {item.rate}% ({item.completed}/{item.scheduled})
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default CategoryPerformance
