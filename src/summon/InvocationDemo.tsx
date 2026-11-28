import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, COST, type Banner } from '../data/banners'
import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { MR_VIDEOS, MR_YOUTUBE } from '../data/mrVideos'
import { heroArt, iconArt } from '../assets/manifest'
import { useStore, type Currency } from '../state/store'
import { getPackVolume, isSoundOn, primeAudio } from './audio'
import { MrEdit } from './MrEdit'
import { Card } from '../ui/Card'
import { RARITIES } from '../data/rarities'
// La démo d'invocation, reprise TELLE QUELLE (demo/invocation.html : CSS, shaders et JavaScript inchangés).
// Seuls changent : le tirage (fait ici par le jeu, avec la pity), l'image des persos, les soldes du joueur et DEMO_MR = false.
import page from './demo/invocation.html?raw'
import cadreBox from './demo/cadre_box.json'

const files = import.meta.glob('./demo/{bg.jpg,logo.webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const sons = import.meta.glob('./demo/sons/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cadres = import.meta.glob('./demo/cadres/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
// Tirage de test : la MR choisie + des cartes au hasard (une SSR et une LR pour voir tous les effets).
const testPull = (id: string, n: number): Hero[] => {
  const one = (r: RarityId) => { const l = HEROES.filter((h) => h.rarity === r); return l[Math.floor(Math.random() * l.length)] }
  const extra: RarityId[] = ['legend', 'ultra', 'epic', 'rare', 'rare', 'common', 'common', 'common', 'common']
  return [HEROES.find((h) => h.id === id)!, ...extra.slice(0, Math.max(0, n - 1)).map(one)]
}
const RANK: Record<RarityId, number> = { common: 0, rare: 1, epic: 2, ultra: 3, legend: 4, rift: 5 }

// `test` : identifiant d'une MR à faire tomber (page de test) : rien n'est dépensé, rien n'est ajouté à la collection.
export const InvocationDemo = ({ banner, count = 10, currency = 'ticket', onClose, test }: { banner: Banner; count?: number; currency?: Currency; onClose: () => void; test?: string }) => {
  const store = useStore()
  const live = useRef(store)
  live.current = store
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [mr, setMr] = useState<{ hero: Hero; stage: 'video' | 'card'; dup: boolean; then?: 'card' | 'back' } | null>(null) // MR obtenue : son edit vidéo, puis sa présentation
  const done = useRef(onClose)
  done.current = onClose

  // la page de la démo, avec ses fichiers (bg.jpg, logo.webp, cadres/) intégrés au jeu
  const doc = useMemo(() => {
    const map = Object.fromEntries(Object.entries(cadres).map(([k, v]) => [k.split('/').pop()!.replace('.webp', ''), v]))
    return page
      .replaceAll('bg.jpg', files['./demo/bg.jpg'])
      .replaceAll('logo.webp', files['./demo/logo.webp'])
      .replaceAll('__SEAL__', iconArt('seal'))
      .replaceAll('__SOUL__', iconArt('soul'))
      .replace('<body>', `<body><script>window.CADRE_BOX=${JSON.stringify(cadreBox)};window.CADRES=${JSON.stringify(map)};window.SONS=${JSON.stringify(Object.fromEntries(Object.entries(sons).map(([k, v]) => [k.split('/').pop()!.replace('.mp3', ''), v])))}</script>`)
  }, [])

  const send = (m: unknown) => frame.current?.contentWindow?.postMessage(m, '*')
  const balance = () => {
    const s = live.current
    send({ type: 'balance', tickets: test ? 999 : s.tickets, gems: test ? 99999 : s.gems, pity: s.pity[banner.id] ?? 0, ct: COST.ticket, cg: COST.gems }) // en test : soldes fictifs
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = e.data as { type: string; n?: number; pay?: string; id?: string; vid?: boolean }
      const s = live.current
      if (m.type === 'ready') {
        balance()
        send({ type: 'open', banner: BANNERS.indexOf(banner), n: count, pay: currency === 'ticket' ? 't' : 'g', ends: BANNERS.map((b) => Date.parse(b.endsAt)) })
        send({ type: 'volume', v: getPackVolume() }) // volume des invocations (Paramètres)
        if (!isSoundOn()) send({ type: 'mute', muted: true }) // le réglage « Couper le son » du jeu
        setTimeout(() => setReady(true), 60)
        frame.current?.focus()
      }
      if (m.type === 'pull') {
        primeAudio()
        const before = s.owned
        const heroes = test ? testPull(test, m.n ?? 1) : s.summon(banner, m.pay === 't' ? 'ticket' : 'gems', m.n ?? 1) // le vrai tirage, AVANT l'animation
        if (!heroes) { send({ type: 'pulled', pulls: null }); return }
        const seen: Record<string, number> = {}
        send({ type: 'pulled', pulls: heroes.map((h) => {
          const dup = (before[h.id] ?? 0) + (seen[h.id] ?? 0) > 0
          seen[h.id] = (seen[h.id] ?? 0) + 1
          return { id: h.id, k: RANK[h.rarity], name: h.name, dup, atk: h.atk, def: h.def, img: s.customArt[h.id] ?? s.remoteArt[h.id] ?? heroArt(h.model, 'full') }
        }) })
      }
      // la vidéo de la MR, AVANT de voir la carte (puis la démo continue : cinématique et retournement)
      if (m.type === 'mrvideo' && m.id) { const h = HEROES.find((x) => x.id === m.id); if (h) setMr({ hero: h, stage: 'video', dup: false, then: 'back' }); else send({ type: 'videodone' }) }
      // la carte MR présentée en grand, à la fin (avec la vidéo d'abord si elle n'est pas encore passée, ex. « Tout révéler »)
      if (m.type === 'mr' && m.id) { const h = HEROES.find((x) => x.id === m.id); if (h) setMr({ hero: h, stage: m.vid ? 'card' : 'video', dup: !test && (s.owned[h.id] ?? 0) > 1, then: 'card' }) }
      if (m.type === 'close') done.current()
      if (m.type === 'collection') { done.current(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'collection' })) }
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
  }, [banner, count, currency, test]) // eslint-disable-line react-hooks/exhaustive-deps

  // soldes et pity tenus à jour dans la démo
  useEffect(() => { if (ready) balance() }, [ready, store.tickets, store.gems, store.pity]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  return createPortal(
    <div className="inv">
      <iframe ref={frame} className={`inv__frame ${ready ? 'is-ready' : ''}`} srcDoc={doc} title={`Invocation · ${banner.world}`} allow="autoplay; fullscreen" />
      {mr?.stage === 'video' && <div className="inv__edit"><MrEdit hero={mr.hero} art={store.customArt[mr.hero.id] ?? store.remoteArt[mr.hero.id] ?? heroArt(mr.hero.model, 'full')} onDone={() => { if (mr.then === 'back') { setMr(null); send({ type: 'videodone' }) } else setMr({ ...mr, stage: 'card' }) }} /></div>}
      {mr?.stage === 'card' && <MrShowcase hero={mr.hero} dup={mr.dup} video={Boolean(MR_YOUTUBE[mr.hero.id] || MR_VIDEOS.includes(mr.hero.id))} onClose={() => setMr(null)} />}
    </div>,
    document.body,
  )
}

