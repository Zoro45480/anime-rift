import type { RarityId } from '../data/rarities'

// Réglages de la cinématique d'invocation pour chaque rareté.
// Pour retoucher une mise en scène, c'est ici : couleurs, durées, quantité d'effets, caméra.

export type PhaseTimes = { gather: number; open: number; surge: number; hush: number; burst: number } // secondes

export type SummonPreset = {
  rank: string // mention affichée à la révélation
  colors: { core: number; accent: number; second: number; deep: number }
  camera: 'Cam_Push' | 'Cam_Orbit' | 'Cam_Pull' // plan animé dans Blender
  times: PhaseTimes
  portalScale: number
  rings: number // anneaux d'énergie visibles (5 au maximum)
  crystals: number // 14 au maximum
  fragments: number // 18 au maximum
  beams: boolean // colonnes de lumière
  particles: number
  bolts: number // éclairs simultanés
  shocks: number // ondes de choc à l'explosion
  bloom: number // force du halo lumineux
  shake: number // secousse de caméra à l'explosion
  darkness: number // absorption de la lumière avant la révélation (0 = aucune)
  distortion: number // distorsion de l'espace (0 = aucune)
  voidDisc: boolean // portail noir bordé de couleur (la faille mythique)
  crackStays: boolean // la déchirure reste ouverte pendant toute la séquence
}

export const PRESETS: Record<RarityId, SummonPreset> = {
  // R — bleu électrique et cyan : un portail net, court, une petite explosion.
  rare: {
    rank: 'Rare', colors: { core: 0xd8f4ff, accent: 0x2f9bff, second: 0x4be3ff, deep: 0x06224f },
    camera: 'Cam_Push', times: { gather: 0.7, open: 0.8, surge: 1.1, hush: 0, burst: 0.5 },
    portalScale: 0.82, rings: 2, crystals: 5, fragments: 4, beams: false, particles: 520, bolts: 1, shocks: 1,
    bloom: 0.7, shake: 0.15, darkness: 0, distortion: 0, voidDisc: false, crackStays: false,
  },
  // SR — violet et magenta : ondes d'énergie, la caméra s'approche, explosion lumineuse.
  epic: {
    rank: 'Super rare', colors: { core: 0xf6e0ff, accent: 0xa94dff, second: 0xff4fd8, deep: 0x2b0a5c },
    camera: 'Cam_Push', times: { gather: 0.8, open: 1.0, surge: 1.6, hush: 0, burst: 0.6 },
    portalScale: 0.95, rings: 3, crystals: 9, fragments: 8, beams: false, particles: 950, bolts: 2, shocks: 2,
    bloom: 0.9, shake: 0.3, darkness: 0, distortion: 0.25, voidDisc: false, crackStays: false,
  },
  // LR — or et blanc : portail monumental, colonnes de lumière, travelling circulaire, explosion dorée.
  legend: {
    rank: 'Légendaire', colors: { core: 0xfffbe0, accent: 0xffc531, second: 0xffe98a, deep: 0x5c3a00 },
    camera: 'Cam_Orbit', times: { gather: 1.0, open: 1.3, surge: 2.4, hush: 0.25, burst: 0.8 },
    portalScale: 1.12, rings: 5, crystals: 14, fragments: 12, beams: true, particles: 1900, bolts: 3, shocks: 3,
    bloom: 1.15, shake: 0.55, darkness: 0.25, distortion: 0.4, voidDisc: false, crackStays: false,
  },
  // MR — noir cosmique, rouge, or et violet : une faille gigantesque, la lumière absorbée, le silence, puis tout explose.
  rift: {
    rank: 'Mythique', colors: { core: 0xfff1e6, accent: 0xff2647, second: 0xffc531, deep: 0x3a0a66 },
    camera: 'Cam_Pull', times: { gather: 1.2, open: 1.8, surge: 3.0, hush: 0.9, burst: 1.0 },
    portalScale: 1.4, rings: 5, crystals: 14, fragments: 18, beams: true, particles: 2500, bolts: 4, shocks: 4,
    bloom: 1.3, shake: 1, darkness: 1, distortion: 1, voidDisc: true, crackStays: true,
  },
}
