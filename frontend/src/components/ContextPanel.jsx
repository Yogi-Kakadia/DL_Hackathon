const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'relaxed', emoji: '😌', label: 'Relaxed' },
  { key: 'stressed', emoji: '😰', label: 'Stressed' },
  { key: 'focused', emoji: '🎯', label: 'Focused' },
  { key: 'energetic', emoji: '⚡', label: 'Energetic' },
]

const TIMES = [
  { key: 'Morning', icon: '🌅', label: 'Morning' },
  { key: 'Afternoon', icon: '☀️', label: 'Afternoon' },
  { key: 'Evening', icon: '🌆', label: 'Evening' },
  { key: 'Night', icon: '🌙', label: 'Night' },
]

const SPEEDS = [
  { key: 'slow', label: '🐢 Slow' },
  { key: 'medium', label: '🚶 Medium' },
  { key: 'fast', label: '🏃 Fast' },
]

export default function ContextPanel({ context, updateContext, onRecommend, loading }) {
  return (
    <div id="context-panel">
      {/* ── Mood Selector ── */}
      <div className="context-section">
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">🎭 Current Mood</span>
          </div>
          <div className="mood-grid">
            {MOODS.map(m => (
              <button
                key={m.key}
                id={`mood-${m.key}`}
                className={`mood-btn ${context.mood === m.key ? 'active' : ''}`}
                onClick={() => updateContext('mood', m.key)}
              >
                <span className="mood-emoji">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Heart Rate (BPM) ── */}
      <div className="context-section">
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">❤️ Heart Rate</span>
          </div>
          <div className="slider-container">
            <div className="slider-header">
              <span className="context-label">BPM</span>
              <span className="slider-value">{context.bpm} bpm</span>
            </div>
            <input
              id="slider-bpm"
              type="range"
              min="40"
              max="200"
              value={context.bpm}
              onChange={e => updateContext('bpm', parseInt(e.target.value))}
              className="custom-slider"
            />
          </div>
        </div>
      </div>

      {/* ── Ambient Noise ── */}
      <div className="context-section">
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">🔊 Ambient Noise</span>
          </div>
          <div className="slider-container">
            <div className="slider-header">
              <span className="context-label">Decibels</span>
              <span className="slider-value">{context.ambient_noise} dB</span>
            </div>
            <input
              id="slider-noise"
              type="range"
              min="0"
              max="120"
              value={context.ambient_noise}
              onChange={e => updateContext('ambient_noise', parseInt(e.target.value))}
              className="custom-slider"
            />
          </div>
        </div>
      </div>

      {/* ── Time of Day ── */}
      <div className="context-section">
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">🕐 Time of Day</span>
          </div>
          <div className="time-grid">
            {TIMES.map(t => (
              <button
                key={t.key}
                id={`time-${t.key}`}
                className={`time-btn ${context.time_of_day === t.key ? 'active' : ''}`}
                onClick={() => updateContext('time_of_day', t.key)}
              >
                <span className="time-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reading Speed ── */}
      <div className="context-section">
        <div className="glass-card">
          <div className="glass-card-header">
            <span className="glass-card-title">📖 Reading Speed</span>
          </div>
          <div className="time-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {SPEEDS.map(s => (
              <button
                key={s.key}
                id={`speed-${s.key}`}
                className={`time-btn ${context.reading_speed === s.key ? 'active' : ''}`}
                onClick={() => updateContext('reading_speed', s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recommend Button ── */}
      <div className="context-section">
        <button
          id="btn-recommend"
          className="recommend-btn"
          onClick={onRecommend}
          disabled={loading}
        >
          {loading && <span className="loading-spinner"></span>}
          {loading ? 'Thinking...' : '🚀 Get Personalized Recommendations'}
        </button>
      </div>
    </div>
  )
}
