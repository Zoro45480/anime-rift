import { useEffect, useMemo, useState } from 'react'
import { uiArt } from '../assets/manifest'
import { HEROES, heroById, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import { AUCTION_HOURS, auctionNow, coteOf, QUICK_SALE, quickPrice, stallOf, valueOf, type Trade } from '../game/bazaar'
import { dayKey, msToDayEnd } from '../game/contracts'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'

const n = (x: number) => x.toLocaleString('fr-FR')
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min ${String(s % 60).padStart(2, '0')} s` }
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const Price = ({ v, big }: { v: number; big?: boolean }) => <b className={`bz-price ${big ? 'bz-price--big' : ''}`}><Coin name="soul" size={big ? 22 : 18} />{n(v)}</b>

// Petit graphique des prix réels d'une carte (achats, ventes, enchères du joueur).
export const Spark = ({ trades }: { trades: Trade[] }) => {
  const pts = [...trades].sort((a, b) => a.t - b.t).slice(-12)
  if (pts.length < 2) return null
  const max = Math.max(...pts.map((p) => p.price)), min = Math.min(...pts.map((p) => p.price))
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${30 - ((p.price - min) / Math.max(1, max - min)) * 26 - 2}`).join(' ')
  return <svg className="bz-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Évolution de tes prix"><polyline points={path} /></svg>
}

type Tab = 'buy' | 'sell' | 'auctions' | 'mine'

