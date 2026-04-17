import { useState, useRef, useCallback } from 'react'
import './index.css'
import Header          from './components/Header'
import PersonaSelector from './components/PersonaSelector'
import ContextPanel    from './components/ContextPanel'
import ArticleFeed     from './components/ArticleFeed'
import AgentStats      from './components/AgentStats'
import PreferenceChart from './components/PreferenceChart'
import UserHistory     from './components/UserHistory'
import ToastContainer  from './components/ToastContainer'

const API_BASE = 'http://localhost:8001'

const DEFAULT_CTX = {
  user_id:          'demo_user_001',
  mood:             'happy',
  bpm:              72,
  ambient_noise:    30,
  time_of_day:      'Morning',
  reading_speed:    'medium',
  session_duration: 0,
}

export default function App() {
  // ── Core state ──────────────────────────────────────────
  const [context,             setContext]             = useState(DEFAULT_CTX)
  const [recommendations,     setRecommendations]     = useState([])
  const [loading,             setLoading]             = useState(false)
  const [stats,               setStats]               = useState(null)
  const [latency,             setLatency]             = useState(null)
  const [explorationRate,     setExplorationRate]     = useState(null)
  const [toasts,              setToasts]              = useState([])
  const [feedbackGiven,       setFeedbackGiven]       = useState({})
  const [userHistory,         setUserHistory]         = useState([])
  const [isColdStart,         setIsColdStart]         = useState(false)
  const [activePersona,       setActivePersona]       = useState(null)
  const [categoryPreferences, setCategoryPreferences] = useState({})

  const articleRenderTime = useRef(Date.now())

  // ── Toast ────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type, icon }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  // ── Fetch recommendations (accepts optional ctx override) ─
  const fetchRecommendations = useCallback(async (ctxOverride = null) => {
    setLoading(true)
    setFeedbackGiven({})
    const ctx = ctxOverride || context
    try {
      const res  = await fetch(`${API_BASE}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctx),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setRecommendations(data.recommendations)
        setLatency(data.latency_ms)
        setExplorationRate(data.exploration_rate)
        articleRenderTime.current = Date.now()
        addToast(
          `${data.recommendations.length} articles in ${data.latency_ms}ms · history: ${data.context_used?.history_len ?? 0} clicks`,
          'success', '⚡'
        )
      }
    } catch {
      addToast('Cannot connect to backend — is it running on port 8001?', 'error', '❌')
    }
    setLoading(false)
  }, [context, addToast])

  // ── Send feedback ─────────────────────────────────────────
  const sendFeedback = useCallback(async (articleId, action) => {
    if (feedbackGiven[articleId]) return
    const dwellTime = Math.round((Date.now() - articleRenderTime.current) / 100) / 10
    setFeedbackGiven(prev => ({ ...prev, [articleId]: action }))

    try {
      const res  = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:    context.user_id,
          article_id: articleId,
          action,
          dwell_time: dwellTime,
        }),
      })
      const data = await res.json()
      if (data.status === 'learned') {
        const emoji = { like: '👍', read: '📖', skip: '⏭️', dislike: '👎' }[action] || '🔔'
        addToast(
          `RL agent learned — reward: ${data.reward_given > 0 ? '+' : ''}${data.reward_given.toFixed(1)}, dwell: ${dwellTime}s`,
          data.reward_given > 0 ? 'success' : 'warning',
          emoji
        )
        fetchStats()
        fetchHistory()
        fetchPreferences()
      }
    } catch {
      /* silent */
    }
  }, [feedbackGiven, context.user_id, addToast])  // eslint-disable-line

  // ── Cold start reset ──────────────────────────────────────
  const resetColdStart = useCallback(async (uid = context.user_id) => {
    try {
      const res  = await fetch(`${API_BASE}/cold-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      })
      const data = await res.json()
      if (data.status === 'cold_start_activated') {
        setIsColdStart(true)
        setRecommendations([])
        setUserHistory([])
        setCategoryPreferences({})
        setFeedbackGiven({})
        setExplorationRate(1.0)
        fetchStats()
        addToast('New user — agent is in full exploration mode!', 'info', '🆕')
      }
    } catch {
      addToast('Failed to reset cold start.', 'error', '❌')
    }
  }, [context.user_id, addToast]) // eslint-disable-line

  // ── Select persona ────────────────────────────────────────
  const selectPersona = useCallback(async (persona) => {
    setActivePersona(persona.id)
    setRecommendations([])
    setFeedbackGiven({})

    if (persona.id === 'cold_start') {
      const newCtx = { ...DEFAULT_CTX, user_id: 'cold_start_user' }
      setContext(newCtx)
      setIsColdStart(true)
      setUserHistory([])
      setCategoryPreferences({})
      await resetColdStart('cold_start_user')
      await fetchRecommendations(newCtx)
      return
    }

    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/switch-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: persona.id, user_id: 'demo_user_001' }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        const newCtx = { ...data.default_context }
        setContext(newCtx)
        setIsColdStart(false)
        setUserHistory(data.history || [])
        setCategoryPreferences(data.preferences || {})
        addToast(
          `Loaded ${persona.name}'s profile — ${data.history_count} pre-trained interactions`,
          'success', persona.emoji
        )
        fetchStats()
        await fetchRecommendations(newCtx)
      }
    } catch {
      addToast('Failed to switch persona.', 'error', '❌')
    }
    setLoading(false)
  }, [addToast, resetColdStart, fetchRecommendations]) // eslint-disable-line

  // ── Stats / history / preferences pollers ────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      const d   = await res.json()
      if (d.status === 'success') {
        setStats(d.stats)
        setIsColdStart(d.stats.is_cold_start)
      }
    } catch { /* silent */ }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/history/${context.user_id}`)
      const d   = await res.json()
      if (d.status === 'success') setUserHistory(d.history)
    } catch { /* silent */ }
  }, [context.user_id])

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/preferences/${context.user_id}`)
      const d   = await res.json()
      if (d.status === 'success') setCategoryPreferences(d.preferences)
    } catch { /* silent */ }
  }, [context.user_id])

  const updateContext = useCallback((key, value) => {
    setContext(prev => ({ ...prev, [key]: value }))
  }, [])

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Header
        stats={stats}
        explorationRate={explorationRate}
        latency={latency}
        isColdStart={isColdStart}
        activePersona={activePersona}
      />

      {/* Left sidebar — Persona + Context */}
      <aside className="app-sidebar">
        <PersonaSelector
          activePersona={activePersona}
          onSelectPersona={selectPersona}
          loading={loading}
        />
        <ContextPanel
          context={context}
          updateContext={updateContext}
          onRecommend={() => fetchRecommendations()}
          onColdStart={() => {
            setActivePersona('cold_start')
            const newCtx = { ...DEFAULT_CTX, user_id: 'cold_start_user' }
            setContext(newCtx)
            resetColdStart('cold_start_user').then(() => fetchRecommendations(newCtx))
          }}
          loading={loading}
          isColdStart={isColdStart}
        />
      </aside>

      {/* Center — Article feed */}
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

      {/* Right sidebar — Stats, prefs, history */}
      <aside className="app-stats-panel">
        <AgentStats stats={stats} onRefresh={fetchStats} />
        <PreferenceChart preferences={categoryPreferences} />
        <UserHistory history={userHistory} />
      </aside>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
