import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the handler-free service worker (PWA-01 / D-06, shipped by 15-02).
// Registered OUTSIDE React, after render, on the window 'load' event so it
// dodges StrictMode's dev double-invoke (RESEARCH Pitfall 6). Best-effort:
// registration failure is non-fatal — the app works without the SW.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // non-fatal — installability is best-effort, no error UI
    })
  })
}
