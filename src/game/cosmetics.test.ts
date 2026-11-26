import { describe, expect, it } from 'vitest'
import { canBuy, cosmeticById, COSMETICS, hasCosmetic } from './cosmetics'

describe('apparence du profil', () => {
  it('identifiants uniques, un objet offert par catégorie', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    for (const kind of ['frame', 'color', 'effect', 'theme']) expect(COSMETICS.some((c) => c.kind === kind && c.price === 0 && !c.needRebirth)).toBe(true)
  })
  it('offert, gagné par le niveau ou la Renaissance, ou acheté', () => {
    const gold = cosmeticById('frame:t1')!, rainbow = cosmeticById('frame:r')!, glow = cosmeticById('effect:glow')!
    expect(hasCosmetic(cosmeticById('frame:t0')!, [], 1, 0)).toBe(true)
    expect(hasCosmetic(gold, [], 24, 0)).toBe(false)
    expect(hasCosmetic(gold, [], 25, 0)).toBe(true)
    expect(hasCosmetic(gold, ['frame:t1'], 1, 0)).toBe(true)
    expect(hasCosmetic(rainbow, [], 100, 0)).toBe(false)
    expect(hasCosmetic(rainbow, [], 1, 1)).toBe(true)
    expect(canBuy(rainbow, [], 1, 0, 99999)).toBe(false)
    expect(canBuy(glow, [], 1, 0, 119)).toBe(false)
    expect(canBuy(glow, [], 1, 0, 120)).toBe(true)
    expect(canBuy(glow, ['effect:glow'], 1, 0, 999)).toBe(false)
  })
})
