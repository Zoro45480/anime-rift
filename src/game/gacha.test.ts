import { describe, expect, it } from 'vitest'
import { BANNERS, PITY_MAX } from '../data/banners'
import { RARITIES } from '../data/rarities'
import { pullMany, pullOne } from './gacha'

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('gacha', () => {
  it('les taux affichés totalisent 100 %', () => {
    const sum = Object.values(RARITIES).reduce((s, r) => s + r.rate, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('les taux observés correspondent aux taux affichés (hors garantie)', () => {
    const rng = seeded(42)
    const n = 400000
    const seen: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const { hero } = pullOne(BANNERS[0], 0, rng) // compteur à 0 : la garantie n'intervient pas
      seen[hero.rarity] = (seen[hero.rarity] ?? 0) + 1
    }
    for (const r of Object.values(RARITIES)) expect(seen[r.id] / n).toBeCloseTo(r.rate, 2)
  })

  it('garantit une LR ou MR au plus tard à la 50e invocation', () => {
    const rng = seeded(7)
    let pity = 0
    let streak = 0
    for (let i = 0; i < 200000; i++) {
      const r = pullOne(BANNERS[1], pity, rng)
      pity = r.pity
      const top = r.hero.rarity === 'legend' || r.hero.rarity === 'rift'
      streak = top ? 0 : streak + 1
      expect(streak).toBeLessThan(PITY_MAX)
    }
  })

  it('une multi ×10 rend 10 cartes et fait avancer le compteur', () => {
    const { heroes, pity } = pullMany(BANNERS[2], 0, 10, seeded(3))
    expect(heroes).toHaveLength(10)
    expect(pity).toBeGreaterThanOrEqual(0)
    expect(pity).toBeLessThanOrEqual(10)
  })
})
