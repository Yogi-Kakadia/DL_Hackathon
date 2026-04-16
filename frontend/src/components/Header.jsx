export default function Header({ stats, explorationRate, latency }) {
  const isExploring = explorationRate !== null && explorationRate > 0.3

  return (
    <header className="header app-header" id="app-header">
      <div className="header-brand">
        <span className="header-brain" role="img" aria-label="brain">🧠</span>
        <div>
          <div className="header-title">Hyper-Personalization Engine</div>
          <div className="header-subtitle">Reinforcement Learning · Real-Time Adaptation</div>
        </div>
      </div>

      <div className="header-status">
        {latency !== null && (
          <div className="status-badge">
            ⚡ {latency}ms
          </div>
        )}

        {explorationRate !== null && (
          <div className="status-badge">
            <span className={`status-dot ${isExploring ? 'exploring' : ''}`}></span>
            {isExploring ? 'Exploring' : 'Exploiting'}
            <span style={{ opacity: 0.5 }}>ε={explorationRate}</span>
          </div>
        )}

        {stats && (
          <div className="status-badge">
            📊 {stats.total_interactions} interactions
          </div>
        )}

        <div className="status-badge">
          <span className="status-dot"></span>
          Agent Online
        </div>
      </div>
    </header>
  )
}
