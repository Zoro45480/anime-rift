import { BANNERS } from '../data/banners'
import { HEROES } from '../data/heroes'
import type { Quests } from './contracts'
import { accountLevel, levelFromXp, MAX_LEVEL } from './progression'
import { tierOf, type PathState } from './riftpath'
import { STAGES, STAGES_PER_ARC } from './saga'

// Succès : des objectifs calculés sur la partie réelle, en 8 catégories. Chaque succès obtenu débloque un titre
// à afficher sur le profil, et une médaille 3D (forme = catégorie, métal = rareté du succès).
export type AchState = {
  owned: Record<string, number>; xp: Record<string, number>; saga: Record<string, number>; awakened: string[]; rebirths: number; pulls: number; wins: number
  gemsSpent: number; accountXp: number; quests: Quests; spire: { best: number }; path: PathState; seen: { days: number }; arena?: { wins: number; best: number }
}
export const GROUPS = ['Collection', 'Univers', 'Invocations', 'Aventure', 'La Spire', 'Contrats', 'Maîtrise', 'Ancienneté'] as const
export type Group = (typeof GROUPS)[number]
export type Metal = 'bronze' | 'silver' | 'gold' | 'prism'
export const METAL_LABEL: Record<Metal, string> = { bronze: 'Commun', silver: 'Rare', gold: 'Épique', prism: 'Légendaire' }
export type Achievement = { id: string; group: Group; kanji: string; name: string; goal: string; title: string; target: number; metal: Metal; value: (s: AchState) => number }

const count = (s: AchState, test: (id: string) => boolean) => Object.keys(s.owned).filter((id) => s.owned[id] > 0 && test(id)).length
const rarityOf = new Map(HEROES.map((h) => [h.id, h.rarity]))
const worldOf = new Map(HEROES.map((h) => [h.id, h.world]))
const stars = (s: AchState) => Object.values(s.saga).reduce((a, b) => a + b, 0)
const arcs = (s: AchState) => STAGES.filter((st) => st.boss && (s.saga[st.id] ?? 0) > 0).length
const best = (s: AchState) => Math.max(0, ...Object.keys(s.owned).filter((id) => s.owned[id] > 0).map((id) => levelFromXp(s.xp[id] ?? 0, s.awakened.includes(id) ? MAX_LEVEL : 50).level))
const worldDone = (s: AchState, world: string) => HEROES.filter((h) => h.world === world).every((h) => (s.owned[h.id] ?? 0) > 0)
const life = (s: AchState, k: keyof Quests['life']) => s.quests?.life?.[k] ?? 0

// Une suite de paliers : le premier est Commun, puis Rare, Épique, et le dernier d'une longue suite est Légendaire.
const tiers = (group: Group, kanji: string, base: string, steps: [number, string, string, string][], value: Achievement['value']): Achievement[] =>
  steps.map(([target, name, goal, title], i) => {
    const last = i === steps.length - 1
    const metal: Metal = steps.length === 1 ? 'gold' : last && steps.length >= 4 ? 'prism' : last ? 'gold' : i === 0 ? 'bronze' : i >= steps.length - 2 && steps.length >= 4 ? 'gold' : 'silver'
    return { id: `${base}-${target}`, group, kanji, name, goal, title, target, value, metal }
  })
const one = (group: Group, kanji: string, id: string, name: string, goal: string, title: string, target: number, metal: Metal, value: Achievement['value']): Achievement =>
  ({ id, group, kanji, name, goal, title, target, metal, value })

const ARCS = STAGES.length / STAGES_PER_ARC

