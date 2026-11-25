import { useId } from 'react'
import type { RarityId } from '../data/rarities'

// Ornements du cadre des cartes : des éclats de cristal qui jaillissent du bord, de plus en plus nombreux avec la rareté.
// Dessin en coordonnées 100 × 140 (la carte), les éclats débordent à l'extérieur.

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

type Pt = [number, number]
type Shard = { pts: string; tone: number }

// Point et normale sortante à la position t (0..1) sur le pourtour de la carte.
const edge = (t: number): { p: Pt; n: Pt; tan: Pt } => {
  const W = 100, H = 140, per = 2 * (W + H)
  let d = ((t % 1) + 1) % 1 * per
  if (d < W) return { p: [d, 0], n: [0, -1], tan: [1, 0] }
  d -= W
  if (d < H) return { p: [W, d], n: [1, 0], tan: [0, 1] }
  d -= H
  if (d < W) return { p: [W - d, H], n: [0, 1], tan: [-1, 0] }
  d -= W
  return { p: [0, H - d], n: [-1, 0], tan: [0, -1] }
}

const CORNERS = [0, 100 / 480, 240 / 480, 340 / 480] // positions des 4 coins sur le pourtour

const build = (count: number, minL: number, maxL: number, seed: number, cornerBias: number): Shard[] => {
  const r = rng(seed)
  const out: Shard[] = []
  for (let i = 0; i < count; i++) {
    // une partie des éclats se regroupe près des coins, le reste se répartit sur les côtés
    const near = r() < cornerBias
    const t = near ? CORNERS[Math.floor(r() * 4)] + (r() - 0.5) * 0.11 : r()
    const { p, n, tan } = edge(t)
    const len = minL + r() * (maxL - minL) * (near ? 1 : 0.6)
    const w = 1.6 + r() * 3.2
    const skew = (r() - 0.5) * len * 1.3
    const inset = 2.5
    const a: Pt = [p[0] - n[0] * inset - tan[0] * w, p[1] - n[1] * inset - tan[1] * w]
    const b: Pt = [p[0] - n[0] * inset + tan[0] * w, p[1] - n[1] * inset + tan[1] * w]
    const tip: Pt = [p[0] + n[0] * len + tan[0] * skew, p[1] + n[1] * len + tan[1] * skew]
    out.push({ pts: [a, tip, b].map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '), tone: Math.floor(r() * 3) })
  }
  return out
}

const SPARKS: Pt[] = [[8, 12], [92, 30], [14, 128], [88, 118], [50, -4], [102, 78], [-3, 60]]

const SPEC: Record<RarityId, { count: number; min: number; max: number; bias: number; seed: number } | null> = {
  rare: null,
  epic: { count: 10, min: 2, max: 6, bias: 1, seed: 5 },
  legend: { count: 22, min: 2.5, max: 9, bias: 0.7, seed: 11 },
  rift: { count: 40, min: 4, max: 17, bias: 0.6, seed: 23 },
}

export const CardFrame = ({ rarity }: { rarity: RarityId }) => {
  const id = useId()
  const spec = SPEC[rarity]
  if (!spec) return null
  const shards = build(spec.count, spec.min, spec.max, spec.seed, spec.bias)
  return (
    <svg className={`cardframe cardframe--${rarity}`} viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}0`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="s-a" /><stop offset="1" className="s-b" /></linearGradient>
        <linearGradient id={`${id}1`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" className="s-c" /><stop offset="1" className="s-d" /></linearGradient>
        <linearGradient id={`${id}2`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" className="s-e" /><stop offset="1" className="s-f" /></linearGradient>
      </defs>
      {shards.map((s, i) => <polygon key={i} points={s.pts} fill={`url(#${id}${s.tone})`} className="cardframe__shard" />)}
      {rarity !== 'epic' && SPARKS.slice(0, rarity === 'rift' ? 7 : 5).map(([x, y], i) => (
        <path key={i} className="cardframe__spark" style={{ animationDelay: `${i * 0.37}s` }}
          d={`M${x} ${y - 5} L${x + 1.1} ${y - 1.1} L${x + 5} ${y} L${x + 1.1} ${y + 1.1} L${x} ${y + 5} L${x - 1.1} ${y + 1.1} L${x - 5} ${y} L${x - 1.1} ${y - 1.1} Z`} />
      ))}
    </svg>
  )
}
