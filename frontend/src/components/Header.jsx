import ThemeSelector from './ThemeSelector'

export default function Header({ userName, onReset, explorationRate, latency, searchQuery, onSearch, onBrandClick }) {
  const modeLabel = explorationRate == null ? 'Initializing'
    : explorationRate > 0.5 ? 'Cold Start'
    : explorationRate > 0.2 ? 'Balanced'
    : 'Exploiting'

  return (
    <header className="app-header" id="app-header">
      <div className="hdr-brand" onClick={onBrandClick} style={{ cursor: onBrandClick ? 'pointer' : 'default' }} title="Back to home">
        <div className="hdr-brand-mark" />
        <div>
          <div className="hdr-brand-name">Hyper Feed</div>
          <div className="hdr-brand-sub">Personal News AI</div>
        </div>
      </div>

      <div className="hdr-center">
        <div className="hdr-search">
          <svg className="hdr-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" strokeLinecap="round" />
          </svg>
          <input
            className="hdr-search-input"
            placeholder="Search articles, topics, signals…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
          {searchQuery
            ? <button className="hdr-search-clear" onClick={() => onSearch('')} title="Clear search">×</button>
            : <span className="hdr-search-kbd">⌘K</span>
          }
        </div>
      </div>

      <div className="hdr-right">
        <div className="hdr-online">
          <span className="hdr-online-dot" />
          System Online
        </div>
        {latency != null && (
          <div className="hdr-pill">{latency}ms</div>
        )}
        <ThemeSelector />
        {userName && (
          <div className="hdr-user" onClick={onReset} title="Click to reset / new user">
            <div className="hdr-avatar">{userName[0]?.toUpperCase()}</div>
            <div className="hdr-user-info">
              <div className="hdr-user-name">{userName}</div>
              <div className="hdr-user-mode">{modeLabel} Mode</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
