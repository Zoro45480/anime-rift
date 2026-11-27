import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

// Le serveur du jeu (Supabase). La clé « publishable » est faite pour être dans le jeu : les règles de sécurité
// côté serveur (RLS) décident de ce que chacun peut lire ou écrire.
const URL = 'https://xfmxivqfpelbabpvkbhd.supabase.co'
const KEY = 'sb_publishable_3xfKJPK_Z-kXJ9vPEEO1Ig_JsuEKTbY'
export const supa = createClient(URL, KEY, { auth: { persistSession: true, storageKey: 'anime-rift-auth' } })

export type OnlineProfile = { id: string; player_no: number; name: string; avatar: string; title: string; bio: string; level: number; rebirths: number; collection: number; mr: number; lr: number; achievements: number; spire: number; arena: number; score: number }
export type Stats = Pick<OnlineProfile, 'name' | 'avatar' | 'title' | 'bio' | 'level' | 'rebirths' | 'collection' | 'mr' | 'lr' | 'achievements' | 'spire' | 'arena'>

// Score du Hall of Fame : toute la carrière compte.
export const scoreOf = (s: Stats) => s.collection * 10 + s.mr * 500 + s.lr * 150 + s.level * 20 + s.rebirths * 1000 + s.achievements * 50 + s.spire * 30 + Math.max(0, s.arena - 1000)

// ── Session : un petit état partagé, que l'interface écoute ──
type Online = { session: Session | null; me: OnlineProfile | null; ready: boolean }
let current: Online = { session: null, me: null, ready: false }
const listeners = new Set<(o: Online) => void>()
const set = (o: Partial<Online>) => { current = { ...current, ...o }; listeners.forEach((f) => f(current)) }
export const useOnline = () => {
  const [o, setO] = useState(current)
  useEffect(() => { listeners.add(setO); setO(current); return () => { listeners.delete(setO) } }, [])
  return o
}

const fetchMe = async (id: string) => {
  const { data } = await supa.from('profiles').select('*').eq('id', id).maybeSingle()
  set({ me: (data as OnlineProfile | null) ?? null })
}

const SAVE_KEY = 'anime-rift-save-v1'
const SYNC_KEY = 'anime-rift-synced-user'
// À la connexion : si une sauvegarde existe en ligne, on la reprend sur cet appareil ; sinon on envoie la partie de l'appareil.
const adopt = async (session: Session) => {
  const uid = session.user.id
  const { data } = await supa.from('saves').select('data, updated_at').eq('id', uid).maybeSingle()
  const already = localStorage.getItem(SYNC_KEY) === uid
  if (data && !already) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data.data))
    localStorage.setItem(SYNC_KEY, uid)
    window.location.reload()
    return
  }
  localStorage.setItem(SYNC_KEY, uid)
  if (!data) {
    const local = localStorage.getItem(SAVE_KEY)
    if (local) await supa.from('saves').upsert({ id: uid, data: JSON.parse(local), updated_at: new Date().toISOString() })
  }
}

let started = false
export const startOnline = () => {
  if (started) return
  started = true
  // lien de parrainage : ?ref=NUMERO, gardé jusqu'à la première connexion
  try { const ref = new URLSearchParams(window.location.search).get('ref'); if (ref && /^\d+$/.test(ref)) localStorage.setItem('anime-rift-ref', ref); const ami = new URLSearchParams(window.location.search).get('ami'); if (ami) localStorage.setItem('anime-rift:friend-code', ami.slice(0, 12)) } catch { /* rien */ }
  void supa.auth.getSession().then(async ({ data }) => {
    set({ session: data.session, ready: true })
    if (data.session) { await fetchMe(data.session.user.id); await adopt(data.session) }
  })
  supa.auth.onAuthStateChange((event, session) => {
    set({ session })
    if (event === 'SIGNED_IN' && session) {
      const ref = localStorage.getItem('anime-rift-ref')
      if (ref) { localStorage.removeItem('anime-rift-ref'); void supa.rpc('set_referrer', { no: Number(ref) }) }
      void fetchMe(session.user.id).then(() => adopt(session))
    }
    if (event === 'SIGNED_OUT') { set({ me: null }); localStorage.removeItem(SYNC_KEY) }
  })
}

