import { AFFINITIES } from '../data/affinities'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { CardFrame } from './CardFrame'

type Props = { hero: Hero; count?: number; locked?: boolean; className?: string; style?: React.CSSProperties }

// La carte de personnage : cadre selon la rareté, illustration, nom, statistiques, numéro de série.
export const Card = ({ hero, count, locked, className = '', style }: Props) => {
  const rarity = RARITIES[hero.rarity]
  return (
    <div className={`card card--${hero.rarity} ${locked ? 'is-locked' : ''} ${className}`}
      style={{ ['--rc' as string]: rarity.color, ['--ac' as string]: AFFINITIES[hero.affinity].color, ...style }}>
      <div className="card__body">
        <div className="card__rays" />
        <img className="card__art" src={heroArt(hero.model, 'full')} alt="" loading="lazy" />
        <div className="card__foil" />
        <span className="card__rarity">{rarity.short}</span>
        {count !== undefined && count > 1 && <span className="card__count">×{count}</span>}
        <div className="card__plate">
          <span className="card__name">{hero.name} <i>({hero.title})</i></span>
          <span className="card__world">{hero.world}</span>
          <span className="card__stats"><b><small>ATK</small>{hero.atk.toLocaleString('fr-FR')}</b><b><small>DEF</small>{hero.def.toLocaleString('fr-FR')}</b><em>N° {String(hero.no).padStart(4, '0')}</em></span>
        </div>
      </div>
      <CardFrame rarity={hero.rarity} />
    </div>
  )
}
