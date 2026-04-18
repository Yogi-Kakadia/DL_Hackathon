import { useEffect } from 'react'

function Sparkline({ losses, height = 52 }) {
  if (!losses || losses.length < 2) return null
  const w = 200, h = height
  const max = Math.max(...losses, 0.001)
  const pts = losses.map((v, i) => {
    const x = (i / (losses.length - 1)) * w
    const y = h - (v / max) * h * 0.85 - h * 0.05
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const areaPoints = `0,${h} ${pts.join(' ')} ${w},${h}`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height, display: 'block' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sparkGrad)" points={areaPoints} />
      <polyline
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        points={pts.join(' ')}
      />
      {/* last point dot */}
      {(() => {
        const last = pts[pts.length - 1].split(',')
        return <circle cx={last[0]} cy={last[1]} r="3" fill="var(--accent-primary)" />
      })()}
    </svg>
  )
}

export default function AgentStats({ stats, onRefresh }) {
  useEffect(() => {
    onRefresh()
    const id = setInterval(onRefresh, 3000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  if (!stats) {
    return (
      <div className="glass-card">
        <div className="glass-card-header">
          <span className="glass-card-title">🧠 RL Agent Brain</span>
          <span className="agent-live-dot" />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
          Waiting for first interaction…
        </p>
      </div>
    )
  }

  const epsPct    = Math.round(stats.epsilon * 100)
  const perfPct   = Math.min(100, Math.round((1 - stats.epsilon) / 0.95 * 100))
  const modeLabel = stats.epsilon > 0.5 ? '🔍 Cold Start' : stats.epsilon > 0.2 ? '⚖️ Balanced' : '🎯 Exploiting'
  const modeColor = stats.epsilon > 0.5 ? 'var(--accent-warning)' : stats.epsilon > 0.2 ? 'var(--accent-secondary)' : 'var(--accent-success)'
  const isLearning = stats.recent_losses?.length > 2

  return (
    <div className="glass-card">
      <div className="glass-card-header">
        <span className="glass-card-title">
          🧠 RL Agent Brain
          {isLearning && <span className="learning-badge">LIVE</span>}
        </span>
        <button
          onClick={onRefresh}
          style={{
            background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)',
            cursor: 'pointer', padding: '3px 7px', fontSize: '0.66rem',
          }}
        >↻</button>
      </div>

      {/* Key metrics */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{stats.total_interactions}</div>
          <div className="stat-label">Interactions</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: stats.total_reward >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
            {stats.total_reward >= 0 ? '+' : ''}{stats.total_reward}
          </div>
          <div className="stat-label">Total Reward</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.avg_reward}</div>
          <div className="stat-label">Avg / Step</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.buffer_size}</div>
          <div className="stat-label">Replay Buffer</div>
        </div>
      </div>

      {/* Exploration bar */}
      <div className="epsilon-bar-container">
        <div className="epsilon-header">
          <span className="epsilon-label" style={{ color: modeColor }}>{modeLabel}</span>
          <span className="epsilon-value">ε = {stats.epsilon}</span>
        </div>
        <div className="epsilon-track">
          <div className="epsilon-fill" style={{ width: `${epsPct}%`, background: modeColor }} />
        </div>
      </div>

      {/* Personalization progress */}
      <div className="cold-start-progress" style={{ marginTop: 'var(--space-sm)' }}>
        <div className="epsilon-header">
          <span className="epsilon-label">
            {perfPct < 30 ? '🆕 Learning…' : perfPct < 70 ? '📈 Building profile…' : '✅ Personalised!'}
          </span>
          <span className="epsilon-value">{perfPct}%</span>
        </div>
        <div className="epsilon-track">
          <div className="personalization-fill" style={{ width: `${perfPct}%` }} />
        </div>
      </div>

      {/* SVG Sparkline */}
      {stats.recent_losses?.length > 1 && (
        <div className="loss-chart">
          <div className="loss-chart-title">
            Training Loss
            <span style={{ float: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              avg {stats.avg_loss}
            </span>
          </div>
          <Sparkline losses={stats.recent_losses} />
        </div>
      )}

      {/* Architecture info */}
      <div style={{
        marginTop: 'var(--space-md)',
        padding: 'var(--space-sm)',
        background: 'var(--bg-glass)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', lineHeight: 1.85 }}>
          <div>🏗 Dueling DQN + Prioritized ER</div>
          <div>📐 TF-IDF + SVD (64D) — CPU optimised</div>
          <div>🎛 Context: 32D multimodal vector</div>
          <div>📰 MIND Dataset · 250 balanced articles</div>
          <div>⚡ Inference: ~2ms per recommendation</div>
        </div>
      </div>
    </div>
  )
}
