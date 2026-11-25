import { digitArt } from '../assets/manifest'

// Le style des chiffres change tous les 25 niveaux, et devient arc-en-ciel animé après une Renaissance.
export const levelStyle = (level: number, rebirths: number) => (rebirths > 0 ? 'r' : `t${Math.min(4, Math.floor(level / 25))}`)
export const LEVEL_STYLE_NAME: Record<string, string> = { t0: 'Acier', t1: 'Or', t2: 'Braise', t3: 'Plasma', t4: 'Légende', r: 'Arc-en-ciel' }

// Niveau de compte écrit avec les chiffres 3D rendus dans Blender.
export const LevelBadge = ({ level, rebirths = 0, size = 22 }: { level: number; rebirths?: number; size?: number }) => {
  const style = levelStyle(level, rebirths)
  return (
    <span className={`lvl lvl--${style}`} role="img" aria-label={`Niveau de compte ${level}`} style={{ ['--lh' as string]: `${size}px` }}>
      {rebirths > 0 && <i className="lvl__star" aria-hidden="true">✦</i>}
      <img className="lvl__nv" src={digitArt(style, 'nv')} alt="" />
      {String(level).split('').map((d, i) => <img key={i} src={digitArt(style, d)} alt="" />)}
    </span>
  )
}
