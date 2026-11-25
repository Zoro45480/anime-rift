import { HEROES, type Hero, type Role } from '../data/heroes'
import { MOVES } from '../data/moves'
import { GROUPS, type GroupStat } from '../data/collectifs'
import type { RarityId } from '../data/rarities'

// Progression des cartes : niveaux, statistiques, puissance, collectifs, techniques.
// Fonctions pures, testées dans progression.test.ts.

// Une carte s'arrête au niveau 50. Une fois « libérée » (voir Libération plus bas), elle peut monter jusqu'à 100.
export const LEVEL_CAP = 50
export const MAX_LEVEL = 100
// XP nécessaire pour passer du niveau `level` au suivant.
export const xpToNext = (level: number) => 60 + 40 * level

export const levelFromXp = (xp: number, cap = MAX_LEVEL): { level: number; into: number; need: number } => {
  let level = 1
  let rest = xp
  while (level < cap && rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return level >= cap ? { level, into: 0, need: 0 } : { level, into: rest, need: xpToNext(level) }
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

// Collectifs. Deux sortes :
// – l'univers : +2 % à toutes les statistiques par tranche de 5 cartes possédées de l'univers (12 % au plus) ;
// – les groupes de l'univers (data/collectifs.ts) : actifs dès que le joueur possède la carte et au moins un autre membre ;
//   chacun renforce une statistique. Six groupes au plus comptent pour une carte : les plus forts.
export const MAX_GROUPS = 6
export const STAT_LABEL: Record<GroupStat | 'all', string> = { all: 'toutes stats', atk: 'ATK', def: 'DEF', hp: 'PV', speed: 'VIT' }
export type Collectif = { id: string; name: string; rule: string; members: Hero[]; have: number; bonus: number; stat: GroupStat | 'all'; pct: number; active: boolean; counted: boolean }

const BY_ID = new Map(HEROES.map((h) => [h.id, h]))
export const collectifs = (hero: Hero, owned: Record<string, number>, team: string[] = []): Collectif[] => {
  const world = HEROES.filter((h) => h.world === hero.world)
  const count = (list: Hero[]) => list.filter((h) => owned[h.id]).length
  const worldBonus = Math.min(12, Math.floor(count(world) / 5) * 2)
  const groups: Collectif[] = GROUPS.filter((g) => g.members.includes(hero.id)).map((g) => {
    const members = g.members.map((id) => BY_ID.get(id)!)
    const have = members.filter((m) => team.includes(m.id)).length // membres présents dans l'équipe
    const active = team.includes(hero.id) && have >= 2
    return { id: g.name, name: g.name, rule: 'Actif avec au moins 2 membres dans l’équipe, dont cette carte', members, have, stat: g.stat, pct: g.pct, active, counted: false, bonus: 0 }
  })
  for (const g of [...groups].filter((x) => x.active).sort((x, y) => y.pct - x.pct).slice(0, MAX_GROUPS)) { g.counted = true; g.bonus = g.pct }
  return [
    { id: 'world', name: `Univers ${hero.world}`, rule: '+2 % par tranche de 5 cartes possédées (12 % au plus)', members: world, have: count(world), stat: 'all', pct: 12, active: worldBonus > 0, counted: worldBonus > 0, bonus: worldBonus },
    ...groups,
  ]
}

export const statsAt = (hero: Hero, level: number, bonusPct: number): Stats => {
  const base = baseStats(hero)
  const k = (1 + 0.02 * (level - 1)) * (1 + bonusPct / 100) // +2 % par niveau, puis bonus des collectifs
  return { hp: Math.round(base.hp * k), atk: Math.round(base.atk * k), def: Math.round(base.def * k), speed: base.speed + Math.floor(level / 10) }
}

export const power = (s: Stats) => Math.round(s.atk * 0.6 + s.def * 0.4 + s.hp * 0.1 + s.speed * 3)

// État complet d'une carte chez le joueur.
export const cardState = (hero: Hero, xp: Record<string, number>, owned: Record<string, number>, rebirths = 0, awakened: string[] = [], team: string[] = []) => {
  const freed = awakened.includes(hero.id)
  const cap = freed ? MAX_LEVEL : LEVEL_CAP
  const lv = levelFromXp(xp[hero.id] ?? 0, cap)
  const groups = collectifs(hero, owned, team)
  // les bonus (collectifs + Renaissances + Libération) ne valent que pour une carte possédée
  const bonus = owned[hero.id] ? groups[0].bonus + rebirths * REBIRTH_STAT + (freed ? AWAKEN_STAT : 0) : 0
  const extra: Record<GroupStat, number> = { atk: 0, def: 0, hp: 0, speed: 0 } // bonus des groupes, par statistique
  for (const g of groups) if (g.counted && g.stat !== 'all') extra[g.stat] += g.bonus
  const flat = statsAt(hero, lv.level, bonus)
  const up = (value: number, pct: number) => Math.round(value * (1 + pct / 100))
  const stats: Stats = { hp: up(flat.hp, extra.hp), atk: up(flat.atk, extra.atk), def: up(flat.def, extra.def), speed: up(flat.speed, extra.speed) }
  return { ...lv, cap, freed, groups, bonus, extra, stats, power: power(stats) }
}

// ───── Énergie ─────
// Chaque combat coûtera un éclair. L'énergie remonte toute seule : un éclair toutes les 6 minutes, jusqu'au maximum.
export const ENERGY_MAX = 10
export const ENERGY_REGEN_MS = 6 * 60 * 1000
export const ENERGY_REFILL = 5 // éclairs rendus par une recharge
export const ENERGY_REFILL_COST = 20 // âmes
export const ENERGY_OVER = ENERGY_MAX * 2 // on peut dépasser le maximum en rechargeant, jusqu'à cette limite
export const energyNow = (energy: number, at: number, now: number) =>
  energy >= ENERGY_MAX ? energy : Math.min(ENERGY_MAX, energy + Math.floor(Math.max(0, now - at) / ENERGY_REGEN_MS))

// ───── Compte du joueur et Renaissance ─────
// Le compte gagne de l'XP à chaque carte invoquée et à chaque amélioration de carte. Au niveau 100, le joueur peut
// « renaître » : il repart du niveau 1 avec 5 cartes de son choix et garde pour toujours les bonus ci-dessous.
export const REBIRTH_LEVEL = 100
export const REBIRTH_KEEP = 5 // cartes conservées
export const REBIRTH_STAT = 6 // % de PV, d'attaque et de défense en plus sur toutes les cartes, par Renaissance
export const REBIRTH_XP = 50 // % d'XP en plus des parchemins et des fusions, par Renaissance
export const REBIRTH_SEALS = 10 // sceaux d'invocation offerts
export const REBIRTH_REFUND = 0.25 // part des âmes dépensées qui est rendue
export const ACCOUNT_XP: Record<RarityId, number> = { common: 20, rare: 30, epic: 60, ultra: 150, legend: 400, rift: 2000 }
// XP de compte pour passer au niveau suivant : deux fois plus à chaque Renaissance.
export const accountNeed = (level: number, rebirths: number) => (100 + 20 * level) * 2 ** rebirths
export const accountLevel = (xp: number, rebirths: number): { level: number; into: number; need: number } => {
  let level = 1
  let rest = xp
  while (level < REBIRTH_LEVEL && rest >= accountNeed(level, rebirths)) {
    rest -= accountNeed(level, rebirths)
    level++
  }
  return level >= REBIRTH_LEVEL ? { level, into: 0, need: 0 } : { level, into: rest, need: accountNeed(level, rebirths) }
}
export const REBIRTH_TITLES: [number, string][] = [[1, 'Revenant'], [2, 'Deux fois né'], [3, 'Marcheur des failles'], [5, 'Éternel'], [7, 'Sans âge'], [10, 'Maître du cycle']]
export const rebirthTitle = (rebirths: number) => REBIRTH_TITLES.filter(([n]) => rebirths >= n).at(-1)?.[1] ?? ''
export const nextRebirthTitle = (rebirths: number) => REBIRTH_TITLES.find(([n]) => n > rebirths)

// ───── Libération (解放) ─────
// Après une première Renaissance, une carte peut être « libérée » contre des Fragments d'âme : elle gagne
// +15 % de PV, d'attaque et de défense, et son niveau maximum passe de 50 à 100. Définitif pour cette carte.
export const AWAKEN_STAT = 15
export const AWAKEN_COST: Record<RarityId, number> = { common: 20, rare: 30, epic: 50, ultra: 80, legend: 120, rift: 200 }
export const REBIRTH_SHARDS = 30 // fragments offerts à chaque Renaissance

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

// ───── Cote de la carte ─────
// Barème de départ d'une carte, en âmes, selon sa rareté ; une vente ne pourra pas se faire sous la moitié du barème.
// Le marché entre joueurs n'existe pas encore (il demande un jeu en ligne) : ces valeurs sont la règle prévue, pas des ventes.
export const MARKET_BASE: Record<RarityId, number> = { common: 50, rare: 150, epic: 500, ultra: 2000, legend: 6000, rift: 16000 }
export const marketFloor = (rarity: RarityId) => MARKET_BASE[rarity] / 2

// Plus grande valeur de base de chaque statistique dans tout le jeu : sert d'échelle aux barres de la fiche.
export const STAT_SCALE: Stats = HEROES.map(baseStats).reduce((m, s) => ({ hp: Math.max(m.hp, s.hp), atk: Math.max(m.atk, s.atk), def: Math.max(m.def, s.def), speed: Math.max(m.speed, s.speed) }))

// ───── Titres ─────
// Chaque univers a son échelle de six titres, tirés de son animé. Une carte porte le plus haut qu'elle a mérité :
// niveau 10, niveau 25, niveau 50, boss de son arc vaincu avec elle dans l'équipe, carte libérée, carte libérée au niveau 100.
export const TITLES: Record<string, [string, string, string, string, string, string]> = {
  Naruto: ['Genin', 'Chûnin', 'Jônin', 'Héros de Konoha', 'Sannin légendaire', 'Hokage'],
  'One Piece': ['Moussaillon', 'Pirate primé', 'Supernova', 'Grand Corsaire', 'Empereur des mers', 'Roi des Pirates'],
  'Dragon Ball': ['Élève de la Tortue', 'Guerrier Z', 'Super Saiyan', 'Champion du Tenkaichi', 'Super Saiyan Blue', 'Ultra Instinct'],
  Bleach: ['Âme errante', 'Shinigami', 'Lieutenant', 'Héros de la Soul Society', 'Capitaine', 'Capitaine-Commandant'],
  'Demon Slayer': ['Mizunoto', 'Kanoe', 'Kinoe', 'Tueur de Lune', 'Pilier', 'Marque du pourfendeur'],
  'Jujutsu Kaisen': ['Classe 4', 'Classe 2', 'Classe 1', 'Survivant de Shibuya', 'Classe spéciale', 'Le plus fort'],
  'Hunter x Hunter': ['Candidat Hunter', 'Hunter', 'Hunter une étoile', 'Vainqueur de Greed Island', 'Hunter deux étoiles', 'Hunter trois étoiles'],
}
export const TITLE_RULES = ['Niveau 10', 'Niveau 25', 'Niveau 50', 'Boss de son arc vaincu avec elle', 'Carte libérée', 'Carte libérée au niveau 100']
export type TitleTier = 'bronze' | 'silver' | 'gold'
const TITLE_TIER: TitleTier[] = ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold']
// Rang de titre atteint (-1 = aucun).
export const titleRank = (level: number, freed: boolean, arcDone: boolean) =>
  freed && level >= MAX_LEVEL ? 5 : freed ? 4 : arcDone ? 3 : level >= 50 ? 2 : level >= 25 ? 1 : level >= 10 ? 0 : -1
export const titleOf = (hero: Hero, level: number, freed: boolean, arcDone: boolean): { name: string; tier: TitleTier; rank: number } | null => {
  const rank = titleRank(level, freed, arcDone)
  return rank < 0 ? null : { name: (TITLES[hero.world] as string[])[rank], tier: TITLE_TIER[rank], rank }
}
