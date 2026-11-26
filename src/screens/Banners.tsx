import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BANNERS, BIG_PITY, COST, PITY_MAX, type Banner } from '../data/banners'
import { heroById, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { extraArt, heroArt, iconArt } from '../assets/manifest'
import { HEROES } from '../data/heroes'
import { isPityRarity } from '../data/rarities'
import { LEVEL_CAP, MAX_LEVEL } from '../game/progression'
import { bannerPool, cardRate } from '../game/gacha'
import { Guide } from '../ui/Guide'
import { useStore, type Currency } from '../state/store'
import { Card, LazyCard } from '../ui/Card'
import { IconChevron, IconInfo } from '../ui/icons'
import { Coin } from '../ui/Coin'
import { SummonCinematic } from '../summon/SummonCinematic'
import { primeAudio } from '../summon/audio'

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

// Les deux garanties d'une bannière. Petite : une SSR ou mieux au plus tard à la 50e invocation.
// Grande : une MR au 30e multi ×10 d'affilée sans MR sur cette bannière.
const PityBar = ({ value, multis, banner }: { value: number; multis: number; banner: Banner }) => (
  <div className="pity" role="group" aria-label="Garanties">
    <div role="meter" aria-valuemin={0} aria-valuemax={PITY_MAX} aria-valuenow={value} aria-label="Garantie SSR ou mieux">
      <div className="pity__row">
        <span className="pity__label">Garantie SSR ou mieux</span>
        <b className="pity__count">{value}<i> / {PITY_MAX}</i></b>
      </div>
      <div className="pity__track"><i style={{ width: `${(value / PITY_MAX) * 100}%` }} /></div>
      <p className="pity__note">{value + 1 >= PITY_MAX ? 'La prochaine invocation est garantie SSR, LR ou MR.' : `Encore ${PITY_MAX - value} invocations au plus avant une carte SSR, LR ou MR garantie.`}</p>
    </div>
    <div className="pity__big" role="meter" aria-valuemin={0} aria-valuemax={BIG_PITY} aria-valuenow={multis} aria-label="Grande garantie MR">
      <div className="pity__row">
        <span className="pity__label">Grande garantie <b>MR</b></span>
        <b className="pity__count">{multis}<i> / {BIG_PITY} multis</i></b>
      </div>
      <ol className="pity__steps" aria-hidden="true">{Array.from({ length: BIG_PITY }, (_, i) => <li key={i} className={i < multis ? 'is-on' : ''} />)}</ol>
      <p className="pity__note">{multis + 1 >= BIG_PITY ? <>Ton prochain <b>×10</b> sur {banner.world} contient une carte MR garantie !</> : <>Encore {BIG_PITY - multis} invocations ×10 sur {banner.world} au plus avant une MR garantie. Le compteur repart à zéro quand une MR sort.</>}</p>
    </div>
  </div>
)

export const Banners = ({ onRebirth }: { onRebirth: () => void }) => {
  const store = useStore()
  const [index, setIndex] = useState(0)
  const [currency, setCurrency] = useState<Currency>('ticket')
  const [results, setResults] = useState<Hero[] | null>(null)
  const [showIndex, setShowIndex] = useState(false)
  const [focus, setFocus] = useState(false) // « Voir la bannière » : n'affiche plus que la bannière choisie
  const banner = BANNERS[index]
  const star = heroById(banner.star)
  const starArt = store.customArt[star.id] ?? store.remoteArt[star.id] ?? heroArt(star.model, 'full')
  const left = useCountdown(banner.endsAt)
  const pity = store.pity[banner.id]
  const coin = currency === 'ticket' ? 'seal' : 'soul'
  const price = (n: number) => n * (currency === 'ticket' ? COST.ticket : COST.gems)
  const turn = (step: number) => setIndex((i) => (i + step + BANNERS.length) % BANNERS.length)
  // Mes gros tirages : les cartes SSR, LR et MR réellement obtenues sur cet appareil, les plus récentes d'abord.
  const bigPulls = HEROES.filter((h) => isPityRarity(h.rarity))
    .flatMap((h) => (store.log[h.id] ?? []).filter((e) => e.k === 'pull').map((e) => ({ hero: h, t: e.t })))
    .sort((a, b) => b.t - a.t).slice(0, 12)
  const ago = (t: number) => {
    const m = Math.floor((Date.now() - t) / 60000)
    return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : `il y a ${Math.floor(m / 1440)} j`
  }
  const summon = (n: number) => {
    primeAudio() // le son n'est autorisé par le navigateur que pendant ce clic
    const r = store.summon(banner, currency, n) // le tirage réel : c'est lui qui fixe les raretés
    if (r) setResults(r)
  }

  return (
    <div className={`summon ${focus ? 'summon--focus' : ''}`} style={{ ['--hue' as string]: banner.hue }}>
      {focus && <button className="summon__back" onClick={() => { setFocus(false); window.scrollTo({ top: 0 }) }}>← Toutes les invocations</button>}
      {/* Affiche de la bannière */}
      <section className="poster" key={banner.id}>
        {store.bannerArt[banner.id] && <img className="poster__bg" src={store.bannerArt[banner.id]} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div className="poster__slash" aria-hidden="true" />
        <span className="poster__glyph" aria-hidden="true">{banner.glyph}</span>
        {starArt && <img className={`poster__art ${store.customArt[star.id] || store.remoteArt[star.id] ? 'poster__art--custom' : ''}`} src={starArt} alt={star.name} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div className="poster__text">
          <p className="poster__count"><b>{two(index + 1)}</b> / {two(BANNERS.length)} · Faille ouverte</p>
          <h1 className="poster__title">{banner.world}</h1>
          <p className="poster__sub">{banner.subtitle}</p>
          <div className="poster__chips">
            <span className="chip chip--time">Ferme dans <b>{left}</b></span>
            <span className="chip">MR {pct(RARITIES.rift.rate)} · LR {pct(RARITIES.legend.rate)}</span>
          </div>
        </div>
        {!focus && <button className="poster__nav poster__nav--prev" onClick={() => turn(-1)} aria-label="Bannière précédente"><IconChevron left /></button>}
        {!focus && <button className="poster__nav poster__nav--next" onClick={() => turn(1)} aria-label="Bannière suivante"><IconChevron /></button>}
      </section>

      {/* Choix de la bannière */}
      {!focus && <div className="rail" role="tablist" aria-label="Bannières">
        {BANNERS.map((b, i) => {
          const have = b.featured.filter((id) => store.owned[id]).length
          return (
            <button key={b.id} role="tab" aria-selected={i === index} className={`rail__item ${i === index ? 'is-active' : ''}`} style={{ ['--hue' as string]: b.hue }} onClick={() => setIndex(i)}>
              <img className="rail__emblem" src={extraArt(`emblem-${b.id}`)} alt="" />
              <span><b>{b.world}</b><small>{have}/{b.featured.length} cartes · pity {store.pity[b.id]}/{PITY_MAX}</small></span>
            </button>
          )
        })}
      </div>}

      {/* Cartes à l'affiche */}
      <section className="lineup">
        <header className="lineup__head">
          <h2>Cartes vedettes</h2>
          <button className="linkbtn" onClick={() => setShowIndex(true)}><IconInfo />Index et taux</button>
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
        </div>
        <ul className="owned-count">
          <li><b>{banner.featured.filter((id) => store.owned[id]).length}<i> / {banner.featured.length}</i></b><span>têtes d'affiche possédées</span></li>
          <li><b>{bannerPool(banner).filter((h) => store.owned[h.id]).length}<i> / {bannerPool(banner).length}</i></b><span>cartes de la bannière possédées</span></li>
        </ul>
        <PityBar value={pity} multis={store.multis[banner.id] ?? 0} banner={banner} />
        <div className="console__pulls">
          {[1, 5, 10].map((n) => (
            <button key={n} className={`pull ${n === 10 ? 'pull--gold' : ''}`} disabled={!store.canAfford(currency, n)} onClick={() => summon(n)}>
              <b>×{n}</b>
              <span><Coin name={coin} size={20} />{price(n)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Bannière seule : ses têtes d'affiche, une par une */}
      {focus && (
        <section className="heads">
          <header className="section__head"><span>{two(banner.featured.length)}</span><div><h2>Têtes d'affiche</h2><p>Les cartes les plus rares de la bannière {banner.world}.</p></div></header>
          {banner.featured.map((id) => {
            const h = heroById(id)
            const rate = cardRate(banner, h)
            return (
              <article key={id} className="head" style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>
                <div className="head__card"><Card hero={h} locked={!store.owned[id]} /></div>
                <div className="head__text">
                  <p className="head__kicker">Tête d'affiche · {RARITIES[h.rarity].short}</p>
                  <h3>{h.name} <i>({h.title})</i></h3>
                  <p className="head__desc">L'une des cartes les plus rares du jeu. Elle ne tombe que sur cette bannière. {store.owned[id] ? `Vous en possédez ${store.owned[id]}.` : 'Vous ne la possédez pas encore.'}</p>
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
          <header className="section__head"><span>{two(bannerPool(banner).length)}</span><div><h2>Toutes les cartes</h2><p>Touche une carte pour l'ouvrir. La chance indiquée est celle d'une invocation.</p></div></header>
          {RARITY_ORDER.map((rid) => {
            const cards = bannerPool(banner).filter((h) => h.rarity === rid)
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
          <h2>Les plus de la bannière</h2>
          <div className="bplus__box">
            <h3>Garantie SSR ou mieux</h3>
            <div className="pity__track"><i style={{ width: `${(pity / PITY_MAX) * 100}%` }} /></div>
            <p><b>{pity} / {PITY_MAX}</b> invocations. À la {PITY_MAX}e sans carte SSR, LR ou MR, la suivante en est une à coup sûr. Le compteur est propre à cette bannière.</p>
          </div>
          <div className="bplus__box">
            <h3>Taux par rareté</h3>
            <dl>{RARITY_ORDER.map((rid) => <div key={rid} style={{ ['--rc' as string]: RARITIES[rid].color }}><dt>{RARITIES[rid].short} <small>{RARITIES[rid].label}</small></dt><dd>{pct(RARITIES[rid].rate)}</dd></div>)}</dl>
            <button className="bplus__btn" onClick={() => setShowIndex(true)}>Index de la bannière</button>
          </div>
          <div className="bplus__box">
            <h3>Parchemins et âmes</h3>
            <p>Les invocations ne donnent que des cartes. Les parchemins d'XP et les âmes se gagnent dans La Saga.</p>
          </div>
        </section>
      )}

      {/* Toutes les bannières : informations, progression et carte vedette */}
      {!focus && <section className="showcase">
        <header className="section__head"><span>{two(BANNERS.length)}</span><div><h2>À l'affiche</h2><p>Les bannières ouvertes en ce moment.</p></div></header>
        <div className="showcase__list">
          {BANNERS.map((b, i) => {
            const s = heroById(b.star)
            const have = b.featured.filter((id) => store.owned[id]).length
            return (
              <article key={b.id} className={`show ${i === index ? 'is-current' : ''}`} style={{ ['--hue' as string]: b.hue }}>
                {store.bannerArt[b.id] && <img className="show__bg" src={store.bannerArt[b.id]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                <div className="show__top">
                  <span className="show__glyph" lang="ja" aria-hidden="true">{b.glyph}</span>
                  <div className="show__text">
                    <p className="show__kicker"><img className="show__emblem" src={extraArt(`emblem-${b.id}`)} alt="" />Bannière limitée</p>
                    <h3>{b.world}</h3>
                    <p className="show__star"><b>{RARITIES[s.rarity].short}</b>{s.name} ({s.title})</p>
                    <button className="show__link" onClick={() => { setIndex(i); setFocus(true); window.scrollTo({ top: 0 }) }}>Voir la bannière ↗</button>
                  </div>
                  <div className="show__card"><Card hero={s} /></div>
                </div>
                <div className="show__stats">
                  <div><span>Cartes à l'affiche possédées</span><b>{have} / {b.featured.length}</b><div className="bar"><i style={{ width: `${(have / b.featured.length) * 100}%` }} /></div></div>
                  <div><span>Pity SSR ou mieux</span><b>{store.pity[b.id]} / {PITY_MAX}</b><div className="bar"><i style={{ width: `${(store.pity[b.id] / PITY_MAX) * 100}%` }} /></div></div>
                </div>
              </article>
            )
          })}
        </div>
      </section>}

      {!focus && <>
        {/* Échos des failles : les anciennes bannières, rouvertes par la Renaissance */}
        <section className="echo">
          <header className="section__head"><span>00</span><div><h2>Échos des failles</h2><p>Les anciennes bannières, rouvertes après chaque Renaissance.</p></div></header>
          <div className="echo__box">
            <h3>{store.rebirths > 0 ? 'Débloqué par ta Renaissance' : 'Débloqué par la Renaissance'}</h3>
            <p>{store.rebirths > 0 ? 'Tu as accès aux Échos.' : 'Fais une Renaissance (niveau de compte 100) pour ouvrir les Échos.'} Les bannières qui ont fermé reviendront ici.</p>
            <button className="echo__btn" onClick={onRebirth}>Voir la Renaissance ↗</button>
          </div>
          <p className="echo__empty">Aucune bannière n'a encore fermé : il n'y a donc pas d'Écho pour l'instant. Les {BANNERS.length} bannières du jeu sont toutes ouvertes ci-dessus.</p>
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
            <p>Choisis une bannière : une invocation coûte {COST.ticket} sceau ou {COST.gems} âmes, par 1, 5 ou 10. Les taux sont publics (« Index et taux ») et chaque tirage est réellement aléatoire. Une carte SSR, LR ou MR est garantie au plus tard à la {PITY_MAX}e invocation.</p>
          </details>
          <details open>
            <summary><img src={iconArt('soul')} alt="" /><span><b>Gagne tes âmes</b><small>Cumule des âmes et invoque.</small></span><i aria-hidden="true" /></summary>
            <p>Tu commences avec 600 âmes et 20 sceaux. Chaque nouvelle étoile gagnée dans La Saga rapporte 10 âmes, et la Renaissance rend 25 % de celles dépensées. Dépense-les avec soin.</p>
          </details>
          <details open>
            <summary><img src={iconArt('scroll-medium')} alt="" /><span><b>Renforce tes cartes</b><small>Fais évoluer tes cartes favorites.</small></span><i aria-hidden="true" /></summary>
            <p>Un doublon n'est jamais perdu : il se fond dans sa carte et lui donne de l'XP. Les parchemins d'XP se gagnent dans La Saga, et chaque victoire donne de l'XP à ton équipe. Une carte monte jusqu'au niveau {LEVEL_CAP}, puis jusqu'au niveau {MAX_LEVEL} une fois libérée.</p>
          </details>
        </section>
      </>}

      {showIndex && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label="Index de la bannière" onClick={() => setShowIndex(false)}>
          <div className="modal__box index" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Index — {banner.world}</h2>
            <p className="modal__note">Toutes les cartes que cette bannière peut donner, avec la chance exacte d'obtenir chacune en une invocation. Les cartes marquées ★ sont à l'affiche : elles sortent plus souvent que les autres cartes de leur rareté. Une carte SSR, LR ou MR est garantie au plus tard à la {PITY_MAX}e invocation.</p>
            {RARITY_ORDER.map((rid) => {
              const cards = bannerPool(banner).filter((h) => h.rarity === rid)
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
      {results && createPortal(<SummonCinematic heroes={results} onClose={() => setResults(null)} />, document.body)}
    </div>
  )
}
