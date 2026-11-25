export type RarityId = 'rare' | 'epic' | 'legend' | 'rift'

// `rate` = probabilité d'obtention par invocation (somme = 1). Affichée telle quelle au joueur.
export type Rarity = { id: RarityId; label: string; short: string; stars: number; color: string; rate: number }

export const RARITIES: Record<RarityId, Rarity> = {
  rare: { id: 'rare', label: 'Rare', short: 'R', stars: 3, color: 'var(--r-rare)', rate: 0.785 },
  epic: { id: 'epic', label: 'Épique', short: 'SR', stars: 4, color: 'var(--r-epic)', rate: 0.18 },
  legend: { id: 'legend', label: 'Légendaire', short: 'LR', stars: 5, color: 'var(--r-legend)', rate: 0.03 },
  rift: { id: 'rift', label: 'Faille', short: 'MR', stars: 6, color: 'var(--r-rift)', rate: 0.005 },
}

export const RARITY_ORDER: RarityId[] = ['rift', 'legend', 'epic', 'rare']
