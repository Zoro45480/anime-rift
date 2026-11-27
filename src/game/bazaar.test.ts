import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { auctionNow, auctionResult, coteOf, demand, median, quickPrice, stallOf, valueOf } from './bazaar'

const day = '2026-11-26'
describe('Bazar', () => {
  it('la valeur suit la rareté, le niveau et la demande du jour', () => {
    const c = HEROES.find((h) => h.rarity === 'common')!, l = HEROES.find((h) => h.rarity === 'legend')!
    expect(valueOf(l, 1, day)).toBeGreaterThan(valueOf(c, 1, day) * 50)
    expect(valueOf(c, 50, day)).toBeGreaterThan(valueOf(c, 1, day))
    expect(demand('naruto', day)).toBeGreaterThanOrEqual(0.8); expect(demand('naruto', day)).toBeLessThanOrEqual(1.25)
    expect(quickPrice(l, 1, day)).toBeLessThan(valueOf(l, 1, day))
  })
  it('l’étal du jour : 8 cartes différentes, les envies en premier, le même toute la journée', () => {
    const s = stallOf(day, ['goku'])
    expect(s).toHaveLength(8); expect(new Set(s.map((x) => x.hero.id)).size).toBe(8)
    expect(s[0].hero.id).toBe('goku'); expect(s[0].wished).toBe(true)
    expect(stallOf(day, ['goku']).map((x) => x.price)).toEqual(s.map((x) => x.price))
  })
  it('une enchère monte au fil du temps jusqu’au prix final', () => {
    const h = HEROES.find((x) => x.rarity === 'epic')!
    const a = { id: 'a1', heroId: h.id, level: 1, start: 10, at: 0, ends: 1000 }
    const r = auctionResult(a, h)
    expect(r.sold).toBe(true)
    expect(auctionNow(a, h, 1000).best).toBe(r.price)
    expect(auctionNow(a, h, 300).best).toBeLessThan(r.price)
    expect(auctionResult({ ...a, start: 999999 }, h).sold).toBe(false)
  })
  it('la cote vient des vraies transactions', () => {
    expect(median([3, 1, 2])).toBe(2); expect(median([])).toBe(0)
    const now = 100 * 86400000
    const c = coteOf([{ t: now - 86400000, heroId: 'x', kind: 'sell', price: 10 }, { t: now - 20 * 86400000, heroId: 'x', kind: 'buy', price: 30 }], 'x', now)
    expect(c.d7).toBe(10); expect(c.d30).toBe(20); expect(c.count30).toBe(2)
  })
})

import { bazaarUnlocked, heldUntil, tradeProblem, unlockSteps } from './bazaar'
describe('règles du Bazar entre joueurs', () => {
  it('se débloque avec ancienneté, connexions et victoires', () => {
    const now = new Date('2026-12-10T12:00:00').getTime()
    expect(bazaarUnlocked({ days: 1, first: '2026-12-10' }, 0, now)).toBe(false)
    expect(unlockSteps({ days: 3, first: '2026-12-06' }, 4, now).map((s) => s.done)).toEqual([true, true, false])
    expect(bazaarUnlocked({ days: 5, first: '2026-12-01' }, 12, now)).toBe(true)
  })
  it('bloque 24 h une carte reçue', () => {
    expect(heldUntil([{ t: 1000, note: 'Achat au marché' }], 2000)).toBe(1000 + 24 * 3600 * 1000)
    expect(heldUntil([{ t: 1000 }], 2000)).toBe(0)
  })
  it('n’accepte que les échanges équitables', () => {
    expect(tradeProblem([{ rarity: 'epic' }], [{ rarity: 'rift' }])).toMatch(/Raretés/)
    expect(tradeProblem([{ rarity: 'epic' }], [])).toMatch(/au moins/)
    expect(tradeProblem([{ rarity: 'epic' }, { rarity: 'rare' }], [{ rarity: 'rare' }, { rarity: 'epic' }])).toBe('')
  })
})
