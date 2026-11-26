import { useState } from 'react'
import { StoreProvider } from './state/store'
import { Dock, TopBar, type TabId } from './ui/Chrome'
import { CardViewerProvider } from './ui/CardViewer'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Splash } from './screens/Splash'
import { Banners } from './screens/Banners'
import { Play } from './screens/Play'
import { Contracts } from './screens/Contracts'
import { Bazaar } from './screens/Bazaar'
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
      <TopBar onPlay={() => go('play')} onSummon={() => go('banners')} onProfile={toProfile} onGo={(k) => {
        // chaque notification mène à sa page
        if (k === 'quest') go('contracts')
        else if (k === 'bazaar') go('bazaar')
        else if (k === 'ach' || k === 'level') toProfile()
        else if (k === 'rebirth') toRebirth()
        else if (k === 'pull' || k === 'free') { setColTab('cards'); go('collection') }
        else go('play')
      }} />
      <main className="screen" key={tab}>
        <ErrorBoundary>
        {tab === 'banners' && <Banners onRebirth={toRebirth} />}
        {tab === 'play' && <Play onRebirth={toRebirth} onProfile={toProfile} />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'bazaar' && <Bazaar />}
        {tab === 'collection' && <Collection onSummon={() => go('banners')} tab={colTab} onTab={setColTab} />}
        </ErrorBoundary>
      </main>
      <Dock tab={tab} onTab={(t) => { if (t === 'collection' && colTab === 'profile') setColTab('cards'); go(t) }} profileOn={tab === 'collection' && colTab === 'profile'} />
      </CardViewerProvider>
    </StoreProvider>
  )
}
