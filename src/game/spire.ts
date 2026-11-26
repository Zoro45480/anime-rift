import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { makeUnit, type Unit } from './battle'
import type { Reward } from './contracts'
import { baseStats, type ScrollId } from './progression'

// La Spire : une tour sans fin. Chaque étage a ses adversaires (tirés de tous les univers), une règle spéciale,
// et une récompense donnée une seule fois, à la première victoire. Les combats ne coûtent pas d'éclair
// et ne donnent pas d'XP de carte : la Spire mesure la force de ton équipe.

const BUDGET: Record<RarityId, number> = { common: 600, rare: 840, epic: 1140, ultra: 1500, legend: 1920, rift: 2400 }
export const BOSS_EVERY = 10

// Générateur pseudo-aléatoire : un étage donne toujours les mêmes adversaires.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export type Rule = { id: string; name: string; text: string; foe?: Partial<Record<'hp' | 'atk' | 'def', number>>; ally?: Partial<Record<'hp' | 'atk' | 'def', number>>; role?: 'DPS' | 'Tank' | 'Soigneur' } // rôle concerné (les hybrides comptent aussi)
export const RULES: Rule[] = [
  { id: 'calm', name: 'Étage calme', text: 'Aucune règle spéciale.' },
  { id: 'rage', name: 'Rage', text: 'Les adversaires ont +30 % d’attaque.', foe: { atk: 30 } },
  { id: 'shell', name: 'Carapace', text: 'Les adversaires ont +40 % de défense.', foe: { def: 40 } },
  { id: 'giants', name: 'Colosses', text: 'Les adversaires ont +50 % de PV.', foe: { hp: 50 } },
  { id: 'blades', name: 'Lames affûtées', text: 'Tes DPS ont +30 % d’attaque.', ally: { atk: 30 }, role: 'DPS' },
  { id: 'bastion', name: 'Bastion', text: 'Tes Tanks ont +40 % de défense et de PV.', ally: { def: 40, hp: 40 }, role: 'Tank' },
  { id: 'grace', name: 'Grâce', text: 'Tes Soigneurs ont +50 % de PV et +20 % d’attaque.', ally: { hp: 50, atk: 20 }, role: 'Soigneur' },
  { id: 'glass', name: 'Verre', text: 'Tout le monde a −30 % de défense : les coups font très mal.', foe: { def: -30 }, ally: { def: -30 } },
  { id: 'wall', name: 'Mur de fer', text: 'Les adversaires ont +25 % de PV et de défense.', foe: { hp: 25, def: 25 } },
]
export const BOSS_RULE: Rule = { id: 'guardian', name: 'Gardien', text: 'Un gardien garde l’étage : son chef a +60 % de PV et +20 % d’attaque.' }

export type Floor = { n: number; boss: boolean; rule: Rule; foes: Hero[]; force: number; reward: Reward; accountXp: number }

// Raretés des adversaires : elles montent avec les étages.
const lineup = (n: number, boss: boolean): RarityId[] => {
  const top: RarityId[] = n < 10 ? ['common', 'rare'] : n < 20 ? ['rare', 'epic'] : n < 35 ? ['epic', 'ultra'] : n < 60 ? ['ultra', 'legend'] : ['legend', 'rift']
  return boss ? [n >= 30 ? 'rift' : 'legend', top[1], top[1]] : [top[1], top[0], top[0]]
}
export const floorForce = (n: number) => Math.round(380 * 1.065 ** (n - 1) * (n % BOSS_EVERY === 0 ? 1.15 : 1))

export const floorReward = (n: number): Reward => {
  const r: Reward = { gems: 10 + 2 * n }
  if (n % 5 === 0) r.shards = 2 + Math.floor(n / 10)
  if (n % BOSS_EVERY === 0) {
    r.shards = (r.shards ?? 0) + 5
    r.tickets = 1
    r.scrolls = { [n % 20 === 0 ? 'large' : 'medium']: 1 } as Partial<Record<ScrollId, number>>
  }
  return r
}

export const floor = (n: number): Floor => {
  const boss = n % BOSS_EVERY === 0
  const rng = seeded(n * 7919)
  const used = new Set<string>()
  const foes = lineup(n, boss).map((rarity) => {
    const pool = HEROES.filter((h) => h.rarity === rarity && !used.has(h.id))
    const h = pool[Math.floor(rng() * pool.length)]
    used.add(h.id)
    return h
  })
  return { n, boss, rule: boss ? BOSS_RULE : n === 1 ? RULES[0] : RULES[(n * 5) % RULES.length], foes, force: floorForce(n), reward: floorReward(n), accountXp: 20 + 3 * n }
}

const mod = (v: number, pct?: number) => Math.max(1, Math.round(v * (1 + (pct ?? 0) / 100)))

export const spireFoes = (f: Floor): Unit[] => f.foes.map((h, i) => {
  const base = baseStats(h)
  const k = f.force / BUDGET[h.rarity]
  const chief = f.boss && i === 0
  const hp = base.hp * k * (chief ? 1.6 : 1), atk = base.atk * k * (chief ? 1.2 : 1)
  return makeUnit(h, { hp: mod(hp, f.rule.foe?.hp), atk: mod(atk, f.rule.foe?.atk), def: mod(base.def * k, f.rule.foe?.def), speed: base.speed }, 1, i)
})

// Applique la règle de l'étage à tes cartes (toutes, ou seulement un rôle).
export const applyRule = (allies: Unit[], rule: Rule): Unit[] => allies.map((u) => {
  if (!rule.ally || (rule.role && !u.hero.role.includes(rule.role))) return u
  const maxHp = mod(u.maxHp, rule.ally.hp)
  return { ...u, maxHp, hp: maxHp, atk: mod(u.atk, rule.ally.atk), def: mod(u.def, rule.ally.def) }
})
