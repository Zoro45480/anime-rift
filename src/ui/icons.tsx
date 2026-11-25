import type { ReactNode } from 'react'

const Svg = ({ children, size = 24, fill = false }: { children: ReactNode; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

export const IconPlay = () => <Svg><path d="M7 8h10a4 4 0 0 1 4 4.3l-.4 3.9a2 2 0 0 1-3.6 1L15.5 15h-7L7 17.2a2 2 0 0 1-3.6-1L3 12.3A4 4 0 0 1 7 8z" /><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" /></Svg>
export const IconGrid = () => <Svg><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></Svg>
export const IconInfo = () => <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>
export const IconChevron = ({ left }: { left?: boolean }) => <Svg size={28}><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></Svg>
export const IconLock = () => <Svg size={26}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
export const IconRift = () => <Svg size={26}><path d="M13.5 2 9 10l5 3-5 9" /><path d="M5 6 3 12l3 2M19 10l2 5-3 4" /></Svg>
