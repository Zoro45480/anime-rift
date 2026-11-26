import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { iconArt, uiArt } from '../assets/manifest'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { msToDayEnd, msToWeekEnd, weekKey, type Reward } from '../game/contracts'
import { SCROLLS } from '../game/progression'
import { discount, giftOf, weeklyOffers } from '../game/shop'
import { useStore } from '../state/store'
import { Card } from './Card'
import { Coin } from './Coin'

const n = (x: number) => x.toLocaleString('fr-FR')
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return `${d ? `${d} j ` : ''}${h} h ${String(m).padStart(2, '0')} min ${String(s % 60).padStart(2, '0')} s`
}
const Items = ({ r }: { r: Reward }) => (
  <ul className="sh-items">
    {r.gems ? <li><Coin name="soul" size={22} />{r.gems} âmes</li> : null}
    {r.tickets ? <li><Coin name="seal" size={22} />{r.tickets} sceau{r.tickets > 1 ? 'x' : ''}</li> : null}
    {r.energy ? <li><Coin name="bolt" size={22} />{r.energy} éclairs</li> : null}
    {r.shards ? <li><img src={iconArt('shard')} alt="" />{r.shards} fragments d'âme</li> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <li key={k}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" />{v} × {SCROLLS[k as 'small'].label.toLowerCase()}</li>)}
  </ul>
)

export const Shop = ({ onClose }: { onClose: () => void }) => {
  const store = useStore()
  const [tab, setTab] = useState<'deals' | 'history'>('deals')
  const [now, setNow] = useState(() => new Date())
  const [got, setGot] = useState<Hero | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const offers = weeklyOffers(now)
  const bought = store.shop.week === weekKey(now) ? store.shop.bought : []
  const buy = (id: string, name: string) => { const r = store.buyOffer(id); if (r && r !== true) setGot(r); if (r) setMsg(`${name} acheté !`) }

  return createPortal(
    <div className="modal sh-back" role="dialog" aria-modal="true" aria-label="Boutique" onClick={onClose}>
      <div className="sh" onClick={(e) => e.stopPropagation()}>
        <header className="sh__head">
          <img src={uiArt('shop')} alt="" />
          <div><p className="eyebrow">Boutique</p><h2>Le Comptoir du Rift</h2><p>Tout s'achète avec tes âmes : <b><Coin name="soul" size={18} />{n(store.gems)}</b></p></div>
          <button className="nt-panel__close" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <div className="coltabs__bar" role="tablist">
          <button role="tab" aria-selected={tab === 'deals'} className={tab === 'deals' ? 'is-active' : ''} onClick={() => setTab('deals')}>À la une</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>Mes achats</button>
        </div>
        {tab === 'deals' && <div className="sh__body">
          <section className={`sh-gift ${store.giftReady ? 'is-ready' : ''}`}>
            <img src={uiArt('chest')} alt="" />
            <div><b>Cadeau du jour, gratuit</b><Items r={giftOf(now)} /><small>{store.giftReady ? 'Il t’attend !' : `Prochain cadeau dans ${clock(msToDayEnd(now))}`}</small></div>
            <button className="ct__claim" disabled={!store.giftReady} onClick={() => { if (store.claimGift()) setMsg('Cadeau récupéré !') }}>{store.giftReady ? 'Récupérer' : '✓'}</button>
          </section>
          <h3 className="sp-sub">Offres de la semaine <small>· nouvelles dans {clock(msToWeekEnd(now))}</small></h3>
          <ul className="sh-offers">
            {offers.map((o) => {
              const done = bought.includes(o.id)
              return (
                <li key={o.id} className={`sh-offer sh-offer--${o.tag === 'Gros lot' || o.tag === 'Rare' ? 'big' : 'small'} ${done ? 'is-done' : ''}`}>
                  <span className="sh-offer__tag">{o.tag}</span><span className="sh-offer__off">−{discount(o)} %</span>
                  <img src={o.card ? uiArt('card-pack') : uiArt('chest')} alt="" />
                  <b>{o.name}</b>
                  {o.card && <p className="sh-offer__card">1 carte {RARITIES[o.card].short} ou mieux garantie</p>}
                  <Items r={o.reward} />
                  <p className="sh-offer__price"><s>{n(o.value)}</s><b><Coin name="soul" size={20} />{n(o.price)}</b></p>
                  <button className="btn btn--gold" disabled={done || store.gems < o.price} onClick={() => buy(o.id, o.name)}>{done ? 'Acheté cette semaine' : store.gems < o.price ? 'Pas assez d’âmes' : 'Acheter'}</button>
                  <small>Une seule fois par semaine</small>
                </li>
              )
            })}
          </ul>
          <p className="set__note">Les cosmétiques (cadres, titres, effets…) s'achètent dans ton Profil → Modifier → Boutique. Il n'y a aucun achat en argent réel : il demanderait un serveur et un vrai paiement.</p>
        </div>}
        {tab === 'history' && <div className="sh__body">
          {store.shop.history.length === 0 ? <p className="pf-empty">Aucun achat pour l'instant.</p> : (
            <ol className="sh-hist">{store.shop.history.map((h, i) => <li key={i}><time>{new Date(h.t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><b>{h.name}</b><span><Coin name="soul" size={16} />{n(h.price)}</span></li>)}</ol>
          )}
        </div>}
        <p className="cd__notice" role="status">{msg}</p>
        {got && (
          <div className="pt-reveal" onClick={() => setGot(null)}>
            <div className="pt-reveal__box" onClick={(e) => e.stopPropagation()}>
              <p className="eyebrow">Carte garantie</p><h3>Nouvelle carte !</h3>
              <div className="pt-reveal__cards"><Card hero={got} /></div>
              <button className="btn btn--gold" onClick={() => setGot(null)}>Super !</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
