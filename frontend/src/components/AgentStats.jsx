import { useEffect } from 'react'

export default function AgentStats({ stats, onRefresh }) {
  // Auto-refresh stats every 10 seconds
  useEffect(() => {
    onRefresh()
    const interval = setInterval(onRefresh, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!stats) {
    return (
      <div className="context-section" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">📊 Agent Stats</span>
          </div>
          <p style={{
            fontSize: '0.78rem',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            padding: 'var(--space-md) 0',
          }}>
            Waiting for first interaction...
          </p>
        </div>
      </div>
    )
  }

  const maxLoss = Math.max(...(stats.recent_losses || [0.001]), 0.001)

  return (
    <div className="context-section" style={{ marginTop: 'var(--space-lg)' }}>
      <div className="glass-card">
        <div className="glass-card-header">
          <span className="glass-card-title">📊 Agent Brain</span>
          <button
            onClick={onRefresh}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-primary)',
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{stats.total_interactions}</div>
            <div className="stat-label">Interactions</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.total_reward}</div>
            <div className="stat-label">Total Reward</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.avg_reward}</div>
            <div className="stat-label">Avg Reward</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.buffer_size}</div>
            <div className="stat-label">Replay Buffer</div>
          </div>
        </div>

        {/* Epsilon Bar */}
        <div className="epsilon-bar-container">
          <div className="epsilon-header">
            <span className="epsilon-label">
              {stats.epsilon > 0.5 ? '🔍 Exploring (Cold Start)' : stats.epsilon > 0.2 ? '⚖️ Balanced' : '🎯 Exploiting'}
            </span>
            <span className="epsilon-value">ε = {stats.epsilon}</span>
          </div>
          <div className="epsilon-track">
            <div
              className="epsilon-fill"
              style={{ width: `${stats.epsilon * 100}%` }}
            />
          </div>
        </div>

        {/* Cold Start → Personalized Progress */}
        {stats.cold_start_progress !== undefined && (
          <div className="cold-start-progress">
            <div className="epsilon-header">
              <span className="epsilon-label">
                {stats.cold_start_progress < 0.3
                  ? '🆕 Learning preferences...'
                  : stats.cold_start_progress < 0.7
                  ? '📈 Building profile...'
                  : '✅ Personalized!'}
              </span>
              <span className="epsilon-value">{Math.round(stats.cold_start_progress * 100)}%</span>
            </div>
            <div className="epsilon-track">
              <div
                className="personalization-fill"
                style={{ width: `${stats.cold_start_progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Loss Chart */}
        {stats.recent_losses && stats.recent_losses.length > 0 && (
          <div className="loss-chart">
            <div className="loss-chart-title">Training Loss (Recent)</div>
            <div className="loss-bars">
              {stats.recent_losses.map((loss, i) => (
                <div
                  key={i}
                  className="loss-bar"
                  style={{
                    height: `${Math.max((loss / maxLoss) * 100, 4)}%`,
                    opacity: 0.3 + (i / stats.recent_losses.length) * 0.7,
                  }}
                  title={`Loss: ${loss}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Average Loss */}
        {stats.avg_loss > 0 && (
          <div style={{
            marginTop: 'var(--space-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>Avg Loss</span>
            <span>{stats.avg_loss}</span>
          </div>
        )}
      </div>
    </div>
  )
}
