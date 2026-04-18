import { useState, useEffect, useRef, useCallback } from 'react'

const TIMES  = ['Morning', 'Afternoon', 'Evening', 'Night']
const SPEEDS = ['slow', 'medium', 'fast']
const MOODS  = [{ key: 'happy', label: 'Happy' }, { key: 'neutral', label: 'Neutral' }]

/* ── Sample biometric data (60 rows, ~1 min loop) ── */
const SAMPLE_CSV = `bpm,ambient_noise
72,28
74,30
75,32
73,31
76,29
78,35
80,38
79,36
77,34
75,32
73,30
71,28
70,26
72,27
74,29
76,31
78,33
80,35
82,37
84,40
83,38
81,36
79,34
77,32
75,30
73,28
71,26
69,24
68,23
70,25
72,27
74,29
76,31
78,33
80,35
77,32
75,30
73,28
72,27
74,29
76,31
78,33
80,35
81,36
82,37
80,35
78,33
76,31
74,29
72,27
70,25
68,23
67,22
69,24
71,26
73,28
75,30
77,32
79,34
81,36`

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers  = lines[0].split(',').map(h => h.trim().toLowerCase())
  const bpmCol   = headers.findIndex(h => ['bpm','heartrate','heart_rate','hr','pulse'].includes(h))
  const noiseCol = headers.findIndex(h => ['ambient_noise','ambient','noise','db','decibels','ambient_sound','sound'].includes(h))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    return {
      bpm:           bpmCol   >= 0 ? (parseInt(vals[bpmCol])   || 72) : 72,
      ambient_noise: noiseCol >= 0 ? (parseInt(vals[noiseCol]) || 30) : 30,
    }
  }).filter(r => r.bpm > 0 && r.bpm < 300)
}

const SAMPLE_DATA = parseCSV(SAMPLE_CSV)

export default function ContextPanel({ context, updateContext, onRecommend, loading }) {
  const [csvIdx, setCsvIdx] = useState(0)

  const chartRef = useRef(null)
  const dataRef  = useRef(SAMPLE_DATA)
  const idxRef   = useRef(0)
  idxRef.current = csvIdx

  /* ── Canvas chart ── */
  const drawChart = useCallback(() => {
    const canvas = chartRef.current
    if (!canvas) return
    const data = dataRef.current
    if (data.length === 0) return

    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return
    const dpr = devicePixelRatio
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const W = rect.width, H = rect.height
    const idx = idxRef.current

    const style   = getComputedStyle(document.documentElement)
    const accent  = style.getPropertyValue('--accent').trim()
    const accent2 = style.getPropertyValue('--accent-2').trim()
    const lineClr = style.getPropertyValue('--line').trim()

    ctx.clearRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = lineClr; ctx.lineWidth = 0.5
    for (let i = 1; i < 4; i++) {
      const y = (H / 4) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    const WIN   = Math.min(40, data.length)
    const start = Math.max(0, idx - WIN + 1)
    const slice = data.slice(start, idx + 1)
    if (slice.length < 2) return

    const drawLine = (vals, color, yMin, yMax) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9; ctx.beginPath()
      vals.forEach((v, i) => {
        const x = (i / (WIN - 1)) * W
        const y = H - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * H * 0.85 - H * 0.05
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke(); ctx.globalAlpha = 1
    }

    drawLine(slice.map(r => r.bpm),           accent,  40, 200)
    drawLine(slice.map(r => r.ambient_noise), accent2,   0, 120)

    // Live dot
    const last = slice[slice.length - 1]
    const dotY = H - ((Math.min(Math.max(last.bpm, 40), 200) - 40) / 160) * H * 0.85 - H * 0.05
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(W - 2, dotY, 3, 0, Math.PI * 2); ctx.fill()
  }, [])

  useEffect(() => { drawChart() }, [csvIdx, drawChart])

  useEffect(() => {
    if (!chartRef.current) return
    const ro = new ResizeObserver(drawChart)
    ro.observe(chartRef.current)
    return () => ro.disconnect()
  }, [drawChart])

  useEffect(() => {
    const mo = new MutationObserver(drawChart)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-aes', 'data-mode'] })
    return () => mo.disconnect()
  }, [drawChart])

  /* ── Auto-play sample data ── */
  useEffect(() => {
    // Seed context with first row immediately
    const first = SAMPLE_DATA[0]
    updateContext({ bpm: first.bpm, ambient_noise: first.ambient_noise })

    const id = setInterval(() => {
      setCsvIdx(prev => {
        const next = (prev + 1) % SAMPLE_DATA.length
        const row  = SAMPLE_DATA[next]
        updateContext({ bpm: row.bpm, ambient_noise: row.ambient_noise })
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  const cur = SAMPLE_DATA[csvIdx] || SAMPLE_DATA[0]

  return (
    <div className="ls-panel">
      <div className="ws-section-label">CONTEXT</div>
      <div className="ls-title">Live Signals</div>
      <div className="ls-sub">Inputs that shape the bandit policy in real time.</div>

      {/* Mood */}
      <div className="ls-field">
        <div className="ls-field-label">Mood</div>
        <div className="ls-mood-row">
          {MOODS.map(m => (
            <button
              key={m.key}
              className={`ls-mood-btn ${context.mood === m.key ? 'active' : ''}`}
              onClick={() => updateContext('mood', m.key)}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {/* Time of Day — auto-managed */}
      <div className="ls-field">
        <div className="ls-field-label">
          Time of Day <span className="ls-auto-tag">AUTO</span>
        </div>
        <select
          className="ls-select"
          value={context.time_of_day}
          onChange={e => updateContext('time_of_day', e.target.value)}
        >
          {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Biometric feed */}
      <div className="ls-field">
        <div className="ls-field-label">
          Biometric Feed <span className="ls-auto-tag">LIVE</span>
        </div>
        <div className="ls-bio-row">
          <div className="ls-bio-chip bpm">
            <span className="ls-bio-val">{cur.bpm}</span>
            <span className="ls-bio-unit">bpm</span>
          </div>
          <div className="ls-bio-chip noise">
            <span className="ls-bio-val">{cur.ambient_noise}</span>
            <span className="ls-bio-unit">dB</span>
          </div>
          <div className="ls-bio-row-right">
            Row {csvIdx + 1} / {SAMPLE_DATA.length}
          </div>
        </div>
      </div>

      {/* Biometric chart */}
      <div className="ls-chart-wrap">
        <canvas ref={chartRef} className="ls-chart-canvas" />
        <div className="ls-chart-legend">
          <span className="ls-legend-bpm">BPM</span>
          <span className="ls-legend-noise">Noise</span>
        </div>
      </div>

      {/* Reading Speed */}
      <div className="ls-field" style={{ marginTop: 12 }}>
        <div className="ls-field-label">Reading Speed</div>
        <select
          className="ls-select"
          value={context.reading_speed}
          onChange={e => updateContext('reading_speed', e.target.value)}
        >
          {SPEEDS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <button className="ls-recommend-btn" onClick={onRecommend} disabled={loading}>
        {loading ? 'Loading…' : 'Get Recommendations'}
      </button>
    </div>
  )
}
