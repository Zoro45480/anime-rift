import { useState } from 'react'
import { StoreProvider } from './state/store'
import { TabBar, TopBar, type TabId } from './ui/Chrome'
import { Banners } from './screens/Banners'
import { Play } from './screens/Play'
import { Collection } from './screens/Collection'

export const App = () => {
  const [tab, setTab] = useState<TabId>('banners')
  const go = (t: TabId) => { setTab(t); window.scrollTo(0, 0) }
  return (
    <StoreProvider>
      <TopBar />
      <main className="screen" key={tab}>
        {tab === 'banners' && <Banners />}
        {tab === 'play' && <Play />}
        {tab === 'collection' && <Collection onSummon={() => go('banners')} />}
      </main>
      <TabBar tab={tab} onTab={go} />
    </StoreProvider>
  )
}
