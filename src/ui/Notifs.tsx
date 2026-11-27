import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { extraArt, gateArt, iconArt, uiArt } from '../assets/manifest'
import { ENERGY_MAX } from '../game/progression'
import type { Notif } from '../state/store'
import { useBusy } from './busy'

// Chaque sorte de notification a son titre, sa couleur et son icône (les objets 3D du jeu).
const KINDS: Record<Notif['kind'] | 'energy', { title: string; hue: string; icon: string }> = {
  pull: { title: 'Gros tirage', hue: '#ff5d7a', icon: iconArt('seal') },
  level: { title: 'Niveau de compte', hue: '#ffc94d', icon: iconArt('bolt') },
  saga: { title: 'L’Aventure', hue: '#2bc8d9', icon: gateArt('saga') },
  drop: { title: 'Parchemin obtenu', hue: '#a56bff', icon: iconArt('scroll-medium') },
  rebirth: { title: 'Ascension', hue: '#ff9a4a', icon: gateArt('rebirth') },
  ach: { title: 'Succès débloqué', hue: '#b78bff', icon: extraArt('dist-trophy') },
  bazaar: { title: 'Bazar', hue: '#ffc94d', icon: uiArt('nav-bazaar') },
  quest: { title: 'Contrat accompli', hue: '#4be3a4', icon: uiArt('nav-contracts') },
  free: { title: 'Carte libérée', hue: '#7ff0ff', icon: iconArt('shard') },
  energy: { title: 'Flux plein', hue: '#ffd24d', icon: iconArt('bolt') },
}
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000)
  return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `il y a ${Math.floor(m / 1440)} j`
}
const dayOf = (t: number) => {
  const d = new Date(t), now = new Date()
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  return days === 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : 'Plus tôt'
}

const Row = ({ kind, text, time, fresh, onGo }: { kind: keyof typeof KINDS; text: string; time?: string; fresh?: boolean; onGo: NotifGo }) => (
  <li className={`nt ${fresh ? 'is-new' : ''}`} style={{ ['--nc' as string]: KINDS[kind].hue }} onClick={() => onGo(kind)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onGo(kind) }}>
    <span className="nt__icon"><img src={KINDS[kind].icon} alt="" /></span>
    <span className="nt__body"><b>{KINDS[kind].title}</b><span>{text}</span></span>
    {time && <time>{time}</time>}
    {fresh && <i className="nt__dot" aria-label="Nouveau" />}
  </li>
)

// Panneau des notifications : un volet qui descend du haut de l'écran, rangé par jour.
export const NotifPanel = ({ notifs, full, onClear, onClose, onGo }: { notifs: Notif[]; full: boolean; onClear: () => void; onClose: () => void; onGo: NotifGo }) => {
  const go: NotifGo = (k) => { onClose(); onGo(k) }
  const unread = notifs.filter((x) => !x.read).length
  const days = ['Aujourd’hui', 'Hier', 'Plus tôt'].map((day) => ({ day, items: notifs.filter((x) => dayOf(x.t) === day) })).filter((g) => g.items.length)
  return createPortal(
    <div className="nt-back" onClick={onClose}>
      <section className="nt-panel" role="dialog" aria-modal="true" aria-label="Notifications" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><h2>Notifications</h2><p>{unread > 0 ? `${unread} nouvelle${unread > 1 ? 's' : ''}` : notifs.length ? 'Tout est lu' : 'Aucune pour l’instant'}</p></div>
          {notifs.length > 0 && <button className="nt-panel__clear" onClick={onClear}>Tout effacer</button>}
          <button className="nt-panel__close" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <div className="nt-panel__list">
          {full && <ul><Row kind="energy" text={`Tes ${ENERGY_MAX} éclairs sont prêts : L’Aventure t’attend.`} onGo={go} /></ul>}
          {days.map((g) => (
            <div key={g.day}>
              <h3>{g.day}</h3>
              <ul>{g.items.map((x) => <Row key={x.id} kind={x.kind} text={x.text} time={ago(x.t)} fresh={!x.read} onGo={go} />)}</ul>
            </div>
          ))}
          {notifs.length === 0 && !full && (
            <div className="nt-empty">
              <span className="kiri" style={{ width: 96, height: 96, backgroundImage: `url(${extraArt('guide')})` }} aria-hidden="true" />
              <b>Rien de nouveau</b>
              <p>Tes gros tirages, tes niveaux, les arcs terminés et les parchemins rares arriveront ici.</p>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

// Où mène chaque sorte de notification quand on la touche.
export type NotifGo = (kind: Notif['kind'] | 'energy') => void

// Petite bannière qui glisse en haut de l'écran quand une notification arrive, puis repart toute seule.
// Les nouvelles se mettent en file ; pendant une invocation ou un combat, elles attendent la fin.
export const NotifToast = ({ notifs, muted, onGo }: { notifs: Notif[]; muted: boolean; onGo: NotifGo }) => {
  const busy = useBusy()
  const [queue, setQueue] = useState<Notif[]>([])
  const last = useRef(notifs[0]?.id ?? 0) // ne pas rejouer les anciennes au chargement
  const seen = useRef(new Set(notifs.map((x) => x.id)))
  useEffect(() => {
    const fresh = notifs.filter((x) => !seen.current.has(x.id) && !x.read)
    notifs.forEach((x) => seen.current.add(x.id))
    last.current = notifs[0]?.id ?? last.current
    if (fresh.length) setQueue((q) => [...q, ...fresh.reverse()].slice(-6))
  }, [notifs])
  const shown = !busy && !muted ? queue[0] : undefined
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4200)
    return () => clearTimeout(t)
  }, [shown])
  if (!shown) return null
  const k = KINDS[shown.kind]
  return createPortal(
    <div key={shown.id} className="nt-toast" style={{ ["--nc" as string]: k.hue }} role="status">
      <button className="nt-toast__main" onClick={() => { setQueue((q) => q.slice(1)); onGo(shown.kind) }}>
        <span className="nt__icon"><img src={k.icon} alt="" /></span>
        <span className="nt__body"><b>{k.title}</b><span>{shown.text}</span></span>
        {queue.length > 1 && <em className="nt-toast__more">+{queue.length - 1}</em>}
      </button>
      <button className="nt-toast__x" onClick={() => setQueue((q) => q.slice(1))} aria-label="Fermer la notification">×</button>
    </div>,
    document.body,
  )
}
