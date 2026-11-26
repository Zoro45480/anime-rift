import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BANNERS, COST, type Banner } from '../data/banners'
import { heroById, type Hero } from '../data/heroes'
import { isPityRarity, RARITIES } from '../data/rarities'
import { pullMany } from '../game/gacha'
import { ENERGY_OVER, ENERGY_REFILL, ENERGY_REFILL_COST, cardState, power, ENERGY_MAX, ENERGY_REGEN_MS, energyNow, ACCOUNT_XP, accountLevel, AWAKEN_COST, LEVEL_CAP, REBIRTH_SHARDS, levelFromXp, MAX_LEVEL, MERGE_XP, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_REFUND, REBIRTH_SEALS, REBIRTH_XP, SCROLLS, type ScrollId } from '../game/progression'
import { makeUnit, simulate, type BattleEvent, type Unit } from '../game/battle'
import { foeUnits, isUnlocked, rollDrops, SOULS_PER_STAR, stageById, starsFor, TEAM_SIZE, type Stage } from '../game/saga'
import { canBuy, cosmeticById } from '../game/cosmetics'
import { addCounts, claimable, DAILY_REWARDS, dailyStatus, dayKey, emptyQuests, featuredWorld, markClaimed, roll, type Counts, type Quests, type Reward } from '../game/contracts'
import { loadAllArt, removeArt, saveArt } from './customArt'
import { loadBannerArt, loadRemoteArt, type RemoteStatus } from './remoteArt'

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
  saga: Record<string, number> // étoiles gagnées à chaque combat de la Saga
  team: string[] // équipe de combat (3 cartes au plus)
  notifs: Notif[] // les plus récentes d'abord
  profile: Profile // pseudo, photo, bio, titre affiché et bannière du profil, gardés sur cet appareil
  pulls: number // invocations réalisées depuis le début
  wins: number // combats gagnés depuis le début
  cosmetics: string[] // objets d'apparence achetés
  quests: Quests // contrats : compteurs du jour, de la semaine, à vie, série quotidienne
  arcHeroes: Record<string, boolean> // cartes qui étaient dans l'équipe quand le boss de leur arc est tombé (titre d'arc)
  tutorialSeen: string[] // écrans dont l'explication de Kiri a déjà été lue
  awakened: string[] // cartes libérées (niveau maximum 100)
}

// bannière du profil : l'image d'un animé (identifiant de bannière), une couleur ou une image du joueur
// frame / color / effect / theme : identifiants d'objets d'apparence ('' = automatique ou par défaut) ; badges : succès épinglés
export type Profile = { name: string; avatar: string; bio: string; tag: string; title: string; banner: { kind: 'anime' | 'color' | 'image'; value: string }; frame: string; ornament: string; aura: string; color: string; effect: string; theme: string; badges: string[] }

// Notification affichée sous la cloche de la barre du haut. Elles naissent d'événements réels de la partie.
export type Notif = { id: number; t: number; kind: 'pull' | 'level' | 'saga' | 'drop' | 'rebirth' | 'free' | 'quest'; text: string; read: boolean }
const NOTIF_MAX = 30

// Ce qu'un combat a donné : de quoi le rejouer à l'écran et afficher les récompenses.
export type FightResult = {
  stage: Stage; allies: Unit[]; foes: Unit[]; events: BattleEvent[]; win: boolean
  stars: number; newStars: number; souls: number; accountXp: number; cardXp: number; scrolls: ScrollId[]
}

type Store = State & {
  buyEnergy: () => boolean // recharge d'éclairs contre des âmes
  seeTutorial: (id: string) => void
  resetTutorial: () => void
  setProfile: (profile: Partial<Profile>) => void
  claimContract: (id: string) => boolean // récupère la récompense d'un contrat accompli
  claimDaily: () => boolean // récompense quotidienne
  markVisit: () => void // « passe voir ta collection »
  questsReady: number // contrats et récompense quotidienne à récupérer
  buyCosmetic: (id: string) => boolean // achat en âmes ; l'objet est équipé aussitôt
  resetGame: () => void // efface toute la progression
  readNotifs: () => void // tout marquer comme lu
  clearNotifs: () => void
  teamNow: string[] // l'équipe réellement utilisée : celle choisie, sinon les 3 cartes les plus puissantes
  setTeam: (ids: string[]) => void
  fight: (stageId: string) => FightResult | null // null = combat impossible (verrouillé, pas d'énergie ou pas d'équipe)
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
  bannerArt: Record<string, string> // image de fond de chaque bannière (bannière officielle de l'animé sur AniList)
  remoteSeiyu: Record<string, string> // voix japonaise de chaque personnage, d'après AniList
  remoteFans: Record<string, number> // popularité de chaque personnage sur AniList (nombre de favoris)
  customArt: Record<string, string> // images personnelles du joueur, par identifiant de personnage
  setCustomArt: (heroId: string, dataUrl: string) => Promise<boolean> // false = affichée mais non enregistrée
  clearCustomArt: (heroId: string) => void
}

