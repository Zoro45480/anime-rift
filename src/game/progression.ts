import { HEROES, type Hero, type Role } from '../data/heroes'
import { MOVES } from '../data/moves'
import type { RarityId } from '../data/rarities'

// Progression des cartes : niveaux, statistiques, puissance, collectifs, techniques.
// Fonctions pures, testées dans progression.test.ts.

export const MAX_LEVEL = 99
// XP nécessaire pour passer du niveau `level` au suivant.
export const xpToNext = (level: number) => 60 + 40 * level

export const levelFromXp = (xp: number): { level: number; into: number; need: number } => {
  let level = 1
  let rest = xp
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return level >= MAX_LEVEL ? { level, into: 0, need: 0 } : { level, into: rest, need: xpToNext(level) }
}

// Fusionner un doublon : l'exemplaire en trop est consommé et donne de l'XP à la carte.
export const MERGE_XP: Record<RarityId, number> = { common: 100, rare: 200, epic: 400, ultra: 800, legend: 1500, rift: 3000 }

// Parchemins d'XP : chaque carte invoquée en donne un, d'autant plus gros qu'elle est rare.
export type ScrollId = 'small' | 'medium' | 'large'
export const SCROLLS: Record<ScrollId, { label: string; xp: number }> = {
  small: { label: 'Petit parchemin', xp: 100 },
  medium: { label: 'Parchemin', xp: 500 },
  large: { label: 'Grand parchemin', xp: 2500 },
}
export const SCROLL_IDS: ScrollId[] = ['small', 'medium', 'large']
export const scrollDrop = (rarity: RarityId): ScrollId => (rarity === 'common' || rarity === 'rare' ? 'small' : rarity === 'epic' ? 'medium' : 'large')

const ROLE_SPEED: Record<Role, number> = { DPS: 110, 'DPS / Soigneur': 106, 'DPS / Tank': 104, Soigneur: 100, 'Tank / Soigneur': 94, Tank: 90 }

export type Stats = { hp: number; atk: number; def: number; speed: number }

// Statistiques de base (niveau 1, sans bonus). Dégâts, défense et PV viennent de la fiche du personnage :
// la rareté fixe leur total, le rôle les répartit. La vitesse dépend du rôle.
export const baseStats = (hero: Hero): Stats => ({ hp: hero.hp, atk: hero.atk, def: hero.def, speed: ROLE_SPEED[hero.role] + (hero.no % 9) })

// Collectifs : posséder des cartes liées renforce toutes les cartes du groupe.
export type Collectif = { id: string; name: string; rule: string; members: Hero[]; have: number; bonus: number }

export const collectifs = (hero: Hero, owned: Record<string, number>): Collectif[] => {
  const world = HEROES.filter((h) => h.world === hero.world)
  const role = HEROES.filter((h) => h.role === hero.role)
  const count = (list: Hero[]) => list.filter((h) => owned[h.id]).length
  return [
    { id: 'world', name: `Univers ${hero.world}`, rule: '+2 % par tranche de 5 cartes possédées (12 % au plus)', members: world, have: count(world), bonus: Math.min(12, Math.floor(count(world) / 5) * 2) },
    { id: 'role', name: `Confrérie · ${hero.role}`, rule: '+1 % par tranche de 3 cartes possédées (10 % au plus)', members: role, have: count(role), bonus: Math.min(10, Math.floor(count(role) / 3)) },
  ]
}

export const statsAt = (hero: Hero, level: number, bonusPct: number): Stats => {
  const base = baseStats(hero)
  const k = (1 + 0.02 * (level - 1)) * (1 + bonusPct / 100) // +2 % par niveau, puis bonus des collectifs
  return { hp: Math.round(base.hp * k), atk: Math.round(base.atk * k), def: Math.round(base.def * k), speed: base.speed + Math.floor(level / 10) }
}

export const power = (s: Stats) => Math.round(s.atk * 0.6 + s.def * 0.4 + s.hp * 0.1 + s.speed * 3)

// État complet d'une carte chez le joueur.
export const cardState = (hero: Hero, xp: Record<string, number>, owned: Record<string, number>) => {
  const lv = levelFromXp(xp[hero.id] ?? 0)
  const groups = collectifs(hero, owned)
  const bonus = owned[hero.id] ? groups.reduce((s, g) => s + g.bonus, 0) : 0 // les bonus ne valent que pour une carte possédée
  const stats = statsAt(hero, lv.level, bonus)
  return { ...lv, groups, bonus, stats, power: power(stats) }
}

