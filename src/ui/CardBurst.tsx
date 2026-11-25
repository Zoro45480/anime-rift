import { useId } from 'react'
import type { RarityId } from '../data/rarities'

// Ce qui dépasse de la carte : des plumes de cristal recourbées qui jaillissent des coins et des bords,
// des volutes et quelques étincelles. Deux couches : « back » passe derrière la carte, « front » par-dessus son bord.
// Dessin en coordonnées 100 × 140 (la carte) ; tout ce qui sort de ce rectangle déborde.

type Fan = { offsets: number[]; lengths: number[]; width: number }
type Spec = { front: Fan; back: Fan | null; crest: Fan | null; side: Fan | null; curve: number; curls: boolean; sparks: number }

const SPEC: Record<RarityId, Spec | null> = {
  rare: null,
  epic: { front: { offsets: [-27, 27], lengths: [10, 10], width: 4.6 }, back: null, crest: null, side: null, curve: 0.28, curls: false, sparks: 0 },
  legend: {
    front: { offsets: [-44, 0, 44], lengths: [12, 20, 12], width: 6.6 },
    back: { offsets: [-68, -23, 23, 68], lengths: [14, 23, 23, 14], width: 7.8 },
    crest: { offsets: [-58, 0, 58], lengths: [8, 14, 8], width: 5.6 },
    side: null, curve: 0.3, curls: true, sparks: 4,
  },
  rift: {
    front: { offsets: [-62, -31, 0, 31, 62], lengths: [14, 22, 31, 22, 14], width: 8.2 },
    back: { offsets: [-80, -48, -16, 16, 48, 80], lengths: [17, 27, 39, 37, 26, 16], width: 10.5 },
    crest: { offsets: [-62, -30, 0, 30, 62], lengths: [8, 12, 19, 12, 8], width: 6.2 },
    side: { offsets: [-34, 0, 34], lengths: [8, 13, 8], width: 5.6 },
    curve: 0.36, curls: true, sparks: 7,
  },
}

const rad = (d: number) => (d * Math.PI) / 180
const f = (n: number) => n.toFixed(1)

// Une plume : base (x, y), direction de la pointe `deg` (0 = vers la droite, 90 = vers le bas), recourbée de `curve`.
const feather = (x: number, y: number, deg: number, len: number, width: number, curve: number) => {
  const a = rad(deg)
  const dx = Math.cos(a), dy = Math.sin(a) // direction
  const px = -dy, py = dx // perpendiculaire
  const at = (along: number, across: number) => `${f(x + dx * along + px * across)} ${f(y + dy * along + py * across)}`
  const bend = curve * len
  const body = `M${at(0, width / 2)} Q${at(len * 0.55, width * 0.55 + bend * 0.2)} ${at(len, bend)} Q${at(len * 0.5, -width * 0.3 + bend * 0.6)} ${at(0, -width / 2)}Z`
  const vein = `M${at(0, 0)} Q${at(len * 0.5, bend * 0.35)} ${at(len * 0.94, bend * 0.94)}`
  return { body, vein }
}

const CORNERS: [number, number, number][] = [[3, 3, -135], [97, 3, -45], [97, 137, 45], [3, 137, 135]]
const CURL = ['M5 0 C-3 -5 -11 -2 -9.5 4.5 C-8.5 9 -3 8 -3.8 4.2 C-4.2 2.4 -6.4 2.6 -6.2 4.2', 'M0 6 C-5 2 -4 -7 3 -7.5']
const FLIPS = ['', 'translate(100 0) scale(-1 1)', 'translate(100 140) scale(-1 -1)', 'translate(0 140) scale(1 -1)']
const SPARKS: [number, number, number][] = [[-12, 34, 4], [113, 46, 3.4], [-11, 104, 3], [112, 112, 4], [28, -14, 3.4], [72, 156, 3], [117, 80, 2.6]]

const fan = (x: number, y: number, dir: number, spec: Fan, curve: number) =>
  spec.offsets.map((o, i) => feather(x, y, dir + o, spec.lengths[i], spec.width * (0.7 + spec.lengths[i] / Math.max(...spec.lengths) * 0.3), curve))

export const CardBurst = ({ rarity, layer }: { rarity: RarityId; layer: 'back' | 'front' }) => {
  const id = useId()
  const spec = SPEC[rarity]
  if (!spec) return null
  const fans = layer === 'back' ? spec.back : spec.front
  if (!fans) return null

  const feathers = CORNERS.flatMap(([x, y, dir]) => fan(x, y, dir, fans, spec.curve))
  if (layer === 'front') {
    if (spec.crest) feathers.push(...fan(50, 2, -90, spec.crest, spec.curve), ...fan(50, 138, 90, spec.crest, spec.curve))
    if (spec.side) feathers.push(...fan(2, 70, 180, spec.side, spec.curve), ...fan(98, 70, 0, spec.side, spec.curve))
  }

  return (
    <svg className={`card__burst card__burst--${layer} card__burst--${rarity}`} viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="b-a" /><stop offset="0.5" className="b-b" /><stop offset="1" className="b-c" /></linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" className="b-d" /><stop offset="0.5" className="b-b" /><stop offset="1" className="b-e" /></linearGradient>
      </defs>
      {feathers.map((ft, i) => (
        <g key={i}>
          <path d={ft.body} fill={`url(#${id}${i % 2 ? 'a' : 'b'})`} className="card__feather" />
          <path d={ft.vein} className="card__vein" />
        </g>
      ))}
      {layer === 'front' && spec.curls && FLIPS.map((t) => (
        <g key={t} transform={`${t} scale(1.7)`} className="card__curl" stroke={`url(#${id}a)`}>
          {CURL.map((d) => <path key={d} d={d} />)}
        </g>
      ))}
      {layer === 'front' && SPARKS.slice(0, spec.sparks).map(([x, y, s], i) => (
        <path key={i} className="card__spark" style={{ animationDelay: `${i * 0.41}s` }}
          d={`M${x} ${y - s}L${x + s * 0.2} ${y - s * 0.2}L${x + s} ${y}L${x + s * 0.2} ${y + s * 0.2}L${x} ${y + s}L${x - s * 0.2} ${y + s * 0.2}L${x - s} ${y}L${x - s * 0.2} ${y - s * 0.2}Z`} />
      ))}
    </svg>
  )
}
