import { BANNERS } from '../data/banners'
import { QUEST_TITLES } from './cosmetics'
import type { ScrollId } from './progression'
import { STAGES, STAGES_PER_ARC } from './saga'
import { seasonOf } from './riftpath'

// Contrats : récompense quotidienne, contrats du jour (6 + bonus), de la semaine (lundi), d'histoire (une seule fois),
// et compteurs à vie pour le Parcours. Fonctions pures : la date est toujours passée en argument.

export type Reward = { gems?: number; energy?: number; tickets?: number; shards?: number; scrolls?: Partial<Record<ScrollId, number>>; title?: string } // title : identifiant d'un titre de quête
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
  // ── encore plus de quêtes du jour, avec un petit air d'aventure
  d('wins2', 'Échauffement : gagne 2 combats', 'wins', 2, { gems: 15 }),
  d('wins4', 'Entraînement ninja : gagne 4 combats', 'wins', 4, { gems: 25, energy: 2 }),
  d('wins6', 'Série de victoires : gagne 6 combats', 'wins', 6, { gems: 40, energy: 3 }),
  d('wins10', 'Journée de guerre : gagne 10 combats', 'wins', 10, { gems: 65, tickets: 1 }),
  d('wins12', 'Rien ne t’arrête : gagne 12 combats', 'wins', 12, { gems: 80, tickets: 1 }),
  d('win3c', 'Sans une égratignure : 3 combats avec 3 étoiles', 'win3', 3, { gems: 45, energy: 3 }),
  d('win3d', 'Perfection : 5 combats avec 3 étoiles', 'win3', 5, { gems: 70, scrolls: { medium: 1 } }),
  d('pulls2', 'Petite visite à la faille : 2 invocations', 'pulls', 2, { gems: 12 }),
  d('pulls3', 'Tente ta chance : 3 invocations', 'pulls', 3, { gems: 18 }),
  d('pulls8', 'Appel des âmes : 8 invocations', 'pulls', 8, { gems: 35 }),
  d('pulls20', 'Pluie d’âmes : 20 invocations', 'pulls', 20, { gems: 75, tickets: 2 }),
  d('pulls30', 'Tempête dans la faille : 30 invocations', 'pulls', 30, { gems: 100, tickets: 2 }),
  d('new2b', 'Nouvelles têtes : découvre 2 persos', 'newCards', 2, { gems: 30 }),
  d('new5', 'Grand recrutement : découvre 5 persos', 'newCards', 5, { gems: 60, tickets: 1 }),
  d('new8', 'Album qui grossit : découvre 8 persos', 'newCards', 8, { gems: 85, tickets: 1 }),
  d('feat1', 'Ami de l’univers du jour : 1 perso de cet univers', 'featuredPull', 1, { gems: 20 }),
  d('feat3', 'Fan de l’univers du jour : 3 persos de cet univers', 'featuredPull', 3, { gems: 55 }),
  d('levels2', 'Petit progrès : fais gagner 2 niveaux à tes cartes', 'levels', 2, { gems: 15 }),
  d('levels4', 'Séance d’entraînement : 4 niveaux gagnés', 'levels', 4, { gems: 30 }),
  d('levels15', 'Montée en puissance : 15 niveaux gagnés', 'levels', 15, { gems: 75, scrolls: { medium: 1 } }),
  d('levels20', 'Éveil intérieur : 20 niveaux gagnés', 'levels', 20, { gems: 90, scrolls: { medium: 2 } }),
  d('merges3', 'Ménage de printemps : fusionne 3 doublons', 'merges', 3, { gems: 30 }),
  d('merges8', 'Grande fusion : fusionne 8 doublons', 'merges', 8, { gems: 65, scrolls: { medium: 1 } }),
  d('damage3', 'Coups de poing : inflige 30 000 dégâts', 'damage', 30000, { gems: 35, energy: 2 }),
  d('damage15', 'Attaque spéciale : inflige 150 000 dégâts', 'damage', 150000, { gems: 75, energy: 5 }),
  d('damage25', 'Coup ultime : inflige 250 000 dégâts', 'damage', 250000, { gems: 95, tickets: 1 }),
  d('boss3', 'Chasseur de boss : bats 3 boss', 'bosses', 3, { gems: 75, scrolls: { medium: 1 } }),
  d('boss4', 'Tueur de géants : bats 4 boss', 'bosses', 4, { gems: 95, tickets: 1 }),
  d('floors4', 'Ascension : monte 4 étages de la Tour', 'floors', 4, { gems: 75, shards: 4 }),
  d('floors5', 'Sommet en vue : monte 5 étages de la Tour', 'floors', 5, { gems: 90, shards: 5 }),
  d('spend90', 'Marché du jour : dépense 90 Éclats', 'gemsSpent', 90, { gems: 30, scrolls: { small: 2 } }),
  d('spend300', 'Gros acheteur : dépense 300 Éclats', 'gemsSpent', 300, { gems: 80, tickets: 1 }),
  d('claims3', 'Bonne organisation : récupère 3 quêtes du jour', 'claims', 3, { gems: 20 }),
  d('claims5', 'Chasseur de quêtes : récupère 5 quêtes du jour', 'claims', 5, { gems: 35, energy: 2 }),
  d('dailies1', 'Fidèle au poste : récupère la récompense du jour', 'dailies', 1, { gems: 15 }),
]
export const DAILY_COUNT = 10 // quêtes du jour, dont celle de l'univers du jour
// Titres de quête offerts : un nouveau tiré chaque jour et chaque semaine (même titre pour tout le monde ce jour-là).
const titleOf = (rarity: string, seed: string) => pickFrom(QUEST_TITLES.filter((t) => t.rarity === rarity), 1, seed)[0]?.id
export const dailyTitle = (now: Date) => titleOf(['common', 'rare'][parse(dayKey(now)).getDate() % 2], `titre-jour|${dayKey(now)}`)
export const weeklyTitles = (now: Date) => ({ rare: titleOf('rare', `titre-sem-r|${weekKey(now)}`), epic: titleOf('epic', `titre-sem-e|${weekKey(now)}`), top: titleOf(Number(weekKey(now).slice(8)) % 4 === 0 ? 'mythic' : 'legend', `titre-sem|${weekKey(now)}`) })
const withTitle = (c: Contract, title: string | undefined): Contract => (title ? { ...c, reward: { ...c.reward, title } } : c)

