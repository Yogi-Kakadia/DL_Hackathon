import { useState, useEffect } from 'react'

const CAT_COLORS = {
  sports: '#ff6b6b', finance: '#00d4ff', health: '#00e88f',
  entertainment: '#ffb347', travel: '#a78bfa', news: '#7c5cff',
  lifestyle: '#ff9f40', foodanddrink: '#ff6384', movies: '#818cf8',
  tv: '#2dd4bf', music: '#fbbf24', autos: '#94a3b8',
  weather: '#38bdf8', kids: '#a3e635', middleeast: '#fb7185',
  northamerica: '#64748b', video: '#f97316',
}

const ACTIONS = [
  { key: 'like',    label: 'Like',    reward: '+1.0', cls: 'like'    },
  { key: 'read',    label: 'Read',    reward: '+0.5', cls: 'read'    },
  { key: 'skip',    label: 'Skip',    reward: '−0.3', cls: 'skip'    },
  { key: 'dislike', label: 'Dislike', reward: '−1.0', cls: 'dislike' },
]

const ACTED_LABEL = {
  like: 'Liked', read: 'Read', skip: 'Skipped', dislike: 'Disliked',
}

function whyRec(article, context, explorationRate) {
  if (article.is_exploration) return `Exploration mode active — surfacing adjacent ${article.category} topics`
  const pct = Math.round((article.mood_relevance || 0.5) * 100)
  const { mood, reading_speed, time_of_day } = context
  if (pct >= 80) return `Strong preference signal — ${pct}% context match for ${article.category}`
  if (mood === 'happy') return `Positive mood detected — ${article.category} content ranked higher`
  if (reading_speed === 'fast') return `Fast reading mode — concise ${article.category} briefings prioritized`
  if (reading_speed === 'slow') return `Long-form mode — in-depth ${article.category} content surfaced`
  if (time_of_day === 'Morning') return `Morning context — ${article.category} content calibrated for early focus`
  if (time_of_day === 'Night') return `Late session — lighter ${article.category} content surfaced`
  return `Matches your ${article.category} preference profile — ${pct}% context alignment`
}

function readMins(title = '', abstract = '') {
  return Math.max(1, Math.round((title + ' ' + abstract).trim().split(/\s+/).length / 200))
}

function LearningStrip({ preferences, explorationRate }) {
  const topCats = Object.entries(preferences || {})
    .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 4)
  const pct = Math.min(100, Math.round((1 - (explorationRate || 1)) / 0.95 * 100))
  return (
    <div className="ls-strip">
      <div className="ls-strip-left">
        <span className="ls-strip-mode">{(explorationRate || 1) > 0.3 ? 'Exploring' : 'Personalised'}</span>
        <div className="ls-strip-track"><div className="ls-strip-fill" style={{ width: `${pct}%` }} /></div>
        <span className="ls-strip-pct">{pct}%</span>
      </div>
      <div className="ls-strip-cats">
        {topCats.length > 0
          ? topCats.map(([cat, score]) => (
              <span key={cat} className="ls-strip-chip">
                {cat} <strong>{score.toFixed(1)}</strong>
              </span>
            ))
          : <span className="ls-strip-hint">Interact with articles to teach the agent</span>
        }
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h2 className="empty-title">Ready to Personalise</h2>
      <p className="empty-description">Select a persona on the left, then click Get Recommendations.</p>
      <div className="empty-steps">
        <div className="empty-step"><span className="empty-step-num">1</span> Pick a persona or create a profile</div>
        <div className="empty-step"><span className="empty-step-num">2</span> Click Get Recommendations</div>
        <div className="empty-step"><span className="empty-step-num">3</span> Like · Read · Skip · Dislike articles</div>
        <div className="empty-step"><span className="empty-step-num">4</span> Feed auto-updates as the agent learns</div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="art-card art-card-skeleton">
      <div className="skeleton-line sk-short" style={{ marginBottom: 12 }} />
      <div className="skeleton-line sk-long" style={{ marginBottom: 8 }} />
      <div className="skeleton-line sk-med" />
    </div>
  )
}

