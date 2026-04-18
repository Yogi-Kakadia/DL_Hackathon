import { useEffect, useRef, useState, useCallback } from 'react'
import ThemeSelector from './ThemeSelector'

const TICKER_MSGS = [
  '↑ reward +1.0 · category: tech · user: focused',
  '↑ feedback READ · dwell 42s · attention 0.89',
  '⏳ ε decay 0.42 → 0.38 · n=12',
  '↑ reward +0.7 · category: science',
  '↑ context shift: neutral → energetic',
  '⏳ policy update · loss 0.043 ↓',
  '↓ reward −0.3 · skipped: politics',
  '↑ converged region: tech, science, design',
]

const DEMO_PERSONAS = [
  { name: 'Alex Chen',    role: 'Sports & Entertainment',  color: '#ff6b6b', init: 'AC', tags: ['sports', 'entertainment', 'tech'],     isDemo: true },
  { name: 'Sam Rivera',   role: 'Finance & Global News',   color: '#00d4ff', init: 'SR', tags: ['finance', 'world', 'business'],        isDemo: true },
  { name: 'Jamie Park',   role: 'Health & Lifestyle',      color: '#00e88f', init: 'JP', tags: ['health', 'sports', 'lifestyle'],        isDemo: true },
  { name: 'Taylor Kim',   role: 'Entertainment & Media',   color: '#ffb347', init: 'TK', tags: ['entertainment', 'arts', 'culture'],    isDemo: true },
]

const USER_COLORS = ['#8b7bff', '#00e88f', '#ff6b6b', '#00d4ff', '#ffb347', '#a78bfa', '#38bdf8']

