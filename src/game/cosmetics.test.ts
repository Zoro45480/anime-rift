import { describe, expect, it } from 'vitest'
import { canBuy, cosmeticById, COSMETICS, hasCosmetic, type Owned } from './cosmetics'

const none: Owned = { bought: [], level: 1, rebirths: 0, arcs: [] }
describe('apparence du profil', () => {
  it('identifiants uniques, un large choix dans chaque catégorie', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    const count = (k: string) => COSMETICS.filter((c) => c.kind === k).length
    expect(count('frame')).toBe(25)
    expect(count('ornament')).toBe(15)
    expect(count('aura') + count('effect')).toBe(13)
    expect(count('color')).toBe(17)
    expect(count('theme')).toBe(14)
    expect(count('title')).toBe(24)
    for (const kind of ['frame', 'color', 'effect', 'theme']) expect(COSMETICS.some((c) => c.kind === kind && hasCosmetic(c, none))).toBe(true)
  })
  it('offert, gagné (niveau, arc, Renaissance) ou acheté', () => {
    const gold = cosmeticById('frame:t1')!, rainbow = cosmeticById('frame:r')!, glow = cosmeticById('effect:glow')!, naruto = cosmeticById('frame:naruto')!
    expect(hasCosmetic(cosmeticById('frame:t0')!, none)).toBe(true)
    expect(hasCosmetic(gold, { ...none, level: 24 })).toBe(false)
    expect(hasCosmetic(gold, { ...none, level: 25 })).toBe(true)
    expect(hasCosmetic(gold, { ...none, bought: ['frame:t1'] })).toBe(true)
    expect(hasCosmetic(naruto, none)).toBe(false)
    expect(hasCosmetic(naruto, { ...none, arcs: ['naruto'] })).toBe(true)
    expect(hasCosmetic(rainbow, { ...none, level: 100 })).toBe(false)
    expect(hasCosmetic(rainbow, { ...none, rebirths: 1 })).toBe(true)
    expect(canBuy(rainbow, none, 99999)).toBe(false)
    expect(canBuy(glow, none, 119)).toBe(false)
    expect(canBuy(glow, none, 120)).toBe(true)
    expect(canBuy(glow, { ...none, bought: ['effect:glow'] }, 999)).toBe(false)
  })
})