export const ACHIEVEMENTS: Achievement[] = [
  // ── Collection (10)
  ...tiers('Collection', '集', 'cards', [[10, 'Premiers pas de collectionneur', 'Possède 10 personnages différents.', 'Collectionneur'], [50, 'Classeur bien rempli', 'Possède 50 personnages différents.', 'Archiviste'],
    [150, 'Grande galerie', 'Possède 150 personnages différents.', 'Conservateur'], [300, 'Musée vivant', 'Possède 300 personnages différents.', 'Curateur'], [500, 'Mémoire des mondes', 'Possède 500 personnages différents.', 'Gardien des mondes'],
    [HEROES.length, 'Tout l’Index', `Possède les ${HEROES.length} personnages.`, 'Omniscient']], (s) => count(s, () => true)),
  ...tiers('Collection', '光', 'legend', [[1, 'Éclat légendaire', 'Possède une carte LR ou MR.', 'Élu de la faille'], [5, 'Constellation', 'Possède 5 cartes LR ou MR.', 'Porteur de légendes'], [15, 'Panthéon', 'Possède 15 cartes LR ou MR.', 'Maître du panthéon']],
    (s) => count(s, (id) => rarityOf.get(id) === 'legend' || rarityOf.get(id) === 'rift')),
  one('Collection', '神', 'mythic-1', 'Le mythe existe', 'Possède une carte MR.', 'Témoin du mythe', 1, 'prism', (s) => count(s, (id) => rarityOf.get(id) === 'rift')),
  // ── Univers (9)
  one('Univers', '界', 'worlds-touch', 'Touche-à-tout', 'Possède au moins une carte de chaque univers.', 'Voyageur des mondes', BANNERS.length, 'bronze', (s) => BANNERS.filter((b) => count(s, (id) => worldOf.get(id) === b.world) > 0).length),
  ...BANNERS.map((b) => one('Univers', '界', `world-${b.id}`, `Maître de ${b.world}`, `Possède toutes les cartes de ${b.world}.`, `Maître de ${b.world}`, HEROES.filter((h) => h.world === b.world).length, 'gold',
    (s) => count(s, (id) => worldOf.get(id) === b.world))),
  one('Univers', '界', 'worlds-all', 'Tous les univers', 'Complète les 7 univers.', 'Souverain du Rift', BANNERS.length, 'prism', (s) => BANNERS.filter((b) => worldDone(s, b.world)).length),
  // ── Invocations (8)
  ...tiers('Invocations', '召', 'pulls', [[10, 'Premier rituel', 'Réalise 10 invocations.', 'Invocateur'], [50, 'Appel régulier', 'Réalise 50 invocations.', 'Appelant'], [100, 'Habitué de la faille', 'Réalise 100 invocations.', 'Grand invocateur'],
    [250, 'Torrent d’âmes', 'Réalise 250 invocations.', 'Tisseur de failles'], [500, 'Faille grande ouverte', 'Réalise 500 invocations.', 'Maître des failles'], [1000, 'Mille appels', 'Réalise 1 000 invocations.', 'Voix du Rift']], (s) => s.pulls),
  ...tiers('Invocations', '魂', 'spent', [[1000, 'Offrande', 'Dépense 1 000 âmes.', 'Généreux'], [10000, 'Grande offrande', 'Dépense 10 000 âmes.', 'Mécène des failles']], (s) => s.gemsSpent),
  // ── Aventure (10)
  ...tiers('Aventure', '闘', 'wins', [[10, 'Échauffement', 'Gagne 10 combats.', 'Combattant'], [50, 'Rodé', 'Gagne 50 combats.', 'Guerrier'], [100, 'Vétéran', 'Gagne 100 combats.', 'Vétéran'],
    [250, 'Inarrêtable', 'Gagne 250 combats.', 'Champion'], [500, 'Invaincu', 'Gagne 500 combats.', 'Seigneur de guerre']], (s) => s.wins),
  ...tiers('Aventure', '星', 'stars', [[15, 'Arc parfait', 'Gagne 15 étoiles dans La Saga.', 'Chasseur d’étoiles'], [60, 'Ciel étoilé', 'Gagne 60 étoiles dans La Saga.', 'Astronome'],
    [STAGES.length * 3, 'Toutes les étoiles', `Gagne les ${STAGES.length * 3} étoiles de La Saga.`, 'Étoile de la Saga']], stars),
  ...tiers('Aventure', '章', 'arcs', [[1, 'Premier arc', 'Termine un arc de La Saga.', 'Voyageur'], [ARCS, 'Fin de la Saga', 'Termine tous les arcs de La Saga.', 'Héros de la Saga']], arcs),
  ...tiers('Aventure', '闘', 'arena', [[10, 'Gladiateur', 'Gagne 10 duels d’arène.', 'Gladiateur'], [50, 'Duelliste émérite', 'Gagne 50 duels d’arène.', 'Duelliste émérite']], (s) => s.arena?.wins ?? 0),
  one('Aventure', '闘', 'league-gold', 'Ligue Or', 'Atteins la ligue Or en arène (1 250).', 'Lame d’or', 1250, 'silver', (s) => s.arena?.best ?? 0),
  one('Aventure', '闘', 'league-diamond', 'Ligue Diamant', 'Atteins la ligue Diamant (1 700).', 'Éclat de diamant', 1700, 'gold', (s) => s.arena?.best ?? 0),
  one('Aventure', '闘', 'league-legend', 'Légende de l’Arène', 'Atteins la ligue Légende (2 000).', 'Légende de l’Arène', 2000, 'prism', (s) => s.arena?.best ?? 0),
  // ── La Spire (7)
  ...tiers('La Spire', '塔', 'spire', [[1, 'Premier étage', 'Franchis l’étage 1 de La Spire.', 'Grimpeur'], [5, 'Cinq marches', 'Atteins l’étage 5.', 'Alpiniste'], [10, 'Premier gardien', 'Bats le gardien de l’étage 10.', 'Tueur de gardien'],
    [20, 'Au-dessus des nuages', 'Atteins l’étage 20.', 'Habitant des cimes'], [30, 'Vertige', 'Atteins l’étage 30.', 'Sans vertige'], [50, 'Cœur de la Spire', 'Atteins l’étage 50.', 'Seigneur de la Spire'],
    [75, 'Sommet invisible', 'Atteins l’étage 75.', 'Celui qui touche le ciel']], (s) => s.spire?.best ?? 0),
  // ── Contrats (8)
  ...tiers('Contrats', '約', 'dailies', [[7, 'Une semaine fidèle', 'Récupère 7 récompenses du jour.', 'Fidèle'], [30, 'Un mois fidèle', 'Récupère 30 récompenses du jour.', 'Assidu'], [100, 'Cent levers de soleil', 'Récupère 100 récompenses du jour.', 'Pilier du Rift']], (s) => life(s, 'dailies')),
  ...tiers('Contrats', '約', 'claims', [[10, 'Homme de parole', 'Récupère 10 contrats.', 'Contractant'], [50, 'Carnet chargé', 'Récupère 50 contrats.', 'Mercenaire'], [200, 'Contrats à la chaîne', 'Récupère 200 contrats.', 'Agent du Rift']], (s) => life(s, 'claims')),
  ...tiers('Contrats', '道', 'path', [[10, 'Sur le Chemin', 'Atteins le palier 10 du Chemin du Rift.', 'Pèlerin'], [40, 'Bout du Chemin', 'Atteins le palier 40 du Chemin du Rift.', 'Marcheur du Rift']], (s) => (s.path ? tierOf(s.path.xp) : 0)),
  // ── Maîtrise (11)
  ...tiers('Maîtrise', '力', 'level', [[10, 'Premiers progrès', 'Monte une carte au niveau 10.', 'Apprenti'], [25, 'Carte aguerrie', 'Monte une carte au niveau 25.', 'Entraîneur'], [50, 'Limite atteinte', 'Monte une carte au niveau 50.', 'Maître d’armes'],
    [75, 'Au-delà', 'Monte une carte au niveau 75.', 'Sensei'], [100, 'Au-delà des limites', 'Monte une carte au niveau 100.', 'Sans limite']], best),
  ...tiers('Maîtrise', '合', 'merges', [[10, 'Fusionneur', 'Fusionne 10 doublons.', 'Alchimiste'], [100, 'Grand creuset', 'Fusionne 100 doublons.', 'Grand alchimiste']], (s) => life(s, 'merges')),
  ...tiers('Maîtrise', '解', 'freed', [[1, 'Chaînes brisées', 'Libère une carte.', 'Libérateur'], [5, 'Libération', 'Libère 5 cartes.', 'Briseur de chaînes']], (s) => s.awakened.length),
  ...tiers('Maîtrise', '転', 'rebirth', [[1, 'Nouveau départ', 'Accomplis une Renaissance.', 'Revenant'], [3, 'Cycle sans fin', 'Accomplis 3 Renaissances.', 'Marcheur des failles']], (s) => s.rebirths),
  // ── Ancienneté (9)
  ...tiers('Ancienneté', '時', 'days', [[3, 'On revient', 'Joue 3 jours différents.', 'Habitué'], [7, 'Une semaine au Rift', 'Joue 7 jours différents.', 'Résident'], [14, 'Deux semaines', 'Joue 14 jours différents.', 'Citoyen du Rift'],
    [30, 'Un mois de Rift', 'Joue 30 jours différents.', 'Ancien'], [60, 'Deux mois', 'Joue 60 jours différents.', 'Doyen'], [100, 'Cent jours', 'Joue 100 jours différents.', 'Légende vivante']], (s) => s.seen?.days ?? 0),
  ...tiers('Ancienneté', '昇', 'account', [[10, 'Niveau 10', 'Atteins le niveau de compte 10.', 'Initié'], [25, 'Niveau 25', 'Atteins le niveau de compte 25.', 'Confirmé'], [50, 'Niveau 50', 'Atteins le niveau de compte 50.', 'Expert']],
    (s) => accountLevel(s.accountXp, s.rebirths).level),
]

export const DEFAULT_TITLE = 'Nouvel invocateur'
export const progressOf = (a: Achievement, s: AchState) => ({ value: Math.min(a.target, a.value(s)), done: a.value(s) >= a.target })
export const doneIds = (s: AchState) => ACHIEVEMENTS.filter((a) => a.value(s) >= a.target).map((a) => a.id)
export const unlockedTitles = (s: AchState) => [DEFAULT_TITLE, ...ACHIEVEMENTS.filter((a) => a.value(s) >= a.target).map((a) => a.title)]

// Médaille 3D d'un succès : la forme suit sa catégorie, le métal sa rareté.
const SHAPE: Record<Group, string> = { Collection: 'gem', Univers: 'orb', Invocations: 'portal', Aventure: 'swords', 'La Spire': 'tower', Contrats: 'scroll', 'Maîtrise': 'shield', 'Ancienneté': 'hourglass' }
export const medalOf = (a: Achievement) => `medal-${SHAPE[a.group]}-${a.metal}`
