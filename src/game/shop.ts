import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { weekKey, type Reward } from './contracts'

// Boutique sans argent réel : tout s'achète en âmes. 4 offres par semaine (une fois chacune), un cadeau gratuit chaque jour.
export type Offer = { id: string; name: string; tag: 'Petit prix' | 'Le plus choisi' | 'Gros lot' | 'Rare'; price: number; value: number; reward: Reward; card?: RarityId }
const OFFERS: Offer[] = [
  { id: 'starter', name: 'Sac du débutant', tag: 'Petit prix', price: 150, value: 300, reward: { tickets: 3, scrolls: { small: 5 } } },
  { id: 'scrolls', name: 'Pile de parchemins', tag: 'Petit prix', price: 220, value: 400, reward: { scrolls: { small: 6, medium: 3, large: 1 } } },
  { id: 'multi', name: 'Multi d’invocation', tag: 'Le plus choisi', price: 450, value: 800, reward: { tickets: 10 } },
  { id: 'energy', name: 'Réserve d’éclairs', tag: 'Petit prix', price: 120, value: 200, reward: { energy: 10 } },
  { id: 'shards', name: 'Fiole d’âmes', tag: 'Le plus choisi', price: 400, value: 700, reward: { shards: 25 } },
  { id: 'epic', name: 'Écrin Super rare', tag: 'Gros lot', price: 600, value: 1100, reward: { tickets: 5, scrolls: { medium: 2 } }, card: 'epic' },
  { id: 'ultra', name: 'Coffre Ultra rare', tag: 'Rare', price: 1200, value: 2200, reward: { tickets: 10, shards: 10 }, card: 'ultra' },
  { id: 'mega', name: 'Malle du Rift', tag: 'Gros lot', price: 900, value: 1600, reward: { tickets: 12, scrolls: { large: 2 }, energy: 5 } },
]
const weekNumber = (now: Date) => { const [y, m, d] = weekKey(now).split('-').map(Number); return Math.floor(new Date(y, m - 1, d).getTime() / (7 * 86400000)) }
// Les 4 offres de la semaine (elles changent chaque lundi).
export const weeklyOffers = (now: Date): Offer[] => {
  const n = weekNumber(now)
  return [0, 1, 2, 3].map((i) => OFFERS[(n * 3 + i * 2) % OFFERS.length]).filter((o, i, a) => a.indexOf(o) === i)
}
export const discount = (o: Offer) => Math.round((1 - o.price / o.value) * 100)

// Cadeau du jour, gratuit, qui tourne sur 7 jours.
export const DAILY_GIFTS: Reward[] = [{ gems: 15 }, { scrolls: { small: 2 } }, { energy: 3 }, { gems: 20 }, { tickets: 1 }, { scrolls: { medium: 1 } }, { gems: 40 }]
export const giftOf = (now: Date): Reward => DAILY_GIFTS[now.getDay()]

// Carte garantie d'une offre : la rareté indiquée ou mieux (80 % / 16 % / 4 %).
export const rollAtLeast = (min: RarityId, rng: () => number): Hero => {
  const ladder: RarityId[] = min === 'epic' ? ['epic', 'ultra', 'legend'] : ['ultra', 'legend', 'rift']
  const r = rng()
  const rarity = r < 0.8 ? ladder[0] : r < 0.96 ? ladder[1] : ladder[2]
  const pool = HEROES.filter((h) => h.rarity === rarity)
  return pool[Math.floor(rng() * pool.length)]
}

export type ShopState = { week: string; bought: string[]; gift: string; history: { t: number; name: string; price: number }[] }
export const emptyShop = (): ShopState => ({ week: '', bought: [], gift: '', history: [] })