export const signUp = async (email: string, password: string, name: string) => {
  const { data, error } = await supa.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: window.location.origin + window.location.pathname } })
  if (error) return { ok: false, message: frError(error.message) }
  return { ok: true, message: data.session ? 'Compte créé, tu es connecté !' : 'Compte créé ! Ouvre l’e-mail reçu pour confirmer ton adresse, puis connecte-toi.' }
}
export const signIn = async (email: string, password: string) => {
  const { error } = await supa.auth.signInWithPassword({ email, password })
  return error ? { ok: false, message: frError(error.message) } : { ok: true, message: 'Connecté !' }
}
export const signOut = () => supa.auth.signOut()
// Connexion avec Google ou Discord : on part sur leur page, puis on revient dans le jeu déjà connecté.
export const signInWith = async (provider: 'google' | 'discord') => {
  const { error } = await supa.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + window.location.pathname } })
  return error ? (/not enabled|Unsupported provider/i.test(error.message) ? `La connexion ${provider === 'google' ? 'Google' : 'Discord'} n'est pas encore activée sur le serveur.` : error.message) : ''
}
// Pseudo du compte Google ou Discord, utilisé si le joueur n'en a pas encore choisi.
export const accountName = (s: Session | null) => {
  const m = s?.user.user_metadata ?? {}
  return String(m.custom_claims?.global_name ?? m.full_name ?? m.name ?? m.user_name ?? '').slice(0, 20)
}

const frError = (m: string) =>
  /Invalid login/i.test(m) ? 'E-mail ou mot de passe incorrect.'
    : /not confirmed/i.test(m) ? 'Adresse pas encore confirmée : ouvre l’e-mail reçu.'
      : /already registered/i.test(m) ? 'Un compte existe déjà avec cette adresse : connecte-toi.'
        : /at least 6/i.test(m) ? 'Le mot de passe doit faire au moins 6 caractères.'
          : /rate limit/i.test(m) ? 'Trop d’essais : réessaie dans quelques minutes.'
            : m

// Envoi de la partie (quelques secondes après chaque changement) et mise à jour du profil public.
let timer: ReturnType<typeof setTimeout> | undefined
export const pushCloud = (data: unknown, stats: Stats) => {
  const uid = current.session?.user.id
  if (!uid) return
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const now = new Date().toISOString()
    await supa.from('saves').upsert({ id: uid, data, updated_at: now })
    const name = stats.name === 'Joueur' && accountName(current.session) ? accountName(current.session) : stats.name
    const row = { ...stats, name, score: scoreOf(stats), updated_at: now }
    const { data: me } = await supa.from('profiles').update(row).eq('id', uid).select('*').maybeSingle()
    if (me) set({ me: me as OnlineProfile })
  }, 3000)
}

// Hall of Fame
export const loadFame = async (order: 'score' | 'collection' | 'spire' = 'score') => {
  const [{ data }, { data: count }] = await Promise.all([
    supa.from('profiles').select('*').order(order, { ascending: false }).order('player_no').limit(50),
    supa.rpc('player_count'),
  ])
  return { top: (data ?? []) as OnlineProfile[], count: Number(count ?? 0) }
}
export const myRank = async (me: OnlineProfile, order: 'score' | 'collection' | 'spire' = 'score') => {
  const { count } = await supa.from('profiles').select('id', { count: 'exact', head: true }).gt(order, me[order])
  return (count ?? 0) + 1
}

// ═════════ Étape 2 : boîte de réception, social, échanges, marché, guildes, chat, parrainage ═════════
export const myId = () => current.session?.user.id ?? null
export type InboxItem = { id: number; gems: number; tickets: number; cards: string[]; note: string; created_at: string }
export const fetchInbox = async () => {
  if (!myId()) return [] as InboxItem[]
  const { data } = await supa.from('inbox').select('*').eq('claimed', false).order('id')
  return (data ?? []) as InboxItem[]
}
export const markInbox = (ids: number[]) => supa.from('inbox').update({ claimed: true }).in('id', ids)

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supa.rpc(fn, args)
  if (error) return error.message
  return String(data ?? 'ok')
}

