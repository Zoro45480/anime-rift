import { BANNERS } from '../data/banners'
import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { makeUnit, type Unit } from './battle'
import { baseStats, type ScrollId } from './progression'

// La Saga : un arc par univers, cinq combats par arc. Les adversaires sont les personnages de l'univers,
// ramenés à la force du combat (un boss MR du premier arc reste battable par des cartes débutantes).

export const TEAM_SIZE = 3
export const STAGES_PER_ARC = 5
const BUDGET: Record<RarityId, number> = { common: 600, rare: 840, epic: 1140, ultra: 1500, legend: 1920, rift: 2400 } // force de base d'une rareté
const LINEUP: RarityId[][] = [['common', 'common', 'common'], ['rare', 'rare', 'rare'], ['epic', 'epic', 'epic'], ['ultra', 'ultra', 'ultra'], ['rift', 'legend', 'legend']]
const STAGE_NAMES = ['Premiers pas', 'L’entraînement', 'La montée', 'Les gardiens', 'Le boss']

export type Stage = {
  id: string; arc: number; index: number; world: string; name: string; boss: boolean
  foes: Hero[]; force: number // force visée des adversaires
  accountXp: number; cardXp: number
  drops: Record<ScrollId, number> // chance d'obtenir chaque parchemin à chaque victoire
}

const pick = (world: string, rarities: RarityId[]): Hero[] => {
  const used = new Set<string>()
  return rarities.map((r) => {
    const h = HEROES.find((x) => x.world === world && x.rarity === r && !used.has(x.id))!
    used.add(h.id)
    return h
  })
}

export const STAGES: Stage[] = BANNERS.flatMap((banner, arc) =>
  Array.from({ length: STAGES_PER_ARC }, (_, index): Stage => {
    const boss = index === STAGES_PER_ARC - 1
    return {
      id: `${arc}-${index}`, arc, index, world: banner.world, name: STAGE_NAMES[index], boss,
      foes: pick(banner.world, LINEUP[index]),
      force: Math.round(300 * 1.4 ** arc * (1 + 0.16 * index)),
      accountXp: 40 + 25 * arc + 10 * index + (boss ? 40 : 0),
      cardXp: 40 + 30 * arc + 12 * index + (boss ? 60 : 0),
      // taux de drop : le petit tombe souvent, le moyen parfois, le grand rarement ; les boss et les arcs avancés donnent mieux
      drops: {
        small: Math.min(0.9, 0.5 + 0.05 * index),
        medium: Math.min(0.5, 0.08 + 0.03 * index + 0.03 * arc + (boss ? 0.1 : 0)),
        large: Math.min(0.25, 0.01 + 0.01 * arc + (boss ? 0.05 : 0)),
      },
    }
  }))
export const stageById = (id: string) => STAGES.find((s) => s.id === id)

// Un combat s'ouvre quand le précédent a au moins une étoile.
export const isUnlocked = (stage: Stage, stars: Record<string, number>) => {
  const i = STAGES.indexOf(stage)
  return i === 0 || (stars[STAGES[i - 1].id] ?? 0) > 0
}

export const foeUnits = (stage: Stage): Unit[] => stage.foes.map((h, i) => {
  const base = baseStats(h)
  const k = stage.force / BUDGET[h.rarity]
  const bossUp = stage.boss && i === 0 ? 1.5 : 1 // le boss a plus de vie
  return makeUnit(h, { hp: Math.round(base.hp * k * bossUp), atk: Math.round(base.atk * k), def: Math.round(base.def * k), speed: base.speed }, 1, i)
})

// Étoiles : 3 sans aucun allié K.-O., 2 avec un seul, 1 sinon.
export const starsFor = (fallen: number) => (fallen === 0 ? 3 : fallen === 1 ? 2 : 1)
export const SOULS_PER_STAR = 10 // Éclats gagnées pour chaque nouvelle étoile

export const rollDrops = (stage: Stage, rng: () => number): ScrollId[] =>
  (Object.keys(stage.drops) as ScrollId[]).filter((id) => rng() < stage.drops[id])
