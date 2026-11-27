import { useEffect, useState } from 'react'
import { Social } from './Social'
import { GuildPage } from './Guild'
import { Referral } from './Referral'
export { openSettings } from '../state/online'
import { openSettings } from '../state/online'
import { askFriend, fetchGuilds, friendCode, loadFame, myId, myRank, scoreOf, useOnline, type Guild, type OnlineProfile } from '../state/online'
import { HEROES } from '../data/heroes'
import { ACHIEVEMENTS, progressOf } from '../game/achievements'
import { leagueOf } from '../game/arena'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { Avatar } from '../ui/Settings'

export type CommunityTab = 'social' | 'guild' | 'fame' | 'referral'
export const COMMUNITY: [CommunityTab, string][] = [['social', 'Social'], ['guild', 'Ordre'], ['fame', 'Panthéon'], ['referral', 'Lien de Faille']]
const n = (x: number) => x.toLocaleString('fr-FR')

export const Community = ({ start = 'fame', onProfile }: { start?: CommunityTab; onProfile: () => void }) => {
  const store = useStore()
  const [tab, setTab] = useState<CommunityTab>(start)
  const mine = HEROES.filter((h) => store.owned[h.id]).length
  const acc = accountLevel(store.accountXp, store.rebirths)
  const done = ACHIEVEMENTS.filter((a) => progressOf(a, store).done).length
  const stars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const records: [string, string, string][] = [
    ['Collection', `${n(mine)} / ${n(HEROES.length)}`, 'cartes uniques'], ['Cartes MR', n(HEROES.filter((h) => h.rarity === 'rift' && store.owned[h.id]).length), 'mythiques'],
    ['Niveau de compte', String(acc.level), `${store.rebirths} Ascension${store.rebirths > 1 ? 's' : ''}`], ['Succès', `${done} / ${ACHIEVEMENTS.length}`, 'obtenus'],
    ['La Tour de l’Infini', `Étage ${store.spire.best}`, 'meilleur étage'], ['Arène', n(store.arena.best), `meilleure cote · ${leagueOf(store.arena.best).label}`],
    ['Grand Rift', String(store.tourney.titles), 'tournois gagnés'], ['L’Aventure', `${stars} ★`, 'étoiles'], ['Invocations', n(store.pulls), 'au total'],
  ]
  return (
    <div className="cm">
      <header className="cm__head"><div><p className="eyebrow">Communauté</p><h1>{COMMUNITY.find((x) => x[0] === tab)![1]}</h1></div></header>
      <div className="coltabs__bar" role="tablist" aria-label="Communauté">
        {COMMUNITY.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'referral' ? <Referral /> : tab === 'guild' ? <GuildPage onConnect={openSettings} /> : tab === 'social' ? <Social onGuild={() => setTab('guild')} onProfile={onProfile} onConnect={openSettings} /> : tab === 'fame' ? (<>
        <FameBoard />
        <section className="cm__fame">
          <h3 className="sp-sub">Tes records</h3>
          <div className="cm__me"><Avatar size={64} /><div><b>{store.profile.name.trim() || 'Joueur'}</b><small>Ta carrière, avant et après les Ascensions</small></div></div>
          <ul className="cm__records">{records.map(([k, v, s]) => <li key={k}><small>{k}</small><b>{v}</b><span>{s}</span></li>)}</ul>
        </section>
      </>) : null}
    </div>
  )
}

type FameOrder = 'score' | 'collection' | 'spire'
const FAME_TABS: [FameOrder | 'guilds', string][] = [['score', 'Global'], ['collection', 'Collection'], ['spire', 'Tour de l’Infini'], ['guilds', 'Ordres']]
const MEDALS = ['Or', 'Argent', 'Bronze']