export const SHOWCASE_MAX = 5
const LOG_MAX = 30

// Dotation de départ du compte.
export const START_GEMS = 600
const START: State = {
  accountXp: 0, rebirths: 0, gemsSpent: 0, shards: 0, awakened: [], energy: ENERGY_MAX, energyAt: 0, saga: {}, team: [], notifs: [], profile: { name: '', avatar: '', bio: '', tag: '', title: '', banner: { kind: 'anime', value: 'naruto' }, frame: '', ornament: '', aura: '', color: '', effect: '', theme: '', badges: [] }, pulls: 0, wins: 0, cosmetics: [], quests: emptyQuests(), arcHeroes: {}, tutorialSeen: [],
  tickets: 20, gems: START_GEMS, pity: Object.fromEntries(BANNERS.map((b) => [b.id, 0])), owned: {},
  xp: {}, scrolls: { small: 0, medium: 0, large: 0 }, wish: [], pinned: [], log: {},
}

// La progression est gardée dans le navigateur de cet appareil (pas de compte en ligne pour l'instant).
const SAVE_KEY = 'anime-rift-save-v1'
// numéro de joueur à quatre chiffres, tiré une fois
const newTag = () => String(1000 + Math.floor(Math.random() * 9000))
const load = (): State => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { ...START, profile: { ...START.profile, tag: newTag() } }
    const s = JSON.parse(raw) as Partial<State>
    const merged = { ...START, ...s, pity: { ...START.pity, ...s.pity }, scrolls: { ...START.scrolls, ...s.scrolls }, profile: { ...START.profile, ...s.profile }, quests: { ...emptyQuests(), ...s.quests } }
    return merged.profile.tag ? merged : { ...merged, profile: { ...merged.profile, tag: newTag() } }
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
  const [remoteFans, setFans] = useState<Record<string, number>>({})
  const [remoteSeiyu, setSeiyu] = useState<Record<string, string>>({})
  const [bannerArt, setBannerArt] = useState<Record<string, string>>({})
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('loading')

  useEffect(() => {
    void loadAllArt().then(setArt)
    void loadBannerArt().then(setBannerArt)
    void loadRemoteArt((urls, fans, seiyu) => { setRemote(urls); setFans(fans); setSeiyu(seiyu) }).then(setRemoteStatus)
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

    // Ajoute des notifications à la liste (les plus récentes d'abord), et signale un passage de niveau de compte.
    const notify = (list: Notif[], items: [Notif['kind'], string][]): Notif[] =>
      [...items.map(([kind, text], i) => ({ id: Date.now() * 100 + i + Math.floor(Math.random() * 50), t: Date.now(), kind, text, read: false })).reverse(), ...list].slice(0, NOTIF_MAX)
    const levelNote = (xpAfter: number): [Notif['kind'], string][] => {
      const before = accountLevel(state.accountXp, state.rebirths).level
      const after = accountLevel(xpAfter, state.rebirths).level
      if (after <= before) return []
      const style = after % 25 === 0 && after < REBIRTH_LEVEL ? ' Nouveau style de niveau débloqué.' : ''
      return [['level', after >= REBIRTH_LEVEL ? `Compte niveau ${REBIRTH_LEVEL} : la Renaissance est disponible.` : `Compte niveau ${after}.${style}`]]
    }
    const readNotifs = () => { if (state.notifs.some((x) => !x.read)) setState({ ...state, notifs: state.notifs.map((x) => ({ ...x, read: true })) }) }
    const clearNotifs = () => setState({ ...state, notifs: [] })
    const setProfile = (profile: Partial<Profile>) => setState({ ...state, profile: { ...state.profile, ...profile } })
    const buyCosmetic = (id: string) => {
      const c = cosmeticById(id)
      const own = { bought: state.cosmetics, level: accountLevel(state.accountXp, state.rebirths).level, rebirths: state.rebirths, arcs: BANNERS.filter((_, i) => (state.saga[`${i}-4`] ?? 0) > 0).map((b) => b.id) }
      if (!c || !canBuy(c, own, state.gems)) return false
      // l'achat et l'équipement se font d'un seul geste (deux mises à jour séparées s'écraseraient)
      setState(tracked({ ...state, gems: state.gems - c.price, gemsSpent: state.gemsSpent + c.price, cosmetics: [...state.cosmetics, id], profile: { ...state.profile, [c.kind]: c.kind === 'title' ? c.name : id } }, { gemsSpent: c.price }))
      return true
    }
    const resetGame = () => setState({ ...START, profile: state.profile, tutorialSeen: state.tutorialSeen, cosmetics: state.cosmetics })

    // Ajoute des compteurs de contrats à un nouvel état, et prévient quand un contrat vient d'être accompli.
    const tracked = (next: State, adds: Counts): State => {
      const t = new Date()
      const quests = addCounts(next.quests, adds, t)
      const before = new Set(claimable(state.quests, state.saga, t).map((c) => c.id))
      const fresh = claimable(quests, next.saga, t).filter((c) => !before.has(c.id))
      return { ...next, quests, notifs: fresh.length ? notify(next.notifs, fresh.map((c): [Notif['kind'], string] => ['quest', `${c.title} : ta récompense t’attend dans Contrats.`])) : next.notifs }
    }
    // Donne une récompense (âmes, éclairs au-delà du maximum, sceaux, fragments, parchemins).
    const grant = (s: State, r: Reward): State => {
      const left = energyNow(s.energy, s.energyAt, Date.now())
      const scrolls = { ...s.scrolls }
      for (const [k, v] of Object.entries(r.scrolls ?? {})) scrolls[k as ScrollId] += v ?? 0
      return { ...s, gems: s.gems + (r.gems ?? 0), tickets: s.tickets + (r.tickets ?? 0), shards: s.shards + (r.shards ?? 0), scrolls,
        ...(r.energy ? { energy: left + r.energy, energyAt: left >= ENERGY_MAX ? Date.now() : s.energyAt + (left - s.energy) * ENERGY_REGEN_MS } : {}) }
    }

    const summon = (banner: Banner, currency: Currency, count: number) => {
      if (!canAfford(currency, count)) return null
      const { heroes, pity } = pullMany(banner, state.pity[banner.id], count, Math.random)
      const owned = { ...state.owned }
      let log = state.log
      let accountXp = state.accountXp
      for (const h of heroes) {
        accountXp += ACCOUNT_XP[h.rarity]
        owned[h.id] = (owned[h.id] ?? 0) + 1
        log = withLog(log, h.id, { k: 'pull', note: `Obtenue · bannière ${banner.world}` })
      }
      const fresh = new Set(heroes.filter((h) => !state.owned[h.id]).map((h) => h.id)).size
      const featured = featuredWorld(new Date())
      setState(tracked({
        ...state,
        tickets: state.tickets - (currency === 'ticket' ? price(currency, count) : 0),
        gems: state.gems - (currency === 'gems' ? price(currency, count) : 0),
        pity: { ...state.pity, [banner.id]: pity },
        owned, log, accountXp, pulls: state.pulls + count,
        notifs: notify(state.notifs, [
          ...heroes.filter((h) => isPityRarity(h.rarity)).map((h): [Notif['kind'], string] => ['pull', `Gros tirage : ${h.name} (${RARITIES[h.rarity].short}) sur la bannière ${banner.world}.`]),
          ...levelNote(accountXp),
        ]),
        gemsSpent: state.gemsSpent + (currency === 'gems' ? price(currency, count) : 0),
      }, { pulls: count, newCards: fresh, featuredPull: heroes.filter((h) => h.world === featured).length, gemsSpent: currency === 'gems' ? price(currency, count) : 0 }))
      return heroes
    }

    const gain = (heroId: string, baseAmount: number, entry: Omit<LogEntry, 't' | 'note'>, label: string, extra: Partial<State>, adds: Counts = {}) => {
      const amount = Math.round(baseAmount * (1 + (state.rebirths * REBIRTH_XP) / 100)) // bonus des Renaissances
      const before = levelFromXp(state.xp[heroId] ?? 0, capOf(heroId)).level
      const xp = (state.xp[heroId] ?? 0) + amount
      const after = levelFromXp(xp, capOf(heroId)).level
      const note = `${label} · +${amount.toLocaleString('fr-FR')} XP${after > before ? ` · niveau ${after}` : ''}`
      setState(tracked({ ...state, ...extra, notifs: notify(state.notifs, levelNote(state.accountXp + Math.round(amount / 10))), accountXp: state.accountXp + Math.round(amount / 10), xp: { ...state.xp, [heroId]: xp }, log: withLog(state.log, heroId, { ...entry, note }) }, { levels: after - before, ...adds }))
    }
    const capOf = (heroId: string) => (state.awakened.includes(heroId) ? MAX_LEVEL : LEVEL_CAP)
    const maxed = (heroId: string) => levelFromXp(state.xp[heroId] ?? 0, capOf(heroId)).level >= capOf(heroId)

    const merge = (heroId: string) => {
      const hero = heroById(heroId)
      if (!hero || (state.owned[heroId] ?? 0) < 2 || maxed(heroId)) return false
      gain(heroId, MERGE_XP[hero.rarity], { k: 'merge' }, 'Doublon fusionné', { owned: { ...state.owned, [heroId]: state.owned[heroId] - 1 } }, { merges: 1 })
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
    // Équipe : les cartes choisies encore possédées ; à défaut, les trois plus puissantes.
    const chosen = state.team.filter((id) => state.owned[id]).slice(0, TEAM_SIZE)
    const teamNow = chosen.length ? chosen : Object.keys(state.owned).filter((id) => state.owned[id])
      .map((id) => ({ id, p: power(cardState(heroById(id), state.xp, state.owned, state.rebirths, state.awakened).stats) }))
      .sort((a, b) => b.p - a.p).slice(0, TEAM_SIZE).map((x) => x.id)
    const setTeam = (ids: string[]) => setState({ ...state, team: [...new Set(ids)].filter((id) => state.owned[id]).slice(0, TEAM_SIZE) })

    const fight = (stageId: string): FightResult | null => {
      const stage = stageById(stageId)
      const left = energyNow(state.energy, state.energyAt, Date.now())
      if (!stage || !isUnlocked(stage, state.saga) || left < 1 || teamNow.length === 0) return null
      const allies = teamNow.map((id, i) => makeUnit(heroById(id), cardState(heroById(id), state.xp, state.owned, state.rebirths, state.awakened, teamNow).stats, 0, i))
      const foes = foeUnits(stage)
      const { events, win, fallen } = simulate(allies, foes, Math.random)
      const energy = { energy: left - 1, energyAt: left >= ENERGY_MAX ? Date.now() : state.energyAt + (left - state.energy) * ENERGY_REGEN_MS }
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      if (!win) {
        setState(tracked({ ...state, ...energy }, { damage }))
        return { stage, allies, foes, events, win, stars: 0, newStars: 0, souls: 0, accountXp: 0, cardXp: 0, scrolls: [] }
      }
      const stars = starsFor(fallen)
      const newStars = Math.max(0, stars - (state.saga[stage.id] ?? 0))
      const drops = rollDrops(stage, Math.random)
      const scrolls = { ...state.scrolls }
      for (const id of drops) scrolls[id]++
      const cardXp = Math.round(stage.cardXp * (1 + (state.rebirths * REBIRTH_XP) / 100))
      const xp = { ...state.xp }
      let levels = 0
      for (const id of teamNow) {
        const before = levelFromXp(xp[id] ?? 0, capOf(id)).level
        xp[id] = (xp[id] ?? 0) + cardXp
        levels += levelFromXp(xp[id], capOf(id)).level - before
      }
      setState(tracked({
        ...state, ...energy, scrolls, xp, wins: state.wins + 1,
        saga: { ...state.saga, [stage.id]: Math.max(stars, state.saga[stage.id] ?? 0) },
        // titre d'arc : les cartes de cet univers présentes dans l'équipe quand son boss tombe
        arcHeroes: stage.boss ? { ...state.arcHeroes, ...Object.fromEntries(teamNow.filter((id) => heroById(id).world === stage.world).map((id) => [id, true])) } : state.arcHeroes,
        gems: state.gems + newStars * SOULS_PER_STAR,
        accountXp: state.accountXp + stage.accountXp,
        notifs: notify(state.notifs, [
          ...(stage.boss && !(state.saga[stage.id] > 0) ? [['saga', `Arc ${stage.world} terminé.${stageById(`${stage.arc + 1}-0`) ? ` L'arc ${stageById(`${stage.arc + 1}-0`)!.world} est ouvert.` : ' Tu as fini La Saga !'}`] as [Notif['kind'], string]] : []),
          ...drops.filter((id) => id !== 'small').map((id): [Notif['kind'], string] => ['drop', `${SCROLLS[id].label} obtenu dans La Saga (${stage.world}).`]),
          ...levelNote(state.accountXp + stage.accountXp),
        ]),
      }, { wins: 1, win3: stars === 3 ? 1 : 0, bosses: stage.boss ? 1 : 0, damage, levels }))
      return { stage, allies, foes, events, win, stars, newStars, souls: newStars * SOULS_PER_STAR, accountXp: stage.accountXp, cardXp, scrolls: drops }
    }

    const buyEnergy = () => {
      const left = energyNow(state.energy, state.energyAt, Date.now())
      if (state.gems < ENERGY_REFILL_COST || left + ENERGY_REFILL > ENERGY_OVER) return false
      setState(tracked({ ...state, gems: state.gems - ENERGY_REFILL_COST, gemsSpent: state.gemsSpent + ENERGY_REFILL_COST, energy: left + ENERGY_REFILL, energyAt: Date.now() }, { gemsSpent: ENERGY_REFILL_COST }))
      return true
    }
    const claimContract = (id: string) => {
      const t = new Date()
      const c = claimable(state.quests, state.saga, t).find((x) => x.id === id)
      if (!c) return false
      setState({ ...grant(state, c.reward), quests: markClaimed(c, state.quests, t) })
      return true
    }
    const claimDaily = () => {
      const t = new Date()
      const st = dailyStatus(state.quests.daily, t)
      if (st.claimed) return false
      setState({ ...grant(state, DAILY_REWARDS[st.day - 1]), quests: { ...roll(state.quests, t), daily: { last: dayKey(t), streak: st.day } } })
      return true
    }
    const markVisit = () => { if (!roll(state.quests, new Date()).day.c.visit) setState(tracked(state, { visit: 1 })) }
    const questsReady = claimable(state.quests, state.saga, new Date(now)).length + (dailyStatus(state.quests.daily, new Date(now)).claimed ? 0 : 1)
    const seeTutorial = (id: string) => { if (!state.tutorialSeen.includes(id)) setState({ ...state, tutorialSeen: [...state.tutorialSeen, id] }) }
    const resetTutorial = () => setState({ ...state, tutorialSeen: [] })
    const awaken = (heroId: string) => {
      const cost = AWAKEN_COST[heroById(heroId).rarity]
      if (state.rebirths < 1 || !state.owned[heroId] || state.awakened.includes(heroId) || state.shards < cost) return false
      setState({ ...state, notifs: notify(state.notifs, [['free', `${heroById(heroId).name} est libérée : niveau maximum 100.`]]), shards: state.shards - cost, awakened: [...state.awakened, heroId], log: withLog(state.log, heroId, { k: 'merge', note: `Libération · niveau maximum 100 · ${cost} fragments` }) })
      return true
    }
    const rebirth = (keep: string[]) => {
      const kept = [...new Set(keep)].filter((id) => state.owned[id])
      if (accountLevel(state.accountXp, state.rebirths).level < REBIRTH_LEVEL || kept.length > REBIRTH_KEEP) return false
      const only = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => kept.includes(id)))
      setState({
        ...state, // sceaux, parchemins, envies et pity sont conservés
        owned: only(state.owned), xp: only(state.xp), log: only(state.log), arcHeroes: only(state.arcHeroes), pinned: state.pinned.filter((id) => kept.includes(id)), awakened: state.awakened.filter((id) => kept.includes(id)),
        shards: state.shards + REBIRTH_SHARDS,
        accountXp: 0, rebirths: state.rebirths + 1, gemsSpent: 0, saga: {}, team: state.team.filter((id) => kept.includes(id)),
        gems: START_GEMS + Math.floor(state.gemsSpent * REBIRTH_REFUND),
        tickets: state.tickets + REBIRTH_SEALS,
        notifs: notify(state.notifs, [['rebirth', `Renaissance n° ${state.rebirths + 1} accomplie : tes bonus définitifs sont actifs.`]]),
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
    return { ...state, canAfford, summon, merge, useScroll, toggleWish, togglePin, claimContract, claimDaily, markVisit, questsReady, buyCosmetic, buyEnergy, seeTutorial, resetTutorial, setProfile, resetGame, readNotifs, clearNotifs, teamNow, setTeam, fight, energyLeft, spendEnergy, awaken, rebirth, remoteArt, remoteStatus, remoteFans, remoteSeiyu, bannerArt, customArt, setCustomArt, clearCustomArt }
  }, [state, customArt, remoteArt, remoteStatus, remoteFans, remoteSeiyu, bannerArt, now])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = (): Store => useContext(Ctx)!
