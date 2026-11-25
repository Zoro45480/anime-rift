import { useId } from 'react'
import type { RarityId } from '../data/rarities'

// Ce qui dépasse de la carte. Deux couches : « back » passe derrière la carte, « front » par-dessus son bord.
// Dessin en coordonnées 100 × 140 (la carte) ; tout ce qui sort de ce rectangle déborde.
//  - SR : deux petites pointes par coin.
//  - LR : gerbes de plumes de cristal arc-en-ciel, volutes, étincelles.
//  - MR : ronces de métal liquide qui ondulent autour du cadre, épines rouges recourbées, spirales aux coins.

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
const CURL = ['M5 0 C-3 -5 -11 -2 -9.5 4.5 C-8.5 9 -3 8 -3.8 4.2 C-4.2 2.4 -6.4 2.6 -6.2 4.2', 'M0 6 C-5 2 -4 -7 3 -7.5']
const FLIPS = ['', 'translate(100 0) scale(-1 1)', 'translate(100 140) scale(-1 -1)', 'translate(0 140) scale(1 -1)']

type Tone = 'a' | 'b' | 'chrome' | 'dark'
type Shape = { body: string; vein: string; tone: Tone }

const epic = (): Shape[] =>
  CORNERS.flatMap(([x, y, d]) => fan(x, y, d, { offsets: [-27, 27], lengths: [10, 10], width: 4.6 }, 0.28)).map((s) => ({ ...s, tone: 'a' as Tone }))

const legend = (layer: 'back' | 'front'): Shape[] => {
  const spec: Fan = layer === 'back' ? { offsets: [-68, -23, 23, 68], lengths: [14, 23, 23, 14], width: 7.8 } : { offsets: [-44, 0, 44], lengths: [12, 20, 12], width: 6.6 }
  const out = CORNERS.flatMap(([x, y, d]) => fan(x, y, d, spec, 0.3))
  if (layer === 'front') {
    const crest: Fan = { offsets: [-58, 0, 58], lengths: [8, 14, 8], width: 5.6 }
    out.push(...fan(50, 2, -90, crest, 0.3), ...fan(50, 138, 90, crest, 0.3))
  }
  return out.map((s, i) => ({ ...s, tone: (i % 2 ? 'a' : 'b') as Tone }))
}

const rift = (layer: 'back' | 'front'): Shape[] => {
  const out: Shape[] = []
  if (layer === 'back') {
    // grandes griffes qui sortent de derrière chaque coin, rouges et sombres en alternance
    for (const [x, y, d] of CORNERS) {
      const claws = fan(x, y, d, { offsets: [-74, -40, -8, 26, 60], lengths: [15, 26, 37, 30, 17], width: 9 }, 0.42)
      claws.forEach((c, i) => out.push({ ...c, tone: i % 2 ? 'dark' : 'b' }))
    }
    return out
  }
  // deux lianes entrelacées par bord, l'une sombre, l'autre chromée ; des épines rouges sur leurs crêtes
  const sides: [Pt, Pt, Pt, number][] = [
    [[7, 1.5], [93, 1.5], [0, -1], 2.5], [[98.5, 7], [98.5, 133], [1, 0], 3.5],
    [[93, 138.5], [7, 138.5], [0, 1], 2.5], [[1.5, 133], [1.5, 7], [-1, 0], 3.5],
  ]
  const thorns: Shape[] = []
  for (const [a, b, n, waves] of sides) {
    const under = vine(a, b, n, waves, 3.8, Math.PI, 2.8)
    const over = vine(a, b, n, waves, 3.8, 0, 3.2)
    out.push({ body: under.body, vein: under.vein, tone: 'dark' }, { body: over.body, vein: over.vein, tone: 'chrome' })
    const base = (Math.atan2(n[1], n[0]) * 180) / Math.PI
    ;[...over.crests, ...under.crests].forEach((p, i) => {
      thorns.push({ ...feather(p[0], p[1], base + (i % 2 ? 28 : -28), 8 + (i % 3) * 3.5, 3.4, i % 2 ? -0.5 : 0.5), tone: 'b' })
    })
  }
  out.push(...thorns)
  // à chaque coin : une grande spirale chromée, une petite sombre, deux lames chromées
  for (const [x, y, d] of CORNERS) {
    const ox = Math.cos(rad(d)), oy = Math.sin(rad(d))
    const turn = (ox * oy > 0 ? 1 : -1) as 1 | -1
    out.push({ ...spiral(x + ox * 7, y + oy * 7, d + 180, turn, 7.5, 3.4), tone: 'chrome' })
    out.push({ ...spiral(x + ox * 3 - oy * 9 * turn, y + oy * 3 + ox * 9 * turn, d + 150, (-turn) as 1 | -1, 4.6, 2.4), tone: 'dark' })
    out.push({ ...feather(x, y, d - 34, 15, 4.4, 0.4), tone: 'chrome' }, { ...feather(x, y, d + 34, 15, 4.4, -0.4), tone: 'chrome' })
  }
  return out
}

export const CardBurst = ({ rarity, layer }: { rarity: RarityId; layer: 'back' | 'front' }) => {
  const id = useId()
  if (rarity === 'rare' || (rarity === 'epic' && layer === 'back')) return null
  const shapes = rarity === 'epic' ? epic() : rarity === 'legend' ? legend(layer) : rift(layer)
  const sparks = layer === 'front' ? (rarity === 'rift' ? 7 : rarity === 'legend' ? 5 : 0) : 0

  return (
    <svg className={`card__burst card__burst--${layer} card__burst--${rarity}`} viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="b-a" /><stop offset="0.5" className="b-b" /><stop offset="1" className="b-c" /></linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" className="b-d" /><stop offset="0.5" className="b-f" /><stop offset="1" className="b-e" /></linearGradient>
        {/* métal liquide : reflets clairs et sombres alternés */}
        <linearGradient id={`${id}chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.28" stopColor="#8d90a2" /><stop offset="0.5" stopColor="#ffffff" /><stop offset="0.74" stopColor="#5d6074" /><stop offset="1" stopColor="#e6e8f0" />
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
      {layer === 'front' && rarity === 'legend' && FLIPS.map((t) => (
        <g key={t} transform={`${t} scale(1.7)`} className="card__curl" stroke={`url(#${id}a)`}>
          {CURL.map((d) => <path key={d} d={d} />)}
        </g>
      ))}
      {SPARKS.slice(0, sparks).map(([x, y, s], i) => (
        <path key={i} className="card__spark" style={{ animationDelay: `${i * 0.41}s` }}
          d={`M${x} ${y - s}L${x + s * 0.2} ${y - s * 0.2}L${x + s} ${y}L${x + s * 0.2} ${y + s * 0.2}L${x} ${y + s}L${x - s * 0.2} ${y + s * 0.2}L${x - s} ${y}L${x - s * 0.2} ${y - s * 0.2}Z`} />
      ))}
    </svg>
  )
}
