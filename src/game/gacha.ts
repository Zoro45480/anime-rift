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

// Les cartes qu'une bannière peut donner : toutes les cartes des 7 univers sont mélangées,
// sauf les MR qui restent dans la bannière de leur propre univers.
export const LOCAL_RARITIES: RarityId[] = ['rift']
export const isLocal = (rarity: RarityId) => LOCAL_RARITIES.includes(rarity)
const POOLS = new Map<string, Hero[]>() // calculé une fois par bannière
export const bannerPool = (banner: Banner): Hero[] => {
  let pool = POOLS.get(banner.id)
  if (!pool) POOLS.set(banner.id, (pool = HEROES.filter((h) => !isLocal(h.rarity) || banner.pool.includes(h.world))))
  return pool
}

const BY_RARITY = new Map<string, Hero[]>()
const poolOf = (banner: Banner, rarity: RarityId) => {
  const key = `${banner.id}/${rarity}`
  let pool = BY_RARITY.get(key)
  if (!pool) BY_RARITY.set(key, (pool = bannerPool(banner).filter((h) => h.rarity === rarity)))
  return pool
}

// Une invocation. Fonction pure : mêmes entrées = même résultat (testable, et rejouable côté serveur plus tard).
// Quand une rareté sort : 1 fois sur 2 on choisit parmi les cartes à l'affiche de cette rareté, sinon parmi toutes.
export const pullOne = (banner: Banner, pity: number, rng: Rng): PullResult => {
  const rarity = rollRarity(rng, pity)
  const pool = poolOf(banner, rarity)
  const featured = pool.filter((h) => banner.featured.includes(h.id))
  const hero = featured.length > 0 && (featured.length === pool.length || rng() < 0.5) ? pick(rng, featured) : pick(rng, pool)
  return { hero, pity: isPityRarity(rarity) ? 0 : pity + 1 }
}

// `forceRift` : grande garantie, la dernière carte du multi devient une MR (une tête d'affiche si possible) s'il n'y en a pas eu.
export const pullMany = (banner: Banner, pity: number, count: number, rng: Rng, forceRift = false): { heroes: Hero[]; pity: number } => {
  const heroes: Hero[] = []
  for (let i = 0; i < count; i++) {
    const r = pullOne(banner, pity, rng)
    heroes.push(r.hero)
    pity = r.pity
  }
  if (forceRift && !heroes.some((h) => h.rarity === 'rift')) {
    const pool = poolOf(banner, 'rift')
    const featured = pool.filter((h) => banner.featured.includes(h.id))
    if (pool.length) { heroes[heroes.length - 1] = pick(rng, featured.length ? featured : pool); pity = 0 }
  }
  return { heroes, pity }
}

// Probabilité exacte d'obtenir CETTE carte en une invocation sur cette bannière (hors garantie).
// C'est le chiffre affiché dans l'index ; il découle directement de la règle de tirage ci-dessus.
export const cardRate = (banner: Banner, hero: Hero): number => {
  if (isLocal(hero.rarity) && !banner.pool.includes(hero.world)) return 0
  const pool = poolOf(banner, hero.rarity)
  const featured = pool.filter((h) => banner.featured.includes(h.id))
  const rate = RARITIES[hero.rarity].rate
  if (featured.length === 0 || featured.length === pool.length) return rate / pool.length
  const isFeatured = banner.featured.includes(hero.id)
  return rate * ((isFeatured ? 0.5 / featured.length : 0) + 0.5 / pool.length)
}

// L'index d'une bannière ne montre que ses têtes de série : les SSR, LR et MR de son univers.
export const INDEX_RARITIES: RarityId[] = ['rift', 'legend', 'ultra']
export const indexCards = (banner: Banner): Hero[] => bannerPool(banner).filter((h) => INDEX_RARITIES.includes(h.rarity) && banner.pool.includes(h.world))
