import { useState, useEffect } from 'react'

const ACTIONS = [
  { key: 'like',    emoji: '👍', cls: 'like',    reward: '+1.0' },
  { key: 'read',    emoji: '📖', cls: 'read',    reward: '+0.5' },
  { key: 'skip',    emoji: '⏭️', cls: 'skip',    reward: '−0.3' },
  { key: 'dislike', emoji: '👎', cls: 'dislike', reward: '−1.0' },
]

const ACTED_COLOR = {
  like: '#00e88f', read: '#00d4ff', skip: '#ffb347', dislike: '#ff4d6a',
}
const ACTED_LABEL = {
  like: '👍 Liked', read: '📖 Read', skip: '⏭️ Skipped', dislike: '👎 Disliked',
}

function readingTime(title = '', abstract = '') {
  return Math.max(1, Math.round((title + ' ' + abstract).trim().split(/\s+/).length / 200))
}

function LearningStrip({ preferences, explorationRate, interactions }) {
  const topCats = Object.entries(preferences || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const personPct = Math.min(100, Math.round((1 - (explorationRate || 1)) / 0.95 * 100))

  return (
    <div className="learning-strip">
      <div className="ls-left">
        <span className="ls-mode">
          {(explorationRate || 1) > 0.3 ? '🔍 Exploring' : '🎯 Personalised'}
        </span>
        <div className="ls-progress-track">
          <div className="ls-progress-fill" style={{ width: `${personPct}%` }} />
        </div>
        <span className="ls-pct">{personPct}%</span>
      </div>
      <div className="ls-cats">
        {topCats.length > 0
          ? topCats.map(([cat, score]) => (
              <span key={cat} className="ls-chip">
                {cat} <strong>{score.toFixed(1)}</strong>
              </span>
            ))
          : <span className="ls-hint">Interact with articles to teach the AI ↓</span>
        }
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">🎯</div>
      <h2 className="empty-title">Ready to Personalise</h2>
      <p className="empty-description">Select a persona on the left, then hit <strong>Get Recommendations</strong>.</p>
      <div className="empty-steps">
        <div className="empty-step"><span className="empty-step-num">1</span> Pick a persona or start cold</div>
        <div className="empty-step"><span className="empty-step-num">2</span> Click <strong>Get Recommendations</strong></div>
        <div className="empty-step"><span className="empty-step-num">3</span> 👍 Like · 📖 Read · ⏭️ Skip · 👎 Dislike</div>
        <div className="empty-step"><span className="empty-step-num">4</span> Feed auto-updates — watch it learn!</div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="article-card skeleton-card">
      <div className="card-accent" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="card-body" style={{ gap: 10 }}>
        <div className="skeleton-line sk-short" />
        <div className="skeleton-line sk-long" />
        <div className="skeleton-line sk-med" />
        <div className="skeleton-line sk-short" style={{ marginTop: 'auto' }} />
      </div>
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
  onAutoDemo,
  isAutoDemo,
  preferences,
  stats,
  onReadReq,
}) {
  const [visibleCount, setVisibleCount] = useState(8)

  useEffect(() => { setVisibleCount(8) }, [recommendations])

  if (loading) {
    return (
      <div id="article-feed">
        <div className="feed-header">
          <h1 className="feed-title">⏳ Personalising feed…</h1>
          <span className="feed-meta">RL agent scoring articles</span>
        </div>
        <div className="article-list">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) return <EmptyState />

  const visible  = recommendations.slice(0, visibleCount)
  const hasMore  = visibleCount < recommendations.length

  return (
    <div id="article-feed">
      {/* ── Header ── */}
      <div className="feed-header">
        <div>
          <h1 className="feed-title">
            Feed · <span style={{ color: 'var(--accent-secondary)' }}>{context.mood}</span>
            {isColdStart && <span className="cold-start-tag">COLD START</span>}
          </h1>
          <span className="feed-meta">
            {recommendations.length} articles · {latency}ms · ε={explorationRate}
            {(explorationRate || 1) > 0.3 ? ' exploring' : ' exploiting'}
          </span>
        </div>
        {onAutoDemo && (
          <button
            className={`auto-demo-btn ${isAutoDemo ? 'running' : ''}`}
            onClick={onAutoDemo}
            disabled={isAutoDemo}
          >
            {isAutoDemo
              ? <><span className="loading-spinner" /> Training…</>
              : '▶ Auto Demo'}
          </button>
        )}
      </div>

      {/* ── Learning strip ── */}
      <LearningStrip
        preferences={preferences}
        explorationRate={explorationRate}
        interactions={stats?.total_interactions}
      />

      {/* ── Cold start banner ── */}
      {isColdStart && (
        <div className="cold-start-info-bar">
          <span className="cold-start-pulse" />
          <span>
            <strong>Cold Start —</strong> No history yet. Like / Dislike articles below — feed updates automatically!
          </span>
        </div>
      )}

      {/* ── Article list ── */}
      <div className="article-list">
        {visible.map((article, i) => {
          const acted    = feedbackGiven[article.id]
          const catColor = article.color || '#7c5cff'
          const rt       = readingTime(article.title, article.abstract)
          const bannerBg = `radial-gradient(ellipse at 40% 50%, ${catColor}55 0%, ${catColor}18 70%, transparent 100%)`

          return (
            <article
              key={`${article.id}-${i}`}
              className={`article-card ${acted ? `acted acted-${acted}` : ''}`}
              style={{ animationDelay: `${i * 35}ms`, '--cat-color': catColor }}
            >
              {/* Left accent block */}
              <div className="card-accent" style={{ background: bannerBg }}>
                <span className="card-icon">{article.icon}</span>
              </div>

              {/* Right content */}
              <div className="card-body">
                <div className="card-meta-row">
                  <span className="card-cat" style={{ color: catColor }}>
                    {article.category.toUpperCase()}
                  </span>
                  <span className="card-sep">·</span>
                  <span className="card-time">{rt} min read</span>
                  {article.is_exploration ? (
                    <span className="card-rank" style={{ background: 'var(--accent-primary)', color: '#fff' }}>🎲 Random Discovery</span>
                  ) : (
                    <span className="card-rank">#{article.rank || i + 1}</span>
                  )}
                  {acted && (
                    <span className="card-acted-pill" style={{ color: ACTED_COLOR[acted], borderColor: `${ACTED_COLOR[acted]}44` }}>
                      {ACTED_LABEL[acted]}
                    </span>
                  )}
                </div>

                <h3 className="card-title">{article.title}</h3>

                {article.abstract && (
                  <p className="card-abstract">{article.abstract}</p>
                )}

                <div className="card-footer">
                  <div className="card-actions">
                    {ACTIONS.map(a => (
                      <button
                        key={a.key}
                        className={`action-btn ${a.cls} ${acted ? (acted === a.key ? 'chosen' : 'muted') : ''}`}
                        onClick={() => !acted && (a.key === 'read' ? onReadReq(article) : onFeedback(article.id, a.key))}
                        title={`${a.key} · reward ${a.reward}`}
                        disabled={!!acted}
                      >
                        <span className="action-emoji">{a.emoji}</span>
                        <span className="action-reward">{a.reward}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mood-relevance" title="Context match: mood + BPM + noise + time">
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>ctx</span>
                    <div className="relevance-bar-bg">
                      <div
                        className="relevance-bar-fill"
                        style={{ width: `${(article.mood_relevance || 0.5) * 100}%`, background: catColor }}
                      />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: catColor }}>
                      {Math.round((article.mood_relevance || 0.5) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* ── Load More ── */}
      {hasMore && (
        <button className="load-more-btn" onClick={() => setVisibleCount(v => v + 8)}>
          ↓ Show {Math.min(8, recommendations.length - visibleCount)} More Articles
        </button>
      )}
    </div>
  )
}
