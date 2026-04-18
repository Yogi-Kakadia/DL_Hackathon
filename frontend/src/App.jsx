import { useState, useRef, useCallback, useEffect } from 'react'
import './index.css'
import Header          from './components/Header'
import PersonaSelector from './components/PersonaSelector'
import ContextPanel    from './components/ContextPanel'
import ArticleFeed     from './components/ArticleFeed'
import AgentStats      from './components/AgentStats'
import PreferenceChart from './components/PreferenceChart'
import UserHistory     from './components/UserHistory'
import ToastContainer  from './components/ToastContainer'
import { useAttention, CameraPreview } from './components/AttentionTracker'
import FullArticleReader from './components/FullArticleReader'
import OnboardingModal   from './components/OnboardingModal'
import LandingPage       from './components/LandingPage'

const API_BASE = 'http://localhost:8001'

const _savedProfile = JSON.parse(localStorage.getItem('hpe_user_profile') || 'null');
const _savedUid     = _savedProfile?.user_id || localStorage.getItem('hpe_user_id') || 'demo_user_001'
const _savedPersona = localStorage.getItem('hpe_persona')     || null
const _savedCold    = localStorage.getItem('hpe_cold_start') === 'true'

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h >= 6  && h < 12) return 'Morning'
  if (h >= 12 && h < 17) return 'Afternoon'
  if (h >= 17 && h < 21) return 'Evening'
  return 'Night'
}

const DEFAULT_CTX = {
  user_id:          _savedUid,
  mood:             'neutral',
  bpm:              72,
  ambient_noise:    30,
  time_of_day:      getTimeOfDay(),
  reading_speed:    'medium',
  session_duration: 0,
}

const DEMO_SEQUENCE = ['like', 'like', 'read', 'skip', 'like', 'read', 'dislike', 'skip']

