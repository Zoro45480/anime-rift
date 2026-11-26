import { useState } from 'react'
import { StoreProvider } from './state/store'
import { Dock, TopBar, type TabId } from './ui/Chrome'
import { CardViewerProvider } from './ui/CardViewer'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Splash } from './screens/Splash'
import { Banners } from './screens/Banners'
import { Play } from './screens/Play'
import { Collection, type CollectionTab } from './screens/Collection'

export const App = () => {
  const [entered, setEntered] = useState(false)
  const [tab, setTab] = useState<TabId>('banners')
  const [colTab, setColTab] = useState<CollectionTab>('cards')
  const go = (t: TabId) => { setTab(t); window.scrollTo(0, 0) }
  const toProfile = () => { setColTab('profile'); go('collection') }
  const toRebirth = () => { setColTab('rebirth'); go('collection') }
  if (!entered) return <Splash onEnter={() => setEntered(true)} />
  return (
    <StoreProvider>
      <CardViewerProvider>
      <TopBar onPlay={() => go('play')} onSummon={() => go('banners')} onProfile={toProfile} />
      <main className="screen" key={tab}>
        <ErrorBoundary>
        {tab === 'banners' && <Banners onRebirth={toRebirth} />}
        {tab === 'play' && <Play onRebirth={toRebirth} onProfile={toProfile} />}
        {tab === 'collection' && <Collection onSummon={() => go('banners')} tab={colTab} onTab={setColTab} />}
        </ErrorBoundary>
      </main>
      <Dock tab={tab} onTab={go} />
      </CardViewerProvider>
    </StoreProvider>
  )
}
