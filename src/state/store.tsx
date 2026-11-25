import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BANNERS, COST, type Banner } from '../data/banners'
import { heroById, type Hero } from '../data/heroes'
import { pullMany } from '../game/gacha'
import { ENERGY_MAX, ENERGY_REGEN_MS, energyNow, ACCOUNT_XP, accountLevel, AWAKEN_COST, LEVEL_CAP, REBIRTH_SHARDS, levelFromXp, MAX_LEVEL, MERGE_XP, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_REFUND, REBIRTH_SEALS, REBIRTH_XP, scrollDrop, SCROLLS, type ScrollId } from '../game/progression'
import { loadAllArt, removeArt, saveArt } from './customArt'
import { loadRemoteArt, type RemoteStatus } from './remoteArt'

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
  accountXp: number // XP du compte depuis la dernière Renaissance
  rebirths: number // nombre de Renaissances
  gemsSpent: number // âmes dépensées depuis la dernière Renaissance
  shards: number // Fragments d'âme
  energy: number // éclairs au moment `energyAt` (ils remontent avec le temps, voir energyNow)
  energyAt: number
  awakened: string[] // cartes libérées (niveau maximum 100)
}

type Store = State & {
  canAfford: (currency: Currency, count: number) => boolean
  summon: (banner: Banner, currency: Currency, count: number) => Hero[] | null
  merge: (heroId: string) => boolean // consomme un doublon contre de l'XP
  useScroll: (heroId: string, scroll: ScrollId) => boolean
  toggleWish: (heroId: string) => void
  togglePin: (heroId: string) => boolean // false = vitrine pleine
  energyLeft: number // éclairs disponibles maintenant
  spendEnergy: () => boolean // un éclair par combat
  awaken: (heroId: string) => boolean // Libération d'une carte contre des Fragments d'âme
  rebirth: (keep: string[]) => boolean // Renaissance : repart du niveau 1 en gardant ces cartes
  remoteArt: Record<string, string> // adresses des portraits officiels sur AniList, par identifiant de personnage
  remoteStatus: RemoteStatus
  customArt: Record<string, string> // images personnelles du joueur, par identifiant de personnage
  setCustomArt: (heroId: string, dataUrl: string) => Promise<boolean> // false = affichée mais non enregistrée
  clearCustomArt: (heroId: string) => void
}

export const SHOWCASE_MAX = 5
const LOG_MAX = 30

// Dotation de départ du compte.
export const START_GEMS = 600
const START: State = {
  accountXp: 0, rebirths: 0, gemsSpent: 0, shards: 0, awakened: [], energy: ENERGY_MAX, energyAt: 0,
  tickets: 20, gems: START_GEMS, pity: Object.fromEntries(BANNERS.map((b) => [b.id, 0])), owned: {},
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

  const [remoteArt, setRemote] = useState<Record<string, string>>({})
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('loading')

  useEffect(() => {
    void loadAllArt().then(setArt)
    void loadRemoteArt(setRemote).then(setRemoteStatus)
  }, [])
  useEffect(() => save(state), [state])
  const [now, setNow] = useState(Date.now()) // fait remonter l'énergie à l'écran
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

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
      let accountXp = state.accountXp
      for (const h of heroes) {
        accountXp += ACCOUNT_XP[h.rarity]
        owned[h.id] = (owned[h.id] ?? 0) + 1
        scrolls[scrollDrop(h.rarity)]++ // chaque carte invoquée apporte un parchemin
        log = withLog(log, h.id, { k: 'pull', note: `Obtenue · bannière ${banner.world}` })
      }
      setState({
        ...state,
        tickets: state.tickets - (currency === 'ticket' ? price(currency, count) : 0),
        gems: state.gems - (currency === 'gems' ? price(currency, count) : 0),
        pity: { ...state.pity, [banner.id]: pity },
        owned, scrolls, log, accountXp,
        gemsSpent: state.gemsSpent + (currency === 'gems' ? price(currency, count) : 0),
      })
      return heroes
    }

    const gain = (heroId: string, baseAmount: number, entry: Omit<LogEntry, 't' | 'note'>, label: string, extra: Partial<State>) => {
      const amount = Math.round(baseAmount * (1 + (state.rebirths * REBIRTH_XP) / 100)) // bonus des Renaissances
      const before = levelFromXp(state.xp[heroId] ?? 0, capOf(heroId)).level
      const xp = (state.xp[heroId] ?? 0) + amount
      const after = levelFromXp(xp, capOf(heroId)).level
      const note = `${label} · +${amount.toLocaleString('fr-FR')} XP${after > before ? ` · niveau ${after}` : ''}`
      setState({ ...state, ...extra, accountXp: state.accountXp + Math.round(amount / 10), xp: { ...state.xp, [heroId]: xp }, log: withLog(state.log, heroId, { ...entry, note }) })
    }
    const capOf = (heroId: string) => (state.awakened.includes(heroId) ? MAX_LEVEL : LEVEL_CAP)
    const maxed = (heroId: string) => levelFromXp(state.xp[heroId] ?? 0, capOf(heroId)).level >= capOf(heroId)

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

    const energyLeft = energyNow(state.energy, state.energyAt, now)
    const spendEnergy = () => {
      const left = energyNow(state.energy, state.energyAt, Date.now())
      if (left < 1) return false
      // on garde le temps déjà écoulé vers le prochain éclair
      const at = left >= ENERGY_MAX ? Date.now() : state.energyAt + (left - state.energy) * ENERGY_REGEN_MS
      setState({ ...state, energy: left - 1, energyAt: at })
      return true
    }
    const awaken = (heroId: string) => {
      const cost = AWAKEN_COST[heroById(heroId).rarity]
      if (state.rebirths < 1 || !state.owned[heroId] || state.awakened.includes(heroId) || state.shards < cost) return false
      setState({ ...state, shards: state.shards - cost, awakened: [...state.awakened, heroId], log: withLog(state.log, heroId, { k: 'merge', note: `Libération · niveau maximum 100 · ${cost} fragments` }) })
      return true
    }
    const rebirth = (keep: string[]) => {
      const kept = [...new Set(keep)].filter((id) => state.owned[id])
      if (accountLevel(state.accountXp, state.rebirths).level < REBIRTH_LEVEL || kept.length > REBIRTH_KEEP) return false
      const only = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => kept.includes(id)))
      setState({
        ...state, // sceaux, parchemins, envies et pity sont conservés
        owned: only(state.owned), xp: only(state.xp), log: only(state.log), pinned: state.pinned.filter((id) => kept.includes(id)), awakened: state.awakened.filter((id) => kept.includes(id)),
        shards: state.shards + REBIRTH_SHARDS,
        accountXp: 0, rebirths: state.rebirths + 1, gemsSpent: 0,
        gems: START_GEMS + Math.floor(state.gemsSpent * REBIRTH_REFUND),
        tickets: state.tickets + REBIRTH_SEALS,
      })
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
    return { ...state, canAfford, summon, merge, useScroll, toggleWish, togglePin, energyLeft, spendEnergy, awaken, rebirth, remoteArt, remoteStatus, customArt, setCustomArt, clearCustomArt }
  }, [state, customArt, remoteArt, remoteStatus, now])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = (): Store => useContext(Ctx)!
