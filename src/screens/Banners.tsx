import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, BIG_PITY, COST, PITY_MAX } from '../data/banners'
import { heroById } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { extraArt, iconArt } from '../assets/manifest'
import { HEROES } from '../data/heroes'
import { isPityRarity } from '../data/rarities'
import { LEVEL_CAP, MAX_LEVEL } from '../game/progression'
import { cardRate, indexCards } from '../game/gacha'
import { Guide } from '../ui/Guide'
import { useStore, type Currency } from '../state/store'
import { Card, LazyCard } from '../ui/Card'
import { Coin } from '../ui/Coin'
import { readFav, toggleFav } from '../summon/RiftSummon'
import { InvocationDemo } from '../summon/InvocationDemo'
import { primeAudio } from '../summon/audio'
import { LrBanner } from './LrBanner'
import { KeyTimer } from '../ui/Chrome'

const lrArt = import.meta.glob('../assets/referral/ticket_LR.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const LR_TICKET = Object.values(lrArt)[0]
const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`
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


export const Banners = ({ onRebirth, start = 0 }: { onRebirth: () => void; start?: number }) => {
  const store = useStore()
  const [index, setIndex] = useState(start)
  const currency: Currency = 'ticket' // le moyen de paiement se choisit dans la faille
  const [rift, setRift] = useState<number | null>(null) // écran d'invocation « faille » ouvert, avec la quantité choisie
  const [showIndex, setShowIndex] = useState(false)
  const [hold, setHold] = useState(false) // la souris est sur l'affiche : on arrête le défilement
  const [favs, setFavs] = useState(readFav)
  const [focus, setFocus] = useState(false) // « Voir le Portail » : n'affiche plus que la bannière choisie
  const banner = BANNERS[index]
  const left = useCountdown(banner.endsAt)
  const pity = store.pity[banner.id]
  // Mes gros tirages : les cartes SSR, LR et MR réellement obtenues sur cet appareil, les plus récentes d'abord.
  const bigPulls = HEROES.filter((h) => isPityRarity(h.rarity))
    .flatMap((h) => (store.log[h.id] ?? []).filter((e) => e.k === 'pull').map((e) => ({ hero: h, t: e.t })))
    .sort((a, b) => b.t - a.t).slice(0, 12)
  const ago = (t: number) => {
    const m = Math.floor((Date.now() - t) / 60000)
    return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `il y a ${Math.floor(m / 1440)} j`
  }
  // l'affiche passe toute seule à la bannière suivante toutes les 8 secondes
  useEffect(() => {
    if (hold || focus || rift !== null) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % BANNERS.length), 8000)
    return () => clearTimeout(t)
  }, [index, hold, focus, rift])
  const summon = (n: number) => {
    primeAudio() // le son n'est autorisé par le navigateur que pendant ce clic
    setRift(n) // on ouvre la faille : le tirage se fait quand le joueur l'ouvre
  }

  return (
    <div className={`summon ${focus ? 'summon--focus' : ''}`} style={{ ['--hue' as string]: banner.hue }}>
      {focus && <button className="summon__back" onClick={() => { setFocus(false); window.scrollTo({ top: 0 }) }}>← Toutes les invocations</button>}
      {/* ═══ Bannière en vedette : grande affiche qui défile toute seule ; « Invoquer » ouvre directement la faille ═══ */}
      <section className="bx" key={`bx-${banner.id}`} style={{ ['--hue' as string]: banner.hue }} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
        {store.bannerArt[banner.id] && <img className="bx__bg" src={store.bannerArt[banner.id]} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <span className="bx__glyph" lang="ja" aria-hidden="true">{banner.glyph}</span>
        <div className="bx__text">
          <p className="bx__kicker">✦ MR {pct(RARITIES.rift.rate)} · Bannière limitée pendant <b>{left}</b></p>
          <h1 className="bx__title">{banner.world}</h1>
          <p className="bx__sub">{banner.subtitle}</p>
          <div className="bx__btns">
            <button className="bx__go" onClick={() => summon(10)}>Invoquer</button>
            <button className="bx__ghost" onClick={() => setShowIndex(true)}>Index de la bannière</button>
          </div>
          <p className="bx__pity">Garantie SSR <b>{pity}/{PITY_MAX}</b><i>·</i>Grande garantie MR <b>{store.multis[banner.id] ?? 0}/{BIG_PITY}</b><i>·</i><span className="bx__bal"><Coin name="seal" size={18} />{store.tickets}</span><span className="bx__bal"><Coin name="soul" size={18} />{store.gems}</span></p>
          <KeyTimer long />
        </div>
        <div className="bx__fan">
          {banner.featured.map((id, i) => <div key={id} className={`bx__card bx__card--${i}`}><Card hero={heroById(id)} /></div>)}
        </div>
        {!focus && <div className="bx__dots" role="tablist" aria-label="Bannières">{BANNERS.map((b, i) => <button key={b.id} role="tab" aria-selected={i === index} aria-label={b.world} className={i === index ? 'is-on' : ''} onClick={() => setIndex(i)} />)}</div>}
      </section>

      {!focus && <div className="bx-chips" role="tablist" aria-label="Bannières">
        {BANNERS.map((b, i) => (
          <button key={b.id} role="tab" aria-selected={i === index} className={`bx-chip ${i === index ? 'is-on' : ''}`} style={{ ['--hue' as string]: b.hue }} onClick={() => { setIndex(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <img src={extraArt(`emblem-${b.id}`)} alt="" />{b.world}
          </button>
        ))}
        <button className="bx-chip bx-chip--lr" onClick={() => document.querySelector('.lrb')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><img src={LR_TICKET} alt="" />LR Garantie</button>
      </div>}

      {!focus && <section className="bx-aff">
        <header className="section__head"><span>01</span><div><h2>À l'affiche</h2><p>Les bannières limitées du moment.</p></div></header>
        <div className="bx-aff__grid">
          {[...BANNERS].sort((x, y) => Number(favs.includes(y.id)) - Number(favs.includes(x.id))).map((b) => {
            const i = BANNERS.indexOf(b)
            const s = heroById(b.star)
            const pool = indexCards(b)
            const have = pool.filter((h) => store.owned[h.id]).length
            const multis = store.multis[b.id] ?? 0
            const isFav = favs.includes(b.id)
            const open = () => { setIndex(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }
            return (
              <article key={b.id} className={`bt ${i === index ? 'is-current' : ''}`} style={{ ['--hue' as string]: b.hue }}>
                <div className="bt__top" onClick={open}>
                  {store.bannerArt[b.id] && <img className="bt__bg" src={store.bannerArt[b.id]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                  <button className={`bt__fav ${isFav ? 'is-on' : ''}`} aria-pressed={isFav} aria-label={`${b.world} en favori`} onClick={(e) => { e.stopPropagation(); toggleFav(b.id, !isFav); setFavs(readFav()) }}>★</button>
                  <div className="bt__text">
                    <p className="bt__kick">Bannière limitée</p>
                    <h3>{b.world}</h3>
                    <p className="bt__star"><b>{RARITIES[s.rarity].short}</b>{s.name} ({s.title})</p>
                    <button className="bt__link" onClick={(e) => { e.stopPropagation(); open() }}>Voir la bannière ↗</button>
                  </div>
                  <div className="bt__card"><Card hero={s} inert /></div>
                </div>
                <div className="bt__stats">
                  <div><span>Cartes à l'affiche possédées</span><b>{have} / {pool.length}</b><div className="bt__bar"><i style={{ width: `${(have / Math.max(1, pool.length)) * 100}%` }} /></div></div>
                  <div><span>Grande garantie MR · multis ×10</span><b>{multis} / {BIG_PITY}</b><div className="bt__bar bt__bar--gold"><i style={{ width: `${(multis / BIG_PITY) * 100}%` }} /></div></div>
                </div>
              </article>
            )
          })}
        </div>
      </section>}

      {/* Bannière seule : ses têtes d'affiche, une par une */}
      {focus && (
        <section className="heads">
          <header className="section__head"><span>{two(banner.featured.length)}</span><div><h2>Têtes d'affiche</h2><p>Les cartes les plus rares du Portail {banner.world}.</p></div></header>
          {banner.featured.map((id) => {
            const h = heroById(id)
            const rate = cardRate(banner, h)
            return (
              <article key={id} className="head" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>
                <div className="head__card"><Card hero={h} locked={!store.owned[id]} /></div>
                <div className="head__text">
                  <p className="head__kicker">Tête d'affiche · {RARITIES[h.rarity].short}</p>
                  <h3>{h.name} <i>({h.title})</i></h3>
                  <p className="head__desc">L'une des cartes les plus rares du jeu. Elle ne tombe que sur ce Portail. {store.owned[id] ? `Vous en possédez ${store.owned[id]}.` : 'Vous ne la possédez pas encore.'}</p>
                  <ul className="head__facts">
                    <li><b>{pct(rate)}</b><span>par carte invoquée · 1 chance sur {Math.round(1 / rate).toLocaleString('fr-FR')}</span></li>
                    <li><b>{h.role}</b><span>son rôle en combat</span></li>
                    <li><b>Cadre animé</b><span>reflets et effets en mouvement</span></li>
                    <li><b>Invocation {RARITIES[h.rarity].short}</b><span>son animation dédiée si elle tombe</span></li>
                  </ul>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {/* Bannière seule : toutes ses cartes par rareté, avec la chance de chacune, puis ses « plus » */}
      {focus && (
        <section className="bcards">
          <header className="section__head"><span>{two(indexCards(banner).length)}</span><div><h2>Les cartes de {banner.world}</h2><p>Les SSR, LR et MR de {banner.world}. Toutes les autres cartes des 7 univers peuvent aussi sortir ici (sauf les MR des autres univers). Touche une carte pour l'ouvrir. La chance indiquée est celle d'une invocation.</p></div></header>
          {RARITY_ORDER.map((rid) => {
            const cards = indexCards(banner).filter((h) => h.rarity === rid)
            if (cards.length === 0) return null
            const rates = [...new Set(cards.map((h) => pct(cardRate(banner, h))))]
            return (
              <div key={rid} className="bcards__group" style={{ ['--rc' as string]: RARITIES[rid].color }}>
                <header><i /><b>{RARITIES[rid].short}</b><span>{cards.length} carte{cards.length > 1 ? 's' : ''} · {rates.length === 1 ? `${rates[0]}${cards.length > 1 ? ' chacune' : ''}` : `${pct(RARITIES[rid].rate)} en tout`}</span></header>
                <div className="bcards__grid">
                  {cards.map((h) => <figure key={h.id}><LazyCard hero={h} /><figcaption>{pct(cardRate(banner, h))}</figcaption></figure>)}
                </div>
              </div>
            )
          })}
        </section>
      )}
      {focus && (
        <section className="bplus">
          <h2>Les plus du Portail</h2>
          <div className="bplus__box">
            <h3>Garantie SSR ou mieux</h3>
            <div className="pity__track"><i style={{ width: `${(pity / PITY_MAX) * 100}%` }} /></div>
            <p><b>{pity} / {PITY_MAX}</b> invocations. À la {PITY_MAX}e sans carte SSR, LR ou MR, la suivante en est une à coup sûr. Le compteur est propre à ce Portail.</p>
          </div>
          <div className="bplus__box">
            <h3>Taux par rareté</h3>
            <dl>{RARITY_ORDER.map((rid) => <div key={rid} style={{ ['--rc' as string]: RARITIES[rid].color }}><dt>{RARITIES[rid].short} <small>{RARITIES[rid].label}</small></dt><dd>{pct(RARITIES[rid].rate)}</dd></div>)}</dl>
            <button className="bplus__btn" onClick={() => setShowIndex(true)}>Index du Portail</button>
          </div>
          <div className="bplus__box">
            <h3>Parchemins et Éclats</h3>
            <p>Les invocations ne donnent que des cartes. Les parchemins d'XP et les Éclats se gagnent dans L’Aventure.</p>
          </div>
        </section>
      )}

      {!focus && <LrBanner />}

      {!focus && <>
        {/* Échos des failles : les anciens Portails, rouvertes par l’Ascension */}
        <section className="echo">
          <header className="section__head"><span>00</span><div><h2>Échos des failles</h2><p>Les anciens Portails, rouvertes après chaque Ascension.</p></div></header>
          <div className="echo__box">
            <h3>{store.rebirths > 0 ? 'Débloqué par ton Ascension' : 'Débloqué par l’Ascension'}</h3>
            <p>{store.rebirths > 0 ? 'Tu as accès aux Échos.' : 'Fais une Ascension (niveau de compte 100) pour ouvrir les Échos.'} Les Portails qui ont fermé reviendront ici.</p>
            <button className="echo__btn" onClick={onRebirth}>Voir l’Ascension ↗</button>
          </div>
          <p className="echo__empty">Aucun Portail n'a encore fermé : il n'y a donc pas d'Écho pour l'instant. Les {BANNERS.length} Portails du jeu sont tous ouverts ci-dessus.</p>
        </section>

        {/* Mes gros tirages */}
        <section className="pulls">
          <p className="pulls__kicker"><i />Sur cet appareil · SSR, LR et MR</p>
          <h2>Mes gros tirages</h2>
          {bigPulls.length === 0 ? <p className="echo__empty">Pas encore de carte SSR, LR ou MR. Tes plus beaux tirages s'afficheront ici.</p> : (
            <div className="pulls__row">
              {bigPulls.map((x, i) => <figure key={i} className="pulls__item"><Card hero={x.hero} /><figcaption>{ago(x.t)}</figcaption></figure>)}
            </div>
          )}
          <p className="echo__empty">Les tirages des autres joueurs, en direct, demandent un jeu en ligne avec des profils : ce sera pour plus tard.</p>
        </section>

        {/* Comment ça marche */}
        <section className="howto">
          <details open>
            <summary><img src={iconArt('seal')} alt="" /><span><b>Invoque</b><small>Obtiens de nouvelles cartes.</small></span><i aria-hidden="true" /></summary>
            <p>Choisis un Portail : une invocation coûte {COST.ticket} Clé de Faille ou {COST.gems} Éclats, par 1, 5 ou 10. Les taux sont publics (« Index et taux ») et chaque tirage est réellement aléatoire. Une carte SSR, LR ou MR est garantie au plus tard à la {PITY_MAX}e invocation.</p>
          </details>
          <details open>
            <summary><img src={iconArt('soul')} alt="" /><span><b>Gagne tes Éclats</b><small>Cumule des Éclats et invoque.</small></span><i aria-hidden="true" /></summary>
            <p>Tu commences avec 600 Éclats et 20 Clés de Faille. Chaque nouvelle étoile gagnée dans L’Aventure rapporte 10 Éclats, et l’Ascension rend 25 % de celles dépensées. Dépense-les avec soin.</p>
          </details>
          <details open>
            <summary><img src={iconArt('scroll-medium')} alt="" /><span><b>Renforce tes cartes</b><small>Fais évoluer tes cartes favorites.</small></span><i aria-hidden="true" /></summary>
            <p>Un doublon n'est jamais perdu : il se fond dans sa carte et lui donne de l'XP. Les parchemins d'XP se gagnent dans L’Aventure, et chaque victoire donne de l'XP à ton équipe. Une carte monte jusqu'au niveau {LEVEL_CAP}, puis jusqu'au niveau {MAX_LEVEL} une fois libérée.</p>
          </details>
        </section>
      </>}

      {showIndex && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Index du Portail" onClick={() => setShowIndex(false)}>
          <div className="modal__box index" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Index — {banner.world}</h2>
            <p className="modal__note">Les cartes SSR, LR et MR de l'univers {banner.world}, avec la chance exacte d'obtenir chacune en une invocation. Toutes les autres cartes des 7 univers (N, R, SR, et les SSR et LR des autres univers) peuvent aussi sortir sur ce Portail ; seules les MR restent propres à leur univers. Les cartes marquées ★ sont à l'affiche : elles sortent plus souvent que les autres cartes de leur rareté. Une carte SSR, LR ou MR est garantie au plus tard à la {PITY_MAX}e invocation.</p>
            {RARITY_ORDER.map((rid) => {
              const cards = indexCards(banner).filter((h) => h.rarity === rid)
              if (cards.length === 0) return null
              return (
                <section key={rid} className="index__group">
                  <header className="index__head" style={{ color: RARITIES[rid].color }}>
                    <b>{RARITIES[rid].short}</b><span>{RARITIES[rid].label}</span><em>{pct(RARITIES[rid].rate)}</em>
                  </header>
                  <div className="index__cards">
                    {cards.map((h) => (
                      <figure key={h.id} className="index__card">
                        <LazyCard hero={h} />
                        <figcaption>
                          <span>{banner.featured.includes(h.id) ? '★ ' : ''}{h.name}</span>
                          <b>{pct(cardRate(banner, h))}</b>
                          <small>1 sur {Math.round(1 / cardRate(banner, h)).toLocaleString('fr-FR')}</small>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )
            })}
            <button className="btn" onClick={() => setShowIndex(false)}>Fermer</button>
          </div>
        </div>,
        document.body,
      )}

      <Guide id="banners" />
      {rift !== null && <InvocationDemo banner={banner} count={rift} currency={currency} onClose={() => setRift(null)} />}
    </div>
  )
}
