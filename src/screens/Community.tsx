import { TabIcon } from '../ui/TabIcon'
import { useState } from 'react'
import { Social } from './Social'
import { GuildPage } from './Guild'
import { Referral } from './Referral'
import { Pantheon } from './Pantheon'
export { openSettings } from '../state/online'
import { openSettings } from '../state/online'
import { HEROES } from '../data/heroes'
import { ACHIEVEMENTS, progressOf } from '../game/achievements'
import { leagueOf } from '../game/arena'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { Avatar } from '../ui/Settings'

import { uiArt } from '../assets/manifest'
const HEAD_ART = { social: 'nav-profile', guild: 'league-gold', fame: 'crown', referral: 'chest' } as const
export type CommunityTab = 'social' | 'guild' | 'fame' | 'referral'
export const COMMUNITY: [CommunityTab, string][] = [['social', 'Social'], ['guild', 'Guilde'], ['fame', 'Panthéon'], ['referral', 'Parrainage']]
const n = (x: number) => x.toLocaleString('fr-FR')

export const Community = ({ start = 'fame', onProfile }: { start?: CommunityTab; onProfile: () => void }) => {
  const store = useStore()
  const [tab, setTab] = useState<CommunityTab>(start)
  const mine = HEROES.filter((h) => store.owned[h.id]).length
  const acc = accountLevel(store.accountXp, store.rebirths)
  const done = ACHIEVEMENTS.filter((a) => progressOf(a, store).done).length
  const stars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const records: [string, string, string][] = [
    ['Collection', `${n(mine)} / ${n(HEROES.length)}`, 'cartes uniques'], ['Cartes MR', n(HEROES.filter((h) => h.rarity === 'rift' && store.owned[h.id]).length), 'mythiques'],
    ['Niveau de compte', String(acc.level), `${store.rebirths} Ascension${store.rebirths > 1 ? 's' : ''}`], ['Succès', `${done} / ${ACHIEVEMENTS.length}`, 'obtenus'],
    ['La Tour de l’Infini', `Étage ${store.spire.best}`, 'meilleur étage'], ['Arène', n(store.arena.best), `meilleure cote · ${leagueOf(store.arena.best).label}`],
    ['Grand Rift', String(store.tourney.titles), 'tournois gagnés'], ['L’Aventure', `${stars} ★`, 'étoiles'], ['Invocations', n(store.pulls), 'au total'],
  ]
  return (
    <div className="cm">
      <header className="cm__head page-head"><img src={uiArt(HEAD_ART[tab])} alt="" /><div><p className="eyebrow">Communauté</p><h1>{COMMUNITY.find((x) => x[0] === tab)![1]}</h1></div></header>
      <div className="coltabs__bar" role="tablist" aria-label="Communauté">
        {COMMUNITY.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><TabIcon id={id} />{label}</button>)}
      </div>
      {tab === 'referral' ? <Referral /> : tab === 'guild' ? <GuildPage onConnect={openSettings} /> : tab === 'social' ? <Social onGuild={() => setTab('guild')} onProfile={onProfile} onConnect={openSettings} /> : tab === 'fame' ? (<>
        <Pantheon />
        <section className="cm__fame">
          <h3 className="sp-sub">Tes records</h3>
          <div className="cm__me"><Avatar size={64} /><div><b>{store.profile.name.trim() || 'Joueur'}</b><small>Ta carrière, avant et après les Ascensions</small></div></div>
          <ul className="cm__records">{records.map(([k, v, s]) => <li key={k}><small>{k}</small><b>{v}</b><span>{s}</span></li>)}</ul>
        </section>
      </>) : null}
    </div>
  )
}
