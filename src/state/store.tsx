import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BANNERS, BIG_PITY, COST, type Banner } from '../data/banners'
import { HEROES, heroById, type Hero } from '../data/heroes'
import { fetchInbox, heartbeat, markInbox, pushCloud, pushTeamLater, startOnline, useOnline } from './online'
import { isPityRarity, RARITIES, RARITY_ORDER } from '../data/rarities'
import { pullMany } from '../game/gacha'
import { ENERGY_OVER, ENERGY_REFILL, ENERGY_REFILL_COST, cardState, power, ENERGY_MAX, ENERGY_REGEN_MS, energyNow, ACCOUNT_XP, accountLevel, AWAKEN_COST, LEVEL_CAP, REBIRTH_SHARDS, levelFromXp, xpForLevel, MAX_LEVEL, MERGE_XP, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_REFUND, REBIRTH_SEALS, REBIRTH_XP, SCROLLS, type ScrollId } from '../game/progression'
import { makeUnit, simulate, type BattleEvent, type Unit } from '../game/battle'
import { foeUnits, isUnlocked, rollDrops, SOULS_PER_STAR, stageById, starsFor, TEAM_SIZE, type Stage } from '../game/saga'
import { canBuy, cosmeticById } from '../game/cosmetics'
import { challengesFor, challengeState, markChallenge, weekKey, addCounts, claimable, DAILY_REWARDS, dailyStatus, dayKey, emptyQuests, featuredWorld, markClaimed, roll, type Counts, type Quests, type Reward } from '../game/contracts'
import { claimableTiers, PATH_XP, rollCard, rollPath, tierOf, tierReward, type PathState } from '../game/riftpath'
import { applyRule, floor as spireFloor, spireFoes, type Floor } from '../game/spire'
import { ACHIEVEMENTS, doneIds, METAL_LABEL } from '../game/achievements'
import { colossusFoes, colossusOf, DIFFICULTIES, eventDone, isOpen as colOpen, rollCol, TRIES_PER_DAY, WIN_SOULS, type ColState, type Difficulty } from '../game/colossus'
import { emptyTourney, ROUNDS, tourneyRival, type Tourney, DUELS_PER_DAY, eloChange, emptyArena, PVP_GOALS, rivalsFor, rivalUnits, rollWeek, WIN_SOULS as DUEL_SOULS, type ArenaState, type Rival } from '../game/arena'
import { REFERRAL } from '../game/referral'
import { emptyShop, giftOf, rollAtLeast, weeklyOffers, type ShopState } from '../game/shop'
import { AUCTION_HOURS, auctionResult, emptyBazaar, quickPrice, stallOf, type BazaarState } from '../game/bazaar'
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
  favs: string[] // cartes favorites (étoile)
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
  seen: { last: string; days: number } // jours de jeu différents (succès d'ancienneté)
  achDone: string[] | null // succès déjà annoncés (null : ancienne sauvegarde, on les marque sans notification)
  bazaar: BazaarState // Bazar : achats du jour, enchères en cours, journal des transactions, alertes de prix
  shop: ShopState // boutique : offres achetées cette semaine, cadeau du jour, historique
  tourney: Tourney // Le Grand Rift : tournoi du jour, titres gagnés
  arena: ArenaState // L'Arène : cote, ligue, duels du jour, défis de la semaine
  refClaimed: number[] // cases du calendrier de parrainage déjà ouvertes
  gtries: { day: string; n: number } // essais du jour contre le boss de guilde
  col: ColState // Les Colosses : semaine, difficultés battues, essais du jour, objectifs d'événement
  multis: Record<string, number> // grande garantie : multis ×10 d'affilée sans MR, par bannière
  spire: { best: number } // La Spire : plus haut étage gagné
  path: PathState // Chemin du Rift : saison, XP, paliers récupérés
  quests: Quests // contrats : compteurs du jour, de la semaine, à vie, série quotidienne
  arcHeroes: Record<string, boolean> // cartes qui étaient dans l'équipe quand le boss de leur arc est tombé (titre d'arc)
  tutorialSeen: string[] // écrans dont l'explication de Kiri a déjà été lue
  awakened: string[] // cartes libérées (niveau maximum 100)
}

// bannière du profil : l'image d'un animé (identifiant de bannière), une couleur ou une image du joueur
// frame / color / effect / theme : identifiants d'objets d'apparence ('' = automatique ou par défaut) ; badges : succès épinglés
export type Profile = { name: string; avatar: string; bio: string; tag: string; title: string; banner: { kind: 'anime' | 'color' | 'image'; value: string }; frame: string; ornament: string; aura: string; color: string; effect: string; theme: string; badges: string[] }

// Notification affichée sous la cloche de la barre du haut. Elles naissent d'événements réels de la partie.
export type Notif = { id: number; t: number; kind: 'pull' | 'level' | 'saga' | 'drop' | 'rebirth' | 'free' | 'quest' | 'ach' | 'bazaar'; text: string; read: boolean }
const NOTIF_MAX = 30

