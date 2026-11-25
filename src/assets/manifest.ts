// Registre central des illustrations.
// Chaque personnage a deux images dans src/assets/art/ :  <Modèle>-full.png (corps entier)  et  <Modèle>-bust.png (portrait).
// Pour remplacer une illustration : déposer un fichier du même nom dans ce dossier. Rien d'autre à modifier.

const files = import.meta.glob('./art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type ArtKind = 'full' | 'bust'

export const heroArt = (model: string, kind: ArtKind): string => files[`./art/${model}-${kind}.png`] ?? ''

const icons = import.meta.glob('./icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type IconName = 'gem' | 'ticket' | 'bolt'

export const iconArt = (name: IconName): string => icons[`./icons/${name}.png`] ?? ''

const frames = import.meta.glob('./frames/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Cadre 3D d'une rareté (rendu par tools/render-frames). L'image déborde de la carte : voir .card__frame.
export const frameArt = (rarity: string): string => frames[`./frames/${rarity}.png`] ?? ''

const logos = import.meta.glob('./logo/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Logo 3D (rendu par tools/render-logo) : 'full' = emblème + ANIME RIFT, 'emblem' = losange seul.
export const logoArt = (variant: 'full' | 'emblem'): string => logos[`./logo/${variant}.png`] ?? ''
