import { iconArt, type IconName } from '../assets/manifest'

// Icône 3D d'une monnaie (rendue par tools/render-icons).
export const Coin = ({ name, size = 26 }: { name: IconName; size?: number }) => (
  <img className="coin" src={iconArt(name)} width={size} height={size} alt="" />
)
