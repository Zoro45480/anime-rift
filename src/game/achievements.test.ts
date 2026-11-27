import { describe, expect, it } from 'vitest'
import { HEROES } from '../data/heroes'
import { emptyQuests } from './contracts'
import { ACHIEVEMENTS, DEFAULT_TITLE, GROUPS, medalOf, progressOf, unlockedTitles, type AchState } from './achievements'

const empty: AchState = { owned: {}, xp: {}, saga: {}, awakened: [], rebirths: 0, pulls: 0, wins: 0, gemsSpent: 0, accountXp: 0, quests: emptyQuests(), spire: { best: 0 }, path: { season: 1, xp: 0, claimed: [] }, seen: { days: 0 } }

describe('succès', () => {
  it('identifiants et titres uniques, objectifs atteignables', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    expect(new Set(ACHIEVEMENTS.map((a) => a.title)).size).toBe(ACHIEVEMENTS.length)
    expect(ACHIEVEMENTS.find((a) => a.id === 'cards-500')!.target).toBeLessThanOrEqual(HEROES.length)
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

  it('environ 70 succès en 8 catégories, chacune avec sa médaille', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(67)
    for (const g of GROUPS) expect(ACHIEVEMENTS.filter((a) => a.group === g).length).toBeGreaterThanOrEqual(6)
    expect(new Set(ACHIEVEMENTS.map(medalOf)).size).toBeGreaterThan(20)
  })

  it('La Spire, les contrats et l’ancienneté comptent', () => {
    const s: AchState = { ...empty, spire: { best: 10 }, seen: { days: 7 }, quests: { ...emptyQuests(), life: { dailies: 7, claims: 10 } } }
    const titles = unlockedTitles(s)
    for (const t of ['Grimpeur', 'Alpiniste', 'Tueur de gardien', 'Résident', 'Fidèle', 'Contractant']) expect(titles).toContain(t)
  })
})

import { currentSector, hqLevel, sectorProgress, ALL_SECTORS } from './operations'
describe('opérations d’Ordre', () => {
  it('avance de secteur en secteur avec les dégâts de la semaine', () => {
    expect(currentSector(0)?.id).toBe('scout')
    expect(currentSector(6_000_000)?.id).toBe('regen')
    expect(currentSector(60_000_000)).toBeNull()
    expect(sectorProgress(ALL_SECTORS[1], 3_500_000)).toBeCloseTo(0.5)
  })
  it('monte le QG avec la Renommée, jusqu’au niveau 20', () => {
    expect(hqLevel(0)).toBe(1)
    expect(hqLevel(25_000_000)).toBe(3)
    expect(hqLevel(9e9)).toBe(20)
  })
})
