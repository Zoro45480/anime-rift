// Qualité graphique : 'auto' suit l'appareil, 'high' montre tous les effets, 'low' (Fluide) fige les lueurs animées
// et retire les flous. Le réglage vaut aussi pour l'animation d'invocation (même clé que son bouton « Effets »).
export type GraphicsMode = 'auto' | 'high' | 'low'
const KEY = 'anime-rift-fx'

export const getGraphics = (): GraphicsMode => {
  try { const v = localStorage.getItem(KEY); return v === 'high' || v === 'low' ? v : 'auto' } catch { return 'auto' }
}
// Qualité réellement appliquée : en automatique, « Fluide » si l'appareil demande moins d'animations ou a peu de mémoire.
export const effectiveGraphics = (mode = getGraphics()): 'high' | 'low' => {
  if (mode !== 'auto') return mode
  const weak = window.matchMedia('(prefers-reduced-motion: reduce)').matches || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 2
  return weak ? 'low' : 'high'
}
export const applyGraphics = () => { document.documentElement.dataset.fx = effectiveGraphics(); document.documentElement.dataset.fxchoice = getGraphics() }
export const setGraphics = (mode: GraphicsMode) => {
  try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode) } catch { /* non enregistré */ }
  applyGraphics()
}

// Titres des cartes : 'all' = le ruban s'affiche partout, 'big' = seulement sur la carte ouverte en grand et sa fiche.
export type TitleMode = 'all' | 'big'
const TITLE_KEY = 'anime-rift-titles'
export const getTitleMode = (): TitleMode => { try { return localStorage.getItem(TITLE_KEY) === 'big' ? 'big' : 'all' } catch { return 'all' } }
export const setTitleMode = (mode: TitleMode) => { try { localStorage.setItem(TITLE_KEY, mode) } catch { /* non enregistré */ } }
