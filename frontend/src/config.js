const rawApiBase = import.meta.env.VITE_API_BASE || '/api'

export const API_BASE = rawApiBase.endsWith('/')
  ? rawApiBase.slice(0, -1)
  : rawApiBase
