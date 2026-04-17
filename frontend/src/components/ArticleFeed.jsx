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
  if (recommendations.length === 0 && !loading) {
    return (
      <div className="empty-state" id="empty-state">
        <div className="empty-icon">🎯</div>
        <h2 className="empty-title">Ready to Personalize</h2>
        <p className="empty-description">
          Adjust the context signals on the left panel — mood, heart rate,
          ambient noise, and time of day — then hit
          <strong> "Get Personalized Recommendations" </strong>
          to see the RL agent in action.
        </p>
        <p className="empty-description" style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.7 }}>
          💡 Try clicking <strong>"New User (Cold Start Demo)"</strong> first to see
          how the agent handles unknown users!
        </p>
      </div>
    )
  }

  return (
    <div id="article-feed">
      <div className="feed-header">
        <div>
          <h1 className="feed-title">
            {loading ? '⏳ Loading...' : `📰 Recommended for ${context.mood}`}
          </h1>
          <span className="feed-meta">
            {recommendations.length} articles · {latency}ms ·
            ε={explorationRate}
            {isColdStart && (
              <span className="cold-start-tag">🆕 COLD START</span>
            )}
          </span>
        </div>
      </div>

      {isColdStart && (
        <div className="cold-start-info-bar">
          <span className="cold-start-pulse"></span>
          <span>
            <strong>Cold Start Mode:</strong> The agent is exploring diverse categories.
            Like or skip articles to teach it your preferences — watch it personalize in real-time!
          </span>
        </div>
      )}

      <div className="article-grid">
        {recommendations.map((article, i) => {
          const acted = feedbackGiven[article.id]
          return (
            <article
              key={`${article.id}-${i}`}
              className="article-card"
              id={`article-${article.id}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="article-rank">#{article.rank || i + 1}</span>

              <div className="article-top-row">
                <span className="article-category-badge">
                  {article.icon} {article.category}
                </span>
                {article.subcategory && (
                  <span className="article-category-badge">
                    {article.subcategory}
                  </span>
                )}
              </div>

              <h3 className="article-title">{article.title}</h3>

              {article.abstract && (
                <p className="article-abstract">{article.abstract}</p>
              )}

              <div className="article-footer">
                <div className="mood-relevance">
                  <span>Relevance</span>
                  <div className="relevance-bar-bg">
                    <div
                      className="relevance-bar-fill"
                      style={{
                        width: `${(article.mood_relevance || 0.5) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{Math.round((article.mood_relevance || 0.5) * 100)}%</span>
                </div>

                <div className="article-actions">
                  <button
                    className={`action-btn like ${acted ? 'acted' : ''}`}
                    onClick={() => onFeedback(article.id, 'like')}
                    disabled={!!acted}
                    title="Like"
                  >
                    👍 Like
                  </button>
                  <button
                    className={`action-btn read ${acted ? 'acted' : ''}`}
                    onClick={() => onFeedback(article.id, 'read')}
                    disabled={!!acted}
                    title="Read"
                  >
                    📖 Read
                  </button>
                  <button
                    className={`action-btn skip ${acted ? 'acted' : ''}`}
                    onClick={() => onFeedback(article.id, 'skip')}
                    disabled={!!acted}
                    title="Skip"
                  >
                    ⏭️ Skip
                  </button>
                </div>
              </div>

              {acted && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: acted === 'skip'
                    ? 'var(--accent-danger-dim)'
                    : 'var(--accent-success-dim)',
                  color: acted === 'skip'
                    ? 'var(--accent-danger)'
                    : 'var(--accent-success)',
                  border: `1px solid ${acted === 'skip'
                    ? 'rgba(255,77,106,0.2)'
                    : 'rgba(0,232,143,0.2)'}`,
                }}>
                  {acted === 'like' ? '👍 Liked' : acted === 'read' ? '📖 Read' : '⏭️ Skipped'}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
