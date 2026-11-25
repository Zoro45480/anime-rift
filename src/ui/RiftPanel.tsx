import type { ReactNode } from 'react'

type Props = { title?: string; tag?: string; accent?: 'cyan' | 'violet' | 'gold'; children: ReactNode; className?: string }

// Panneau à angles coupés avec liseré lumineux. Brique de base de tous les menus.
export const RiftPanel = ({ title, tag, accent = 'cyan', children, className = '' }: Props) => (
  <section className={`rpanel rpanel--${accent} ${className}`}>
    <div className="rpanel__inner">
      {(title || tag) && (
        <header className="rpanel__head">
          {title && <h3 className="rpanel__title">{title}</h3>}
          {tag && <span className="rpanel__tag">{tag}</span>}
        </header>
      )}
      {children}
    </div>
  </section>
)
