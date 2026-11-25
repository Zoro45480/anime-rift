import type { AffinityId } from './affinities'
import type { RarityId } from './rarities'

// Casting original d'ANIME RIFT. `kana` = le nom en japonais, écrit à la verticale sur la carte.
// `model` désigne le modèle 3D (public/models) et ses illustrations (src/assets/art) ;
// un personnage sans `model` n'a pas d'illustration fournie : sa carte affiche son nom en japonais à la place.
export type Hero = { id: string; no: number; model?: string; name: string; kana: string; title: string; world: string; role: string; rarity: RarityId; affinity: AffinityId; atk: number; def: number }

export const HEROES: Hero[] = [
  // --- Naruto : 30 personnages, les plus puissants dans les raretés les plus hautes. Noms seuls : aucune image n'est
  //     fournie avec le jeu, le joueur ajoute les siennes dans la Collection (« Mon image »).
  { id: 'naruto', no: 1, name: 'Naruto Uzumaki', kana: 'ナルト', title: 'Septième Hokage', world: 'Naruto', role: 'Hybride', rarity: 'rift', affinity: 'wind', atk: 3000, def: 2900 },
  { id: 'sasuke', no: 2, name: 'Sasuke Uchiwa', kana: 'サスケ', title: 'Le Dernier Uchiwa', world: 'Naruto', role: 'Burst DPS', rarity: 'rift', affinity: 'thunder', atk: 3050, def: 2750 },
  { id: 'kaguya', no: 4, name: 'Kaguya Ôtsutsuki', kana: 'カグヤ', title: 'Déesse-Lapin', world: 'Naruto', role: 'Contrôle', rarity: 'legend', affinity: 'rift', atk: 2850, def: 2700 },
  { id: 'madara', no: 3, name: 'Madara Uchiwa', kana: 'マダラ', title: 'Le Spectre des Uchiwa', world: 'Naruto', role: 'DPS', rarity: 'rift', affinity: 'fire', atk: 3000, def: 2800 },
  { id: 'hashirama', no: 5, name: 'Hashirama Senju', kana: 'ハシラマ', title: 'Premier Hokage', world: 'Naruto', role: 'Tank', rarity: 'legend', affinity: 'earth', atk: 2600, def: 2900 },
  { id: 'obito', no: 6, name: 'Obito Uchiwa', kana: 'オビト', title: 'L’Homme au Masque', world: 'Naruto', role: 'Contre-attaque', rarity: 'legend', affinity: 'rift', atk: 2750, def: 2600 },
  { id: 'minato', no: 7, name: 'Minato Namikaze', kana: 'ミナト', title: 'L’Éclair Jaune', world: 'Naruto', role: 'Burst DPS', rarity: 'legend', affinity: 'light', atk: 2850, def: 2300 },
  { id: 'itachi', no: 8, name: 'Itachi Uchiwa', kana: 'イタチ', title: 'Le Corbeau', world: 'Naruto', role: 'Débuffeur', rarity: 'ultra', affinity: 'dark', atk: 2600, def: 2150 },
  { id: 'guy', no: 9, name: 'Gaï Maito', kana: 'ガイ', title: 'La Bête de Jade', world: 'Naruto', role: 'Burst DPS', rarity: 'ultra', affinity: 'fire', atk: 2700, def: 2000 },
  { id: 'kakashi', no: 10, name: 'Kakashi Hatake', kana: 'カカシ', title: 'Le Ninja Copieur', world: 'Naruto', role: 'Hybride', rarity: 'ultra', affinity: 'thunder', atk: 2500, def: 2250 },
  { id: 'jiraya', no: 11, name: 'Jiraya', kana: 'ジライヤ', title: 'L’Ermite des Crapauds', world: 'Naruto', role: 'Invocateur', rarity: 'ultra', affinity: 'earth', atk: 2450, def: 2350 },
  { id: 'pain', no: 12, name: 'Pain', kana: 'ペイン', title: 'Chef de l’Akatsuki', world: 'Naruto', role: 'Contrôle', rarity: 'ultra', affinity: 'rift', atk: 2650, def: 2200 },
  { id: 'tobirama', no: 13, name: 'Tobirama Senju', kana: 'トビラマ', title: 'Deuxième Hokage', world: 'Naruto', role: 'Support', rarity: 'epic', affinity: 'water', atk: 2250, def: 2100 },
  { id: 'hiruzen', no: 14, name: 'Hiruzen Sarutobi', kana: 'ヒルゼン', title: 'Troisième Hokage', world: 'Naruto', role: 'Hybride', rarity: 'epic', affinity: 'fire', atk: 2200, def: 2150 },
  { id: 'tsunade', no: 15, name: 'Tsunade', kana: 'ツナデ', title: 'Cinquième Hokage', world: 'Naruto', role: 'Soigneuse', rarity: 'epic', affinity: 'light', atk: 2000, def: 2400 },
  { id: 'orochimaru', no: 16, name: 'Orochimaru', kana: 'オロチマル', title: 'Le Serpent Blanc', world: 'Naruto', role: 'Débuffeur', rarity: 'epic', affinity: 'dark', atk: 2300, def: 2000 },
  { id: 'bee', no: 17, name: 'Killer Bee', kana: 'キラービー', title: 'Hôte de Hachibi', world: 'Naruto', role: 'Tank', rarity: 'epic', affinity: 'thunder', atk: 2350, def: 2200 },
  { id: 'gaara', no: 18, name: 'Gaara', kana: 'ガアラ', title: 'Cinquième Kazekage', world: 'Naruto', role: 'Tank', rarity: 'epic', affinity: 'earth', atk: 2150, def: 2450 },
  { id: 'sakura', no: 19, name: 'Sakura Haruno', kana: 'サクラ', title: 'Ninja Médecin', world: 'Naruto', role: 'Soigneuse', rarity: 'rare', affinity: 'light', atk: 1750, def: 1900 },
  { id: 'lee', no: 20, name: 'Rock Lee', kana: 'リー', title: 'Le Fauve de Konoha', world: 'Naruto', role: 'DPS', rarity: 'rare', affinity: 'wind', atk: 1950, def: 1600 },
  { id: 'neji', no: 21, name: 'Neji Hyûga', kana: 'ネジ', title: 'Le Prodige des Hyûga', world: 'Naruto', role: 'Contre-attaque', rarity: 'rare', affinity: 'light', atk: 1900, def: 1750 },
  { id: 'shikamaru', no: 22, name: 'Shikamaru Nara', kana: 'シカマル', title: 'Le Stratège', world: 'Naruto', role: 'Contrôle', rarity: 'rare', affinity: 'dark', atk: 1650, def: 1850 },
  { id: 'hinata', no: 23, name: 'Hinata Hyûga', kana: 'ヒナタ', title: 'Princesse du Byakugan', world: 'Naruto', role: 'Support', rarity: 'rare', affinity: 'light', atk: 1700, def: 1800 },
  { id: 'kisame', no: 24, name: 'Kisame Hoshigaki', kana: 'キサメ', title: 'Le Bijû sans Queue', world: 'Naruto', role: 'DPS', rarity: 'rare', affinity: 'water', atk: 2000, def: 1850 },
  { id: 'kiba', no: 25, name: 'Kiba Inuzuka', kana: 'キバ', title: 'Maître-Chien', world: 'Naruto', role: 'DPS', rarity: 'common', affinity: 'earth', atk: 1500, def: 1300 },
  { id: 'shino', no: 26, name: 'Shino Aburame', kana: 'シノ', title: 'Maître des Insectes', world: 'Naruto', role: 'Débuffeur', rarity: 'common', affinity: 'dark', atk: 1400, def: 1450 },
  { id: 'choji', no: 27, name: 'Chôji Akimichi', kana: 'チョウジ', title: 'Le Papillon', world: 'Naruto', role: 'Tank', rarity: 'common', affinity: 'earth', atk: 1450, def: 1600 },
  { id: 'ino', no: 28, name: 'Ino Yamanaka', kana: 'イノ', title: 'Télépathe', world: 'Naruto', role: 'Support', rarity: 'common', affinity: 'wind', atk: 1300, def: 1400 },
  { id: 'tenten', no: 29, name: 'Tenten', kana: 'テンテン', title: 'Maîtresse d’Armes', world: 'Naruto', role: 'DPS', rarity: 'common', affinity: 'wind', atk: 1500, def: 1250 },
  { id: 'iruka', no: 30, name: 'Iruka Umino', kana: 'イルカ', title: 'Professeur de l’Académie', world: 'Naruto', role: 'Support', rarity: 'common', affinity: 'water', atk: 1250, def: 1500 },
  // --- Personnages originaux d'ANIME RIFT (avec leur modèle 3D)
  { id: 'lyss', no: 31, model: 'Vita', name: 'Lyss', kana: 'リス', title: 'Écho Premier', world: 'Enfants de la Faille', role: 'Hybride', rarity: 'rift', affinity: 'rift', atk: 2950, def: 3000 },
  { id: 'mirelle', no: 32, model: 'Darkness_Shibu', name: 'Mirelle', kana: 'ミレル', title: 'Dame du Crépuscule', world: 'Enfants de la Faille', role: 'Contrôle', rarity: 'legend', affinity: 'dark', atk: 2900, def: 2130 },
  { id: 'celestine', no: 33, model: 'Victoria_Rubin', name: 'Célestine', kana: 'セレスティーヌ', title: "Chant de l'Aube", world: "Jardin de l'Aube", role: 'Soigneuse', rarity: 'ultra', affinity: 'light', atk: 2100, def: 2850 },
  { id: 'ren', no: 34, model: 'Sakurada_Fumiriya', name: 'Ren', kana: 'レン', title: 'Lame Tranquille', world: 'Académie Hoshikage', role: 'DPS', rarity: 'epic', affinity: 'wind', atk: 2450, def: 1700 },
  { id: 'akane', no: 35, model: 'Sendagaya_Shibu', name: 'Akane', kana: 'アカネ', title: 'Étincelle Vive', world: 'Académie Hoshikage', role: 'Burst DPS', rarity: 'rare', affinity: 'fire', atk: 2600, def: 1450 },
  { id: 'poppy', no: 36, model: 'Vivi', name: 'Poppy', kana: 'ポピー', title: 'Herboriste', world: "Jardin de l'Aube", role: 'Support', rarity: 'rare', affinity: 'earth', atk: 1500, def: 2400 },
  { id: 'shizu', no: 37, model: 'Sendagaya_Shino', name: 'Shizu', kana: 'シズ', title: 'Marée Calme', world: 'Académie Hoshikage', role: 'Contre-attaque', rarity: 'common', affinity: 'water', atk: 1700, def: 1900 },
  { id: 'kaito', no: 38, model: 'HairSample_Male', name: 'Kaito', kana: 'カイト', title: 'Orage Discret', world: 'Académie Hoshikage', role: 'Débuffeur', rarity: 'common', affinity: 'thunder', atk: 1850, def: 1600 },
]

export const heroById = (id: string): Hero => HEROES.find((h) => h.id === id)!
