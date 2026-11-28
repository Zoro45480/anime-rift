import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, COST, type Banner } from '../data/banners'
import { HEROES, type Hero } from '../data/heroes'
import type { RarityId } from '../data/rarities'
import { MR_VIDEOS, MR_YOUTUBE } from '../data/mrVideos'
import { heroArt, iconArt } from '../assets/manifest'
import { useStore, type Currency } from '../state/store'
import { primeAudio } from './audio'
import { MrEdit } from './MrEdit'
// La démo d'invocation, reprise TELLE QUELLE (demo/invocation.html : CSS, shaders et JavaScript inchangés).
// Seuls changent : le tirage (fait ici par le jeu, avec la pity), l'image des persos, les soldes du joueur et DEMO_MR = false.
import page from './demo/invocation.html?raw'

const files = import.meta.glob('./demo/{bg.jpg,logo.webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cadres = import.meta.glob('./demo/cadres/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const RANK: Record<RarityId, number> = { common: 0, rare: 1, epic: 2, ultra: 3, legend: 4, rift: 5 }

export const InvocationDemo = ({ banner, count = 10, currency = 'ticket', onClose }: { banner: Banner; count?: number; currency?: Currency; onClose: () => void }) => {
  const store = useStore()
  const live = useRef(store)
  live.current = store
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [edit, setEdit] = useState<Hero | null>(null)
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
      .replace('<body>', `<body><script>window.CADRES=${JSON.stringify(map)}</script>`)
  }, [])

  const send = (m: unknown) => frame.current?.contentWindow?.postMessage(m, '*')
  const balance = () => {
    const s = live.current
    send({ type: 'balance', tickets: s.tickets, gems: s.gems, pity: s.pity[banner.id] ?? 0, ct: COST.ticket, cg: COST.gems })
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const m = e.data as { type: string; n?: number; pay?: string; id?: string }
      const s = live.current
      if (m.type === 'ready') {
        balance()
        send({ type: 'open', banner: BANNERS.indexOf(banner), n: count, pay: currency === 'ticket' ? 't' : 'g', ends: BANNERS.map((b) => Date.parse(b.endsAt)) })
        setTimeout(() => setReady(true), 60)
        frame.current?.focus()
      }
      if (m.type === 'pull') {
        primeAudio()
        const before = s.owned
        const heroes = s.summon(banner, m.pay === 't' ? 'ticket' : 'gems', m.n ?? 1) // le vrai tirage, AVANT l'animation
        if (!heroes) { send({ type: 'pulled', pulls: null }); return }
        const seen: Record<string, number> = {}
        send({ type: 'pulled', pulls: heroes.map((h) => {
          const dup = (before[h.id] ?? 0) + (seen[h.id] ?? 0) > 0
          seen[h.id] = (seen[h.id] ?? 0) + 1
          return { id: h.id, k: RANK[h.rarity], name: h.name, dup, atk: h.atk, def: h.def, img: s.customArt[h.id] ?? s.remoteArt[h.id] ?? heroArt(h.model, 'full') }
        }) })
      }
      if (m.type === 'mr' && m.id && (MR_YOUTUBE[m.id] || MR_VIDEOS.includes(m.id))) setEdit(HEROES.find((h) => h.id === m.id) ?? null)
      if (m.type === 'close') done.current()
      if (m.type === 'collection') { done.current(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'collection' })) }
    }
    addEventListener('message', onMsg)
    return () => removeEventListener('message', onMsg)
  }, [banner, count, currency]) // eslint-disable-line react-hooks/exhaustive-deps

  // soldes et pity tenus à jour dans la démo
  useEffect(() => { if (ready) balance() }, [ready, store.tickets, store.gems, store.pity]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  return createPortal(
    <div className="inv">
      <iframe ref={frame} className={`inv__frame ${ready ? 'is-ready' : ''}`} srcDoc={doc} title={`Invocation · ${banner.world}`} allow="autoplay; fullscreen" />
      {edit && <div className="inv__edit"><MrEdit hero={edit} art={store.customArt[edit.id] ?? store.remoteArt[edit.id] ?? heroArt(edit.model, 'full')} onDone={() => setEdit(null)} /></div>}
    </div>,
    document.body,
  )
}
