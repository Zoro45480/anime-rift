// Petites icônes au trait pour les onglets (même style que le menu du haut).
const P: Record<string, string> = {
  social: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2',
  guild: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z',
  fame: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 2v4m-4 4h8m-6-4h4',
  referral: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  friends: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  messages: 'M4 5h16v11H8l-4 4V5Z',
  trades: 'M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3',
  find: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  create: 'M12 5v14M5 12h14',
  rank: 'M5 20V10m7 10V4m7 16v-7',
  ops: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  boss: 'M6 9a6 6 0 1 1 12 0v4l-2 2v4H8v-4l-2-2V9Zm4 2h.01M14 11h.01M10 19v-2m4 2v-2',
  rival: 'M5 5l9 9m-2 4 2-2 4 4 2-2-4-4 2-2M19 5l-9 9m2 4-2-2-4 4-2-2 4-4-2-2',
  members: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2',
  requests: 'M4 6h16v12H4zM4 7l8 6 8-6',
  badges: 'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-3 1-1 6 4-2 4 2-1-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3 1.6-1.2-1.6-2.8-1.9.6a7 7 0 0 0-1.7-1L15.4 5h-3.2l-.4 2.1a7 7 0 0 0-1.7 1L8.2 7.5 6.6 10.3 8.2 11.5a7 7 0 0 0 0 2l-1.6 1.2 1.6 2.8 1.9-.6a7 7 0 0 0 1.7 1l.4 2.1h3.2l.4-2.1a7 7 0 0 0 1.7-1l1.9.6 1.6-2.8-1.6-1.2a7 7 0 0 0 0-2Z',
  hq: 'M4 20V9l8-5 8 5v11h-5v-6H9v6H4Z',
  squads: 'M7 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm10 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19a4 4 0 0 1 8 0m2 0a4 4 0 0 1 8 0m-13 1a4 4 0 0 1 8 0',
  score: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 2v4m-4 4h8m-6-4h4',
}
export const TabIcon = ({ id }: { id: string }) => P[id] ? <svg className="ct-ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[id]} /></svg> : null
