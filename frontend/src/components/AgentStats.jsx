import { useEffect } from 'react'

function Sparkline({ losses, height = 56 }) {
  if (!losses || losses.length < 2) return null
  const w = 200, h = height
  const max = Math.max(...losses, 0.001)
  const pts = losses.map((v, i) => {
    const x = (i / (losses.length - 1)) * w
    const y = h - (v / max) * h * 0.88 - h * 0.04
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `0,${h} ${pts.join(' ')} ${w},${h}`
  const last = pts[pts.length - 1].split(',')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sg)" points={area} />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" points={pts.join(' ')} />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--accent)" />
    </svg>
  )
}

export default function AgentStats({ stats, onRefresh, attention, explorationRate }) {
  useEffect(() => {
    onRefresh()
    const id = setInterval(onRefresh, 3000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  const camMood      = attention?.detectedMood || 'neutral'
  const camActive    = !!attention?.cameraEnabled
  const camFocused   = !!attention?.isLooking
  const camLoading   = !!attention?.isLoading

  const modeLabel = !stats ? '—'
    : stats.epsilon > 0.5 ? 'Cold Start'
    : stats.epsilon > 0.2 ? 'Balanced'
    : 'Exploiting'

  return (
    <div className="rp-wrap">

      {/* ── Camera Inference ── */}
      <div className="rp-section">
        <div className="rp-overline">AMBIENT</div>
        <div className="rp-title">Camera Inference</div>

        <div className="rp-cam-rows">
          <div className="rp-cam-row">
            <span className="rp-cam-label">Camera Status</span>
            {camLoading
              ? <span className="rp-badge rp-badge-warn">Loading</span>
              : <span className={`rp-badge ${camActive ? 'rp-badge-on' : 'rp-badge-off'}`}>
                  {camActive ? 'Active' : 'Inactive'}
                </span>
            }
          </div>
          <div className="rp-cam-row">
            <span className="rp-cam-label">Mood</span>
            <span className={`rp-badge ${camMood === 'happy' ? 'rp-badge-on' : 'rp-badge-neutral'}`}>
              {camMood.charAt(0).toUpperCase() + camMood.slice(1)}
            </span>
          </div>
          <div className="rp-cam-row">
            <span className="rp-cam-label">Attention</span>
            <span className={`rp-badge ${camFocused ? 'rp-badge-on' : 'rp-badge-off'}`}>
              {camActive ? (camFocused ? 'Focused' : 'Away') : '—'}
            </span>
          </div>
        </div>

        {camActive && (
          <p className="rp-cam-note">
            Mood and attention inferred locally from camera frames. No video is stored or transmitted.
          </p>
        )}

        <button
          className={`rp-cam-toggle ${camActive ? 'active' : ''}`}
          onClick={() => { if (!camLoading) attention?.toggleCamera() }}
          disabled={camLoading}
        >
          {camLoading ? 'Loading model…' : camActive ? 'Disable Camera' : 'Enable Camera'}
        </button>
      </div>

      {/* ── Learning Signal ── */}
      <div className="rp-section">
        <div className="rp-overline">ANALYTICS</div>
        <div className="rp-title">
          Learning Signal
          {stats && stats.recent_losses?.length > 2 && <span className="learning-badge">LIVE</span>}
        </div>

        {!stats ? (
          <p className="rp-empty">Waiting for first interaction…</p>
        ) : (
          <>
            <div className="rp-metric-grid">
              <div className="rp-metric">
                <div className="rp-metric-icon">ε</div>
                <div className="rp-metric-val">{stats.epsilon}</div>
                <div className="rp-metric-label">Epsilon</div>
                <div className="rp-metric-sub">{modeLabel}</div>
              </div>
              <div className="rp-metric">
                <div className="rp-metric-icon">Σ</div>
                <div className="rp-metric-val" style={{ color: stats.total_reward >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {stats.total_reward >= 0 ? '+' : ''}{stats.total_reward}
                </div>
                <div className="rp-metric-label">Total Reward</div>
                <div className="rp-metric-sub">Cumulative policy reward</div>
              </div>
              <div className="rp-metric">
                <div className="rp-metric-icon">n</div>
                <div className="rp-metric-val">{stats.total_interactions}</div>
                <div className="rp-metric-label">Interactions</div>
                <div className="rp-metric-sub">Feedback events received</div>
              </div>
            </div>

            <div className="rp-eps-section">
              <div className="rp-eps-header">
                <span>Exploration Rate</span>
                <span>ε = {stats.epsilon}</span>
              </div>
              <div className="epsilon-track">
                <div className="epsilon-fill" style={{ width: `${stats.epsilon * 100}%` }} />
              </div>
            </div>

            {stats.recent_losses?.length > 1 && (
              <div className="rp-chart">
                <div className="rp-chart-header">
                  <span>Training Loss</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-3)' }}>
                    avg {stats.avg_loss}
                  </span>
                </div>
                <Sparkline losses={stats.recent_losses} />
              </div>
            )}

            <div className="rp-arch">
              <div className="rp-arch-row">Dueling DQN + Prioritized ER</div>
              <div className="rp-arch-row">TF-IDF + SVD (64D) · CPU optimised</div>
              <div className="rp-arch-row">Context: 32D multimodal vector</div>
              <div className="rp-arch-row">MIND Dataset · 250 balanced articles</div>
              <div className="rp-arch-row">Inference: ~2ms per recommendation</div>
            </div>
          </>
        )}

        <button className="rp-refresh-btn" onClick={onRefresh}>Refresh Stats</button>
      </div>
    </div>
  )
}
