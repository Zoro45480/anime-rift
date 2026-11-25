import { useId } from 'react'
import type { RarityId } from '../data/rarities'

// Ornements gravés de la carte : filets doubles et volutes aux quatre coins, blason en haut pour la plus rare.
// Dessin en coordonnées 100 × 140 (la face de la carte). Les cartes R n'en ont pas, les SR n'ont que le filet.

// Volute d'un coin (dessinée pour le coin haut-gauche, puis retournée pour les trois autres).
const CORNER = [
  'M3.5 30 V11 Q3.5 3.5 11 3.5 H30', // filet extérieur
  'M6.5 24 V12.5 Q6.5 6.5 12.5 6.5 H24', // filet intérieur
  'M6.5 17 q5.5 0.5 5.5 -5 q0 -3.5 -3.5 -3.5 q-2.6 0 -2.6 2.6 q0 1.8 1.8 1.8', // volute verticale
  'M17 6.5 q0.5 5.5 -5 5.5', // volute horizontale
  'M14 14 l3.4 3.4 M19 19 l1.6 1.6', // trait de fuite vers le centre
]
const DIAMOND = 'M9.2 6.6 l2.4 2.6 l-2.4 2.6 l-2.4 -2.6 z'

const FLIPS = ['', 'translate(100 0) scale(-1 1)', 'translate(100 140) scale(-1 -1)', 'translate(0 140) scale(1 -1)']

export const CardOrnaments = ({ rarity }: { rarity: RarityId }) => {
  const id = useId()
  if (rarity === 'rare') return null
  const rich = rarity === 'legend' || rarity === 'rift'
  return (
    <svg className={`card__orn card__orn--${rarity}`} viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="o-a" /><stop offset="0.5" className="o-b" /><stop offset="1" className="o-c" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id}g)`} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="93" height="133" rx="5.5" strokeWidth="0.55" opacity={rich ? 0.9 : 0.7} />
        {rich && <rect x="6.5" y="6.5" width="87" height="127" rx="3.5" strokeWidth="0.3" opacity="0.6" />}
        {rich && FLIPS.map((t) => (
          <g key={t} transform={t} strokeWidth="0.75">
            {CORNER.map((d) => <path key={d} d={d} />)}
            <path d={DIAMOND} fill={`url(#${id}g)`} stroke="none" />
          </g>
        ))}
        {rarity === 'rift' && (
          <g strokeWidth="0.7">
            {/* blason : losange fendu et deux ailes, en haut de la carte */}
            <path d="M50 1.5 l4.2 5 l-4.2 5 l-4.2 -5 z" fill={`url(#${id}g)`} stroke="none" />
            <path d="M43.5 6.5 h-9 q-4 0 -5.5 3 M56.5 6.5 h9 q4 0 5.5 3" />
            <path d="M41 9.5 h-5 M59 9.5 h5" opacity="0.7" />
            <path d="M50 138.5 l3 -3.5 l-3 -3.5 l-3 3.5 z" fill={`url(#${id}g)`} stroke="none" />
          </g>
        )}
      </g>
    </svg>
  )
}
