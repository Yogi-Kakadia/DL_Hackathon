const PERSONAS = [
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

export default function PersonaSelector({ activePersona, onSelectPersona, loading, registeredUsers=[], onCreateNew, onDeleteUser }) {
  return (
    <div className="persona-selector">
      <div className="glass-card-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="glass-card-title">👤 User Profiles</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          Manage profiles & personas
        </span>
      </div>

      <div className="persona-grid">
        {/* Create new explicit trigger */}
        <button 
           className="persona-card"
           style={{ '--persona-color': '#7c5cff', border: '1px dashed #7c5cff', background: 'rgba(124, 92, 255, 0.05)' }}
           onClick={() => !loading && onCreateNew()}
           disabled={loading}
           title="Create a new custom user"
        >
           <span className="persona-emoji">➕</span>
           <div className="persona-info">
             <div className="persona-name">Create Profile</div>
             <div className="persona-role">New User Flow</div>
           </div>
        </button>

        {registeredUsers.length > 0 && <div className="sidebar-divider">MY PROFILES</div>}
        {registeredUsers.map(u => (
          <div key={u.user_id} style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <button
              className={`persona-card ${activePersona === u.user_id ? 'active' : ''}`}
              style={{ '--persona-color': '#00e88f', flex: 1 }}
              onClick={() => !loading && onSelectPersona(u, true)}
              disabled={loading}
              title={`Location: ${u.location}`}
            >
              <span className="persona-emoji">🙂</span>
              <div className="persona-info">
                <div className="persona-name">{u.name}</div>
                <div className="persona-role">{u.demographics}</div>
              </div>
              {activePersona === u.user_id && <span className="persona-active-dot" />}
            </button>
            <button 
              style={{ width: '40px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '12px', cursor: 'pointer' }}
              onClick={() => onDeleteUser(u.user_id)}
              disabled={loading}
              title="Delete User"
            >
              🗑️
            </button>
          </div>
        ))}

        <div className="sidebar-divider" style={{ marginTop: '12px' }}>DEMO PERSONAS</div>
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
