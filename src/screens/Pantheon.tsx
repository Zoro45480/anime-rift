import { useEffect, useState } from 'react'
import { HEROES } from '../data/heroes'
import { leagueOf } from '../game/arena'
import { askFriend, fetchGuilds, friendCode, guildPowers, loadFame, myId, myRank, scoreOf, useOnline, type Guild, type OnlineProfile } from '../state/online'

const n = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/ /g, ' ')
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const roman = (k: number) => ROMAN[k] ?? String(k)
const MEDALS = ['Or', 'Argent', 'Bronze']
type Tab = 'score' | 'collection' | 'spire' | 'guilds'

// Titre de la semaine d'une Guilde selon sa place.
export const orderTitle = (rank: number) => (rank === 1 ? 'Légende' : rank <= 3 ? 'Maîtres' : rank <= 10 ? 'Élite' : '')

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const ICON: Record<Tab, string> = {
  score: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 2v4m-4 4h8m-6-4h4',
  collection: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  spire: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm4 8v4m-4 4h8m-6-4h4',
  guilds: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Zm0 5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4Z',
}
const TABS: [Tab, string][] = [['score', 'Global'], ['collection', 'Collection'], ['spire', 'Tour de l’Infini'], ['guilds', 'Guildes']]
const HEAD: Record<Tab, [string, string]> = {
  score: ['Les plus grandes carrières', 'Toute ta carrière compte, avant et après les Ascensions : records de collection et de cartes MR, niveaux de toutes les vies, Ascensions, succès, arène et Tour de l’Infini.'],
  collection: ['Les plus grands collectionneurs', 'Classés par persos uniques, puis par cartes MR et LR.'],
  spire: ['Tour de l’Infini', 'Le meilleur étage atteint. À égalité, le premier arrivé passe devant.'],
  guilds: ['Guildes', 'Les Guildes classées par puissance : la somme des scores de leurs membres.'],
}

// Avatar rond, image du joueur ou son initiale sur un dégradé.
const Face = ({ p, size }: { p: { name: string; avatar: string }; size: number }) => (
  <span className="pth-face" style={{ width: size, height: size, fontSize: size * 0.42 }}>{p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : p.name[0]?.toUpperCase()}</span>
)
// Étiquette de l'Guilde : emblème + TAG (+ nom en entier si demandé).
const GuildTag = ({ g, full }: { g?: Guild; full?: boolean }) => g ? (
  <span className="pth-gtag" style={{ ['--gc' as string]: g.color }} title={g.name}><i lang="ja">{g.emblem}</i><b>{g.tag}</b>{full && <em>{g.name}</em>}</span>
) : null
const Rebirth = ({ k }: { k: number }) => (k > 0 ? <span className="pth-reb" title={`${k} Ascension${k > 1 ? 's' : ''}`}>✦ {roman(k)}</span> : null)

