import { BANNERS } from '../data/banners'
import type { ScrollId } from './progression'
import { STAGES, STAGES_PER_ARC } from './saga'
import { seasonOf } from './riftpath'

// Contrats : récompense quotidienne, contrats du jour (6 + bonus), de la semaine (lundi), d'histoire (une seule fois),
// et compteurs à vie pour le Parcours. Fonctions pures : la date est toujours passée en argument.

export type Reward = { gems?: number; energy?: number; tickets?: number; shards?: number; scrolls?: Partial<Record<ScrollId, number>> }
export type Counter = 'pulls' | 'newCards' | 'featuredPull' | 'wins' | 'win3' | 'levels' | 'visit' | 'merges' | 'dailyAll' | 'gemsSpent' | 'damage' | 'bosses' | 'floors' | 'claims' | 'dailies'
export type Counts = Partial<Record<Counter, number>>
export type Period = { key: string; c: Counts; claimed: string[]; ch?: Record<string, number> } // ch : défis du Chemin récupérés aujourd'hui
export type Quests = { day: Period; week: Period; story: string[]; life: Counts; daily: { last: string | null; streak: number } }
export type Contract = { id: string; period: 'day' | 'week' | 'story'; title: string; target: number; reward: Reward; counter?: Counter; arc?: number; perfect?: boolean }

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (key: string, n: number) => { const d = parse(key); d.setDate(d.getDate() + n); return dayKey(d) }
// La semaine commence le lundi.
export const weekKey = (d: Date) => addDays(dayKey(d), -((d.getDay() + 6) % 7))
// Temps restant (ms) avant minuit, et avant lundi minuit.
export const msToDayEnd = (d: Date) => parse(addDays(dayKey(d), 1)).getTime() - d.getTime()
export const msToWeekEnd = (d: Date) => parse(addDays(weekKey(d), 7)).getTime() - d.getTime()

// Univers à l'honneur aujourd'hui (il change chaque jour).
export const featuredWorld = (d: Date) => BANNERS[Math.floor(parse(dayKey(d)).getTime() / 86400000) % BANNERS.length].world

export const emptyQuests = (): Quests => ({ day: { key: '', c: {}, claimed: [] }, week: { key: '', c: {}, claimed: [] }, story: [], life: {}, daily: { last: null, streak: 0 } })

// Remet à zéro les compteurs du jour ou de la semaine quand la période a changé.
export const roll = (q: Quests, now: Date): Quests => {
  const d = dayKey(now), w = weekKey(now)
  return {
    ...q,
    day: q.day.key === d ? q.day : { key: d, c: {}, claimed: [] },
    week: q.week.key === w ? q.week : { key: w, c: {}, claimed: [] },
  }
}
const plus = (a: Counts, b: Counts): Counts => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b) as [Counter, number][]) if (v) out[k] = (out[k] ?? 0) + v
  return out
}
export const addCounts = (q: Quests, adds: Counts, now: Date): Quests => {
  const r = roll(q, now)
  return { ...r, day: { ...r.day, c: plus(r.day.c, adds) }, week: { ...r.week, c: plus(r.week.c, adds) }, life: plus(r.life, adds) }
}

// ───── Récompense quotidienne : 7 jours d'affilée, le 7e ouvre un coffre ─────
export const DAILY_REWARDS: Reward[] = [
  { gems: 20 }, { gems: 30 }, { energy: 5 }, { gems: 50 }, { gems: 60, tickets: 1 }, { gems: 80, scrolls: { medium: 1 } },
  { gems: 150, tickets: 2, scrolls: { large: 1 }, shards: 5 },
]
// Jour de la série à récupérer aujourd'hui (1 à 7), s'il est déjà récupéré, et si la série vient d'être perdue.
export const dailyStatus = (daily: Quests['daily'], now: Date) => {
  const today = dayKey(now)
  if (daily.last === today) return { day: daily.streak, claimed: true, missed: false }
  if (daily.last && daily.last === addDays(today, -1)) return { day: (daily.streak % 7) + 1, claimed: false, missed: false }
  return { day: 1, claimed: false, missed: daily.last !== null }
}

// ───── Les contrats ─────
const d = (id: string, title: string, counter: Counter, target: number, reward: Reward): Contract => ({ id: `d-${id}`, period: 'day', title, counter, target, reward })
const w = (id: string, title: string, counter: Counter, target: number, reward: Reward): Contract => ({ id: `w-${id}`, period: 'week', title, counter, target, reward })

