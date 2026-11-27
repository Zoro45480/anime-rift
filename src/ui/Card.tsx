import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { AFFINITIES } from '../data/affinities'
import { frameOf } from '../data/banners'
import { roleKind, type Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { cardState, titleOf } from '../game/progression'
import { getTitleMode } from './graphics'
import { extraArt, frameArt, frameFx, heroArt, mrFrameArt, nrFrameArt } from '../assets/manifest'
import { MR_THEMES, startMrFx } from './mrFx'
import { useStore } from '../state/store'
import { AffinityIcon } from './AffinityIcon'
import { useCardViewer } from './CardViewer'

// `inert` : la carte ne s'ouvre pas au clic (c'est le cas dans la visionneuse elle-même).
// `hd` : carte affichée en grand, avec le cadre en pleine définition.
type Props = { hero: Hero; count?: number; locked?: boolean; inert?: boolean; hd?: boolean; className?: string; style?: CSSProperties }

// La carte de personnage. Tout l'effet « feuille holographique » est piloté par deux variables :
// --px / --py = position du reflet (en %). Au repos elles se promènent toutes seules (voir ui.css) ;
// sous le doigt ou la souris, c'est le pointeur qui les commande et la carte s'incline.
export const Card = ({ hero, count, locked, inert, hd, className = '', style }: Props) => {
  const viewer = useCardViewer()
  const openable = !inert && viewer !== null
  const ref = useRef<HTMLDivElement>(null)
  const rarity = RARITIES[hero.rarity]
  const { customArt, remoteArt, xp, owned, wish, rebirths, awakened, teamNow, arcHeroes } = useStore()
  const custom = customArt[hero.id]
  const state = cardState(hero, xp, owned, rebirths, awakened, teamNow) // niveau et statistiques réels de la carte chez le joueur
  const title = owned[hero.id] && (hd || getTitleMode() === 'all') ? titleOf(hero, state.level, state.freed, Boolean(arcHeroes[hero.id])) : null
  const [failed, setFailed] = useState('') // adresse AniList qui n'a pas pu s'afficher
  const remote = remoteArt[hero.id] && remoteArt[hero.id] !== failed ? remoteArt[hero.id] : undefined
  // ordre : l'image choisie par le joueur, puis le portrait officiel chargé depuis AniList, sinon le portrait de remplacement
  const art = custom ?? remote ?? heroArt(hero.model, 'full')
  // MR : cadre dessiné propre à son univers, lueur à sa couleur, et particules animées sur la carte en grand
  const theme = frameOf(hero.world)
  const mrSrc = hero.rarity === 'rift' ? mrFrameArt(theme, hd) : ''
  const nrSrc = hero.rarity === 'common' || hero.rarity === 'rare' || hero.rarity === 'legend' ? nrFrameArt(hero.rarity, theme, hd) : ''
  const fxRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!mrSrc || !fxRef.current || document.documentElement.dataset.fxchoice === 'low') return // coupé seulement si le joueur a choisi « Fluide »
    return startMrFx(fxRef.current, theme, hd ? 1 : 0.8)
  }, [mrSrc, hd, theme])

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current!
    const b = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width))
    const y = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))
    el.classList.add('is-live')
    el.style.setProperty('--px', `${x * 100}%`)
    el.style.setProperty('--py', `${y * 100}%`)
    el.style.setProperty('--ang', `${x * 300 + y * 60}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
  }
  const onLeave = () => {
    const el = ref.current!
    el.classList.remove('is-live')
    for (const p of ['--px', '--py', '--ang', '--rx', '--ry']) el.style.removeProperty(p)
  }

  return (
    <div ref={ref} className={`card card--${hero.rarity} ${mrSrc ? 'card--mrframe' : ''} ${nrSrc ? 'card--nrframe' : ''} ${locked ? 'is-locked' : ''} ${className}`}
      style={{ ['--rc' as string]: rarity.color, ['--ac' as string]: AFFINITIES[hero.affinity].color, ...(mrSrc ? { ['--mr-glow' as string]: MR_THEMES[theme]?.glow ?? '#ff3d9a' } : {}), ['--delay' as string]: `${-hero.no * 0.9}s`, ...style }}
      {...(openable ? { role: 'button', tabIndex: 0, 'aria-label': `Voir la carte ${hero.name}`, onClick: () => viewer.open(hero), onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); viewer.open(hero) } } } : {})}
      onPointerMove={locked ? undefined : onMove} onPointerLeave={onLeave} onPointerCancel={onLeave}>
      <div className="card__tilt">
        <div className="card__face">
          <div className="card__bg" />
          <div className="card__rays" />
          {art ? (
            <img className={`card__art ${custom || remote ? 'card__art--custom' : ''}`} src={art} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => { if (!custom && remote) setFailed(remote) }} />
          ) : (
            // pas d'image (pas encore chargée, ou en échec) : portrait de remplacement = couleur de l'affinité + initiale
            <span className="card__blank card__blank--initial" aria-hidden="true">{hero.name[0]}</span>
          )}
          <div className="card__shine" />
          <div className="card__glitter" />
          <div className="card__glare" />

          <span className="card__brand">RIFT</span>
          <span className="card__kana" lang="ja">{hero.kana}</span>
          <span className="card__affinity"><AffinityIcon id={hero.affinity} size={14} /></span>
          {count !== undefined && count > 1 && <span className="card__count">×{count}</span>}
          {owned[hero.id] > 0 && (state.level > 1 || state.freed) && <span className={`card__level ${state.freed ? 'card__level--free' : ''}`}>{state.freed ? '✦ ' : ''}Nv {state.level}</span>}
          {wish.includes(hero.id) && <span className="card__wish" aria-label="Dans mes envies">♥</span>}

          <div className="card__plate">
            <span className="card__name">{hero.name} <i>({hero.title})</i></span>
            <span className="card__world">{hero.world} · <span className={`role role--${roleKind(hero.role)}`}>{hero.role}</span></span>
            <span className="card__rule" />
            <span className="card__stats">
              <b><small>Dégâts</small>{locked ? '?' : state.stats.atk.toLocaleString('fr-FR')}</b>
              <b><small>Défense</small>{locked ? '?' : state.stats.def.toLocaleString('fr-FR')}</b>
              <em>N° {String(hero.no).padStart(4, '0')}{owned[hero.id] > 0 ? ` · ex. ${owned[hero.id]}` : ''}</em>
            </span>
          </div>
        </div>
        {mrSrc ? <>
          <img className={`card__frame card__frame--mr card__frame--mr-${theme}`} src={mrSrc} alt="" decoding="async" />
          <span className={`card__mrshine card__frame--mr-${theme}`} style={{ WebkitMaskImage: `url("${mrSrc}")`, maskImage: `url("${mrSrc}")` }} aria-hidden="true" />
          <canvas ref={fxRef} className="card__mrfx" aria-hidden="true" />
        </> : nrSrc ? <img className={`card__frame card__frame--nr card__frame--nr-${hero.rarity}-${theme}`} src={nrSrc} alt="" decoding="async" /> : <>
          <img className="card__frame" src={frameArt(hero.rarity, frameOf(hero.world), hd)} alt="" decoding="async" />
          <img className={`card__fx ${frameOf(hero.world) === 'naruto' ? '' : 'card__fx--own'}`} src={frameFx(hero.rarity, frameOf(hero.world), hd)} alt="" decoding="async" />
        </>}
        {title && <span className={`card__title card__title--${title.tier} card__title--${frameOf(hero.world)}`}><img src={extraArt(`ribbon-${frameOf(hero.world)}`)} alt="" /><b>{title.name}</b></span>}
        <span className="card__mono" data-t={rarity.short} aria-label={rarity.label}>{rarity.short}</span>
      </div>
    </div>
  )
}

// Carte montée seulement quand elle approche de l'écran, et démontée quand elle s'en éloigne : une grille de
// 210 cartes ne garde ainsi en mémoire que les quelques dizaines visibles.
export const LazyCard = (props: Props) => {
  const slot = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (!slot.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '600px' })
    io.observe(slot.current)
    return () => io.disconnect()
  }, [])
  return <div ref={slot} className="card-slot">{near && <Card {...props} />}</div>
}
