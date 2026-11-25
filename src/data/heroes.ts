import type { AffinityId } from './affinities'
import type { RarityId } from './rarities'

// Casting original d'ANIME RIFT. `model` désigne le modèle 3D (public/models) et ses illustrations (src/assets/art).
export type Hero = { id: string; model: string; name: string; title: string; role: string; rarity: RarityId; affinity: AffinityId; quote: string }

export const HEROES: Hero[] = [
  { id: 'lyss', model: 'Vita', name: 'Lyss', title: 'Écho de la Faille', role: 'Hybride', rarity: 'rift', affinity: 'rift', quote: 'Chaque faille a une voix. Moi, je les entends toutes.' },
  { id: 'mirelle', model: 'Darkness_Shibu', name: 'Mirelle', title: 'Dame du Crépuscule', role: 'Contrôle', rarity: 'legend', affinity: 'dark', quote: 'La nuit ne prend rien. Elle garde.' },
  { id: 'celestine', model: 'Victoria_Rubin', name: 'Célestine', title: "Chant de l'Aube", role: 'Soigneuse', rarity: 'legend', affinity: 'light', quote: "Tant que je chante, personne ne tombe." },
  { id: 'ren', model: 'Sakurada_Fumiriya', name: 'Ren', title: 'Lame Tranquille', role: 'DPS', rarity: 'epic', affinity: 'wind', quote: 'Un seul geste. Le bon.' },
  { id: 'akane', model: 'Sendagaya_Shibu', name: 'Akane', title: 'Étincelle Vive', role: 'Burst DPS', rarity: 'epic', affinity: 'fire', quote: "On fonce d'abord, on réfléchit en route !" },
  { id: 'poppy', model: 'Vivi', name: 'Poppy', title: 'Herboriste des Clairières', role: 'Support', rarity: 'epic', affinity: 'earth', quote: "J'ai une tisane pour ça. J'ai une tisane pour tout." },
  { id: 'shizu', model: 'Sendagaya_Shino', name: 'Shizu', title: 'Marée Calme', role: 'Contre-attaque', rarity: 'rare', affinity: 'water', quote: "Frappe. Je t'attends." },
  { id: 'kaito', model: 'HairSample_Male', name: 'Kaito', title: 'Orage Discret', role: 'Débuffeur', rarity: 'rare', affinity: 'thunder', quote: "Pas besoin de crier pour faire tomber la foudre." },
]
