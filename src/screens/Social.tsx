import { TabIcon } from '../ui/TabIcon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HEROES, heroById } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import {
  acceptFriend, addByCode, answerTrade, FRIEND_PARAM, friendCode, askFriend, fetchFriends, fetchMessages, fetchTrades, findPlayers, isOnlineNow, markRead, myId, playersById, proposeTrade,
  removeFriend, sendMessage, setDmPolicy, useOnline, type FriendRow, type Message, type PublicPlayer, type Trade,
} from '../state/online'
import { useStore } from '../state/store'
import { Avatar } from '../ui/Settings'

const n = (x: number) => x.toLocaleString('fr-FR')
const time = (t: string) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
type Tab = 'friends' | 'messages' | 'trades'

const Face = ({ p, size = 40 }: { p: { name: string; avatar: string }; size?: number }) => (
  <span className="so-face" style={{ width: size, height: size, fontSize: size * 0.42 }}>{p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : p.name[0]?.toUpperCase()}</span>
)
const CardChip = ({ id }: { id: string }) => { const h = heroById(id); return h ? <span className="so-card" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}><b>{RARITIES[h.rarity].short}</b>{h.name}</span> : null }

export const Social = ({ onGuild, onProfile, onConnect }: { onGuild: () => void; onProfile: () => void; onConnect: () => void }) => {
  const { session, me } = useOnline()
  const store = useStore()
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [msgs, setMsgs] = useState<Message[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [notice, setNotice] = useState('')
  const [chatWith, setChatWith] = useState<string | null>(null)
  const [tradeWith, setTradeWith] = useState<PublicPlayer | null>(null)
  const uid = myId()

  const refresh = useCallback(async () => {
    if (!uid) return
    const [f, m, t] = await Promise.all([fetchFriends(), fetchMessages(), fetchTrades()])
    setFriends(f); setMsgs(m); setTrades(t)
    const ids = [...new Set([...f.flatMap((x) => [x.user_id, x.friend_id]), ...m.flatMap((x) => [x.from_id, x.to_id]), ...t.flatMap((x) => [x.from_id, x.to_id])])].filter((id) => id !== uid)
    const list = await playersById(ids)
    setPeople((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.id, x])) }))
  }, [uid])
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 15000); return () => clearInterval(t) }, [refresh])
  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 3500) }

  if (!session) return (
    <section className="so-login"><h2>Social</h2><p>Connecte-toi avec Discord ou Google pour ajouter des amis, écrire des messages et échanger des cartes.</p><button className="oauth oauth--discord" onClick={onConnect}>Se connecter</button></section>
  )

  const accepted = friends.filter((f) => f.status === 'accepted').map((f) => (f.user_id === uid ? f.friend_id : f.user_id))
  const incoming = friends.filter((f) => f.status === 'pending' && f.friend_id === uid).map((f) => f.user_id)
  const outgoing = friends.filter((f) => f.status === 'pending' && f.user_id === uid).map((f) => f.friend_id)
  const onlineFriends = accepted.filter((id) => people[id] && isOnlineNow(people[id])).length
  const unread = msgs.filter((m) => m.to_id === uid && !m.read).length
  const tradesIn = trades.filter((t) => t.to_id === uid && t.status === 'open')
  const tradesOut = trades.filter((t) => t.from_id === uid && t.status === 'open')
  const mine = HEROES.filter((h) => store.owned[h.id])

  return (
    <div className="so">
      <header className="so__head">
        <div><p className="eyebrow">◆ Amis · Messages · Échanges</p><h1>Social</h1><p>Ajoute des amis, envoie des messages et échange des cartes.</p></div>
        <div className="so__me">
          <Avatar size={64} />
          <div><b>{me?.name ?? 'Joueur'} <i>#{me?.player_no}</i></b><span><strong>{mine.length}</strong> persos · <strong>{mine.filter((h) => h.rarity === 'legend').length}</strong> LR · ★ {Object.values(store.saga).reduce((a, b) => a + b, 0)}</span></div>
          <div className="so__me-btns"><button className="cd-btn cd-btn--small" onClick={onProfile}>Mon profil</button></div>
        </div>
      </header>
      <div className="coltabs__bar so__tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'friends'} className={tab === 'friends' ? 'is-active' : ''} onClick={() => setTab('friends')}><TabIcon id="friends" />Amis{incoming.length > 0 && <i className="dot" />}</button>
        <button role="tab" aria-selected={tab === 'messages'} className={tab === 'messages' ? 'is-active' : ''} onClick={() => setTab('messages')}><TabIcon id="messages" />Messages{unread > 0 && <i className="dot" />}</button>
        <button role="tab" aria-selected={tab === 'trades'} className={tab === 'trades' ? 'is-active' : ''} onClick={() => setTab('trades')}><TabIcon id="trades" />Échanges{tradesIn.length > 0 && <i className="dot" />}</button>
        <button role="tab" onClick={onGuild}><TabIcon id="guild" />Ordre →</button>
      </div>
      {notice && <p className="cd__notice" role="status">{notice}</p>}

      {tab === 'friends' && <div className="so__grid">
        <section className="so-box so-box--tall">
          <header className="so-box__head"><h2>Mes amis</h2><span><b>{onlineFriends}</b> en ligne / {accepted.length}</span></header>
          {incoming.length > 0 && <div className="so-req"><h3>Demandes reçues</h3>{incoming.map((id) => people[id] && (
            <div key={id} className="so-row"><Face p={people[id]} /><span className="so-row__id"><b>{people[id].name}</b><i>#{people[id].player_no}</i></span>
              <button className="cd-btn cd-btn--small" onClick={() => void acceptFriend(id).then(refresh)}>Accepter</button><button className="linkbtn" onClick={() => void removeFriend(id).then(refresh)}>Refuser</button></div>
          ))}</div>}
          {accepted.length === 0 ? <div className="so-empty"><b>Pas encore d'amis</b><p>Cherche le pseudo d'un pote dans « Ajouter un ami » : il recevra ta demande tout de suite.</p></div> : accepted.map((id) => people[id] && (
            <div key={id} className="so-row"><span className="so-row__face"><Face p={people[id]} /><i className={isOnlineNow(people[id]) ? 'is-on' : ''} /></span>
              <span className="so-row__id"><b>{people[id].name}</b><i>#{people[id].player_no} · {n(people[id].collection)} persos · {isOnlineNow(people[id]) ? 'en ligne' : 'hors ligne'}</i></span>
              <button className="cd-btn cd-btn--small" onClick={() => { setChatWith(id); setTab('messages') }}>Message</button>
              <button className="cd-btn cd-btn--small" onClick={() => setTradeWith(people[id])}>Échanger</button>
              <button className="linkbtn" onClick={() => void removeFriend(id).then(refresh)}>Retirer</button></div>
          ))}
          {outgoing.length > 0 && <p className="set__note">Demandes envoyées : {outgoing.map((id) => people[id]?.name ?? '…').join(', ')}</p>}
        </section>
        <div className="so-side">
          <CodeBox onDone={(t) => { flash(t); void refresh() }} />
          <AddFriend known={[...accepted, ...incoming, ...outgoing]} onDone={(t) => { flash(t); void refresh() }} />
          <section className="so-box"><header className="so-box__head"><h2>Échanges</h2><button className="linkbtn" onClick={() => setTab('trades')}>Tout voir →</button></header>
            <div className="so-pair"><div><b>{tradesIn.length}</b><span>reçu{tradesIn.length > 1 ? 's' : ''}</span></div><div><b>{tradesOut.length}</b><span>envoyé{tradesOut.length > 1 ? 's' : ''}</span></div></div>
            <p className="set__note">Propose un échange depuis la ligne d'un ami : autant de cartes de chaque côté, mêmes raretés.</p></section>
          <section className="so-box"><header className="so-box__head"><h2>Activité sociale</h2></header>
            <div className="so-trio"><div><b>{onlineFriends}</b><span>amis en ligne</span></div><div><b>{accepted.length}</b><span>amis au total</span></div><div><b>{unread}</b><span>messages non lus</span></div></div></section>
        </div>
      </div>}

      {tab === 'messages' && <Messages msgs={msgs} people={people} open={chatWith} setOpen={setChatWith} refresh={refresh} policy={(me as PublicPlayer | null)?.dm_policy} onPeople={(list) => setPeople((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.id, x])) }))} />}

      {tab === 'trades' && <section className="so-box">
        <header className="so-box__head"><h2>Échanges</h2></header>
        {trades.length === 0 && <p className="pf-empty">Aucun échange pour l'instant. Propose-en un depuis la liste de tes amis.</p>}
        {trades.map((t) => {
          const other = people[t.from_id === uid ? t.to_id : t.from_id]
          const toMe = t.to_id === uid
          return (
            <div key={t.id} className={`so-trade so-trade--${t.status}`}>
              <p className="so-trade__who">{toMe ? <>De <b>{other?.name ?? '…'}</b></> : <>À <b>{other?.name ?? '…'}</b></>} · {time(t.created_at)} · <em>{{ open: 'en attente', accepted: 'accepté', refused: 'refusé', cancelled: 'annulé' }[t.status]}</em></p>
              <div className="so-trade__cards"><div><small>{toMe ? 'Tu reçois' : 'Tu donnes'}</small>{t.give.map((id, i) => <CardChip key={i} id={id} />)}</div><span>⇄</span><div><small>{toMe ? 'Tu donnes' : 'Tu reçois'}</small>{t.want.map((id, i) => <CardChip key={i} id={id} />)}</div></div>
              {t.status === 'open' && (toMe ? <div className="so-trade__btns">
                <button className="btn btn--gold" onClick={async () => {
                  if (!store.takeCards(t.want)) return flash('Il te faut un doublon de chaque carte demandée (ta dernière copie est gardée).')
                  const r = await answerTrade(t.id, true)
                  if (r !== 'ok') { flash(r); return }
                  flash('Échange accepté : les cartes arrivent dans ta collection.'); void refresh()
                }}>Accepter</button>
                <button className="cd-btn cd-btn--small" onClick={() => void answerTrade(t.id, false).then(refresh)}>Refuser</button></div>
                : <button className="cd-btn cd-btn--small" onClick={() => void answerTrade(t.id, false).then(refresh)}>Annuler (tes cartes reviennent)</button>)}
            </div>
          )
        })}
      </section>}

      {tradeWith && <TradeMaker other={tradeWith} onClose={() => setTradeWith(null)} onDone={(t) => { setTradeWith(null); flash(t); void refresh(); setTab('trades') }} />}
    </div>
  )
}

