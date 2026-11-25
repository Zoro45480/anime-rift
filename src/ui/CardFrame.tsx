import type { RarityId } from '../data/rarities'
import { frameArt } from '../assets/manifest'

// Cadre de la carte : une image 3D par rareté (voir tools/render-frames), plus des étincelles pour les deux plus rares.
const SPARKS: [number, number][] = [[6, 10], [94, 26], [10, 128], [92, 120], [50, -5], [104, 76], [-4, 58]]

export const CardFrame = ({ rarity }: { rarity: RarityId }) => {
  const sparks = rarity === 'rift' ? 7 : rarity === 'legend' ? 5 : 0
  return (
    <>
      <img className={`card__frame card__frame--${rarity}`} src={frameArt(rarity)} alt="" />
      {sparks > 0 && (
        <svg className={`card__sparks card__sparks--${rarity}`} viewBox="0 0 100 140" aria-hidden="true">
          {SPARKS.slice(0, sparks).map(([x, y], i) => (
            <path key={i} style={{ animationDelay: `${i * 0.37}s` }}
              d={`M${x} ${y - 5} L${x + 1.1} ${y - 1.1} L${x + 5} ${y} L${x + 1.1} ${y + 1.1} L${x} ${y + 5} L${x - 1.1} ${y + 1.1} L${x - 5} ${y} L${x - 1.1} ${y - 1.1} Z`} />
          ))}
        </svg>
      )}
    </>
  )
}
