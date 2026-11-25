export type RarityId = 'rare' | 'epic' | 'legend' | 'rift'

export type Rarity = { id: RarityId; label: string; short: string; stars: number; color: string }

export const RARITIES: Record<RarityId, Rarity> = {
  rare: { id: 'rare', label: 'Rare', short: 'R', stars: 3, color: 'var(--r-rare)' },
  epic: { id: 'epic', label: 'Épique', short: 'SR', stars: 4, color: 'var(--r-epic)' },
  legend: { id: 'legend', label: 'Légendaire', short: 'SSR', stars: 5, color: 'var(--r-legend)' },
  rift: { id: 'rift', label: 'Faille', short: 'UR', stars: 6, color: 'var(--r-rift)' },
}

export const RARITY_LIST = Object.values(RARITIES)
