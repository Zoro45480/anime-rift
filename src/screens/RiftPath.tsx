import { useEffect, useRef, useState } from 'react'
import { iconArt, uiArt } from '../assets/manifest'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { BANNERS } from '../data/banners'
import { premiumReward, CARD_ODDS, claimableTiers, PATH_XP, rollPath, seasonOf, TIER_REWARDS, TIER_XP, tierOf, TIERS, type PathReward } from '../game/riftpath'
import { SCROLLS } from '../game/progression'
import { challengesFor, CHALLENGE_TIMES, challengeState, msToDayEnd } from '../game/contracts'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'

const left = (ms: number) => {
  const h = Math.max(0, Math.floor(ms / 3600000))
  return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`
}

// Ce que donne un palier, en une ligne d'objets.
const Loot = ({ r, big }: { r: PathReward; big?: boolean }) => (
  <span className={`pt-loot ${big ? 'pt-loot--big' : ''}`}>
    {r.card && <span className="pt-loot__card"><img src={uiArt('card-pack')} alt="" /><b>Carte SR+</b></span>}
    {r.gems ? <span><Coin name="soul" size={20} />{big ? '' : '×'}{r.gems}</span> : null}
    {r.energy ? <span><Coin name="bolt" size={20} />{big ? '' : '×'}{r.energy}</span> : null}
    {r.tickets ? <span><Coin name="seal" size={20} />{big ? '' : '×'}{r.tickets}</span> : null}
    {r.shards ? <span><img src={iconArt('shard')} alt="" />{r.shards}</span> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <span key={k} title={SCROLLS[k as 'small'].label}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" />{big ? '' : '×'}{v}</span>)}
  </span>
)

export const RiftPath = ({ now }: { now: Date }) => {
  const store = useStore()
  const path = rollPath(store.path, now)
  const season = seasonOf(now)
  const seasonWorld = BANNERS[(season.number - 1) % BANNERS.length]
  const tier = tierOf(path.xp)
  const ready = claimableTiers(path)
  const inTier = tier >= TIERS ? TIER_XP : path.xp % TIER_XP
  const [cards, setCards] = useState<Hero[]>([])
  const track = useRef<HTMLOListElement>(null)

  // Ouvre la piste sur le prochain palier à récupérer, ou sur le palier en cours.
  const focus = (t: number) => {
    const el = track.current?.querySelector<HTMLElement>(`[data-tier="${Math.min(TIERS, Math.max(1, t))}"]`)
    if (el && track.current) track.current.scrollTo({ left: el.offsetLeft - track.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }
  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(`[data-tier="${Math.max(1, ready[0] ?? Math.min(TIERS, tier + 1))}"]`)
    if (el && track.current) track.current.scrollLeft = el.offsetLeft - track.current.clientWidth / 2 + el.clientWidth / 2
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const slide = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' })
  const claim = (t: number) => { const r = store.claimTier(t); if (r && r !== true) setCards([r]) }
  const claimAll = () => { const got = store.claimAllTiers(); if (got.length) setCards(got); focus(tier + 1) }

  return (
    <section className="pt" style={{ ['--season' as string]: season.hue }}>
      <header className="pt__hero">
        {store.bannerArt[seasonWorld.id] && <img className="pt__hero-bg" src={store.bannerArt[seasonWorld.id]} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div className="pt__hero-text">
          <h2><img src={uiArt('crown')} alt="" />Chemin du Rift</h2>
          <p className="pt__ribbon">Saison {season.number} · {season.name}</p>
        </div>
        <div className="pt__end"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><div><small>Fin de saison dans</small><b>{left(season.msLeft)}</b></div></div>
      </header>

      <div className="pt__free"><img src={uiArt('rift-path')} alt="" /><div><b>Piste gratuite ouverte à tous</b><p>Chaque palier atteint donne sa récompense. Avance en faisant tes contrats, tes défis de saison, en combattant et en invoquant.</p></div>{ready.length > 0 && <button className="pt__all" onClick={claimAll}>Tout récupérer ({ready.length})</button>}</div>

      <div className="pt__duo">
        <section className="pt__prog2">
          <div className="pt__lvl2"><small>Niveau</small><b>{tier}</b></div>
          <div className="pt__xp2"><small>Progression</small><b>{tier >= TIERS ? 'Terminé !' : `${inTier} / ${TIER_XP} XP`}</b><div className="pt__bar"><i style={{ width: `${(inTier / TIER_XP) * 100}%` }} /></div></div>
          <div className="pt__next"><small>Prochaine récompense</small>{tier < TIERS ? <Loot r={TIER_REWARDS[tier]} /> : <b>—</b>}
            <p className="pt__wait"><b>{ready.length} palier{ready.length > 1 ? 's' : ''} t'attend{ready.length > 1 ? 'ent' : ''}</b><span>{ready.length ? 'Touche « Récupérer » sur la piste ou « Tout récupérer ».' : 'Fais tes quêtes de saison pour avancer.'}</span></p>
          </div>
        </section>
        <section className="pt__prem">
          <h3><img src={uiArt('crown')} alt="" />Pass premium</h3>
          <p className="pt__prem-sub">Une 2e récompense à chaque palier</p>
          <p className="pt__prem-txt">Valable toute la saison {season.number}. Tu peux déjà voir ses récompenses sur la piste ci-dessous.</p>
          <button className="pt__prem-btn" disabled>Bientôt disponible</button>
          <small>Le premium demande un vrai paiement en ligne, donc un serveur : il n'est pas encore achetable.</small>
        </section>
      </div>

      <div className="pt__head2">
        <div><h3>Les paliers</h3><p>Un palier tous les {TIER_XP} XP. La récompense premium s'ajoutera à la gratuite.</p></div>
        <p className="pt__legend"><span className="is-done">Récupéré</span><span className="is-ready">Prêt</span><span className="is-next">À venir</span></p>
        <div className="pt__arrows"><button onClick={() => slide(-1)} aria-label="Paliers précédents">‹</button><button onClick={() => slide(1)} aria-label="Paliers suivants">›</button></div>
      </div>
      <div className="pt__board">
        <div className="pt__rows"><span>Gratuit</span><span className="is-prem"><img src={uiArt('crown')} alt="" />Premium</span></div>
        <ol className="pt__track2" ref={track} aria-label="Paliers de la saison">
          {TIER_REWARDS.map((r, i) => {
            const t = i + 1
            const state = path.claimed.includes(t) ? 'done' : t <= tier ? 'ready' : 'next'
            return (
              <li key={t} data-tier={t} className={`pt-col pt-col--${state} ${t % 10 === 0 ? 'pt-col--big' : ''}`}>
                <span className="pt-col__no">{t}</span>
                <div className="pt-col__free"><Loot r={r} big={t % 10 === 0} />{state === 'ready' ? <button onClick={() => claim(t)}>Récupérer</button> : <small>{state === 'done' ? '✓ Récupéré' : '🔒'}</small>}</div>
                <div className="pt-col__prem"><Loot r={premiumReward(t)} big={t % 10 === 0} /><small>🔒 Premium</small></div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="pt__ch">
        {challengesFor(now).some((c) => challengeState(c, store.quests, now).ready) && <div className="claim-all"><span>Des défis de saison sont prêts.</span>
          <button className="btn btn--gold" onClick={() => store.claimAllChallenges()}>Tout récupérer ({challengesFor(now).filter((c) => challengeState(c, store.quests, now).ready).length})</button></div>}
        <h3 className="pt__qtitle">Quêtes de saison <small>Les quêtes de la saison changent quand le pass se termine (dans {left(season.msLeft)}). Chacune se refait {CHALLENGE_TIMES} fois par jour · compteurs remis à zéro dans {left(msToDayEnd(now))}</small></h3>
        <ul>
          {challengesFor(now).map((c) => {
            const st = challengeState(c, store.quests, now)
            return (
              <li key={c.id} className={`ct ${st.ready ? 'is-ready' : ''} ${st.finished ? 'is-done' : ''}`}>
                <div className="ct__main">
                  <b>{c.title}</b>
                  <div className="ct__bar"><i style={{ width: `${st.finished ? 100 : (st.value / c.target) * 100}%` }} /></div>
                  <small>{st.finished ? 'Terminé pour aujourd’hui' : `${st.value.toLocaleString('fr-FR')} / ${c.target.toLocaleString('fr-FR')}`} · <span className="pt__times">{Array.from({ length: CHALLENGE_TIMES }, (_, i) => <i key={i} className={i < st.done ? 'is-on' : ''} />)}</span></small>
                </div>
                <span className="rw"><span className="pt__xpchip">+{c.xp} XP</span><span><Coin name="soul" size={18} />{c.gems}</span></span>
                {st.finished ? <span className="ct__state">✓ {CHALLENGE_TIMES} / {CHALLENGE_TIMES}</span>
                  : st.ready ? <button className="ct__claim" onClick={() => store.claimChallenge(c.id)}>Récupérer</button>
                    : <span className="ct__state">{st.done} / {CHALLENGE_TIMES}</span>}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="pt__how">
        <h3>Comment avancer</h3>
        <ul>
          {([['Récompense du jour', PATH_XP.daily], ['Contrat du jour récupéré', PATH_XP.dayContract], ['Bonus « tous les contrats du jour »', PATH_XP.dayBonus], ['Contrat de la semaine récupéré', PATH_XP.weekContract],
            ["Contrat d'histoire récupéré", PATH_XP.storyContract], ['Combat gagné', PATH_XP.win], ['Invocation', PATH_XP.pull], ['Étage de La Tour de l’Infini', PATH_XP.floor]] as [string, number][])
            .map(([label, xp]) => <li key={label}><span>{label}</span><b>+{xp} XP</b></li>)}
        </ul>
        <p className="set__note">Un palier tous les {TIER_XP} XP. Tous les 10 paliers : une carte ({CARD_ODDS.map(([id, p]) => `${RARITIES[id].short} ${Math.round(p * 100)} %`).join(', ')}), 10 sceaux et un grand parchemin. À la fin de la saison, le chemin repart de zéro avec un nouveau thème : récupère tes récompenses avant !</p>
      </div>

      {cards.length > 0 && (
        <div className="pt-reveal" role="dialog" aria-modal="true" aria-label="Nouvelle carte" onClick={() => setCards([])}>
          <div className="pt-reveal__box" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Chemin du Rift</p>
            <h3>{cards.length > 1 ? 'Nouvelles cartes !' : 'Nouvelle carte !'}</h3>
            <div className="pt-reveal__cards">{cards.map((h, i) => <Card key={`${h.id}-${i}`} hero={h} />)}</div>
            <button className="btn btn--gold" onClick={() => setCards([])}>Super !</button>
          </div>
        </div>
      )}
    </section>
  )
}
