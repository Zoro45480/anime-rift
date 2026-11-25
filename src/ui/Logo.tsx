// Logo ANIME RIFT : le mot RIFT est fendu par une faille lumineuse.
export const Logo = ({ size = 1 }: { size?: number }) => (
  <div className="logo" style={{ fontSize: `${size}rem` }} role="img" aria-label="ANIME RIFT">
    <span className="logo__anime">ANIME</span>
    <span className="logo__rift">
      <span className="logo__rift-top" aria-hidden="true">RIFT</span>
      <span className="logo__rift-bottom" aria-hidden="true">RIFT</span>
      <span className="logo__slash" aria-hidden="true" />
    </span>
  </div>
)