const CodeBox = ({ onDone }: { onDone: (t: string) => void }) => {
  const { me } = useOnline()
  const [code, setCode] = useState(() => { try { return localStorage.getItem(FRIEND_PARAM) ?? '' } catch { return '' } })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const mine = me ? friendCode(me.player_no) : ''
  const link = mine ? `${location.origin}${location.pathname}?ami=${mine}` : ''
  const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => { setCopied(what); setTimeout(() => setCopied(''), 2000) }) }
  const send = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    const r = await addByCode(code)
    setBusy(false); setCode('')
    try { localStorage.removeItem(FRIEND_PARAM) } catch { /* rien */ }
    onDone(r)
  }
  return (
    <section className="so-box so-code">
      <header className="so-box__head"><h2>Code ami</h2></header>
      {mine && <div className="so-code__mine"><span>Ton code</span><b>{mine}</b>
        <div className="so-code__btns"><button className="cd-btn cd-btn--small" onClick={() => copy(mine, 'code')}>{copied === 'code' ? 'Copié !' : 'Copier le code'}</button>
          <button className="linkbtn" onClick={() => copy(link, 'lien')}>{copied === 'lien' ? 'Lien copié !' : 'Copier un lien d\'invitation'}</button></div></div>}
      <p className="set__note">Donne ton code à un ami, ou tape le sien ici pour l'ajouter.</p>
      <form className="so-code__form" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <input className="set__input" placeholder="RIFT-XXXXX" value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Code ami de ton ami" />
        <button className="cd-btn cd-btn--small" disabled={!code.trim() || busy}>{busy ? '…' : 'Ajouter'}</button>
      </form>
    </section>
  )
}

