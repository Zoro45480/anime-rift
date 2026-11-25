import { AFFINITIES, type AffinityId } from '../data/affinities'

const PATHS: Record<AffinityId, string> = {
  fire: 'M12 2c1 4 5 5.5 5 10.5A5 5 0 0 1 7 12.5c0-2 1-3.2 2-4.5.3 1.6 1 2.4 2 2.8C10.5 7.5 11 4.5 12 2z',
  water: 'M12 2.5c3.2 4.2 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 2.8-6.800 6-11z',
  thunder: 'M13.5 2 5 13.5h5.2L8.5 22 19 9.800h-5.600z',
  wind: 'M3 8h10.500a2.750 2.750 0 1 0-2.750-2.750M3 12h15.500a2.750 2.750 0 1 1-2.750 2.750M3 16h8a2.500 2.500 0 1 1-2.500 2.500',
  earth: 'M12 2.500 20.500 8v8L12 21.500 3.500 16V8zM3.500 8 12 13l8.500-5M12 13v8.500',
  light: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.200 4.200l2.100 2.100M17.700 17.700l2.100 2.100M4.200 19.800l2.100-2.100M17.700 6.300l2.100-2.100',
  dark: 'M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z',
  rift: 'M13 1.500 9.500 9l4 2.500L8 22.500M6 5l-2.500 7L7 14M18 10l2.500 4.500-3.500 5',
}

const STROKED: AffinityId[] = ['wind', 'earth', 'light', 'rift']

export const AffinityIcon = ({ id, size = 22 }: { id: AffinityId; size?: number }) => {
  const stroked = STROKED.includes(id)
  const color = AFFINITIES[id].color
  return (
    <span className="affinity" style={{ color, width: size + 14, height: size + 14 }} title={AFFINITIES[id].label}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-label={AFFINITIES[id].label} role="img"
        fill={stroked ? 'none' : 'currentColor'} stroke={stroked ? 'currentColor' : 'none'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[id]} />
      </svg>
    </span>
  )
}
