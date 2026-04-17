import { useEffect } from 'react'

export default function AgentStats({ stats, onRefresh }) {
  useEffect(() => {
    onRefresh()
    const id = setInterval(onRefresh, 8000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  if (!stats) {
    return (
      <div className="glass-card">
        <div className="glass-card-header">
          <span className="glass-card-title">🧠 RL Agent Brain</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
          Waiting for first interaction…
        </p>
      </div>
    )
  }

  const maxLoss    = Math.max(...(stats.recent_losses || [0.001]), 0.001)
  const epsPct     = Math.round(stats.epsilon * 100)
  const perfPct    = Math.round((1 - stats.epsilon) / 0.95 * 100)
  const modeLabel  = stats.epsilon > 0.5 ? '🔍 Cold Start' : stats.epsilon > 0.2 ? '⚖️ Balanced' : '🎯 Exploiting'
  const modeColor  = stats.epsilon > 0.5 ? 'var(--accent-warning)' : stats.epsilon > 0.2 ? 'var(--accent-secondary)' : 'var(--accent-success)'

  return (
    <div className="glass-card">
      <div className="glass-card-header">
        <span className="glass-card-title">🧠 RL Agent Brain</span>
        <button
          onClick={onRefresh}
          style={{
            background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)',
            cursor: 'pointer', padding: '3px 7px', fontSize: '0.66rem',
            fontFamily: 'var(--font-primary)',
          }}
        >↻</button>
      </div>

      {/* Key metrics grid */}
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
          <span className="epsilon-value" style={{ fontFamily: 'var(--font-mono)' }}>ε = {stats.epsilon}</span>
        </div>
        <div className="epsilon-track">
          <div className="epsilon-fill" style={{ width: `${epsPct}%`, background: modeColor }} />
        </div>
      </div>

      {/* Personalization progress */}
      <div className="cold-start-progress">
        <div className="epsilon-header">
          <span className="epsilon-label">
            {perfPct < 30 ? '🆕 Learning…' : perfPct < 70 ? '📈 Building profile…' : '✅ Personalized!'}
          </span>
          <span className="epsilon-value">{Math.min(perfPct, 100)}%</span>
        </div>
        <div className="epsilon-track">
          <div className="personalization-fill" style={{ width: `${Math.min(perfPct, 100)}%` }} />
        </div>
      </div>

      {/* Loss sparkline */}
      {stats.recent_losses?.length > 0 && (
        <div className="loss-chart">
          <div className="loss-chart-title">
            Training Loss
            <span style={{ float: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              avg {stats.avg_loss}
            </span>
          </div>
          <div className="loss-bars">
            {stats.recent_losses.map((loss, i) => (
              <div
                key={i}
                className="loss-bar"
                style={{
                  height: `${Math.max((loss / maxLoss) * 100, 4)}%`,
                  opacity: 0.25 + (i / stats.recent_losses.length) * 0.75,
                }}
                title={`Loss: ${loss}`}
              />
            ))}
          </div>
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
        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
          <div>Architecture: Dueling DQN + PER</div>
          <div>Embeddings: TF-IDF + SVD (64D)</div>
          <div>Context: 32D multimodal vector</div>
          <div>Dataset: MIND (100k+ articles)</div>
        </div>
      </div>
    </div>
  )
}
