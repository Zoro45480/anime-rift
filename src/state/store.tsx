import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BANNERS, COST, type Banner } from '../data/banners'
import { heroById, type Hero } from '../data/heroes'
import { pullMany } from '../game/gacha'
import { levelFromXp, MAX_LEVEL, MERGE_XP, scrollDrop, SCROLLS, type ScrollId } from '../game/progression'
import { loadAllArt, removeArt, saveArt } from './customArt'

export type Currency = 'ticket' | 'gems'

// Une ligne de l'historique d'une carte : obtention, fusion d'un doublon ou parchemin utilisé.
export type LogEntry = { t: number; k: 'pull' | 'merge' | 'scroll'; note: string }

type State = {
  tickets: number
  gems: number
  pity: Record<string, number>
  owned: Record<string, number>
  xp: Record<string, number> // points d'expérience de chaque carte
  scrolls: Record<ScrollId, number> // parchemins d'XP en réserve
  wish: string[] // liste d'envies
  pinned: string[] // cartes épinglées dans la vitrine
  log: Record<string, LogEntry[]> // historique de chaque carte, du plus récent au plus ancien
}

type Store = State & {
  canAfford: (currency: Currency, count: number) => boolean
  summon: (banner: Banner, currency: Currency, count: number) => Hero[] | null
  merge: (heroId: string) => boolean // consomme un doublon contre de l'XP
  useScroll: (heroId: string, scroll: ScrollId) => boolean
  toggleWish: (heroId: string) => void
  togglePin: (heroId: string) => boolean // false = vitrine pleine
  customArt: Record<string, string> // images personnelles du joueur, par identifiant de personnage
  setCustomArt: (heroId: string, dataUrl: string) => Promise<boolean> // false = affichée mais non enregistrée
  clearCustomArt: (heroId: string) => void
}

export const SHOWCASE_MAX = 5
const LOG_MAX = 30

// Dotation de départ du compte.
const START: State = {
  tickets: 20, gems: 600, pity: Object.fromEntries(BANNERS.map((b) => [b.id, 0])), owned: {},
  xp: {}, scrolls: { small: 0, medium: 0, large: 0 }, wish: [], pinned: [], log: {},
}

// La progression est gardée dans le navigateur de cet appareil (pas de compte en ligne pour l'instant).
const SAVE_KEY = 'anime-rift-save-v1'
const load = (): State => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return START
    const s = JSON.parse(raw) as Partial<State>
    return { ...START, ...s, pity: { ...START.pity, ...s.pity }, scrolls: { ...START.scrolls, ...s.scrolls } }
  } catch {
    return START
  }
}
const save = (state: State) => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch { /* stockage indisponible : la partie continue sans sauvegarde */ }
}

const Ctx = createContext<Store | null>(null)

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>(load)
  const [customArt, setArt] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadAllArt().then(setArt)
  }, [])
  useEffect(() => save(state), [state])

  const store = useMemo<Store>(() => {
    const price = (currency: Currency, count: number) => count * (currency === 'ticket' ? COST.ticket : COST.gems)
    const canAfford = (currency: Currency, count: number) => (currency === 'ticket' ? state.tickets : state.gems) >= price(currency, count)
    const withLog = (log: State['log'], heroId: string, entry: Omit<LogEntry, 't'>) =>
      ({ ...log, [heroId]: [{ t: Date.now(), ...entry }, ...(log[heroId] ?? [])].slice(0, LOG_MAX) })

    const summon = (banner: Banner, currency: Currency, count: number) => {
      if (!canAfford(currency, count)) return null
      const { heroes, pity } = pullMany(banner, state.pity[banner.id], count, Math.random)
      const owned = { ...state.owned }
      const scrolls = { ...state.scrolls }
      let log = state.log
      for (const h of heroes) {
        owned[h.id] = (owned[h.id] ?? 0) + 1
        scrolls[scrollDrop(h.rarity)]++ // chaque carte invoquée apporte un parchemin
        log = withLog(log, h.id, { k: 'pull', note: `Obtenue · bannière ${banner.world}` })
      }
      setState({
        ...state,
        tickets: state.tickets - (currency === 'ticket' ? price(currency, count) : 0),
        gems: state.gems - (currency === 'gems' ? price(currency, count) : 0),
        pity: { ...state.pity, [banner.id]: pity },
        owned, scrolls, log,
      })
      return heroes
    }

    const gain = (heroId: string, amount: number, entry: Omit<LogEntry, 't' | 'note'>, label: string, extra: Partial<State>) => {
      const before = levelFromXp(state.xp[heroId] ?? 0).level
      const xp = (state.xp[heroId] ?? 0) + amount
      const after = levelFromXp(xp).level
      const note = `${label} · +${amount.toLocaleString('fr-FR')} XP${after > before ? ` · niveau ${after}` : ''}`
      setState({ ...state, ...extra, xp: { ...state.xp, [heroId]: xp }, log: withLog(state.log, heroId, { ...entry, note }) })
    }
    const maxed = (heroId: string) => levelFromXp(state.xp[heroId] ?? 0).level >= MAX_LEVEL

    const merge = (heroId: string) => {
      const hero = heroById(heroId)
      if (!hero || (state.owned[heroId] ?? 0) < 2 || maxed(heroId)) return false
      gain(heroId, MERGE_XP[hero.rarity], { k: 'merge' }, 'Doublon fusionné', { owned: { ...state.owned, [heroId]: state.owned[heroId] - 1 } })
      return true
    }
    const useScroll = (heroId: string, scroll: ScrollId) => {
      if (!state.owned[heroId] || state.scrolls[scroll] < 1 || maxed(heroId)) return false
      gain(heroId, SCROLLS[scroll].xp, { k: 'scroll' }, SCROLLS[scroll].label, { scrolls: { ...state.scrolls, [scroll]: state.scrolls[scroll] - 1 } })
      return true
    }
    const toggleWish = (heroId: string) =>
      setState({ ...state, wish: state.wish.includes(heroId) ? state.wish.filter((x) => x !== heroId) : [...state.wish, heroId] })
    const togglePin = (heroId: string) => {
      if (state.pinned.includes(heroId)) { setState({ ...state, pinned: state.pinned.filter((x) => x !== heroId) }); return true }
      if (!state.owned[heroId] || state.pinned.length >= SHOWCASE_MAX) return false
      setState({ ...state, pinned: [...state.pinned, heroId] })
      return true
    }

    const setCustomArt = async (heroId: string, dataUrl: string) => {
      setArt((a) => ({ ...a, [heroId]: dataUrl }))
      return saveArt(heroId, dataUrl)
    }
    const clearCustomArt = (heroId: string) => {
      setArt((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== heroId)))
      void removeArt(heroId)
    }
    return { ...state, canAfford, summon, merge, useScroll, toggleWish, togglePin, customArt, setCustomArt, clearCustomArt }
  }, [state, customArt])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = (): Store => useContext(Ctx)!
