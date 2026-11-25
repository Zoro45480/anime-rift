import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { makeUnit, MAX_ROUNDS, seeded, simulate } from './battle'
import { baseStats, power, statsAt } from './progression'
import { foeUnits, isUnlocked, rollDrops, STAGES, starsFor } from './saga'

const team = (ids: string[], level = 1) => ids.map((id, i) => { const h = HEROES.find((x) => x.id === id)!; return makeUnit(h, statsAt(h, level, 0), 0, i) })
const weakest = [...HEROES].filter((h) => h.rarity === 'common').sort((a, b) => power(baseStats(a)) - power(baseStats(b))).slice(0, 3).map((h) => h.id)

describe('combats de la Saga', () => {
  it('un combat est reproductible et se termine toujours', () => {
    const a = simulate(team(['naruto', 'tsunade', 'gaara']), foeUnits(STAGES[10]), seeded(7))
    const b = simulate(team(['naruto', 'tsunade', 'gaara']), foeUnits(STAGES[10]), seeded(7))
    expect(a).toEqual(b)
    for (const s of STAGES) {
      const r = simulate(team(weakest), foeUnits(s), seeded(1))
      expect(r.rounds).toBeLessThanOrEqual(MAX_ROUNDS)
      expect(r.events.length).toBeGreaterThan(0)
    }
  })

  it('les points de vie ne sortent jamais de leurs bornes et les soins, boucliers et provocations existent', () => {
    const r = simulate(team(['hashirama', 'tsunade', 'yuta']), team(['naruto', 'gaara', 'sakura']).map((u, i) => ({ ...u, side: 1 as const, key: `1-${i}` })), seeded(3))
    for (const e of r.events) for (const c of [...e.hits, ...e.heals, ...e.shields]) { expect(c.hp).toBeGreaterThanOrEqual(0); expect(c.amount).toBeGreaterThanOrEqual(0) }
    expect(r.events.some((e) => e.heals.length)).toBe(true)
    expect(r.events.some((e) => e.shields.length)).toBe(true)
    expect(r.events.some((e) => e.taunt)).toBe(true)
    expect(r.events.some((e) => e.kind === 'Ultime')).toBe(true)
  })

  it('le premier combat est gagnable avec les trois cartes les plus faibles, le dernier ne l’est pas au niveau 1', () => {
    let wins = 0
    for (let s = 0; s < 20; s++) if (simulate(team(weakest), foeUnits(STAGES[0]), seeded(s)).win) wins++
    expect(wins).toBe(20)
    expect(simulate(team(['naruto', 'sasuke', 'madara']), foeUnits(STAGES[STAGES.length - 1]), seeded(1)).win).toBe(false)
    expect(simulate(team(['naruto', 'sasuke', 'madara'], 100), foeUnits(STAGES[STAGES.length - 1]), seeded(1)).win).toBe(true)
  })

  it('35 combats, ouverts dans l’ordre, avec un taux de drop pour chaque parchemin', () => {
    expect(STAGES).toHaveLength(35)
    expect(isUnlocked(STAGES[0], {})).toBe(true)
    expect(isUnlocked(STAGES[1], {})).toBe(false)
    expect(isUnlocked(STAGES[1], { [STAGES[0].id]: 1 })).toBe(true)
    for (const s of STAGES) {
      expect(s.foes).toHaveLength(3)
      for (const rate of Object.values(s.drops)) { expect(rate).toBeGreaterThan(0); expect(rate).toBeLessThanOrEqual(1) }
      expect(s.drops.small).toBeGreaterThan(s.drops.medium)
      expect(s.drops.medium).toBeGreaterThan(s.drops.large)
    }
    const rng = seeded(5)
    let small = 0
    for (let i = 0; i < 20000; i++) if (rollDrops(STAGES[0], rng).includes('small')) small++
    expect(small / 20000).toBeCloseTo(STAGES[0].drops.small, 1)
    expect([0, 1, 2, 3].map(starsFor)).toEqual([3, 2, 1, 1])
  })
})
