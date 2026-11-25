import type { AffinityId } from './affinities'
import type { RarityId } from './rarities'

// Casting original d'ANIME RIFT. `model` désigne le modèle 3D (public/models) et ses illustrations (src/assets/art).
export type Hero = { id: string; no: number; model: string; name: string; title: string; world: string; role: string; rarity: RarityId; affinity: AffinityId; atk: number; def: number }

export const HEROES: Hero[] = [
  { id: 'lyss', no: 1, model: 'Vita', name: 'Lyss', title: 'Écho Premier', world: 'Enfants de la Faille', role: 'Hybride', rarity: 'rift', affinity: 'rift', atk: 2950, def: 3000 },
  { id: 'mirelle', no: 2, model: 'Darkness_Shibu', name: 'Mirelle', title: 'Dame du Crépuscule', world: 'Enfants de la Faille', role: 'Contrôle', rarity: 'legend', affinity: 'dark', atk: 2900, def: 2130 },
  { id: 'celestine', no: 3, model: 'Victoria_Rubin', name: 'Célestine', title: "Chant de l'Aube", world: "Jardin de l'Aube", role: 'Soigneuse', rarity: 'legend', affinity: 'light', atk: 2100, def: 2850 },
  { id: 'ren', no: 4, model: 'Sakurada_Fumiriya', name: 'Ren', title: 'Lame Tranquille', world: 'Académie Hoshikage', role: 'DPS', rarity: 'epic', affinity: 'wind', atk: 2450, def: 1700 },
  { id: 'akane', no: 5, model: 'Sendagaya_Shibu', name: 'Akane', title: 'Étincelle Vive', world: 'Académie Hoshikage', role: 'Burst DPS', rarity: 'epic', affinity: 'fire', atk: 2600, def: 1450 },
  { id: 'poppy', no: 6, model: 'Vivi', name: 'Poppy', title: 'Herboriste', world: "Jardin de l'Aube", role: 'Support', rarity: 'epic', affinity: 'earth', atk: 1500, def: 2400 },
  { id: 'shizu', no: 7, model: 'Sendagaya_Shino', name: 'Shizu', title: 'Marée Calme', world: 'Académie Hoshikage', role: 'Contre-attaque', rarity: 'rare', affinity: 'water', atk: 1700, def: 1900 },
  { id: 'kaito', no: 8, model: 'HairSample_Male', name: 'Kaito', title: 'Orage Discret', world: 'Académie Hoshikage', role: 'Débuffeur', rarity: 'rare', affinity: 'thunder', atk: 1850, def: 1600 },
]

export const heroById = (id: string): Hero => HEROES.find((h) => h.id === id)!
