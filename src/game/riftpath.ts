import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import type { Reward } from './contracts'

// Chemin du Rift : une saison de 4 semaines, 40 paliers de 100 XP (piste gratuite).
// L'XP vient des contrats récupérés, de la récompense du jour, des victoires et des invocations.

export const TIER_XP = 250 // coût du 1er palier ; chaque palier suivant coûte 15 XP de plus (le 40e : 835 XP)
export const TIER_STEP = 15
export const tierCost = (tier: number) => TIER_XP + (tier - 1) * TIER_STEP // XP pour passer du palier tier-1 au palier tier
export const tierStart = (tier: number) => tier * TIER_XP + (TIER_STEP * tier * (tier - 1)) / 2 // XP totale pour atteindre ce palier
export const TIERS = 40
const SEASON_DAYS = 28
const EPOCH = new Date(2026, 10, 23).getTime() // lundi 23 novembre 2026, début de la saison 1
const NAMES = [
  ["Saison de l'Hiver Fracturé", '#7fd8ff'], ['Saison des Lames Écarlates', '#ff5d6c'], ['Saison du Ciel Brisé', '#9a7dff'],
  ['Saison des Cerisiers de Cendre', '#ff9ec8'], ["Saison de l'Orage d'Or", '#ffc94d'], ['Saison des Abysses', '#4be3c4'],
] as const

export type PathState = { season: number; xp: number; claimed: number[] }
export const emptyPath = (season: number): PathState => ({ season, xp: 0, claimed: [] })

const DAY = 86400000
export const seasonOf = (now: Date) => {
  const n = Math.max(0, Math.floor((now.getTime() - EPOCH) / (SEASON_DAYS * DAY)))
  const start = new Date(EPOCH); start.setDate(start.getDate() + n * SEASON_DAYS)
  const end = new Date(start); end.setDate(end.getDate() + SEASON_DAYS)
  const [name, hue] = NAMES[n % NAMES.length]
  return { number: n + 1, name, hue, start, end, msLeft: end.getTime() - now.getTime() }
}
// La progression repart à zéro quand une nouvelle saison commence.
export const rollPath = (p: PathState | undefined, now: Date): PathState => {
  const s = seasonOf(now).number
  return p && p.season === s ? p : emptyPath(s)
}

// XP gagnée selon l'action.
export const PATH_XP = { dayContract: 15, dayBonus: 40, weekContract: 60, storyContract: 40, daily: 20, win: 3, pull: 1, floor: 5 }

export const tierOf = (xp: number) => { let t = 0; while (t < TIERS && xp >= tierStart(t + 1)) t++; return t }

// Récompense de chaque palier (1 à 40) : Éclats ou éclairs sur les petits paliers, sceaux tous les 5,
// et tous les 10 : une carte SR ou mieux, dix sceaux (un multi ×10) et un grand parchemin.
export type PathReward = Reward & { card?: boolean }
export const tierReward = (tier: number): PathReward => {
  if (tier % 10 === 0) return { card: true, tickets: 10, scrolls: { large: 1 }, shards: tier / 2 }
  if (tier % 5 === 0) return { tickets: tier % 10 === 5 && tier > 20 ? 6 : 3 }
  if (tier % 3 === 0) return { energy: 5 }
  if (tier % 4 === 0) return { scrolls: { medium: 1 } }
  return { gems: 30 + Math.floor(tier / 5) * 10 }
}
export const TIER_REWARDS = Array.from({ length: TIERS }, (_, i) => tierReward(i + 1))

// La carte « SR ou mieux » : 80 % SR, 15 % SSR, 5 % LR.
export const CARD_ODDS: [RarityId, number][] = [['epic', 0.8], ['ultra', 0.15], ['legend', 0.05]]
export const rollCard = (rng: () => number): Hero => {
  let r = rng(), rarity: RarityId = 'epic'
  for (const [id, p] of CARD_ODDS) { if (r < p) { rarity = id; break } r -= p }
  const pool = HEROES.filter((h) => h.rarity === rarity)
  return pool[Math.floor(rng() * pool.length)]
}

export const claimableTiers = (p: PathState) => Array.from({ length: tierOf(p.xp) }, (_, i) => i + 1).filter((t) => !p.claimed.includes(t))

// Piste premium (affichée, pas encore achetable : elle demande un vrai paiement, donc un serveur).
export const premiumReward = (tier: number): PathReward => {
  if (tier % 10 === 0) return { card: true, tickets: 10, shards: 10 }
  if (tier % 5 === 0) return { tickets: 6 }
  if (tier % 3 === 0) return { energy: 10 }
  return { gems: 60 + Math.floor(tier / 5) * 15 }
}
