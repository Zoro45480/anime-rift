import { BANNERS } from '../data/banners'
import { HEROES, heroById, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { makeUnit, type Unit } from './battle'
import { weekKey, type Reward } from './contracts'
import { baseStats } from './progression'

// Les Colosses : chaque semaine, un grand méchant d'un univers devient un boss colossal, entouré de deux sbires.
// Quatre difficultés, chacune s'ouvre quand la précédente est battue. 3 essais gratuits par jour.
// La récompense d'une difficulté se gagne une fois par semaine ; chaque victoire rapporte aussi un peu d’Éclats.

const BUDGET: Record<RarityId, number> = { common: 600, rare: 840, epic: 1140, ultra: 1500, legend: 1920, rift: 2400 }
export const TRIES_PER_DAY = 3

// Le méchant de chaque univers, et ses deux sbires.
const VILLAINS: Record<string, [string, RarityId]> = {
  naruto: ['madara', 'epic'], onepiece: ['teach', 'epic'], dragonball: ['jiren', 'epic'], bleach: ['yhwach', 'epic'],
  demonslayer: ['muzan', 'epic'], jujutsu: ['sukuna', 'epic'], hunter: ['meruem', 'epic'],
}

export type Difficulty = { id: 'normal' | 'hard' | 'extreme' | 'ultimate'; label: string; force: number; hp: number; reward: Reward; card?: boolean; hue: string }
export const DIFFICULTIES: Difficulty[] = [
  { id: 'normal', label: 'Normal', force: 700, hp: 3, hue: '#4be3a4', reward: { gems: 60, scrolls: { medium: 1 } } },
  { id: 'hard', label: 'Difficile', force: 1300, hp: 3.5, hue: '#ffc94d', reward: { gems: 100, tickets: 1, shards: 3 } },
  { id: 'extreme', label: 'Extrême', force: 2300, hp: 4, hue: '#ff6a2b', reward: { gems: 150, tickets: 2, shards: 6, scrolls: { large: 1 } } },
  { id: 'ultimate', label: 'Ultime', force: 4000, hp: 5, hue: '#ff3d8b', reward: { gems: 300, tickets: 3, shards: 10, scrolls: { large: 2 } }, card: true },
]
export const WIN_SOULS = 15 // à chaque victoire, même déjà récompensée

// Le Colosse de la semaine (il change chaque lundi).
export const colossusOf = (now: Date) => {
  const w = weekKey(now)
  const [y, m, d] = w.split('-').map(Number)
  const n = Math.floor(new Date(y, m - 1, d).getTime() / (7 * 86400000))
  const banner = BANNERS[((n % BANNERS.length) + BANNERS.length) % BANNERS.length]
  const [bossId, minion] = VILLAINS[banner.id]
  const boss = heroById(bossId)
  const minions = HEROES.filter((h) => h.world === banner.world && h.rarity === minion && h.id !== bossId).slice(0, 2)
  return { week: w, banner, boss, minions }
}

export const colossusFoes = (boss: Hero, minions: Hero[], diff: Difficulty): Unit[] => [boss, ...minions].map((h, i) => {
  const base = baseStats(h)
  const k = diff.force / BUDGET[h.rarity]
  const big = i === 0
  return makeUnit(h, { hp: Math.round(base.hp * k * (big ? diff.hp : 1)), atk: Math.round(base.atk * k * (big ? 1.25 : 0.9)), def: Math.round(base.def * k), speed: base.speed + (big ? 4 : 0) }, 1, i)
})

// Contrats d'événement de la semaine ; quand les trois sont faits, une carte SR ou mieux garantie.
export type ColState = { week: string; cleared: Difficulty['id'][]; tries: { day: string; n: number }; wins: number; pulls: number; final: boolean }
export const emptyCol = (week: string): ColState => ({ week, cleared: [], tries: { day: '', n: 0 }, wins: 0, pulls: 0, final: false })
export const EVENT_GOALS = [
  { id: 'wins', title: 'Gagne 5 combats contre le Colosse', target: 5, value: (c: ColState) => c.wins },
  { id: 'extreme', title: 'Bats le Colosse en Extrême ou Ultime', target: 1, value: (c: ColState) => (c.cleared.includes('extreme') || c.cleared.includes('ultimate') ? 1 : 0) },
  { id: 'pulls', title: 'Fais 50 invocations pendant la semaine', target: 50, value: (c: ColState) => c.pulls },
] as const
export const eventDone = (c: ColState) => EVENT_GOALS.every((g) => g.value(c) >= g.target)
export const rollCol = (c: ColState | undefined, now: Date): ColState => {
  const w = weekKey(now)
  return c && c.week === w ? c : emptyCol(w)
}
export const isOpen = (c: ColState, d: Difficulty) => {
  const i = DIFFICULTIES.indexOf(d)
  return i === 0 || c.cleared.includes(DIFFICULTIES[i - 1].id)
}