// Classement de la carte par puissance de base, parmi toutes les cartes du jeu (1 = la plus puissante).
const BASE_POWER = new Map(HEROES.map((h) => [h.id, power(baseStats(h))]))
export const baseRank = (hero: Hero): number => 1 + HEROES.filter((h) => BASE_POWER.get(h.id)! > BASE_POWER.get(hero.id)!).length

// Techniques : chaque personnage porte les noms de ses propres attaques (data/moves.ts) ;
// leurs effets dépendent de son rôle et leurs dégâts, soins et boucliers sont calculés sur ses vraies statistiques.
export type Move = { kind: 'Attaque' | 'Technique' | 'Ultime' | 'Passif'; name: string; text: string; cost?: string }

const n = (x: number) => Math.round(x).toLocaleString('fr-FR')
type Maker = (s: Stats) => [string, string, string, string]
const EFFECTS: Record<Role, Maker> = {
  DPS: (s) => [
    `Inflige ${n(s.atk)} dégâts à un ennemi.`,
    `Inflige ${n(s.atk * 1.8)} dégâts à un ennemi.`,
    `Inflige ${n(s.atk * 3.5)} dégâts à un ennemi et ignore 20 % de sa défense.`,
    'Chaque ennemi mis K.-O. augmente ses dégâts de 10 % (30 % au plus).',
  ],
  Tank: (s) => [
    `Inflige ${n(s.atk * 0.8)} dégâts et gagne un bouclier de ${n(s.hp * 0.05)} PV.`,
    `Force les ennemis à l’attaquer pendant 2 tours et gagne un bouclier de ${n(s.hp * 0.15)} PV.`,
    `Inflige ${n(s.atk * 1.5)} dégâts à tous les ennemis et donne à l’équipe un bouclier de ${n(s.hp * 0.2)} PV.`,
    'Subit 15 % de dégâts en moins tant que ses PV dépassent la moitié.',
  ],
  Soigneur: (s) => [
    `Inflige ${n(s.atk * 0.8)} dégâts et rend ${n(s.hp * 0.06)} PV à l’allié le plus blessé.`,
    `Rend ${n(s.hp * 0.25)} PV à un allié et retire une altération.`,
    `Rend ${n(s.hp * 0.3)} PV à toute l’équipe.`,
    'Ses soins sont 15 % plus forts sur les alliés sous 40 % de PV.',
  ],
  'DPS / Tank': (s) => [
    `Inflige ${n(s.atk)} dégâts et gagne un bouclier de ${n(s.hp * 0.04)} PV.`,
    `Inflige ${n(s.atk * 1.6)} dégâts et force les ennemis à l’attaquer pendant 1 tour.`,
    `Inflige ${n(s.atk * 3)} dégâts à tous les ennemis et gagne un bouclier de ${n(s.hp * 0.15)} PV.`,
    'Double rôle : +10 % de dégâts infligés et 10 % de dégâts subis en moins.',
  ],
  'DPS / Soigneur': (s) => [
    `Inflige ${n(s.atk)} dégâts et rend ${n(s.hp * 0.04)} PV à l’allié le plus blessé.`,
    `Inflige ${n(s.atk * 1.6)} dégâts et rend ${n(s.hp * 0.15)} PV à l’allié le plus blessé.`,
    `Inflige ${n(s.atk * 3)} dégâts à un ennemi et rend ${n(s.hp * 0.15)} PV à toute l’équipe.`,
    'Double rôle : 20 % des dégâts qu’il inflige lui rendent des PV.',
  ],
  'Tank / Soigneur': (s) => [
    `Inflige ${n(s.atk * 0.8)} dégâts et gagne un bouclier de ${n(s.hp * 0.05)} PV.`,
    `Force les ennemis à l’attaquer pendant 2 tours et se rend ${n(s.hp * 0.15)} PV.`,
    `Donne à l’équipe un bouclier de ${n(s.hp * 0.2)} PV et lui rend ${n(s.hp * 0.15)} PV.`,
    'Double rôle : ses alliés subissent 8 % de dégâts en moins.',
  ],
}
const KINDS = ['Attaque', 'Technique', 'Ultime', 'Passif'] as const
const COSTS = ['Endurance 10', 'Endurance 25', 'Énergie pleine', undefined]

export const kitOf = (hero: Hero, stats: Stats = baseStats(hero)): Move[] => {
  const texts = EFFECTS[hero.role](stats)
  return KINDS.map((kind, i) => ({ kind, name: MOVES[hero.id][i], text: texts[i], cost: COSTS[i] }))
}
