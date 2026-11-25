import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'gold' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; sub?: string; children: ReactNode }

export const RiftButton = ({ variant = 'primary', sub, children, className = '', ...rest }: Props) => (
  <button className={`rbtn rbtn--${variant} ${className}`} {...rest}>
    <span className="rbtn__face">
      <span className="rbtn__label">{children}</span>
      {sub && <span className="rbtn__sub">{sub}</span>}
    </span>
  </button>
)
