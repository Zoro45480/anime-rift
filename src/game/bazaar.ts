import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { dayKey } from './contracts'

// Le Bazar des Failles, sans serveur : les marchands et les acheteurs sont joués par le jeu.
// Valeur d'une carte = barème de sa rareté × son niveau × la demande du jour (qui bouge chaque jour, carte par carte).
// La cote affichée vient uniquement des vraies transactions du joueur : aucun prix n'est inventé.

export const BAZAAR_BASE: Record<RarityId, number> = { common: 12, rare: 30, epic: 100, ultra: 450, legend: 1600, rift: 6000 }
export const QUICK_SALE = 0.6 // vente immédiate au Bazar : 60 % de la valeur
export const AUCTION_HOURS = 4
export const STALL_SIZE = 8

const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// Demande du jour pour une carte : entre −20 % et +25 %.
export const demand = (heroId: string, day: string) => 0.8 + seeded(hash(`${heroId}|${day}`))() * 0.45
export const valueOf = (hero: Hero, level: number, day: string) => Math.max(1, Math.round(BAZAAR_BASE[hero.rarity] * (1 + (level - 1) / 60) * demand(hero.id, day)))
export const quickPrice = (hero: Hero, level: number, day: string) => Math.max(1, Math.round(valueOf(hero, level, day) * QUICK_SALE))

// L'étal du jour : 8 cartes, dont 2 tirées de la liste d'envies quand elle n'est pas vide.
export type Stall = { id: string; hero: Hero; price: number; merchant: string; wished: boolean }
const MERCHANTS = ['Vieux Gen', 'Dame Saya', 'Marchand masqué', 'Kuro le brocanteur', 'Les jumeaux Hoshi', 'Oba Tsuru']
const ODDS: [RarityId, number][] = [['common', 0.3], ['rare', 0.32], ['epic', 0.24], ['ultra', 0.1], ['legend', 0.035], ['rift', 0.005]]
export const stallOf = (day: string, wish: string[]): Stall[] => {
  const rng = seeded(hash(`stall|${day}`))
  const picks: { hero: Hero; wished: boolean }[] = []
  const wishes = [...wish].sort((a, b) => hash(a + day) - hash(b + day)).slice(0, 2)
  for (const id of wishes) { const h = HEROES.find((x) => x.id === id); if (h) picks.push({ hero: h, wished: true }) }
  while (picks.length < STALL_SIZE) {
    let r = rng(), rarity: RarityId = 'common'
    for (const [id, p] of ODDS) { if (r < p) { rarity = id; break } r -= p }
    const pool = HEROES.filter((h) => h.rarity === rarity && !picks.some((x) => x.hero.id === h.id))
    picks.push({ hero: pool[Math.floor(rng() * pool.length)], wished: false })
  }
  return picks.map(({ hero, wished }, i) => ({ id: `${day}-${hero.id}`, hero, wished, merchant: MERCHANTS[(hash(hero.id + day) + i) % MERCHANTS.length],
    price: Math.round(valueOf(hero, 1, day) * (1.05 + seeded(hash(`p|${hero.id}|${day}`))() * 0.35)) }))
}

// Enchères : des acheteurs du jeu enchérissent jusqu'à la fin ; le prix final se joue entre 85 % et 140 % de la valeur.
export type Auction = { id: string; heroId: string; level: number; start: number; ends: number; at: number }
export const auctionResult = (a: Auction, hero: Hero) => {
  const rng = seeded(hash(a.id))
  const value = valueOf(hero, a.level, dayKey(new Date(a.at)))
  const top = Math.round(value * (0.85 + rng() * 0.55))
  const bids = 2 + Math.floor(rng() * 6)
  return top >= a.start ? { sold: true, price: top, bids } : { sold: false, price: 0, bids: 0 }
}
// Enchère en cours : la meilleure offre monte au fil du temps vers le prix final.
export const auctionNow = (a: Auction, hero: Hero, now: number) => {
  const r = auctionResult(a, hero)
  const p = Math.min(1, Math.max(0, (now - a.at) / (a.ends - a.at)))
  if (!r.sold) return { best: p > 0.3 ? Math.round(a.start * 0.9) : 0, bids: p > 0.3 ? 1 : 0 }
  return { best: Math.round(a.start + (r.price - a.start) * p ** 1.5), bids: Math.max(p > 0.05 ? 1 : 0, Math.round(r.bids * p)) }
}

// Journal des transactions du joueur : c'est lui qui fait la cote.
export type Trade = { t: number; heroId: string; kind: 'buy' | 'sell' | 'auction'; price: number }
export const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
export const coteOf = (trades: Trade[], heroId: string, now: number) => {
  const mine = trades.filter((t) => t.heroId === heroId)
  const within = (days: number) => mine.filter((t) => now - t.t <= days * 86400000).map((t) => t.price)
  return { d7: median(within(7)), d30: median(within(30)), count30: within(30).length, all: mine }
}

export type Alert = { heroId: string; below: number }
export type BazaarState = { bought: string[]; day: string; auctions: Auction[]; trades: Trade[]; alerts: Alert[]; alerted: string }
export const emptyBazaar = (): BazaarState => ({ bought: [], day: '', auctions: [], trades: [], alerts: [], alerted: '' })
