type Kind = 'hp' | 'energy' | 'ultimate' | 'guard'

type Props = { kind: Kind; value: number; max: number; label?: string; segments?: number }

export const Gauge = ({ kind, value, max, label, segments }: Props) => {
  const pct = Math.max(0, Math.min(1, value / max))
  const full = pct >= 1
  return (
    <div className={`gauge gauge--${kind} ${full ? 'is-full' : ''}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label ?? kind}>
      {label && (
        <div className="gauge__row">
          <span className="gauge__label">{label}</span>
          <span className="gauge__num">{value}<i>/{max}</i></span>
        </div>
      )}
      <div className="gauge__track">
        <div className="gauge__fill" style={{ transform: `scaleX(${pct})` }} />
        {segments && <div className="gauge__segs" style={{ backgroundSize: `${100 / segments}% 100%` }} />}
      </div>
    </div>
  )
}
