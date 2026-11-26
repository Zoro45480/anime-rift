import { describe, expect, it } from 'vitest'
import { addCounts, addDays, claimable, DAILY_BONUS, dailyContracts, dailyStatus, dayKey, emptyQuests, isClaimed, markClaimed, msToDayEnd, progress, roll, STORY, weekKey, WEEKLY } from './contracts'

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

  it('un contrat se récupère une fois par période ; le bonus du jour demande les 6', () => {
    const now = at('2026-11-26')
    let q = addCounts(emptyQuests(), { visit: 1, wins: 3, win3: 1, levels: 4, newCards: 2, featuredPull: 1 }, now)
    expect(claimable(q, {}, now).map((c) => c.id).sort()).toEqual(dailyContracts(now).map((c) => c.id).sort())
    for (const c of dailyContracts(now)) q = markClaimed(c, q, now)
    expect(progress(DAILY_BONUS, q, {}, now)).toBe(6)
    expect(claimable(q, {}, now).map((c) => c.id)).toEqual([DAILY_BONUS.id])
    q = markClaimed(DAILY_BONUS, q, now)
    expect(q.week.c.dailyAll).toBe(1)
    expect(claimable(q, {}, now)).toEqual([])
    expect(isClaimed(dailyContracts(now)[0], q, at('2026-11-27'))).toBe(false) // un nouveau jour
    expect(WEEKLY).toHaveLength(6)
  })

  it('contrats d’histoire : arc terminé, puis 3 étoiles partout', () => {
    const now = at('2026-11-26')
    const q = emptyQuests()
    const clear = STORY[0], perfect = STORY[1]
    expect(progress(clear, q, { '0-4': 1 }, now)).toBe(1)
    expect(progress(perfect, q, { '0-0': 3, '0-1': 3, '0-2': 3, '0-3': 3, '0-4': 2 }, now)).toBe(14)
    expect(claimable(q, { '0-0': 3, '0-1': 3, '0-2': 3, '0-3': 3, '0-4': 3 }, now).map((c) => c.id)).toEqual([clear.id, perfect.id])
  })
})
