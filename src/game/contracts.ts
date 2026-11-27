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
export type Contract = { id: string; period: 'day' | 'week' | 'story'; title: string; target: number; reward: Reward; counter?: Counter; arc?: number; perfect?: boolean; stage?: string }

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
  d('new1', 'Découvre un nouveau perso', 'newCards', 1, { gems: 15 }),
  d('win3', 'Gagne un combat avec 3 étoiles', 'win3', 1, { gems: 20, energy: 2 }),
  d('win3b', 'Gagne 2 combats avec 3 étoiles', 'win3', 2, { gems: 35, energy: 2 }),
  d('win1', 'Gagne un combat', 'wins', 1, { gems: 10 }),
  d('wins', 'Gagne 3 combats', 'wins', 3, { gems: 20, energy: 3 }),
  d('wins5', 'Gagne 5 combats', 'wins', 5, { gems: 35, energy: 3 }),
  d('wins8', 'Gagne 8 combats', 'wins', 8, { gems: 50, energy: 5 }),
  d('levels', 'Fais gagner 3 niveaux à tes cartes', 'levels', 3, { gems: 30 }),
  d('levels6', 'Fais gagner 6 niveaux à tes cartes', 'levels', 6, { gems: 45 }),
  d('levels10', 'Fais gagner 10 niveaux à tes cartes', 'levels', 10, { gems: 60, scrolls: { small: 2 } }),
  d('visit', 'Passe voir ta collection', 'visit', 1, { gems: 10 }),
  d('pulls1', 'Fais une invocation', 'pulls', 1, { gems: 10 }),
  d('pulls5', 'Fais 5 invocations', 'pulls', 5, { gems: 25 }),
  d('pulls10', 'Fais 10 invocations', 'pulls', 10, { gems: 40, tickets: 1 }),
  d('pulls15', 'Fais 15 invocations', 'pulls', 15, { gems: 55, tickets: 1 }),
  d('feat2', 'Obtiens 2 persos de l’univers du jour', 'featuredPull', 2, { gems: 40 }),
  d('merges', 'Fusionne 2 doublons', 'merges', 2, { gems: 25 }),
  d('merges1', 'Fusionne un doublon', 'merges', 1, { gems: 15 }),
  d('merges5', 'Fusionne 5 doublons', 'merges', 5, { gems: 45, scrolls: { small: 2 } }),
  d('damage', 'Inflige 20 000 dégâts', 'damage', 20000, { gems: 30, energy: 2 }),
  d('damage5', 'Inflige 50 000 dégâts', 'damage', 50000, { gems: 45, energy: 3 }),
  d('damage10', 'Inflige 100 000 dégâts', 'damage', 100000, { gems: 60, energy: 4 }),
  d('boss', 'Bats un boss', 'bosses', 1, { gems: 35 }),
  d('boss2', 'Bats 2 boss', 'bosses', 2, { gems: 55, scrolls: { medium: 1 } }),
  d('floors', 'Monte un étage de La Tour de l’Infini', 'floors', 1, { gems: 30, shards: 1 }),
  d('floors2', 'Monte 2 étages de La Tour de l’Infini', 'floors', 2, { gems: 45, shards: 2 }),
  d('floors3', 'Monte 3 étages de La Tour de l’Infini', 'floors', 3, { gems: 60, shards: 3 }),
  d('spend', 'Dépense 60 Éclats', 'gemsSpent', 60, { gems: 20, scrolls: { small: 2 } }),
  d('spend150', 'Dépense 150 Éclats', 'gemsSpent', 150, { gems: 45, scrolls: { small: 3 } }),
]
export const DAILY_COUNT = 8 // quêtes du jour, dont celle de l'univers du jour
export const dailyContracts = (now: Date): Contract[] => [
  d('featured', `Obtiens un perso de ${featuredWorld(now)}`, 'featuredPull', 1, { gems: 30 }),
  ...pickFrom(DAILY_POOL, DAILY_COUNT - 1, `jour|${dayKey(now)}`),
]
export const DAILY_BONUS: Contract = { id: 'd-all', period: 'day', title: 'Termine toutes les quêtes du jour', target: DAILY_COUNT, reward: { gems: 60, tickets: 1 } }
export const WEEKLY_POOL: Contract[] = [
  w('merges', 'Fusionne 10 doublons', 'merges', 10, { gems: 150 }),
  w('merges25', 'Fusionne 25 doublons', 'merges', 25, { gems: 250, scrolls: { large: 1 } }),
  w('spend', 'Dépense 300 Éclats', 'gemsSpent', 300, { gems: 100 }),
  w('spend800', 'Dépense 800 Éclats', 'gemsSpent', 800, { gems: 220, tickets: 2 }),
  w('damage', 'Inflige 200 000 dégâts', 'damage', 200000, { gems: 150, energy: 10 }),
  w('damage500', 'Inflige 500 000 dégâts', 'damage', 500000, { gems: 250, energy: 15 }),
  w('pulls', 'Fais 20 invocations', 'pulls', 20, { gems: 150, tickets: 1 }),
  w('pulls50', 'Fais 50 invocations', 'pulls', 50, { gems: 300, tickets: 3 }),
  w('bosses', 'Bats 3 boss', 'bosses', 3, { gems: 200, scrolls: { large: 1 } }),
  w('bosses8', 'Bats 8 boss', 'bosses', 8, { gems: 320, shards: 8 }),
  w('floors', 'Monte 5 étages de La Tour de l’Infini', 'floors', 5, { gems: 150, shards: 4 }),
  w('floors10', 'Monte 10 étages de La Tour de l’Infini', 'floors', 10, { gems: 260, shards: 8 }),
  w('wins15', 'Gagne 15 combats', 'wins', 15, { gems: 150, energy: 10 }),
  w('wins40', 'Gagne 40 combats', 'wins', 40, { gems: 280, tickets: 2 }),
  w('win3x', 'Gagne 10 combats avec 3 étoiles', 'win3', 10, { gems: 200, scrolls: { medium: 2 } }),
  w('levels', 'Fais gagner 25 niveaux à tes cartes', 'levels', 25, { gems: 180, scrolls: { medium: 2 } }),
  w('levels60', 'Fais gagner 60 niveaux à tes cartes', 'levels', 60, { gems: 300, scrolls: { large: 1 } }),
  w('new10', 'Découvre 10 nouveaux persos', 'newCards', 10, { gems: 200, tickets: 1 }),
  w('new25', 'Découvre 25 nouveaux persos', 'newCards', 25, { gems: 320, tickets: 3 }),
  w('feat', 'Obtiens 6 persos des univers du jour', 'featuredPull', 6, { gems: 180 }),
  w('visit', 'Passe voir ta collection 5 jours', 'visit', 5, { gems: 120 }),
  w('claims', 'Récupère 20 quêtes du jour', 'claims', 20, { gems: 200, tickets: 1 }),
  w('dailies', 'Récupère 5 récompenses du jour', 'dailies', 5, { gems: 180, energy: 10 }),
]
// La quête « tous les contrats du jour 3 fois » est toujours là ; 9 autres sont tirées chaque lundi.
export const WEEKLY_ALL = w('dailyAll', 'Termine toutes les quêtes du jour 3 fois', 'dailyAll', 3, { gems: 200, tickets: 2 })
export const weeklyContracts = (now: Date): Contract[] => [WEEKLY_ALL, ...pickFrom(WEEKLY_POOL, 9, `semaine|${weekKey(now)}`)]
export const STORY: Contract[] = BANNERS.flatMap((b, arc) => [
  ...STAGES.filter((st) => st.arc === arc && !st.boss).map((st): Contract => ({ id: `s-${st.id}`, period: 'story', title: `${b.world} · gagne « ${st.name} »`, target: 1, arc, stage: st.id, reward: { gems: 20 + 5 * arc, scrolls: { small: 1 } } })),
  { id: `s-${arc}-clear`, period: 'story', title: `Termine l'arc ${b.world}`, target: 1, arc, reward: { gems: 100, tickets: 1 } },
  { id: `s-${arc}-perfect`, period: 'story', title: `3★ sur tout l'arc ${b.world}`, target: STAGES_PER_ARC * 3, arc, perfect: true, reward: { gems: 200, scrolls: { large: 1 }, shards: 3 } },
] as Contract[])
// Quêtes de carrière : des paliers à vie, chacun récupéré une seule fois.
const career = (counter: Counter, steps: [number, string, Reward][]): Contract[] =>
  steps.map(([target, title, reward]) => ({ id: `k-${counter}-${target}`, period: 'story', title, target, counter, arc: -1, reward }))
