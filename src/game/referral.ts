// Lien de Faille (parrainage) : chaque ami VALIDÉ ouvre une case. Un ami est validé quand il atteint le niveau 5
// (vérifié par le serveur, fichier SQL 05) : on ne gagne rien avec des comptes vides créés pour tricher.
export type RefIcon = 'coffre' | 'eclats' | 'ticket_LR' | 'ticket_echange' | '2_tickets_echange' | '2_coffres' | 'coffre_2_tickets_LR'
export type RefGift = { gems?: number; chests?: number; lr?: number; trade?: number }
export type RefStep = { label: string; icon: RefIcon; gift: RefGift }
export const REFERRAL: RefStep[] = [
  { label: '1 coffre', icon: 'coffre', gift: { chests: 1 } },
  { label: '50 Éclats', icon: 'eclats', gift: { gems: 50 } },
  { label: '1 ticket LR garanti', icon: 'ticket_LR', gift: { lr: 1 } },
  { label: '1 ticket d’échange', icon: 'ticket_echange', gift: { trade: 1 } },
  { label: '1 coffre', icon: 'coffre', gift: { chests: 1 } },
  { label: '1 ticket LR garanti', icon: 'ticket_LR', gift: { lr: 1 } },
  { label: '100 Éclats', icon: 'eclats', gift: { gems: 100 } },
  { label: '2 tickets d’échange', icon: '2_tickets_echange', gift: { trade: 2 } },
  { label: '2 coffres', icon: '2_coffres', gift: { chests: 2 } },
  { label: '1 coffre + 2 tickets LR', icon: 'coffre_2_tickets_LR', gift: { chests: 1, lr: 2 } },
]
// Sans limite : dès le 11e filleul validé, 50 Éclats par palier, remplacés par 250 tous les 10 paliers (20, 30, 40…).
export const refStep = (step: number): RefStep => REFERRAL[step - 1] ?? (step % 10 === 0
  ? { label: '250 Éclats', icon: 'eclats', gift: { gems: 250 } }
  : { label: '50 Éclats', icon: 'eclats', gift: { gems: 50 } })
export const REFERRAL_MAIN = 10
export const VALID_LEVEL = 5
// Contenu d'un coffre : des Éclats, des Clés de Faille et une carte SR ou mieux.
export const CHEST = { gems: 150, tickets: 3 }
