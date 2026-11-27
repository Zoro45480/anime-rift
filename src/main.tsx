import { applyGraphics } from './ui/graphics'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800-italic.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/800.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/anton/latin-400.css'
import '@fontsource/outfit/latin-600.css'
import '@fontsource/outfit/latin-800.css'
import '@fontsource/bangers/latin-400.css'
import './styles/tokens.css'
import './styles/base.css'
import './ui/ui.css'
import './styles/rift.css'
import { startI18n } from './ui/i18n'
import { App } from './App'
import { MrTest } from './screens/MrTest'
import { installGlitter } from './ui/glitter'
import { installTheme } from './ui/theme'

installGlitter()
installTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('mrtest') ? <MrTest /> : <App />}
  </StrictMode>,
)

applyGraphics()

// Appli installable : seulement sur le vrai site (pas dans un aperçu intégré).
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self && /github\.io$/.test(location.hostname)) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('sw.js').catch(() => undefined) })
}

startI18n()