export const CAREER: Contract[] = [
  ...career('pulls', [[50, 'Fais 50 invocations', { gems: 100 }], [100, 'Fais 100 invocations', { gems: 150, tickets: 2 }], [250, 'Fais 250 invocations', { gems: 300, tickets: 3 }], [500, 'Fais 500 invocations', { gems: 500, tickets: 5 }], [1000, 'Fais 1 000 invocations', { gems: 1000, tickets: 10 }]]),
  ...career('wins', [[25, 'Gagne 25 combats', { gems: 100 }], [100, 'Gagne 100 combats', { gems: 200, energy: 10 }], [250, 'Gagne 250 combats', { gems: 350, tickets: 3 }], [500, 'Gagne 500 combats', { gems: 600, tickets: 5 }]]),
  ...career('win3', [[25, 'Gagne 25 combats avec 3 étoiles', { gems: 150 }], [100, 'Gagne 100 combats avec 3 étoiles', { gems: 350, scrolls: { large: 1 } }]]),
  ...career('newCards', [[25, 'Découvre 25 persos', { gems: 100 }], [100, 'Découvre 100 persos', { gems: 250, tickets: 2 }], [250, 'Découvre 250 persos', { gems: 500, tickets: 5 }], [500, 'Découvre 500 persos', { gems: 1000, tickets: 10 }]]),
  ...career('merges', [[25, 'Fusionne 25 doublons', { gems: 120 }], [100, 'Fusionne 100 doublons', { gems: 300, scrolls: { large: 1 } }], [300, 'Fusionne 300 doublons', { gems: 600, scrolls: { large: 2 } }]]),
  ...career('levels', [[50, 'Fais gagner 50 niveaux', { gems: 120 }], [200, 'Fais gagner 200 niveaux', { gems: 300, scrolls: { large: 1 } }], [500, 'Fais gagner 500 niveaux', { gems: 600, shards: 10 }]]),
  ...career('bosses', [[10, 'Bats 10 boss', { gems: 150 }], [50, 'Bats 50 boss', { gems: 400, shards: 10 }], [150, 'Bats 150 boss', { gems: 800, shards: 25 }]]),
  ...career('floors', [[10, 'Monte 10 étages de La Tour de l’Infini', { gems: 150, shards: 5 }], [25, 'Monte 25 étages de La Tour de l’Infini', { gems: 300, shards: 10 }], [50, 'Monte 50 étages de La Tour de l’Infini', { gems: 600, shards: 25 }], [100, 'Monte 100 étages de La Tour de l’Infini', { gems: 1200, shards: 50 }]]),
  ...career('damage', [[1000000, 'Inflige 1 million de dégâts', { gems: 200 }], [10000000, 'Inflige 10 millions de dégâts', { gems: 600, tickets: 5 }]]),
  ...career('gemsSpent', [[1000, 'Dépense 1 000 Éclats', { gems: 150 }], [5000, 'Dépense 5 000 Éclats', { gems: 500, tickets: 3 }]]),
  ...career('dailies', [[7, 'Récupère 7 récompenses du jour', { gems: 150 }], [30, 'Récupère 30 récompenses du jour', { gems: 500, tickets: 3 }], [100, 'Récupère 100 récompenses du jour', { gems: 1500, tickets: 10 }]]),
  ...career('claims', [[50, 'Récupère 50 quêtes', { gems: 200 }], [200, 'Récupère 200 quêtes', { gems: 600, tickets: 3 }], [500, 'Récupère 500 quêtes', { gems: 1500, tickets: 8 }]]),
]

