import type { Hero } from '../data/heroes'
import { RARITY_ORDER } from '../data/rarities'
import type { PhaseTimes } from './presets'

// Déroulé de la cinématique. Fonctions pures : à partir du temps écoulé, on sait dans quelle phase on est.

export type Phase = 'gather' | 'open' | 'surge' | 'hush' | 'burst' | 'reveal'

const ORDER: (keyof PhaseTimes)[] = ['gather', 'open', 'surge', 'hush', 'burst']

// Début de chaque phase, en secondes. `reveal` commence quand tout le reste est fini et dure jusqu'à la fermeture.
export const phaseStarts = (times: PhaseTimes): Record<Phase, number> => {
  const out = {} as Record<Phase, number>
  let t = 0
  for (const p of ORDER) {
    out[p] = t
    t += times[p]
  }
  out.reveal = t
  return out
}

export const totalBeforeReveal = (times: PhaseTimes): number => phaseStarts(times).reveal

// Phase en cours au temps t, avancement k (0 → 1) dans cette phase, et secondes écoulées dans la phase.
export const locate = (times: PhaseTimes, t: number): { phase: Phase; k: number; into: number } => {
  const starts = phaseStarts(times)
  if (t >= starts.reveal) return { phase: 'reveal', k: 1, into: t - starts.reveal }
  let current: keyof PhaseTimes = 'gather'
  for (const p of ORDER) if (times[p] > 0 && t >= starts[p]) current = p
  const into = Math.max(0, t - starts[current])
  return { phase: current, k: Math.min(1, into / times[current]), into }
}

// Le personnage le plus rare d'un tirage : c'est lui qui décide de la mise en scène d'une invocation multiple.
export const pickHeadliner = (heroes: Hero[]): Hero =>
  [...heroes].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))[0]
