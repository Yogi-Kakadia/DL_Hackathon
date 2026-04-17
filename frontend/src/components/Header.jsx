const PERSONA_LABELS = {
  alex:       { name: 'Alex Chen',    emoji: '⚽', color: '#ff6b6b' },
  sam:        { name: 'Sam Rivera',   emoji: '💼', color: '#00d4ff' },
  jamie:      { name: 'Jamie Park',   emoji: '🌿', color: '#00e88f' },
  taylor:     { name: 'Taylor Kim',   emoji: '🎬', color: '#ffb347' },
  morgan:     { name: 'Morgan Wells', emoji: '✈️', color: '#a78bfa' },
  riley:      { name: 'Riley Zhang',  emoji: '📰', color: '#38bdf8' },
  cold_start: { name: 'New User',     emoji: '🆕', color: '#7c5cff' },
}

export default function Header({ stats, explorationRate, latency, isColdStart, activePersona }) {
  const isExploring = explorationRate !== null && explorationRate > 0.3
  const persona     = activePersona ? PERSONA_LABELS[activePersona] : null

  return (
    <header className="header app-header" id="app-header">
      <div className="header-brand">
        <span className="header-brain" role="img" aria-label="brain">🧠</span>
        <div>
          <div className="header-title">Hyper-Personalization Engine</div>
          <div className="header-subtitle">Deep RL · Real-Time Adaptation · MIND Dataset</div>
        </div>
      </div>

      <div className="header-status">
        {/* Active persona badge */}
        {persona && (
          <div className="status-badge" style={{
            borderColor: `${persona.color}55`,
            background:  `${persona.color}15`,
            color:        persona.color,
          }}>
            {persona.emoji} {persona.name}
          </div>
        )}

        {isColdStart && (
          <div className="status-badge cold-start-badge">
            <span className="cold-start-pulse" />
            🆕 Cold Start
          </div>
        )}

        {latency !== null && (
          <div className="status-badge">⚡ {latency}ms</div>
        )}

        {explorationRate !== null && (
          <div className="status-badge">
            <span className={`status-dot ${isExploring ? 'exploring' : ''}`} />
            {isExploring ? 'Exploring' : 'Exploiting'}
            <span style={{ opacity: 0.55, marginLeft: 4 }}>ε={explorationRate}</span>
          </div>
        )}

        {stats && (
          <div className="status-badge">
            📊 {stats.total_interactions} interactions
          </div>
        )}

        <div className="status-badge">
          <span className="status-dot" />
          Agent Online
        </div>
      </div>
    </header>
  )
}
