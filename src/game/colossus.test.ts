import { describe, expect, it } from 'vitest'
import { colossusFoes, colossusOf, DIFFICULTIES, emptyCol, eventDone, isOpen, rollCol } from './colossus'

describe('Les Colosses', () => {
  it('un méchant par semaine, avec deux sbires de son univers', () => {
    const a = colossusOf(new Date(2026, 10, 26)), b = colossusOf(new Date(2026, 11, 3))
    expect(a.boss.id).not.toBe(b.boss.id)
    expect(a.minions).toHaveLength(2)
    for (const m of a.minions) expect(m.world).toBe(a.boss.world)
    expect(colossusOf(new Date(2026, 10, 29)).boss.id).toBe(a.boss.id)
  })
  it('les difficultés s’ouvrent une à une et deviennent plus dures', () => {
    const c = emptyCol('2026-11-23')
    expect(isOpen(c, DIFFICULTIES[0])).toBe(true); expect(isOpen(c, DIFFICULTIES[1])).toBe(false)
    expect(isOpen({ ...c, cleared: ['normal'] }, DIFFICULTIES[1])).toBe(true)
    const { boss, minions } = colossusOf(new Date(2026, 10, 26))
    const hp = DIFFICULTIES.map((d) => colossusFoes(boss, minions, d)[0].maxHp)
    for (let i = 1; i < hp.length; i++) expect(hp[i]).toBeGreaterThan(hp[i - 1])
  })
  it('l’événement se termine avec les 3 objectifs et repart chaque semaine', () => {
    const c = { ...emptyCol('2026-11-23'), wins: 5, pulls: 50, cleared: ['normal', 'hard', 'extreme'] as const }
    expect(eventDone({ ...c, cleared: [...c.cleared] })).toBe(true)
    expect(rollCol({ ...c, cleared: [...c.cleared] }, new Date(2026, 11, 1)).wins).toBe(0)
  })
})
