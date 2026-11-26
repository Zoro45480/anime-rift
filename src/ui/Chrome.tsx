import { accountLevel, ENERGY_MAX } from '../game/progression'
import { LevelBadge } from './LevelBadge'
import { Settings } from './Settings'
import { NotifPanel, NotifToast } from './Notifs'
import { useState } from 'react'
import { useStore } from '../state/store'
import { Coin } from './Coin'
import { logoArt, uiArt } from '../assets/manifest'

export type TabId = 'banners' | 'play' | 'collection'

// Logo 3D : complet sur grand écran, emblème seul sur téléphone.
export const Logo = () => (
  <div className="logo" role="img" aria-label="ANIME RIFT">
    <img className="logo__emblem" src={logoArt('emblem')} alt="" />
    <img className="logo__full" src={logoArt('full')} alt="" />
  </div>
)

// Barre du haut : logo et ressources du joueur, chaque ressource dans sa plaquette en biais.
export const TopBar = ({ onPlay, onSummon, onProfile }: { onPlay: () => void; onSummon: () => void; onProfile: () => void }) => {
  const { tickets, gems, energyLeft, accountXp, rebirths, notifs, readNotifs, clearNotifs } = useStore()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const unread = notifs.filter((x) => !x.read).length
  const full = energyLeft >= ENERGY_MAX
  const toggle = () => { if (open) readNotifs(); setOpen(!open) } // lues quand on referme le panneau
  return (
    <header className="topbar">
      <div className="topbar__in">
        <Logo />
        <div className="wallet" aria-label="Vos ressources">
          <button className="wallet__lvl" onClick={onProfile} aria-label="Mon profil"><LevelBadge level={accountLevel(accountXp, rebirths).level} rebirths={rebirths} /></button>
          <button className="wallet__energy" onClick={onPlay} aria-label={`Énergie : ${energyLeft} sur ${ENERGY_MAX}. Aller au Nexus`}><Coin name="bolt" size={24} /><b>{energyLeft}<small>/{ENERGY_MAX}</small></b></button>
          <button className="wallet__energy" onClick={onSummon} aria-label={`Flammes d'âme : ${gems}. Aller aux invocations`}><Coin name="soul" size={24} /><b>{gems}</b></button>
          <button className="wallet__energy" onClick={onSummon} aria-label={`Sceaux d'invocation : ${tickets}. Aller aux invocations`}><Coin name="seal" size={24} /><b>{tickets}</b></button>
          <button className={`bell ${unread ? 'has-unread' : ''}`} onClick={toggle} aria-expanded={open} aria-label={`Notifications${unread ? ` : ${unread} non lue${unread > 1 ? 's' : ''}` : ''}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>
            {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
          </button>
          <button className="bell" onClick={() => setSettings(true)} aria-label="Paramètres">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
          </button>
        </div>
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
      {open && <NotifPanel notifs={notifs} full={full} onClear={clearNotifs} onClose={toggle} />}
      <NotifToast notifs={notifs} muted={open} />
    </header>
  )
}

// Dock flottant : l'invocation au centre dans un losange, les deux autres écrans de part et d'autre.
export const Dock = ({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) => (
  <nav className="dock" aria-label="Navigation">
    <div className="dock__bg" />
    <button className={`dock__side ${tab === 'play' ? 'is-active' : ''}`} onClick={() => onTab('play')} aria-current={tab === 'play' ? 'page' : undefined}>
      <img src={uiArt('nav-nexus')} alt="" /><span>Nexus</span>
    </button>
    <button className={`dock__main ${tab === 'banners' ? 'is-active' : ''}`} onClick={() => onTab('banners')} aria-current={tab === 'banners' ? 'page' : undefined}>
      <i><img src={uiArt('nav-summon')} alt="" /></i><span>Invoquer</span>
    </button>
    <button className={`dock__side ${tab === 'collection' ? 'is-active' : ''}`} onClick={() => onTab('collection')} aria-current={tab === 'collection' ? 'page' : undefined}>
      <img src={uiArt('nav-cards')} alt="" /><span>Collection</span>
    </button>
  </nav>
)
