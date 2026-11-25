import { useId } from 'react'
import type { RarityId } from '../data/rarities'

// Ce qui dépasse de la carte. Deux couches : « back » passe derrière la carte, « front » par-dessus son bord.
// Dessin en coordonnées 100 × 140 (la carte) ; tout ce qui sort de ce rectangle déborde.
// Chaque rareté suit une recette (voir RECIPES) : lames d'acier pour R, liane d'améthyste pour SR,
// ronces arc-en-ciel et nacre pour LR, ronces de chrome et épines rouges pour MR.

type Pt = [number, number]
type Fan = { offsets: number[]; lengths: number[]; width: number }

const rad = (d: number) => (d * Math.PI) / 180
const f = (n: number) => n.toFixed(1)

// Plume ou griffe : base (x, y), pointe dans la direction `deg` (0 = droite, 90 = bas), recourbée de `curve`.
const feather = (x: number, y: number, deg: number, len: number, width: number, curve: number) => {
  const a = rad(deg)
  const dx = Math.cos(a), dy = Math.sin(a)
  const px = -dy, py = dx
  const at = (along: number, across: number) => `${f(x + dx * along + px * across)} ${f(y + dy * along + py * across)}`
  const bend = curve * len
  const body = `M${at(0, width / 2)} Q${at(len * 0.55, width * 0.55 + bend * 0.2)} ${at(len, bend)} Q${at(len * 0.5, -width * 0.3 + bend * 0.6)} ${at(0, -width / 2)}Z`
  const vein = `M${at(0, 0)} Q${at(len * 0.5, bend * 0.35)} ${at(len * 0.94, bend * 0.94)}`
  return { body, vein }
}

const fan = (x: number, y: number, dir: number, spec: Fan, curve: number) =>
  spec.offsets.map((o, i) => feather(x, y, dir + o, spec.lengths[i], spec.width * (0.7 + (spec.lengths[i] / Math.max(...spec.lengths)) * 0.3), curve))

// Ruban d'épaisseur variable le long d'une ligne (liane, spirale) : renvoie son contour et sa ligne de reflet.
const ribbon = (centers: Pt[], widths: number[]) => {
  const left: string[] = []
  const right: string[] = []
  centers.forEach(([x, y], i) => {
    const [ax, ay] = centers[Math.max(0, i - 1)]
    const [bx, by] = centers[Math.min(centers.length - 1, i + 1)]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const nx = -(by - ay) / l, ny = (bx - ax) / l
    left.push(`${f(x + (nx * widths[i]) / 2)} ${f(y + (ny * widths[i]) / 2)}`)
    right.unshift(`${f(x - (nx * widths[i]) / 2)} ${f(y - (ny * widths[i]) / 2)}`)
  })
  return { body: `M${left.join('L')}L${right.join('L')}Z`, vein: `M${centers.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}` }
}

// Liane qui ondule le long d'un bord, de A à B. Renvoie aussi ses crêtes extérieures, où poussent les épines.
const vine = (a: Pt, b: Pt, n: Pt, waves: number, amp: number, phase: number, width: number) => {
  const centers: Pt[] = []
  const widths: number[] = []
  const crests: Pt[] = []
  const steps = 44
  let prevSlope = 0
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const env = Math.pow(Math.sin(Math.PI * t), 0.55)
    const angle = 2 * Math.PI * waves * t + phase
    const off = amp * Math.sin(angle) * env
    const p: Pt = [a[0] + (b[0] - a[0]) * t + n[0] * off, a[1] + (b[1] - a[1]) * t + n[1] * off]
    centers.push(p)
    widths.push(width * (0.3 + 0.7 * env))
    const slope = Math.cos(angle)
    if (i > 1 && prevSlope > 0 && slope <= 0 && Math.sin(angle) > 0.6) crests.push(p)
    prevSlope = slope
  }
  return { ...ribbon(centers, widths), crests }
}

// Spirale qui s'enroule vers l'extérieur d'un coin.
const spiral = (cx: number, cy: number, startDeg: number, turn: 1 | -1, r0: number, width: number) => {
  const centers: Pt[] = []
  const widths: number[] = []
  for (let i = 0; i <= 30; i++) {
    const s = i / 30
    const a = rad(startDeg) + turn * s * Math.PI * 1.85
    const r = r0 * (1 - 0.8 * s)
    centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    widths.push(width * (1 - s) + 0.5)
  }
  return ribbon(centers, widths)
}

const CORNERS: [number, number, number][] = [[3, 3, -135], [97, 3, -45], [97, 137, 45], [3, 137, 135]]
const SPARKS: [number, number, number][] = [[-12, 34, 4], [113, 46, 3.4], [-11, 104, 3], [112, 112, 4], [28, -14, 3.4], [72, 156, 3], [117, 80, 2.6]]

