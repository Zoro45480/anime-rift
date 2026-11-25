import { digitArt } from '../assets/manifest'

// Niveau de compte écrit avec les chiffres 3D rendus dans Blender.
export const LevelBadge = ({ level, size = 22 }: { level: number; size?: number }) => (
  <span className="lvl" role="img" aria-label={`Niveau de compte ${level}`} style={{ ['--lh' as string]: `${size}px` }}>
    <img className="lvl__nv" src={digitArt('nv')} alt="" />
    {String(level).split('').map((d, i) => <img key={i} src={digitArt(d)} alt="" />)}
  </span>
)
