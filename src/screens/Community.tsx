import { useState } from 'react'
import { extraArt, uiArt } from '../assets/manifest'
import { HEROES } from '../data/heroes'
import { ACHIEVEMENTS, progressOf } from '../game/achievements'
import { leagueOf } from '../game/arena'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { Avatar } from '../ui/Settings'

export type CommunityTab = 'social' | 'guild' | 'fame' | 'referral'
export const COMMUNITY: [CommunityTab, string][] = [['social', 'Social'], ['guild', 'Guilde'], ['fame', 'Panthéon'], ['referral', 'Parrainage']]
const n = (x: number) => x.toLocaleString('fr-FR')

// Ce que chaque partie contiendra une fois le jeu en ligne. Rien n'est inventé : pas de faux joueurs.
const SOON: Record<Exclude<CommunityTab, 'fame'>, { title: string; lede: string; points: string[]; icon: string }> = {
  social: { title: 'Social', lede: 'Tes amis, tes messages et tes échanges de cartes.', icon: uiArt('nav-profile'), points: ['Ajouter des amis par pseudo#tag et voir qui est en ligne', 'Messagerie privée, avec le réglage « qui peut m’écrire »', 'Proposer un échange de cartes équitable depuis le profil d’un ami'] },
  guild: { title: 'Guilde', lede: 'Rejoins un Ordre et affrontez ensemble le boss de la semaine.', icon: uiArt('rift-path'), points: ['Créer ou rejoindre un Ordre (nom, tag, emblème, conditions)', 'Boss de la semaine : les dégâts de tous les membres s’additionnent', 'Rivalités entre Ordres et classement de la semaine'] },
  referral: { title: 'Parrainage', lede: 'Invite tes amis et débloque un calendrier de 10 récompenses.', icon: uiArt('chest'), points: ['Un code et un lien à partager', 'Une case du calendrier s’ouvre pour chaque ami qui rejoint le jeu', 'Coffres, âmes et sceaux, jusqu’au gros lot de la 10e case'] },
}

export const Community = ({ start = 'fame' }: { start?: CommunityTab }) => {
  const store = useStore()
  const [tab, setTab] = useState<CommunityTab>(start)
  const mine = HEROES.filter((h) => store.owned[h.id]).length
  const acc = accountLevel(store.accountXp, store.rebirths)
  const done = ACHIEVEMENTS.filter((a) => progressOf(a, store).done).length
  const stars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const records: [string, string, string][] = [
    ['Collection', `${n(mine)} / ${n(HEROES.length)}`, 'cartes uniques'], ['Cartes MR', n(HEROES.filter((h) => h.rarity === 'rift' && store.owned[h.id]).length), 'mythiques'],
    ['Niveau de compte', String(acc.level), `${store.rebirths} Renaissance${store.rebirths > 1 ? 's' : ''}`], ['Succès', `${done} / ${ACHIEVEMENTS.length}`, 'obtenus'],
    ['La Spire', `Étage ${store.spire.best}`, 'meilleur étage'], ['Arène', n(store.arena.best), `meilleure cote · ${leagueOf(store.arena.best).label}`],
    ['Grand Rift', String(store.tourney.titles), 'tournois gagnés'], ['La Saga', `${stars} ★`, 'étoiles'], ['Invocations', n(store.pulls), 'au total'],
  ]
  return (
    <div className="cm">
      <header className="cm__head"><div><p className="eyebrow">Communauté</p><h1>{COMMUNITY.find((x) => x[0] === tab)![1]}</h1></div></header>
      <div className="coltabs__bar" role="tablist" aria-label="Communauté">
        {COMMUNITY.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'fame' ? (
        <section className="cm__fame">
          <div className="cm__me"><Avatar size={64} /><div><b>{store.profile.name.trim() || 'Joueur'}</b><small>Ta carrière, avant et après les Renaissances</small></div></div>
          <ul className="cm__records">{records.map(([k, v, s]) => <li key={k}><small>{k}</small><b>{v}</b><span>{s}</span></li>)}</ul>
          <p className="set__note">Le classement contre les autres joueurs (global, collection, Spire, guildes) demande un serveur. En attendant, le Panthéon garde tes propres records.</p>
        </section>
      ) : (
        <section className="cm__soon">
          <img src={SOON[tab].icon} alt="" />
          <div>
            <h2>{SOON[tab].title}</h2><p className="cm__lede">{SOON[tab].lede}</p>
            <ul>{SOON[tab].points.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="cm__lock"><span className="kiri" style={{ width: 40, height: 40, backgroundImage: `url(${extraArt('guide')})` }} aria-hidden="true" />Cette partie a besoin d’autres joueurs : elle ouvrira quand le jeu aura un serveur en ligne. Aucun faux joueur n’est affiché d’ici là.</p>
          </div>
        </section>
      )}
    </div>
  )
}
