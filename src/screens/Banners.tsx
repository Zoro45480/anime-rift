import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, COST, PITY_MAX, type Banner } from '../data/banners'
import { HEROES, heroById, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { useStore, type Currency } from '../state/store'
import { Card } from '../ui/Card'
import { IconArrow, IconChevron, IconInfo } from '../ui/icons'
import { Coin } from '../ui/Coin'

const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`

const useCountdown = (iso: string) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(iso).getTime() - now)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return ms === 0 ? 'Terminée' : `${d} j ${h} h ${m} min`
}

const ownedFeatured = (b: Banner, owned: Record<string, number>) => b.featured.filter((id) => owned[id]).length

export const Banners = () => {
  const store = useStore()
  const [bannerId, setBannerId] = useState(BANNERS[0].id)
  const [focus, setFocus] = useState(1)
  const [currency, setCurrency] = useState<Currency>('ticket')
  const [results, setResults] = useState<Hero[] | null>(null)
  const [showIndex, setShowIndex] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  const banner = BANNERS.find((b) => b.id === bannerId)!
  const star = heroById(banner.star)
  const left = useCountdown(banner.endsAt)
  const pity = store.pity[banner.id]
  const price = (n: number) => n * (currency === 'ticket' ? COST.ticket : COST.gems)

  const choose = (id: string) => { setBannerId(id); setFocus(1); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const summon = (n: number) => { const r = store.summon(banner, currency, n); if (r) setResults(r) }
  const order = [0, 1, 2].map((i) => (focus + i + 2) % 3) // gauche, centre, droite

  return (
    <div className="banners" style={{ ['--hue' as string]: banner.hue }}>
      <div className="pills" ref={top} role="tablist" aria-label="Bannières">
        {BANNERS.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === bannerId} className={`pill ${b.id === bannerId ? 'is-active' : ''}`} style={{ ['--hue' as string]: b.hue }} onClick={() => choose(b.id)}>
            <i>{b.glyph}</i>{b.world}
          </button>
        ))}
      </div>

      <section className="hero" key={banner.id}>
        <img className="hero__bg" src={heroArt(star.model, 'full')} alt="" />
        <div className="hero__head">
          <p className="hero__kicker">✦ MR {pct(RARITIES.rift.rate)} · Bannière limitée pendant <b>{left}</b></p>
          <h1 className="hero__title">{banner.world}</h1>
          <p className="hero__sub">{banner.subtitle}</p>
        </div>

        <div className="fan">
          <button className="fan__nav" onClick={() => setFocus((f) => (f + 2) % 3)} aria-label="Carte précédente"><IconChevron left /></button>
          <div className="fan__cards">
            {order.map((idx, pos) => (
              <Card key={banner.featured[idx]} hero={heroById(banner.featured[idx])} className={`fan__card fan__card--${pos}`} />
            ))}
          </div>
          <button className="fan__nav" onClick={() => setFocus((f) => (f + 1) % 3)} aria-label="Carte suivante"><IconChevron /></button>
        </div>

        <div className="summon">
          <button className="linkbtn" onClick={() => setShowIndex(true)}><IconInfo />Index de la bannière</button>
          <h2 className="eyebrow">Moyen d'invocation</h2>
          <div className="switch" role="radiogroup">
            <button role="radio" aria-checked={currency === 'ticket'} className={currency === 'ticket' ? 'is-active' : ''} onClick={() => setCurrency('ticket')}>
              <Coin name="ticket" size={28} />Tickets<b>{store.tickets}</b>
            </button>
            <button role="radio" aria-checked={currency === 'gems'} className={currency === 'gems' ? 'is-active' : ''} onClick={() => setCurrency('gems')}>
              <Coin name="gem" size={28} />Gemmes<b>{store.gems}</b>
            </button>
          </div>
          <div className="summon__row">
            <button className="btn" disabled={!store.canAfford(currency, 1)} onClick={() => summon(1)}>Invoquer ×1<span><Coin name={currency === 'ticket' ? 'ticket' : 'gem'} size={24} />{price(1)}</span></button>
            <button className="btn" disabled={!store.canAfford(currency, 5)} onClick={() => summon(5)}>Invoquer ×5<span><Coin name={currency === 'ticket' ? 'ticket' : 'gem'} size={24} />{price(5)}</span></button>
          </div>
          <button className="btn btn--gold" disabled={!store.canAfford(currency, 10)} onClick={() => summon(10)}>Invoquer ×10<span><Coin name={currency === 'ticket' ? 'ticket' : 'gem'} size={26} />{price(10)}</span></button>
          <div className="pity" title={`Une carte LR ou MR est garantie au plus tard à la ${PITY_MAX}e invocation`}>
            <span className="eyebrow">Garantie</span>
            <div className="bar"><i style={{ width: `${(pity / PITY_MAX) * 100}%` }} /></div>
            <b>{pity}/{PITY_MAX}</b>
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section__head"><span>01</span><div><h2>À l'affiche</h2><p>Les bannières limitées du moment.</p></div></header>
        <div className="feature-list">
          {BANNERS.map((b) => {
            const s = heroById(b.star)
            const have = ownedFeatured(b, store.owned)
            return (
              <article key={b.id} className="feature" style={{ ['--hue' as string]: b.hue }}>
                <div className="feature__top">
                  <img className="feature__bg" src={heroArt(s.model, 'full')} alt="" loading="lazy" />
                  <div className="feature__text">
                    <p className="eyebrow">Bannière limitée</p>
                    <h3>{b.world}</h3>
                    <p><span className="badge">{RARITIES[s.rarity].short}</span>{s.name} ({s.title})</p>
                    <button className="linkbtn linkbtn--accent" onClick={() => choose(b.id)}>Voir la bannière <IconArrow /></button>
                  </div>
                  <Card hero={s} className="feature__card" />
                </div>
                <div className="feature__stats">
                  <div><span>Cartes à l'affiche possédées</span><b>{have} / {b.featured.length}</b><div className="bar"><i style={{ width: `${(have / b.featured.length) * 100}%` }} /></div></div>
                  <div><span>Garantie LR</span><b>{store.pity[b.id]} / {PITY_MAX}</b><div className="bar"><i style={{ width: `${(store.pity[b.id] / PITY_MAX) * 100}%` }} /></div></div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {showIndex && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Index de la bannière" onClick={() => setShowIndex(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Index — {banner.world}</h2>
            <p className="modal__note">Probabilités par invocation. Quand une rareté sort, un personnage à l'affiche de cette rareté a 1 chance sur 2 d'être choisi. Une LR ou MR est garantie au plus tard à la {PITY_MAX}e invocation.</p>
            {RARITY_ORDER.map((rid) => (
              <div key={rid} className="rates">
                <div className="rates__head" style={{ color: RARITIES[rid].color }}><b>{RARITIES[rid].short}</b>{RARITIES[rid].label}<span>{pct(RARITIES[rid].rate)}</span></div>
                <p>{HEROES.filter((h) => h.rarity === rid).map((h) => `${h.name}${banner.featured.includes(h.id) ? ' ★' : ''}`).join(' · ')}</p>
              </div>
            ))}
            <button className="btn" onClick={() => setShowIndex(false)}>Fermer</button>
          </div>
        </div>,
        document.body,
      )}

      {results && createPortal(
        <div className="modal modal--result" role="dialog" aria-modal="true" aria-label="Résultat de l'invocation">
          <div className="result">
            <h2 className="result__title">Invocation</h2>
            <div className={`result__grid result__grid--${results.length}`}>
              {results.map((h, i) => <Card key={i} hero={h} className="result__card" style={{ animationDelay: `${i * 90}ms` }} />)}
            </div>
            <button className="btn btn--gold" onClick={() => setResults(null)}>Continuer</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