export const Bazaar = () => {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('buy')
  const [now, setNow] = useState(() => Date.now())
  const [msg, setMsg] = useState('')
  const [rar, setRar] = useState<RarityId | 'all'>('all')
  const [q, setQ] = useState('')
  const [starts, setStarts] = useState<Record<string, string>>({})
  const [alertQ, setAlertQ] = useState('')
  const [alertPrice, setAlertPrice] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const day = dayKey(new Date(now))
  const stall = stallOf(day, store.wish)
  const bought = store.bazaar.day === day ? store.bazaar.bought : []
  const dupes = useMemo(() => HEROES.filter((h) => (store.owned[h.id] ?? 0) >= 2)
    .sort((a, b) => valueOf(b, store.levelOf(b.id), day) - valueOf(a, store.levelOf(a.id), day)), [store.owned, day, store])
  const shownDupes = dupes.filter((h) => (rar === 'all' || h.rarity === rar) && (!q || fold(`${h.name} ${h.world}`).includes(fold(q))))
  const traded = [...new Set(store.bazaar.trades.map((t) => t.heroId))].map(heroById).filter(Boolean)
  const alertHero = alertQ.length >= 2 ? HEROES.find((h) => fold(h.name).includes(fold(alertQ))) : undefined
  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  return (
    <div className="bz">
      <header className="bz__head">
        <img src={uiArt('nav-bazaar')} alt="" />
        <div><p className="eyebrow">Le marché</p><h1>Bazar des Failles</h1><p>Achète, vends, mets aux enchères. Tes âmes : <Price v={store.gems} /></p></div>
      </header>
      <ul className="bz__rules">
        <li>Marchands et acheteurs sont joués par le jeu (le marché entre joueurs demandera un serveur).</li>
        <li>Vente immédiate : {Math.round(QUICK_SALE * 100)} % de la valeur du jour. Enchères : {AUCTION_HOURS} h, 5 à la fois.</li>
        <li>Seuls les doublons se vendent : ta dernière copie reste toujours dans ta collection.</li>
      </ul>
      <div className="coltabs__bar" role="tablist" aria-label="Sections du Bazar">
        {([['buy', 'Acheter'], ['sell', 'Vendre'], ['auctions', `Enchères (${store.bazaar.auctions.length})`], ['mine', 'Mon Bazar']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <p className="cd__notice" role="status">{msg}</p>

      {tab === 'buy' && <section className="bz-sec">
        <p className="cn__meta">L'étal du jour · nouveaux marchands dans <b>{clock(msToDayEnd(new Date(now)))}</b>{store.wish.length ? ' · les cartes de ta liste d’envies passent en premier' : ' · ajoute des cartes à tes envies pour les voir ici'}</p>
        <ul className="bz-grid">
          {stall.map((x) => {
            const done = bought.includes(x.id), value = valueOf(x.hero, 1, day)
            return (
              <li key={x.id} className={`bz-item ${done ? 'is-done' : ''} ${x.wished ? 'is-wish' : ''}`}>
                {x.wished && <span className="bz-item__tag">♥ Dans tes envies</span>}
                <div className="bz-item__card"><Card hero={x.hero} /></div>
                <small className="bz-item__who">{x.merchant}</small>
                <div className="bz-item__row"><Price v={x.price} big /><span>valeur {n(value)}</span></div>
                <button className="btn btn--gold" disabled={done || store.gems < x.price} onClick={() => { if (store.buyStall(x.id)) flash(`${x.hero.name} acheté pour ${x.price} âmes.`) }}>{done ? 'Acheté' : store.gems < x.price ? 'Pas assez d’âmes' : 'Acheter'}</button>
              </li>
            )
          })}
        </ul>
      </section>}

      {tab === 'sell' && <section className="bz-sec">
        <div className="bz-filters">
          <input className="set__input" type="search" placeholder="Chercher une carte ou un univers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher dans mes doublons" />
          <div className="filters__chips">
            {(['all', ...RARITY_ORDER] as const).map((r) => <button key={r} className={`fchip ${rar === r ? 'is-on' : ''}`} style={r === 'all' ? undefined : { ['--rc' as string]: RARITIES[r].color }} onClick={() => setRar(r)}>{r === 'all' ? 'Toutes' : RARITIES[r].short}</button>)}
          </div>
        </div>
        <p className="cn__meta">Tes doublons : <b>{dupes.length}</b> carte{dupes.length > 1 ? 's' : ''}, {n(dupes.reduce((s, h) => s + store.owned[h.id] - 1, 0))} exemplaires en trop.</p>
        {shownDupes.length === 0 ? <p className="pf-empty">Aucun doublon à vendre{q || rar !== 'all' ? ' avec ces filtres' : ' pour l’instant : invoque pour en obtenir'}.</p> : (
          <ul className="bz-list">
            {shownDupes.map((h) => {
              const lv = store.levelOf(h.id), value = valueOf(h, lv, day), quick = quickPrice(h, lv, day)
              const start = Number(starts[h.id] ?? Math.round(value * 0.8))
              return (
                <li key={h.id} className="bz-row" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>
                  <div className="bz-row__id"><b>{RARITIES[h.rarity].short}</b><span>{h.name}</span><small>{h.world} · Nv {lv} · ×{store.owned[h.id]} · valeur du jour {n(value)}</small></div>
                  <button className="cd-btn cd-btn--small" onClick={() => { const p = store.quickSell(h.id); if (p) flash(`${h.name} vendu : +${p} âmes.`) }}>Vendre tout de suite<small>+{n(quick)} âmes</small></button>
                  <form className="bz-auc" onSubmit={(e) => { e.preventDefault(); if (store.listAuction(h.id, start)) flash(`${h.name} mis aux enchères à partir de ${start} âmes.`); else flash('Tu as déjà 5 enchères en cours.') }}>
                    <label><small>Prix de départ</small><input type="number" min={1} value={starts[h.id] ?? Math.round(value * 0.8)} onChange={(e) => setStarts({ ...starts, [h.id]: e.target.value })} /></label>
                    <button className="cd-btn cd-btn--small" type="submit" disabled={store.bazaar.auctions.length >= 5}>Enchères {AUCTION_HOURS} h</button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>}

      {tab === 'auctions' && <section className="bz-sec">
        {store.bazaar.auctions.length === 0 ? <p className="pf-empty">Aucune enchère en cours. Va dans « Vendre » pour mettre un doublon aux enchères.</p> : (
          <ul className="bz-list">
            {store.bazaar.auctions.map((a) => {
              const h = heroById(a.heroId), live = auctionNow(a, h, now)
              return (
                <li key={a.id} className="bz-row" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>
                  <div className="bz-row__id"><b>{RARITIES[h.rarity].short}</b><span>{h.name}</span><small>Départ {n(a.start)} · {live.bids} offre{live.bids > 1 ? 's' : ''}</small></div>
                  <div className="bz-live"><small>Meilleure offre</small>{live.best ? <Price v={live.best} big /> : <b>—</b>}</div>
                  <div className="bz-live"><small>Fin dans</small><b>{clock(a.ends - now)}</b></div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="set__note">À la fin, les âmes de la meilleure offre arrivent toutes seules (même si tu fermes le jeu : elles seront là à ton retour). Si personne n'enchérit, la carte revient dans ta collection.</p>
      </section>}

      {tab === 'mine' && <section className="bz-sec">
        <h3 className="sp-sub">Alertes de prix</h3>
        <form className="bz-alert" onSubmit={(e) => { e.preventDefault(); if (alertHero && Number(alertPrice) > 0) { store.setAlert(alertHero.id, Number(alertPrice)); flash(`Alerte créée pour ${alertHero.name}.`); setAlertQ(''); setAlertPrice('') } }}>
          <input className="set__input" placeholder="Nom d’une carte" value={alertQ} onChange={(e) => setAlertQ(e.target.value)} aria-label="Carte à surveiller" />
          <input className="set__input" type="number" min={1} placeholder="Prix max" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} aria-label="Prix maximum" />
          <button className="cd-btn cd-btn--small" type="submit" disabled={!alertHero || !(Number(alertPrice) > 0)}>Me prévenir</button>
        </form>
        {alertQ.length >= 2 && <p className="set__note">{alertHero ? <>Carte : <b>{alertHero.name}</b> ({RARITIES[alertHero.rarity].short}) · valeur du jour {n(valueOf(alertHero, 1, day))}</> : 'Aucune carte trouvée.'}</p>}
        <ul className="bz-list">
          {store.bazaar.alerts.map((a) => { const h = heroById(a.heroId); return <li key={a.heroId} className="bz-row bz-row--alert"><div className="bz-row__id"><span>{h.name}</span><small>Préviens-moi sous {n(a.below)} âmes</small></div><button className="linkbtn" onClick={() => store.setAlert(a.heroId, null)}>Retirer</button></li> })}
        </ul>
        <p className="set__note">Chaque jour, si un marchand vend une de ces cartes à ton prix ou moins, tu reçois une notification.</p>

        <h3 className="sp-sub">Mes cotes</h3>
        {traded.length === 0 ? <p className="pf-empty">Pas encore de transaction : tes cotes apparaîtront ici, calculées sur tes vrais achats et ventes.</p> : (
          <ul className="bz-list">
            {traded.map((h) => { const c = coteOf(store.bazaar.trades, h.id, now); return (
              <li key={h.id} className="bz-row" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>
                <div className="bz-row__id"><b>{RARITIES[h.rarity].short}</b><span>{h.name}</span><small>{c.count30} transaction{c.count30 > 1 ? 's' : ''} sur 30 jours</small></div>
                <div className="bz-live"><small>Médiane 7 j</small><b>{c.d7 ? n(c.d7) : '—'}</b></div>
                <div className="bz-live"><small>Médiane 30 j</small><b>{c.d30 ? n(c.d30) : '—'}</b></div>
                <Spark trades={c.all} />
              </li>
            ) })}
          </ul>
        )}

        <h3 className="sp-sub">Historique</h3>
        {store.bazaar.trades.length === 0 ? <p className="pf-empty">Aucune transaction.</p> : (
          <ol className="sh-hist">{store.bazaar.trades.slice(0, 30).map((t, i) => <li key={i}><time>{new Date(t.t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><b>{t.kind === 'buy' ? 'Achat' : t.kind === 'sell' ? 'Vente' : 'Enchère'} · {heroById(t.heroId).name}</b><span className={t.kind === 'buy' ? 'is-minus' : 'is-plus'}>{t.kind === 'buy' ? '−' : '+'}<Coin name="soul" size={16} />{n(t.price)}</span></li>)}</ol>
        )}
      </section>}
      <Guide id="bazaar" />
    </div>
  )
}
export type { Hero }