const AddFriend = ({ known, onDone }: { known: string[]; onDone: (t: string) => void }) => {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<PublicPlayer[] | null>(null)
  return (
    <section className="so-box">
      <header className="so-box__head"><h2>Chercher un joueur</h2></header>
      <p className="set__note">Trouve un joueur par son pseudo ou son numéro (pseudo#12).</p>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) void findPlayers(q).then(setRes) }}><input className="set__input" type="search" placeholder="Pseudo ou pseudo#1234…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un joueur" /></form>
      {res && (res.length === 0 ? <p className="set__note">Aucun joueur trouvé.</p> : res.map((p) => (
        <div key={p.id} className="so-row"><Face p={p} size={34} /><span className="so-row__id"><b>{p.name}</b><i>#{p.player_no} · {n(p.collection)} persos</i></span>
          {known.includes(p.id) ? <small>déjà ajouté</small> : <button className="cd-btn cd-btn--small" onClick={() => void askFriend(p.id).then((r) => onDone(r === 'ok' ? `Demande envoyée à ${p.name}.` : r))}>Ajouter</button>}</div>
      )))}
    </section>
  )
}

const Messages = ({ msgs, people, open, setOpen, refresh, policy, onPeople }: { msgs: Message[]; people: Record<string, PublicPlayer>; open: string | null; setOpen: (id: string | null) => void; refresh: () => Promise<void>; policy?: string; onPeople: (l: PublicPlayer[]) => void }) => {
  const uid = myId()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [res, setRes] = useState<PublicPlayer[]>([])
  const [pol, setPol] = useState(policy ?? 'all')
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const convs = useMemo(() => {
    const by = new Map<string, Message>()
    for (const m of msgs) by.set(m.from_id === uid ? m.to_id : m.from_id, m)
    return [...by.entries()].sort((a, b) => b[1].id - a[1].id)
  }, [msgs, uid])
  const thread = msgs.filter((m) => open && (m.from_id === open || m.to_id === open))
  useEffect(() => { if (open) void markRead(open); end.current?.scrollIntoView({ block: 'end' }) }, [open, thread.length])
  return (
    <div className="so-msg">
      <section className="so-box so-msg__list">
        <header className="so-box__head"><h2>Conversations</h2><b>{convs.length}</b></header>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) void findPlayers(q).then((l) => { setRes(l); onPeople(l) }) }}><input className="set__input" type="search" placeholder="Écrire à un joueur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un joueur à qui écrire" /></form>
        {res.map((p) => <button key={p.id} className="so-conv" onClick={() => { setOpen(p.id); setRes([]); setQ('') }}><Face p={p} size={32} /><span><b>{p.name}</b><i>#{p.player_no}</i></span></button>)}
        <label className="so-pol">Qui peut m'écrire<select value={pol} onChange={(e) => { setPol(e.target.value); void setDmPolicy(e.target.value as 'all') }}><option value="all">Tout le monde</option><option value="friends">Mes amis</option><option value="nobody">Personne</option></select></label>
        {convs.length === 0 && <p className="set__note">Aucune conversation.</p>}
        {convs.map(([id, last]) => {
          const p = people[id]
          const unread = msgs.some((m) => m.from_id === id && m.to_id === uid && !m.read)
          return <button key={id} className={`so-conv ${open === id ? 'is-on' : ''}`} onClick={() => setOpen(id)}>{p && <Face p={p} size={32} />}<span><b>{p?.name ?? '…'}</b><i>{last.body.slice(0, 40)}</i></span>{unread && <i className="dot" />}</button>
        })}
      </section>
      <section className="so-box so-msg__thread">
        {!open ? <div className="so-empty"><b>Aucune conversation ouverte</b><p>Choisis une conversation, ou cherche un joueur à gauche pour lui écrire.</p></div> : <>
          <header className="so-box__head"><h2>{people[open]?.name ?? '…'}</h2><span>#{people[open]?.player_no}</span></header>
          <div className="so-thread">{thread.map((m) => <p key={m.id} className={m.from_id === uid ? 'is-mine' : ''}><span>{m.body}</span><small>{time(m.created_at)}</small></p>)}<div ref={end} /></div>
          <form className="so-send" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; const r = await sendMessage(open, text); if (r === 'ok') { setText(''); setErr(''); await refresh() } else setErr(r) }}>
            <input className="set__input" placeholder="Écris ton message…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" /><button className="btn btn--gold" type="submit">Envoyer</button>
          </form>
          {err && <p className="cd__notice">{err}</p>}
        </>}
      </section>
    </div>
  )
}