// Petit tirage déterministe : un même jour (ou une même saison) donne toujours les mêmes quêtes.
const pickFrom = <T,>(pool: T[], count: number, seedText: string): T[] => {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  const rng = () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const list = [...pool]
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]] }
  return list.slice(0, count)
}

// Toutes les quêtes du jour possibles : 6 sont tirées chaque jour (la première vise toujours l'univers du jour).
export const DAILY_POOL: Contract[] = [
  d('new', 'Découvre 2 nouveaux persos', 'newCards', 2, { gems: 30 }),
  d('new3', 'Découvre 3 nouveaux persos', 'newCards', 3, { gems: 40 }),
  d('win3', 'Gagne un combat avec 3 étoiles', 'win3', 1, { gems: 20, energy: 2 }),
  d('wins', 'Gagne 3 combats', 'wins', 3, { gems: 20, energy: 3 }),
  d('wins5', 'Gagne 5 combats', 'wins', 5, { gems: 35, energy: 3 }),
  d('levels', 'Fais gagner 3 niveaux à tes cartes', 'levels', 3, { gems: 30 }),
  d('levels6', 'Fais gagner 6 niveaux à tes cartes', 'levels', 6, { gems: 45 }),
  d('visit', 'Passe voir ta collection', 'visit', 1, { gems: 10 }),
  d('pulls5', 'Fais 5 invocations', 'pulls', 5, { gems: 25 }),
  d('pulls10', 'Fais 10 invocations', 'pulls', 10, { gems: 40, tickets: 1 }),
  d('merges', 'Fusionne 2 doublons', 'merges', 2, { gems: 25 }),
  d('damage', 'Inflige 20 000 dégâts', 'damage', 20000, { gems: 30, energy: 2 }),
  d('boss', 'Bats un boss', 'bosses', 1, { gems: 35 }),
  d('floors', 'Monte un étage de La Spire', 'floors', 1, { gems: 30, shards: 1 }),
  d('spend', 'Dépense 60 âmes', 'gemsSpent', 60, { gems: 20, scrolls: { small: 2 } }),
]
export const dailyContracts = (now: Date): Contract[] => [
  d('featured', `Obtiens un perso de ${featuredWorld(now)}`, 'featuredPull', 1, { gems: 30 }),
  ...pickFrom(DAILY_POOL, 5, `jour|${dayKey(now)}`),
]
export const DAILY_BONUS: Contract = { id: 'd-all', period: 'day', title: 'Termine tous les contrats du jour', target: 6, reward: { gems: 60, tickets: 1 } }
export const WEEKLY: Contract[] = [
  w('merges', 'Fusionne 10 doublons', 'merges', 10, { gems: 150 }),
  w('dailyAll', 'Termine tous les contrats du jour 3 fois', 'dailyAll', 3, { gems: 200, tickets: 2 }),
  w('spend', 'Dépense 300 âmes', 'gemsSpent', 300, { gems: 100 }),
  w('damage', 'Inflige 200 000 dégâts', 'damage', 200000, { gems: 150, energy: 10 }),
  w('pulls', 'Fais 20 invocations', 'pulls', 20, { gems: 150, tickets: 1 }),
  w('bosses', 'Bats 3 boss', 'bosses', 3, { gems: 200, scrolls: { large: 1 } }),
  w('floors', 'Monte 5 étages de La Spire', 'floors', 5, { gems: 150, shards: 4 }),
]
export const STORY: Contract[] = BANNERS.flatMap((b, arc) => [
  { id: `s-${arc}-clear`, period: 'story', title: `Termine l'arc ${b.world}`, target: 1, arc, reward: { gems: 100, tickets: 1 } },
  { id: `s-${arc}-perfect`, period: 'story', title: `3★ sur tout l'arc ${b.world}`, target: STAGES_PER_ARC * 3, arc, perfect: true, reward: { gems: 200, scrolls: { large: 1 }, shards: 3 } },
] as Contract[])

