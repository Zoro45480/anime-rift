import { useStore } from '../state/store'
import { IconGrid, IconPlay, IconRift } from './icons'
import { Coin } from './Coin'
import { logoArt } from '../assets/manifest'

export type TabId = 'banners' | 'play' | 'collection'

// Logo 3D : complet sur grand écran, emblème seul sur téléphone.
export const Logo = () => (
  <div className="logo" role="img" aria-label="ANIME RIFT">
    <img className="logo__emblem" src={logoArt('emblem')} alt="" />
    <img className="logo__full" src={logoArt('full')} alt="" />
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
