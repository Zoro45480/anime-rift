import { useStore } from '../state/store'
import { IconBanners, IconGrid, IconPlay } from './icons'
import { Coin } from './Coin'

export type TabId = 'banners' | 'play' | 'collection'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'banners', label: 'Bannières', icon: <IconBanners /> },
  { id: 'play', label: 'Jouer', icon: <IconPlay /> },
  { id: 'collection', label: 'Collection', icon: <IconGrid /> },
]

export const Logo = () => (
  <div className="logo" role="img" aria-label="ANIME RIFT">
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
      <path d="M20 2 36 20 20 38 4 20z" fill="#15121a" stroke="var(--cream)" strokeWidth="1.5" />
      <path d="M23 4 16.5 17l6 4L15 36" fill="none" stroke="var(--ember)" strokeWidth="3" strokeLinejoin="bevel" />
    </svg>
    <span>ANIME<b>RIFT</b></span>
  </div>
)

export const TopBar = () => {
  const { tickets, gems } = useStore()
  return (
    <header className="topbar">
      <div className="topbar__in">
        <Logo />
        <div className="wallet" aria-label="Vos ressources">
          <span title="Énergie"><Coin name="bolt" />10<small>/10</small></span>
          <span title="Gemmes"><Coin name="gem" />{gems}</span>
          <span title="Tickets d'invocation"><Coin name="ticket" />{tickets}</span>
        </div>
      </div>
    </header>
  )
}

export const TabBar = ({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) => (
  <nav className="tabbar" aria-label="Navigation">
    <div className="tabbar__in">
      {TABS.map((t) => (
        <button key={t.id} className={`tabbar__item ${t.id === tab ? 'is-active' : ''}`} onClick={() => onTab(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  </nav>
)
