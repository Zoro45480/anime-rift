import type { ReactNode } from 'react'

const Svg = ({ children, size = 24, fill = false }: { children: ReactNode; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

export const IconBanners = () => <Svg><rect x="3.5" y="6" width="10" height="14" rx="1.5" transform="rotate(-8 8.5 13)" /><rect x="10" y="4.5" width="10" height="14" rx="1.5" transform="rotate(8 15 11.5)" /><path d="m15 9 .9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" /></Svg>
export const IconPlay = () => <Svg><path d="M7 8h10a4 4 0 0 1 4 4.3l-.4 3.9a2 2 0 0 1-3.6 1L15.5 15h-7L7 17.2a2 2 0 0 1-3.6-1L3 12.3A4 4 0 0 1 7 8z" /><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" /></Svg>
export const IconGrid = () => <Svg><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></Svg>
export const IconBolt = () => <Svg size={18} fill><path d="M13.5 2 5 13.5h5.2L8.5 22 19 9.8h-5.6z" /></Svg>
export const IconGem = () => <Svg size={18} fill><path d="M7 3h10l4 6-9 12L3 9z" /></Svg>
export const IconTicket = () => <Svg size={18} fill><path d="M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3z" /></Svg>
export const IconInfo = () => <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>
export const IconArrow = () => <Svg size={20}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const IconChevron = ({ left }: { left?: boolean }) => <Svg size={28}><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></Svg>
export const IconLock = () => <Svg size={26}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
export const IconCompass = () => <Svg size={30}><circle cx="12" cy="12" r="8.5" /><path d="m14.8 9.2-1.6 4-4 1.6 1.6-4z" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></Svg>
export const IconSwords = () => <Svg size={30}><path d="M4 4l11 11M4 4v3.5M4 4h3.5M13 17l4-4M15.5 18.5l3-3M20 4 9 15M20 4v3.5M20 4h-3.5M11 17l-4-4M8.5 18.5l-3-3" /></Svg>
export const IconTower = () => <Svg size={30}><path d="M8 21V9l-2-2V3h3v2h2V3h2v2h2V3h3v4l-2 2v12zM5 21h14M11 21v-4a1 1 0 0 1 2 0v4" /></Svg>
