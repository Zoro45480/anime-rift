import { describe, expect, it } from 'vitest'
import { addCounts, addDays, claimable, DAILY_BONUS, dailyContracts, dailyStatus, dayKey, emptyQuests, isClaimed, markClaimed, msToDayEnd, progress, roll, STORY, weekKey, weeklyContracts } from './contracts'

const at = (s: string) => new Date(`${s}T12:00:00`)

describe('contrats', () => {
  it('dates du jour et de la semaine (le lundi)', () => {
    expect(dayKey(at('2026-11-26'))).toBe('2026-11-26')
    expect(weekKey(at('2026-11-26'))).toBe('2026-11-23') // jeudi → lundi
    expect(weekKey(at('2026-11-23'))).toBe('2026-11-23')
    expect(weekKey(at('2026-11-29'))).toBe('2026-11-23') // dimanche
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(msToDayEnd(at('2026-11-26'))).toBe(12 * 3600 * 1000)
  })

  it('série quotidienne : suit, boucle après 7 jours, repart à 1 après un jour manqué', () => {
    const now = at('2026-11-26')
    expect(dailyStatus({ last: null, streak: 0 }, now)).toEqual({ day: 1, claimed: false, missed: false })
    expect(dailyStatus({ last: '2026-11-25', streak: 3 }, now)).toEqual({ day: 4, claimed: false, missed: false })
    expect(dailyStatus({ last: '2026-11-25', streak: 7 }, now)).toEqual({ day: 1, claimed: false, missed: false })
    expect(dailyStatus({ last: '2026-11-26', streak: 4 }, now)).toEqual({ day: 4, claimed: true, missed: false })
    expect(dailyStatus({ last: '2026-11-23', streak: 5 }, now)).toEqual({ day: 1, claimed: false, missed: true })
  })

  it('les compteurs du jour repartent à zéro le lendemain, ceux de la semaine le lundi, ceux à vie jamais', () => {
    let q = addCounts(emptyQuests(), { pulls: 5, wins: 2 }, at('2026-11-26'))
    q = addCounts(q, { pulls: 3 }, at('2026-11-27'))
    expect(q.day.c.pulls).toBe(3)
    expect(q.week.c.pulls).toBe(8)
    expect(q.life.pulls).toBe(8)
    expect(roll(q, at('2026-11-30')).week.c).toEqual({})
    expect(roll(q, at('2026-11-30')).life.pulls).toBe(8)
  })

  it('un contrat se récupère une fois par période ; le bonus du jour demande toutes les quêtes du jour', () => {
    const now = at('2026-11-26')
    let q = addCounts(emptyQuests(), Object.fromEntries(dailyContracts(now).map((c) => [c.counter!, c.target])), now)
    expect(claimable(q, {}, now).map((c) => c.id).sort()).toEqual(dailyContracts(now).map((c) => c.id).sort())
    for (const c of dailyContracts(now)) q = markClaimed(c, q, now)
    expect(progress(DAILY_BONUS, q, {}, now)).toBe(dailyContracts(now).length)
    expect(claimable(q, {}, now).map((c) => c.id)).toEqual([DAILY_BONUS.id])
    q = markClaimed(DAILY_BONUS, q, now)
    expect(q.week.c.dailyAll).toBe(1)
    expect(claimable(q, {}, now)).toEqual([])
    expect(isClaimed(dailyContracts(now)[0], q, at('2026-11-27'))).toBe(false) // un nouveau jour
    expect(weeklyContracts(now)).toHaveLength(10)
  })

  it('contrats d’histoire : arc terminé, puis 3 étoiles partout', () => {
    const now = at('2026-11-26')
    const q = emptyQuests()
    const clear = STORY.find((c) => c.id === 's-0-clear')!, perfect = STORY.find((c) => c.id === 's-0-perfect')!
    expect(progress(clear, q, { '0-4': 1 }, now)).toBe(1)
    expect(progress(perfect, q, { '0-0': 3, '0-1': 3, '0-2': 3, '0-3': 3, '0-4': 2 }, now)).toBe(14)
    expect(claimable(q, { '0-0': 3, '0-1': 3, '0-2': 3, '0-3': 3, '0-4': 3 }, now).map((c) => c.id).filter((id) => id.startsWith('s-0'))).toEqual(['s-0-0', 's-0-1', 's-0-2', 's-0-3', clear.id, perfect.id])
  })
})

describe('défis du Chemin', () => {
  it('se refont 3 fois par jour, chaque fois avec un nouvel objectif', async () => {
    const { CHALLENGE_POOL: CHALLENGES, challengeState, markChallenge, addCounts, emptyQuests } = await import('./contracts')
    const now = new Date(2026, 10, 26, 12)
    const c = CHALLENGES.find((x) => x.id === 'c-pulls')!
    let q = addCounts(emptyQuests(), { pulls: 25 }, now)
    expect(challengeState(c, q, now)).toMatchObject({ done: 0, value: 10, ready: true })
    q = markChallenge(c, q, now)
    expect(challengeState(c, q, now)).toMatchObject({ done: 1, value: 10, ready: true })
    q = markChallenge(c, q, now)
    expect(challengeState(c, q, now)).toMatchObject({ done: 2, value: 5, ready: false })
    q = markChallenge(c, addCounts(q, { pulls: 5 }, now), now)
    expect(challengeState(c, q, now).finished).toBe(true)
    expect(challengeState(c, q, new Date(2026, 10, 27, 9)).done).toBe(0)
  })
})

describe('quêtes qui changent', () => {
  it('6 quêtes du jour, différentes d’un jour à l’autre, identiques dans la journée', async () => {
    const { dailyContracts } = await import('./contracts')
    const a = dailyContracts(new Date(2026, 10, 26, 9)).map((c) => c.id)
    expect(a).toHaveLength(8)
    expect(dailyContracts(new Date(2026, 10, 26, 22)).map((c) => c.id)).toEqual(a)
    const days = new Set(Array.from({ length: 7 }, (_, i) => dailyContracts(new Date(2026, 10, 20 + i)).map((c) => c.id).join()))
    expect(days.size).toBeGreaterThan(4)
  })
  it('les quêtes du pass restent toute la saison et changent à la saison suivante', async () => {
    const { challengesFor } = await import('./contracts')
    const s1 = challengesFor(new Date(2026, 10, 26)).map((c) => c.id)
    expect(s1).toHaveLength(8)
    expect(challengesFor(new Date(2026, 11, 18)).map((c) => c.id)).toEqual(s1)
    const later = [1, 2, 3].map((k) => challengesFor(new Date(2026, 11, 22 + 28 * (k - 1))).map((c) => c.id).join())
    expect(later.some((x) => x !== s1.join())).toBe(true)
  })
})
