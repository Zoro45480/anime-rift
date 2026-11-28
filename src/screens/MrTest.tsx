import { useState } from 'react'
import { heroById, HEROES } from '../data/heroes'
import { createPortal } from 'react-dom'
import { MR_YOUTUBE } from '../data/mrVideos'
import { StoreProvider } from '../state/store'
import { InvocationDemo } from '../summon/InvocationDemo'
import { BANNERS } from '../data/banners'
import { CardViewerProvider } from '../ui/CardViewer'
import { YtEdit } from '../summon/MrEdit'

// Page de test des edits MR (adresse : …/?mrtest=naruto). Rien n'est enregistré : on règle le passage, on regarde, on recommence.
const ytId = (s: string) => s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(s) ? s : '')
const toSec = (s: string) => { const p = s.trim().split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0) }
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

export const MrTest = () => {
  const q = new URLSearchParams(location.search)
  const [heroId, setHeroId] = useState(q.get('mrtest') || 'naruto')
  const saved = MR_YOUTUBE[heroId]
  const [url, setUrl] = useState(q.get('yt') || saved?.id || 'https://youtu.be/XvioQrCOP24')
  const [start, setStart] = useState(fmt(Number(q.get('t') ?? saved?.start ?? 0)))
  const [end, setEnd] = useState(fmt(Number(q.get('fin') ?? saved?.end ?? 10)))
  const [play, setPlay] = useState(false)
  const [ended, setEnded] = useState(false)
  const [full, setFull] = useState(false)
  const hero = heroById(heroId) ?? heroById('naruto')
  const id = ytId(url)
  const s = toSec(start), e = Math.max(toSec(end), s + 1)
  const link = `${location.origin}${location.pathname}?mrtest=${hero.id}&yt=${id}&t=${s}&fin=${e}`
  return (
    <main className="mrtest">
      <h1>Test d'edit MR</h1>
      <p>Choisis le passage de la vidéo (minutes:secondes), puis appuie sur « Lancer ». C'est exactement ce que verra le joueur quand il tire la carte MR.</p>
      <label>Perso MR <select value={hero.id} onChange={(ev) => setHeroId(ev.target.value)}>{HEROES.filter((h) => h.rarity === 'rift').map((h) => <option key={h.id} value={h.id}>{h.name} ({h.world})</option>)}</select></label>
      <label>Lien YouTube <input value={url} onChange={(ev) => setUrl(ev.target.value)} /></label>
      <div className="mrtest__row">
        <label>Début <input value={start} onChange={(ev) => setStart(ev.target.value)} placeholder="0:45" /></label>
        <label>Fin <input value={end} onChange={(ev) => setEnd(ev.target.value)} placeholder="0:55" /></label>
        <span>Durée : {e - s} s</span>
      </div>
      <button className="mrtest__go" disabled={!id} onClick={() => { setEnded(false); setPlay(true) }}>▶ Lancer l'edit</button>
      <button className="mrtest__go mrtest__go--full" disabled={!id} onClick={() => { MR_YOUTUBE[hero.id] = { id, start: s, end: e }; setFull(true) }}>✦ Tester l'invocation ×10 avec cette MR (nouvel écran)</button>
      <p className="mrtest__note">Ouvre la faille, puis révèle les cartes une par une ou touche « Tout révéler » : l'edit de {hero.name} se lance, puis sa carte en grand. C'est un test : aucune clé n'est dépensée et rien n'est ajouté à ta collection.</p>
      {ended && <p className="mrtest__done">Fin de l'edit : ici la carte MR de {hero.name} apparaît.</p>}
      <p className="mrtest__link">Quand c'est bon, envoie-moi ces réglages : <b>{hero.name} · {fmt(s)} → {fmt(e)}</b><br /><small>{link}</small></p>
      {play && id && <YtEdit hero={hero} clip={{ id, start: s, end: e }} onDone={() => { setPlay(false); setEnded(true) }} />}
      {full && createPortal(<StoreProvider><CardViewerProvider><InvocationDemo banner={BANNERS.find((b) => b.pool.includes(hero.world)) ?? BANNERS[0]} count={10} test={hero.id} onClose={() => setFull(false)} /></CardViewerProvider></StoreProvider>, document.body)}
    </main>
  )
}