export default function ArticleFeed({
  recommendations, latency, explorationRate, context,
  onFeedback, feedbackGiven, loading, isColdStart,
  onAutoDemo, isAutoDemo, preferences, stats, onReadReq, onRefresh,
  searchQuery = '',
}) {
  const [visibleCount, setVisibleCount] = useState(8)
  useEffect(() => { setVisibleCount(8) }, [recommendations, searchQuery])

  const filtered = searchQuery.trim()
    ? recommendations.filter(a => {
        const q = searchQuery.toLowerCase()
        return a.title?.toLowerCase().includes(q)
          || a.abstract?.toLowerCase().includes(q)
          || a.category?.toLowerCase().includes(q)
      })
    : recommendations

  if (loading) {
    return (
      <div id="article-feed">
        <div className="feed-hdr">
          <div>
            <div className="feed-overline">RECOMMENDATIONS</div>
            <h1 className="feed-title">Personalising feed…</h1>
          </div>
        </div>
        <LearningStrip preferences={preferences} explorationRate={explorationRate} />
        <div className="art-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) return <EmptyState />

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div id="article-feed">
      <div className="feed-hdr">
        <div>
          <div className="feed-overline">RECOMMENDATIONS</div>
          <h1 className="feed-title">
            {searchQuery ? `Results for "${searchQuery}"` : 'For you right now'}
            {isColdStart && !searchQuery && <span className="feed-cold-tag">Cold Start</span>}
          </h1>
          <div className="feed-meta">
            {searchQuery
              ? `${filtered.length} of ${recommendations.length} articles match`
              : `${recommendations.length} articles · ${latency}ms · ε=${explorationRate} · ${(explorationRate || 1) > 0.3 ? 'exploring' : 'exploiting'}`
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRefresh && (
            <button className="feed-action-btn" onClick={onRefresh} disabled={loading || isAutoDemo}>
              Refresh
            </button>
          )}
          {onAutoDemo && (
            <button
              className={`feed-action-btn ${isAutoDemo ? 'running' : ''}`}
              onClick={onAutoDemo}
              disabled={isAutoDemo}
            >
              {isAutoDemo ? 'Training…' : 'Auto Demo'}
            </button>
          )}
        </div>
      </div>

      <LearningStrip preferences={preferences} explorationRate={explorationRate} />

      {isColdStart && (
        <div className="feed-cold-bar">
          <span className="feed-cold-dot" />
          <span><strong>Cold Start</strong> — No history yet. Interact with articles below to teach the agent.</span>
        </div>
      )}

      <div className="art-grid">
        {visible.map((article, i) => {
          const acted    = feedbackGiven[article.id]
          const color    = CAT_COLORS[article.category?.toLowerCase()] || 'var(--accent)'
          const mins     = readMins(article.title, article.abstract)
          const why      = whyRec(article, context, explorationRate)

          return (
            <article
              key={`${article.id}-${i}`}
              className={`art-card ${acted ? 'art-card-acted' : ''}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="art-card-top">
                <div className="art-card-meta">
                  <span className="art-cat-badge" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                    {article.category?.toUpperCase()}
                  </span>
                  {article.is_exploration && (
                    <span className="art-explore-badge">Random Discovery</span>
                  )}
                  <span className="art-read-time">{mins} min read</span>
                  {acted && (
                    <span className="art-acted-label" style={{ color }}>
                      {ACTED_LABEL[acted]}
                    </span>
                  )}
                </div>

                <h3 className="art-card-title">{article.title}</h3>

                {article.abstract && (
                  <p className="art-card-abstract">{article.abstract}</p>
                )}
              </div>

              <div className="art-card-why">
                <svg className="art-why-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2a5 5 0 100 10A5 5 0 008 2z" /><path d="M8 7v4M8 5.5v.5" strokeLinecap="round" />
                </svg>
                <span>Why recommended — {why}</span>
              </div>

              <div className="art-card-footer">
                <div className="art-actions">
                  {ACTIONS.map(a => (
                    <button
                      key={a.key}
                      className={`art-action-btn ${a.cls} ${acted ? (acted === a.key ? 'chosen' : 'muted') : ''}`}
                      onClick={() => !acted && (a.key === 'read' ? onReadReq(article) : onFeedback(article.id, a.key))}
                      disabled={!!acted}
                      title={`${a.label} · reward ${a.reward}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="art-ctx-match" title="Context match score">
                  <div className="art-ctx-bar-bg">
                    <div className="art-ctx-bar-fill" style={{ width: `${(article.mood_relevance || 0.5) * 100}%`, background: color }} />
                  </div>
                  <span style={{ color }}>{Math.round((article.mood_relevance || 0.5) * 100)}%</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {hasMore && (
        <button className="load-more-btn" onClick={() => setVisibleCount(v => v + 8)}>
          Show {Math.min(8, recommendations.length - visibleCount)} More Articles
        </button>
      )}
    </div>
  )
}
