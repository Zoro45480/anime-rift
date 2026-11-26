import { useCallback, useEffect, useState } from 'react'
import { HEROES, heroById } from '../data/heroes'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import { valueOf } from '../game/bazaar'
import { dayKey } from '../game/contracts'
import { bidListing, buyListing, closeListing, createListing, fetchListings, fetchMyListings, myId, playersById, useOnline, type Listing, type PublicPlayer } from '../state/online'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'

const n = (x: number) => x.toLocaleString('fr-FR')
const left = (iso: string) => { const ms = new Date(iso).getTime() - Date.now(); if (ms <= 0) return 'terminée'; const h = Math.floor(ms / 3600000); return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min` }
const FLOOR: Record<RarityId, number> = { common: 5, rare: 15, epic: 50, ultra: 200, legend: 800, rift: 3000 } // prix minimum par rareté

// Le marché entre vrais joueurs : prix fixe ou enchères, 10 % de commission, la carte et les âmes passent par la boîte de réception.
export const PlayerMarket = ({ onConnect }: { onConnect: () => void }) => {
  const { session } = useOnline()
  const store = useStore()
  const [list, setList] = useState<Listing[] | null>(null)
  const [mine, setMine] = useState<Listing[]>([])
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [rar, setRar] = useState<RarityId | 'all'>('all')
  const [q, setQ] = useState('')
  const [bids, setBids] = useState<Record<number, string>>({})
  const [sell, setSell] = useState({ hero: '', kind: 'fixed' as 'fixed' | 'auction', price: '', hours: 24 })
  const [msg, setMsg] = useState('')
  const uid = myId()
  const load = useCallback(async () => {
    const [l, m] = await Promise.all([fetchListings(), session ? fetchMyListings() : Promise.resolve([])])
    setList(l); setMine(m)
    const ps = await playersById([...new Set(l.map((x) => x.seller))])
    setPeople(Object.fromEntries(ps.map((p) => [p.id, p])))
    // les annonces terminées sont réglées par le premier qui passe
    for (const x of l.filter((x) => new Date(x.ends_at).getTime() < Date.now())) void closeListing(x.id)
  }, [session])
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20000); return () => clearInterval(t) }, [load])
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  if (!session) return <section className="so-login"><h2>Marché des joueurs</h2><p>Achète, vends et mets aux enchères tes cartes avec les autres joueurs. Connecte-toi avec Discord ou Google.</p><button className="oauth oauth--discord" onClick={onConnect}>Se connecter</button></section>

  const shown = (list ?? []).filter((x) => { const h = heroById(x.hero_id); return h && new Date(x.ends_at).getTime() > Date.now() && (rar === 'all' || h.rarity === rar) && (!q || h.name.toLowerCase().includes(q.toLowerCase())) })
  const dupes = HEROES.filter((h) => (store.owned[h.id] ?? 0) >= 2).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
  const sellHero = sell.hero ? heroById(sell.hero) : null
  const buy = async (x: Listing) => {
    if (!store.spendGems(x.price)) return flash('Pas assez d’âmes.')
    const r = await buyListing(x.id)
    if (r !== 'ok') { store.addGems(x.price); return flash(r) }
    flash(`${heroById(x.hero_id).name} acheté : la carte arrive dans ta collection dans quelques secondes.`); void load()
  }
  const bid = async (x: Listing) => {
    const amount = Number(bids[x.id] ?? 0)
    if (!(amount > Math.max(x.price - 1, x.best_bid ?? 0))) return flash('Ton enchère doit dépasser la meilleure offre.')
    if (!store.spendGems(amount)) return flash('Pas assez d’âmes.')
    const r = await bidListing(x.id, amount)
    if (r !== 'ok') { store.addGems(amount); return flash(r) }
    flash('Enchère placée ! Si quelqu’un te dépasse, tes âmes reviennent toutes seules.'); void load()
  }
  const put = async () => {
    if (!sellHero) return
    const price = Math.round(Number(sell.price))
    if (!(price >= FLOOR[sellHero.rarity])) return flash(`Prix minimum pour une ${RARITIES[sellHero.rarity].short} : ${FLOOR[sellHero.rarity]} âmes.`)
    if (!store.takeCards([sellHero.id])) return flash('Il te faut un doublon de cette carte.')
    const lvl = store.levelOf(sellHero.id)
    const r = await createListing(sellHero.id, lvl, sell.kind, price, sell.hours)
    if (r !== 'ok') { store.giveCards([sellHero.id]); return flash(r) }
    flash('Ta carte est en vente !'); setSell({ ...sell, hero: '', price: '' }); void load()
  }

  return (
    <section className="pm">
      <ul className="bz__rules"><li>Ventes entre vrais joueurs : prix fixe ou enchères. 10 % de commission sur chaque vente.</li><li>Ta carte est mise de côté pendant la vente ; si personne n'achète, elle revient. Seuls les doublons se vendent.</li><li>Une enchère placée dans les 2 dernières minutes prolonge l'enchère de 2 minutes.</li></ul>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      <div className="pm__grid">
        <div className="pm__main">
          <div className="pm__filters">
            <input className="set__input" type="search" placeholder="Chercher une carte…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une carte" />
            <div className="filters__chips">{(['all', ...RARITY_ORDER] as const).map((r) => <button key={r} className={`fchip ${rar === r ? 'is-on' : ''}`} style={r === 'all' ? undefined : { ['--rc' as string]: RARITIES[r].color }} onClick={() => setRar(r)}>{r === 'all' ? 'Toutes' : RARITIES[r].short}</button>)}</div>
            <span className="pm__count">{shown.length} annonce{shown.length > 1 ? 's' : ''}</span>
          </div>
          {!list ? <p className="pf-empty">Chargement du marché…</p> : shown.length === 0 ? <p className="pf-empty">Aucune annonce pour l'instant. Mets un doublon en vente pour lancer le marché !</p> : (
            <ul className="bz-grid">{shown.map((x) => {
              const h = heroById(x.hero_id), own = x.seller === uid
              return (
                <li key={x.id} className="bz-item">
                  <span className="bz-item__tag">{x.kind === 'auction' ? '⚑ Enchère' : 'Prix fixe'} · {left(x.ends_at)}</span>
                  <div className="bz-item__card"><Card hero={h} /></div>
                  <small className="bz-item__who">Nv {x.level} · {people[x.seller]?.name ?? '…'} #{people[x.seller]?.player_no}</small>
                  <div className="bz-item__row"><b className="bz-price bz-price--big"><Coin name="soul" size={22} />{n(x.best_bid ?? x.price)}</b><span>{x.kind === 'auction' ? (x.best_bid ? 'meilleure offre' : 'départ') : `valeur ${n(valueOf(h, x.level, dayKey(new Date())))}`}</span></div>
                  {own ? <small className="bz-item__who">Ton annonce</small> : x.kind === 'fixed'
                    ? <button className="btn btn--gold" disabled={store.gems < x.price} onClick={() => void buy(x)}>{store.gems < x.price ? 'Pas assez d’âmes' : 'Acheter'}</button>
                    : <form className="pm__bid" onSubmit={(e) => { e.preventDefault(); void bid(x) }}><input type="number" min={(x.best_bid ?? x.price - 1) + 1} placeholder={String((x.best_bid ?? x.price - 1) + 1)} value={bids[x.id] ?? ''} onChange={(e) => setBids({ ...bids, [x.id]: e.target.value })} aria-label="Montant de l'enchère" /><button className="btn btn--gold" type="submit">Enchérir</button></form>}
                </li>
              )
            })}</ul>
          )}
        </div>
        <aside className="pm__side">
          <section className="so-box">
            <header className="so-box__head"><h2>Vendre</h2></header>
            {dupes.length === 0 ? <p className="set__note">Tu n'as pas de doublon à vendre.</p> : <>
              <select className="set__input" value={sell.hero} onChange={(e) => { const h = heroById(e.target.value); setSell({ ...sell, hero: e.target.value, price: h ? String(Math.max(FLOOR[h.rarity], valueOf(h, store.levelOf(h.id), dayKey(new Date())))) : '' }) }} aria-label="Carte à vendre">
                <option value="">Choisis un doublon…</option>
                {dupes.map((h) => <option key={h.id} value={h.id}>{RARITIES[h.rarity].short} · {h.name} (×{store.owned[h.id]})</option>)}
              </select>
              <div className="set__seg set__seg--two">{(['fixed', 'auction'] as const).map((k) => <button key={k} className={sell.kind === k ? 'is-on' : ''} onClick={() => setSell({ ...sell, kind: k })}><b>{k === 'fixed' ? 'Prix fixe' : 'Enchère'}</b></button>)}</div>
              <label className="pm__lab">{sell.kind === 'fixed' ? 'Prix' : 'Prix de départ'}<input className="set__input" type="number" min={1} value={sell.price} onChange={(e) => setSell({ ...sell, price: e.target.value })} /></label>
              <label className="pm__lab">Durée<select className="set__input" value={sell.hours} onChange={(e) => setSell({ ...sell, hours: Number(e.target.value) })}>{[1, 4, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} h</option>)}</select></label>
              {sellHero && <p className="set__note">Tu recevras {n(Math.max(0, Number(sell.price) - Math.floor(Number(sell.price) / 10)))} âmes après la commission. Minimum : {FLOOR[sellHero.rarity]}.</p>}
              <button className="btn btn--gold" disabled={!sellHero} onClick={() => void put()}>Mettre en vente</button>
            </>}
          </section>
          <section className="so-box">
            <header className="so-box__head"><h2>Mes annonces</h2></header>
            {mine.length === 0 ? <p className="set__note">Aucune annonce.</p> : <ul className="pm__mine">{mine.map((x) => (
              <li key={x.id}><b>{heroById(x.hero_id)?.name}</b><small>{x.seller === uid ? 'Vente' : 'Enchère / achat'} · {{ open: left(x.ends_at), sold: 'vendue', cancelled: 'retirée', expired: 'sans acheteur' }[x.status] ?? x.status} · {n(x.best_bid ?? x.price)}</small>
                {x.seller === uid && x.status === 'open' && !x.best_bidder && <button className="linkbtn" onClick={() => void closeListing(x.id).then((r) => { flash(r === 'ok' ? 'Annonce retirée : ta carte revient.' : r); void load() })}>Retirer</button>}</li>
            ))}</ul>}
          </section>
        </aside>
      </div>
    </section>
  )
}
