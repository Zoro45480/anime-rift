import { ANILIST_ID } from '../data/anilist'

// Portraits officiels, chargés par le navigateur du joueur depuis AniList.
// Le jeu n'embarque et ne copie aucune image : il demande à l'API publique d'AniList (graphql.anilist.co) l'adresse
// du portrait de chaque personnage, puis laisse le navigateur l'afficher depuis les serveurs d'AniList.
// Seules les adresses (du texte) sont gardées en mémoire locale, une semaine, pour ne pas rappeler l'API à chaque visite.

export type RemoteStatus = 'loading' | 'ok' | 'blocked'
const API = 'https://graphql.anilist.co'
const KEY = 'anime-rift-anilist-v2'
const WEEK = 7 * 24 * 3600 * 1000
const QUERY = 'query($ids:[Int]){Page(perPage:50){characters(id_in:$ids){id favourites image{large}}}}'

type Cache = { t: number; urls: Record<string, string>; fans: Record<string, number> } // fans = nombre de favoris du personnage sur AniList
const readCache = (): Cache | null => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cache | null
    return c && Date.now() - c.t < WEEK ? c : null
  } catch { return null }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Appelle `onUrls` au fur et à mesure que les adresses arrivent. Renvoie 'blocked' si AniList est injoignable
// (hors ligne, ou page qui interdit les chargements externes) : les cartes gardent alors leur portrait de remplacement.
export const loadRemoteArt = async (onUrls: (urls: Record<string, string>, fans: Record<string, number>) => void): Promise<RemoteStatus> => {
  const cached = readCache()
  if (cached) { onUrls(cached.urls, cached.fans ?? {}); return 'ok' }
  const heroesOf = new Map<number, string[]>() // un même personnage AniList peut illustrer plusieurs cartes
  for (const [hero, id] of Object.entries(ANILIST_ID)) heroesOf.set(id, [...(heroesOf.get(id) ?? []), hero])
  const ids = [...heroesOf.keys()]
  const urls: Record<string, string> = {}
  const fans: Record<string, number> = {}
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { ids: ids.slice(i, i + 50) } }) })
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { data: { Page: { characters: { id: number; favourites: number | null; image: { large: string | null } }[] } } }
      for (const c of json.data.Page.characters) for (const hero of heroesOf.get(c.id) ?? []) {
        if (c.image.large) urls[hero] = c.image.large
        if (c.favourites) fans[hero] = c.favourites
      }
      onUrls({ ...urls }, { ...fans })
    } catch {
      return Object.keys(urls).length ? 'ok' : 'blocked'
    }
    await wait(700) // on ménage l'API
  }
  try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), urls, fans })) } catch { /* pas de mémoire locale : on redemandera */ }
  return 'ok'
}
