import { Sparkles, Brain, Lightbulb } from 'lucide-react'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import HabitSuggestions from '../../components/ai/HabitSuggestions'
import JournalMoodAnalysis from '../../components/ai/JournalMoodAnalysis'
import './AIInsights.css'

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function AIInsights() {
  return (
    <div className="ai-insights-page">
      <header className="ai-insights-page__header">
        <div className="ai-insights-page__title">
          <span className="ai-insights-page__icon" aria-hidden="true">
            <Sparkles size={26} />
          </span>
          <div>
            <h1>AI Insights</h1>
            <p>
              Personalized habit ideas and journal reflections powered by your own
              Habit Hero data.
            </p>
          </div>
        </div>
        <PageHeaderTools showDate={false} />
      </header>

      <section className="ai-insights-overview card" aria-labelledby="ai-overview-heading">
        <div className="ai-insights-overview__copy">
          <h2 id="ai-overview-heading">Your Personal AI Growth Assistant</h2>
          <p>
            Discover personalized habits, understand your motivation and turn your
            daily progress into meaningful improvements.
          </p>
          <ul className="ai-insights-overview__capabilities">
            <li>
              <Sparkles size={16} aria-hidden="true" />
              <span>
                <strong>Habit Suggestions</strong> — up to five practical habits
                based on your active routines and goals.
              </span>
            </li>
            <li>
              <Brain size={16} aria-hidden="true" />
              <span>
                <strong>Journal Mood Analysis</strong> — evidence-based mood and
                motivation patterns from your entries (needs at least three).
              </span>
            </li>
            <li>
              <Lightbulb size={16} aria-hidden="true" />
              <span>
                <strong>Practical recommendations</strong> — actionable ideas from
                analysis results, not invented statistics.
              </span>
            </li>
          </ul>
        </div>

        <div className="ai-insights-overview__shortcuts">
          <button
            type="button"
            className="btn-primary"
            onClick={() => scrollToSection('ai-habit-suggestions')}
          >
            <Sparkles size={16} aria-hidden="true" />
            Habit Suggestions
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => scrollToSection('ai-journal-analysis')}
          >
            <Brain size={16} aria-hidden="true" />
            Journal Analysis
          </button>
        </div>
      </section>

      <div id="ai-habit-suggestions" className="ai-insights-page__section">
        <HabitSuggestions />
      </div>

      <div id="ai-journal-analysis" className="ai-insights-page__section">
        <JournalMoodAnalysis />
      </div>
    </div>
  )
}

export default AIInsights
