// Bannières d'invocation. Pour en ajouter une : copier un bloc et changer les valeurs.
// `featured` : personnages à l'affiche (1 chance sur 2 d'être choisis quand leur rareté sort).
export type Banner = { id: string; world: string; subtitle: string; glyph: string; hue: string; star: string; featured: string[]; endsAt: string }

export const BANNERS: Banner[] = [
  { id: 'rift', world: 'Les Enfants de la Faille', subtitle: "L'Écho Premier", glyph: '裂', hue: '#2bb7c9', star: 'lyss', featured: ['mirelle', 'lyss', 'ren'], endsAt: '2026-12-02T00:00:00Z' },
  { id: 'academy', world: 'Académie Hoshikage', subtitle: "Rentrée sous l'orage", glyph: '学', hue: '#e8502f', star: 'akane', featured: ['kaito', 'akane', 'ren'], endsAt: '2026-12-05T00:00:00Z' },
  { id: 'garden', world: "Jardin de l'Aube", subtitle: 'La Dernière Floraison', glyph: '花', hue: '#e07fb0', star: 'celestine', featured: ['poppy', 'celestine', 'shizu'], endsAt: '2026-12-09T00:00:00Z' },
]

export const PITY_MAX = 50 // une carte SSR, LR ou MR est garantie à la 50e invocation sans en avoir obtenu
export const COST = { ticket: 1, gems: 30 } // prix d'une invocation
