import { describe, expect, it } from 'vitest'
import { BANNERS, PITY_MAX } from '../data/banners'
import { HEROES } from '../data/heroes'
import { isPityRarity, RARITIES, RARITY_ORDER } from '../data/rarities'
import { bannerPool, cardRate, pullMany, pullOne } from './gacha'

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('gacha', () => {
  it('la première bannière donne 30 personnages de Naruto, et eux seuls', () => {
    const pool = bannerPool(BANNERS[0])
    expect(pool).toHaveLength(30)
    expect(pool.every((h) => h.world === 'Naruto')).toBe(true)
    const rng = seeded(5)
    for (let i = 0; i < 20000; i++) expect(pullOne(BANNERS[0], 0, rng).hero.world).toBe('Naruto')
  })

  it('compte six raretés, dont chacune a au moins une carte dans chaque bannière', () => {
    expect(RARITY_ORDER).toHaveLength(6)
    for (const banner of BANNERS) for (const id of RARITY_ORDER) expect(bannerPool(banner).some((h) => h.rarity === id)).toBe(true)
  })

  it('les taux affichés totalisent 100 %', () => {
    const sum = Object.values(RARITIES).reduce((s, r) => s + r.rate, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('plus une rareté est haute, plus elle est difficile à obtenir', () => {
    const rates = RARITY_ORDER.map((id) => RARITIES[id].rate) // de la plus rare à la plus courante
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1])
  })

  it('les taux observés correspondent aux taux affichés (hors garantie)', () => {
    const rng = seeded(42)
    const n = 2_000_000
    const seen: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const { hero } = pullOne(BANNERS[0], 0, rng) // compteur à 0 : la garantie n'intervient pas
      seen[hero.rarity] = (seen[hero.rarity] ?? 0) + 1
    }
    for (const r of Object.values(RARITIES)) {
      const observed = (seen[r.id] ?? 0) / n
      expect(Math.abs(observed - r.rate)).toBeLessThan(0.0015 + r.rate * 0.1) // marge statistique, même pour 0,05 %
    }
  })

  it('le taux par carte de l\'index totalise 100 % et correspond aux tirages réels', () => {
    for (const banner of BANNERS) {
      const sum = HEROES.reduce((s, h) => s + cardRate(banner, h), 0)
      expect(sum).toBeCloseTo(1, 10)
    }
    const banner = BANNERS[0]
    const rng = seeded(9)
    const n = 1_000_000
    const seen: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const { hero } = pullOne(banner, 0, rng)
      seen[hero.id] = (seen[hero.id] ?? 0) + 1
    }
    for (const h of bannerPool(banner)) {
      const expected = cardRate(banner, h)
      expect(Math.abs((seen[h.id] ?? 0) / n - expected)).toBeLessThan(0.0015 + expected * 0.1)
    }
  })

  it('garantit une SSR, LR ou MR au plus tard à la 50e invocation', () => {
    const rng = seeded(7)
    let pity = 0
    let streak = 0
    let longest = 0
    for (let i = 0; i < 300000; i++) {
      const r = pullOne(BANNERS[1], pity, rng)
      pity = r.pity
      streak = isPityRarity(r.hero.rarity) ? 0 : streak + 1
      longest = Math.max(longest, streak)
      expect(streak).toBeLessThan(PITY_MAX)
    }
    expect(longest).toBe(PITY_MAX - 1) // la garantie sert vraiment : sans elle, des séries plus longues existeraient
  })

  it('une multi ×10 rend 10 cartes et fait avancer le compteur', () => {
    const { heroes, pity } = pullMany(BANNERS[2], 0, 10, seeded(3))
    expect(heroes).toHaveLength(10)
    expect(pity).toBeGreaterThanOrEqual(0)
    expect(pity).toBeLessThanOrEqual(10)
  })
})
