import type { Hero, Role } from '../data/heroes'
import { MOVES } from '../data/moves'
import type { Stats } from './progression'

// Combat automatique au tour par tour, 3 contre 3. Fonction pure : mêmes équipes + même hasard = même combat.
// Les effets suivent exactement le texte des techniques de chaque rôle (progression.ts, EFFECTS).

export type Unit = { key: string; hero: Hero; side: 0 | 1; maxHp: number; hp: number; atk: number; def: number; speed: number; shield: number; energy: number; taunt: number; acted: number; kos: number }
export const makeUnit = (hero: Hero, stats: Stats, side: 0 | 1, index: number): Unit =>
  ({ key: `${side}-${index}`, hero, side, maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def, speed: stats.speed, shield: 0, energy: 0, taunt: 0, acted: 0, kos: 0 })

type Act = { mult?: number; aoe?: boolean; pierce?: number; selfShield?: number; teamShield?: number; healLowest?: number; healTeam?: number; selfHeal?: number; taunt?: number }
// [attaque, technique, ultime] de chaque rôle
const ACTS: Record<Role, [Act, Act, Act]> = {
  DPS: [{ mult: 1 }, { mult: 1.8 }, { mult: 3.5, pierce: 0.2 }],
  Tank: [{ mult: 0.8, selfShield: 0.05 }, { taunt: 2, selfShield: 0.15 }, { mult: 1.5, aoe: true, teamShield: 0.2 }],
  Soigneur: [{ mult: 0.8, healLowest: 0.06 }, { healLowest: 0.25 }, { healTeam: 0.3 }],
  'DPS / Tank': [{ mult: 1, selfShield: 0.04 }, { mult: 1.6, taunt: 1 }, { mult: 3, aoe: true, selfShield: 0.15 }],
  'DPS / Soigneur': [{ mult: 1, healLowest: 0.04 }, { mult: 1.6, healLowest: 0.15 }, { mult: 3, healTeam: 0.15 }],
  'Tank / Soigneur': [{ mult: 0.8, selfShield: 0.05 }, { taunt: 2, selfHeal: 0.15 }, { teamShield: 0.2, healTeam: 0.15 }],
}
const KINDS = ['Attaque', 'Technique', 'Ultime'] as const

export type Change = { target: string; amount: number; hp: number; shield: number; ko?: boolean }
export type BattleEvent = { actor: string; kind: (typeof KINDS)[number]; move: string; hits: Change[]; heals: Change[]; shields: Change[]; taunt: boolean }
export type BattleResult = { events: BattleEvent[]; win: boolean; rounds: number; fallen: number }
export const MAX_ROUNDS = 40

export const simulate = (allies: Unit[], foes: Unit[], rng: () => number): BattleResult => {
  const units = [...allies, ...foes].map((u) => ({ ...u }))
  const alive = (side: 0 | 1) => units.filter((u) => u.side === side && u.hp > 0)
  const events: BattleEvent[] = []
  const change = (u: Unit, amount: number): Change => ({ target: u.key, amount, hp: u.hp, shield: u.shield, ko: u.hp <= 0 })

  const strike = (actor: Unit, target: Unit, act: Act): Change => {
    let dmg = actor.atk * (act.mult ?? 0) * (0.95 + rng() * 0.1) * (1000 / (1000 + target.def * (1 - (act.pierce ?? 0))))
    // passifs offensifs
    if (actor.hero.role === 'DPS') dmg *= 1 + Math.min(3, actor.kos) * 0.1
    if (actor.hero.role === 'DPS / Tank') dmg *= 1.1
    // passifs défensifs
    if (target.hero.role === 'Tank' && target.hp > target.maxHp / 2) dmg *= 0.85
    if (target.hero.role === 'DPS / Tank') dmg *= 0.9
    if (units.some((u) => u.side === target.side && u.hp > 0 && u !== target && u.hero.role === 'Tank / Soigneur')) dmg *= 0.92
    const total = Math.max(1, Math.round(dmg))
    const absorbed = Math.min(target.shield, total)
    target.shield -= absorbed
    target.hp = Math.max(0, target.hp - (total - absorbed))
    if (target.hp === 0) actor.kos++
    if (actor.hero.role === 'DPS / Soigneur') actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(total * 0.2))
    return change(target, total)
  }
  const heal = (actor: Unit, target: Unit, pct: number): Change => {
    const boost = actor.hero.role === 'Soigneur' && target.hp < target.maxHp * 0.4 ? 1.15 : 1
    const amount = Math.min(target.maxHp - target.hp, Math.round(actor.maxHp * pct * boost))
    target.hp += amount
    return change(target, amount)
  }
  const shield = (actor: Unit, target: Unit, pct: number): Change => {
    const amount = Math.round(actor.maxHp * pct)
    target.shield += amount
    return change(target, amount)
  }
  const lowest = (list: Unit[]) => [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]

  let rounds = 0
  while (rounds < MAX_ROUNDS && alive(0).length && alive(1).length) {
    rounds++
    const order = units.filter((u) => u.hp > 0).sort((a, b) => b.speed - a.speed || a.side - b.side)
    for (const actor of order) {
      if (actor.hp <= 0) continue
      const enemies = alive(actor.side === 0 ? 1 : 0)
      const friends = alive(actor.side)
      if (!enemies.length) break
      if (actor.taunt > 0) actor.taunt--
      const slot = actor.energy >= 100 ? 2 : actor.acted % 2 === 1 ? 1 : 0
      actor.energy = slot === 2 ? 0 : actor.energy + 34
      actor.acted++
      const act = ACTS[actor.hero.role][slot]
      const ev: BattleEvent = { actor: actor.key, kind: KINDS[slot], move: MOVES[actor.hero.id][slot], hits: [], heals: [], shields: [], taunt: false }
      if (act.mult) {
        const taunters = enemies.filter((e) => e.taunt > 0)
        const targets = act.aoe ? enemies : [taunters.length ? taunters[0] : lowest(enemies)]
        for (const t of targets) ev.hits.push(strike(actor, t, act))
      }
      if (act.selfShield) ev.shields.push(shield(actor, actor, act.selfShield))
      if (act.teamShield) for (const f of friends) ev.shields.push(shield(actor, f, act.teamShield))
      if (act.healLowest) ev.heals.push(heal(actor, lowest(friends), act.healLowest))
      if (act.healTeam) for (const f of friends) ev.heals.push(heal(actor, f, act.healTeam))
      if (act.selfHeal) ev.heals.push(heal(actor, actor, act.selfHeal))
      if (act.taunt) { actor.taunt = act.taunt + 1; ev.taunt = true }
      events.push(ev)
    }
  }
  return { events, win: alive(1).length === 0 && alive(0).length > 0, rounds, fallen: allies.length - alive(0).length }
}

// Petit générateur de hasard reproductible (pour les tests et pour rejouer un combat à l'identique).
export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