// Le Panthéon : le vrai classement de tous les joueurs inscrits, lu sur le serveur.
const FameBoard = () => {
  const { me, session } = useOnline()
  const [order, setOrderRaw] = useState<FameOrder>('score')
  const [guilds, setGuilds] = useState(false)
  const [who, setWho] = useState<OnlineProfile | null>(null)
  const setOrder = (o: FameOrder | 'guilds') => { if (o === 'guilds') setGuilds(true); else { setGuilds(false); setOrderRaw(o) } }
  const [data, setData] = useState<{ top: OnlineProfile[]; count: number } | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let live = true
    loadFame(order).then((d) => { if (live) { setData(d); setErr(false) } }).catch(() => live && setErr(true))
    if (me) void myRank(me, order).then((r) => live && setRank(r))
    return () => { live = false }
  }, [order, me])
  const value = (p: OnlineProfile) => (order === 'score' ? `${n(p.score)} pts` : order === 'collection' ? `${n(p.collection)} / ${n(HEROES.length)}` : `Étage ${p.spire}`)
  const podium = data?.top.slice(0, 3) ?? []
  return (
    <section className="hf">
      <header className="hf__head">
        <div><p className="eyebrow">Les plus grandes carrières</p><h2>Panthéon</h2><p>Toute ta carrière compte : collection, cartes MR et LR, niveau, Ascensions, succès, La Tour de l’Infini et l'Arène.</p></div>
        <ul className="hf__mine">
          <li><b>{data ? n(data.count) : '…'}</b><span>Joueurs</span></li>
          <li><b>{me && rank ? `#${n(rank)}` : '—'}</b><span>Ta place</span></li>
          <li><b>{me ? n(me.score) : '—'}</b><span>Ton score</span></li>
        </ul>
      </header>
      <div className="coltabs__bar" role="tablist">{FAME_TABS.map(([id, label]) => { const on = id === 'guilds' ? guilds : !guilds && order === id; return <button key={id} role="tab" aria-selected={on} className={on ? 'is-active' : ''} onClick={() => setOrder(id)}>{label}</button> })}</div>
      {guilds ? <OrderBoard /> : <>
      {!session && <p className="hf__join">Tu n'es pas encore classé : crée ton compte dans <b>Réglages → Compte en ligne</b> pour apparaître ici.</p>}
      {err ? <p className="pf-empty">Impossible de joindre le serveur pour l'instant.</p> : !data ? <p className="pf-empty">Chargement du classement…</p> : data.top.length === 0 ? <p className="pf-empty">Personne n'est encore classé : sois le premier joueur inscrit !</p> : <>
        <div className="hf__podium">
          {[1, 0, 2].map((i) => podium[i] && (
            <div key={podium[i].id} className={`hf__step hf__step--${i + 1}`} onClick={() => setWho(podium[i])} style={{ cursor: 'pointer' }}>
              <span className="hf__crown">{i === 0 ? '👑' : '♛'}</span>
              <span className="hf__avatar">{podium[i].avatar ? <img src={podium[i].avatar} alt="" referrerPolicy="no-referrer" /> : podium[i].name[0]}</span>
              <b>{podium[i].name} <i>#{podium[i].player_no}</i></b>
              <strong>{value(podium[i])}</strong>
              <small>{n(podium[i].collection)} persos · {podium[i].lr} LR · {podium[i].mr} MR · Nv {podium[i].level}</small>
              <div className="hf__block"><em>{i + 1}</em><span>{MEDALS[i]}</span></div>
            </div>
          ))}
        </div>
        <table className="hf__table">
          <thead><tr><th>#</th><th>Joueur</th><th>Record de collection</th><th>Renais.</th><th>{order === 'spire' ? 'Étage' : 'Score'}</th></tr></thead>
          <tbody>{data.top.map((p, i) => (
            <tr key={p.id} className={me?.id === p.id ? 'is-me' : ''} onClick={() => setWho(p)} style={{ cursor: 'pointer' }}>
              <td className="hf__rank">{i + 1}</td>
              <td><span className="hf__who"><span className="hf__avatar hf__avatar--small">{p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : p.name[0]}</span><b>{p.name}</b><i>#{p.player_no}</i>{me?.id === p.id && <u>Toi</u>}</span></td>
              <td><span className="hf__col"><b>{n(p.collection)}</b> / {n(HEROES.length)}<em>{((p.collection / HEROES.length) * 100).toFixed(1)} %</em></span><div className="hf__bar"><i style={{ width: `${(p.collection / HEROES.length) * 100}%` }} /></div></td>
              <td>{p.rebirths}</td>
              <td className="hf__score">{order === 'spire' ? p.spire : n(p.score || scoreOf(p))}</td>
            </tr>
          ))}</tbody>
        </table>
        {me && rank && rank > data.top.length && <div className="hf__stick"><span className="hf__rank">{n(rank)}</span><b>{me.name}</b><i>#{me.player_no}</i><u>Toi</u><span className="hf__score">{order === 'spire' ? `Étage ${me.spire}` : n(me.score)}</span></div>}
      </>}
      </>}
      {who && <PlayerMini p={who} onClose={() => setWho(null)} />}
    </section>
  )
}

// Mini-fiche d'un joueur : ouverte en touchant une ligne du Panthéon.
const PlayerMini = ({ p, onClose }: { p: OnlineProfile; onClose: () => void }) => {
  const [msg, setMsg] = useState('')
  const lg = leagueOf(p.arena)
  const self = p.id === myId()
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Fiche de ${p.name}`} onClick={onClose}>
      <div className="pmini" onClick={(e) => e.stopPropagation()}>
        <button className="pmini__x" onClick={onClose} aria-label="Fermer">×</button>
        <div className="pmini__ban" />
        <span className="pmini__av">{p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : p.name[0]}</span>
        <h3>{p.name} <i>#{p.player_no}</i></h3>
        {p.title && <p className="pmini__title">{p.title}</p>}
        <p className="pmini__lvl">Niveau {p.level}{p.rebirths ? ` · ${p.rebirths} Ascension${p.rebirths > 1 ? 's' : ''}` : ''}</p>
        {p.bio && <p className="pmini__bio">{p.bio}</p>}
        <ul className="pmini__nums"><li><b>{n(p.collection)}</b><span>cartes</span></li><li><b>{p.mr}</b><span>cartes MR</span></li><li><b style={{ color: lg.hue }}>{lg.label}</b><span>{n(p.arena)} élo</span></li></ul>
        <p className="pmini__code">Code ami <b>{friendCode(p.player_no)}</b></p>
        {!self && <div className="pmini__btns">
          <button className="cd-btn cd-btn--main cd-btn--small" onClick={() => void askFriend(p.id).then((r) => setMsg(r === 'ok' ? 'Demande d’ami envoyée !' : r))}>Ajouter en ami</button>
          <button className="cd-btn cd-btn--small" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'bazaar' })) }}>Échanger</button>
        </div>}
        <p className="cd__notice" role="status">{msg}</p>
      </div>
    </div>
  )
}

// Classement des Ordres de la semaine : 1er « Légende », 2e et 3e « Maîtres », 4e à 10e « Élite ».
export const orderTitle = (rank: number) => (rank === 1 ? 'Légende' : rank <= 3 ? 'Maîtres' : rank <= 10 ? 'Élite' : '')
const OrderBoard = () => {
  const [list, setList] = useState<Guild[] | null>(null)
  useEffect(() => { void fetchGuilds().then(setList).catch(() => setList([])) }, [])
  if (!list) return <p className="pf-empty">Chargement des Ordres…</p>
  if (!list.length) return <p className="pf-empty">Aucun Ordre classé pour l’instant : crée le premier dans l’onglet Ordre !</p>
  return (
    <table className="hf__table">
      <thead><tr><th>#</th><th>Ordre</th><th>Type</th><th>Membres</th><th>Dégâts de la semaine</th></tr></thead>
      <tbody>{list.map((g, i) => (
        <tr key={g.id}>
          <td className="hf__rank">{i + 1}</td>
          <td><span className="hf__who"><span className="hf__avatar hf__avatar--small" style={{ background: g.color }}>{g.emblem}</span><b>{g.name}</b><i>[{g.tag}]</i>{orderTitle(i + 1) && <u>{orderTitle(i + 1)}</u>}</span></td>
          <td>{g.kind === 'open' ? 'Ouvert' : g.kind === 'invite' ? 'Sur demande' : 'Fermé'}</td>
          <td>{g.members} / {g.max_members}</td>
          <td className="hf__score">{n(g.week_damage)}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}
