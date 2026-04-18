export default function UserHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="glass-card" id="user-history">
        <div className="glass-card-header">
          <span className="glass-card-title">📜 Session History</span>
        </div>
        <p className="history-empty">
          No interactions yet. Like or skip articles to build your profile.
        </p>
      </div>
    )
  }

  const totalReward = history.reduce((sum, h) => sum + h.reward, 0)
  const likes = history.filter(h => h.action === 'like').length
  const reads = history.filter(h => h.action === 'read').length
  const skips = history.filter(h => h.action === 'skip').length

  return (
    <div className="glass-card" id="user-history">
      <div className="glass-card-header">
        <span className="glass-card-title">📜 Session History</span>
        <span className="history-count">{history.length} actions</span>
      </div>

      {/* Summary Stats */}
      <div className="history-summary">
        <div className="history-stat">
          <span className="history-stat-value positive">{likes}</span>
          <span className="history-stat-label">👍 Likes</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value neutral">{reads}</span>
          <span className="history-stat-label">📖 Reads</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value negative">{skips}</span>
          <span className="history-stat-label">⏭️ Skips</span>
        </div>
      </div>

      {/* Reward Trend */}
      <div className="history-reward-bar">
        <span>Cumulative Reward</span>
        <span className={`reward-value ${totalReward >= 0 ? 'positive' : 'negative'}`}>
          {totalReward > 0 ? '+' : ''}{totalReward.toFixed(1)}
        </span>
      </div>

      {/* Timeline */}
      <div className="history-timeline">
        {history.slice().reverse().map((item, i) => {
          const actionEmoji = item.action === 'like' ? '👍'
            : item.action === 'read' ? '📖'
            : item.action === 'skip' ? '⏭️' : '👎'

          return (
            <div
              key={i}
              className={`history-item ${item.reward > 0 ? 'positive' : item.reward < 0 ? 'negative' : 'neutral'}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="history-item-num">#{item.interaction_num}</span>
              <div className="history-item-content">
                <span className="history-item-title">
                  {item.icon} {item.title}
                </span>
                <span className="history-item-meta">
                  {actionEmoji} {item.action} · {item.category} · reward: {item.reward > 0 ? '+' : ''}{item.reward}
                  {item.dwell_time > 0 && ` · ${item.dwell_time}s`}
                  {item.scroll_speed > 0 && ` · ${item.scroll_speed}px/s`}
                  {item.section_times?.length > 0 && ` · [${item.section_times.map(t=>t.toFixed(1)).join(',')}]`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