// Proposer un échange : mes doublons contre des cartes de mêmes raretés.
const TradeMaker = ({ other, onClose, onDone }: { other: PublicPlayer; onClose: () => void; onDone: (t: string) => void }) => {
  const store = useStore()
  const [give, setGive] = useState<string[]>([])
  const [want, setWant] = useState<string[]>([])
  const [q, setQ] = useState('')
  const dupes = HEROES.filter((h) => (store.owned[h.id] ?? 0) >= 2).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
  const need = give.map((id) => heroById(id).rarity).sort().join()
  const ok = give.length > 0 && give.length === want.length && need === want.map((id) => heroById(id).rarity).sort().join()
  const found = q.trim().length >= 2 ? HEROES.filter((h) => h.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []
  const send = async () => {
    if (!store.takeCards(give)) return onDone('Il te faut ces doublons.')
    const r = await proposeTrade(other.id, give, want)
    onDone(r === 'ok' ? `Échange proposé à ${other.name}. Tes cartes sont mises de côté jusqu'à sa réponse.` : r)
  }
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Proposer un échange" onClick={onClose}>
      <div className="modal__box so-tm" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Échange avec {other.name}</h2>
        <p className="set__note">Choisis jusqu'à 5 de tes doublons, puis autant de cartes que tu veux recevoir, de mêmes raretés. {other.name} devra avoir un doublon de chacune pour accepter.</p>
        <h3 className="sp-sub">Tu donnes ({give.length})</h3>
        <div className="so-pick">{dupes.length === 0 ? <p className="set__note">Tu n'as pas de doublon.</p> : dupes.map((h) => <button key={h.id} className={give.includes(h.id) ? 'is-on' : ''} onClick={() => setGive(give.includes(h.id) ? give.filter((x) => x !== h.id) : give.length < 5 ? [...give, h.id] : give)}><CardChip id={h.id} /></button>)}</div>
        <h3 className="sp-sub">Tu demandes ({want.length})</h3>
        <input className="set__input" type="search" placeholder="Nom d'une carte…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Carte demandée" />
        <div className="so-pick">{found.map((h) => <button key={h.id} onClick={() => { if (want.length < 5) setWant([...want, h.id]); setQ('') }}><CardChip id={h.id} /></button>)}</div>
        <div className="so-pick">{want.map((id, i) => <button key={i} className="is-on" onClick={() => setWant(want.filter((_, j) => j !== i))}><CardChip id={id} /> ×</button>)}</div>
        {!ok && give.length > 0 && <p className="set__note">Il faut autant de cartes de chaque côté, avec les mêmes raretés.</p>}
        <div className="so-trade__btns"><button className="btn btn--gold" disabled={!ok} onClick={() => void send()}>Proposer l'échange</button><button className="cd-btn cd-btn--small" onClick={onClose}>Annuler</button></div>
      </div>
    </div>
  )
}
