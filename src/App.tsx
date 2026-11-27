import { useEffect, useState } from 'react'
import { StoreProvider } from './state/store'
import { Dock, TopBar, type QuestTab, type TabId } from './ui/Chrome'
import { Home } from './screens/Home'
import { Chat } from './ui/Chat'
import { Community, type CommunityTab } from './screens/Community'
import { CardViewerProvider } from './ui/CardViewer'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Banners } from './screens/Banners'
import { Play } from './screens/Play'
import { Contracts } from './screens/Contracts'
import { Bazaar } from './screens/Bazaar'
import { Collection, type CollectionTab } from './screens/Collection'

export const App = () => {
  const [tab, setTab] = useState<TabId>('home')
  const [visit, setVisit] = useState(0) // change à chaque navigation : l'écran repart de son point de départ
  const [bannerAt, setBannerAt] = useState(0)
  const [questAt, setQuestAt] = useState<QuestTab>('daily')
  const [communityAt, setCommunityAt] = useState<CommunityTab>('fame')
  const [playAt, setPlayAt] = useState<'colossus' | undefined>(undefined)
  const [colTab, setColTab] = useState<CollectionTab>('cards')
  const go = (t: TabId) => { setTab(t); setVisit((v) => v + 1); window.scrollTo(0, 0) }
  useEffect(() => {
    const on = (e: Event) => { setCommunityAt((e as CustomEvent<CommunityTab>).detail); go('community') }
    window.addEventListener('anime-rift:community', on)
    return () => window.removeEventListener('anime-rift:community', on)
  })
  const nav = (t: TabId) => { if (t === 'collection' && colTab === 'profile') setColTab('cards'); if (t === 'contracts') setQuestAt('daily'); if (t === 'play') setPlayAt(undefined); go(t) }
  const toProfile = () => { setColTab('profile'); go('collection') }
  const toRebirth = () => { setColTab('rebirth'); go('collection') }
  return (
    <StoreProvider>
      <CardViewerProvider>
      <TopBar nav={{ tab, profileOn: tab === 'collection' && colTab === 'profile', onTab: nav, onQuest: (q) => { setQuestAt(q); go('contracts') }, onCommunity: (c) => { setCommunityAt(c); go('community') } }} onPlay={() => nav('play')} onSummon={() => go('banners')} onProfile={toProfile} onGo={(k) => {
        // chaque notification mène à sa page
        if (k === 'quest') go('contracts')
        else if (k === 'bazaar') go('bazaar')
        else if (k === 'ach' || k === 'level') toProfile()
        else if (k === 'rebirth') toRebirth()
        else if (k === 'pull' || k === 'free') { setColTab('cards'); go('collection') }
        else go('play')
      }} />
      <main className="screen" key={`${tab}-${visit}`}>
        <ErrorBoundary>
        {tab === 'home' && <Home go={{ banner: (i) => { setBannerAt(i); go('banners') }, contracts: () => nav('contracts'), collection: () => nav('collection'), play: (m) => { setPlayAt(m); go('play') }, profile: toProfile, community: () => { setCommunityAt('fame'); go('community') } }} />}
        {tab === 'banners' && <Banners onRebirth={toRebirth} start={bannerAt} />}
        {tab === 'play' && <Play onRebirth={toRebirth} onProfile={toProfile} start={playAt} />}
        {tab === 'contracts' && <Contracts start={questAt} />}
        {tab === 'bazaar' && <Bazaar />}
        {tab === 'community' && <Community key={communityAt} start={communityAt} onProfile={toProfile} />}
        {tab === 'collection' && <Collection onSummon={() => go('banners')} tab={colTab} onTab={setColTab} />}
        </ErrorBoundary>
      </main>
      <Dock tab={tab} onTab={nav} profileOn={tab === 'collection' && colTab === 'profile'} />
      <Chat />
      </CardViewerProvider>
    </StoreProvider>
  )
}
