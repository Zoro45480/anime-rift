import { describe, expect, it } from 'vitest'
import { eloChange, leagueOf, rivalsFor, rivalUnits } from './arena'

describe('Arène', () => {
  it('cote elo : gagner contre plus fort rapporte plus', () => {
    expect(eloChange(1000, 1000, true)).toBe(16)
    expect(eloChange(1000, 1200, true)).toBeGreaterThan(eloChange(1000, 800, true))
    expect(eloChange(1000, 1000, false)).toBe(-16)
  })
  it('ligues', () => {
    expect(leagueOf(1000).label).toBe('Bronze'); expect(leagueOf(1250).label).toBe('Or'); expect(leagueOf(2400).label).toBe('Légende')
  })
  it('trois rivaux autour de ta cote, toujours les mêmes pour une même graine', () => {
    const a = rivalsFor(1300, 4), b = rivalsFor(1300, 4)
    expect(a.map((r) => r.name)).toEqual(b.map((r) => r.name))
    for (const r of a) { expect(Math.abs(r.elo - 1300)).toBeLessThan(140); expect(new Set(r.heroes.map((h) => h.id)).size).toBe(3) }
  })
  it('un rival mieux classé est plus fort', () => {
    const [low, , high] = rivalsFor(1200, 9)
    const p = (u: ReturnType<typeof rivalUnits>) => u.reduce((s, x) => s + x.atk + x.def + x.hp / 10, 0)
    expect(p(rivalUnits({ ...high, scale: 1 }, 1200, 5000))).toBeGreaterThan(p(rivalUnits({ ...low, scale: 1, heroes: high.heroes }, 1200, 5000)))
  })
})
