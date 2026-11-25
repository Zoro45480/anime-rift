import { accountLevel, ENERGY_MAX } from '../game/progression'
import { LevelBadge } from './LevelBadge'
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
export const TopBar = ({ onPlay }: { onPlay: () => void }) => {
  const { tickets, gems, energyLeft, accountXp, rebirths } = useStore()
  return (
    <header className="topbar">
      <div className="topbar__in">
        <Logo />
        <div className="wallet" aria-label="Vos ressources">
          <LevelBadge level={accountLevel(accountXp, rebirths).level} />
          <button className="wallet__energy" onClick={onPlay} aria-label={`Énergie : ${energyLeft} sur ${ENERGY_MAX}. Aller au Nexus`}><Coin name="bolt" size={24} /><b>{energyLeft}<small>/{ENERGY_MAX}</small></b></button>
          <span title="Flammes d'âme"><Coin name="soul" size={24} /><b>{gems}</b></span>
          <span title="Sceaux d'invocation"><Coin name="seal" size={24} /><b>{tickets}</b></span>
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