export const progress = (c: Contract, q: Quests, saga: Record<string, number>, now: Date): number => {
  const r = roll(q, now)
  if (c.id === DAILY_BONUS.id) return r.day.claimed.filter((id) => id !== DAILY_BONUS.id).length
  if (c.period === 'story' && c.counter) return r.life[c.counter] ?? 0
  if (c.period === 'story' && c.stage) return (saga[c.stage] ?? 0) > 0 ? 1 : 0
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
export const allContracts = (now: Date) => [...dailyContracts(now), DAILY_BONUS, ...weeklyContracts(now), ...STORY, ...CAREER]
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
  { id: 'c-floors', title: 'Monte 2 étages de La Tour de l’Infini', counter: 'floors', target: 2, xp: 50, gems: 10 },
  { id: 'c-damage', title: 'Inflige 30 000 dégâts', counter: 'damage', target: 30000, xp: 40, gems: 10 },
  { id: 'c-pulls', title: 'Fais 10 invocations', counter: 'pulls', target: 10, xp: 40, gems: 10 },
  { id: 'c-merges', title: 'Fusionne 2 doublons', counter: 'merges', target: 2, xp: 30, gems: 10 },
  { id: 'c-levels', title: 'Fais gagner 5 niveaux à tes cartes', counter: 'levels', target: 5, xp: 40, gems: 10 },
  { id: 'c-boss', title: 'Bats 2 boss', counter: 'bosses', target: 2, xp: 50, gems: 15 },
  { id: 'c-new', title: 'Découvre 2 nouveaux persos', counter: 'newCards', target: 2, xp: 40, gems: 10 },
  { id: 'c-win3', title: 'Gagne 2 combats avec 3 étoiles', counter: 'win3', target: 2, xp: 45, gems: 10 },
  { id: 'c-spend', title: 'Dépense 90 Éclats', counter: 'gemsSpent', target: 90, xp: 35, gems: 15 },
  { id: 'c-wins6', title: 'Gagne 6 combats', counter: 'wins', target: 6, xp: 60, gems: 15 },
  { id: 'c-floor1', title: 'Monte un étage de La Tour de l’Infini', counter: 'floors', target: 1, xp: 30, gems: 10 },
  { id: 'c-damage8', title: 'Inflige 80 000 dégâts', counter: 'damage', target: 80000, xp: 60, gems: 15 },
  { id: 'c-pulls5', title: 'Fais 5 invocations', counter: 'pulls', target: 5, xp: 25, gems: 10 },
  { id: 'c-pulls20', title: 'Fais 20 invocations', counter: 'pulls', target: 20, xp: 70, gems: 20 },
  { id: 'c-merges4', title: 'Fusionne 4 doublons', counter: 'merges', target: 4, xp: 50, gems: 15 },
  { id: 'c-levels10', title: 'Fais gagner 10 niveaux à tes cartes', counter: 'levels', target: 10, xp: 60, gems: 15 },
  { id: 'c-boss1', title: 'Bats un boss', counter: 'bosses', target: 1, xp: 30, gems: 10 },
  { id: 'c-new4', title: 'Découvre 4 nouveaux persos', counter: 'newCards', target: 4, xp: 55, gems: 15 },
  { id: 'c-feat', title: 'Obtiens un perso de l’univers du jour', counter: 'featuredPull', target: 1, xp: 35, gems: 10 },
  { id: 'c-win3a', title: 'Gagne un combat avec 3 étoiles', counter: 'win3', target: 1, xp: 25, gems: 10 },
  { id: 'c-claims', title: 'Récupère 3 quêtes du jour', counter: 'claims', target: 3, xp: 40, gems: 10 },
  { id: 'c-visit', title: 'Passe voir ta collection', counter: 'visit', target: 1, xp: 20, gems: 5 },
  { id: 'c-spend200', title: 'Dépense 200 Éclats', counter: 'gemsSpent', target: 200, xp: 60, gems: 25 },
  { id: 'c-floors4', title: 'Monte 4 étages de La Tour de l’Infini', counter: 'floors', target: 4, xp: 80, gems: 20 },
]
// Les quêtes du pass : 8 tirées pour toute la saison du Chemin du Rift ; elles changent quand la saison se termine.
// Pass beaucoup plus dur : les défis donnent moitié moins d’XP qu’avant.
export const challengesFor = (now: Date): Challenge[] => pickFrom(CHALLENGE_POOL, 8, `saison|${seasonOf(now).number}`).map((c) => ({ ...c, xp: Math.round(c.xp / 2) }))
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