// Après l'edit : la carte MR présentée en grand, avec ses rayons, ses braises et son nom.
const MrShowcase = ({ hero, dup, onClose }: { hero: Hero; dup: boolean; video: boolean; onClose: () => void }) => {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 900); return () => clearTimeout(t) }, [])
  return (
    <div className="mrs" role="dialog" aria-modal="true" aria-label={`${hero.name} obtenu`} onClick={() => { if (shown) onClose() }}>
      <span className="mrs__flash" aria-hidden="true" />
      <span className="mrs__rays" aria-hidden="true" />
      <span className="mrs__rays mrs__rays--2" aria-hidden="true" />
      <span className="mrs__embers" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ ['--x' as string]: `${(i * 37) % 100}%`, ['--d' as string]: `${(i % 7) * 0.45}s`, ['--s' as string]: `${3 + (i % 4)}px` }} />)}</span>
      <p className="mrs__kick">✦ MR obtenue ✦</p>
      <div className="mrs__card" onClick={(e) => e.stopPropagation()}><Card hero={hero} hd inert /></div>
      <div className="mrs__text">
        <h2>{hero.name}</h2>
        <p>{hero.title} · {hero.world} · <b>{dup ? 'Doublon' : 'Nouvelle carte'}</b> · <em>{RARITIES.rift.label}</em></p>
      </div>
      <button className="mrs__go" onClick={(e) => { e.stopPropagation(); onClose() }}>Continuer</button>
    </div>
  )
}
