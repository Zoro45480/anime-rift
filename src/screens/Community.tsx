import { useEffect, useState } from 'react'
import { loadFame, myRank, scoreOf, useOnline, type OnlineProfile } from '../state/online'
import { extraArt, uiArt } from '../assets/manifest'
import { HEROES } from '../data/heroes'
import { ACHIEVEMENTS, progressOf } from '../game/achievements'
import { leagueOf } from '../game/arena'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { Avatar } from '../ui/Settings'

export type CommunityTab = 'social' | 'guild' | 'fame' | 'referral'
export const COMMUNITY: [CommunityTab, string][] = [['social', 'Social'], ['guild', 'Guilde'], ['fame', 'Panthéon'], ['referral', 'Parrainage']]
const n = (x: number) => x.toLocaleString('fr-FR')

// Ce que chaque partie contiendra une fois le jeu en ligne. Rien n'est inventé : pas de faux joueurs.
const SOON: Record<Exclude<CommunityTab, 'fame'>, { title: string; lede: string; points: string[]; icon: string }> = {
  social: { title: 'Social', lede: 'Tes amis, tes messages et tes échanges de cartes.', icon: uiArt('nav-profile'), points: ['Ajouter des amis par pseudo#tag et voir qui est en ligne', 'Messagerie privée, avec le réglage « qui peut m’écrire »', 'Proposer un échange de cartes équitable depuis le profil d’un ami'] },
  guild: { title: 'Guilde', lede: 'Rejoins un Ordre et affrontez ensemble le boss de la semaine.', icon: uiArt('rift-path'), points: ['Créer ou rejoindre un Ordre (nom, tag, emblème, conditions)', 'Boss de la semaine : les dégâts de tous les membres s’additionnent', 'Rivalités entre Ordres et classement de la semaine'] },
  referral: { title: 'Parrainage', lede: 'Invite tes amis et débloque un calendrier de 10 récompenses.', icon: uiArt('chest'), points: ['Un code et un lien à partager', 'Une case du calendrier s’ouvre pour chaque ami qui rejoint le jeu', 'Coffres, âmes et sceaux, jusqu’au gros lot de la 10e case'] },
}

