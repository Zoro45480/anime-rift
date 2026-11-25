import { HEROES, type Hero } from '../data/heroes'
import { PITY_MAX, type Banner } from '../data/banners'
import { isPityRarity, PITY_RARITIES, RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'

export type Rng = () => number
export type PullResult = { hero: Hero; pity: number }

const pityTotal = PITY_RARITIES.reduce((s, id) => s + RARITIES[id].rate, 0)

const rollRarity = (rng: Rng, pity: number): RarityId => {
  // Garantie : à la dernière invocation du compteur, seules SSR, LR et MR peuvent sortir, dans leurs proportions habituelles.
  if (pity + 1 >= PITY_MAX) {
    let x = rng() * pityTotal
    for (const id of PITY_RARITIES) {
      if (x < RARITIES[id].rate) return id
      x -= RARITIES[id].rate
    }
    return PITY_RARITIES[0]
  }
  let x = rng()
  for (const id of RARITY_ORDER) {
    if (x < RARITIES[id].rate) return id
    x -= RARITIES[id].rate
  }
  return 'common'
}

const pick = <T,>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)]

const poolOf = (rarity: RarityId) => HEROES.filter((h) => h.rarity === rarity)

// Une invocation. Fonction pure : mêmes entrées = même résultat (testable, et rejouable côté serveur plus tard).
// Quand une rareté sort : 1 fois sur 2 on choisit parmi les cartes à l'affiche de cette rareté, sinon parmi toutes.
export const pullOne = (banner: Banner, pity: number, rng: Rng): PullResult => {
  const rarity = rollRarity(rng, pity)
  const pool = poolOf(rarity)
  const featured = pool.filter((h) => banner.featured.includes(h.id))
  const hero = featured.length > 0 && (featured.length === pool.length || rng() < 0.5) ? pick(rng, featured) : pick(rng, pool)
  return { hero, pity: isPityRarity(rarity) ? 0 : pity + 1 }
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

// Probabilité exacte d'obtenir CETTE carte en une invocation sur cette bannière (hors garantie).
// C'est le chiffre affiché dans l'index ; il découle directement de la règle de tirage ci-dessus.
export const cardRate = (banner: Banner, hero: Hero): number => {
  const pool = poolOf(hero.rarity)
  const featured = pool.filter((h) => banner.featured.includes(h.id))
  const rate = RARITIES[hero.rarity].rate
  if (featured.length === 0 || featured.length === pool.length) return rate / pool.length
  const isFeatured = banner.featured.includes(hero.id)
  return rate * ((isFeatured ? 0.5 / featured.length : 0) + 0.5 / pool.length)
}
