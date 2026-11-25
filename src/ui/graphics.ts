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
export const applyGraphics = () => { document.documentElement.dataset.fx = effectiveGraphics() }
export const setGraphics = (mode: GraphicsMode) => {
  try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode) } catch { /* non enregistré */ }
  applyGraphics()
}
