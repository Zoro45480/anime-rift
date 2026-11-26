import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { ACHIEVEMENTS, DEFAULT_TITLE, progressOf, unlockedTitles, type AchState } from './achievements'

const empty: AchState = { owned: {}, xp: {}, saga: {}, awakened: [], rebirths: 0, pulls: 0, wins: 0 }

describe('succès', () => {
  it('identifiants et titres uniques, objectifs atteignables', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    expect(new Set(ACHIEVEMENTS.map((a) => a.title)).size).toBe(ACHIEVEMENTS.length)
    expect(ACHIEVEMENTS.find((a) => a.id === 'cards-400')!.target).toBeLessThanOrEqual(HEROES.length)
  })

  it('une partie neuve n’a aucun succès ; ils se débloquent avec la partie', () => {
    expect(unlockedTitles(empty)).toEqual([DEFAULT_TITLE])
    const s: AchState = { ...empty, owned: Object.fromEntries(HEROES.slice(0, 12).map((h) => [h.id, 1])), pulls: 12, wins: 10, saga: { '0-0': 3, '0-4': 2 }, rebirths: 1 }
    const titles = unlockedTitles(s)
    for (const t of ['Collectionneur', 'Invocateur', 'Combattant', 'Voyageur', 'Revenant', 'Témoin du mythe']) expect(titles).toContain(t)
    expect(titles).not.toContain('Archiviste')
    expect(progressOf(ACHIEVEMENTS.find((a) => a.id === 'cards-50')!, s)).toEqual({ value: 12, done: false })
    expect(progressOf(ACHIEVEMENTS.find((a) => a.id === 'pulls-10')!, s)).toEqual({ value: 10, done: true })
  })
})