export default function App() {
  const [context,             setContext]             = useState(DEFAULT_CTX)
  const [recommendations,     setRecommendations]     = useState([])
  const [loading,             setLoading]             = useState(false)
  const [stats,               setStats]               = useState(null)
  const [latency,             setLatency]             = useState(null)
  const [explorationRate,     setExplorationRate]     = useState(null)
  const [toasts,              setToasts]              = useState([])
  const [feedbackGiven,       setFeedbackGiven]       = useState({})
  const [userHistory,         setUserHistory]         = useState([])
  const [isColdStart,         setIsColdStart]         = useState(_savedCold)
  const [activePersona,       setActivePersona]       = useState(_savedPersona)
  const [categoryPreferences, setCategoryPreferences] = useState({})
  const [isAutoDemo,          setIsAutoDemo]          = useState(false)
  const [readingArticle,      setReadingArticle]      = useState(null)
  const [userProfile,         setUserProfile]         = useState(_savedProfile)
  const [registeredUsers,     setRegisteredUsers]     = useState([])
  const [showLanding,         setShowLanding]         = useState(true)
  const [searchQuery,         setSearchQuery]         = useState('')

  const attention = useAttention()

  const resetUser = useCallback(() => {
    localStorage.removeItem('hpe_user_profile')
    setUserProfile(null)
  }, [])



  const articleRenderTime = useRef(attention?.getActiveReadingTime() || Date.now())
  const currentRecs = useRef([])

  const addToast = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, icon }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const fetchRecommendations = useCallback(async (ctxOverride = null) => {
    setLoading(true)
    setFeedbackGiven({})
    const baseCtx = ctxOverride || context
    const ctx = {
      ...baseCtx,
      age: userProfile?.age || 25,
      gender: userProfile?.demographics || 'Unknown',
      location: userProfile?.location || 'Unknown'
    }
    try {
      const res  = await fetch(`${API_BASE}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctx),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setRecommendations(data.recommendations)
        currentRecs.current = data.recommendations
        setLatency(data.latency_ms)
        setExplorationRate(data.exploration_rate)
        articleRenderTime.current = attention?.getActiveReadingTime() || Date.now()
        addToast(
          `${data.recommendations.length} items fetched · ${data.latency_ms}ms`,
          'success', '⚡'
        )
      }
    } catch {
      addToast('Cannot connect to backend', 'error', '❌')
    }
    setLoading(false)
  }, [context, userProfile, addToast])

  /* ── Auto time-of-day ── */
  useEffect(() => {
    const update = () => setContext(prev => ({ ...prev, time_of_day: getTimeOfDay() }))
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  /* ── Camera mood state machine ──
     happy detected 4s continuous  → activate happy (update left bar + fetch)
     once happy: neutral 20s continuous → revert to neutral (update left bar + fetch)
  ── */
  const happyTimerRef   = useRef(null)  // 4s timer to enter happy
  const neutralTimerRef = useRef(null)  // 20s timer to exit happy
  const moodActiveRef   = useRef(false) // whether happy mode is currently locked in
  const fetchRecsRef    = useRef(fetchRecommendations)
  useEffect(() => { fetchRecsRef.current = fetchRecommendations }, [fetchRecommendations])

  useEffect(() => {
    if (!attention?.cameraEnabled) {
      clearTimeout(happyTimerRef.current);  happyTimerRef.current  = null
      clearTimeout(neutralTimerRef.current); neutralTimerRef.current = null
      return
    }
    const isHappy = attention?.detectedMood?.toLowerCase() === 'happy'

    if (isHappy) {
      // Cancel the neutral-exit timer — camera is happy again
      if (neutralTimerRef.current) {
        clearTimeout(neutralTimerRef.current)
        neutralTimerRef.current = null
      }
      // Start 4s entry timer if not already happy and not already counting
      if (!moodActiveRef.current && !happyTimerRef.current) {
        happyTimerRef.current = setTimeout(() => {
          happyTimerRef.current = null
          moodActiveRef.current = true
          setContext(prev => {
            if (prev.mood === 'happy') return prev
            const next = { ...prev, mood: 'happy' }
            fetchRecsRef.current(next)
            return next
          })
        }, 4000)
      }
    } else {
      // Cancel 4s entry timer — mood dropped before 4s
      if (happyTimerRef.current) {
        clearTimeout(happyTimerRef.current)
        happyTimerRef.current = null
      }
      // If happy mode is active, start 20s exit timer
      if (moodActiveRef.current && !neutralTimerRef.current) {
        neutralTimerRef.current = setTimeout(() => {
          neutralTimerRef.current = null
          moodActiveRef.current   = false
          setContext(prev => {
            if (prev.mood !== 'happy') return prev
            const next = { ...prev, mood: 'neutral' }
            fetchRecsRef.current(next)
            return next
          })
        }, 20000)
      }
    }
  }, [attention?.detectedMood, attention?.cameraEnabled])

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(happyTimerRef.current)
    clearTimeout(neutralTimerRef.current)
  }, [])

  const sendFeedback = useCallback(async (articleId, action, advancedPayload = null) => {
    if (feedbackGiven[articleId]) return
    
    let dwellTime = 0;
    let scrollSpeed = 0;
    let sectionTimes = [];
    
    if (advancedPayload) {
        dwellTime = advancedPayload.dwell_time;
        scrollSpeed = advancedPayload.scroll_speed;
        sectionTimes = advancedPayload.section_times;
    } else {
        const nowActive = attention?.getActiveReadingTime() || Date.now()
        dwellTime = Math.round((nowActive - articleRenderTime.current) / 100) / 10
    }
    
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
          scroll_speed: scrollSpeed,
          section_times: sectionTimes,
          age: userProfile?.age || 25,
          gender: userProfile?.demographics || 'Unknown',
          location: userProfile?.location || 'Unknown'
        }),
      })
      const data = await res.json()
      if (data.status === 'learned') {
        const emoji = { like: '👍', read: '📖', skip: '⏭️', dislike: '👎' }[action] || '🔔'
        addToast(
          `Agent learned — reward: ${data.reward_given > 0 ? '+' : ''}${data.reward_given.toFixed(1)}`,
          data.reward_given > 0 ? 'success' : 'warning',
          emoji
        )
        fetchStats()
        fetchHistory()
        fetchPreferences()
        setTimeout(() => fetchRecommendations(), 900)
      }
    } catch { }
  }, [feedbackGiven, context.user_id, userProfile, addToast, attention])

  const autoDemo = useCallback(async () => {
    const recs = currentRecs.current
    if (recs.length === 0) return
    setIsAutoDemo(true)
    const count = Math.min(recs.length, DEMO_SEQUENCE.length)
    for (let i = 0; i < count; i++) {
      await new Promise(r => setTimeout(r, 900))
      await sendFeedback(recs[i].id, DEMO_SEQUENCE[i])
    }
    setIsAutoDemo(false)
  }, [sendFeedback])

  const resetColdStart = useCallback(async (uid = context.user_id) => {
      setIsColdStart(true)
  }, [context.user_id])

  const selectPersona = useCallback(async (persona, isCustomUser=false) => {
    setActivePersona(persona.id)
    setRecommendations([])
    currentRecs.current = []
    setFeedbackGiven({})

    if (isCustomUser) {
      const newCtx = { ...DEFAULT_CTX, user_id: persona.user_id }
      setContext(newCtx)
      setUserProfile(persona)
      localStorage.setItem('hpe_user_profile', JSON.stringify(persona))
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
        addToast(`Loaded profile`, 'success', persona.emoji)
        fetchStats()
        await fetchRecommendations(newCtx)
      }
    } catch {}
    setLoading(false)
  }, [addToast, fetchRecommendations]) 

  const updateContext = useCallback((keyOrObject, value) => {
    if (typeof keyOrObject === 'string') {
      setContext(prev => ({ ...prev, [keyOrObject]: value }))
    } else {
      setContext(prev => ({ ...prev, ...keyOrObject }))
    }
  }, [])

  useEffect(() => {
    if (activePersona) localStorage.setItem('hpe_persona', activePersona)
  }, [activePersona])

  useEffect(() => {
    localStorage.setItem('hpe_cold_start', String(isColdStart))
  }, [isColdStart])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users`)
      const data = await res.json()
      if (data.status === 'success') {
        setRegisteredUsers(data.users)
      }
    } catch {}
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      const d   = await res.json()
      if (d.status === 'success') {
        setStats(d.stats)
        setIsColdStart(d.stats.is_cold_start)
      }
    } catch {}
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/history/${context.user_id}`)
      const d   = await res.json()
      if (d.status === 'success') setUserHistory(d.history)
    } catch {}
  }, [context.user_id])

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/preferences/${context.user_id}`)
      const d   = await res.json()
      if (d.status === 'success') setCategoryPreferences(d.preferences)
    } catch {}
  }, [context.user_id])

  useEffect(() => {
    fetchStats()
    fetchUsers()
    if (_savedUid) {
      fetchHistory()
      fetchPreferences()
    }
  }, []) 

  if (showLanding) {
    return (
      <LandingPage
        onEnter={() => setShowLanding(false)}
        hasProfile={!!userProfile}
        registeredUsers={registeredUsers}
      />
    )
  }

  if (!userProfile) {
    return (
      <OnboardingModal
        onComplete={(userId, name) => {
          const profile = JSON.parse(localStorage.getItem('hpe_user_profile'));
          setUserProfile(profile);
          setContext(prev => ({ ...prev, user_id: userId }));
          fetchUsers();
          setTimeout(() => fetchRecommendations(), 500);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <Header
        userName={userProfile.name}
        onReset={resetUser}
        explorationRate={explorationRate}
        latency={latency}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onBrandClick={() => setShowLanding(true)}
      />

      {/* Left sidebar */}
      <aside className="app-sidebar">
        <PersonaSelector
          activePersona={activePersona}
          onSelectPersona={selectPersona}
          loading={loading}
          registeredUsers={registeredUsers}
          onCreateNew={resetUser}
          onDeleteUser={async (uid) => {
            await fetch(`${API_BASE}/user/${uid}`, { method: 'DELETE' });
            if (userProfile?.user_id === uid) resetUser();
            fetchUsers();
          }}
        />
        <ContextPanel 
          context={context} 
          updateContext={updateContext}
          onRecommend={() => fetchRecommendations()}
          onColdStart={() => {}}
          disabled={loading}
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
          onAutoDemo={autoDemo}
          isAutoDemo={isAutoDemo}
          preferences={categoryPreferences}
          stats={stats}
          onReadReq={(article) => setReadingArticle(article)}
          onRefresh={() => fetchRecommendations()}
          searchQuery={searchQuery}
        />
      </main>

      {/* Right sidebar */}
      <aside className="app-stats-panel">
        <AgentStats
          stats={stats}
          onRefresh={fetchStats}
          attention={attention}
          explorationRate={explorationRate}
        />
        <PreferenceChart preferences={categoryPreferences} />
        <UserHistory history={userHistory} />
      </aside>

      <ToastContainer toasts={toasts} />
      
      {readingArticle && (
        <FullArticleReader 
          article={readingArticle}
          onCancel={() => setReadingArticle(null)}
          onAction={(id, payload) => {
            setReadingArticle(null);
            sendFeedback(id, payload.action, payload);
          }}
        />
      )}
    </div>
  )
}
