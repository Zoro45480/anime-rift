import { useEffect, useRef, useState } from 'react'
import type { Hero } from '../data/heroes'
import { MR_VIDEOS, MR_YOUTUBE, type YtClip } from '../data/mrVideos'
import { getPackVolume } from './audio'

// « Edit » plein écran quand une carte MR tombe.
// Si une vidéo d'edit est fournie pour ce perso (dossier public/mr-videos, liste dans data/mrVideos.ts), c'est elle qui passe.
// Sinon, le jeu monte son propre edit avec l'image du perso : coupes, zooms, flashs, nom qui claque.
const videoOf = (heroId: string) => (MR_VIDEOS.includes(heroId) ? `mr-videos/${heroId}.mp4` : '')

export const EDIT_MS = 5600
const CUTS = [ // [début (ms), cadrage x %, cadrage y %, zoom, rotation] : zooms modérés pour garder l'image nette
  [0, 50, 18, 1.7, -3], [650, 35, 25, 1.45, 2], [1250, 65, 15, 1.6, -2], [1850, 50, 35, 1.3, 0], [2500, 50, 20, 1.9, 4], [3100, 50, 25, 1.05, 0],
] as const

// Lecteur YouTube officiel, sans commandes, du début à la fin choisis. Bouton « Passer » au bout de 2 secondes.
export const YtEdit = ({ hero, clip, onDone }: { hero: Hero; clip: YtClip; onDone: () => void }) => {
  const [skip, setSkip] = useState(false)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const a = window.setTimeout(() => setSkip(true), 2000)
    const b = window.setTimeout(() => done.current(), (clip.end - clip.start) * 1000 + 4000) // filet de sécurité si le lecteur ne donne pas son temps
    const onMsg = (e: MessageEvent) => { // le lecteur signale la fin de la vidéo
      if (!/youtube/.test(e.origin) || typeof e.data !== 'string') return
      try {
        const d = JSON.parse(e.data)
        if (d.event === 'onStateChange' && d.info === 0) done.current()
        // on coupe juste avant la fin du passage : les suggestions de fin de YouTube n'ont pas le temps d'apparaître
        if (d.event === 'infoDelivery' && typeof d.info?.currentTime === 'number' && d.info.currentTime >= clip.end - 0.35) done.current()
      } catch { /* message d'un autre type */ }
    }
    window.addEventListener('message', onMsg)
    return () => { window.clearTimeout(a); window.clearTimeout(b); window.removeEventListener('message', onMsg) }
  }, [clip])
  const q = new URLSearchParams({ autoplay: '1', start: String(clip.start), end: String(clip.end), controls: '0', rel: '0', playsinline: '1', modestbranding: '1', iv_load_policy: '3', disablekb: '1', enablejsapi: '1', origin: location.origin })
  return (
    <div className="mredit mredit--video">
      <iframe className="mredit__yt" src={`https://www.youtube-nocookie.com/embed/${clip.id}?${q}`} title={`Edit de ${hero.name}`} allow="autoplay; encrypted-media; fullscreen" tabIndex={-1}
        onLoad={(e) => { const w = e.currentTarget.contentWindow; w?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); const v = Math.round(getPackVolume() * 100); [300, 1200, 2500].forEach((ms) => setTimeout(() => w?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [v] }), '*'), ms)) }} />
      <span className="mredit__shield" aria-hidden="true" />
      <p className="mredit__tag"><b>MR</b>{hero.name}</p>
      {skip && <button className="mredit__skip" onClick={() => done.current()}>Passer ›</button>}
    </div>
  )
}

export const MrEdit = ({ hero, art, onDone }: { hero: Hero; art: string; onDone: () => void }) => {
  const yt = MR_YOUTUBE[hero.id]
  if (yt) return <YtEdit hero={hero} clip={yt} onDone={onDone} />
  return <MrEditOwn hero={hero} art={art} onDone={onDone} />
}

const MrEditOwn = ({ hero, art, onDone }: { hero: Hero; art: string; onDone: () => void }) => {
  const video = videoOf(hero.id)
  const [cut, setCut] = useState(0)
  const vidRef = useRef<HTMLVideoElement>(null)
  // d'abord avec le son ; si le navigateur le refuse, la vidéo part en muet plutôt que de ne pas partir
  useEffect(() => {
    const v = vidRef.current
    if (!v) return
    v.muted = false
    v.play().catch(() => { v.muted = true; void v.play().catch(() => done.current()) })
  }, [video])
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (video) {
      const t = window.setTimeout(() => done.current(), 30_000) // une vidéo trop longue s'arrête d'elle-même
      return () => window.clearTimeout(t)
    }
    const timers = CUTS.map(([at], i) => window.setTimeout(() => setCut(i), at))
    timers.push(window.setTimeout(() => done.current(), EDIT_MS))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [video])

  if (video) return (
    <div className="mredit mredit--video">
      <video ref={vidRef} src={video} playsInline preload="auto" onEnded={() => done.current()} onError={() => done.current()} />
      <p className="mredit__tag"><b>MR</b>{hero.name}</p>
    </div>
  )

  const [, x, y, z, r] = CUTS[cut]
  const finale = cut === CUTS.length - 1
  return (
    <div className={`mredit mredit--cut${cut} ${finale ? 'is-finale' : ''}`} key={cut}>
      <div className="mredit__img" style={{ backgroundImage: art ? `url("${art}")` : undefined, backgroundPosition: `${x}% ${y}%`, ['--z' as string]: z, ['--r' as string]: `${r}deg` }} />
      <div className="mredit__rgb" style={{ backgroundImage: art ? `url("${art}")` : undefined, backgroundPosition: `${x}% ${y}%`, ['--z' as string]: z, ['--r' as string]: `${r}deg` }} />
      <div className="mredit__lines" />
      <div className="mredit__flash" />
      <span className="mredit__kana" lang="ja">{hero.kana}</span>
      {cut === 0 && <p className="mredit__word">MYTHE<br />RIFT</p>}
      {finale && <div className="mredit__name"><small>{hero.world}</small><h2>{hero.name}</h2><em>{hero.title}</em></div>}
      <div className="mredit__bars" />
    </div>
  )
}
