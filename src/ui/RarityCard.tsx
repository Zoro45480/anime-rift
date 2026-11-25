import { useRef, type PointerEvent } from 'react'
import { AFFINITIES, type AffinityId } from '../data/affinities'
import { RARITIES, type RarityId } from '../data/rarities'
import { resolveImage } from '../assets/manifest'
import { HeroSilhouette } from '../art/HeroSilhouette'
import { AffinityIcon } from './AffinityIcon'

export type CardData = { id: string; name: string; title: string; role: string; rarity: RarityId; affinity: AffinityId; level: number; seed: number }

type Props = { data: CardData; selected?: boolean; onSelect?: (id: string) => void }

export const RarityCard = ({ data, selected, onSelect }: Props) => {
  const ref = useRef<HTMLButtonElement>(null)
  const rarity = RARITIES[data.rarity]
  const image = resolveImage(`hero.${data.id}.card`)

  // Inclinaison 3D qui suit le pointeur + reflet holographique.
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current!
    const b = el.getBoundingClientRect()
    const x = (e.clientX - b.left) / b.width
    const y = (e.clientY - b.top) / b.height
    el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 16}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }
  const onLeave = () => {
    const el = ref.current!
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <button ref={ref} className={`rcard rcard--${data.rarity} ${selected ? 'is-selected' : ''}`}
      style={{ ['--rc' as string]: rarity.color }} onPointerMove={onMove} onPointerLeave={onLeave}
      onClick={() => onSelect?.(data.id)} aria-pressed={selected}>
      <span className="rcard__frame">
        <span className="rcard__art">
          {image ? <img src={image} alt="" loading="lazy" /> : <HeroSilhouette seed={data.seed} color={AFFINITIES[data.affinity].color} />}
        </span>
        <span className="rcard__holo" />
        <span className="rcard__top">
          <span className="rcard__rarity">{rarity.short}</span>
          <AffinityIcon id={data.affinity} size={16} />
        </span>
        <span className="rcard__info">
          <span className="rcard__stars" aria-label={`${rarity.stars} étoiles`}>{'◆'.repeat(rarity.stars)}</span>
          <span className="rcard__name">{data.name}</span>
          <span className="rcard__meta">{data.role} · Nv. {data.level}</span>
        </span>
      </span>
    </button>
  )
}
