export type AffinityId = 'fire' | 'water' | 'thunder' | 'wind' | 'earth' | 'light' | 'dark' | 'rift'

export type Affinity = { id: AffinityId; label: string; color: string }

export const AFFINITIES: Record<AffinityId, Affinity> = {
  fire: { id: 'fire', label: 'Feu', color: 'var(--a-fire)' },
  water: { id: 'water', label: 'Eau', color: 'var(--a-water)' },
  thunder: { id: 'thunder', label: 'Foudre', color: 'var(--a-thunder)' },
  wind: { id: 'wind', label: 'Vent', color: 'var(--a-wind)' },
  earth: { id: 'earth', label: 'Terre', color: 'var(--a-earth)' },
  light: { id: 'light', label: 'Lumière', color: 'var(--a-light)' },
  dark: { id: 'dark', label: 'Ténèbres', color: 'var(--a-dark)' },
  rift: { id: 'rift', label: 'Dimensionnel', color: 'var(--a-rift)' },
}

export const AFFINITY_LIST = Object.values(AFFINITIES)
