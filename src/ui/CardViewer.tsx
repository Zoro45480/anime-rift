import { createContext, useRef, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AFFINITIES } from '../data/affinities'
import { BANNERS } from '../data/banners'
import { roleKind, type Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { cardRate } from '../game/gacha'
import { cardState } from '../game/progression'
import { useStore } from '../state/store'
import { AffinityIcon } from './AffinityIcon'
import { Card } from './Card'
import { CardDetail } from './CardDetail'

// Visionneuse de carte : un clic sur n'importe quelle carte du jeu l'ouvre en grand ;
// un clic sur la carte la retourne et montre sa fiche ; « En savoir plus » ouvre la page complète de la carte.

type Viewer = { open: (hero: Hero) => void }
const Ctx = createContext<Viewer | null>(null)
export const useCardViewer = () => useContext(Ctx)

export const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`
export const bannerOf = (hero: Hero) => BANNERS.find((b) => b.pool.includes(hero.world))

const Sheet = ({ hero, onClose, onMore }: { hero: Hero; onClose: () => void; onMore: () => void }) => {
  const [flipped, setFlipped] = useState(false)
  const { owned, xp, wish, toggleWish, rebirths, awakened, teamNow } = useStore()
  const rarity = RARITIES[hero.rarity]
  const banner = bannerOf(hero)
  const rate = banner ? cardRate(banner, hero) : 0
  const copies = owned[hero.id] ?? 0
  const state = cardState(hero, xp, owned, rebirths, awakened, teamNow)
  const wished = wish.includes(hero.id)

  // Gyroscope : sur téléphone, la carte s'incline et ses reflets bougent quand on penche l'appareil.
  const front = useRef<HTMLSpanElement>(null)
  const [gyro, setGyro] = useState(false)
  const canGyro = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches
  useEffect(() => {
    if (!gyro) return
    const card = front.current?.querySelector<HTMLElement>('.card')
    if (!card) return
    const onTilt = (e: DeviceOrientationEvent) => {
      const x = Math.min(1, Math.max(0, ((e.gamma ?? 0) + 30) / 60))
      const y = Math.min(1, Math.max(0, ((e.beta ?? 45) - 15) / 60))
      card.classList.add('is-live')
      card.style.setProperty('--px', `${x * 100}%`); card.style.setProperty('--py', `${y * 100}%`)
      card.style.setProperty('--ang', `${x * 300 + y * 60}deg`)
      card.style.setProperty('--rx', `${(0.5 - y) * 16}deg`); card.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
    }
    window.addEventListener('deviceorientation', onTilt)
    return () => { window.removeEventListener('deviceorientation', onTilt); card.classList.remove('is-live') }
  }, [gyro])
  const toggleGyro = async () => {
    if (gyro) return setGyro(false)
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    if (ask) { try { if ((await ask()) === 'denied') return } catch { return } } // iPhone : il faut l'autorisation
    setGyro(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="cv" role="dialog" aria-modal="true" aria-label={`Carte ${hero.name}`} onClick={onClose}>
      <button className="cv__close" onClick={onClose} aria-label="Fermer">×</button>
      <div className="cv__stage" onClick={(e) => e.stopPropagation()}>
        <div className={`cv__flip ${flipped ? 'is-flipped' : ''}`} role="button" tabIndex={0} onClick={() => setFlipped(!flipped)}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFlipped(!flipped) } }}
          aria-label={flipped ? 'Revoir la carte' : 'Retourner la carte pour voir sa fiche'}>
          <span className="cv__face cv__face--front" ref={front}><Card hero={hero} inert hd /></span>
          <span className="cv__face cv__face--back" style={{ ['--rc' as string]: rarity.color }}>
            <span className="cv__head"><b>{rarity.short}</b><i>N° {String(hero.no).padStart(4, '0')}</i></span>
            <span className="cv__name">{hero.name}</span>
            <span className="cv__kana" lang="ja">{hero.kana}</span>
            <span className="cv__world">{hero.title} · {hero.world}</span>
            <span className="cv__tags">
              <span className={`role role--${roleKind(hero.role)}`}>{hero.role}</span>
              <span><AffinityIcon id={hero.affinity} size={13} />{AFFINITIES[hero.affinity].label}</span>
              <span>{rarity.label}</span>
            </span>
            <span className="cv__boxes">
              <span><small>Exemplaires possédés</small><b>{copies}</b></span>
              <span><small>Chance par invocation</small><b>{rate ? pct(rate) : '—'}</b></span>
            </span>
            <span className="cv__stats">
              <span><small>PV</small><b>{state.stats.hp.toLocaleString('fr-FR')}</b></span>
              <span><small>Dégâts</small><b>{state.stats.atk.toLocaleString('fr-FR')}</b></span>
              <span><small>Défense</small><b>{state.stats.def.toLocaleString('fr-FR')}</b></span>
              <span><small>Niveau</small><b>{copies ? state.level : '—'}</b></span>
            </span>
            <span className="cv__source">{hero.rarity !== 'rift' ? 'Toutes les bannières' : banner ? `Bannière ${banner.world} seulement` : 'Hors bannière'}{rate ? ` · 1 chance sur ${Math.round(1 / rate).toLocaleString('fr-FR')}` : ''}</span>
            <span className="cv__actions">
              <button className={`cv__act ${wished ? 'is-on' : ''}`} aria-pressed={wished} onClick={(e) => { e.stopPropagation(); toggleWish(hero.id) }}>{wished ? '♥ Dans mes envies' : '♡ Ajouter aux envies'}</button>
              <button className="cv__act cv__act--main" onClick={(e) => { e.stopPropagation(); onMore() }}>En savoir plus ↗</button>
            </span>
          </span>
        </div>
        <p className="cv__hint">{flipped ? 'Touche la fiche pour revoir la carte' : 'Touche la carte pour la retourner'}</p>
        {canGyro && !flipped && <button className={`cv__gyro ${gyro ? 'is-on' : ''}`} aria-pressed={gyro} onClick={() => void toggleGyro()}>{gyro ? '✦ Penche ton téléphone' : '✦ Bouger avec le téléphone'}</button>}
      </div>
    </div>,
    document.body,
  )
}

export const CardViewerProvider = ({ children }: { children: ReactNode }) => {
  const [hero, setHero] = useState<Hero | null>(null)
  const [detail, setDetail] = useState(false)
  const viewer = useMemo<Viewer>(() => ({ open: (h) => { setHero(h); setDetail(false) } }), [])
  const close = () => { setHero(null); setDetail(false) }
  return (
    <Ctx.Provider value={viewer}>
      {children}
      {hero && !detail && <Sheet key={hero.id} hero={hero} onClose={close} onMore={() => setDetail(true)} />}
      {hero && detail && <CardDetail key={hero.id} hero={hero} onClose={close} onOpen={setHero} />}
    </Ctx.Provider>
  )
}
