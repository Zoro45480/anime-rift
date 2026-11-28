import { useOnline } from '../state/online'
import { FREE_KEY_CAP, FREE_KEY_MS } from '../state/store'
import { accountLevel, ENERGY_MAX } from '../game/progression'
import { LevelBadge } from './LevelBadge'
import { Avatar, Settings } from './Settings'
import { NotifPanel, NotifToast, type NotifGo } from './Notifs'
import { COMMUNITY, type CommunityTab } from '../screens/Community'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { Coin } from './Coin'
import { logoArt, uiArt } from '../assets/manifest'

export type TabId = 'home' | 'banners' | 'play' | 'collection' | 'contracts' | 'bazaar' | 'community'

// Logo 3D : complet sur grand écran, emblème seul sur téléphone.
export const Logo = () => (
  <div className="logo" role="img" aria-label="ANIME RIFT">
    <img className="logo__emblem" src={logoArt('emblem')} alt="" />
    <img className="logo__full" src={logoArt('full')} alt="" />
  </div>
)

// Barre du haut : logo et ressources du joueur, chaque ressource dans sa plaquette en biais.
export type QuestTab = 'daily' | 'contracts' | 'rift' | 'path'
export type NavProps = { tab: TabId; profileOn: boolean; onTab: (t: TabId) => void; onQuest: (t: QuestTab) => void; onCommunity: (t: CommunityTab) => void }
// Décompte de la prochaine Clé de Faille gratuite (une toutes les 5 minutes).
export const KeyTimer = ({ long }: { long?: boolean }) => {
  const { keyAt, tickets } = useStore()
  const [t, setT] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(i) }, [])
  if (!keyAt || tickets >= FREE_KEY_CAP) return long ? <span className="keytimer keytimer--full">Clés gratuites au maximum ({FREE_KEY_CAP})</span> : null
  const left = Math.max(0, keyAt + FREE_KEY_MS - t)
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)
  return <span className="keytimer" title="Une Clé de Faille gratuite toutes les 5 minutes">{long ? 'Prochaine Clé gratuite dans ' : '+1 '}{mm}:{String(ss).padStart(2, '0')}</span>
}

