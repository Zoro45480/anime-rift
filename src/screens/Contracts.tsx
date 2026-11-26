import { useEffect, useState } from 'react'
import { iconArt, uiArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { HEROES } from '../data/heroes'
import { RARITY_ORDER } from '../data/rarities'
import { challengesFor, challengeState, DAILY_BONUS, DAILY_REWARDS, dailyContracts, dailyStatus, featuredWorld, isClaimed, msToDayEnd, msToWeekEnd, progress, STORY, WEEKLY, type Contract, type Reward } from '../game/contracts'
import { SCROLLS } from '../game/progression'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'
import { RiftPath } from './RiftPath'
import { claimableTiers, rollPath } from '../game/riftpath'

const n = (x: number) => x.toLocaleString('fr-FR')
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return d ? `${d} j ${h} h ${m} min` : `${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s`
}
const useNow = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return now
}

// Récompenses d'un contrat, en pastilles avec leur objet.
const Rewards = ({ r }: { r: Reward }) => (
  <span className="rw">
    {r.gems ? <span><Coin name="soul" size={18} />{n(r.gems)}</span> : null}
    {r.energy ? <span><Coin name="bolt" size={18} />{r.energy}</span> : null}
    {r.tickets ? <span><Coin name="seal" size={18} />{r.tickets}</span> : null}
    {r.shards ? <span><img src={iconArt('shard')} alt="" />{r.shards}</span> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <span key={k} title={SCROLLS[k as 'small'].label}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" />{v}</span>)}
  </span>
)

const Row = ({ c, now }: { c: Contract; now: Date }) => {
  const store = useStore()
  const value = Math.min(c.target, progress(c, store.quests, store.saga, now))
  const done = isClaimed(c, store.quests, now)
  const ready = !done && value >= c.target
  return (
    <li className={`ct ${ready ? 'is-ready' : ''} ${done ? 'is-done' : ''}`}>
      <div className="ct__main">
        <b>{c.title}</b>
        <div className="ct__bar"><i style={{ width: `${(value / c.target) * 100}%` }} /></div>
        <small>{n(value)} / {n(c.target)}</small>
      </div>
      <Rewards r={c.reward} />
      {done ? <span className="ct__state">✓ Récupéré</span>
        : ready ? <button className="ct__claim" onClick={() => store.claimContract(c.id)}>Récupérer</button>
          : <span className="ct__state">En cours · {Math.floor((value / c.target) * 100)} %</span>}
    </li>
  )
}

type Tab = 'daily' | 'contracts' | 'rift' | 'path'
type Sub = 'day' | 'week' | 'story'

export const Contracts = ({ start = 'daily' }: { start?: 'daily' | 'contracts' | 'rift' | 'path' }) => {
  const store = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>(start)
  const [sub, setSub] = useState<Sub>('day')
  const st = dailyStatus(store.quests.daily, now)
  const streak = st.claimed ? st.day : st.missed ? 0 : store.quests.daily.last ? store.quests.daily.streak : 0
  const daily = dailyContracts(now)
  const readyIn = (list: Contract[]) => list.filter((c) => !isClaimed(c, store.quests, now) && progress(c, store.quests, store.saga, now) >= c.target).length
  const mine = HEROES.filter((h) => store.owned[h.id])
  const best = [...mine].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.no - b.no)[0]
  const life = store.quests.life
  const bestArt = best ? store.customArt[best.id] ?? store.remoteArt[best.id] : undefined
  const worldsDone = BANNERS.filter((b) => HEROES.filter((h) => h.world === b.world).every((h) => store.owned[h.id])).length

  return (
    <div className="cn">
      <header className="cn__head">
        <img src={uiArt('nav-contracts')} alt="" />
        <div><p className="eyebrow">Tes objectifs</p><h1>Contrats</h1><p>Accomplis-les en jouant, puis récupère tes récompenses.</p></div>
      </header>
      <div className="coltabs__bar" role="tablist" aria-label="Sections des contrats">
        {([['daily', 'Chaque jour', st.claimed ? 0 : 1], ['contracts', 'Contrats', readyIn([...daily, DAILY_BONUS, ...WEEKLY, ...STORY])], ['rift', 'Chemin du Rift', claimableTiers(rollPath(store.path, now)).length + challengesFor(now).filter((c) => challengeState(c, store.quests, now).ready).length], ['path', 'Parcours', 0]] as [Tab, string, number][]).map(([id, label, dot]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}{dot > 0 && <i className="dot" aria-label={`${dot} à récupérer`} />}</button>
        ))}
      </div>

      {tab === 'daily' && (
        <section className="dr">
          {st.missed && <p className="dr__alert" role="alert">Tu as manqué un jour : ta série repart au jour 1.</p>}
          <div className="dr__top">
            <div className="dr__streak"><span className="dr__flame" aria-hidden="true" /><b>{streak}</b><span>jour{streak > 1 ? 's' : ''} d'affilée</span></div>
            <div className="dr__clock"><small>Fin de la journée dans</small><b>{clock(msToDayEnd(now))}</b></div>
          </div>
          <ol className="dr__days">
            {DAILY_REWARDS.map((r, i) => {
              const day = i + 1
              const state = day < st.day || (day === st.day && st.claimed) ? 'done' : day === st.day ? 'today' : 'next'
              return (
                <li key={day} className={`dr__day dr__day--${state} ${day === 7 ? 'dr__day--chest' : ''}`}>
                  <small>Jour {day}</small>
                  {day === 7 ? <img className="dr__chest" src={uiArt('chest')} alt="Coffre" /> : null}
                  <Rewards r={r} />
                  {state === 'done' && <i className="dr__tick" aria-label="Récupéré">✓</i>}
                </li>
              )
            })}
          </ol>
          <button className="btn btn--gold dr__claim" disabled={st.claimed} onClick={store.claimDaily}>
            {st.claimed ? (st.day < 7 ? `Récupéré · reviens demain pour le jour ${st.day + 1}` : 'Coffre récupéré · une nouvelle série commence demain') : `Récupérer le jour ${st.day}`}
          </button>
          <p className="set__note">Reviens chaque jour : la série avance d'un jour à chaque récompense. Si tu manques un jour, elle repart au jour 1. Le 7e jour ouvre un coffre.</p>
        </section>
      )}

      {tab === 'contracts' && (
        <section className="cn__list">
          <div className="pe__kinds" role="tablist" aria-label="Sortes de contrats">
            {([['day', 'Quotidiens', readyIn([...daily, DAILY_BONUS])], ['week', 'Hebdomadaires', readyIn(WEEKLY)], ['story', 'Histoire', readyIn(STORY)]] as [Sub, string, number][]).map(([id, label, dot]) => (
              <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'is-on' : ''} onClick={() => setSub(id)}>{label}{dot > 0 && <i className="dot" />}</button>
            ))}
          </div>
          {sub === 'day' && <>
            <p className="cn__meta">Univers du jour : <b>{featuredWorld(now)}</b> · de nouvelles quêtes chaque jour, les prochaines dans <b>{clock(msToDayEnd(now))}</b></p>
            <ul>{daily.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
            <ul className="cn__bonus"><Row c={DAILY_BONUS} now={now} /></ul>
          </>}
          {sub === 'week' && <>
            <p className="cn__meta">Renouvelés le lundi · dans <b>{clock(msToWeekEnd(now))}</b></p>
            <ul>{WEEKLY.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
          </>}
          {sub === 'story' && <>
            <p className="cn__meta">Récompenses uniques, gagnées en avançant dans La Saga.</p>
            {BANNERS.map((b, arc) => {
              const list = STORY.filter((c) => c.arc === arc)
              return (
                <div key={b.id} className="cn__arc" style={{ ['--hue' as string]: b.hue }}>
                  <h3>{b.world} <small>{list.filter((c) => isClaimed(c, store.quests, now)).length} / {list.length}</small></h3>
                  <ul>{list.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
                </div>
              )
            })}
          </>}
        </section>
      )}

      {tab === 'rift' && <RiftPath now={now} />}

      {tab === 'path' && (
        <section className="cn__path pc">
          <div className="pc__main">
            {bestArt && <img className="pc__art" src={bestArt} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
            {!bestArt && best && <div className="pc__card"><Card hero={best} inert /></div>}
            <div className="pc__text">
              <h3>Collection</h3>
              <p className="pc__count"><b>{n(mine.length)}</b> / {n(HEROES.length)}</p>
              <div className="pc__bar"><i style={{ width: `${Math.max(1, (mine.length / HEROES.length) * 100)}%` }} /></div>
              <p className="pc__best">Meilleur tirage : <b>{best ? best.name : '—'}</b></p>
            </div>
          </div>
          <ul className="pc__grid">
            {([[uiArt('nav-summon'), 'Invocations', n(store.pulls)], [uiArt('card-pack'), 'Cartes MR', n(mine.filter((h) => h.rarity === 'rift').length)], [uiArt('card-pack'), 'Cartes LR', n(mine.filter((h) => h.rarity === 'legend').length)],
              [uiArt('nav-cards'), 'Univers complétés', `${worldsDone} / ${BANNERS.length}`], [iconArt('scroll-medium'), 'Doublons fusionnés', n(life.merges ?? 0)], [iconArt('soul'), 'Âmes dépensées', n(Math.max(store.gemsSpent, life.gemsSpent ?? 0))],
              [uiArt('role-dps'), 'Combats gagnés', n(store.wins)], [uiArt('floor-boss'), 'Boss battus', n(life.bosses ?? 0)], [uiArt('floor-plate'), 'Meilleur étage de La Spire', n(store.spire.best)],
              [uiArt('role-hybrid'), 'Dégâts infligés', n(life.damage ?? 0)], [iconArt('scroll-large'), 'Niveaux gagnés', n(life.levels ?? 0)], [uiArt('chest'), 'Récompenses du jour', n(life.dailies ?? 0)]] as [string, string, string][])
              .map(([icon, label, value]) => <li key={label}><img src={icon} alt="" /><b>{value}</b><span>{label}</span></li>)}
          </ul>
          <p className="set__note">Les doublons fusionnés, les boss, les dégâts et les niveaux sont comptés depuis l'arrivée des Contrats.</p>
        </section>
      )}
      <Guide id="contracts" />
    </div>
  )
}
