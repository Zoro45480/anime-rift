// Apparence du profil : cadres, ornements, effets, couleurs, thèmes et titres. Certains objets sont offerts, d'autres se
// gagnent (niveau de compte, arc de L’Aventure terminé, Ascension), les autres s'achètent en Éclats. Fonctions pures, testées.
export type CosmeticKind = 'frame' | 'ornament' | 'aura' | 'effect' | 'color' | 'theme' | 'title'
export type Rarity = 'common' | 'rare' | 'epic' | 'legend' | 'mythic'
export type Cosmetic = { id: string; kind: CosmeticKind; name: string; price: number; value: string; rarity: Rarity; needLevel?: number; needRebirth?: boolean; needArc?: string }
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique', legend: 'Légendaire', mythic: 'Mythique' }
export const RARITY_HUE: Record<Rarity, string> = { common: '#9aa6c8', rare: '#4f8dff', epic: '#a56bff', legend: '#ffc94d', mythic: '#ff4d6d' }

const c = (kind: CosmeticKind, key: string, name: string, price: number, rarity: Rarity, value = key, extra: Partial<Cosmetic> = {}): Cosmetic => ({ id: `${kind}:${key}`, kind, name, price, value, rarity, ...extra })
const ANIME: [string, string][] = [['naruto', 'Naruto'], ['onepiece', 'One Piece'], ['dragonball', 'Dragon Ball'], ['bleach', 'Bleach'], ['demonslayer', 'Demon Slayer'], ['jujutsu', 'Jujutsu Kaisen'], ['hunter', 'Hunter x Hunter']]

