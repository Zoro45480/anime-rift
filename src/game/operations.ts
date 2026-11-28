import type { RoleKind } from '../data/heroes'

// Opérations d'Guilde : le boss de la semaine se prend en 4 chapitres. Chaque secteur s'ouvre quand l'Ordre
// a infligé assez de dégâts cette semaine ; certains demandent un rôle précis dans l'équipe pour y contribuer.
export type Sector = { id: string; name: string; text: string; goal: number; needs?: RoleKind[] }
export type Chapter = { name: string; sectors: Sector[] }
export const OPERATIONS: Chapter[] = [
  { name: 'Ouvrir la voie', sectors: [
    { id: 'scout', name: 'Reconnaissance', text: 'Révèle les mécaniques du boss.', goal: 2_000_000 },
    { id: 'shield', name: 'Briser le bouclier', text: 'Retire le bouclier qui protège le boss.', goal: 5_000_000 },
  ] },
  { name: 'Briser les défenses', sectors: [
    { id: 'regen', name: 'Couper la régénération', text: 'Il faut une carte Soigneur ou Hybride dans ton équipe.', goal: 10_000_000, needs: ['soigneur', 'hybride'] },
    { id: 'adds', name: 'Neutraliser les renforts', text: 'Il faut une carte Tank ou Hybride dans ton équipe.', goal: 16_000_000, needs: ['tank', 'hybride'] },
  ] },
  { name: 'L’assaut du repaire', sectors: [
    { id: 'gate', name: 'Forcer l’entrée', text: 'Toute la Guilde frappe ensemble.', goal: 25_000_000 },
    { id: 'core', name: 'Le cœur du repaire', text: 'Dernier verrou avant le boss.', goal: 35_000_000 },
  ] },
  { name: 'Un dernier combat', sectors: [
    { id: 'final', name: 'Le boss final', text: 'Route ouverte quand tous les secteurs sont pris. Coffre pour les participants.', goal: 50_000_000 },
  ] },
]
export const ALL_SECTORS = OPERATIONS.flatMap((c) => c.sectors)
// Secteur en cours : le premier dont l'objectif n'est pas atteint.
export const currentSector = (weekDamage: number) => ALL_SECTORS.find((s) => weekDamage < s.goal) ?? null
export const sectorProgress = (s: Sector, weekDamage: number) => {
  const i = ALL_SECTORS.indexOf(s)
  const from = i === 0 ? 0 : ALL_SECTORS[i - 1].goal
  return Math.max(0, Math.min(1, (weekDamage - from) / (s.goal - from)))
}

// Quartier général : niveau 1 à 20 grâce à la Renommée (dégâts cumulés de l'Ordre depuis sa création).
export const HQ_STEP = 10_000_000
export const hqLevel = (renown: number) => Math.min(20, 1 + Math.floor(renown / HQ_STEP))
export const BRANCHES = [
  { id: 'strategy', name: 'Stratégie', ranks: [{ level: 3, text: 'Les mécaniques de chaque secteur sont révélées.' }, { level: 10, text: 'Les objectifs conseillés s’affichent en tête.' }] },
  { id: 'logistics', name: 'Logistique', ranks: [{ level: 5, text: 'Les cartes de soutien sont mises en avant.' }, { level: 13, text: 'Un essai de rattrapage par semaine.' }] },
  { id: 'prestige', name: 'Prestige', ranks: [{ level: 7, text: 'Décor de bannière de Guilde.' }, { level: 16, text: 'Emblème animé dans le classement.' }] },
]
