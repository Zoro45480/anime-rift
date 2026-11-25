// Registre central des illustrations.
// Chaque personnage a deux images dans src/assets/art/ :  <Modèle>-full.png (corps entier)  et  <Modèle>-bust.png (portrait).
// Pour remplacer une illustration : déposer un fichier du même nom dans ce dossier. Rien d'autre à modifier.

const files = import.meta.glob('./art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type ArtKind = 'full' | 'bust'

export const heroArt = (model: string, kind: ArtKind): string => files[`./art/${model}-${kind}.png`] ?? ''

const icons = import.meta.glob('./icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export type IconName = 'gem' | 'ticket' | 'bolt'

export const iconArt = (name: IconName): string => icons[`./icons/${name}.png`] ?? ''
