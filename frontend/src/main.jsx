import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AttentionProvider } from './components/AttentionTracker.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AttentionProvider>
      <App />
    </AttentionProvider>
  </StrictMode>,
)
