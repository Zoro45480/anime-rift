import { HEROES, type Hero } from '../data/heroes'
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

const ROLE_SPEED: Record<string, number> = { 'Burst DPS': 24, DPS: 16, 'Contre-attaque': 12, Hybride: 10, Débuffeur: 8, Contrôle: 6, Support: 4, Invocateur: 2, Soigneur: 0, Soigneuse: 0, Tank: -8 }

export type Stats = { hp: number; atk: number; def: number; speed: number }

// Statistiques de base (niveau 1, sans bonus). Les PV et la vitesse découlent de l'attaque, de la défense et du rôle.
export const baseStats = (hero: Hero): Stats => ({
  hp: Math.round((hero.def * 1.3 + hero.atk * 0.4) / 10) * 10,
  atk: hero.atk,
  def: hero.def,
  speed: 90 + (ROLE_SPEED[hero.role] ?? 0) + (hero.no % 9),
})

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

// Techniques : un jeu de quatre capacités par rôle. Elles serviront en combat ; d'ici là elles sont affichées telles quelles.
export type Kit = { attack: [string, string, number]; skill: [string, string, number]; ultimate: [string, string, number]; passive: [string, string] } // [nom, effet, coût en endurance]
const HEAL: Kit = { attack: ['Onde apaisante', 'Frappe une cible (×0,8) et soigne l’allié le plus blessé de 6 % de ses PV.', 10], skill: ['Soin majeur', 'Rend 25 % de ses PV à un allié et retire une altération.', 25], ultimate: ['Renouveau', 'Soigne toute l’équipe de 30 % des PV et accorde Régénération 8 % pendant 2 tours.', 20], passive: ['Vocation', 'Les soins sont 15 % plus forts sur les alliés sous 40 % de PV.'] }
export const KITS: Record<string, Kit> = {
  DPS: { attack: ['Frappe nette', 'Frappe une cible (×1,0). Rend 20 points d’énergie.', 10], skill: ['Enchaînement', 'Deux coups sur la même cible (×0,9 chacun).', 25], ultimate: ['Assaut final', 'Frappe une cible (×3,2). Ignore 20 % de sa défense.', 20], passive: ['Élan', 'Chaque K.O. infligé donne ATK +10 % jusqu’à la fin du combat (3 fois au plus).'] },
  'Burst DPS': { attack: ['Coup vif', 'Frappe une cible (×1,0). Rend 20 points d’énergie.', 10], skill: ['Percée', 'Frappe une cible (×1,9). Coup critique assuré si elle est au-dessus de 80 % de PV.', 25], ultimate: ['Déchaînement', 'Frappe une cible (×4,0), puis subit DEF −15 % pendant 1 tour.', 20], passive: ['Premier sang', 'Le premier coup du combat inflige 30 % de dégâts en plus.'] },
  Tank: { attack: ['Coup de bouclier', 'Frappe une cible (×0,8) et gagne un bouclier de 5 % de ses PV.', 10], skill: ['Provocation', 'Force les ennemis à le cibler pendant 2 tours. DEF +25 %.', 25], ultimate: ['Rempart', 'Bouclier de 20 % de ses PV pour toute l’équipe pendant 2 tours.', 20], passive: ['Inébranlable', 'Réduit de 15 % les dégâts subis tant que ses PV dépassent 50 %.'] },
  Support: { attack: ['Encouragement', 'Frappe une cible (×0,8). Rend 10 points d’énergie à un allié.', 10], skill: ['Ralliement', 'ATK +20 % pour toute l’équipe pendant 2 tours.', 25], ultimate: ['Second souffle', 'Rend 40 points d’énergie à toute l’équipe et avance son prochain tour.', 20], passive: ['Esprit d’équipe', 'Les alliés commencent le combat avec 15 points d’énergie.'] },
  Soigneur: HEAL,
  Soigneuse: HEAL,
  Contrôle: { attack: ['Entrave', 'Frappe une cible (×0,9). 20 % de chance de la ralentir.', 10], skill: ['Immobilisation', 'Frappe une cible (×1,2) et retarde son prochain tour.', 25], ultimate: ['Domaine clos', 'Frappe tous les ennemis (×1,6). 50 % de chance d’étourdir chacun pendant 1 tour.', 20], passive: ['Emprise', 'Les ennemis ralentis subissent 12 % de dégâts en plus.'] },
  Débuffeur: { attack: ['Entaille', 'Frappe une cible (×0,9) et lui inflige DEF −8 % pendant 2 tours.', 10], skill: ['Affaiblissement', 'Frappe une cible (×1,3). ATK −20 % pendant 2 tours.', 25], ultimate: ['Malédiction', 'Tous les ennemis : ATK et DEF −20 % pendant 2 tours, puis dégâts (×1,4).', 20], passive: ['Opportuniste', '+10 % de dégâts par altération présente sur la cible (30 % au plus).'] },
  Invocateur: { attack: ['Ordre', 'Frappe une cible (×0,9). L’invocation attaque aussi (×0,4).', 10], skill: ['Appel', 'Invoque une créature (60 % de son ATK) pendant 3 tours.', 25], ultimate: ['Légion', 'Trois créatures frappent des cibles au hasard (×1,3 chacune).', 20], passive: ['Lien', 'Tant qu’une invocation est en jeu, subit 15 % de dégâts en moins.'] },
  'Contre-attaque': { attack: ['Parade', 'Frappe une cible (×0,9) et se met en garde : riposte au prochain coup reçu.', 10], skill: ['Riposte', 'Pendant 2 tours, renvoie 50 % des dégâts subis.', 25], ultimate: ['Retour de flamme', 'Frappe une cible (×2,0), plus 100 % des dégâts subis depuis son dernier tour.', 20], passive: ['Sang-froid', '25 % de chance d’esquiver un coup au-dessus de 50 % de PV.'] },
  Hybride: { attack: ['Coup adaptable', 'Frappe une cible (×1,0). Rend 20 points d’énergie.', 10], skill: ['Double jeu', 'Frappe une cible (×1,4) et soigne l’allié le plus blessé de 10 % de ses PV.', 25], ultimate: ['Éveil', 'Frappe tous les ennemis (×1,8), puis ATK et DEF +20 % pendant 2 tours.', 20], passive: ['Polyvalence', 'Gagne ATK +5 % par rôle différent présent dans l’équipe.'] },
}
export const kitOf = (hero: Hero): Kit => KITS[hero.role] ?? KITS.DPS
