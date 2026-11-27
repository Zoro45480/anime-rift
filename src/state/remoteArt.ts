import { ANILIST_ID } from '../data/anilist'

// Portraits officiels, chargés par le navigateur du joueur depuis AniList.
// Le jeu n'embarque et ne copie aucune image : il demande à l'API publique d'AniList (graphql.anilist.co) l'adresse
// du portrait de chaque personnage, puis laisse le navigateur l'afficher depuis les serveurs d'AniList.
// Seules les adresses (du texte) sont gardées en mémoire locale, une semaine, pour ne pas rappeler l'API à chaque visite.

export type RemoteStatus = 'loading' | 'ok' | 'blocked'
const API = 'https://graphql.anilist.co'
const KEY = 'anime-rift-anilist-v4'
const WEEK = 7 * 24 * 3600 * 1000
const QUERY = 'query($ids:[Int]){Page(perPage:50){characters(id_in:$ids){id favourites image{large} media(type:ANIME,perPage:1,sort:POPULARITY_DESC){edges{voiceActors(language:JAPANESE){name{full}}}}}}}'

type Cache = { t: number; urls: Record<string, string>; fans: Record<string, number>; seiyu: Record<string, string> } // seiyu = voix japonaise du personnage ; fans = nombre de favoris du personnage sur AniList
const readCache = (): Cache | null => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cache | null
    return c && Date.now() - c.t < WEEK ? c : null
  } catch { return null }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Appelle `onUrls` au fur et à mesure que les adresses arrivent. Renvoie 'blocked' si AniList est injoignable
// (hors ligne, ou page qui interdit les chargements externes) : les cartes gardent alors leur portrait de remplacement.
export const loadRemoteArt = async (onUrls: (urls: Record<string, string>, fans: Record<string, number>, seiyu: Record<string, string>) => void): Promise<RemoteStatus> => {
  const cached = readCache()
  const heroesOf = new Map<number, string[]>() // un même personnage AniList peut illustrer plusieurs cartes
  for (const [hero, id] of Object.entries(ANILIST_ID)) heroesOf.set(id, [...(heroesOf.get(id) ?? []), hero])
  const urls: Record<string, string> = { ...(cached?.urls ?? {}) }
  const fans: Record<string, number> = { ...(cached?.fans ?? {}) }
  const seiyu: Record<string, string> = { ...(cached?.seiyu ?? {}) }
  if (cached) onUrls({ ...urls }, { ...fans }, { ...seiyu })
  // seulement les personnages dont on n'a pas encore l'image (nouveaux persos, ou chargement interrompu la dernière fois)
  const ids = [...heroesOf.keys()].filter((id) => (heroesOf.get(id) ?? []).some((h) => !urls[h]))
  if (!ids.length) return 'ok'
  let failed = 0
  for (let i = 0; i < ids.length; i += 50) {
    let ok = false
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { ids: ids.slice(i, i + 50) } }) })
        if (res.status === 429) { await wait(Number(res.headers.get('Retry-After') ?? 0) * 1000 || 20000); continue } // trop de demandes : on attend puis on réessaie
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { data: { Page: { characters: { id: number; favourites: number | null; image: { large: string | null }; media: { edges: { voiceActors: { name: { full: string | null } }[] | null }[] } | null }[] } } }
        for (const c of json.data.Page.characters) for (const hero of heroesOf.get(c.id) ?? []) {
          if (c.image.large) urls[hero] = c.image.large
          if (c.favourites) fans[hero] = c.favourites
          const voice = c.media?.edges[0]?.voiceActors?.[0]?.name.full
          if (voice) seiyu[hero] = voice
        }
        onUrls({ ...urls }, { ...fans }, { ...seiyu })
        ok = true
      } catch { await wait(3000 * (attempt + 1)) }
    }
    if (!ok) failed++
    await wait(900) // on ménage l'API
  }
  // on garde en mémoire ce qui est arrivé ; ce qui manque sera redemandé à la prochaine visite
  try { localStorage.setItem(KEY, JSON.stringify({ t: cached?.t ?? Date.now(), urls, fans, seiyu })) } catch { /* pas de mémoire locale */ }
  return Object.keys(urls).length ? 'ok' : failed ? 'blocked' : 'ok'
}

// Image de fond de chaque bannière : la bannière officielle de l'animé sur AniList, chargée par le navigateur du joueur.
export const BANNER_MEDIA: Record<string, number> = { naruto: 1735, onepiece: 21, dragonball: 813, bleach: 269, demonslayer: 101922, jujutsu: 113415, hunter: 11061 }
const BANNER_KEY = 'anime-rift-anilist-banners-v1'
export const loadBannerArt = async (): Promise<Record<string, string>> => {
  try {
    const c = JSON.parse(localStorage.getItem(BANNER_KEY) ?? 'null') as { t: number; urls: Record<string, string> } | null
    if (c && Date.now() - c.t < WEEK) return c.urls
  } catch { /* pas de mémoire locale */ }
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query($ids:[Int]){Page(perPage:20){media(id_in:$ids){id bannerImage}}}', variables: { ids: Object.values(BANNER_MEDIA) } }) })
    if (!res.ok) return {}
    const json = (await res.json()) as { data: { Page: { media: { id: number; bannerImage: string | null }[] } } }
    const urls: Record<string, string> = {}
    for (const [banner, id] of Object.entries(BANNER_MEDIA)) {
      const url = json.data.Page.media.find((m) => m.id === id)?.bannerImage
      if (url) urls[banner] = url
    }
    try { localStorage.setItem(BANNER_KEY, JSON.stringify({ t: Date.now(), urls })) } catch { /* on redemandera */ }
    return urls
  } catch { return {} }
}
