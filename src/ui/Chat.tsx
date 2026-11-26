import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HEROES, heroById } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { fetchChat, myId, openSettings, playersById, sendChat, useOnline, type ChatLine, type PublicPlayer } from '../state/online'
import { useStore } from '../state/store'

const ROOMS: [string, string][] = [['general', 'Général'], ['marche', 'Marché'], ['arene', 'Arène'], ['entraide', 'Entraide']]
const hhmm = (t: string) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// Le chat en direct, par salons. Une carte peut être jointe avec « J'échange » ou « Je cherche ».
export const Chat = () => {
  const { session } = useOnline()
  const store = useStore()
  const [open, setOpen] = useState(false)
  const [room, setRoom] = useState('general')
  const [lines, setLines] = useState<ChatLine[]>([])
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [text, setText] = useState('')
  const [card, setCard] = useState('')
  const [cq, setCq] = useState('')
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const load = useCallback(async () => {
    const l = await fetchChat(room)
    setLines(l)
    const missing = [...new Set(l.map((x) => x.user_id))].filter((id) => !people[id])
    if (missing.length) { const ps = await playersById(missing); setPeople((p) => ({ ...p, ...Object.fromEntries(ps.map((x) => [x.id, x])) })) }
  }, [room, people])
  useEffect(() => { if (!open) return; void load(); const t = setInterval(() => void load(), 5000); return () => clearInterval(t) }, [open, room]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [lines.length, open])
  const send = async () => {
    if (!text.trim()) return
    const r = await sendChat(room, text, card || undefined)
    if (r === 'ok') { setText(''); setCard(''); setErr(''); void load() } else setErr(r)
  }
  const found = cq.trim().length >= 2 ? HEROES.filter((h) => h.name.toLowerCase().includes(cq.toLowerCase())).slice(0, 6) : []
  return createPortal(
    <div className={`chat ${open ? 'is-open' : ''}`}>
      {!open ? <button className="chat__toggle" onClick={() => setOpen(true)} aria-label="Ouvrir le chat">💬 Chat</button> : (
        <section className="chat__panel" aria-label="Chat">
          <header><div className="chat__rooms" role="tablist">{ROOMS.map(([id, l]) => <button key={id} role="tab" aria-selected={room === id} className={room === id ? 'is-on' : ''} onClick={() => setRoom(id)}>{l}</button>)}</div><button className="chat__x" onClick={() => setOpen(false)} aria-label="Réduire le chat">−</button></header>
          <div className="chat__lines">
            {lines.length === 0 && <p className="set__note">Personne n'a encore écrit ici. Lance la conversation !</p>}
            {lines.map((x) => {
              const p = people[x.user_id], h = x.card ? heroById(x.card.replace(/^[+-]/, '')) : null
              const mine = x.user_id === myId()
              return (
                <div key={x.id} className={`chat__line ${mine ? 'is-mine' : ''}`}>
                  <p><b>{p?.name ?? '…'}</b><i>#{p?.player_no}</i><time>{hhmm(x.created_at)}</time></p>
                  <span>{x.body}</span>
                  {h && <span className="chat__card" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}><em>{x.card?.startsWith('-') ? 'Je cherche' : 'J’échange'}</em><b>{RARITIES[h.rarity].short}</b>{h.name}<small>{store.owned[h.id] ? 'Tu l’as' : 'Il te manque'}</small></span>}
                </div>
              )
            })}
            <div ref={end} />
          </div>
          {session ? <>
            {card && <p className="chat__att">Carte jointe : <b>{heroById(card.slice(1))?.name}</b> ({card.startsWith('-') ? 'je cherche' : 'j’échange'}) <button className="linkbtn" onClick={() => setCard('')}>×</button></p>}
            {cq !== '' && <div className="chat__pick"><input className="set__input" autoFocus placeholder="Nom de la carte…" value={cq} onChange={(e) => setCq(e.target.value)} />{found.map((h) => <span key={h.id}><b>{h.name}</b><button className="linkbtn" onClick={() => { setCard('+' + h.id); setCq('') }}>J'échange</button><button className="linkbtn" onClick={() => { setCard('-' + h.id); setCq('') }}>Je cherche</button></span>)}<button className="linkbtn" onClick={() => setCq('')}>Fermer</button></div>}
            <form className="chat__send" onSubmit={(e) => { e.preventDefault(); void send() }}>
              <button type="button" className="chat__plus" onClick={() => setCq(cq ? '' : ' ')} aria-label="Joindre une carte">🂠</button>
              <input className="set__input" maxLength={300} placeholder={`Écrire dans ${ROOMS.find((r) => r[0] === room)![1]}…`} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
              <button className="btn btn--gold" type="submit">➤</button>
            </form>
            {err && <p className="cd__notice">{err}</p>}
          </> : <button className="oauth oauth--discord chat__login" onClick={openSettings}>Se connecter pour écrire</button>}
        </section>
      )}
    </div>,
    document.body,
  )
}
