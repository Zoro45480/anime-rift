import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { PRESETS } from './presets'
import { locate, phaseStarts, pickHeadliner, totalBeforeReveal } from './timeline'

describe('cinématique d\'invocation', () => {
  it('enchaîne les phases dans l\'ordre, sans trou', () => {
    const times = PRESETS.rift.times
    const s = phaseStarts(times)
    expect(s.gather).toBe(0)
    expect(s.open).toBeCloseTo(times.gather)
    expect(s.reveal).toBeCloseTo(times.gather + times.open + times.surge + times.hush + times.burst)
    expect(locate(times, 0).phase).toBe('gather')
    expect(locate(times, s.open + 0.01).phase).toBe('open')
    expect(locate(times, s.surge + 0.01).phase).toBe('surge')
    expect(locate(times, s.hush + 0.01).phase).toBe('hush')
    expect(locate(times, s.burst + 0.01).phase).toBe('burst')
    expect(locate(times, s.reveal + 3).phase).toBe('reveal')
  })

  it('saute une phase de durée nulle (pas de silence pour les cartes R)', () => {
    const times = PRESETS.rare.times
    const s = phaseStarts(times)
    expect(times.hush).toBe(0)
    expect(locate(times, s.hush + 0.01).phase).toBe('burst')
  })

  it('donne un avancement entre 0 et 1 dans chaque phase', () => {
    for (const preset of Object.values(PRESETS)) {
      for (let t = 0; t < totalBeforeReveal(preset.times) + 1; t += 0.05) {
        const { k } = locate(preset.times, t)
        expect(k).toBeGreaterThanOrEqual(0)
        expect(k).toBeLessThanOrEqual(1)
      }
    }
  })

  it('plus la carte est rare, plus la séquence est longue', () => {
    const d = (id: keyof typeof PRESETS) => totalBeforeReveal(PRESETS[id].times)
    expect(d('rare')).toBeLessThan(d('epic'))
    expect(d('epic')).toBeLessThan(d('legend'))
    expect(d('legend')).toBeLessThan(d('rift'))
  })

  it('choisit le personnage le plus rare comme tête d\'affiche d\'une invocation multiple', () => {
    const rare = HEROES.find((h) => h.rarity === 'rare')!
    const epic = HEROES.find((h) => h.rarity === 'epic')!
    const rift = HEROES.find((h) => h.rarity === 'rift')!
    expect(pickHeadliner([rare, epic, rare]).rarity).toBe('epic')
    expect(pickHeadliner([rare, rift, epic]).rarity).toBe('rift')
    expect(pickHeadliner([rare]).id).toBe(rare.id)
  })
})