// Ce qu'un combat a donné : de quoi le rejouer à l'écran et afficher les récompenses.
export type ColResult = { diff: Difficulty; allies: Unit[]; foes: Unit[]; events: BattleEvent[]; win: boolean; first: boolean; card: Hero | null }
export type RealOpponent = { id: string; name: string; no: number; elo: number; team: { id: string; level: number }[] }
export type DuelResult = { rival: Rival; allies: Unit[]; foes: Unit[]; events: BattleEvent[]; win: boolean; delta: number; elo: number }
export type SpireResult = { floor: Floor; allies: Unit[]; foes: Unit[]; events: BattleEvent[]; win: boolean; first: boolean }
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
  claimChallenge: (id: string) => boolean // défi du Chemin (3 fois par jour)
  claimTier: (tier: number) => Hero | true | null // récupère un palier du Chemin du Rift (la carte obtenue, s'il y en a une)
  claimAllTiers: () => Hero[] // récupère tous les paliers prêts
  questsReady: number // contrats et récompense quotidienne à récupérer
  buyCosmetic: (id: string) => boolean // achat en âmes ; l'objet est équipé aussitôt
  resetGame: () => void // efface toute la progression
  readNotifs: () => void // tout marquer comme lu
  clearNotifs: () => void
  teamNow: string[] // l'équipe réellement utilisée : celle choisie, sinon les 3 cartes les plus puissantes
  setTeam: (ids: string[]) => void
  fightGuildBoss: () => { result: ColResult; damage: number } | null // boss de guilde : 3 essais par jour, les dégâts comptent pour toute la guilde
  guildTries: number
  claimReferral: (step: number, friends: number) => boolean // ouvre une case du calendrier de parrainage
  fightColossus: (diff: Difficulty['id']) => ColResult | null // combat contre le Colosse de la semaine
  claimEvent: () => Hero | null // récompense finale de l'événement : une carte SR ou mieux
  colTries: number // essais restants aujourd'hui
  buyStall: (id: string) => boolean // achète une carte à l'étal du jour
  quickSell: (heroId: string) => number // vend un doublon tout de suite (prix obtenu, 0 si impossible)
  listAuction: (heroId: string, start: number) => boolean // met un doublon aux enchères
  setAlert: (heroId: string, below: number | null) => void // alerte de prix (null pour la retirer)
  levelOf: (heroId: string) => number
  buyOffer: (id: string) => Hero | true | null // achète une offre de la semaine (la carte garantie s'il y en a une)
  claimGift: () => boolean // cadeau gratuit du jour
  giftReady: boolean
  duel: (rivalId: string, real?: RealOpponent) => DuelResult | null // duel d'arène contre un rival du jeu
  tourneyFight: () => DuelResult | null // combat du tour suivant du Grand Rift
  newRivals: () => void // propose trois autres rivaux
  claimPvp: (id: string) => boolean // défi d'arène de la semaine
  duelsLeft: number
  arenaPower: number // puissance de l'équipe en arène (sans bonus de Renaissance)
  fightSpire: () => SpireResult | null // combat l'étage suivant de La Spire (sans éclair)
  fight: (stageId: string) => FightResult | null // null = combat impossible (verrouillé, pas d'énergie ou pas d'équipe)
  canAfford: (currency: Currency, count: number) => boolean
  summon: (banner: Banner, currency: Currency, count: number) => Hero[] | null
  merge: (heroId: string) => boolean // consomme un doublon contre de l'XP
  useScroll: (heroId: string, scroll: ScrollId, count?: number) => number // parchemins réellement utilisés (s'arrête au niveau maximum)
  scrollsUseful: (heroId: string, scroll: ScrollId) => number // combien de parchemins servent encore avant le niveau maximum
  toggleFav: (heroId: string) => void
  takeCards: (ids: string[]) => boolean // met de côté des doublons (échange, vente) ; la dernière copie reste toujours
  spendGems: (n: number) => boolean // âmes mises de côté (achat, enchère entre joueurs)
  addGems: (n: number) => void
  giveCards: (ids: string[]) => void // rend des cartes mises de côté si le serveur refuse // remboursement immédiat si le serveur refuse
  mergeAll: () => { merged: number; cards: number } // fusionne tous les doublons (jusqu'au niveau maximum de chaque carte)
  dupes: number // exemplaires en trop dans toute la collection
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
  accountXp: 0, rebirths: 0, gemsSpent: 0, shards: 0, awakened: [], energy: ENERGY_MAX, energyAt: 0, saga: {}, team: [], notifs: [], profile: { name: '', avatar: '', bio: '', tag: '', title: '', banner: { kind: 'anime', value: 'naruto' }, frame: '', ornament: '', aura: '', color: '', effect: '', theme: '', badges: [] }, pulls: 0, wins: 0, cosmetics: [], quests: emptyQuests(), path: { season: 0, xp: 0, claimed: [] }, spire: { best: 0 }, shop: emptyShop(), bazaar: emptyBazaar(), tourney: emptyTourney(), arena: emptyArena(), refClaimed: [], gtries: { day: '', n: 0 }, col: { week: '', cleared: [], tries: { day: '', n: 0 }, wins: 0, pulls: 0, final: false }, multis: {}, seen: { last: '', days: 0 }, achDone: [], arcHeroes: {}, tutorialSeen: [],
  tickets: 20, gems: START_GEMS, pity: Object.fromEntries(BANNERS.map((b) => [b.id, 0])), owned: {},
  xp: {}, scrolls: { small: 0, medium: 0, large: 0 }, wish: [], pinned: [], favs: [], log: {},
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
    const merged = { ...START, achDone: null, ...s, arena: { ...emptyArena(), ...s.arena }, tourney: { ...emptyTourney(), ...s.tourney }, shop: { ...emptyShop(), ...s.shop }, bazaar: { ...emptyBazaar(), ...s.bazaar }, pity: { ...START.pity, ...s.pity }, scrolls: { ...START.scrolls, ...s.scrolls }, profile: { ...START.profile, ...s.profile }, quests: { ...emptyQuests(), ...s.quests } }
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
    startOnline()
    void loadAllArt().then(setArt)
    void loadBannerArt().then(setBannerArt)
    void loadRemoteArt((urls, fans, seiyu) => { setRemote(urls); setFans(fans); setSeiyu(seiyu) }).then(setRemoteStatus)
  }, [])
  useEffect(() => {
    save(state)
    // en ligne : la partie et le profil public partent vers le serveur (quelques secondes après le dernier changement)
    const owned = HEROES.filter((h) => (state.owned[h.id] ?? 0) > 0)
    pushCloud(state, { name: state.profile.name.trim() || 'Joueur', avatar: state.profile.avatar.startsWith('http') ? state.profile.avatar : '', title: state.profile.title, bio: state.profile.bio,
      level: accountLevel(state.accountXp, state.rebirths).level, rebirths: state.rebirths, collection: owned.length, mr: owned.filter((h) => h.rarity === 'rift').length, lr: owned.filter((h) => h.rarity === 'legend').length,
      achievements: doneIds(state).length, spire: state.spire.best, arena: state.arena.best })
    // équipe d'Arène visible par les autres joueurs : l'équipe choisie, sinon les 3 cartes les plus rares
    const ids = state.team.filter((id) => state.owned[id]).slice(0, 3)
    const team = (ids.length ? ids : owned.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)).slice(0, 3).map((h) => h.id))
      .map((id) => ({ id, level: levelFromXp(state.xp[id] ?? 0, state.awakened.includes(id) ? MAX_LEVEL : LEVEL_CAP).level }))
    pushTeamLater(team)
  }, [state])
  // Jours de jeu et succès : on compte un nouveau jour, et on annonce chaque succès qui vient d'être obtenu.
  useEffect(() => {
    const today = dayKey(new Date())
    const done = doneIds(state)
    const seenNew = state.seen.last !== today
    const fresh = state.achDone ? done.filter((id) => !state.achDone!.includes(id)) : []
    if (!seenNew && state.achDone && fresh.length === 0) return
    setState((s) => {
      const seen = s.seen.last !== today ? { last: today, days: s.seen.days + 1 } : s.seen
      const news = ACHIEVEMENTS.filter((a) => fresh.includes(a.id))
      const notifs = news.length ? [...news.map((a, i) => ({ id: Date.now() * 100 + i, t: Date.now(), kind: 'ach' as const, text: `Succès ${METAL_LABEL[a.metal].toLowerCase()} : ${a.name}. Titre « ${a.title} » débloqué.`, read: false })), ...s.notifs].slice(0, NOTIF_MAX) : s.notifs
      return { ...s, seen, achDone: [...new Set([...(s.achDone ?? []), ...done])], notifs }
    })
  }, [state])
  const [now, setNow] = useState(Date.now()) // fait remonter l'énergie à l'écran
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  // En ligne : la boîte de réception (ventes, achats, échanges, enchères) est ouverte toute seule.
  const online = useOnline()
  useEffect(() => {
    if (!online.session) return
    let live = true
    const tick = async () => {
      heartbeat()
      const items = await fetchInbox()
      if (!live || !items.length) return
      await markInbox(items.map((x) => x.id))
      setState((s) => {
        const owned = { ...s.owned }
        let log = s.log
        for (const x of items) for (const id of x.cards) {
          owned[id] = (owned[id] ?? 0) + 1
          log = { ...log, [id]: [{ t: Date.now(), k: 'pull' as const, note: x.note }, ...(log[id] ?? [])].slice(0, 30) }
        }
        const notes = items.map((x, i) => ({ id: Date.now() * 100 + i, t: Date.now(), kind: 'bazaar' as const, read: false,
          text: `${x.note}${x.gems ? ` : +${x.gems} âmes` : ''}${x.tickets ? ` · +${x.tickets} sceaux` : ''}${x.cards.length ? ` · ${x.cards.map((id) => heroById(id)?.name ?? id).join(', ')}` : ''}.` }))
        return { ...s, owned, log, gems: s.gems + items.reduce((n, x) => n + x.gems, 0), tickets: s.tickets + items.reduce((n, x) => n + x.tickets, 0), notifs: [...notes, ...s.notifs].slice(0, NOTIF_MAX) }
      })
    }
    void tick()
    const t = setInterval(() => void tick(), 30000)
    return () => { live = false; clearInterval(t) }
  }, [online.session])
  // Bazar : les enchères terminées sont réglées, et les alertes de prix préviennent une fois par jour.
  useEffect(() => {
    const t = Date.now(), day = dayKey(new Date(t))
    const ended = state.bazaar.auctions.filter((a) => a.ends <= t)
    const stall = stallOf(day, state.wish)
    const hits = state.bazaar.alerted === day ? [] : state.bazaar.alerts.filter((a) => stall.some((x) => x.hero.id === a.heroId && x.price <= a.below))
    if (!ended.length && (state.bazaar.alerted === day || !state.bazaar.alerts.length)) return
    setState((s) => {
      let gems = s.gems
      const owned = { ...s.owned }
      const trades = [...s.bazaar.trades]
      const news: Notif[] = []
      for (const a of s.bazaar.auctions.filter((x) => x.ends <= t)) {
        const h = heroById(a.heroId)
        const r = auctionResult(a, h)
        if (r.sold) { gems += r.price; trades.unshift({ t: a.ends, heroId: a.heroId, kind: 'auction', price: r.price }) } else owned[a.heroId] = (owned[a.heroId] ?? 0) + 1
        news.push({ id: t * 100 + news.length, t, kind: 'bazaar', read: false, text: r.sold ? `Bazar : ${h.name} vendu aux enchères pour ${r.price} âmes (${r.bids} offres).` : `Bazar : personne n'a enchéri sur ${h.name}, la carte revient dans ta collection.` })
      }
      for (const a of hits) { const x = stall.find((y) => y.hero.id === a.heroId)!; news.push({ id: t * 100 + 50 + news.length, t, kind: 'bazaar', read: false, text: `Alerte de prix : ${x.hero.name} est au Bazar à ${x.price} âmes (ton seuil : ${a.below}).` }) }
      return { ...s, gems, owned, notifs: [...news, ...s.notifs].slice(0, NOTIF_MAX), bazaar: { ...s.bazaar, auctions: s.bazaar.auctions.filter((x) => x.ends > t), trades: trades.slice(0, 300), alerted: s.bazaar.alerts.length ? day : s.bazaar.alerted } }
    })
  }, [state, now])

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
    // Ajoute de l'XP au Chemin du Rift et prévient quand un palier est atteint.
    const withPath = (next: State, gain: number): State => {
      if (!gain) return next
      const p = rollPath(next.path, new Date())
      const path = { ...p, xp: p.xp + gain }
      const up = tierOf(path.xp) > tierOf(p.xp)
      return { ...next, path, notifs: up ? notify(next.notifs, [['quest', `Chemin du Rift : palier ${tierOf(path.xp)} atteint, ta récompense t’attend.`]]) : next.notifs }
    }
    const tracked = (base: State, adds: Counts): State => {
      const next = withPath(base, (adds.wins ?? 0) * PATH_XP.win + (adds.pulls ?? 0) * PATH_XP.pull + (adds.floors ?? 0) * PATH_XP.floor)
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
      const streak = (state.multis[banner.id] ?? 0) + (count === 10 ? 1 : 0)
      const { heroes, pity } = pullMany(banner, state.pity[banner.id], count, Math.random, count === 10 && streak >= BIG_PITY)
      const multis = { ...state.multis, [banner.id]: heroes.some((h) => h.rarity === 'rift') ? 0 : streak }
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
        pity: { ...state.pity, [banner.id]: pity }, multis, col: { ...rollCol(state.col, new Date()), pulls: rollCol(state.col, new Date()).pulls + count },
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
    // Nombre de parchemins qui servent encore : on s'arrête dès que la carte atteint son niveau maximum.
    const scrollsUseful = (heroId: string, scroll: ScrollId) => {
      const per = Math.round(SCROLLS[scroll].xp * (1 + (state.rebirths * REBIRTH_XP) / 100))
      let xp = state.xp[heroId] ?? 0, k = 0
      while (k < state.scrolls[scroll] && levelFromXp(xp, capOf(heroId)).level < capOf(heroId)) { xp += per; k++ }
      return k
    }
    const useScroll = (heroId: string, scroll: ScrollId, count = 1) => {
      if (!state.owned[heroId]) return 0
      const used = Math.min(count, scrollsUseful(heroId, scroll))
      if (used < 1) return 0
      gain(heroId, SCROLLS[scroll].xp * used, { k: 'scroll' }, used > 1 ? `${used} × ${SCROLLS[scroll].label}` : SCROLLS[scroll].label, { scrolls: { ...state.scrolls, [scroll]: state.scrolls[scroll] - used } })
      return used
    }
    const dupes = Object.values(state.owned).reduce((n, c) => n + Math.max(0, c - 1), 0)
    const mergeAll = () => {
      const owned = { ...state.owned }, xp = { ...state.xp }
      let log = state.log, merged = 0, cards = 0, levels = 0
      for (const [id, copies] of Object.entries(state.owned)) {
        if (copies < 2) continue
        const hero = heroById(id)
        if (!hero) continue
        const per = Math.round(MERGE_XP[hero.rarity] * (1 + (state.rebirths * REBIRTH_XP) / 100))
        const before = levelFromXp(xp[id] ?? 0, capOf(id)).level
        let n = 0
        while (owned[id] > 1 && levelFromXp(xp[id] ?? 0, capOf(id)).level < capOf(id)) { xp[id] = (xp[id] ?? 0) + per; owned[id]--; n++ }
        if (!n) continue
        merged += n; cards++
        const after = levelFromXp(xp[id], capOf(id)).level
        levels += after - before
        log = withLog(log, id, { k: 'merge', note: `${n} doublon${n > 1 ? 's' : ''} fusionné${n > 1 ? 's' : ''} · +${(per * n).toLocaleString('fr-FR')} XP${after > before ? ` · niveau ${after}` : ''}` })
      }
      if (merged) setState(tracked({ ...state, owned, xp, log }, { merges: merged, levels }))
      return { merged, cards }
    }
    const takeCards = (ids: string[]) => {
      const need: Record<string, number> = {}
      for (const id of ids) need[id] = (need[id] ?? 0) + 1
      if (Object.entries(need).some(([id, k]) => (state.owned[id] ?? 0) - k < 1)) return false
      const owned = { ...state.owned }
      for (const [id, k] of Object.entries(need)) owned[id] -= k
      setState({ ...state, owned })
      return true
    }
    const spendGems = (k: number) => { if (k < 1 || state.gems < k) return false; setState(tracked({ ...state, gems: state.gems - k, gemsSpent: state.gemsSpent + k }, { gemsSpent: k })); return true }
    const addGems = (k: number) => setState({ ...state, gems: state.gems + k })
    const giveCards = (ids: string[]) => { const owned = { ...state.owned }; for (const id of ids) owned[id] = (owned[id] ?? 0) + 1; setState({ ...state, owned }) }
    const toggleFav = (heroId: string) => setState({ ...state, favs: state.favs.includes(heroId) ? state.favs.filter((x) => x !== heroId) : [...state.favs, heroId] })
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

    // La Spire : l'étage suivant, gratuit ; la récompense n'est donnée qu'à la première victoire.
    const fightSpire = (): SpireResult | null => {
      if (teamNow.length === 0) return null
      const f = spireFloor(state.spire.best + 1)
      const allies = applyRule(teamNow.map((id, i) => makeUnit(heroById(id), cardState(heroById(id), state.xp, state.owned, state.rebirths, state.awakened, teamNow).stats, 0, i)), f.rule)
      const foes = spireFoes(f)
      const { events, win } = simulate(allies, foes, Math.random)
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      if (!win) { setState(tracked(state, { damage })); return { floor: f, allies, foes, events, win, first: false } }
      setState(tracked({
        ...grant(state, f.reward), spire: { best: f.n }, wins: state.wins + 1, accountXp: state.accountXp + f.accountXp,
        notifs: notify(state.notifs, [...(f.boss ? [['saga', `La Spire : gardien de l'étage ${f.n} vaincu !`] as [Notif['kind'], string]] : []), ...levelNote(state.accountXp + f.accountXp)]),
      }, { wins: 1, floors: 1, bosses: f.boss ? 1 : 0, damage }))
      return { floor: f, allies, foes, events, win, first: true }
    }

    // Les Colosses : 3 essais par jour, la récompense d'une difficulté une fois par semaine.
    const colNow = rollCol(state.col, new Date(now))
    const today = dayKey(new Date(now))
    const colTries = TRIES_PER_DAY - (colNow.tries.day === today ? colNow.tries.n : 0)
    const fightColossus = (id: Difficulty['id']): ColResult | null => {
      const t = new Date()
      const col = rollCol(state.col, t)
      const diff = DIFFICULTIES.find((d) => d.id === id)!
      const day = dayKey(t)
      const used = col.tries.day === day ? col.tries.n : 0
      if (teamNow.length === 0 || used >= TRIES_PER_DAY || !colOpen(col, diff)) return null
      const { boss, minions } = colossusOf(t)
      const allies = teamNow.map((hid, i) => makeUnit(heroById(hid), cardState(heroById(hid), state.xp, state.owned, state.rebirths, state.awakened, teamNow).stats, 0, i))
      const foes = colossusFoes(boss, minions, diff)
      const { events, win } = simulate(allies, foes, Math.random)
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      const tries = { day, n: used + 1 }
      if (!win) { setState(tracked({ ...state, col: { ...col, tries } }, { damage })); return { diff, allies, foes, events, win, first: false, card: null } }
      const first = !col.cleared.includes(diff.id)
      let next: State = { ...state, col: { ...col, tries, wins: col.wins + 1, cleared: first ? [...col.cleared, diff.id] : col.cleared }, wins: state.wins + 1 }
      next = grant(next, first ? { ...diff.reward, gems: (diff.reward.gems ?? 0) + WIN_SOULS } : { gems: WIN_SOULS })
      let card: Hero | null = null
      if (first && diff.card) {
        card = rollCard(Math.random)
        next = { ...next, owned: { ...next.owned, [card.id]: (next.owned[card.id] ?? 0) + 1 }, log: withLog(next.log, card.id, { k: 'pull', note: `Obtenue · Colosse ${boss.name}, ${diff.label}` }) }
      }
      next = { ...next, notifs: notify(next.notifs, [['saga', `Colosse ${boss.name} vaincu en ${diff.label} !`], ...(card ? [['pull', `Récompense Ultime : ${card.name} (${RARITIES[card.rarity].short}).`] as [Notif['kind'], string]] : [])]) }
      setState(tracked(next, { wins: 1, bosses: 1, damage }))
      return { diff, allies, foes, events, win, first, card }
    }
    const guildTries = TRIES_PER_DAY - (state.gtries.day === today ? state.gtries.n : 0)
    const fightGuildBoss = () => {
      const day = dayKey(new Date())
      const used = state.gtries.day === day ? state.gtries.n : 0
      if (teamNow.length === 0 || used >= TRIES_PER_DAY) return null
      const { boss, minions } = colossusOf(new Date())
      const diff = DIFFICULTIES[3]
      const allies = teamNow.map((hid, i) => makeUnit(heroById(hid), cardState(heroById(hid), state.xp, state.owned, state.rebirths, state.awakened, teamNow).stats, 0, i))
      // le boss de guilde a énormément de PV : on ne le bat pas seul, on lui retire un maximum de PV en 40 tours
      const foes = colossusFoes(boss, minions, diff).slice(0, 1).map((u) => ({ ...u, maxHp: u.maxHp * 400, hp: u.maxHp * 400 }))
      const { events } = simulate(allies, foes, Math.random)
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      setState(tracked({ ...state, gtries: { day, n: used + 1 } }, { damage }))
      return { result: { diff, allies, foes, events, win: false, first: false, card: null }, damage }
    }
    const claimReferral = (step: number, friends: number) => {
      const r = REFERRAL[step - 1]
      if (!r || friends < step || state.refClaimed.includes(step)) return false
      let next: State = grant({ ...state, refClaimed: [...state.refClaimed, step] }, r.reward)
      if (r.card) { const c = rollAtLeast(r.card, Math.random); next = { ...next, owned: { ...next.owned, [c.id]: (next.owned[c.id] ?? 0) + 1 }, notifs: notify(next.notifs, [['pull', `Parrainage : ${c.name} (${RARITIES[c.rarity].short}) rejoint ta collection.`]]) } }
      setState(next)
      return true
    }
    const claimEvent = () => {
      const col = rollCol(state.col, new Date())
      if (col.final || !eventDone(col)) return null
      const card = rollCard(Math.random)
      setState({ ...state, col: { ...col, final: true }, owned: { ...state.owned, [card.id]: (state.owned[card.id] ?? 0) + 1 }, accountXp: state.accountXp + ACCOUNT_XP[card.rarity],
        log: withLog(state.log, card.id, { k: 'pull', note: 'Obtenue · événement des Colosses' }), notifs: notify(state.notifs, [['pull', `Événement terminé : ${card.name} (${RARITIES[card.rarity].short}) rejoint ta collection.`]]) })
      return card
    }

    // L'Arène : 5 duels par jour contre des rivaux du jeu ; la Renaissance ne compte pas.
    const arenaUnits = () => teamNow.map((hid, i) => makeUnit(heroById(hid), cardState(heroById(hid), state.xp, state.owned, 0, state.awakened, teamNow).stats, 0, i))
    const arenaPower = arenaUnits().reduce((s, u) => s + power(u), 0)
    const duelsLeft = DUELS_PER_DAY - (state.arena.day === today ? state.arena.duels : 0)
    const duel = (rivalId: string, real?: RealOpponent): DuelResult | null => {
      const t = new Date()
      const a = state.arena
      const day = dayKey(t)
      const used = a.day === day ? a.duels : 0
      // un vrai joueur : son équipe affichée, avec le niveau de chaque carte (sans bonus de Renaissance, comme toi)
      const rival: Rival | undefined = real
        ? { id: `p-${real.id}`, name: `${real.name} #${real.no}`, elo: real.elo, heroes: real.team.map((x) => heroById(x.id)).filter(Boolean), scale: 1 }
        : rivalsFor(a.elo, a.seed).find((r) => r.id === rivalId)
      if (!rival || !rival.heroes.length || teamNow.length === 0 || used >= DUELS_PER_DAY) return null
      const allies = arenaUnits()
      const foes = real
        ? real.team.filter((x) => heroById(x.id)).map((x, i) => makeUnit(heroById(x.id), cardState(heroById(x.id), { [x.id]: xpForLevel(x.level) }, { [x.id]: 1 }, 0, x.level > LEVEL_CAP ? [x.id] : [], []).stats, 1, i))
        : rivalUnits(rival, a.elo, arenaPower)
      const { events, win } = simulate(allies, foes, Math.random)
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      const delta = eloChange(a.elo, rival.elo, win)
      const elo = Math.max(0, a.elo + delta)
      const w = rollWeek(a, t)
      const streak = win ? a.streak + 1 : 0
      const arena: ArenaState = { ...a, elo, best: Math.max(a.best, elo), wins: a.wins + (win ? 1 : 0), losses: a.losses + (win ? 0 : 1), streak, seed: a.seed + 1, day, duels: used + 1,
        week: { ...w, duels: w.duels + 1, wins: w.wins + (win ? 1 : 0), bestStreak: Math.max(w.bestStreak, streak), upsets: w.upsets + (win && rival.elo > a.elo ? 1 : 0) } }
      const next: State = { ...state, arena, gems: state.gems + (win ? DUEL_SOULS : 0), wins: state.wins + (win ? 1 : 0) }
      setState(tracked(next, { damage, ...(win ? { wins: 1 } : {}) }))
      return { rival, allies, foes, events, win, delta, elo }
    }
    // Le Grand Rift : un tournoi par jour ; une défaite élimine, la récompense de chaque tour gagné est donnée tout de suite.
    const tourneyFight = (): DuelResult | null => {
      const t = new Date(), day = dayKey(t)
      const tr = state.tourney.day === day ? state.tourney : { ...state.tourney, day, round: 0, out: false }
      if (tr.out || tr.round >= ROUNDS.length || teamNow.length === 0) return null
      const rival = tourneyRival(state.arena.elo, day, tr.round)
      const allies = arenaUnits()
      const foes = rivalUnits(rival, state.arena.elo, arenaPower)
      const { events, win } = simulate(allies, foes, Math.random)
      const damage = events.filter((e) => e.actor.startsWith('0-')).reduce((n, e) => n + e.hits.reduce((m, h) => m + h.amount, 0), 0)
      const final = tr.round === ROUNDS.length - 1
      let next: State = { ...state, tourney: { ...tr, round: win ? tr.round + 1 : tr.round, out: !win, titles: tr.titles + (win && final ? 1 : 0), finals: tr.finals + (final ? 1 : 0) }, wins: state.wins + (win ? 1 : 0) }
      if (win) next = grant(next, ROUNDS[tr.round].reward)
      if (win && final) next = { ...next, notifs: notify(next.notifs, [['saga', 'Tu remportes le Grand Rift du jour !']]) }
      setState(tracked(next, { damage, ...(win ? { wins: 1 } : {}) }))
      return { rival, allies, foes, events, win, delta: 0, elo: state.arena.elo }
    }
    const newRivals = () => setState({ ...state, arena: { ...state.arena, seed: state.arena.seed + 1 } })
    const claimPvp = (id: string) => {
      const a = state.arena, w = rollWeek(a, new Date())
      const g = PVP_GOALS.find((x) => x.id === id)
      if (!g || w.claimed.includes(id) || g.value(a, w) < g.target) return false
      setState({ ...grant(state, { gems: g.gems, tickets: g.tickets }), arena: { ...a, week: { ...w, claimed: [...w.claimed, id] } } })
      return true
    }

    // Bazar : marchands et acheteurs joués par le jeu ; seule la dernière copie d'une carte ne se vend pas.
    const levelOf = (heroId: string) => levelFromXp(state.xp[heroId] ?? 0, capOf(heroId)).level
    const bzToday = (b: BazaarState, day: string) => (b.day === day ? b : { ...b, day, bought: [] })
    const buyStall = (id: string) => {
      const day = dayKey(new Date())
      const b = bzToday(state.bazaar, day)
      const item = stallOf(day, state.wish).find((x) => x.id === id)
      if (!item || b.bought.includes(id) || state.gems < item.price) return false
      const h = item.hero
      setState(tracked({ ...state, gems: state.gems - item.price, gemsSpent: state.gemsSpent + item.price, owned: { ...state.owned, [h.id]: (state.owned[h.id] ?? 0) + 1 },
        log: withLog(state.log, h.id, { k: 'pull', note: `Achetée au Bazar · ${item.merchant}, ${item.price} âmes` }),
        bazaar: { ...b, bought: [...b.bought, id], trades: [{ t: Date.now(), heroId: h.id, kind: 'buy' as const, price: item.price }, ...b.trades].slice(0, 300) } }, { gemsSpent: item.price, newCards: state.owned[h.id] ? 0 : 1 }))
      return true
    }
    const quickSell = (heroId: string) => {
      const h = heroById(heroId)
      if (!h || (state.owned[heroId] ?? 0) < 2) return 0
      const price = quickPrice(h, levelOf(heroId), dayKey(new Date()))
      setState({ ...state, gems: state.gems + price, owned: { ...state.owned, [heroId]: state.owned[heroId] - 1 },
        bazaar: { ...state.bazaar, trades: [{ t: Date.now(), heroId, kind: 'sell' as const, price }, ...state.bazaar.trades].slice(0, 300) } })
      return price
    }
    const listAuction = (heroId: string, start: number) => {
      if ((state.owned[heroId] ?? 0) < 2 || start < 1 || state.bazaar.auctions.length >= 5) return false
      const at = Date.now()
      setState({ ...state, owned: { ...state.owned, [heroId]: state.owned[heroId] - 1 },
        bazaar: { ...state.bazaar, auctions: [...state.bazaar.auctions, { id: `${heroId}-${at}`, heroId, level: levelOf(heroId), start: Math.round(start), at, ends: at + AUCTION_HOURS * 3600000 }] } })
      return true
    }
    const setAlert = (heroId: string, below: number | null) => setState({ ...state, bazaar: { ...state.bazaar, alerts: [...state.bazaar.alerts.filter((a) => a.heroId !== heroId), ...(below ? [{ heroId, below }] : [])] } })

    // Boutique : tout en âmes, chaque offre une fois par semaine.
    const giftReady = state.shop.gift !== today
    const claimGift = () => {
      const t = new Date()
      if (state.shop.gift === dayKey(t)) return false
      setState({ ...grant(state, giftOf(t)), shop: { ...state.shop, gift: dayKey(t) } })
      return true
    }
    const buyOffer = (id: string) => {
      const t = new Date()
      const o = weeklyOffers(t).find((x) => x.id === id)
      const wk = weekKey(t)
      const bought = state.shop.week === wk ? state.shop.bought : []
      if (!o || bought.includes(id) || state.gems < o.price) return null
      let next: State = grant({ ...state, gems: state.gems - o.price, gemsSpent: state.gemsSpent + o.price }, o.reward)
      let card: Hero | null = null
      if (o.card) {
        card = rollAtLeast(o.card, Math.random)
        next = { ...next, owned: { ...next.owned, [card.id]: (next.owned[card.id] ?? 0) + 1 }, log: withLog(next.log, card.id, { k: 'pull', note: `Obtenue · boutique, ${o.name}` }),
          notifs: notify(next.notifs, [['pull', `Boutique : ${card.name} (${RARITIES[card.rarity].short}) rejoint ta collection.`]]) }
      }
      next = { ...next, shop: { ...next.shop, week: wk, bought: [...bought, id], history: [{ t: Date.now(), name: o.name, price: o.price }, ...next.shop.history].slice(0, 50) } }
      setState(tracked(next, { gemsSpent: o.price }))
      return card ?? true
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
      const xp = c.id === 'd-all' ? PATH_XP.dayBonus : c.period === 'day' ? PATH_XP.dayContract : c.period === 'week' ? PATH_XP.weekContract : PATH_XP.storyContract
      setState(withPath({ ...grant(state, c.reward), quests: addCounts(markClaimed(c, state.quests, t), { claims: 1 }, t) }, xp))
      return true
    }
    const claimChallenge = (id: string) => {
      const t = new Date()
      const c = challengesFor(t).find((x) => x.id === id)
      if (!c || !challengeState(c, state.quests, t).ready) return false
      setState(withPath({ ...grant(state, { gems: c.gems }), quests: markChallenge(c, state.quests, t) }, c.xp))
      return true
    }
    const claimDaily = () => {
      const t = new Date()
      const st = dailyStatus(state.quests.daily, t)
      if (st.claimed) return false
      setState(withPath({ ...grant(state, DAILY_REWARDS[st.day - 1]), quests: { ...addCounts(state.quests, { dailies: 1 }, t), daily: { last: dayKey(t), streak: st.day } } }, PATH_XP.daily))
      return true
    }
    const markVisit = () => { if (!roll(state.quests, new Date()).day.c.visit) setState(tracked(state, { visit: 1 })) }
    // Paliers du Chemin du Rift : la récompense, et une carte SR ou mieux tous les 10 paliers.
    const openTiers = (s: State, tiers: number[]): { s: State; cards: Hero[] } => {
      const path = rollPath(s.path, new Date())
      const ready = claimableTiers(path).filter((t) => tiers.includes(t))
      let next: State = { ...s, path }
      const cards: Hero[] = []
      for (const t of ready) {
        const r = tierReward(t)
        next = grant(next, r)
        if (r.card) {
          const h = rollCard(Math.random)
          cards.push(h)
          next = { ...next, owned: { ...next.owned, [h.id]: (next.owned[h.id] ?? 0) + 1 }, accountXp: next.accountXp + ACCOUNT_XP[h.rarity], log: withLog(next.log, h.id, { k: 'pull', note: `Obtenue · Chemin du Rift, palier ${t}` }),
            notifs: notify(next.notifs, [['pull', `Chemin du Rift : ${h.name} (${RARITIES[h.rarity].short}) rejoint ta collection.`]]) }
        }
      }
      return { s: { ...next, path: { ...path, claimed: [...path.claimed, ...ready] } }, cards }
    }
    const claimTier = (tier: number) => {
      if (!claimableTiers(rollPath(state.path, new Date())).includes(tier)) return null
      const { s, cards } = openTiers(state, [tier])
      setState(s)
      return cards[0] ?? true
    }
    const claimAllTiers = () => {
      const { s, cards } = openTiers(state, claimableTiers(rollPath(state.path, new Date())))
      setState(s)
      return cards
    }
    const questsReady = claimable(state.quests, state.saga, new Date(now)).length + (dailyStatus(state.quests.daily, new Date(now)).claimed ? 0 : 1) + claimableTiers(rollPath(state.path, new Date(now))).length + challengesFor(new Date(now)).filter((c) => challengeState(c, state.quests, new Date(now)).ready).length + (eventDone(colNow) && !colNow.final ? 1 : 0) + PVP_GOALS.filter((g) => { const w = rollWeek(state.arena, new Date(now)); return !w.claimed.includes(g.id) && g.value(state.arena, w) >= g.target }).length
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
    return { ...state, canAfford, summon, merge, mergeAll, dupes, useScroll, scrollsUseful, toggleFav, takeCards, spendGems, addGems, giveCards, toggleWish, togglePin, fightSpire, fightGuildBoss, guildTries, claimReferral, tourneyFight, buyStall, quickSell, listAuction, setAlert, levelOf, buyOffer, claimGift, giftReady, duel, newRivals, claimPvp, duelsLeft, arenaPower, fightColossus, claimEvent, colTries, claimContract, claimDaily, claimChallenge, claimTier, claimAllTiers, markVisit, questsReady, buyCosmetic, buyEnergy, seeTutorial, resetTutorial, setProfile, resetGame, readNotifs, clearNotifs, teamNow, setTeam, fight, energyLeft, spendEnergy, awaken, rebirth, remoteArt, remoteStatus, remoteFans, remoteSeiyu, bannerArt, customArt, setCustomArt, clearCustomArt }
  }, [state, customArt, remoteArt, remoteStatus, remoteFans, remoteSeiyu, bannerArt, now])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = (): Store => useContext(Ctx)!
