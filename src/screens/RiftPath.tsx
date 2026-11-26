import { useEffect, useRef, useState } from 'react'
import { iconArt, uiArt } from '../assets/manifest'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { CARD_ODDS, claimableTiers, PATH_XP, rollPath, seasonOf, TIER_REWARDS, TIER_XP, tierOf, TIERS, type PathReward } from '../game/riftpath'
import { SCROLLS } from '../game/progression'
import { CHALLENGES, CHALLENGE_TIMES, challengeState, msToDayEnd } from '../game/contracts'
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

const lootText = (r: PathReward) => [r.card && 'une carte SR ou mieux', r.gems && `${r.gems} âmes`, r.energy && `${r.energy} éclairs`, r.tickets && `${r.tickets} sceaux`, r.shards && `${r.shards} fragments`,
  ...Object.entries(r.scrolls ?? {}).map(([k, v]) => `${v} ${SCROLLS[k as 'small'].label.toLowerCase()}`)].filter(Boolean).join(', ')

export const RiftPath = ({ now }: { now: Date }) => {
  const store = useStore()
  const path = rollPath(store.path, now)
  const season = seasonOf(now)
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
      <header className="pt__season">
        <img src={uiArt('rift-path')} alt="" />
        <div>
          <p className="eyebrow">Chemin du Rift · saison {season.number}</p>
          <h2>{season.name}</h2>
          <p className="pt__end">Fin de la saison dans <b>{left(season.msLeft)}</b></p>
        </div>
      </header>

      <div className="pt__prog">
        <div className="pt__lvl"><small>Palier</small><b>{tier}</b><small>/ {TIERS}</small></div>
        <div className="pt__xp">
          <div className="pt__bar"><i style={{ width: `${(inTier / TIER_XP) * 100}%` }} /></div>
          <p>{tier >= TIERS ? 'Chemin terminé, bravo !' : <>{inTier} / {TIER_XP} XP · prochaine récompense : <b>{lootText(TIER_REWARDS[tier])}</b></>}</p>
        </div>
        {ready.length > 0 && <button className="pt__all" onClick={claimAll}>Tout récupérer ({ready.length})</button>}
      </div>

      <div className="pt__rail">
        <button className="pt__arrow" onClick={() => slide(-1)} aria-label="Paliers précédents">‹</button>
        <ol className="pt__track" ref={track} aria-label="Paliers de la saison">
          {TIER_REWARDS.map((r, i) => {
            const t = i + 1
            const state = path.claimed.includes(t) ? 'done' : t <= tier ? 'ready' : 'next'
            return (
              <li key={t} data-tier={t} className={`pt-tier pt-tier--${state} ${t % 10 === 0 ? 'pt-tier--big' : t % 5 === 0 ? 'pt-tier--mid' : ''}`}>
                <span className="pt-tier__no">{t}</span>
                <div className="pt-tier__box">
                  <Loot r={r} big={t % 10 === 0} />
                  {state === 'ready' ? <button onClick={() => claim(t)}>Récupérer</button> : <small>{state === 'done' ? '✓ Récupéré' : 'À venir'}</small>}
                </div>
              </li>
            )
          })}
        </ol>
        <button className="pt__arrow" onClick={() => slide(1)} aria-label="Paliers suivants">›</button>
      </div>
      <p className="pt__legend"><span className="is-done">Récupéré</span><span className="is-ready">Prêt</span><span className="is-next">À venir</span></p>

      <div className="pt__ch">
        <h3>Défis du Chemin <small>chacun {CHALLENGE_TIMES} fois par jour · nouveaux dans {left(msToDayEnd(now))}</small></h3>
        <ul>
          {CHALLENGES.map((c) => {
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
            ["Contrat d'histoire récupéré", PATH_XP.storyContract], ['Combat gagné', PATH_XP.win], ['Invocation', PATH_XP.pull], ['Étage de La Spire', PATH_XP.floor]] as [string, number][])
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