export const TopBar = ({ onPlay, onSummon, onProfile, onGo, nav }: { onPlay: () => void; onSummon: () => void; onProfile: () => void; onGo: NotifGo; nav: NavProps }) => {
  const { tickets, gems, energyLeft, accountXp, rebirths, notifs, readNotifs, clearNotifs } = useStore()
  const [open, setOpen] = useState(false)
  useEffect(() => { const f = () => setSettings(true); window.addEventListener('anime-rift:settings', f); return () => window.removeEventListener('anime-rift:settings', f) }, [])
  const [settings, setSettings] = useState(false)
  const online = useOnline()
  const unread = notifs.filter((x) => !x.read).length
  const full = energyLeft >= ENERGY_MAX
  const toggle = () => { if (open) readNotifs(); setOpen(!open) } // lues quand on referme le panneau
  return (
    <header className="topbar">
      <div className="topbar__in">
        <button className="topbar__home" onClick={() => nav.onTab('home')} aria-label="Accueil" title="Accueil"><Logo /></button>
        <TopNav {...nav} onProfile={onProfile} />
        <div className="wallet" aria-label="Vos ressources">
          <button className="wallet__lvl" onClick={onProfile} aria-label="Mon profil"><LevelBadge level={accountLevel(accountXp, rebirths).level} rebirths={rebirths} /></button>
          <div className="hud">
            <button className="wallet__energy" onClick={onPlay} aria-label={`Flux : ${energyLeft} sur ${ENERGY_MAX}. Aller à Jouer`}><Coin name="bolt" size={24} /><b>{energyLeft}<small>/{ENERGY_MAX}</small></b></button>
            <button className="wallet__energy" onClick={onSummon} aria-label={`Éclats : ${gems}. Aller aux invocations`}><Coin name="soul" size={24} /><b>{gems}</b></button>
            <button className="wallet__energy" onClick={onSummon} aria-label={`Clés de Faille : ${tickets}. Aller aux invocations`}><Coin name="seal" size={24} /><b>{tickets}</b><KeyTimer /></button>
          </div>
          <button className={`bell ${unread ? 'has-unread' : ''}`} onClick={toggle} aria-expanded={open} aria-label={`Notifications${unread ? ` : ${unread} non lue${unread > 1 ? 's' : ''}` : ''}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>
            {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
          </button>
          <button className="bell bell--me" onClick={onProfile} aria-label="Voir mon profil"><Avatar size={34} />{online.session && <i className="bell__online" aria-hidden="true" />}</button>
          <button className="bell" onClick={() => setSettings(true)} aria-label="Paramètres">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
          </button>
        </div>
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
      {open && <NotifPanel notifs={notifs} full={full} onClear={clearNotifs} onClose={toggle} onGo={onGo} />}
      <NotifToast notifs={notifs} muted={open} onGo={onGo} />
    </header>
  )
}

// Barre d'onglets du téléphone : Portails, Jouer, Collection, Bazar et « Plus » (Contrats, Communauté, Profil, Réglages).
const TabIcon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const ICONS = {
  banners: 'M12 3c4 2.5 6 5.5 6 9s-2.7 7-6 9c-3.3-2-6-5.5-6-9s2-6.5 6-9Zm0 5v8M9 12h6',
  play: 'M14.5 4.5 19.5 9.5 9 20l-5 1 1-5L14.5 4.5ZM12.5 6.5l5 5',
  collection: 'M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h4m-4 4h4m-4 4h2',
  bazaar: 'M4 9h16l-1.5 10.5a1 1 0 0 1-1 .5h-11a1 1 0 0 1-1-.5L4 9Zm4 0V7a4 4 0 0 1 8 0v2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  contracts: 'M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Zm1 5h6m-6 4h4',
  community: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3 1.6-1.2-1.6-2.8-1.9.6a7 7 0 0 0-1.7-1L15.4 5h-3.2l-.4 2.1a7 7 0 0 0-1.7 1L8.2 7.5 6.6 10.3 8.2 11.5a7 7 0 0 0 0 2l-1.6 1.2 1.6 2.8 1.9-.6a7 7 0 0 0 1.7 1l.4 2.1h3.2l.4-2.1a7 7 0 0 0 1.7-1l1.9.6 1.6-2.8-1.6-1.2a7 7 0 0 0 0-2Z',
}
const NAV_ICON: Record<string, keyof typeof ICONS> = { home: 'banners', banners: 'banners', play: 'play', collection: 'collection', bazaar: 'bazaar', contracts: 'contracts', community: 'community', profile: 'profile' }
const NavIcon = ({ id }: { id: string }) => <svg className="tnav__ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[NAV_ICON[id] ?? 'banners']} /></svg>
export const Dock = ({ tab, onTab, profileOn, onProfile }: { tab: TabId; onTab: (t: TabId) => void; profileOn: boolean; onProfile?: () => void }) => {
  const { questsReady } = useStore()
  const [more, setMore] = useState(false)
  const inMore = tab === 'contracts' || tab === 'community' || profileOn
  const item = (id: TabId, label: string, icon: keyof typeof ICONS) => {
    const on = tab === id && !profileOn
    return <button key={id} className={`tabbar__btn ${on ? 'is-active' : ''}`} onClick={() => { setMore(false); onTab(id) }} aria-current={on ? 'page' : undefined}><TabIcon d={ICONS[icon]} /><span>{label}</span></button>
  }
  const go = (f: () => void) => { setMore(false); f() }
  return (
    <>
      <nav className="tabbar" aria-label="Navigation">
        {item('banners', 'Portails', 'banners')}
        {item('play', 'Jouer', 'play')}
        {item('collection', 'Collection', 'collection')}
        {item('bazaar', 'Marché', 'bazaar')}
        <button className={`tabbar__btn ${inMore || more ? 'is-active' : ''}`} onClick={() => setMore(!more)} aria-expanded={more} aria-label={questsReady ? `Plus (${questsReady} récompenses à récupérer)` : 'Plus'}>
          <TabIcon d={ICONS.more} /><span>Plus</span>{questsReady > 0 && <i className="dot tabbar__dot" />}
        </button>
      </nav>
      {more && <div className="sheet" role="dialog" aria-modal="true" aria-label="Plus" onClick={() => setMore(false)}>
        <div className="sheet__in" onClick={(e) => e.stopPropagation()}>
          <span className="sheet__grip" aria-hidden="true" />
          <button className="sheet__item" onClick={() => go(() => onTab('contracts'))}><TabIcon d={ICONS.contracts} /><span><b>Missions</b><small>Quêtes, récompense du jour, Pass de combat</small></span>{questsReady > 0 && <i className="dot" />}</button>
          <button className="sheet__item" onClick={() => go(() => onTab('community'))}><TabIcon d={ICONS.community} /><span><b>Communauté</b><small>Social, Guilde, Panthéon, Lien de Faille</small></span></button>
          <button className="sheet__item" onClick={() => go(() => (onProfile ? onProfile() : onTab('collection')))}><TabIcon d={ICONS.profile} /><span><b>Profil</b><small>Ta carte de joueur et tes succès</small></span></button>
          <button className="sheet__item" onClick={() => go(() => window.dispatchEvent(new Event('anime-rift:settings')))}><TabIcon d={ICONS.settings} /><span><b>Réglages</b><small>Compte, son, graphismes, langue</small></span></button>
          <button className="sheet__item" onClick={() => go(() => onTab('home'))}><TabIcon d={ICONS.banners} /><span><b>Accueil</b><small>Calendrier du Rift et nouveautés</small></span></button>
        </div>
      </div>}
    </>
  )
}

// Sur ordinateur : le menu en ligne dans la barre du haut, avec un menu déroulant pour les Quêtes. Raccourcis 1 à 7.
const QUESTS: [QuestTab, string][] = [['daily', 'Récompense du jour'], ['contracts', 'Missions'], ['rift', 'Pass de combat'], ['path', 'Parcours']]
export const TopNav = ({ tab, profileOn, onTab, onQuest, onCommunity, onProfile }: NavProps & { onProfile: () => void }) => {
  const { questsReady } = useStore()
  const [menu, setMenu] = useState<'' | 'quests' | 'community'>('')
  const items: { id: TabId | 'profile'; label: string; icon: Parameters<typeof uiArt>[0]; key: string }[] = [
    { id: 'home', label: 'Accueil', icon: 'nav-summon', key: '1' },
    { id: 'banners', label: 'Portails', icon: 'nav-summon', key: '2' },
    { id: 'play', label: 'Jouer', icon: 'nav-nexus', key: '3' },
    { id: 'collection', label: 'Collection', icon: 'nav-cards', key: '4' },
    { id: 'bazaar', label: 'Marché', icon: 'nav-bazaar', key: '5' },
    { id: 'contracts', label: 'Missions', icon: 'nav-contracts', key: '6' },
    { id: 'community', label: 'Communauté', icon: 'nav-profile', key: '7' },
  ]
  const open = (id: TabId | 'profile') => { setMenu(''); if (id === 'profile') onProfile(); else onTab(id) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key === 'Escape') setMenu('')
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, [contenteditable], [role=dialog]')) return
      const item = items.find((x) => x.key === e.key)
      if (item) { e.preventDefault(); open(item.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <nav className="tnav" aria-label="Menu principal">
      {items.filter((x) => x.id !== 'home').map((x) => {
        const on = x.id === 'profile' ? profileOn : tab === x.id && !profileOn
        if (x.id === 'contracts' || x.id === 'community') {
          const which = x.id === 'contracts' ? 'quests' : 'community'
          const list: [string, string][] = x.id === 'contracts' ? QUESTS : COMMUNITY
          return (
            <div key={x.id} className={`tnav__drop ${menu === which ? 'is-open' : ''}`} onMouseLeave={() => setMenu('')}>
              <button className={`tnav__item ${on ? 'is-active' : ''}`} aria-expanded={menu === which} aria-haspopup="menu" onClick={() => setMenu(menu === which ? '' : which)} onMouseEnter={() => setMenu(which)} title={`${x.label} (touche ${x.key})`}>
                <NavIcon id={x.id} />{x.label}{x.id === 'contracts' && questsReady > 0 && <i className="dot tnav__dot" aria-label={`${questsReady} à récupérer`} />}<svg viewBox="0 0 10 6" width="9" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
              </button>
              {menu === which && <div className="tnav__menu" role="menu">{list.map(([id, label]) => <button key={id} role="menuitem" onClick={() => { setMenu(''); if (which === 'quests') onQuest(id as QuestTab); else onCommunity(id as CommunityTab) }}>{label}</button>)}</div>}
            </div>
          )
        }
        return (
          <button key={x.id} className={`tnav__item ${on ? 'is-active' : ''}`} onClick={() => open(x.id)} aria-current={on ? 'page' : undefined} title={`${x.label} (touche ${x.key})`}>
            <NavIcon id={x.id} />{x.label}
          </button>
        )
      })}
    </nav>
  )
}