export const Pantheon = () => {
  const { me } = useOnline()
  const [tab, setTab] = useState<Tab>('score')
  const [data, setData] = useState<{ top: (OnlineProfile & { guild_id?: string | null })[]; count: number } | null>(null)
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [powers, setPowers] = useState<Record<string, { power: number; cards: number }>>({})
  const [rank, setRank] = useState<number | null>(null)
  const [err, setErr] = useState(false)
  const [who, setWho] = useState<OnlineProfile | null>(null)

  useEffect(() => {
    let live = true
    void fetchGuilds().then((g) => live && setGuilds(g)).catch(() => undefined)
    void guildPowers().then((p) => live && setPowers(p)).catch(() => undefined)
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (tab === 'guilds') return
    let live = true
    setData(null)
    loadFame(tab).then((d) => { if (live) { setData(d); setErr(false) } }).catch(() => live && setErr(true))
    if (me) void myRank(me, tab).then((r) => live && setRank(r))
    return () => { live = false }
  }, [tab, me])

  const gOf = (id?: string | null) => (id ? guilds.find((g) => g.id === id) : undefined)
  const myGuildId = (me as (OnlineProfile & { guild_id?: string | null }) | null)?.guild_id ?? null
  const orders = [...guilds].map((g) => ({ g, power: powers[g.id]?.power ?? 0, cards: powers[g.id]?.cards ?? 0 })).sort((a, b) => b.power - a.power)
  const myOrderRank = myGuildId ? orders.findIndex((o) => o.g.id === myGuildId) + 1 : 0
  const total = HEROES.length

  const stats: [string, string][] = tab === 'guilds'
    ? [[n(orders.length), 'Guildes classées'], [myOrderRank ? `#${myOrderRank}` : '—', 'Ta Guilde'], [myOrderRank ? n(orders[myOrderRank - 1].power) : '—', 'Sa puissance']]
    : tab === 'spire'
      ? [[data ? n(data.top.filter((p) => p.spire > 0).length) : '…', 'Joueurs classés'], [me && rank && me.spire > 0 ? `#${n(rank)}` : '—', 'Ta place'], [me ? n(me.spire) : '0', 'Étage atteint']]
      : tab === 'collection'
        ? [[data ? n(data.count) : '…', 'Joueurs'], [me && rank ? (rank > 50 ? 'Hors top' : `#${n(rank)}`) : '—', 'Ta place'], [me ? `${n(me.collection)}` : '0', `Ta collection / ${n(total)}`]]
        : [[data ? n(data.count) : '…', 'Joueurs'], [me && rank ? `#${n(rank)}` : '—', 'Ta place'], [me ? n(me.score || scoreOf(me)) : '—', 'Ton score']]

  const value = (p: OnlineProfile) => (tab === 'spire' ? p.spire : tab === 'collection' ? p.collection : p.score || scoreOf(p))
  const list = (data?.top ?? []).filter((p) => tab !== 'spire' || p.spire > 0)
  const max = Math.max(1, ...list.map(value))
  const podium = list.slice(0, 3)
  const meIn = me ? list.some((p) => p.id === me.id) : false

  return (
    <section className="pth">
      <header className="pth__head">
        <p className="eyebrow">{HEAD[tab][0]}</p>
        <h2 className="page-title">Panthéon</h2>
        <p>{HEAD[tab][1]}</p>
        <ul className="pth__stats">{stats.map(([v, l]) => <li key={l}><b>{v}</b><span>{l}</span></li>)}</ul>
      </header>

      <div className="pth__tabs" role="tablist" aria-label="Classements">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><Ico d={ICON[id]} />{label}</button>)}
      </div>

      {!me && <p className="hf__join">Tu n’es pas encore classé : connecte-toi avec Discord ou Google dans les <b>Réglages</b> pour apparaître ici.</p>}

      {tab === 'guilds' ? (
        orders.length === 0 ? <p className="pf-empty">Aucune Guilde classée pour l’instant : crée la première dans l’onglet Guilde !</p> : <>
          <div className="pth-podium">
            <span className="pth-podium__kanji" lang="ja" aria-hidden="true">殿堂</span>
            {[1, 0, 2].map((i) => { const o = orders[i]; if (!o) return <div key={i} className="pth-step" />; return (
              <div key={o.g.id} className={`pth-step pth-step--${i + 1}`}>
                {i === 0 && <span className="pth-crown" aria-hidden="true">♛</span>}
                <span className="pth-emb" style={{ ['--gc' as string]: o.g.color }} lang="ja">{o.g.emblem}</span>
                <b className="pth-name">{o.g.name}</b>
                <span className="pth-tags"><GuildTag g={o.g} /></span>
                <span className="pth-kind">{o.g.kind === 'open' ? 'Ouvert' : o.g.kind === 'invite' ? 'Sur invitation' : 'Fermé'}</span>
                <strong className="pth-big">⚡ {n(o.power)}</strong>
                <small className="pth-sub"><b>{o.g.members}</b> /{o.g.max_members} membres</small>
                <small className="pth-sub"><b>{n(o.cards)}</b> cartes</small>
                <div className="pth-block"><em>{i + 1}</em><span>{MEDALS[i]}</span></div>
              </div>) })}
          </div>
          <div className="pth-table">
            <div className="pth-row pth-row--head"><span>#</span><span>Guilde</span><span>Puissance</span></div>
            {orders.map((o, i) => (
              <div key={o.g.id} className={`pth-row ${i < 3 ? `is-top${i + 1}` : ''} ${o.g.id === myGuildId ? 'is-me' : ''}`}>
                <span className="pth-rank">{i + 1}</span>
                <span className="pth-who"><span className="pth-emb pth-emb--small" style={{ ['--gc' as string]: o.g.color }} lang="ja">{o.g.emblem}</span>
                  <span className="pth-who__txt"><b>{o.g.name}</b><span className="pth-tags"><GuildTag g={o.g} />{orderTitle(i + 1) && <span className="pth-title">♛ {orderTitle(i + 1)}</span>}{o.g.id === myGuildId && <span className="pth-you">Ta Guilde</span>}</span></span></span>
                <span className="pth-val"><b>{n(o.power)}</b><i><u style={{ width: `${(o.power / Math.max(1, orders[0].power)) * 100}%` }} /></i></span>
              </div>
            ))}
          </div>
        </>
      ) : err ? <p className="pf-empty">Impossible de joindre le serveur pour l’instant.</p> : !data ? <p className="pf-empty">Chargement du classement…</p> : list.length === 0 ? <p className="pf-empty">Personne n’est encore classé : sois le premier !</p> : <>
        <div className="pth-podium">
          <span className="pth-podium__kanji" lang="ja" aria-hidden="true">殿堂</span>
          {[1, 0, 2].map((i) => { const p = podium[i]; if (!p) return <div key={i} className="pth-step" />; return (
            <button key={p.id} className={`pth-step pth-step--${i + 1}`} onClick={() => setWho(p)}>
              {i === 0 && <span className="pth-crown" aria-hidden="true">♛</span>}
              <Face p={p} size={i === 0 ? 92 : 76} />
              <b className="pth-name">{p.name}</b>
              <span className="pth-no">#{p.player_no}</span>
              <span className="pth-tags"><Rebirth k={p.rebirths} /><GuildTag g={gOf(p.guild_id)} /></span>
              {tab === 'spire' ? <strong className="pth-big">{n(p.spire)}<small> étage</small></strong> : tab === 'collection' ? <strong className="pth-big">{n(p.collection)}<small> persos</small></strong> : <>
                <strong className="pth-big">{n(value(p))}<small> pts</small></strong>
                <small className="pth-sub"><b>{n(p.collection)}</b> persos <b>{p.mr}</b> MR</small>
                <small className="pth-sub"><b>{p.level}</b> niv.</small>
              </>}
              <div className="pth-block"><em>{i + 1}</em><span>{MEDALS[i]}</span></div>
            </button>) })}
        </div>
        <div className="pth-table">
          <div className="pth-row pth-row--head"><span>#</span><span>Joueur</span><span>{tab === 'spire' ? 'Étage atteint' : tab === 'collection' ? 'Persos uniques' : 'Record de collection'}</span></div>
          {list.map((p, i) => (
            <button key={p.id} className={`pth-row ${i < 3 ? `is-top${i + 1}` : ''} ${me?.id === p.id ? 'is-me' : ''}`} onClick={() => setWho(p)}>
              <span className="pth-rank">{i + 1}</span>
              <span className="pth-who"><Face p={p} size={46} />
                <span className="pth-who__txt"><span className="pth-line"><b>{p.name}</b><i>#{p.player_no}</i>{me?.id === p.id && <span className="pth-you">Toi</span>}</span>
                  <span className="pth-tags"><Rebirth k={p.rebirths} /><GuildTag g={gOf(p.guild_id)} full /></span></span></span>
              <span className="pth-val"><b>{n(tab === 'score' ? p.collection : value(p))}</b>{tab !== 'spire' && <i><u style={{ width: `${((tab === 'score' ? p.collection / total : value(p) / max) * 100)}%` }} /></i>}</span>
            </button>
          ))}
          {me && !meIn && (tab !== 'spire' || me.spire > 0) && (
            <div className="pth-row is-me pth-row--stick">
              <span className="pth-rank">{rank ? n(rank) : '—'}</span>
              <span className="pth-who"><Face p={me} size={46} /><span className="pth-who__txt"><span className="pth-line"><b>{me.name}</b><i>#{me.player_no}</i><span className="pth-you">Toi</span></span>
                <span className="pth-tags"><Rebirth k={me.rebirths} /><GuildTag g={gOf(myGuildId)} full /></span></span></span>
              <span className="pth-val"><b>{n(tab === 'score' ? me.collection : value(me))}</b>{tab !== 'spire' && <i><u style={{ width: `${((tab === 'score' ? me.collection / total : value(me) / max) * 100)}%` }} /></i>}</span>
            </div>
          )}
        </div>
      </>}
      {who && <PlayerMini p={who} guild={gOf((who as OnlineProfile & { guild_id?: string | null }).guild_id)} onClose={() => setWho(null)} />}
    </section>
  )
}

// Mini-fiche d'un joueur : ouverte en touchant une ligne ou une marche du podium.
const PlayerMini = ({ p, guild, onClose }: { p: OnlineProfile; guild?: Guild; onClose: () => void }) => {
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
        {guild && <p className="pmini__lvl">Guilde : <GuildTag g={guild} full /></p>}
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
