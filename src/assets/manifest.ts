// Registre central des illustrations.
// Chaque personnage a deux images dans src/assets/art/ :  <Modèle>-full.webp (corps entier)  et  <Modèle>-bust.webp (portrait).
// Pour remplacer une illustration : déposer un fichier du même nom dans ce dossier. Rien d'autre à modifier.

const files = import.meta.glob('./art/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type ArtKind = 'full' | 'bust'

// Renvoie '' pour un personnage sans illustration fournie (pas de `model`).
export const heroArt = (model: string | undefined, kind: ArtKind): string => (model ? files[`./art/${model}-${kind}.webp`] ?? '' : '')

const icons = import.meta.glob('./icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// seal = Sceau d'invocation (talisman), soul = Flamme d'âme (la monnaie), bolt = énergie. Dessinées dans Blender (tools/blender/build_icons.py).
export type IconName = 'soul' | 'seal' | 'bolt' | 'scroll-small' | 'scroll-medium' | 'scroll-large' | 'shard' // shard = Fragment d'âme (tools/blender/build_shard.py) ; parchemins : tools/blender/build_scrolls.py

export const iconArt = (name: IconName): string => icons[`./icons/${name}.webp`] ?? ''

const logos = import.meta.glob('./logo/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Logo 3D (rendu par tools/render-logo) : 'full' = emblème + ANIME RIFT, 'emblem' = losange seul.
export const logoArt = (variant: 'full' | 'emblem'): string => logos[`./logo/${variant}.webp`] ?? ''

const frames = import.meta.glob('./frames/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Cadre d'une rareté, rendu avec Blender (tools/blender/build_frames.py). L'image déborde de la carte : voir .card__frame.
// `theme` = famille de cadres de la bannière ; à défaut, on retombe sur les cadres d'origine.
const framesSm = import.meta.glob('./frames-sm/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
// `hd` : le grand cadre, réservé à la carte affichée en grand. Partout ailleurs, la petite version (tools/make_small_frames.py),
// six fois plus légère en mémoire : indispensable sur téléphone quand des dizaines de cartes sont à l'écran.
const pick = (name: string, theme: string, hd: boolean) => {
  const set = hd ? frames : framesSm
  const dir = hd ? './frames' : './frames-sm'
  return set[`${dir}/${theme}/${name}.webp`] ?? set[`${dir}/${name}.webp`] ?? ''
}
export const frameArt = (rarity: string, theme = 'naruto', hd = false): string => pick(rarity, theme, hd)

// Effets lumineux du même cadre (étoiles, arcs, flammes), rendus à part pour que le jeu puisse les animer.
export const frameFx = (rarity: string, theme = 'naruto', hd = false): string => pick(`${rarity}-fx`, theme, hd)

const ui = import.meta.glob('./ui/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Habillage de l'interface en style anime, dessiné dans Blender (tools/blender/build_ui.py).
export type UiName = 'bg' | 'btn-gold' | 'btn-pink' | 'btn-indigo' | 'btn-ghost' | 'panel' | 'nav-nexus' | 'nav-summon' | 'nav-cards' | 'nav-contracts' | 'nav-profile' | 'chest' | 'rift-path' | 'card-pack'
export const uiArt = (name: UiName): string => ui[`./ui/${name}.webp`] ?? ''

const gates = import.meta.glob('./gates/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Illustrations 3D des portes du Nexus et de la Renaissance (tools/blender/build_gates.py).
export const gateArt = (name: 'saga' | 'raids' | 'spire' | 'arena' | 'rebirth'): string => gates[`./gates/${name}.webp`] ?? ''

const digits = import.meta.glob('./digits/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Chiffres 3D dorés du niveau de compte, et le sigle « NV » (tools/blender/build_digits.py).
// Six styles : t0 acier, t1 or, t2 braise, t3 plasma, t4 légende, r arc-en-ciel (après une Renaissance).
export const digitArt = (style: string, glyph: string): string => digits[`./digits/${style}/${glyph}.webp`] ?? ''

const extras = import.meta.glob('./extras/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Bandeaux de titre (un par univers, inspiré de son animé), Kiri (planche de 16 images, 4×4) et micro du seiyū — rendus Blender (tools/blender/build_extras.py).
export const extraArt = (name: `ribbon-${string}` | `emblem-${string}` | `set-${string}` | `frame-${string}` | `dist-${string}` | 'guide' | 'mic'): string => extras[`./extras/${name}.webp`] ?? ''

const cosmetics = import.meta.glob('./cosmetics/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Objets d'apparence du profil, rendus Blender (tools/blender/build_cosmetics.py) : frame-, orn-, aura-, medal-, plate-.
export const cosmeticArt = (name: string): string => cosmetics[`./cosmetics/${name}.webp`] ?? ''
