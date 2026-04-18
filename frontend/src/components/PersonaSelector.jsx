const PERSONAS = [
  { id: 'alex',   name: 'Alex Chen',    role: 'Sports & Entertainment',  color: '#ff6b6b', init: 'AC' },
  { id: 'sam',    name: 'Sam Rivera',   role: 'Finance & Global News',   color: '#00d4ff', init: 'SR' },
  { id: 'jamie',  name: 'Jamie Park',   role: 'Health & Lifestyle',      color: '#00e88f', init: 'JP' },
  { id: 'taylor', name: 'Taylor Kim',   role: 'Entertainment & Media',   color: '#ffb347', init: 'TK' },
  { id: 'morgan', name: 'Morgan Wells', role: 'Travel & Culture',        color: '#a78bfa', init: 'MW' },
  { id: 'riley',  name: 'Riley Zhang',  role: 'World Events & Politics', color: '#38bdf8', init: 'RZ' },
]

export default function PersonaSelector({ activePersona, onSelectPersona, loading, registeredUsers = [], onCreateNew, onDeleteUser }) {
  return (
    <div className="ws-panel">
      <div className="ws-section-label">WORKSPACE</div>

      {registeredUsers.length > 0 && (
        <>
          <div className="ws-group-label">My Profiles</div>
          {registeredUsers.map(u => (
            <div key={u.user_id} className="ws-item-row">
              <button
                className={`ws-item ${activePersona === u.user_id ? 'active' : ''}`}
                onClick={() => !loading && onSelectPersona(u, true)}
                disabled={loading}
              >
                <div className="ws-init" style={{ background: '#00e88f18', color: '#00e88f' }}>
                  {u.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="ws-item-info">
                  <div className="ws-item-name">{u.name}</div>
                  <div className="ws-item-role">{u.demographics}</div>
                </div>
                {activePersona === u.user_id && <span className="ws-active-pip" />}
              </button>
              <button
                className="ws-delete"
                onClick={() => onDeleteUser(u.user_id)}
                title="Remove profile"
                disabled={loading}
              >×</button>
            </div>
          ))}
        </>
      )}

      <button className="ws-create" onClick={() => !loading && onCreateNew()} disabled={loading}>
        + Create Profile
      </button>

      <div className="ws-group-label" style={{ marginTop: 20 }}>Demo Personas</div>
      {PERSONAS.map(p => (
        <button
          key={p.id}
          className={`ws-item ${activePersona === p.id ? 'active' : ''}`}
          style={{ '--ws-pc': p.color }}
          onClick={() => !loading && onSelectPersona(p)}
          disabled={loading}
        >
          <div className="ws-init" style={{ background: `${p.color}18`, color: p.color }}>{p.init}</div>
          <div className="ws-item-info">
            <div className="ws-item-name">{p.name}</div>
            <div className="ws-item-role">{p.role}</div>
          </div>
          {activePersona === p.id && <span className="ws-active-pip" style={{ background: p.color }} />}
        </button>
      ))}
    </div>
  )
}
