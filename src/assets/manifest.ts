// Registre central des illustrations.
// Chaque personnage a deux images dans src/assets/art/ :  <Modèle>-full.webp (corps entier)  et  <Modèle>-bust.webp (portrait).
// Pour remplacer une illustration : déposer un fichier du même nom dans ce dossier. Rien d'autre à modifier.

const files = import.meta.glob('./art/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type ArtKind = 'full' | 'bust'

export const heroArt = (model: string, kind: ArtKind): string => files[`./art/${model}-${kind}.webp`] ?? ''

const icons = import.meta.glob('./icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// seal = Sceau d'invocation (talisman), soul = Flamme d'âme (la monnaie), bolt = énergie. Dessinées dans Blender (tools/blender/build_icons.py).
export type IconName = 'soul' | 'seal' | 'bolt'

export const iconArt = (name: IconName): string => icons[`./icons/${name}.webp`] ?? ''

const logos = import.meta.glob('./logo/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Logo 3D (rendu par tools/render-logo) : 'full' = emblème + ANIME RIFT, 'emblem' = losange seul.
export const logoArt = (variant: 'full' | 'emblem'): string => logos[`./logo/${variant}.webp`] ?? ''

const frames = import.meta.glob('./frames/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Cadre d'une rareté, rendu avec Blender (tools/blender/build_frames.py). L'image déborde de la carte : voir .card__frame.
export const frameArt = (rarity: string): string => frames[`./frames/${rarity}.webp`] ?? ''

// Effets lumineux du même cadre (étoiles, arcs, flammes), rendus à part pour que le jeu puisse les animer.
export const frameFx = (rarity: string): string => frames[`./frames/${rarity}-fx.webp`] ?? ''

const ui = import.meta.glob('./ui/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Habillage de l'interface en style anime, dessiné dans Blender (tools/blender/build_ui.py).
export type UiName = 'bg' | 'btn-gold' | 'btn-pink' | 'btn-indigo' | 'btn-ghost' | 'panel' | 'nav-nexus' | 'nav-summon' | 'nav-cards'
export const uiArt = (name: UiName): string => ui[`./ui/${name}.webp`] ?? ''
