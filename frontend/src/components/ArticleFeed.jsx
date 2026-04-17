const ACTIONS = [
  { key: 'like',    emoji: '👍', label: 'Like',    cls: 'like' },
  { key: 'read',    emoji: '📖', label: 'Read',    cls: 'read' },
  { key: 'skip',    emoji: '⏭️', label: 'Skip',    cls: 'skip' },
  { key: 'dislike', emoji: '👎', label: 'Dislike', cls: 'dislike' },
]

const ACTED_LABEL = {
  like: '👍 Liked', read: '📖 Read', skip: '⏭️ Skipped', dislike: '👎 Disliked',
}

const ACTED_COLOR = {
  like:    { bg: 'rgba(0,232,143,0.15)', border: 'rgba(0,232,143,0.3)', text: '#00e88f' },
  read:    { bg: 'rgba(0,212,255,0.15)', border: 'rgba(0,212,255,0.3)', text: '#00d4ff' },
  skip:    { bg: 'rgba(255,179,71,0.15)', border: 'rgba(255,179,71,0.3)', text: '#ffb347' },
  dislike: { bg: 'rgba(255,77,106,0.15)', border: 'rgba(255,77,106,0.3)', text: '#ff4d6a' },
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">🎯</div>
      <h2 className="empty-title">Ready to Personalize</h2>
      <p className="empty-description">
        Select a <strong>User Profile</strong> from the left panel to see instant personalization,
        or choose <strong>New User</strong> to watch the RL agent learn from scratch.
      </p>
      <p className="empty-description" style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.7 }}>
        Then hit <strong>Get Personalized Recommendations</strong> — adjust mood, BPM, and time
        to see how context shifts the feed in real time.
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="article-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="article-card skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="skeleton-line sk-short" />
          <div className="skeleton-line sk-long"  style={{ marginTop: 12 }} />
          <div className="skeleton-line sk-med"   style={{ marginTop: 8 }} />
          <div className="skeleton-line sk-long"  style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

export default function ArticleFeed({
  recommendations,
  latency,
  explorationRate,
  context,
  onFeedback,
  feedbackGiven,
  loading,
  isColdStart,
}) {
  if (loading) {
    return (
      <div id="article-feed">
        <div className="feed-header">
          <div>
            <h1 className="feed-title">⏳ Generating recommendations…</h1>
            <span className="feed-meta">RL agent scoring {400}+ articles</span>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (recommendations.length === 0) return <EmptyState />

  return (
    <div id="article-feed">
      {/* ── Header bar ── */}
      <div className="feed-header">
        <div>
          <h1 className="feed-title">
            📰 Recommended for <span style={{ color: 'var(--accent-secondary)' }}>{context.mood}</span> mood
            {isColdStart && <span className="cold-start-tag">🆕 COLD START</span>}
          </h1>
          <span className="feed-meta">
            {recommendations.length} articles · {latency}ms inference ·
            ε = {explorationRate}
            {explorationRate > 0.3 ? ' (exploring)' : ' (exploiting)'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {isColdStart ? '🔍 Exploring diverse categories' : '🎯 Personalised to your history'}
          </span>
        </div>
      </div>

      {/* ── Cold start banner ── */}
      {isColdStart && (
        <div className="cold-start-info-bar">
          <span className="cold-start-pulse" />
          <span>
            <strong>Cold Start Active —</strong> The agent has no history for this user.
            Like/Dislike/Read articles to teach it your preferences and watch the feed adapt!
          </span>
        </div>
      )}

      {/* ── Article grid ── */}
      <div className="article-grid">
        {recommendations.map((article, i) => {
          const acted      = feedbackGiven[article.id]
          const actedStyle = acted ? ACTED_COLOR[acted] : null
          const catColor   = article.color || '#7c5cff'

          return (
            <article
              key={`${article.id}-${i}`}
              className={`article-card ${acted ? 'acted' : ''}`}
              style={{ animationDelay: `${i * 55}ms`, '--cat-color': catColor }}
            >
              {/* Rank badge */}
              <span className="article-rank">#{article.rank || i + 1}</span>

              {/* Categories */}
              <div className="article-top-row">
                <span className="article-category-badge" style={{
                  background: `${catColor}22`,
                  borderColor: `${catColor}55`,
                  color: catColor,
                }}>
                  {article.icon} {article.category}
                </span>
                {article.subcategory && (
                  <span className="article-category-badge">
                    {article.subcategory}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="article-title">{article.title}</h3>

              {/* Abstract */}
              {article.abstract && (
                <p className="article-abstract">{article.abstract}</p>
              )}

              {/* Mood relevance bar */}
              <div className="article-footer">
                <div className="mood-relevance">
                  <span>Mood match</span>
                  <div className="relevance-bar-bg">
                    <div
                      className="relevance-bar-fill"
                      style={{
                        width: `${(article.mood_relevance || 0.5) * 100}%`,
                        background: catColor,
                      }}
                    />
                  </div>
                  <span>{Math.round((article.mood_relevance || 0.5) * 100)}%</span>
                </div>

                {/* Feedback buttons */}
                <div className="article-actions">
                  {ACTIONS.map(a => (
                    <button
                      key={a.key}
                      className={`action-btn ${a.cls} ${acted ? 'acted' : ''}`}
                      onClick={() => onFeedback(article.id, a.key)}
                      disabled={!!acted}
                      title={`${a.label} — trains the RL agent`}
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Acted overlay badge */}
              {acted && (
                <div className="acted-badge" style={{
                  background: actedStyle.bg,
                  borderColor: actedStyle.border,
                  color: actedStyle.text,
                }}>
                  {ACTED_LABEL[acted]}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
