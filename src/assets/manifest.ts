// Registre central des ressources graphiques.
// Pour remplacer une illustration temporaire : déposer l'image dans public/art/
// puis ajouter une ligne ici, ex.  'hero.kael.card': '/art/kael-card.webp'
// Tant qu'une clé est absente, le jeu dessine l'illustration temporaire générée.

export type AssetKey = string

const IMAGES: Record<AssetKey, string> = {}

export const resolveImage = (key: AssetKey): string | undefined => IMAGES[key]
