const ACTION_LABEL = { like: 'Liked', read: 'Read', skip: 'Skipped', dislike: 'Disliked' }

export default function UserHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="rp-section" id="user-history">
        <div className="rp-overline">HISTORY</div>
        <div className="rp-title">Session Log</div>
        <p className="rp-empty">No interactions yet. Like or skip articles to build your profile.</p>
      </div>
    )
  }

  const totalReward = history.reduce((sum, h) => sum + h.reward, 0)
  const likes  = history.filter(h => h.action === 'like').length
  const reads  = history.filter(h => h.action === 'read').length
  const skips  = history.filter(h => h.action === 'skip' || h.action === 'dislike').length

  return (
    <div className="rp-section" id="user-history">
      <div className="rp-overline">HISTORY</div>
      <div className="rp-title">Session Log <span className="history-count">{history.length}</span></div>

      <div className="history-summary">
        <div className="history-stat">
          <span className="history-stat-value positive">{likes}</span>
          <span className="history-stat-label">Liked</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value neutral">{reads}</span>
          <span className="history-stat-label">Read</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value negative">{skips}</span>
          <span className="history-stat-label">Skipped</span>
        </div>
      </div>

      <div className="history-reward-bar">
        <span>Cumulative Reward</span>
        <span className={`reward-value ${totalReward >= 0 ? 'positive' : 'negative'}`}>
          {totalReward > 0 ? '+' : ''}{totalReward.toFixed(1)}
        </span>
      </div>

      <div className="history-timeline">
        {history.slice().reverse().map((item, i) => (
          <div
            key={i}
            className={`history-item ${item.reward > 0 ? 'positive' : item.reward < 0 ? 'negative' : 'neutral'}`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <span className="history-item-num">#{item.interaction_num}</span>
            <div className="history-item-content">
              <span className="history-item-title">{item.title}</span>
              <span className="history-item-meta">
                {ACTION_LABEL[item.action] || item.action} · {item.category} · {item.reward > 0 ? '+' : ''}{item.reward}
                {item.dwell_time > 0 && ` · ${item.dwell_time}s`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
