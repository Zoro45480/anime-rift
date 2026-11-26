import { HEROES, type Hero } from '../data/heroes'
import { makeUnit, type Unit } from './battle'
import { weekKey } from './contracts'
import { baseStats, type Stats } from './progression'

// L'Arène, sans serveur : tes duels se jouent contre des « Rivaux du Rift », des équipes contrôlées par le jeu.
// Elles sont réglées sur ta propre force et sur leur cote : un rival mieux classé est plus fort que toi.
// Cote elo (départ 1 000), ligues Bronze → Légende, 5 duels par jour. Les bonus de Renaissance n'y comptent pas.

export const DUELS_PER_DAY = 5
export const START_ELO = 1000
export const WIN_SOULS = 20
export const LEAGUES = [
  { id: 'bronze', label: 'Bronze', min: 0, hue: '#d98a56' },
  { id: 'silver', label: 'Argent', min: 1100, hue: '#cfd8ee' },
  { id: 'gold', label: 'Or', min: 1250, hue: '#ffc94d' },
  { id: 'platinum', label: 'Platine', min: 1450, hue: '#5ff2d4' },
  { id: 'diamond', label: 'Diamant', min: 1700, hue: '#7fb4ff' },
  { id: 'legend', label: 'Légende', min: 2000, hue: '#ff6ac0' },
] as const
export type LeagueId = (typeof LEAGUES)[number]['id']
export const leagueOf = (elo: number) => [...LEAGUES].reverse().find((l) => elo >= l.min)!

// Formule elo classique : K = 32.
export const eloChange = (me: number, them: number, win: boolean) => {
  const expected = 1 / (1 + 10 ** ((them - me) / 400))
  return Math.round(32 * ((win ? 1 : 0) - expected))
}

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const NAMES = ['Kaze', 'Aoi', 'Renji', 'Mika', 'Sora', 'Hikaru', 'Yuna', 'Kaito', 'Rin', 'Takeshi', 'Nami', 'Shin', 'Akira', 'Hana', 'Daichi', 'Emi', 'Ryo', 'Kira', 'Haru', 'Yuki', 'Ren', 'Tora', 'Saki', 'Jin']
const SUFFIX = ['du Vent', 'Lame-Noire', 'de la Faille', 'Œil-Rouge', 'le Calme', 'Croc-d’Argent', 'des Brumes', 'Main-de-Feu', 'le Silencieux', 'Cœur-de-Glace']

export type Rival = { id: string; name: string; elo: number; heroes: Hero[]; scale: number }

// Trois rivaux proposés autour de ta cote. `seed` change à chaque duel joué (ou quand tu changes de rivaux).
export const rivalsFor = (elo: number, seed: number): Rival[] => {
  const rng = seeded(seed * 9973 + elo)
  return [-60, 0, 70].map((d, i) => {
    const relo = Math.max(800, elo + d + Math.round((rng() - 0.5) * 60))
    const used = new Set<string>()
    const tier = leagueOf(relo)
    const rarities = tier.id === 'bronze' ? ['rare', 'epic'] : tier.id === 'silver' ? ['epic', 'ultra'] : tier.id === 'gold' ? ['ultra', 'legend'] : ['legend', 'rift']
    const heroes = [0, 1, 2].map(() => {
      const pool = HEROES.filter((h) => rarities.includes(h.rarity) && !used.has(h.id))
      const h = pool[Math.floor(rng() * pool.length)]
      used.add(h.id)
      return h
    })
    return { id: `${seed}-${i}`, name: `${NAMES[Math.floor(rng() * NAMES.length)]} ${SUFFIX[Math.floor(rng() * SUFFIX.length)]}`, elo: relo, heroes, scale: 0.98 + rng() * 0.14 }
  })
}

// Les équipes rivales sont mises à la force de la tienne, plus ou moins selon l'écart de cote.
export const rivalUnits = (r: Rival, myElo: number, myPower: number): Unit[] => {
  const strength = myPower * r.scale * (1 + (r.elo - myElo) / 450)
  const basePower = r.heroes.reduce((s, h) => s + power(baseStats(h)), 0)
  const k = Math.max(0.3, strength / Math.max(1, basePower))
  return r.heroes.map((h, i) => {
    const b = baseStats(h)
    const st: Stats = { hp: Math.round(b.hp * k), atk: Math.round(b.atk * k), def: Math.round(b.def * k), speed: b.speed }
    return makeUnit(h, st, 1, i)
  })
}
const power = (s: Stats) => Math.round(s.atk * 0.6 + s.def * 0.4 + s.hp * 0.1 + s.speed * 3)

// État de l'Arène ; les défis se renouvellent le lundi.
export type ArenaState = { elo: number; best: number; wins: number; losses: number; streak: number; seed: number; day: string; duels: number
  week: { key: string; duels: number; wins: number; bestStreak: number; upsets: number; claimed: string[] } }
export const emptyArena = (): ArenaState => ({ elo: START_ELO, best: START_ELO, wins: 0, losses: 0, streak: 0, seed: 1, day: '', duels: 0, week: { key: '', duels: 0, wins: 0, bestStreak: 0, upsets: 0, claimed: [] } })
export const rollWeek = (a: ArenaState, now: Date): ArenaState['week'] => (a.week.key === weekKey(now) ? a.week : { key: weekKey(now), duels: 0, wins: 0, bestStreak: 0, upsets: 0, claimed: [] })

export type PvpGoal = { id: string; title: string; target: number; gems: number; tickets?: number; value: (a: ArenaState, w: ArenaState['week']) => number }
export const PVP_GOALS: PvpGoal[] = [
  { id: 'p-duels', title: 'Joue 5 duels', target: 5, gems: 60, value: (_a, w) => w.duels },
  { id: 'p-wins3', title: 'Gagne 3 duels', target: 3, gems: 80, value: (_a, w) => w.wins },
  { id: 'p-streak', title: 'Gagne 5 duels d’affilée', target: 5, gems: 150, tickets: 1, value: (_a, w) => w.bestStreak },
  { id: 'p-upset', title: 'Bats un rival mieux classé que toi', target: 1, gems: 80, value: (_a, w) => w.upsets },
  { id: 'p-gold', title: 'Atteins la ligue Or (1 250)', target: 1250, gems: 200, tickets: 2, value: (a) => a.elo },
  { id: 'p-wins20', title: 'Gagne 20 duels', target: 20, gems: 250, tickets: 2, value: (_a, w) => w.wins },
]
