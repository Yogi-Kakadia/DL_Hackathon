import { useState } from 'react'
import './index.css'
import Header from './components/Header'
import ContextPanel from './components/ContextPanel'
import ArticleFeed from './components/ArticleFeed'
import AgentStats from './components/AgentStats'
import ToastContainer from './components/ToastContainer'

const API_BASE = 'http://localhost:8001'

function App() {
  // ── State ─────────────────────────────────────────────────
  const [context, setContext] = useState({
    user_id: 'demo_user_001',
    mood: 'happy',
    bpm: 72,
    ambient_noise: 30,
    time_of_day: 'Morning',
    reading_speed: 'medium',
    session_duration: 0,
  })

  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [latency, setLatency] = useState(null)
  const [explorationRate, setExplorationRate] = useState(null)
  const [toasts, setToasts] = useState([])
  const [feedbackGiven, setFeedbackGiven] = useState({})

  // ── Toast helper ──────────────────────────────────────────
  const addToast = (message, type = 'info', icon = 'ℹ️') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type, icon }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }

  // ── Fetch Recommendations ────────────────────────────────
  const fetchRecommendations = async () => {
    setLoading(true)
    setFeedbackGiven({})
    try {
      const res = await fetch(`${API_BASE}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setRecommendations(data.recommendations)
        setLatency(data.latency_ms)
        setExplorationRate(data.exploration_rate)
        addToast(`${data.recommendations.length} articles recommended in ${data.latency_ms}ms`, 'success', '⚡')
      }
    } catch (err) {
      addToast('Failed to connect to backend. Is it running?', 'error', '❌')
      console.error(err)
    }
    setLoading(false)
  }

  // ── Send Feedback ─────────────────────────────────────────
  const sendFeedback = async (articleId, action) => {
    // Prevent duplicate feedback on same article
    if (feedbackGiven[articleId]) return

    setFeedbackGiven(prev => ({ ...prev, [articleId]: action }))

    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: context.user_id,
          article_id: articleId,
          action: action,
          dwell_time: action === 'read' ? 15.0 : 0,
        }),
      })
      const data = await res.json()
      if (data.status === 'learned') {
        const emoji = action === 'like' ? '👍' : action === 'read' ? '📖' : action === 'skip' ? '⏭️' : '👎'
        addToast(
          `Agent learned from "${action}" (reward: ${data.reward_given > 0 ? '+' : ''}${data.reward_given})`,
          data.reward_given > 0 ? 'success' : 'warning',
          emoji
        )
        // Refresh stats
        fetchStats()
      }
    } catch (err) {
      console.error('Feedback error:', err)
    }
  }

  // ── Fetch Stats ───────────────────────────────────────────
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      const data = await res.json()
      if (data.status === 'success') {
        setStats(data.stats)
      }
    } catch (err) {
      // silently fail on stats
    }
  }

  // ── Context updater ───────────────────────────────────────
  const updateContext = (key, value) => {
    setContext(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="app-layout">
      <Header
        stats={stats}
        explorationRate={explorationRate}
        latency={latency}
      />

      <aside className="app-sidebar">
        <ContextPanel
          context={context}
          updateContext={updateContext}
          onRecommend={fetchRecommendations}
          loading={loading}
        />
        <AgentStats stats={stats} onRefresh={fetchStats} />
      </aside>

      <main className="app-main">
        <ArticleFeed
          recommendations={recommendations}
          latency={latency}
          explorationRate={explorationRate}
          context={context}
          onFeedback={sendFeedback}
          feedbackGiven={feedbackGiven}
          loading={loading}
        />
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}

export default App
