import { accountLevel, ENERGY_MAX } from '../game/progression'
import { LevelBadge } from './LevelBadge'
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
export const TopBar = ({ onPlay, onSummon }: { onPlay: () => void; onSummon: () => void }) => {
  const { tickets, gems, energyLeft, accountXp, rebirths, notifs, readNotifs, clearNotifs } = useStore()
  const [open, setOpen] = useState(false)
  const unread = notifs.filter((x) => !x.read).length
  const full = energyLeft >= ENERGY_MAX
  const toggle = () => { if (open) readNotifs(); setOpen(!open) } // lues quand on referme le panneau
  const ago = (t: number) => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `il y a ${Math.floor(m / 1440)} j` }
  return (
    <header className="topbar">
      <div className="topbar__in">
        <Logo />
        <div className="wallet" aria-label="Vos ressources">
          <LevelBadge level={accountLevel(accountXp, rebirths).level} rebirths={rebirths} />
          <button className="wallet__energy" onClick={onPlay} aria-label={`Énergie : ${energyLeft} sur ${ENERGY_MAX}. Aller au Nexus`}><Coin name="bolt" size={24} /><b>{energyLeft}<small>/{ENERGY_MAX}</small></b></button>
          <button className="wallet__energy" onClick={onSummon} aria-label={`Flammes d'âme : ${gems}. Aller aux invocations`}><Coin name="soul" size={24} /><b>{gems}</b></button>
          <button className="wallet__energy" onClick={onSummon} aria-label={`Sceaux d'invocation : ${tickets}. Aller aux invocations`}><Coin name="seal" size={24} /><b>{tickets}</b></button>
          <button className={`bell ${unread ? 'has-unread' : ''}`} onClick={toggle} aria-expanded={open} aria-label={`Notifications${unread ? ` : ${unread} non lue${unread > 1 ? 's' : ''}` : ''}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>
            {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
          </button>
        </div>
      </div>
      {open && (
        <div className="notifs" role="dialog" aria-label="Notifications">
          <header><h2>Notifications</h2>{notifs.length > 0 && <button className="linkbtn" onClick={clearNotifs}>Tout effacer</button>}<button className="notifs__close" onClick={toggle} aria-label="Fermer">×</button></header>
          <ul>
            {full && <li className="notifs--energy"><b>Énergie pleine</b><span>Tes {ENERGY_MAX} éclairs sont prêts : La Saga t'attend.</span></li>}
            {notifs.map((x) => <li key={x.id} className={`notifs--${x.kind} ${x.read ? '' : 'is-new'}`}><span>{x.text}</span><time>{ago(x.t)}</time></li>)}
            {notifs.length === 0 && !full && <li className="notifs__empty">Rien de nouveau. Les gros tirages, les niveaux, les arcs terminés et les parchemins rares s'afficheront ici.</li>}
          </ul>
        </div>
      )}
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
