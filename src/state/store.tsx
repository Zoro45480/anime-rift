import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BANNERS, COST, type Banner } from '../data/banners'
import type { Hero } from '../data/heroes'
import { pullMany } from '../game/gacha'
import { loadAllArt, removeArt, saveArt } from './customArt'

export type Currency = 'ticket' | 'gems'

type State = { tickets: number; gems: number; pity: Record<string, number>; owned: Record<string, number> }

type Store = State & {
  canAfford: (currency: Currency, count: number) => boolean
  summon: (banner: Banner, currency: Currency, count: number) => Hero[] | null
  customArt: Record<string, string> // images personnelles du joueur, par identifiant de personnage
  setCustomArt: (heroId: string, dataUrl: string) => Promise<boolean> // false = affichée mais non enregistrée
  clearCustomArt: (heroId: string) => void
}

// Dotation de départ du compte. La progression n'est PAS encore sauvegardée (phase 14) : elle repart d'ici à chaque rechargement.
const START: State = { tickets: 20, gems: 600, pity: Object.fromEntries(BANNERS.map((b) => [b.id, 0])), owned: {} }

const Ctx = createContext<Store | null>(null)

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>(START)
  const [customArt, setArt] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadAllArt().then(setArt)
  }, [])

  const store = useMemo<Store>(() => {
    const price = (currency: Currency, count: number) => count * (currency === 'ticket' ? COST.ticket : COST.gems)
    const canAfford = (currency: Currency, count: number) => (currency === 'ticket' ? state.tickets : state.gems) >= price(currency, count)
    const summon = (banner: Banner, currency: Currency, count: number) => {
      if (!canAfford(currency, count)) return null
      const { heroes, pity } = pullMany(banner, state.pity[banner.id], count, Math.random)
      const owned = { ...state.owned }
      for (const h of heroes) owned[h.id] = (owned[h.id] ?? 0) + 1
      setState({
        tickets: state.tickets - (currency === 'ticket' ? price(currency, count) : 0),
        gems: state.gems - (currency === 'gems' ? price(currency, count) : 0),
        pity: { ...state.pity, [banner.id]: pity },
        owned,
      })
      return heroes
    }
    const setCustomArt = async (heroId: string, dataUrl: string) => {
      setArt((a) => ({ ...a, [heroId]: dataUrl }))
      return saveArt(heroId, dataUrl)
    }
    const clearCustomArt = (heroId: string) => {
      setArt((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== heroId)))
      void removeArt(heroId)
    }
    return { ...state, canAfford, summon, customArt, setCustomArt, clearCustomArt }
  }, [state, customArt])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = (): Store => useContext(Ctx)!
