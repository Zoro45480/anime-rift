import type { RarityId } from '../data/rarities'
import type { Reward } from './contracts'

// Calendrier de parrainage : une case s'ouvre pour chaque ami inscrit avec ton lien ; la 10e cache le plus gros lot.
export type RefStep = { label: string; reward: Reward; card?: RarityId }
export const REFERRAL: RefStep[] = [
  { label: '1 coffre', reward: { gems: 150, tickets: 2 } },
  { label: '200 Éclats', reward: { gems: 200 } },
  { label: '1 carte SSR garantie', reward: {}, card: 'ultra' },
  { label: '5 sceaux', reward: { tickets: 5 } },
  { label: '1 coffre', reward: { gems: 300, tickets: 3 } },
  { label: '1 carte SSR garantie', reward: {}, card: 'ultra' },
  { label: '500 Éclats', reward: { gems: 500 } },
  { label: '10 sceaux', reward: { tickets: 10 } },
  { label: '2 coffres', reward: { gems: 600, tickets: 6, shards: 10 } },
  { label: 'Coffre + carte SSR', reward: { gems: 1000, tickets: 10, shards: 20 }, card: 'ultra' },
]
