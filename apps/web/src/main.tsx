import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initAnalytics } from './lib/analytics'
import App from './App.tsx'

// GA4 is injected before the first render so the route tracker's first
// pageview lands in a configured property. No-op outside a production build.
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
