export type RarityId = 'common' | 'rare' | 'epic' | 'ultra' | 'legend' | 'rift'

// Les six raretés du jeu, de la plus courante à la plus rare.
// `rate` = probabilité d'obtention par invocation (la somme fait 1). Affichée telle quelle au joueur dans l'index.
export type Rarity = { id: RarityId; label: string; short: string; stars: number; color: string; rate: number }

export const RARITIES: Record<RarityId, Rarity> = {
  common: { id: 'common', label: 'Commune', short: 'N', stars: 1, color: 'var(--r-common)', rate: 0.6009 },
  rare: { id: 'rare', label: 'Rare', short: 'R', stars: 2, color: 'var(--r-rare)', rate: 0.3 },
  epic: { id: 'epic', label: 'Super rare', short: 'SR', stars: 3, color: 'var(--r-epic)', rate: 0.085 },
  ultra: { id: 'ultra', label: 'Ultra rare', short: 'SSR', stars: 4, color: 'var(--r-ultra)', rate: 0.01 },
  legend: { id: 'legend', label: 'Légendaire', short: 'LR', stars: 5, color: 'var(--r-legend)', rate: 0.004 },
  rift: { id: 'rift', label: 'Mythique', short: 'MR', stars: 6, color: 'var(--r-rift)', rate: 0.0001 },
}

// De la plus rare à la plus courante.
export const RARITY_ORDER: RarityId[] = ['rift', 'legend', 'ultra', 'epic', 'rare', 'common']

// Raretés couvertes par la garantie (pity) : au bout de PITY_MAX invocations sans l'une d'elles, la suivante en est une.
export const PITY_RARITIES: RarityId[] = ['ultra', 'legend', 'rift']
export const isPityRarity = (id: RarityId) => PITY_RARITIES.includes(id)