// Joueurs
export type PublicPlayer = OnlineProfile & { last_seen: string; dm_policy: 'all' | 'friends' | 'nobody'; guild_id: string | null; team: { id: string; level: number }[] }
export const isOnlineNow = (p: { last_seen: string }) => Date.now() - new Date(p.last_seen).getTime() < 5 * 60000
export const findPlayers = async (q: string) => {
  const m = q.trim().match(/^(.*?)#?(\d+)?$/)
  let req = supa.from('profiles').select('*').neq('id', myId() ?? '').limit(10)
  if (m?.[2]) req = req.eq('player_no', Number(m[2]))
  else req = req.ilike('name', `%${q.trim()}%`)
  const { data } = await req
  return (data ?? []) as PublicPlayer[]
}
export const playersById = async (ids: string[]) => {
  if (!ids.length) return [] as PublicPlayer[]
  const { data } = await supa.from('profiles').select('*').in('id', ids)
  return (data ?? []) as PublicPlayer[]
}
export const setDmPolicy = (p: 'all' | 'friends' | 'nobody') => supa.from('profiles').update({ dm_policy: p }).eq('id', myId() ?? '')
export const heartbeat = () => { const id = myId(); if (id) void supa.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', id) }

// Amis
export type FriendRow = { user_id: string; friend_id: string; status: 'pending' | 'accepted' }
export const fetchFriends = async () => {
  const { data } = await supa.from('friends').select('*')
  return (data ?? []) as FriendRow[]
}
export const askFriend = async (id: string) => { const { error } = await supa.from('friends').insert({ user_id: myId(), friend_id: id }); return error ? (/duplicate/.test(error.message) ? 'Demande déjà envoyée.' : error.message) : 'ok' }
export const acceptFriend = (from: string) => supa.from('friends').update({ status: 'accepted' }).eq('user_id', from).eq('friend_id', myId() ?? '')
export const removeFriend = async (other: string) => {
  const me = myId() ?? ''
  await supa.from('friends').delete().or(`and(user_id.eq.${me},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${me})`)
}

// Code ami : chaque joueur a un code fixe tiré de son numéro (ex. RIFT-K7M2Q), facile à partager.
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_MOD = 2 ** 25
const CODE_MUL = 0x2f5a3b9
const CODE_ADD = 0x13c6e1
const mulMod = (a: number, b: number) => Number((BigInt(a) * BigInt(b)) % BigInt(CODE_MOD))
const CODE_INV = (() => { let x = 1; for (let i = 0; i < 6; i++) x = mulMod(x, (2 - mulMod(CODE_MUL, x) + CODE_MOD * 2) % CODE_MOD); return x })()
export const friendCode = (no: number) => {
  let x = (mulMod(no, CODE_MUL) + CODE_ADD) % CODE_MOD
  let out = ''
  for (let i = 0; i < 5; i++) { out = CODE_ABC[x % 32] + out; x = Math.floor(x / 32) }
  return `RIFT-${out}`
}
export const codeToNo = (code: string) => {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^RIFT/, '')
  if (c.length !== 5) return null
  let x = 0
  for (const ch of c) { const v = CODE_ABC.indexOf(ch); if (v < 0) return null; x = x * 32 + v }
  const no = mulMod((x - CODE_ADD + CODE_MOD) % CODE_MOD, CODE_INV)
  return no > 0 && no < 10_000_000 ? no : null
}
export const FRIEND_PARAM = 'anime-rift:friend-code'
export const addByCode = async (code: string): Promise<string> => {
  const no = codeToNo(code)
  if (!no) return 'Ce code n\'est pas valide. Il ressemble à RIFT-K7M2Q.'
  const { data } = await supa.from('profiles').select('*').eq('player_no', no).maybeSingle()
  const p = data as PublicPlayer | null
  if (!p) return 'Aucun joueur n\'a ce code.'
  if (p.id === myId()) return 'C\'est ton propre code !'
  const rows = await fetchFriends()
  const link = rows.find((r) => (r.user_id === p.id && r.friend_id === myId()) || (r.user_id === myId() && r.friend_id === p.id))
  if (link?.status === 'accepted') return `${p.name} est déjà ton ami.`
  if (link && link.user_id === p.id) { await acceptFriend(p.id); return `${p.name} t'avait déjà demandé : vous êtes maintenant amis !` }
  if (link) return `Demande déjà envoyée à ${p.name}.`
  const r = await askFriend(p.id)
  return r === 'ok' ? `Demande d'ami envoyée à ${p.name} !` : r
}

// Messages
export type Message = { id: number; from_id: string; to_id: string; body: string; read: boolean; created_at: string }
export const fetchMessages = async () => {
  const { data } = await supa.from('messages').select('*').order('id', { ascending: false }).limit(300)
  return ((data ?? []) as Message[]).reverse()
}
export const sendMessage = async (to: string, body: string) => {
  const { error } = await supa.from('messages').insert({ from_id: myId(), to_id: to, body: body.trim().slice(0, 500) })
  return error ? (/row-level security/.test(error.message) ? 'Ce joueur n’accepte pas tes messages.' : error.message) : 'ok'
}
export const markRead = (from: string) => supa.from('messages').update({ read: true }).eq('from_id', from).eq('to_id', myId() ?? '').eq('read', false)

// Échanges
export type Trade = { id: number; from_id: string; to_id: string; give: string[]; want: string[]; status: 'open' | 'accepted' | 'refused' | 'cancelled'; created_at: string }
export const fetchTrades = async () => {
  const { data } = await supa.from('trades').select('*').order('id', { ascending: false }).limit(50)
  return (data ?? []) as Trade[]
}
export const proposeTrade = async (to: string, give: string[], want: string[]) => {
  const { error } = await supa.from('trades').insert({ from_id: myId(), to_id: to, give, want })
  return error ? error.message : 'ok'
}
export const answerTrade = (id: number, accept: boolean) => rpc('answer_trade', { trade: id, accept })

// Marché entre joueurs
export type Listing = { id: number; seller: string; hero_id: string; level: number; kind: 'fixed' | 'auction'; price: number; best_bid: number | null; best_bidder: string | null; ends_at: string; status: string; buyer: string | null; created_at: string }
export const fetchListings = async () => {
  const { data } = await supa.from('listings').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(200)
  return (data ?? []) as Listing[]
}
export const fetchMyListings = async () => {
  const { data } = await supa.from('listings').select('*').or(`seller.eq.${myId()},buyer.eq.${myId()},best_bidder.eq.${myId()}`).order('id', { ascending: false }).limit(50)
  return (data ?? []) as Listing[]
}
export const createListing = async (hero_id: string, level: number, kind: 'fixed' | 'auction', price: number, hours: number) => {
  const { error } = await supa.from('listings').insert({ seller: myId(), hero_id, level, kind, price, ends_at: new Date(Date.now() + hours * 3600000).toISOString() })
  return error ? error.message : 'ok'
}
export const buyListing = (id: number) => rpc('buy_listing', { listing: id })
export const bidListing = (id: number, amount: number) => rpc('bid_listing', { listing: id, amount })
export const closeListing = (id: number) => rpc('close_listing', { listing: id })

// Guildes
export type Guild = { id: string; name: string; tag: string; description: string; kind: 'open' | 'invite' | 'closed'; min_level: number; max_members: number; emblem: string; color: string; members: number; week_damage: number }
export type GuildMember = { guild_id: string; user_id: string; role: 'chef' | 'adjoint' | 'membre'; joined_at: string }
export const fetchGuilds = async (q = '') => {
  let req = supa.from('guild_board').select('*').order('week_damage', { ascending: false }).limit(50)
  if (q.trim()) req = req.or(`name.ilike.%${q.trim()}%,tag.ilike.%${q.trim()}%`)
  const { data } = await req
  return (data ?? []) as Guild[]
}
export const fetchMyGuild = async () => {
  const id = myId()
  if (!id) return null
  const { data: m } = await supa.from('guild_members').select('*').eq('user_id', id).maybeSingle()
  if (!m) return null
  const [{ data: g }, { data: members }, { data: reqs }] = await Promise.all([
    supa.from('guild_board').select('*').eq('id', m.guild_id).maybeSingle(),
    supa.from('guild_members').select('*').eq('guild_id', m.guild_id),
    supa.from('guild_requests').select('*').eq('guild_id', m.guild_id),
  ])
  return { guild: g as Guild, me: m as GuildMember, members: (members ?? []) as GuildMember[], requests: (reqs ?? []) as { user_id: string }[] }
}
export const weekDamage = async (guildId: string, week: string) => {
  const { data } = await supa.from('guild_damage').select('*').eq('guild_id', guildId).eq('week', week)
  return (data ?? []) as { user_id: string; damage: number; tries: number }[]
}
export const createGuild = (g: { name: string; tag: string; description: string; kind: string; min_level: number; max_members: number; emblem: string; color: string }) =>
  rpc('create_guild', { g_name: g.name, g_tag: g.tag, g_desc: g.description, g_kind: g.kind, g_min: g.min_level, g_max: g.max_members, g_emblem: g.emblem, g_color: g.color })
export const joinGuild = (id: string) => rpc('join_guild', { gid: id })
export const leaveGuild = () => rpc('leave_guild', {})
export const answerRequest = (gid: string, uid: string, accept: boolean) => rpc('answer_request', { gid, uid, accept })
export const setMemberRole = (uid: string, role: string) => rpc('set_member_role', { uid, new_role: role })
export const hitGuildBoss = (week: string, damage: number) => rpc('hit_guild_boss', { wk: week, dmg: Math.round(damage) })

// Chat
export type ChatLine = { id: number; room: string; user_id: string; body: string; card: string | null; created_at: string }
export const fetchChat = async (room: string, after = 0) => {
  const { data } = await supa.from('chat').select('*').eq('room', room).gt('id', after).order('id', { ascending: false }).limit(60)
  return ((data ?? []) as ChatLine[]).reverse()
}
export const sendChat = async (room: string, body: string, card?: string) => {
  const { error } = await supa.from('chat').insert({ room, user_id: myId(), body: body.trim().slice(0, 300), card: card ?? null })
  return error ? error.message : 'ok'
}

// Parrainage
export const setReferrer = (no: number) => rpc('set_referrer', { no })
export const myReferrals = async () => { const { data } = await supa.rpc('my_referrals'); return Number(data ?? 0) }

// Équipe affichée pour l'Arène (les autres joueurs l'affrontent)
export const pushTeam = (team: { id: string; level: number }[]) => { const id = myId(); if (id) void supa.from('profiles').update({ team }).eq('id', id) }
export const arenaOpponents = async (elo: number) => {
  const { data } = await supa.from('profiles').select('*').neq('id', myId() ?? '').gte('arena', elo - 250).lte('arena', elo + 250).order('last_seen', { ascending: false }).limit(30)
  return ((data ?? []) as PublicPlayer[]).filter((p) => Array.isArray(p.team) && p.team.length > 0)
}
let teamTimer: ReturnType<typeof setTimeout> | undefined
let lastTeam = ''
export const pushTeamLater = (team: { id: string; level: number }[]) => {
  const key = JSON.stringify(team)
  if (key === lastTeam || !myId()) return
  clearTimeout(teamTimer)
  teamTimer = setTimeout(() => { lastTeam = key; pushTeam(team) }, 4000)
}

// Ouvre les Réglages (où se trouve la connexion) depuis n'importe quel écran.
export const openSettings = () => window.dispatchEvent(new Event('anime-rift:settings'))
