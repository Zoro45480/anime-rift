import { useState } from 'react'
import { StoreProvider } from './state/store'
import { Dock, TopBar, type TabId } from './ui/Chrome'
import { Splash } from './screens/Splash'
import { Banners } from './screens/Banners'
import { Play } from './screens/Play'
import { Collection } from './screens/Collection'

export const App = () => {
  const [entered, setEntered] = useState(false)
  const [tab, setTab] = useState<TabId>('banners')
  const go = (t: TabId) => { setTab(t); window.scrollTo(0, 0) }
  if (!entered) return <Splash onEnter={() => setEntered(true)} />
  return (
    <StoreProvider>
      <TopBar />
      <main className="screen" key={tab}>
        {tab === 'banners' && <Banners />}
        {tab === 'play' && <Play />}
        {tab === 'collection' && <Collection onSummon={() => go('banners')} />}
      </main>
      <Dock tab={tab} onTab={go} />
    </StoreProvider>
  )
}