export const progress = (c: Contract, q: Quests, saga: Record<string, number>, now: Date): number => {
  const r = roll(q, now)
  if (c.id === DAILY_BONUS.id) return r.day.claimed.filter((id) => id !== DAILY_BONUS.id).length
  if (c.period === 'story') {
    const stages = STAGES.filter((s) => s.arc === c.arc)
    return c.perfect ? stages.reduce((n, s) => n + (saga[s.id] ?? 0), 0) : (saga[stages[stages.length - 1].id] ?? 0) > 0 ? 1 : 0
  }
  return (c.period === 'day' ? r.day : r.week).c[c.counter!] ?? 0
}
export const isClaimed = (c: Contract, q: Quests, now: Date) => {
  const r = roll(q, now)
  return c.period === 'story' ? q.story.includes(c.id) : (c.period === 'day' ? r.day : r.week).claimed.includes(c.id)
}
export const allContracts = (now: Date) => [...dailyContracts(now), DAILY_BONUS, ...WEEKLY, ...STORY]
export const claimable = (q: Quests, saga: Record<string, number>, now: Date) =>
  allContracts(now).filter((c) => !isClaimed(c, q, now) && progress(c, q, saga, now) >= c.target)

// Marque un contrat comme récupéré. Le bonus « tous les contrats du jour » compte aussi pour la semaine.
export const markClaimed = (c: Contract, q: Quests, now: Date): Quests => {
  const r = roll(q, now)
  if (c.period === 'story') return { ...r, story: [...r.story, c.id] }
  if (c.period === 'week') return { ...r, week: { ...r.week, claimed: [...r.week.claimed, c.id] } }
  const next = { ...r, day: { ...r.day, claimed: [...r.day.claimed, c.id] } }
  return c.id === DAILY_BONUS.id ? addCounts(next, { dailyAll: 1 }, now) : next
}

// ───── Défis du Chemin : chacun se refait 3 fois par jour et fait avancer le Chemin du Rift ─────
export type Challenge = { id: string; title: string; counter: Counter; target: number; xp: number; gems: number }
export const CHALLENGE_TIMES = 3
export const CHALLENGE_POOL: Challenge[] = [
  { id: 'c-wins', title: 'Gagne 3 combats (tous modes)', counter: 'wins', target: 3, xp: 40, gems: 10 },
  { id: 'c-floors', title: 'Monte 2 étages de La Spire', counter: 'floors', target: 2, xp: 50, gems: 10 },
  { id: 'c-damage', title: 'Inflige 30 000 dégâts', counter: 'damage', target: 30000, xp: 40, gems: 10 },
  { id: 'c-pulls', title: 'Fais 10 invocations', counter: 'pulls', target: 10, xp: 40, gems: 10 },
  { id: 'c-merges', title: 'Fusionne 2 doublons', counter: 'merges', target: 2, xp: 30, gems: 10 },
  { id: 'c-levels', title: 'Fais gagner 5 niveaux à tes cartes', counter: 'levels', target: 5, xp: 40, gems: 10 },
  { id: 'c-boss', title: 'Bats 2 boss', counter: 'bosses', target: 2, xp: 50, gems: 15 },
  { id: 'c-new', title: 'Découvre 2 nouveaux persos', counter: 'newCards', target: 2, xp: 40, gems: 10 },
  { id: 'c-win3', title: 'Gagne 2 combats avec 3 étoiles', counter: 'win3', target: 2, xp: 45, gems: 10 },
  { id: 'c-spend', title: 'Dépense 90 âmes', counter: 'gemsSpent', target: 90, xp: 35, gems: 15 },
]
// Les quêtes du pass : 5 tirées pour toute la saison du Chemin du Rift ; elles changent quand la saison se termine.
export const challengesFor = (now: Date): Challenge[] => pickFrom(CHALLENGE_POOL, 5, `saison|${seasonOf(now).number}`)
// Combien de fois le défi a été récupéré aujourd'hui, et où en est la prochaine fois.
export const challengeState = (c: Challenge, q: Quests, now: Date) => {
  const r = roll(q, now)
  const done = r.day.ch?.[c.id] ?? 0
  const total = r.day.c[c.counter] ?? 0
  const value = Math.max(0, Math.min(c.target, total - done * c.target))
  return { done, value, ready: done < CHALLENGE_TIMES && value >= c.target, finished: done >= CHALLENGE_TIMES }
}
export const markChallenge = (c: Challenge, q: Quests, now: Date): Quests => {
  const r = roll(q, now)
  return { ...r, day: { ...r.day, ch: { ...(r.day.ch ?? {}), [c.id]: (r.day.ch?.[c.id] ?? 0) + 1 } } }
}
