// Le style des chiffres change tous les 25 niveaux, et devient arc-en-ciel animé après une Ascension.
export const levelStyle = (level: number, rebirths: number) => (rebirths > 0 ? 'r' : `t${Math.min(4, Math.floor(level / 25))}`)
export const LEVEL_STYLE_NAME: Record<string, string> = { t0: 'Acier', t1: 'Or', t2: 'Braise', t3: 'Plasma', t4: 'Légende', r: 'Arc-en-ciel' }

// Niveau de compte dans un badge hexagonal ; la couleur suit le style (tous les 25 niveaux, arc-en-ciel après une Ascension).
const HEX = 'M50 3 93 27.5v49L50 101 7 76.5v-49Z'
export const LevelBadge = ({ level, rebirths = 0, size = 22 }: { level: number; rebirths?: number; size?: number }) => {
  const style = levelStyle(level, rebirths)
  const h = Math.round(size * 1.55)
  const big = size >= 40
  return (
    <span className={`hexlvl hexlvl--${style}`} role="img" aria-label={`Niveau de compte ${level}`} style={{ width: Math.round(h * 0.89), height: h }}>
      <svg viewBox="0 0 100 104" aria-hidden="true"><defs><linearGradient id={`hx-${style}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="hexlvl__a" /><stop offset="1" className="hexlvl__b" /></linearGradient></defs>
        <path d={HEX} fill="rgba(10,10,18,.92)" stroke={`url(#hx-${style})`} strokeWidth="6" /></svg>
      <span className="hexlvl__in">{big && <small>Niveau</small>}<b style={{ fontSize: Math.round(h * (String(level).length > 2 ? 0.32 : 0.42)) }}>{level}</b></span>
      {rebirths > 0 && <i className="hexlvl__star" aria-hidden="true">✦</i>}
    </span>
  )
}
