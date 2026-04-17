import { useState, useRef } from 'react'
import './index.css'
import Header from './components/Header'
import ContextPanel from './components/ContextPanel'
import ArticleFeed from './components/ArticleFeed'
import AgentStats from './components/AgentStats'
import UserHistory from './components/UserHistory'
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
  const [userHistory, setUserHistory] = useState([])
  const [isColdStart, setIsColdStart] = useState(false)

  // Track when articles were rendered for dwell time calculation
  const articleRenderTime = useRef(Date.now())

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
        articleRenderTime.current = Date.now()
        addToast(`${data.recommendations.length} articles recommended in ${data.latency_ms}ms`, 'success', '⚡')
      }
    } catch (err) {
      addToast('Failed to connect to backend. Is it running?', 'error', '❌')
      console.error(err)
    }
    setLoading(false)
  }

  // ── Send Feedback with real dwell time ────────────────────
  const sendFeedback = async (articleId, action) => {
    if (feedbackGiven[articleId]) return

    // Calculate real dwell time in seconds
    const dwellTime = Math.round((Date.now() - articleRenderTime.current) / 1000 * 10) / 10

    setFeedbackGiven(prev => ({ ...prev, [articleId]: action }))

    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: context.user_id,
          article_id: articleId,
          action: action,
          dwell_time: dwellTime,
        }),
      })
      const data = await res.json()
      if (data.status === 'learned') {
        const emoji = action === 'like' ? '👍' : action === 'read' ? '📖' : action === 'skip' ? '⏭️' : '👎'
        addToast(
          `Agent learned from "${action}" (reward: ${data.reward_given > 0 ? '+' : ''}${data.reward_given}, dwell: ${dwellTime}s)`,
          data.reward_given > 0 ? 'success' : 'warning',
          emoji
        )
        fetchStats()
        fetchHistory()
      }
    } catch (err) {
      console.error('Feedback error:', err)
    }
  }

  // ── Cold Start Reset ──────────────────────────────────────
  const resetColdStart = async () => {
    try {
      const res = await fetch(`${API_BASE}/cold-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: context.user_id }),
      })
      const data = await res.json()
      if (data.status === 'cold_start_activated') {
        setIsColdStart(true)
        setRecommendations([])
        setUserHistory([])
        setFeedbackGiven({})
        setExplorationRate(1.0)
        addToast('New user mode! Agent is exploring diverse content.', 'info', '🆕')
        fetchStats()
      }
    } catch (err) {
      addToast('Failed to reset for cold start.', 'error', '❌')
    }
  }

  // ── Fetch Stats ───────────────────────────────────────────
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      const data = await res.json()
      if (data.status === 'success') {
        setStats(data.stats)
        setIsColdStart(data.stats.is_cold_start)
      }
    } catch (err) {
      // silently fail
    }
  }

  // ── Fetch User History ────────────────────────────────────
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history/${context.user_id}`)
      const data = await res.json()
      if (data.status === 'success') {
        setUserHistory(data.history)
      }
    } catch (err) {
      // silently fail
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
        isColdStart={isColdStart}
      />

      <aside className="app-sidebar">
        <ContextPanel
          context={context}
          updateContext={updateContext}
          onRecommend={fetchRecommendations}
          onColdStart={resetColdStart}
          loading={loading}
          isColdStart={isColdStart}
        />
        <AgentStats stats={stats} onRefresh={fetchStats} />
        <UserHistory history={userHistory} />
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
          isColdStart={isColdStart}
        />
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}

export default App
