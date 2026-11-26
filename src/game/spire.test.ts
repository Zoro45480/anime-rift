import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { makeUnit } from './battle'
import { baseStats } from './progression'
import { applyRule, floor, floorForce, floorReward, RULES, spireFoes } from './spire'

describe('La Spire', () => {
  it('un étage donne toujours les mêmes adversaires', () => {
    expect(floor(17).foes.map((h) => h.id)).toEqual(floor(17).foes.map((h) => h.id))
    expect(new Set(floor(17).foes.map((h) => h.id)).size).toBe(3)
  })
  it('devient de plus en plus dur', () => {
    for (let n = 1; n < 80; n++) if (n % 10 !== 0) expect(floorForce(n + 1)).toBeGreaterThan(floorForce(n))
    expect(floorForce(50)).toBeGreaterThan(floorForce(1) * 15)
  })
  it('un gardien tous les 10 étages, avec fragments, sceau et parchemin', () => {
    const f = floor(20)
    expect(f.boss).toBe(true); expect(f.rule.id).toBe('guardian')
    expect(f.reward.shards).toBeGreaterThan(0); expect(f.reward.tickets).toBe(1); expect(f.reward.scrolls?.large).toBe(1)
    expect(floorReward(5).shards).toBe(2); expect(floorReward(3).shards).toBeUndefined()
  })
  it('les règles changent les stats', () => {
    const rage = { ...floor(3), rule: RULES.find((r) => r.id === 'rage')! }
    const calm = { ...floor(3), rule: RULES[0] }
    expect(spireFoes(rage)[0].atk).toBeGreaterThan(spireFoes(calm)[0].atk)
    const tank = HEROES.find((h) => h.role === 'Tank')!, dps = HEROES.find((h) => h.role === 'DPS')!
    const [t, d] = applyRule([makeUnit(tank, baseStats(tank), 0, 0), makeUnit(dps, baseStats(dps), 0, 1)], RULES.find((r) => r.id === 'bastion')!)
    expect(t.def).toBeGreaterThan(baseStats(tank).def); expect(d.def).toBe(baseStats(dps).def)
  })
})