type Tone = 'a' | 'b' | 'chrome' | 'dark' | 'pearl' | 'steel'
type Shape = { body: string; vein: string; tone: Tone }

// Recette des ornements d'une rareté. Toutes les cartes partagent le même vocabulaire (lianes, épines, spirales,
// lames, griffes arrière) ; seules les quantités, les tailles et les matières changent.
type Recipe = {
  vines: Tone[] // lianes entrelacées autour du cadre (0, 1 ou 2)
  amp: number // amplitude de l'ondulation
  vineWidth: number
  thorns: { len: number; tones: Tone[]; every: number } | null // épines sur les crêtes des lianes
  spiral: { r: number; width: number; tone: Tone; second: Tone | null } | null // spirales des coins
  blades: { len: number; width: number; tone: Tone } | null // deux lames par coin
  studs: { len: number; tone: Tone } | null // petit fleuron au milieu de chaque bord
  back: { fan: Fan; tones: Tone[]; curve: number } | null // griffes qui sortent de derrière la carte
  sparks: number
}

const RECIPES: Record<RarityId, Recipe> = {
  // R : acier. Pas de liane, juste des lames et des fleurons discrets.
  rare: {
    vines: [], amp: 0, vineWidth: 0, thorns: null, spiral: null,
    blades: { len: 9, width: 3.6, tone: 'steel' }, studs: { len: 5, tone: 'steel' }, back: null, sparks: 0,
  },
  // SR : une liane d'améthyste, épines d'argent, petites spirales.
  epic: {
    vines: ['a'], amp: 2.8, vineWidth: 2.4, thorns: { len: 5.5, tones: ['chrome'], every: 1 },
    spiral: { r: 5, width: 2.6, tone: 'a', second: null }, blades: { len: 11, width: 3.8, tone: 'chrome' }, studs: null,
    back: { fan: { offsets: [-40, 0, 40], lengths: [11, 17, 11], width: 6 }, tones: ['a'], curve: 0.35 }, sparks: 0,
  },
  // LR : deux lianes, arc-en-ciel et nacre, épines prismatiques, gerbes multicolores derrière.
  legend: {
    vines: ['a', 'pearl'], amp: 3.5, vineWidth: 3, thorns: { len: 7.5, tones: ['b', 'a'], every: 1 },
    spiral: { r: 7, width: 3.2, tone: 'pearl', second: 'a' }, blades: { len: 14, width: 4.2, tone: 'b' }, studs: null,
    back: { fan: { offsets: [-72, -38, -6, 28, 62], lengths: [14, 23, 32, 26, 15], width: 8.4 }, tones: ['a', 'b'], curve: 0.4 }, sparks: 5,
  },
  // MR : ronces de chrome et d'acier noir, épines rouges, grandes griffes rouges et noires.
  rift: {
    vines: ['dark', 'chrome'], amp: 3.8, vineWidth: 3.2, thorns: { len: 8, tones: ['b'], every: 1 },
    spiral: { r: 7.5, width: 3.4, tone: 'chrome', second: 'dark' }, blades: { len: 15, width: 4.4, tone: 'chrome' }, studs: null,
    back: { fan: { offsets: [-74, -40, -8, 26, 60], lengths: [15, 26, 37, 30, 17], width: 9 }, tones: ['b', 'dark'], curve: 0.42 }, sparks: 7,
  },
}

const SIDES: [Pt, Pt, Pt, number][] = [
  [[7, 1.5], [93, 1.5], [0, -1], 2.5], [[98.5, 7], [98.5, 133], [1, 0], 3.5],
  [[93, 138.5], [7, 138.5], [0, 1], 2.5], [[1.5, 133], [1.5, 7], [-1, 0], 3.5],
]

