import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { baseRank, baseStats, cardState, collectifs, kitOf, levelFromXp, MAX_LEVEL, statsAt, xpToNext } from './progression'

describe('progression des cartes', () => {
  it('monte de niveau au bon nombre de points', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFromXp(99).level).toBe(1)
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, need: xpToNext(2) })
    expect(levelFromXp(100 + 140 + 5)).toEqual({ level: 3, into: 5, need: 180 })
    expect(levelFromXp(1e9).level).toBe(MAX_LEVEL)
  })

  it('le niveau et les collectifs augmentent les statistiques', () => {
    const h = HEROES[0]
    expect(statsAt(h, 1, 0)).toEqual(baseStats(h))
    expect(statsAt(h, 11, 0).atk).toBe(Math.round(h.atk * 1.2))
    expect(statsAt(h, 1, 10).def).toBe(Math.round(h.def * 1.1))
  })

  it('les collectifs comptent les cartes possédées et plafonnent leur bonus', () => {
    const h = HEROES[0]
    const world = HEROES.filter((x) => x.world === h.world)
    expect(collectifs(h, {})[0]).toMatchObject({ have: 0, bonus: 0 })
    const five = Object.fromEntries(world.slice(0, 5).map((x) => [x.id, 1]))
    expect(collectifs(h, five)[0].bonus).toBe(2)
    const all = Object.fromEntries(HEROES.map((x) => [x.id, 1]))
    expect(collectifs(h, all)[0].bonus).toBe(12)
    const roleBonus = Math.min(10, Math.floor(HEROES.filter((x) => x.role === h.role).length / 3))
    expect(collectifs(h, all)[1].bonus).toBe(roleBonus)
    expect(cardState(h, {}, all).bonus).toBe(12 + roleBonus)
    expect(cardState(h, {}, { ...all, [h.id]: 0 }).bonus).toBe(0) // pas de bonus pour une carte non possédée
  })

  it('classe chaque carte de 1 à 210 et donne un kit à chaque rôle', () => {
    for (const h of HEROES) {
      expect(baseRank(h)).toBeGreaterThanOrEqual(1)
      expect(baseRank(h)).toBeLessThanOrEqual(HEROES.length)
      expect(kitOf(h).ultimate[0].length).toBeGreaterThan(0)
    }
    const best = HEROES.filter((h) => baseRank(h) === 1)
    expect(best.every((h) => h.rarity === 'rift')).toBe(true)
  })
})
