import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/sora/300.css'
import '@fontsource/sora/400.css'
import '@fontsource/sora/600.css'
import './styles/tokens.css'
import './styles/base.css'
import './ui/ui.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
