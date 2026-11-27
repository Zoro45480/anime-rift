import { describe, expect, it } from 'vitest'
import { claimableTiers, rollCard, rollPath, seasonOf, tierOf, tierReward, TIERS } from './riftpath'

describe('Chemin du Rift', () => {
  it('découpe le temps en saisons de 4 semaines', () => {
    const a = seasonOf(new Date(2026, 10, 26)), b = seasonOf(new Date(2026, 11, 21, 1))
    expect(a.number).toBe(1); expect(b.number).toBe(2)
    expect(a.end.getTime()).toBe(b.start.getTime())
  })
  it('remet la progression à zéro à chaque saison', () => {
    const p = { season: 1, xp: 450, claimed: [1, 2] }
    expect(rollPath(p, new Date(2026, 10, 26))).toBe(p)
    expect(rollPath(p, new Date(2026, 11, 22))).toEqual({ season: 2, xp: 0, claimed: [] })
  })
  it('des paliers de plus en plus chers, plafonnés', () => {
    expect(tierOf(249)).toBe(0); expect(tierOf(250)).toBe(1); expect(tierOf(514)).toBe(1); expect(tierOf(515)).toBe(2); expect(tierOf(999999)).toBe(TIERS)
    expect(claimableTiers({ season: 1, xp: 800, claimed: [2] })).toEqual([1, 3])
  })
  it('donne une carte tous les 10 paliers et des sceaux tous les 5', () => {
    expect(tierReward(10).card).toBe(true); expect(tierReward(40).tickets).toBe(10)
    expect(tierReward(5).tickets).toBe(3); expect(tierReward(25).tickets).toBe(6)
    expect(tierReward(1).gems).toBeGreaterThan(0)
  })
  it('la carte est toujours SR ou mieux', () => {
    let seed = 1
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 300; i++) expect(['epic', 'ultra', 'legend']).toContain(rollCard(rng).rarity)
  })
})
