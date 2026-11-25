import { applyGraphics } from './ui/graphics'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800-italic.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/800.css'
import './styles/tokens.css'
import './styles/base.css'
import './ui/ui.css'
import { App } from './App'
import { installGlitter } from './ui/glitter'
import { installTheme } from './ui/theme'

installGlitter()
installTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

applyGraphics()