export const dailyContracts = (now: Date): Contract[] => {
  const picked = pickFrom(DAILY_POOL, DAILY_COUNT - 1, `jour|${dayKey(now)}`)
  // la quête la plus dure du jour offre en plus le titre du jour
  const hardest = picked.reduce((b, c, i) => ((c.reward.gems ?? 0) > (picked[b].reward.gems ?? 0) ? i : b), 0)
  return [d('featured', `Obtiens un perso de ${featuredWorld(now)}`, 'featuredPull', 1, { gems: 30 }), ...picked.map((c, i) => (i === hardest ? withTitle(c, dailyTitle(now)) : c))]
}
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
  w('dailies7', 'Assidu : récupère 7 récompenses du jour', 'dailies', 7, { gems: 260, tickets: 2 }),
  w('wins25', 'Campagne : gagne 25 combats', 'wins', 25, { gems: 210, energy: 12 }),
  w('wins60', 'Seigneur de guerre : gagne 60 combats', 'wins', 60, { gems: 380, tickets: 3 }),
  w('win3y', 'Maître tacticien : 20 combats avec 3 étoiles', 'win3', 20, { gems: 300, scrolls: { large: 1 } }),
  w('win3z', 'Sans faute : 35 combats avec 3 étoiles', 'win3', 35, { gems: 400, scrolls: { large: 2 } }),
  w('pulls30', 'Habitué de la faille : 30 invocations', 'pulls', 30, { gems: 200, tickets: 2 }),
  w('pulls80', 'Fou du gacha : 80 invocations', 'pulls', 80, { gems: 420, tickets: 4 }),
  w('pulls120', 'Tempête d’âmes : 120 invocations', 'pulls', 120, { gems: 550, tickets: 5 }),
  w('new15', 'Recruteur : découvre 15 persos', 'newCards', 15, { gems: 250, tickets: 2 }),
  w('new40', 'Encyclopédie vivante : découvre 40 persos', 'newCards', 40, { gems: 450, tickets: 4 }),
  w('feat10', 'Tour des univers : 10 persos des univers du jour', 'featuredPull', 10, { gems: 260, tickets: 1 }),
  w('levels40', 'Programme d’entraînement : 40 niveaux gagnés', 'levels', 40, { gems: 240, scrolls: { medium: 3 } }),
  w('levels100', 'Au-delà des limites : 100 niveaux gagnés', 'levels', 100, { gems: 420, scrolls: { large: 2 } }),
  w('merges15', 'Atelier de fusion : fusionne 15 doublons', 'merges', 15, { gems: 190, scrolls: { medium: 2 } }),
  w('merges40', 'Alchimiste : fusionne 40 doublons', 'merges', 40, { gems: 360, scrolls: { large: 2 } }),
  w('damage1m', 'Destructeur : inflige 1 million de dégâts', 'damage', 1000000, { gems: 380, energy: 20 }),
  w('damage300', 'Puissance brute : inflige 300 000 dégâts', 'damage', 300000, { gems: 190, energy: 12 }),
  w('bosses5', 'Chasse aux géants : bats 5 boss', 'bosses', 5, { gems: 250, shards: 5 }),
  w('bosses12', 'Fléau des boss : bats 12 boss', 'bosses', 12, { gems: 420, shards: 12 }),
  w('floors7', 'Grimpeur : monte 7 étages de la Tour', 'floors', 7, { gems: 200, shards: 6 }),
  w('floors15', 'Conquérant de la Tour : monte 15 étages', 'floors', 15, { gems: 380, shards: 12 }),
  w('spend500', 'Investisseur : dépense 500 Éclats', 'gemsSpent', 500, { gems: 160, tickets: 1 }),
  w('spend1500', 'Grand mécène : dépense 1 500 Éclats', 'gemsSpent', 1500, { gems: 380, tickets: 3 }),
  w('claims35', 'Machine à quêtes : récupère 35 quêtes du jour', 'claims', 35, { gems: 300, tickets: 2 }),
  w('visit7', 'Tous les jours au Nexus : passe 7 jours', 'visit', 7, { gems: 200, energy: 12 }),
  w('dailyAll5', 'Semaine parfaite : termine toutes les quêtes du jour 5 fois', 'dailyAll', 5, { gems: 400, tickets: 3 }),
]
// La quête « tous les contrats du jour 3 fois » est toujours là ; 9 autres sont tirées chaque lundi.
export const WEEKLY_ALL = w('dailyAll', 'Termine toutes les quêtes du jour 3 fois', 'dailyAll', 3, { gems: 200, tickets: 2 })
export const WEEKLY_COUNT = 12 // quêtes de la semaine tirées chaque lundi, en plus de WEEKLY_ALL
// Chaque semaine : le grand titre (légendaire, parfois mythique) avec WEEKLY_ALL, un titre épique et un rare sur deux autres quêtes.
export const weeklyContracts = (now: Date): Contract[] => {
  const t = weeklyTitles(now)
  const picked = pickFrom(WEEKLY_POOL.filter((c) => c.id !== 'w-dailyAll5'), WEEKLY_COUNT - 1, `semaine|${weekKey(now)}`)
  const order = picked.map((c, i) => [c.reward.gems ?? 0, i]).sort((a, b) => b[0] - a[0])
  const epicAt = order[0][1], rareAt = order[1][1]
  return [withTitle(WEEKLY_ALL, t.top), w('dailyAll5', 'Semaine parfaite : termine toutes les quêtes du jour 5 fois', 'dailyAll', 5, { gems: 400, tickets: 3 }),
    ...picked.map((c, i) => (i === epicAt ? withTitle(c, t.epic) : i === rareAt ? withTitle(c, t.rare) : c))]
}
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
  ...career('claims', [[50, 'Récupère 50 quêtes', { gems: 200 }], [200, 'Récupère 200 quêtes', { gems: 600, tickets: 3 }], [500, 'Récupère 500 quêtes', { gems: 1500, tickets: 8 }], [1000, 'Récupère 1 000 quêtes', { gems: 2500, tickets: 12 }], [2500, 'Récupère 2 500 quêtes', { gems: 5000, tickets: 20 }]]),
  ...career('pulls', [[2000, 'Fais 2 000 invocations', { gems: 1800, tickets: 15 }], [5000, 'Fais 5 000 invocations', { gems: 4000, tickets: 30 }]]),
  ...career('wins', [[1000, 'Gagne 1 000 combats', { gems: 1000, tickets: 8 }], [2500, 'Gagne 2 500 combats', { gems: 2200, tickets: 15 }]]),
  ...career('win3', [[250, 'Gagne 250 combats avec 3 étoiles', { gems: 700, scrolls: { large: 2 } }], [500, 'Gagne 500 combats avec 3 étoiles', { gems: 1200, scrolls: { large: 3 } }]]),
  ...career('featuredPull', [[10, 'Obtiens 10 persos des univers du jour', { gems: 150 }], [50, 'Obtiens 50 persos des univers du jour', { gems: 400, tickets: 2 }], [200, 'Obtiens 200 persos des univers du jour', { gems: 1000, tickets: 6 }]]),
  ...career('merges', [[1000, 'Fusionne 1 000 doublons', { gems: 1500, scrolls: { large: 4 } }]]),
  ...career('levels', [[1000, 'Fais gagner 1 000 niveaux', { gems: 1200, shards: 25 }], [2500, 'Fais gagner 2 500 niveaux', { gems: 2500, shards: 50 }]]),
  ...career('bosses', [[300, 'Bats 300 boss', { gems: 1500, shards: 40 }]]),
  ...career('damage', [[50000000, 'Inflige 50 millions de dégâts', { gems: 1500, tickets: 10 }], [200000000, 'Inflige 200 millions de dégâts', { gems: 4000, tickets: 25 }]]),
  ...career('gemsSpent', [[20000, 'Dépense 20 000 Éclats', { gems: 1500, tickets: 8 }]]),
  ...career('dailyAll', [[10, 'Termine toutes les quêtes du jour 10 fois', { gems: 400, tickets: 2 }], [50, 'Termine toutes les quêtes du jour 50 fois', { gems: 1500, tickets: 8 }], [150, 'Termine toutes les quêtes du jour 150 fois', { gems: 4000, tickets: 20 }]]),
  ...career('dailies', [[365, 'Récupère 365 récompenses du jour', { gems: 5000, tickets: 30 }]]),
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
export const CHALLENGE_COUNT = 12 // quêtes du pass tirées pour toute la saison
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
  { id: 'c-wins2', title: 'Petit combat : gagne 2 combats', counter: 'wins', target: 2, xp: 30, gems: 10 },
  { id: 'c-wins4', title: 'Guerrier du jour : gagne 4 combats', counter: 'wins', target: 4, xp: 45, gems: 10 },
  { id: 'c-wins10', title: 'Marathon : gagne 10 combats', counter: 'wins', target: 10, xp: 90, gems: 25 },
  { id: 'c-win3b', title: 'Propre et net : 3 combats avec 3 étoiles', counter: 'win3', target: 3, xp: 60, gems: 15 },
  { id: 'c-win3c', title: 'Parfait : 5 combats avec 3 étoiles', counter: 'win3', target: 5, xp: 85, gems: 20 },
  { id: 'c-pulls3', title: 'Coup d’œil à la faille : 3 invocations', counter: 'pulls', target: 3, xp: 20, gems: 5 },
  { id: 'c-pulls15', title: 'Pluie d’âmes : 15 invocations', counter: 'pulls', target: 15, xp: 55, gems: 15 },
  { id: 'c-pulls30', title: 'Déluge d’âmes : 30 invocations', counter: 'pulls', target: 30, xp: 95, gems: 25 },
  { id: 'c-new1', title: 'Une nouvelle tête : découvre un perso', counter: 'newCards', target: 1, xp: 25, gems: 5 },
  { id: 'c-new6', title: 'Grand album : découvre 6 persos', counter: 'newCards', target: 6, xp: 75, gems: 20 },
  { id: 'c-feat2', title: 'Fan du jour : 2 persos de l’univers du jour', counter: 'featuredPull', target: 2, xp: 50, gems: 15 },
  { id: 'c-levels3', title: 'Petit entraînement : 3 niveaux gagnés', counter: 'levels', target: 3, xp: 25, gems: 5 },
  { id: 'c-levels20', title: 'Grand entraînement : 20 niveaux gagnés', counter: 'levels', target: 20, xp: 90, gems: 25 },
  { id: 'c-merges1', title: 'Une fusion : fusionne un doublon', counter: 'merges', target: 1, xp: 20, gems: 5 },
  { id: 'c-merges8', title: 'Atelier : fusionne 8 doublons', counter: 'merges', target: 8, xp: 80, gems: 20 },
  { id: 'c-damage5', title: 'Échauffement : inflige 50 000 dégâts', counter: 'damage', target: 50000, xp: 45, gems: 10 },
  { id: 'c-damage15', title: 'Frappe lourde : inflige 150 000 dégâts', counter: 'damage', target: 150000, xp: 85, gems: 20 },
  { id: 'c-boss3', title: 'Chasse aux boss : bats 3 boss', counter: 'bosses', target: 3, xp: 70, gems: 20 },
  { id: 'c-floors3', title: 'Escalier : monte 3 étages de la Tour', counter: 'floors', target: 3, xp: 65, gems: 15 },
  { id: 'c-spend50', title: 'Petite dépense : 50 Éclats', counter: 'gemsSpent', target: 50, xp: 20, gems: 10 },
  { id: 'c-spend400', title: 'Grosse dépense : 400 Éclats', counter: 'gemsSpent', target: 400, xp: 90, gems: 40 },
  { id: 'c-claims5', title: 'Organisé : récupère 5 quêtes du jour', counter: 'claims', target: 5, xp: 55, gems: 15 },
  { id: 'c-dailies', title: 'Fidèle : récupère la récompense du jour', counter: 'dailies', target: 1, xp: 25, gems: 5 },
]
// Les quêtes du pass : 8 tirées pour toute la saison du Chemin du Rift ; elles changent quand la saison se termine.
// Pass beaucoup plus dur : les défis donnent moitié moins d’XP qu’avant.
export const challengesFor = (now: Date): Challenge[] => pickFrom(CHALLENGE_POOL, CHALLENGE_COUNT, `saison|${seasonOf(now).number}`).map((c) => ({ ...c, xp: Math.round(c.xp / 2) }))
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