const build = (r: Recipe, layer: 'back' | 'front'): Shape[] => {
  const out: Shape[] = []
  if (layer === 'back') {
    if (!r.back) return out
    for (const [x, y, d] of CORNERS) {
      fan(x, y, d, r.back.fan, r.back.curve).forEach((c, i) => out.push({ ...c, tone: r.back!.tones[i % r.back!.tones.length] }))
    }
    return out
  }
  const thorns: Shape[] = []
  for (const [a, b, n, waves] of SIDES) {
    const base = (Math.atan2(n[1], n[0]) * 180) / Math.PI
    r.vines.forEach((tone, v) => {
      // la première liane passe dessous (phase opposée), la dernière dessus
      const phase = r.vines.length > 1 && v === 0 ? Math.PI : 0
      const line = vine(a, b, n, waves, r.amp, phase, r.vineWidth * (v === r.vines.length - 1 ? 1 : 0.88))
      out.push({ body: line.body, vein: line.vein, tone })
      if (r.thorns) {
        line.crests.forEach((p, i) => {
          if (i % r.thorns!.every) return
          const k = i + v
          thorns.push({ ...feather(p[0], p[1], base + (k % 2 ? 28 : -28), r.thorns!.len + (k % 3) * r.thorns!.len * 0.42, r.thorns!.len * 0.42, k % 2 ? -0.5 : 0.5), tone: r.thorns!.tones[k % r.thorns!.tones.length] })
        })
      }
    })
    if (r.studs) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
      out.push(...fan(mx, my, base, { offsets: [-48, 0, 48], lengths: [r.studs.len * 0.7, r.studs.len, r.studs.len * 0.7], width: r.studs.len * 0.5 }, 0.2).map((s) => ({ ...s, tone: r.studs!.tone })))
    }
  }
  out.push(...thorns)
  for (const [x, y, d] of CORNERS) {
    const ox = Math.cos(rad(d)), oy = Math.sin(rad(d))
    const turn = (ox * oy > 0 ? 1 : -1) as 1 | -1
    if (r.spiral) {
      const k = r.spiral.r / 7.5
      out.push({ ...spiral(x + ox * 7 * k, y + oy * 7 * k, d + 180, turn, r.spiral.r, r.spiral.width), tone: r.spiral.tone })
      if (r.spiral.second) out.push({ ...spiral(x + ox * 3 - oy * 9 * turn * k, y + oy * 3 + ox * 9 * turn * k, d + 150, (-turn) as 1 | -1, r.spiral.r * 0.6, r.spiral.width * 0.7), tone: r.spiral.second })
    }
    if (r.blades) {
      out.push({ ...feather(x, y, d - 34, r.blades.len, r.blades.width, 0.4), tone: r.blades.tone }, { ...feather(x, y, d + 34, r.blades.len, r.blades.width, -0.4), tone: r.blades.tone })
    }
  }
  return out
}

export const CardBurst = ({ rarity, layer }: { rarity: RarityId; layer: 'back' | 'front' }) => {
  const id = useId()
  const recipe = RECIPES[rarity]
  const shapes = build(recipe, layer)
  const sparks = layer === 'front' ? recipe.sparks : 0
  if (shapes.length === 0) return null

  return (
    <svg className={`card__burst card__burst--${layer} card__burst--${rarity}`} viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="b-a" /><stop offset="0.5" className="b-b" /><stop offset="1" className="b-c" /></linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" className="b-d" /><stop offset="0.5" className="b-f" /><stop offset="1" className="b-e" /></linearGradient>
        {/* métal liquide : reflets clairs et sombres alternés */}
        <linearGradient id={`${id}chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.28" stopColor="#8d90a2" /><stop offset="0.5" stopColor="#ffffff" /><stop offset="0.74" stopColor="#5d6074" /><stop offset="1" stopColor="#e6e8f0" />
        </linearGradient>
        <linearGradient id={`${id}pearl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.3" stopColor="#ffd6f0" /><stop offset="0.55" stopColor="#ffffff" /><stop offset="0.8" stopColor="#bfeaff" /><stop offset="1" stopColor="#fff6c9" />
        </linearGradient>
        <linearGradient id={`${id}steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f8ff" /><stop offset="0.35" stopColor="#8ea3c8" /><stop offset="0.6" stopColor="#e3ecff" /><stop offset="1" stopColor="#4d5c80" />
        </linearGradient>
        <linearGradient id={`${id}dark`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#70738a" /><stop offset="0.45" stopColor="#1c1d27" /><stop offset="0.7" stopColor="#4a4c5e" /><stop offset="1" stopColor="#101118" />
        </linearGradient>
      </defs>
      {shapes.map((s, i) => (
        <g key={i}>
          <path d={s.body} fill={`url(#${id}${s.tone})`} className="card__feather" />
          <path d={s.vein} className={`card__vein card__vein--${s.tone}`} />
        </g>
      ))}
      {SPARKS.slice(0, sparks).map(([x, y, s], i) => (
        <path key={i} className="card__spark" style={{ animationDelay: `${i * 0.41}s` }}
          d={`M${x} ${y - s}L${x + s * 0.2} ${y - s * 0.2}L${x + s} ${y}L${x + s * 0.2} ${y + s * 0.2}L${x} ${y + s}L${x - s * 0.2} ${y + s * 0.2}L${x - s} ${y}L${x - s * 0.2} ${y - s * 0.2}Z`} />
      ))}
    </svg>
  )
}
