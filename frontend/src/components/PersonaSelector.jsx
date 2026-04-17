const PERSONAS = [
  {
    id: 'cold_start',
    name: 'New User',
    emoji: '🆕',
    title: 'Cold Start Demo',
    description: 'Zero history — watch RL explore & learn!',
    color: '#7c5cff',
  },
  {
    id: 'alex',
    name: 'Alex Chen',
    emoji: '⚽',
    title: 'Sports Fanatic',
    description: 'Sports & Entertainment',
    color: '#ff6b6b',
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    emoji: '💼',
    title: 'Finance Analyst',
    description: 'Finance & Global News',
    color: '#00d4ff',
  },
  {
    id: 'jamie',
    name: 'Jamie Park',
    emoji: '🌿',
    title: 'Wellness Guru',
    description: 'Health, Food & Lifestyle',
    color: '#00e88f',
  },
  {
    id: 'taylor',
    name: 'Taylor Kim',
    emoji: '🎬',
    title: 'Entertainment Buff',
    description: 'Movies, TV & Music',
    color: '#ffb347',
  },
  {
    id: 'morgan',
    name: 'Morgan Wells',
    emoji: '✈️',
    title: 'Travel Explorer',
    description: 'Travel & Culture',
    color: '#a78bfa',
  },
  {
    id: 'riley',
    name: 'Riley Zhang',
    emoji: '📰',
    title: 'News Junkie',
    description: 'World Events & Politics',
    color: '#38bdf8',
  },
]

export default function PersonaSelector({ activePersona, onSelectPersona, loading }) {
  return (
    <div className="persona-selector">
      <div className="glass-card-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="glass-card-title">👤 User Profiles</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          Select to demo personalization
        </span>
      </div>

      <div className="persona-grid">
        {PERSONAS.map(p => (
          <button
            key={p.id}
            className={`persona-card ${activePersona === p.id ? 'active' : ''}`}
            style={{ '--persona-color': p.color }}
            onClick={() => !loading && onSelectPersona(p)}
            disabled={loading}
            title={p.description}
          >
            <span className="persona-emoji">{p.emoji}</span>
            <div className="persona-info">
              <div className="persona-name">{p.name}</div>
              <div className="persona-role">{p.title}</div>
            </div>
            {activePersona === p.id && (
              <span className="persona-active-dot" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
