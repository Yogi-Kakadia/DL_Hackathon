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

const API_BASE = 'http://localhost:8001'

const _savedProfile = JSON.parse(localStorage.getItem('hpe_user_profile') || 'null');
const _savedUid     = _savedProfile?.user_id || localStorage.getItem('hpe_user_id') || 'demo_user_001'
const _savedPersona = localStorage.getItem('hpe_persona')     || null
const _savedCold    = localStorage.getItem('hpe_cold_start') === 'true'

const DEFAULT_CTX = {
  user_id:          _savedUid,
  mood:             'neutral',
  bpm:              72,
  ambient_noise:    30,
  time_of_day:      'Morning',
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

  const lastHappyTime = useRef(0)
  
  useEffect(() => {
    if (isColdStart || !attention?.cameraEnabled) return;

    let timeoutId;
    const rawMood = attention?.detectedMood || 'neutral';
    const targetMood = (rawMood.toLowerCase() === 'happy') ? 'happy' : 'neutral';

    if (targetMood === 'happy') {
       if (context.mood !== 'happy') {
          lastHappyTime.current = Date.now();
          setContext(prev => ({ ...prev, mood: 'happy' }));
          fetchRecommendations({ ...context, mood: 'happy' });
       } else {
          lastHappyTime.current = Date.now(); // Reset lock timer
       }
    } else {
       if (context.mood === 'happy') {
          const timeSinceHappy = Date.now() - lastHappyTime.current;
          if (timeSinceHappy > 30000) {
             setContext(prev => ({ ...prev, mood: 'neutral' }));
             fetchRecommendations({ ...context, mood: 'neutral' });
          } else {
             timeoutId = setTimeout(() => {
                setContext(prev => ({ ...prev, mood: 'neutral' }));
                fetchRecommendations({ ...context, mood: 'neutral' });
             }, 30000 - timeSinceHappy);
          }
       } else if (context.mood !== 'neutral') {
          setContext(prev => ({ ...prev, mood: 'neutral' }));
       }
    }
    return () => clearTimeout(timeoutId);
  }, [attention?.detectedMood, attention?.cameraEnabled, isColdStart, context, fetchRecommendations]);

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
    for (let i = 0; i < Math.min(recs.length, DEMO_SEQUENCE.length); i++) {
        await new Promise(r => setTimeout(r, 700))
    }
    await fetchRecommendations()
    setIsAutoDemo(false)
  }, [])

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

  const updateContext = useCallback((updates) => {
    setContext(prev => ({ ...prev, ...updates }))
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
        stats={stats}
        explorationRate={explorationRate}
        latency={latency}
        isColdStart={isColdStart}
        activePersona={activePersona}
        isAutoDemo={isAutoDemo}
        attention={attention}
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
        />
      </main>

      {/* Right sidebar */}
      <aside className="app-stats-panel">
        <AgentStats stats={stats} onRefresh={fetchStats} />
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
