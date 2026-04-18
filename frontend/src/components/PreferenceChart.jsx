const CAT_COLORS = {
  sports: '#ff6b6b', finance: '#00d4ff', health: '#00e88f',
  entertainment: '#ffb347', travel: '#a78bfa', news: '#7c5cff',
  lifestyle: '#ff9f40', foodanddrink: '#ff6384', movies: '#818cf8',
  tv: '#2dd4bf', music: '#fbbf24', autos: '#94a3b8',
  weather: '#38bdf8', kids: '#a3e635', middleeast: '#fb7185',
  northamerica: '#64748b', video: '#f97316',
}

export default function PreferenceChart({ preferences }) {
  const entries = Object.entries(preferences || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  const dislikes = Object.entries(preferences || {}).filter(([, v]) => v < 0)
  const maxVal   = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="rp-section">
      <div className="rp-overline">PREFERENCES</div>
      <div className="rp-title">Learned Profile</div>
      {entries.length === 0 ? (
        <p className="rp-empty">Interact with articles to build your taste profile.</p>
      ) : (
        <div className="pref-bars">
          {entries.map(([cat, score], i) => {
            const pct   = Math.max((score / maxVal) * 100, 4)
            const color = CAT_COLORS[cat] || 'var(--accent)'
            return (
              <div key={cat} className="pref-row" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="pref-label">{cat}</span>
                <div className="pref-track">
                  <div className="pref-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="pref-score" style={{ color }}>
                  {score > 0 ? '+' : ''}{score.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {dislikes.length > 0 && (
        <div className="pref-dislikes">
          {dislikes.map(([cat, score]) => (
            <span key={cat} className="pref-dislike-tag">
              {cat} {score.toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
