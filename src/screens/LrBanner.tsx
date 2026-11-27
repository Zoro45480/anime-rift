import { useState } from 'react'
import { createPortal } from 'react-dom'
import { HEROES, type Hero } from '../data/heroes'
import { useStore } from '../state/store'
import { Card, LazyCard } from '../ui/Card'

const art = import.meta.glob('../assets/referral/ticket_LR.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const ticket = Object.values(art)[0]
const LRS = HEROES.filter((h) => h.rarity === 'legend')
const pct = (100 / LRS.length).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

// Bannière « LR garantie » : toujours ouverte. 1 ticket LR = 1 carte LR, à chance égale parmi toutes les LR du jeu.
export const LrBanner = () => {
  const store = useStore()
  const [info, setInfo] = useState(false)
  const [index, setIndex] = useState(false)
  const [got, setGot] = useState<Hero | null>(null)
  const tickets = store.items?.lr ?? 0
  const owned = LRS.filter((h) => store.owned[h.id]).length
  const bg = store.bannerArt.naruto ?? Object.values(store.bannerArt)[0]
  const fan = [LRS[3], LRS[0], LRS[7]].filter(Boolean)
  const use = () => { const c = store.useLrTicket(); if (c) setGot(c) }
  const toReferral = () => window.dispatchEvent(new CustomEvent('anime-rift:community', { detail: 'referral' }))
  return (
    <section className="lrb">
      {bg && <img className="lrb__bg" src={bg} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
      <div className="lrb__text">
        <p className="lrb__kick">★ Toujours disponible · 7/7</p>
        <h2 className="lrb__title">LR garantie</h2>
        <button className="lrb__info" onClick={() => setInfo(!info)} aria-expanded={info}>ⓘ Informations <span>{info ? '▴' : '▾'}</span></button>
        {info && <p className="lrb__more">1 ticket LR = 1 carte LR, tirée à chance égale parmi les {LRS.length} LR du jeu ({pct} % chacune). Tu en possèdes {owned}.</p>}
        <div className="lrb__btns">
          {tickets > 0
            ? <button className="lrb__gold" onClick={use}><img src={ticket} alt="" />Utiliser un ticket LR <b>×{tickets}</b></button>
            : <button className="lrb__gold" onClick={toReferral}><img src={ticket} alt="" />Obtenir des tickets LR</button>}
          <button className="lrb__ghost" onClick={() => setIndex(true)}>Index de la bannière</button>
        </div>
        <p className="lrb__where">Où les obtenir : le <b>parrainage</b> (3e, 6e et 10e filleul validé).</p>
      </div>
      <div className="lrb__fan" aria-hidden="true">{fan.map((h, i) => <div key={h.id} className={`lrb__card lrb__card--${i}`}><Card hero={h} inert /></div>)}</div>

      {index && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Index LR garantie" onClick={() => setIndex(false)}>
          <div className="modal__box lrb-index" onClick={(e) => e.stopPropagation()}>
            <button className="pmini__x" onClick={() => setIndex(false)} aria-label="Fermer">×</button>
            <header><span className="lrb-index__ico" lang="ja">伝</span><div><p className="eyebrow">Index de la bannière</p><h2 className="page-title">LR garantie</h2>
              <p>1 ticket LR = 1 carte LR, tirée à chance égale parmi les <b>{LRS.length}</b> LR ci-dessous ({pct} % chacune). Tu en possèdes <b>{owned}</b>.</p></div></header>
            <p className="lrb-index__sum"><b>LR</b> 100 % · {LRS.length} cartes · {pct} % chacune</p>
            <div className="lrb-index__grid">{LRS.map((h) => <figure key={h.id}><LazyCard hero={h} inert /><figcaption>{pct} %</figcaption></figure>)}</div>
          </div>
        </div>, document.body)}
      {got && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Carte obtenue" onClick={() => setGot(null)}>
          <div className="modal__box lrb-got" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">LR garantie</p><div className="lrb-got__card"><Card hero={got} hd /></div>
            <h2>{got.name}</h2><button className="btn btn--gold" onClick={() => setGot(null)}>Super !</button>
          </div>
        </div>, document.body)}
    </section>
  )
}