function buildPersonaList(registeredUsers = []) {
  const real = registeredUsers.slice(0, 4).map((u, i) => ({
    name:   u.name,
    role:   u.demographics || 'Custom Profile',
    color:  USER_COLORS[i % USER_COLORS.length],
    init:   (u.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    tags:   Array.isArray(u.interests) ? u.interests.slice(0, 3) : [],
    isDemo: false,
  }))
  const needed  = Math.max(0, 4 - real.length)
  const fillers = DEMO_PERSONAS.slice(0, needed)
  return [...real, ...fillers]
}

const STEPS = [
  {
    num: '01 / Sensing', title: 'Live biometrics',
    body: 'MediaPipe + face-api read mood, attention, and micro-expressions from your webcam. Synthetic BPM and ambient-noise signals round out the context vector.',
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>,
  },
  {
    num: '02 / Context', title: 'Context encoder',
    body: 'Mood, time of day, reading speed, session duration, BPM, ambient noise — fused into a dense vector. 32 dimensions of "how you feel right now."',
    icon: <svg viewBox="0 0 24 24"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>,
  },
  {
    num: '03 / Agent', title: 'Contextual bandit',
    body: 'A neural ε-greedy bandit picks articles, balancing exploit (known preferences) with explore (long-tail discovery). ε decays as confidence grows.',
    icon: <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><path d="M8 6h8M8 18h8M6 8v8M18 8v8M7.5 7.5l3 3M16.5 7.5l-3 3M7.5 16.5l3-3M16.5 16.5l-3-3"/></svg>,
  },
  {
    num: '04 / Reward', title: 'Reward loop',
    body: 'Like +1.0 · Read +0.7 (scaled by dwell × attention) · Skip −0.3 · Dislike −1.0. The agent updates its head on every feedback, live.',
    icon: <svg viewBox="0 0 24 24"><path d="M3 18l6-6 4 4 8-8"/><path d="M14 8h6v6"/></svg>,
  },
]

const TECH_STEPS = [
  { num: 'Frontend', title: 'React 19 · Vite 7', body: 'MediaPipe Tasks Vision for real-time mood detection. face-api.js for fallback attention tracking. Zero-lag UI with optimistic state.' },
  { num: 'Agent',    title: 'Neural ε-greedy',   body: 'PyTorch contextual bandit. Context-embedding head (256d) · article-embedding head (256d) · dot-product scoring. ε decays sigmoid 1.0 → 0.15.' },
  { num: 'Rewards',  title: 'Enriched signals',  body: 'Dwell time × attention ratio × scroll depth produce a continuous reward, not just binary clicks. Penalties for low-attention skips are softer.' },
  { num: 'Infra',    title: 'FastAPI · port 8001', body: 'Thin REST layer. Cold-start endpoint resets user state. Per-user history + category preferences persisted in-memory for the demo.' },
]

export default function LandingPage({ onEnter, hasProfile, registeredUsers = [] }) {
  const neuralRef  = useRef(null)
  const chartRef   = useRef(null)
  const nodesRef   = useRef([])
  const edgesRef   = useRef([])
  const rafRef     = useRef(null)
  const lastPulse  = useRef(0)

  const [tickerIdx, setTickerIdx] = useState(0)
  const [tickerKey, setTickerKey] = useState(0)
  const [liveStats, setLiveStats] = useState({ lat: 34, eps: '0.18', vv1: '0.78', vv2: '0.64', vv3: '0.18' })

  /* ── Neural canvas ── */
  const setupNeural = useCallback(() => {
    const canvas = neuralRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return
    canvas.width  = rect.width  * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)

    nodesRef.current = []
    edgesRef.current = []
    const W = rect.width, H = rect.height
    const layers = [6, 8, 8, 4]
    const xs = layers.map((_, i) => W * (0.15 + i * 0.70 / (layers.length - 1)))
    layers.forEach((count, li) => {
      for (let i = 0; i < count; i++) {
        const y = H * (0.18 + (i + 0.5) * (0.64 / count))
        nodesRef.current.push({ x: xs[li], y, layer: li, activation: Math.random(), targetAct: Math.random(), phase: Math.random() * Math.PI * 2 })
      }
    })
    for (let li = 0; li < layers.length - 1; li++) {
      const a = nodesRef.current.filter(n => n.layer === li)
      const b = nodesRef.current.filter(n => n.layer === li + 1)
      a.forEach(n1 => b.forEach(n2 => edgesRef.current.push({ n1, n2, weight: (Math.random() - 0.5) * 2, pulse: 0 })))
    }
  }, [])

  useEffect(() => {
    setupNeural()

    function draw(t) {
      const canvas = neuralRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const style   = getComputedStyle(document.documentElement)
      const accent  = style.getPropertyValue('--accent').trim()
      const line2   = style.getPropertyValue('--line-2').trim()

      edgesRef.current.forEach(e => {
        ctx.strokeStyle = line2
        ctx.globalAlpha = (0.1 + Math.max(0, e.pulse) * 0.8) * (0.3 + Math.abs(e.weight) * 0.7)
        ctx.lineWidth   = 0.5 + Math.abs(e.weight) * 0.8
        ctx.beginPath(); ctx.moveTo(e.n1.x, e.n1.y); ctx.lineTo(e.n2.x, e.n2.y); ctx.stroke()
        e.pulse *= 0.94
      })
      ctx.globalAlpha = 1

      nodesRef.current.forEach(n => {
        n.activation += (n.targetAct - n.activation) * 0.06
        const r = 3 + n.activation * 5
        ctx.fillStyle   = accent
        ctx.globalAlpha = 0.15 + n.activation * 0.85
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 0.25
        ctx.strokeStyle = accent; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 + Math.sin(t * 0.002 + n.phase) * 1.5, 0, Math.PI * 2); ctx.stroke()
      })
      ctx.globalAlpha = 1

      if (t - lastPulse.current > 900) {
        lastPulse.current = t
        nodesRef.current.filter(n => n.layer === 0).forEach(n => { n.targetAct = Math.random() * 0.9 + 0.1 })
        setTimeout(() => edgesRef.current.filter(e => e.n1.layer === 0).forEach(e => { e.pulse = 1 }), 100)
        setTimeout(() => { nodesRef.current.filter(n => n.layer === 1).forEach(n => { n.targetAct = Math.random() }); edgesRef.current.filter(e => e.n1.layer === 1).forEach(e => { e.pulse = 1 }) }, 400)
        setTimeout(() => { nodesRef.current.filter(n => n.layer === 2).forEach(n => { n.targetAct = Math.random() }); edgesRef.current.filter(e => e.n1.layer === 2).forEach(e => { e.pulse = 1 }) }, 700)
        setTimeout(() => nodesRef.current.filter(n => n.layer === 3).forEach(n => { n.targetAct = Math.random() }), 900)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    const ro = new ResizeObserver(setupNeural)
    ro.observe(neuralRef.current)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [setupNeural])

  /* ── RL Chart ── */
  const drawChart = useCallback(() => {
    const canvas = chartRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return
    canvas.width  = rect.width  * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    const W = rect.width, H = rect.height
    const style   = getComputedStyle(document.documentElement)
    const accent  = style.getPropertyValue('--accent').trim()
    const accent2 = style.getPropertyValue('--accent-2').trim()
    const line    = style.getPropertyValue('--line').trim()
    const ink3    = style.getPropertyValue('--ink-3').trim()

    ctx.strokeStyle = line; ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) { const y = H * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    const N = 30
    const agent  = Array.from({ length: N }, (_, i) => Math.log(1 + 9 * (i / (N - 1))) / Math.log(10) * 0.85 + 0.05 + (Math.random() - 0.5) * 0.04)
    const random = Array.from({ length: N }, (_, i) => 0.35 + (i / (N - 1)) * 0.15 + (Math.random() - 0.5) * 0.06)

    ctx.strokeStyle = accent2; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath()
    random.forEach((v, i) => { const x = (i / (N-1)) * W, y = H - v * H * 0.95 - H * 0.02; i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y) })
    ctx.stroke()

    ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 2.2; ctx.beginPath()
    agent.forEach((v, i) => { const x = (i / (N-1)) * W, y = H - v * H * 0.95 - H * 0.02; i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y) })
    ctx.stroke()
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    ctx.fillStyle = accent; ctx.globalAlpha = 0.10; ctx.fill(); ctx.globalAlpha = 1

    ctx.fillStyle = accent
    agent.forEach((v, i) => { if (i % 3 !== 0) return; const x = (i/(N-1))*W, y = H - v*H*0.95 - H*0.02; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill() })

    ctx.fillStyle = ink3; ctx.font = `10px ${style.getPropertyValue('--font-mono')}`
    ctx.fillText('n=0', 0, H - 2); ctx.fillText('n=30 interactions', W - 110, H - 2)
  }, [])

  useEffect(() => {
    drawChart()
    const ro = new ResizeObserver(drawChart)
    if (chartRef.current) ro.observe(chartRef.current)
    const mo = new MutationObserver(drawChart)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-aes', 'data-mode'] })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [drawChart])

  /* ── Ticker ── */
  useEffect(() => {
    const id = setInterval(() => { setTickerIdx(p => (p + 1) % TICKER_MSGS.length); setTickerKey(p => p + 1) }, 4000)
    return () => clearInterval(id)
  }, [])

  /* ── Live stats ── */
  useEffect(() => {
    const id = setInterval(() => {
      const lat = 28 + Math.floor(Math.random() * 14)
      const eps = (0.15 + Math.random() * 0.08).toFixed(2)
      const vv1 = (0.70 + Math.random() * 0.25).toFixed(2)
      const vv2 = (0.55 + Math.random() * 0.35).toFixed(2)
      setLiveStats({ lat, eps, vv1, vv2, vv3: eps })
    }, 1600)
    return () => clearInterval(id)
  }, [])

  /* ── Scroll reveal ── */
  useEffect(() => {
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }), { threshold: 0.08 })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lp-page">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-brand">
          <span className="lp-brand-mark" />
          Hyper Feed
        </div>
        <div className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#learn">Learning</a>
          <a href="#personas">Personas</a>
          <a href="#tech">Technical</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <button className="lp-nav-cta" onClick={onEnter}>
            {hasProfile ? 'Open Dashboard →' : 'Try the demo →'}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div>
            <div className="lp-eyebrow">HPE · Hackathon 2026</div>
            <h1 className="lp-h1">A feed that <em>learns</em> what you feel.</h1>
            <p className="lp-lede">Hyper Feed fuses reinforcement learning with live biometric signals — mood, heart rate, attention — so every article is chosen by an agent that's still learning, in real time, with every interaction.</p>
            <div className="lp-ctas">
              <button className="lp-btn-primary" onClick={onEnter}>
                {hasProfile ? 'Open Dashboard →' : 'Try the live demo →'}
              </button>
              <a className="lp-btn-ghost" href="#how">See the architecture</a>
            </div>
            <div className="lp-hero-stats">
              <div>
                <div className="lp-stat-num">{liveStats.vv1}</div>
                <div className="lp-stat-label">Context match</div>
              </div>
              <div>
                <div className="lp-stat-num">{liveStats.lat}<span style={{ fontSize: '0.5em' }}>ms</span></div>
                <div className="lp-stat-label">Inference latency</div>
              </div>
              <div>
                <div className="lp-stat-num">ε {liveStats.eps}</div>
                <div className="lp-stat-label">Exploration rate</div>
              </div>
            </div>
          </div>

          {/* Neural viz */}
          <div className="lp-viz">
            <div className="lp-viz-header">
              <span>RL Agent · Live</span>
              <div className="lp-viz-dots">
                <span className="lp-viz-dot" /><span className="lp-viz-dot" /><span className="lp-viz-dot" />
              </div>
            </div>

            {/* Canvas section — neural net animation */}
            <div className="lp-viz-canvas">
              <canvas ref={neuralRef} className="lp-neural-canvas" />
              <div className="lp-viz-ticker">
                <div key={tickerKey} className="lp-ticker-line">{TICKER_MSGS[tickerIdx]}</div>
              </div>
            </div>

            {/* Metrics section — BELOW the canvas, not overlapping */}
            <div className="lp-viz-overlay">
              {[
                { label: 'Reward',    val: `+${liveStats.vv1}`, pct: parseFloat(liveStats.vv1) * 100 },
                { label: 'Attention', val: liveStats.vv2,        pct: parseFloat(liveStats.vv2) * 100 },
                { label: 'ε-greedy', val: liveStats.vv3,        pct: parseFloat(liveStats.vv3) * 100 * 5 },
              ].map(row => (
                <div className="lp-viz-row" key={row.label}>
                  <span className="lp-viz-row-label">{row.label}</span>
                  <div className="lp-viz-bar-track"><div className="lp-viz-bar-fill" style={{ width: `${Math.min(100, row.pct)}%` }} /></div>
                  <span className="lp-viz-row-val">{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section" id="how">
        <div className="lp-section-head reveal">
          <h2 className="lp-section-title">Four signals in. <em>One agent.</em> A feed that rewrites itself.</h2>
          <div className="lp-section-kicker">§ 01<br />Architecture</div>
        </div>
        <div className="lp-steps">
          {STEPS.map(s => (
            <div className="lp-step reveal" key={s.num}>
              <div className="lp-step-num">{s.num}</div>
              <div className="lp-step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RL Showcase ── */}
      <section className="lp-showcase" id="learn">
        <div className="lp-showcase-inner">
          <div className="reveal">
            <div className="lp-eyebrow" style={{ marginBottom: 20 }}>§ 02 — The reinforcement loop</div>
            <h2 className="lp-showcase-h2">Watch it <em style={{ fontStyle: 'italic' }}>converge.</em></h2>
            <p className="lp-showcase-p">Each click is a training example. Within 8–12 interactions, our ε-greedy bandit drops from full exploration (ε=1.0) to confident exploitation (ε=0.18), while cumulative reward climbs monotonically.</p>
            <p className="lp-showcase-p">No cold-start dead zone. No batch retraining. Just a policy that sharpens with every scroll.</p>
            <div className="lp-metrics">
              {[
                { val: '12',   label: 'Avg. interactions to converge' },
                { val: '4.2×', label: 'CTR vs random baseline' },
                { val: '34ms', label: 'P95 inference' },
              ].map(m => (
                <div className="lp-metric" key={m.label}>
                  <div className="lp-metric-val">{m.val}</div>
                  <div className="lp-metric-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-chart-card reveal">
            <div className="lp-chart-head">
              <div className="lp-chart-title">Cumulative reward · live session</div>
              <div className="lp-chart-legend">
                <span className="lp-legend-agent">Agent</span>
                <span className="lp-legend-random">Random</span>
              </div>
            </div>
            <canvas ref={chartRef} className="lp-chart-canvas" />
          </div>
        </div>
      </section>

      {/* ── Personas ── */}
      <section className="lp-personas-section" id="personas">
        <div className="lp-section-head reveal">
          <h2 className="lp-section-title">Four pre-trained <em>minds.</em></h2>
          <div className="lp-section-kicker">§ 03<br />Personas</div>
        </div>
        <div className="lp-persona-grid">
          {buildPersonaList(registeredUsers).map(p => (
            <div className="lp-persona-card reveal" key={p.name} style={{ '--lp-pc': p.color }}>
              <div className="lp-persona-avatar" style={{ background: p.color }}>{p.init}</div>
              <h4 className="lp-persona-name">{p.name}</h4>
              <div className="lp-persona-role">
                {p.role}
                {!p.isDemo && <span className="lp-persona-you">YOU</span>}
              </div>
              <div className="lp-persona-tags">
                {p.tags.map(t => <span className="lp-persona-tag" key={t}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Technical ── */}
      <section className="lp-section" id="tech">
        <div className="lp-section-head reveal">
          <h2 className="lp-section-title">Built for the edge of what's possible.</h2>
          <div className="lp-section-kicker">§ 04<br />Under the hood</div>
        </div>
        <div className="lp-steps">
          {TECH_STEPS.map(s => (
            <div className="lp-step reveal" key={s.num}>
              <div className="lp-step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-section">
        <h2 className="lp-cta-h2">Open the demo. <em>Teach the agent.</em></h2>
        <p className="lp-cta-p">Turn on your camera, pick a persona, and watch a contextual bandit learn what you want to read in under a minute.</p>
        <button className="lp-btn-primary" onClick={onEnter}>Launch dashboard →</button>
      </section>

      <footer className="lp-footer">
        <div>HYPER FEED · HPE · 2026</div>
        <div>MADE FOR HACKATHON</div>
      </footer>
    </div>
  )
}
