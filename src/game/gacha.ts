import { HEROES, type Hero } from '../data/heroes'
import { PITY_MAX, type Banner } from '../data/banners'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'

export type Rng = () => number
export type PullResult = { hero: Hero; pity: number }

const rollRarity = (rng: Rng, pity: number): RarityId => {
  // Garantie : à la dernière invocation du compteur, seules LR et MR peuvent sortir (dans leurs proportions).
  if (pity + 1 >= PITY_MAX) {
    const top = RARITIES.rift.rate / (RARITIES.rift.rate + RARITIES.legend.rate)
    return rng() < top ? 'rift' : 'legend'
  }
  let x = rng()
  for (const id of RARITY_ORDER) {
    if (x < RARITIES[id].rate) return id
    x -= RARITIES[id].rate
  }
  return 'rare'
}

const pick = <T,>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)]

// Une invocation. Fonction pure : mêmes entrées = même résultat (testable, et rejouable côté serveur plus tard).
export const pullOne = (banner: Banner, pity: number, rng: Rng): PullResult => {
  const rarity = rollRarity(rng, pity)
  const pool = HEROES.filter((h) => h.rarity === rarity)
  const featured = pool.filter((h) => banner.featured.includes(h.id))
  const hero = featured.length > 0 && (featured.length === pool.length || rng() < 0.5) ? pick(rng, featured) : pick(rng, pool)
  const top = rarity === 'legend' || rarity === 'rift'
  return { hero, pity: top ? 0 : pity + 1 }
}

export const pullMany = (banner: Banner, pity: number, count: number, rng: Rng): { heroes: Hero[]; pity: number } => {
  const heroes: Hero[] = []
  for (let i = 0; i < count; i++) {
    const r = pullOne(banner, pity, rng)
    heroes.push(r.hero)
    pity = r.pity
  }
  return { heroes, pity }
}
