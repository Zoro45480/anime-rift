import type { ReactNode } from 'react'

const Svg = ({ children, size = 24, fill = false }: { children: ReactNode; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

export const IconInfo = () => <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>
export const IconChevron = ({ left }: { left?: boolean }) => <Svg size={28}><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></Svg>
export const IconLock = () => <Svg size={26}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