export const Community = ({ start = 'fame' }: { start?: CommunityTab }) => {
  const store = useStore()
  const [tab, setTab] = useState<CommunityTab>(start)
  const mine = HEROES.filter((h) => store.owned[h.id]).length
  const acc = accountLevel(store.accountXp, store.rebirths)
  const done = ACHIEVEMENTS.filter((a) => progressOf(a, store).done).length
  const stars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const records: [string, string, string][] = [
    ['Collection', `${n(mine)} / ${n(HEROES.length)}`, 'cartes uniques'], ['Cartes MR', n(HEROES.filter((h) => h.rarity === 'rift' && store.owned[h.id]).length), 'mythiques'],
    ['Niveau de compte', String(acc.level), `${store.rebirths} Renaissance${store.rebirths > 1 ? 's' : ''}`], ['Succès', `${done} / ${ACHIEVEMENTS.length}`, 'obtenus'],
    ['La Spire', `Étage ${store.spire.best}`, 'meilleur étage'], ['Arène', n(store.arena.best), `meilleure cote · ${leagueOf(store.arena.best).label}`],
    ['Grand Rift', String(store.tourney.titles), 'tournois gagnés'], ['La Saga', `${stars} ★`, 'étoiles'], ['Invocations', n(store.pulls), 'au total'],
  ]
  return (
    <div className="cm">
      <header className="cm__head"><div><p className="eyebrow">Communauté</p><h1>{COMMUNITY.find((x) => x[0] === tab)![1]}</h1></div></header>
      <div className="coltabs__bar" role="tablist" aria-label="Communauté">
        {COMMUNITY.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'fame' ? (<>
        <FameBoard />
        <section className="cm__fame">
          <h3 className="sp-sub">Tes records</h3>
          <div className="cm__me"><Avatar size={64} /><div><b>{store.profile.name.trim() || 'Joueur'}</b><small>Ta carrière, avant et après les Renaissances</small></div></div>
          <ul className="cm__records">{records.map(([k, v, s]) => <li key={k}><small>{k}</small><b>{v}</b><span>{s}</span></li>)}</ul>
        </section>
      </>) : (
        <section className="cm__soon">
          <img src={SOON[tab].icon} alt="" />
          <div>
            <h2>{SOON[tab].title}</h2><p className="cm__lede">{SOON[tab].lede}</p>
            <ul>{SOON[tab].points.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="cm__lock"><span className="kiri" style={{ width: 40, height: 40, backgroundImage: `url(${extraArt('guide')})` }} aria-hidden="true" />Cette partie a besoin d’autres joueurs : elle ouvrira quand le jeu aura un serveur en ligne. Aucun faux joueur n’est affiché d’ici là.</p>
          </div>
        </section>
      )}
    </div>
  )
}

type FameOrder = 'score' | 'collection' | 'spire'
const FAME_TABS: [FameOrder, string][] = [['score', 'Global'], ['collection', 'Collection'], ['spire', 'La Spire']]
const MEDALS = ['Or', 'Argent', 'Bronze']

// Le Hall of Fame : le vrai classement de tous les joueurs inscrits, lu sur le serveur.
const FameBoard = () => {
  const { me, session } = useOnline()
  const [order, setOrder] = useState<FameOrder>('score')
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
        <div><p className="eyebrow">Les plus grandes carrières</p><h2>Hall of Fame</h2><p>Toute ta carrière compte : collection, cartes MR et LR, niveau, Renaissances, succès, La Spire et l'Arène.</p></div>
        <ul className="hf__mine">
          <li><b>{data ? n(data.count) : '…'}</b><span>Joueurs</span></li>
          <li><b>{me && rank ? `#${n(rank)}` : '—'}</b><span>Ta place</span></li>
          <li><b>{me ? n(me.score) : '—'}</b><span>Ton score</span></li>
        </ul>
      </header>
      <div className="coltabs__bar" role="tablist">{FAME_TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={order === id} className={order === id ? 'is-active' : ''} onClick={() => setOrder(id)}>{label}</button>)}</div>
      {!session && <p className="hf__join">Tu n'es pas encore classé : crée ton compte dans <b>Réglages → Compte en ligne</b> pour apparaître ici.</p>}
      {err ? <p className="pf-empty">Impossible de joindre le serveur pour l'instant.</p> : !data ? <p className="pf-empty">Chargement du classement…</p> : data.top.length === 0 ? <p className="pf-empty">Personne n'est encore classé : sois le premier joueur inscrit !</p> : <>
        <div className="hf__podium">
          {[1, 0, 2].map((i) => podium[i] && (
            <div key={podium[i].id} className={`hf__step hf__step--${i + 1}`}>
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
            <tr key={p.id} className={me?.id === p.id ? 'is-me' : ''}>
              <td className="hf__rank">{i + 1}</td>
              <td><span className="hf__who"><span className="hf__avatar hf__avatar--small">{p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : p.name[0]}</span><b>{p.name}</b><i>#{p.player_no}</i>{me?.id === p.id && <u>Toi</u>}</span></td>
              <td><span className="hf__col"><b>{n(p.collection)}</b> / {n(HEROES.length)}<em>{((p.collection / HEROES.length) * 100).toFixed(1)} %</em></span><div className="hf__bar"><i style={{ width: `${(p.collection / HEROES.length) * 100}%` }} /></div></td>
              <td>{p.rebirths}</td>
              <td className="hf__score">{order === 'spire' ? p.spire : n(p.score || scoreOf(p))}</td>
            </tr>
          ))}</tbody>
        </table>
      </>}
    </section>
  )
}
