import { useId } from 'react'

// Illustration TEMPORAIRE originale : silhouette stylisée générée à partir d'une graine.
// Remplacée automatiquement dès qu'une vraie image est déclarée dans assets/manifest.ts.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

export const HeroSilhouette = ({ seed, color }: { seed: number; color: string }) => {
  const id = useId()
  const r = rng(seed * 7919 + 13)
  const hair = Array.from({ length: 7 }, (_, i) => {
    const x = 70 + i * 10
    const tip = 38 - r() * 34
    return `L${x - 4} 78 L${x + (r() - 0.5) * 16} ${tip} L${x + 6} 76`
  }).join(' ')
  const cape = r() > 0.4
  const blade = r() > 0.5
  const lean = (r() - 0.5) * 8
  return (
    <svg viewBox="0 0 200 280" className="hero-art" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor="#04050d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b1f4a" />
          <stop offset="1" stopColor="#05060f" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor={color} stopOpacity="0.7" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="280" fill={`url(#${id}b)`} />
      <circle cx="100" cy="105" r="120" fill={`url(#${id}g)`} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${r() * 200} ${r() * 280} l${14 + r() * 40} ${-30 - r() * 60}`} stroke={color} strokeOpacity={0.15 + r() * 0.35} strokeWidth={0.6 + r() * 1.6} />
      ))}
      <g transform={`rotate(${lean} 100 280)`}>
        {cape && <path d="M62 128 Q20 200 34 280 L166 280 Q184 200 138 128 Z" fill="#0a0c22" stroke={color} strokeOpacity="0.35" />}
        {blade && <path d="M150 60 L158 56 L128 250 L122 250 Z" fill={color} fillOpacity="0.85" />}
        <path d="M58 280 L66 150 Q70 122 100 120 Q130 122 134 150 L142 280 Z" fill={`url(#${id}f)`} stroke={color} strokeOpacity="0.6" strokeWidth="1.2" />
        <path d="M84 122 L100 150 L116 122" fill="none" stroke={color} strokeOpacity="0.8" strokeWidth="1.4" />
        <path d="M78 112 Q76 70 100 66 Q124 70 122 112 Q112 124 100 124 Q88 124 78 112 Z" fill="#0d1030" stroke={color} strokeOpacity="0.5" />
        <path d={`M66 80 ${hair} L134 82 Q126 62 100 60 Q74 62 66 80 Z`} fill="#070818" stroke={color} strokeOpacity="0.75" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M86 96 l10 2 M104 98 l10 -2" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}
