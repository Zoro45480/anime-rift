import { useRef, type CSSProperties, type PointerEvent } from 'react'
import { AFFINITIES } from '../data/affinities'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { useStore } from '../state/store'
import { AffinityIcon } from './AffinityIcon'
import { CardOrnaments } from './CardOrnaments'
import { CardBurst } from './CardBurst'

type Props = { hero: Hero; count?: number; locked?: boolean; className?: string; style?: CSSProperties }

// La carte de personnage. Tout l'effet « feuille holographique » est piloté par deux variables :
// --px / --py = position du reflet (en %). Au repos elles se promènent toutes seules (voir ui.css) ;
// sous le doigt ou la souris, c'est le pointeur qui les commande et la carte s'incline.
export const Card = ({ hero, count, locked, className = '', style }: Props) => {
  const ref = useRef<HTMLDivElement>(null)
  const rarity = RARITIES[hero.rarity]
  const custom = useStore().customArt[hero.id]

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
    <div ref={ref} className={`card card--${hero.rarity} ${locked ? 'is-locked' : ''} ${className}`}
      style={{ ['--rc' as string]: rarity.color, ['--ac' as string]: AFFINITIES[hero.affinity].color, ['--delay' as string]: `${-hero.no * 0.9}s`, ...style }}
      onPointerMove={locked ? undefined : onMove} onPointerLeave={onLeave} onPointerCancel={onLeave}>
      <div className="card__tilt">
        <CardBurst rarity={hero.rarity} layer="back" />
        <div className="card__edge" />
        <div className="card__face">
          <div className="card__bg" />
          <div className="card__rays" />
          <img className={`card__art ${custom ? 'card__art--custom' : ''}`} src={custom ?? heroArt(hero.model, 'full')} alt="" loading="lazy" />
          <div className="card__shine" />
          <div className="card__glitter" />
          <div className="card__glare" />

          <span className="card__brand">RIFT</span>
          <span className="card__kana" lang="ja">{hero.kana}</span>
          <span className="card__affinity"><AffinityIcon id={hero.affinity} size={14} /></span>
          {count !== undefined && count > 1 && <span className="card__count">×{count}</span>}

          <div className="card__plate">
            <span className="card__name">{hero.name} <i>({hero.title})</i></span>
            <span className="card__world">{hero.world}</span>
            <span className="card__rule" />
            <span className="card__stats">
              <b><small>ATK</small>{hero.atk.toLocaleString('fr-FR')}</b>
              <b><small>DEF</small>{hero.def.toLocaleString('fr-FR')}</b>
              <em>N° {String(hero.no).padStart(4, '0')}</em>
            </span>
          </div>
          <CardOrnaments rarity={hero.rarity} />
        </div>
        <CardBurst rarity={hero.rarity} layer="front" />
        <span className="card__mono" data-t={rarity.short} aria-label={rarity.label}>{rarity.short}</span>
      </div>
    </div>
  )
}
