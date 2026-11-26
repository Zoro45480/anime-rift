// Apparence du profil : cadres, couleurs du pseudo, effets et thèmes. Certains sont offerts, d'autres se gagnent
// (niveau, Renaissance), les autres s'achètent en âmes dans la boutique. Fonctions pures, testées.
export type CosmeticKind = 'frame' | 'color' | 'effect' | 'theme'
export type Cosmetic = { id: string; kind: CosmeticKind; name: string; price: number; value: string; needLevel?: number; needRebirth?: boolean }

export const KIND_LABEL: Record<CosmeticKind, string> = { frame: 'Cadres', color: 'Couleurs', effect: 'Effets', theme: 'Thèmes' }

export const COSMETICS: Cosmetic[] = [
  // cadres 3D : chacun est offert en atteignant son niveau, ou s'achète avant
  { id: 'frame:t0', kind: 'frame', name: 'Acier', price: 0, value: 't0' },
  { id: 'frame:t1', kind: 'frame', name: 'Or', price: 200, value: 't1', needLevel: 25 },
  { id: 'frame:t2', kind: 'frame', name: 'Braise', price: 500, value: 't2', needLevel: 50 },
  { id: 'frame:t3', kind: 'frame', name: 'Plasma', price: 1000, value: 't3', needLevel: 75 },
  { id: 'frame:t4', kind: 'frame', name: 'Légende', price: 2500, value: 't4', needLevel: 100 },
  { id: 'frame:r', kind: 'frame', name: 'Arc-en-ciel', price: 0, value: 'r', needRebirth: true },
  // couleurs du pseudo
  { id: 'color:white', kind: 'color', name: 'Blanc', price: 0, value: '#ffffff' },
  { id: 'color:gold', kind: 'color', name: 'Or', price: 60, value: '#ffd24d' },
  { id: 'color:crimson', kind: 'color', name: 'Écarlate', price: 60, value: '#ff5d7a' },
  { id: 'color:cyan', kind: 'color', name: 'Cyan', price: 60, value: '#5ee6ff' },
  { id: 'color:violet', kind: 'color', name: 'Violet', price: 60, value: '#b78bff' },
  { id: 'color:jade', kind: 'color', name: 'Jade', price: 60, value: '#4be3a4' },
  { id: 'color:rose', kind: 'color', name: 'Rose', price: 60, value: '#ff8fd0' },
  { id: 'color:rainbow', kind: 'color', name: 'Arc-en-ciel', price: 400, value: 'rainbow' },
  // effets du pseudo
  { id: 'effect:none', kind: 'effect', name: 'Aucun', price: 0, value: 'none' },
  { id: 'effect:glow', kind: 'effect', name: 'Halo', price: 120, value: 'glow' },
  { id: 'effect:pulse', kind: 'effect', name: 'Pulsation', price: 200, value: 'pulse' },
  { id: 'effect:flame', kind: 'effect', name: 'Flamme', price: 300, value: 'flame' },
  // thèmes de la page
  { id: 'theme:rift', kind: 'theme', name: 'Faille', price: 0, value: '#7d5cff' },
  { id: 'theme:ember', kind: 'theme', name: 'Braise', price: 150, value: '#ff6a3d' },
  { id: 'theme:ocean', kind: 'theme', name: 'Océan', price: 150, value: '#2bb7ff' },
  { id: 'theme:jade', kind: 'theme', name: 'Jade', price: 150, value: '#35d69a' },
  { id: 'theme:royal', kind: 'theme', name: 'Royal', price: 150, value: '#ffc94d' },
]
export const cosmeticById = (id: string) => COSMETICS.find((c) => c.id === id)

// Un objet est disponible s'il est offert, gagné (niveau, Renaissance) ou acheté.
export const hasCosmetic = (c: Cosmetic, bought: string[], level: number, rebirths: number) =>
  bought.includes(c.id) || (c.needRebirth ? rebirths > 0 : c.price === 0 || (c.needLevel !== undefined && level >= c.needLevel))
// Peut-on l'acheter ? (les objets de Renaissance ne se vendent pas)
export const canBuy = (c: Cosmetic, bought: string[], level: number, rebirths: number, gems: number) =>
  !c.needRebirth && c.price > 0 && !hasCosmetic(c, bought, level, rebirths) && gems >= c.price
