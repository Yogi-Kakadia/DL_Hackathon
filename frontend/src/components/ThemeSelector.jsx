import { useState, useEffect } from 'react'

const AESTHETICS = [
  { id: 'editorial', label: 'Editorial' },
  { id: 'terminal',  label: 'Terminal'  },
  { id: 'soft',      label: 'Soft'      },
]
const MODES = [
  { id: 'light', label: '☼' },
  { id: 'dark',  label: '☾' },
]

function getInitialTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem('hpe_theme') || '{}')
    return {
      aesthetic: saved.aesthetic || 'soft',
      mode:      saved.mode      || 'dark',
    }
  } catch {
    return { aesthetic: 'soft', mode: 'dark' }
  }
}

function applyTheme(aesthetic, mode) {
  document.documentElement.setAttribute('data-aes',  aesthetic)
  document.documentElement.setAttribute('data-mode', mode)
  localStorage.setItem('hpe_theme', JSON.stringify({ aesthetic, mode }))
}

export default function ThemeSelector() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme.aesthetic, theme.mode)
  }, [theme])

  const set = (key, val) => setTheme(prev => ({ ...prev, [key]: val }))

  return (
    <div className="theme-selector">
      <div className="theme-seg">
        {AESTHETICS.map(a => (
          <button
            key={a.id}
            className={`theme-btn${theme.aesthetic === a.id ? ' on' : ''}`}
            onClick={() => set('aesthetic', a.id)}
            title={`${a.label} aesthetic`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="theme-divider" />
      <div className="theme-seg">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`theme-btn${theme.mode === m.id ? ' on' : ''}`}
            onClick={() => set('mode', m.id)}
            title={`${m.label === '☼' ? 'Light' : 'Dark'} mode`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
