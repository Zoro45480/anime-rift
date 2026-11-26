import { HEROES } from '../data/heroes'
import { levelFromXp, MAX_LEVEL } from './progression'
import { STAGES, STAGES_PER_ARC } from './saga'

// Succès : des objectifs calculés sur la partie réelle. Chaque succès obtenu débloque un titre à afficher sur le profil.
export type AchState = { owned: Record<string, number>; xp: Record<string, number>; saga: Record<string, number>; awakened: string[]; rebirths: number; pulls: number; wins: number }
export type Achievement = { id: string; group: 'Collection' | 'Invocation' | 'Combat' | 'Maîtrise'; kanji: string; name: string; goal: string; title: string; target: number; value: (s: AchState) => number }

const count = (s: AchState, test: (id: string) => boolean) => Object.keys(s.owned).filter((id) => s.owned[id] > 0 && test(id)).length
const rarityOf = new Map(HEROES.map((h) => [h.id, h.rarity]))
const stars = (s: AchState) => Object.values(s.saga).reduce((a, b) => a + b, 0)
const arcs = (s: AchState) => STAGES.filter((st) => st.boss && (s.saga[st.id] ?? 0) > 0).length
const best = (s: AchState) => Math.max(0, ...Object.keys(s.owned).filter((id) => s.owned[id] > 0).map((id) => levelFromXp(s.xp[id] ?? 0, s.awakened.includes(id) ? MAX_LEVEL : 50).level))

const tiers = (group: Achievement['group'], kanji: string, base: string, steps: [number, string, string, string][], value: Achievement['value']): Achievement[] =>
  steps.map(([target, name, goal, title]) => ({ id: `${base}-${target}`, group, kanji, name, goal, title, target, value }))

export const ACHIEVEMENTS: Achievement[] = [
  ...tiers('Collection', '集', 'cards', [[10, 'Premiers pas de collectionneur', 'Possède 10 personnages différents.', 'Collectionneur'], [50, 'Classeur bien rempli', 'Possède 50 personnages différents.', 'Archiviste'], [150, 'Grande galerie', 'Possède 150 personnages différents.', 'Conservateur'], [400, 'Mémoire des mondes', 'Possède 400 personnages différents.', 'Gardien des mondes']], (s) => count(s, () => true)),
  ...tiers('Collection', '光', 'legend', [[1, 'Éclat légendaire', 'Possède une carte LR ou MR.', 'Élu de la faille'], [5, 'Constellation', 'Possède 5 cartes LR ou MR.', 'Porteur de légendes'], [15, 'Panthéon', 'Possède 15 cartes LR ou MR.', 'Maître du panthéon']], (s) => count(s, (id) => rarityOf.get(id) === 'legend' || rarityOf.get(id) === 'rift')),
  ...tiers('Collection', '神', 'mythic', [[1, 'Le mythe existe', 'Possède une carte MR.', 'Témoin du mythe']], (s) => count(s, (id) => rarityOf.get(id) === 'rift')),
  ...tiers('Invocation', '召', 'pulls', [[10, 'Premier rituel', 'Réalise 10 invocations.', 'Invocateur'], [100, 'Habitué de la faille', 'Réalise 100 invocations.', 'Grand invocateur'], [500, 'Faille grande ouverte', 'Réalise 500 invocations.', 'Maître des failles']], (s) => s.pulls),
  ...tiers('Combat', '闘', 'wins', [[10, 'Échauffement', 'Gagne 10 combats.', 'Combattant'], [100, 'Vétéran', 'Gagne 100 combats.', 'Vétéran'], [500, 'Invaincu', 'Gagne 500 combats.', 'Seigneur de guerre']], (s) => s.wins),
  ...tiers('Combat', '星', 'stars', [[15, 'Arc parfait', 'Gagne 15 étoiles dans La Saga.', 'Chasseur d’étoiles'], [60, 'Ciel étoilé', 'Gagne 60 étoiles dans La Saga.', 'Astronome'], [STAGES.length * 3, 'Toutes les étoiles', `Gagne les ${STAGES.length * 3} étoiles de La Saga.`, 'Étoile de la Saga']], stars),
  ...tiers('Combat', '章', 'arcs', [[1, 'Premier arc', 'Termine un arc de La Saga.', 'Voyageur'], [STAGES.length / STAGES_PER_ARC, 'Fin de la Saga', 'Termine tous les arcs de La Saga.', 'Héros de la Saga']], arcs),
  ...tiers('Maîtrise', '力', 'level', [[25, 'Carte aguerrie', 'Monte une carte au niveau 25.', 'Entraîneur'], [50, 'Limite atteinte', 'Monte une carte au niveau 50.', 'Maître d’armes'], [100, 'Au-delà des limites', 'Monte une carte au niveau 100.', 'Sans limite']], best),
  ...tiers('Maîtrise', '解', 'freed', [[1, 'Chaînes brisées', 'Libère une carte.', 'Libérateur']], (s) => s.awakened.length),
  ...tiers('Maîtrise', '転', 'rebirth', [[1, 'Nouveau départ', 'Accomplis une Renaissance.', 'Revenant'], [3, 'Cycle sans fin', 'Accomplis 3 Renaissances.', 'Marcheur des failles']], (s) => s.rebirths),
]

export const DEFAULT_TITLE = 'Nouvel invocateur'
export const progressOf = (a: Achievement, s: AchState) => ({ value: Math.min(a.target, a.value(s)), done: a.value(s) >= a.target })
export const unlockedTitles = (s: AchState) => [DEFAULT_TITLE, ...ACHIEVEMENTS.filter((a) => a.value(s) >= a.target).map((a) => a.title)]
