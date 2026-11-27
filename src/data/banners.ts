// Bannières d'invocation. Pour en ajouter une : copier un bloc et changer les valeurs.
// `pool` : univers dont les personnages peuvent sortir de ce Portail.
// `frame` : famille de cadres des cartes de ce Portail (dossier dans src/assets/frames ; 'naruto' = les cadres d'origine).
// `featured` : personnages à l'affiche (1 chance sur 2 d'être choisis quand leur rareté sort).
export type Banner = { id: string; world: string; subtitle: string; glyph: string; hue: string; frame: string; star: string; featured: string[]; pool: string[]; endsAt: string }

export const BANNERS: Banner[] = [
  { id: 'naruto', world: 'Naruto', subtitle: 'La Volonté du Feu', glyph: '忍', hue: '#e8721f', frame: 'naruto', star: 'naruto', featured: ['sasuke', 'naruto', 'madara'], pool: ['Naruto'], endsAt: '2026-12-12T00:00:00Z' },
  { id: 'onepiece', world: 'One Piece', subtitle: 'L’Ère des Pirates', glyph: '海', hue: '#1f8fd0', frame: 'onepiece', star: 'luffy', featured: ['roger', 'luffy', 'teach'], pool: ['One Piece'], endsAt: '2026-12-14T00:00:00Z' },
  { id: 'dragonball', world: 'Dragon Ball', subtitle: 'Au-delà des Dieux', glyph: '龍', hue: '#f08a1c', frame: 'dragonball', star: 'goku', featured: ['vegeta', 'goku', 'gogeta'], pool: ['Dragon Ball'], endsAt: '2026-12-16T00:00:00Z' },
  { id: 'bleach', world: 'Bleach', subtitle: 'La Guerre Sanglante', glyph: '死', hue: '#8f7cf0', frame: 'bleach', star: 'ichigo', featured: ['yhwach', 'ichigo', 'ichibe'], pool: ['Bleach'], endsAt: '2026-12-18T00:00:00Z' },
  { id: 'demonslayer', world: 'Demon Slayer', subtitle: 'La Forteresse Infinie', glyph: '鬼', hue: '#2fa37a', frame: 'demonslayer', star: 'yoriichi', featured: ['muzan', 'yoriichi', 'tanjiro_king'], pool: ['Demon Slayer'], endsAt: '2026-12-20T00:00:00Z' },
  { id: 'jujutsu', world: 'Jujutsu Kaisen', subtitle: 'Le Drame de Shibuya', glyph: '呪', hue: '#4b5bd6', frame: 'jujutsu', star: 'gojo', featured: ['sukuna', 'gojo', 'yuki'], pool: ['Jujutsu Kaisen'], endsAt: '2026-12-22T00:00:00Z' },
  { id: 'hunter', world: 'Hunter x Hunter', subtitle: 'Les Fourmis-Chimères', glyph: '狩', hue: '#3aa655', frame: 'hunter', star: 'meruem', featured: ['netero', 'meruem', 'nanika'], pool: ['Hunter x Hunter'], endsAt: '2026-12-24T00:00:00Z' },
]

export const PITY_MAX = 50 // une carte SSR, LR ou MR est garantie à la 50e invocation sans en avoir obtenu
export const BIG_PITY = 30 // grande garantie : une carte MR au 30e multi ×10 d'une bannière sans MR
export const COST = { ticket: 1, gems: 30 } // prix d'une invocation

// Famille de cadres d'un personnage : celle du Portail de son univers.
export const frameOf = (world: string): string => BANNERS.find((b) => b.pool.includes(world))?.frame ?? 'naruto'
