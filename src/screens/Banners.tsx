import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, COST, PITY_MAX } from '../data/banners'
import { HEROES, heroById, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { useStore, type Currency } from '../state/store'
import { Card } from '../ui/Card'
import { IconChevron, IconInfo } from '../ui/icons'
import { Coin } from '../ui/Coin'
import { SummonCinematic } from '../summon/SummonCinematic'
import { primeAudio } from '../summon/audio'

const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`
const two = (n: number) => String(n).padStart(2, '0')

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

// Cadran de garantie : un anneau qui se remplit jusqu'à la carte LR garantie.
const PityDial = ({ value }: { value: number }) => {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="dial" title={`Une carte LR ou MR est garantie au plus tard à la ${PITY_MAX}e invocation`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="dial__track" />
        <circle cx="36" cy="36" r={r} className="dial__fill" strokeDasharray={c} strokeDashoffset={c * (1 - value / PITY_MAX)} />
      </svg>
      <div className="dial__num"><b>{PITY_MAX - value}</b><span>avant LR</span></div>
    </div>
  )
}

export const Banners = () => {
  const store = useStore()
  const [index, setIndex] = useState(0)
  const [currency, setCurrency] = useState<Currency>('ticket')
  const [results, setResults] = useState<Hero[] | null>(null)
  const [showIndex, setShowIndex] = useState(false)
  const banner = BANNERS[index]
  const star = heroById(banner.star)
  const left = useCountdown(banner.endsAt)
  const pity = store.pity[banner.id]
  const coin = currency === 'ticket' ? 'seal' : 'soul'
  const price = (n: number) => n * (currency === 'ticket' ? COST.ticket : COST.gems)
  const turn = (step: number) => setIndex((i) => (i + step + BANNERS.length) % BANNERS.length)
  const summon = (n: number) => {
    primeAudio() // le son n'est autorisé par le navigateur que pendant ce clic
    const r = store.summon(banner, currency, n) // le tirage réel : c'est lui qui fixe les raretés
    if (r) setResults(r)
  }

  return (
    <div className="summon" style={{ ['--hue' as string]: banner.hue }}>
      {/* Affiche de la bannière */}
      <section className="poster" key={banner.id}>
        <div className="poster__slash" aria-hidden="true" />
        <span className="poster__glyph" aria-hidden="true">{banner.glyph}</span>
        <img className="poster__art" src={store.customArt[star.id] ?? heroArt(star.model, 'full')} alt={star.name} />
        <div className="poster__text">
          <p className="poster__count"><b>{two(index + 1)}</b> / {two(BANNERS.length)} · Faille ouverte</p>
          <h1 className="poster__title">{banner.world}</h1>
          <p className="poster__sub">{banner.subtitle}</p>
          <div className="poster__chips">
            <span className="chip chip--time">Ferme dans <b>{left}</b></span>
            <span className="chip">MR {pct(RARITIES.rift.rate)}</span>
          </div>
        </div>
        <button className="poster__nav poster__nav--prev" onClick={() => turn(-1)} aria-label="Bannière précédente"><IconChevron left /></button>
        <button className="poster__nav poster__nav--next" onClick={() => turn(1)} aria-label="Bannière suivante"><IconChevron /></button>
      </section>

      {/* Choix de la bannière */}
      <div className="rail" role="tablist" aria-label="Bannières">
        {BANNERS.map((b, i) => {
          const have = b.featured.filter((id) => store.owned[id]).length
          return (
            <button key={b.id} role="tab" aria-selected={i === index} className={`rail__item ${i === index ? 'is-active' : ''}`} style={{ ['--hue' as string]: b.hue }} onClick={() => setIndex(i)}>
              <img src={heroArt(heroById(b.star).model, 'bust')} alt="" />
              <span><b>{b.world}</b><small>{have}/{b.featured.length} cartes · garantie {store.pity[b.id]}/{PITY_MAX}</small></span>
            </button>
          )
        })}
      </div>

      {/* Cartes à l'affiche */}
      <section className="lineup">
        <header className="lineup__head">
          <h2>À l'affiche</h2>
          <button className="linkbtn" onClick={() => setShowIndex(true)}><IconInfo />Taux et contenu</button>
        </header>
        <div className="lineup__cards">
          {banner.featured.map((id) => (
            <div key={id} className="lineup__slot">
              <Card hero={heroById(id)} />
              <span className={`lineup__own ${store.owned[id] ? 'is-owned' : ''}`}>{store.owned[id] ? `Possédée ×${store.owned[id]}` : 'Non obtenue'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Console d'invocation */}
      <section className="console">
        <div className="console__top">
          <div className="pay" role="radiogroup" aria-label="Moyen d'invocation">
            <button role="radio" aria-checked={currency === 'ticket'} className={currency === 'ticket' ? 'is-active' : ''} onClick={() => setCurrency('ticket')}>
              <Coin name="seal" size={40} /><span>Sceaux<b>{store.tickets}</b></span>
            </button>
            <button role="radio" aria-checked={currency === 'gems'} className={currency === 'gems' ? 'is-active' : ''} onClick={() => setCurrency('gems')}>
              <Coin name="soul" size={40} /><span>Âmes<b>{store.gems}</b></span>
            </button>
          </div>
          <PityDial value={pity} />
        </div>
        <div className="console__pulls">
          {[1, 5, 10].map((n) => (
            <button key={n} className={`pull ${n === 10 ? 'pull--gold' : ''}`} disabled={!store.canAfford(currency, n)} onClick={() => summon(n)}>
              <b>×{n}</b>
              <span><Coin name={coin} size={20} />{price(n)}</span>
            </button>
          ))}
        </div>
      </section>

      {showIndex && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Taux et contenu de la bannière" onClick={() => setShowIndex(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Taux — {banner.world}</h2>
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

      {results && createPortal(<SummonCinematic heroes={results} onClose={() => setResults(null)} />, document.body)}
    </div>
  )
}
