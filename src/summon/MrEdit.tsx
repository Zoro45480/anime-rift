import { useEffect, useRef, useState } from 'react'
import type { Hero } from '../data/heroes'

// « Edit » plein écran quand une carte MR tombe.
// Si le joueur a choisi une vidéo pour ce perso (lien collé sur sa fiche), c'est elle qui passe.
// Sinon, le jeu monte son propre edit avec l'image du perso : coupes, zooms, flashs, nom qui claque.
const KEY = 'anime-rift-mr-videos'
export const getMrVideos = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string> } catch { return {} } }
export const setMrVideo = (heroId: string, url: string) => {
  const all = getMrVideos()
  if (url.trim()) all[heroId] = url.trim(); else delete all[heroId]
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* rien */ }
}
// Lien YouTube (watch, shorts, youtu.be) → identifiant de la vidéo
export const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)?.[1] ?? null
export const isVideoUrl = (url: string) => Boolean(youtubeId(url)) || /^https:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(url)

export const EDIT_MS = 5600
const CUTS = [ // [début (ms), cadrage x %, cadrage y %, zoom, rotation] : zooms modérés pour garder l'image nette
  [0, 50, 18, 1.7, -3], [650, 35, 25, 1.45, 2], [1250, 65, 15, 1.6, -2], [1850, 50, 35, 1.3, 0], [2500, 50, 20, 1.9, 4], [3100, 50, 25, 1.05, 0],
] as const

export const MrEdit = ({ hero, art, onDone }: { hero: Hero; art: string; onDone: () => void }) => {
  const video = getMrVideos()[hero.id]
  const yt = video ? youtubeId(video) : null
  const [cut, setCut] = useState(0)
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
      {yt ? <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1`} title={`Edit de ${hero.name}`} allow="autoplay; encrypted-media" />
        : <video src={video} autoPlay playsInline onEnded={() => done.current()} onError={() => done.current()} />}
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
