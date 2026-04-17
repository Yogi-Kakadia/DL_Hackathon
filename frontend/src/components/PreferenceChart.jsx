const CATEGORY_COLORS = {
  sports: '#ff6b6b', finance: '#00d4ff', health: '#00e88f',
  entertainment: '#ffb347', travel: '#a78bfa', news: '#7c5cff',
  lifestyle: '#ff9f40', foodanddrink: '#ff6384', movies: '#818cf8',
  tv: '#2dd4bf', music: '#fbbf24', autos: '#94a3b8',
  weather: '#38bdf8', kids: '#a3e635', middleeast: '#fb7185',
  northamerica: '#64748b', video: '#f97316',
}

const CAT_ICONS = {
  sports: '⚽', finance: '💰', health: '🏥', entertainment: '🎭',
  travel: '✈️', news: '📰', lifestyle: '✨', foodanddrink: '🍔',
  movies: '🎬', tv: '📺', music: '🎵', autos: '🚗',
  weather: '🌤️', kids: '🧒', middleeast: '🌍', northamerica: '🌎',
  video: '📹',
}

export default function PreferenceChart({ preferences }) {
  if (!preferences || Object.keys(preferences).length === 0) {
    return (
      <div className="glass-card pref-chart-empty" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="glass-card-header">
          <span className="glass-card-title">📈 Learned Preferences</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
          Interact with articles to build your taste profile.
        </p>
      </div>
    )
  }

  const entries = Object.entries(preferences)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  const maxVal = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="glass-card" style={{ marginTop: 'var(--space-lg)' }}>
      <div className="glass-card-header">
        <span className="glass-card-title">📈 Learned Preferences</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          Real-time RL signal
        </span>
      </div>

      <div className="pref-bars">
        {entries.map(([cat, score], i) => {
          const pct  = Math.max((score / maxVal) * 100, 4)
          const color = CATEGORY_COLORS[cat] || '#7c5cff'
          return (
            <div
              key={cat}
              className="pref-row"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="pref-label">
                {CAT_ICONS[cat] || '📄'} {cat}
              </span>
              <div className="pref-track">
                <div
                  className="pref-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="pref-score" style={{ color }}>
                {score > 0 ? '+' : ''}{score.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Dislikes */}
      {Object.entries(preferences).some(([, v]) => v < 0) && (
        <div className="pref-dislikes">
          {Object.entries(preferences)
            .filter(([, v]) => v < 0)
            .map(([cat, score]) => (
              <span key={cat} className="pref-dislike-tag">
                {CAT_ICONS[cat]} {cat} {score.toFixed(1)}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