export const COSMETICS: Cosmetic[] = [
  // ── Cadres (25) : ceux du niveau, ceux des animés (offerts en finissant leur arc), puis les cadres de style
  c('frame', 't0', 'Acier', 0, 'common'),
  c('frame', 't1', 'Or', 200, 'rare', 't1', { needLevel: 25 }),
  c('frame', 't2', 'Braise', 500, 'epic', 't2', { needLevel: 50 }),
  c('frame', 't3', 'Plasma', 1000, 'epic', 't3', { needLevel: 75 }),
  c('frame', 't4', 'Légende', 2500, 'legend', 't4', { needLevel: 100 }),
  c('frame', 'r', 'Arc-en-ciel', 0, 'mythic', 'r', { needRebirth: true }),
  ...ANIME.map(([id, name]) => c('frame', id, name, 600, 'epic', id, { needArc: id })),
  c('frame', 'ice', 'Givre', 300, 'rare'), c('frame', 'emerald', 'Émeraude', 300, 'rare'), c('frame', 'ocean', 'Océan', 300, 'rare'),
  c('frame', 'sakura', 'Sakura', 450, 'epic'), c('frame', 'toxic', 'Toxique', 450, 'epic'), c('frame', 'thunder', 'Tonnerre', 450, 'epic'),
  c('frame', 'lava', 'Lave', 700, 'epic'), c('frame', 'shadow', 'Ombre', 700, 'epic'), c('frame', 'royal', 'Royal', 900, 'legend'),
  c('frame', 'galaxy', 'Galaxie', 1200, 'legend'), c('frame', 'blood', 'Sang', 1200, 'legend'), c('frame', 'celestial', 'Céleste', 2000, 'mythic'),
  // ── Ornements (15), posés par-dessus le cadre
  c('ornament', 'catears', 'Oreilles de chat', 150, 'rare'), c('ornament', 'stars', 'Étoiles', 150, 'rare'), c('ornament', 'sakura', 'Pétales', 200, 'rare'),
  c('ornament', 'chains', 'Chaînes', 250, 'rare'), c('ornament', 'kunai', 'Kunais croisés', 300, 'epic'), c('ornament', 'dragonballs', 'Sept boules', 300, 'epic'),
  c('ornament', 'horns', 'Cornes', 300, 'epic'), c('ornament', 'lightning', 'Éclairs', 350, 'epic'), c('ornament', 'flames', 'Flammes', 400, 'epic'),
  c('ornament', 'orbit', 'Orbites', 400, 'epic'), c('ornament', 'laurel', 'Lauriers', 500, 'legend'), c('ornament', 'halo', 'Auréole', 600, 'legend'),
  c('ornament', 'wings', 'Ailes d’ange', 800, 'legend'), c('ornament', 'demonwings', 'Ailes de démon', 800, 'legend'), c('ornament', 'crown', 'Couronne', 1500, 'mythic'),
  // ── Effets : auras animées autour du cadre (6)…
  c('aura', 'spark', 'Aura d’étincelles', 250, 'rare'), c('aura', 'frost', 'Aura de givre', 350, 'epic'), c('aura', 'shadow', 'Aura d’ombre', 350, 'epic'),
  c('aura', 'volt', 'Aura électrique', 450, 'epic'), c('aura', 'fire', 'Aura de feu', 600, 'legend'), c('aura', 'rainbow', 'Aura arc-en-ciel', 1200, 'mythic'),
  // …et effets du pseudo (7)
  c('effect', 'none', 'Sans effet', 0, 'common'), c('effect', 'glow', 'Halo', 120, 'rare'), c('effect', 'ice', 'Givre', 150, 'rare'), c('effect', 'shadow', 'Ombre', 150, 'rare'),
  c('effect', 'pulse', 'Pulsation', 200, 'epic'), c('effect', 'flame', 'Flamme', 300, 'epic'), c('effect', 'gold', 'Reflet doré', 500, 'legend'),
  // ── Couleurs du pseudo (17)
  c('color', 'white', 'Blanc', 0, 'common', '#ffffff'), c('color', 'silver', 'Argent', 40, 'common', '#c9d3ea'), c('color', 'gold', 'Or', 60, 'rare', '#ffd24d'),
  c('color', 'crimson', 'Écarlate', 60, 'rare', '#ff5d7a'), c('color', 'orange', 'Orange', 60, 'rare', '#ff9a3d'), c('color', 'lime', 'Citron vert', 60, 'rare', '#b6f36a'),
  c('color', 'jade', 'Jade', 60, 'rare', '#4be3a4'), c('color', 'cyan', 'Cyan', 60, 'rare', '#5ee6ff'), c('color', 'sky', 'Azur', 60, 'rare', '#5aa8ff'),
  c('color', 'violet', 'Violet', 60, 'rare', '#b78bff'), c('color', 'magenta', 'Magenta', 60, 'rare', '#ff5de0'), c('color', 'rose', 'Rose', 60, 'rare', '#ff8fd0'),
  c('color', 'blood', 'Sang', 100, 'epic', '#d21f3c'), c('color', 'sunset', 'Crépuscule', 250, 'epic', 'linear-gradient(90deg, #ff5d7a, #ffb347)'),
  c('color', 'aurora', 'Aurore', 250, 'epic', 'linear-gradient(90deg, #4be3a4, #5ee6ff, #b78bff)'), c('color', 'ember', 'Braise', 250, 'epic', 'linear-gradient(180deg, #ffe07a, #ff5a2a)'),
  c('color', 'rainbow', 'Arc-en-ciel', 400, 'legend', 'rainbow'),
  // ── Thèmes de la page (14)
  c('theme', 'rift', 'Faille', 0, 'common', '#7d5cff'), c('theme', 'ember', 'Braise', 150, 'rare', '#ff6a3d'), c('theme', 'ocean', 'Océan', 150, 'rare', '#2bb7ff'),
  c('theme', 'jade', 'Jade', 150, 'rare', '#35d69a'), c('theme', 'royal', 'Royal', 150, 'rare', '#ffc94d'), c('theme', 'rose', 'Sakura', 150, 'rare', '#ff7ab8'),
  c('theme', 'blood', 'Sang', 150, 'rare', '#e0263f'), c('theme', 'snow', 'Neige', 150, 'rare', '#c9e4ff'),
  ...ANIME.map(([id, name], i) => c('theme', id, name, 250, 'epic', ['#e8721f', '#1f8fd0', '#ff9d1c', '#e23b4e', '#2fbf8a', '#7a5cff', '#3fbf5a'][i], { needArc: id })).slice(0, 6),
  // ── Titres vendus en boutique (24). Les autres titres se gagnent avec les succès.
  ...([['Otaku', 30, 'common'], ['Kôhai', 30, 'common'], ['Senpai', 60, 'common'], ['Nakama', 60, 'common'], ['Rival', 60, 'common'], ['Chanceux', 80, 'rare'], ['Malchanceux', 80, 'rare'],
    ['Ninja de l’ombre', 120, 'rare'], ['Pirate', 120, 'rare'], ['Guerrier Saiyan', 120, 'rare'], ['Shinigami', 120, 'rare'], ['Pourfendeur', 120, 'rare'], ['Exorciste', 120, 'rare'], ['Hunter', 120, 'rare'],
    ['Stratège', 200, 'epic'], ['Sensei', 200, 'epic'], ['Protagoniste', 300, 'epic'], ['Antagoniste', 300, 'epic'], ['Collectionneur fou', 300, 'epic'], ['Roi du gacha', 600, 'legend'],
    ['Maître du Nexus', 800, 'legend'], ['Légende vivante', 1000, 'legend'], ['Élu du destin', 2500, 'mythic'], ['Dieu de la faille', 5000, 'mythic']] as [string, number, Rarity][])
    .map(([name, price, rarity], i) => c('title', `shop${i}`, name, price, rarity, name)),
]
export const cosmeticById = (id: string) => COSMETICS.find((x) => x.id === id)

// Ce que le joueur a : objets achetés, niveau de compte, Ascensions, arcs de L’Aventure terminés (identifiants de bannière).
export type Owned = { bought: string[]; level: number; rebirths: number; arcs: string[] }
export const hasCosmetic = (x: Cosmetic, o: Owned) =>
  o.bought.includes(x.id) || (x.needRebirth ? o.rebirths > 0 : (x.price === 0 && !x.needArc) || (x.needLevel !== undefined && o.level >= x.needLevel) || (x.needArc !== undefined && o.arcs.includes(x.needArc)))
// Peut-on l'acheter ? (les objets d’Ascension ne se vendent pas)
export const canBuy = (x: Cosmetic, o: Owned, gems: number) => !x.needRebirth && x.price > 0 && !hasCosmetic(x, o) && gems >= x.price
export const howToGet = (x: Cosmetic) =>
  x.needRebirth ? 'Après une Ascension' : x.needLevel ? `Niveau ${x.needLevel} ou ${x.price} Éclats` : x.needArc ? `Arc terminé ou ${x.price} Éclats` : `${x.price} Éclats`
