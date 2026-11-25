import { useStore } from '../state/store'
import { IconGrid, IconPlay, IconRift } from './icons'
import { Coin } from './Coin'

export type TabId = 'banners' | 'play' | 'collection'

export const Logo = () => (
  <div className="logo" role="img" aria-label="ANIME RIFT">
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9b7bff" /><stop offset="1" stopColor="#5ee6ff" /></linearGradient></defs>
      <path d="M20 2 36 20 20 38 4 20z" fill="#10122a" stroke="url(#lg)" strokeWidth="1.8" />
      <path d="M23 5 16.5 17l6 4L15 35" fill="none" stroke="#f2f4ff" strokeWidth="2.6" strokeLinejoin="bevel" />
    </svg>
    <span>ANIME<b>RIFT</b></span>
  </div>
)

// Barre du haut : logo et ressources du joueur, chaque ressource dans sa plaquette en biais.
export const TopBar = () => {
  const { tickets, gems } = useStore()
  return (
    <header className="topbar">
      <div className="topbar__in">
        <Logo />
        <div className="wallet" aria-label="Vos ressources">
          <span title="Énergie"><Coin name="bolt" size={24} /><b>10<small>/10</small></b></span>
          <span title="Gemmes"><Coin name="gem" size={24} /><b>{gems}</b></span>
          <span title="Tickets d'invocation"><Coin name="ticket" size={24} /><b>{tickets}</b></span>
        </div>
      </div>
    </header>
  )
}

// Dock flottant : l'invocation au centre dans un losange, les deux autres écrans de part et d'autre.
export const Dock = ({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) => (
  <nav className="dock" aria-label="Navigation">
    <div className="dock__bg" />
    <button className={`dock__side ${tab === 'play' ? 'is-active' : ''}`} onClick={() => onTab('play')} aria-current={tab === 'play' ? 'page' : undefined}>
      <IconPlay /><span>Nexus</span>
    </button>
    <button className={`dock__main ${tab === 'banners' ? 'is-active' : ''}`} onClick={() => onTab('banners')} aria-current={tab === 'banners' ? 'page' : undefined}>
      <i><IconRift /></i><span>Invoquer</span>
    </button>
    <button className={`dock__side ${tab === 'collection' ? 'is-active' : ''}`} onClick={() => onTab('collection')} aria-current={tab === 'collection' ? 'page' : undefined}>
      <IconGrid /><span>Collection</span>
    </button>
  </nav>
)
