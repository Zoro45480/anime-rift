import { useMemo, useState } from 'react'
import { HEROES, heroById, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import { heldUntil, TRADE_MAX, tradeProblem } from '../game/bazaar'
import { findPlayers, proposeTrade, useOnline, type PublicPlayer } from '../state/online'
import { useStore } from '../state/store'

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Onglet « Échanger » : choisir un joueur, puis remplir « Tu donnes » et « Tu demandes » (autant de cartes, mêmes raretés).
export const TradeDesk = ({ locked, onConnect }: { locked: boolean; onConnect: () => void }) => {
  const { session } = useOnline()
  const store = useStore()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<PublicPlayer[] | null>(null)
  const [who, setWho] = useState<PublicPlayer | null>(null)
  const [give, setGive] = useState<string[]>([])
  const [want, setWant] = useState<string[]>([])
  const [side, setSide] = useState<'mine' | 'theirs'>('mine')
  const [rar, setRar] = useState<RarityId | 'all'>('all')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const now = Date.now()
  const tradable = (h: Hero) => (store.owned[h.id] ?? 0) >= 2 && heldUntil(store.log[h.id], now) === 0
  const pool = useMemo(() => HEROES.filter((h) => (side === 'mine' ? tradable(h) : true)).filter((h) => (rar === 'all' || h.rarity === rar) && (!search || fold(`${h.name} ${h.world}`).includes(fold(search))))
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name, 'fr')), [side, rar, search, store.owned, store.log]) // eslint-disable-line react-hooks/exhaustive-deps
  const G = give.map((id) => heroById(id)!).filter(Boolean)
  const W = want.map((id) => heroById(id)!).filter(Boolean)
  const problem = tradeProblem(G, W)
  const pick = (h: Hero) => {
    const list = side === 'mine' ? give : want
    const set = side === 'mine' ? setGive : setWant
    if (list.includes(h.id)) return set(list.filter((x) => x !== h.id))
    if (list.length >= TRADE_MAX) return setMsg(`${TRADE_MAX} cartes au maximum de chaque côté.`)
    set([...list, h.id])
  }
  const send = async () => {
    if (!who || problem || busy) return
    if (!store.takeCards(give)) return setMsg('Il te faut un doublon de chaque carte que tu donnes : ta dernière copie reste toujours chez toi.')
    setBusy(true)
    const r = await proposeTrade(who.id, give, want, note.trim())
    setBusy(false)
    if (r !== 'ok') { store.giveCards(give); return setMsg(r) }
    setMsg(`Proposition envoyée à ${who.name}. Tes cartes sont mises de côté jusqu'à sa réponse (retrouve-la dans Mon Marché).`)
    setGive([]); setWant([]); setNote('')
  }

  if (!session) return <section className="so-login"><h2>Échanger</h2><p>Les échanges entre joueurs demandent un compte. Connecte-toi avec Discord ou Google.</p><button className="oauth oauth--discord" onClick={onConnect}>Se connecter</button></section>

  const Slots = ({ title, ids, need, mine }: { title: string; ids: string[]; need: Hero[]; mine: boolean }) => (
    <div className={`td-side ${side === (mine ? 'mine' : 'theirs') ? 'is-on' : ''}`} onClick={() => setSide(mine ? 'mine' : 'theirs')}>
      <h3>{title} <small>({ids.length}/{TRADE_MAX})</small></h3>
      <div className="td-slots">
        {Array.from({ length: TRADE_MAX }, (_, i) => {
          const h = ids[i] ? heroById(ids[i]) : null
          const target = need[i]
          return <button key={i} className={`td-slot ${h ? 'is-full' : ''}`} style={h ? { ['--rc' as string]: RARITIES[h.rarity].color } : target ? { ['--rc' as string]: RARITIES[target.rarity].color } : undefined}
            onClick={(e) => { e.stopPropagation(); if (h) (mine ? setGive : setWant)(ids.filter((x) => x !== h.id)); else setSide(mine ? 'mine' : 'theirs') }}>
            {h ? <><b>{RARITIES[h.rarity].short}</b><span>{h.name}</span>{!mine && !store.owned[h.id] && <em>Il te manque</em>}<i aria-label="Retirer">×</i></>
              : <span className="td-slot__empty">{target ? `Rareté imposée : ${RARITIES[target.rarity].label}` : 'Emplacement libre'}</span>}
          </button>
        })}
      </div>
    </div>
  )

  return (
    <section className="td">
      <div className="td-rules">
        <b>Règles des échanges</b>
        <ul>
          <li>Autant de cartes de chaque côté (1 à {TRADE_MAX}), avec les mêmes raretés : jamais une Épique contre une Rift.</li>
          <li>Seuls tes doublons s'échangent : ta dernière copie reste toujours dans ta collection.</li>
          <li>Une carte reçue ne peut repartir qu'après 24 h.</li>
        </ul>
      </div>
      {locked && <p className="td-locked">Le Marché entre joueurs n'est pas encore débloqué : tu peux préparer un échange, mais pas l'envoyer.</p>}

      {!who ? (
        <div className="so-box">
          <header className="so-box__head"><h2>Avec qui échanger ?</h2></header>
          <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) void findPlayers(q).then(setFound) }}><input className="set__input" type="search" placeholder="Pseudo ou pseudo#1234…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un joueur" /></form>
          {found && (found.length === 0 ? <p className="set__note">Aucun joueur trouvé.</p> : found.map((p) => (
            <div key={p.id} className="so-row"><span className="so-row__id"><b>{p.name}</b><i>#{p.player_no} · {p.collection} persos</i></span><button className="cd-btn cd-btn--small" onClick={() => setWho(p)}>Choisir</button></div>
          )))}
        </div>
      ) : <>
        <header className="td-head"><h2>Avec <b>{who.name}#{who.player_no}</b></h2><button className="linkbtn" onClick={() => { setWho(null); setGive([]); setWant([]) }}>Changer de joueur</button></header>
        <div className="td-grid">
          <Slots title="Tu donnes" ids={give} need={W} mine />
          <Slots title="Tu demandes" ids={want} need={G} mine={false} />
        </div>
        <p className={`td-check ${problem ? 'is-bad' : 'is-ok'}`} role="status">{problem || 'Échange équitable : tu peux l’envoyer.'}</p>

        <div className="td-pick">
          <div className="coltabs__bar" role="tablist">
            <button role="tab" aria-selected={side === 'mine'} className={side === 'mine' ? 'is-active' : ''} onClick={() => setSide('mine')}>Ma collection (doublons)</button>
            <button role="tab" aria-selected={side === 'theirs'} className={side === 'theirs' ? 'is-active' : ''} onClick={() => setSide('theirs')}>Cartes à demander</button>
          </div>
          <div className="td-filters">
            <input className="set__input" type="search" placeholder="Chercher une carte…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Chercher une carte" />
            <div className="filters__chips">{(['all', ...RARITY_ORDER] as const).map((r) => <button key={r} className={`fchip ${rar === r ? 'is-on' : ''}`} style={r === 'all' ? undefined : { ['--rc' as string]: RARITIES[r].color }} onClick={() => setRar(r)}>{r === 'all' ? 'Toutes' : RARITIES[r].short}</button>)}</div>
          </div>
          <ul className="td-list">
            {pool.slice(0, 60).map((h) => {
              const on = (side === 'mine' ? give : want).includes(h.id)
              return <li key={h.id}><button className={`td-item ${on ? 'is-on' : ''}`} style={{ ['--rc' as string]: RARITIES[h.rarity].color }} onClick={() => pick(h)}>
                <b>{RARITIES[h.rarity].short}</b><span>{h.name}<small>{h.world}{side === 'mine' ? ` · ×${store.owned[h.id]}` : store.owned[h.id] ? ' · Tu l’as' : ' · Il te manque'}</small></span></button></li>
            })}
            {pool.length === 0 && <li className="set__note">{side === 'mine' ? 'Aucun doublon échangeable (les cartes reçues depuis moins de 24 h sont bloquées).' : 'Aucune carte.'}</li>}
          </ul>
        </div>

        <label className="pm__lab">Un petit mot (facultatif)<input className="set__input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Salut ! Ça t'intéresse ?" /></label>
        <button className="cd-btn cd-btn--main cd-btn--small" disabled={Boolean(problem) || locked || busy} onClick={() => void send()}>{busy ? 'Envoi…' : 'Envoyer la proposition →'}</button>
      </>}
      <p className="cd__notice" role="status">{msg}</p>
    </section>
  )
}
