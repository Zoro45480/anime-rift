import { useEffect, useRef, useState } from 'react'
import type { Hero } from '../data/heroes'
import { MR_VIDEOS } from '../data/mrVideos'

// « Edit » plein écran quand une carte MR tombe.
// Si une vidéo d'edit est fournie pour ce perso (dossier public/mr-videos, liste dans data/mrVideos.ts), c'est elle qui passe.
// Sinon, le jeu monte son propre edit avec l'image du perso : coupes, zooms, flashs, nom qui claque.
const videoOf = (heroId: string) => (MR_VIDEOS.includes(heroId) ? `mr-videos/${heroId}.mp4` : '')

export const EDIT_MS = 5600
const CUTS = [ // [début (ms), cadrage x %, cadrage y %, zoom, rotation] : zooms modérés pour garder l'image nette
  [0, 50, 18, 1.7, -3], [650, 35, 25, 1.45, 2], [1250, 65, 15, 1.6, -2], [1850, 50, 35, 1.3, 0], [2500, 50, 20, 1.9, 4], [3100, 50, 25, 1.05, 0],
] as const

export const MrEdit = ({ hero, art, onDone }: { hero: Hero; art: string; onDone: () => void }) => {
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
