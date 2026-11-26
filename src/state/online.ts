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
  void supa.auth.getSession().then(async ({ data }) => {
    set({ session: data.session, ready: true })
    if (data.session) { await fetchMe(data.session.user.id); await adopt(data.session) }
  })
  supa.auth.onAuthStateChange((event, session) => {
    set({ session })
    if (event === 'SIGNED_IN' && session) void fetchMe(session.user.id).then(() => adopt(session))
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
