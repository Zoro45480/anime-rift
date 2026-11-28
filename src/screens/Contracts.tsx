import { cosmeticById } from '../game/cosmetics'
import { useEffect, useState } from 'react'
import { iconArt, uiArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { HEROES } from '../data/heroes'
import { RARITY_ORDER } from '../data/rarities'
import { CHALLENGE_TIMES, challengesFor, challengeState, DAILY_BONUS, DAILY_REWARDS, dailyContracts, dailyStatus, featuredWorld, isClaimed, msToDayEnd, msToWeekEnd, progress, STORY, CAREER, weeklyContracts, type Contract, type Reward } from '../game/contracts'
import { SCROLLS } from '../game/progression'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'
import { colossusOf, EVENT_GOALS, eventDone, rollCol } from '../game/colossus'
import { PVP_GOALS, rollWeek } from '../game/arena'
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
    {r.title && cosmeticById(r.title) ? <span className={`rw__title rw__title--${cosmeticById(r.title)!.rarity}`} title="Titre à afficher sur ton profil">Titre « {cosmeticById(r.title)!.name} »</span> : null}
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


// Icônes au trait des onglets (même style que le menu du haut).
const CT_ICON: Record<string, string> = {
  daily: 'M5 7h14v13H5zM5 11h14M9 4v5M15 4v5M12 14v3',
  contracts: 'M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Zm1 5h6m-6 4h4',
  rift: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5Z',
  path: 'M4 19c4 0 4-6 8-6s4-6 8-6M4 19h.01M20 7h.01M12 13h.01',
  day: 'M12 4v2m0 12v2M4 12h2m12 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  week: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M8 14h2m2 0h2m2 0h0M8 17h2m2 0h2',
  story: 'M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h11',
  career: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 2v4m-4 4h8m-6-4h4',
  pass: 'M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4v4Zm9-4v12',
  event: 'M12 3l3 6 6 .9-4.5 4.3 1 6.3L12 17.5 6.5 20.5l1-6.3L3 9.9 9 9Z',
  pvp: 'M5 5l9 9m-2 4 2-2 4 4 2-2-4-4 2-2M19 5l-9 9m2 4-2-2-4 4-2-2 4-4-2-2',
}
const CtIcon = ({ id }: { id: string }) => <svg className="ct-ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CT_ICON[id] ?? CT_ICON.contracts} /></svg>

type Tab = 'daily' | 'contracts' | 'rift' | 'path'
type Sub = 'day' | 'week' | 'story' | 'career' | 'pass' | 'event' | 'pvp'

export const Contracts = ({ start = 'daily' }: { start?: 'daily' | 'contracts' | 'rift' | 'path' }) => {
  const store = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>(start)
  const [sub, setSub] = useState<Sub>('day')
  const st = dailyStatus(store.quests.daily, now)
  const streak = st.claimed ? st.day : st.missed ? 0 : store.quests.daily.last ? store.quests.daily.streak : 0
  const daily = dailyContracts(now)
  const weekly = weeklyContracts(now)
  const passList = challengesFor(now)
  const col = rollCol(store.col, now)
  const pvpWeek = rollWeek(store.arena, now)
  const passReady = passList.filter((c) => challengeState(c, store.quests, now).ready).length
  const eventReady = eventDone(col) && !col.final ? 1 : 0
  const pvpReady = PVP_GOALS.filter((g) => !pvpWeek.claimed.includes(g.id) && g.value(store.arena, pvpWeek) >= g.target).length
  const readyIn = (list: Contract[]) => list.filter((c) => !isClaimed(c, store.quests, now) && progress(c, store.quests, store.saga, now) >= c.target).length
  const [prize, setPrize] = useState('')
  const contractsReady = readyIn([...daily, DAILY_BONUS, ...weekly, ...STORY, ...CAREER])
  const totalReady = contractsReady + passReady + pvpReady
  const claimEverything = () => {
    const total = store.claimEverything()
    if (total) setPrize(`${total} récompense${total > 1 ? 's' : ''} récupérée${total > 1 ? 's' : ''} d'un coup !`)
  }
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
        {([['daily', 'Chaque jour', st.claimed ? 0 : 1], ['contracts', 'Contrats', readyIn([...daily, DAILY_BONUS, ...weekly, ...STORY, ...CAREER]) + passReady + eventReady + pvpReady], ['rift', 'Chemin du Rift', claimableTiers(rollPath(store.path, now)).length + challengesFor(now).filter((c) => challengeState(c, store.quests, now).ready).length], ['path', 'Parcours', 0]] as [Tab, string, number][]).map(([id, label, dot]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><CtIcon id={id} />{label}{dot > 0 && <i className="dot" aria-label={`${dot} à récupérer`} />}</button>
        ))}
      </div>

      {tab === 'daily' && (
        <section className="dr">
          {st.missed && <p className="dr__alert" role="alert">Tu as manqué un jour : ta série repart au jour 1.</p>}
          <div className="dr__top">
            <div className="dr__streak"><svg className="dr__fire" viewBox="0 0 32 40" aria-hidden="true">
              <defs><linearGradient id="dr-fire-a" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff3d9a" /><stop offset=".55" stopColor="#ff7a2b" /><stop offset="1" stopColor="#ffd166" /></linearGradient>
                <linearGradient id="dr-fire-b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffd166" /><stop offset="1" stopColor="#fff6d8" /></linearGradient></defs>
              <path className="dr__fire-out" d="M16 1c1.5 6.5 9 9.6 9 19.5 0 2.2-.5 4-1.3 5.6 1.4-3.6.6-7.4-1.7-9.8.6 5.2-2.2 7.3-3.6 7.6 1.8-4.4-.4-9.8-4.6-12.5.8 5.6-4.9 9-4.9 14.9 0 1.6.4 3 1 4.2C7.7 28.4 6 25.4 6 21.7 6 13.4 15.4 9.6 16 1Z" fill="url(#dr-fire-a)" />
              <path className="dr__fire-in" d="M16.5 19c3.3 3.2 5.7 6 5.7 10.2a6.2 6.2 0 0 1-12.4 0c0-3 1.7-4.9 3.5-6.6.1 2 1.1 3.3 2.2 3.6-.6-2.6.1-5 1-7.2Z" fill="url(#dr-fire-b)" />
            </svg><b>{streak}</b><span>jour{streak > 1 ? 's' : ''} d'affilée</span></div>
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
            {([['day', 'Quotidiennes', readyIn([...daily, DAILY_BONUS])], ['week', 'Hebdomadaires', readyIn(weekly)], ['story', 'Histoire', readyIn(STORY)], ['career', 'Carrière', readyIn(CAREER)], ['pass', 'Défis du pass', passReady], ['event', 'Événement', eventReady], ['pvp', 'PvP', pvpReady]] as [Sub, string, number][]).map(([id, label, dot]) => (
              <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'is-on' : ''} onClick={() => setSub(id)}><CtIcon id={id} />{label}{dot > 0 && <i className="dot" />}</button>
            ))}
          </div>
          {totalReady > 0 && <div className="claim-all"><span><b>{totalReady}</b> récompense{totalReady > 1 ? 's' : ''} à récupérer dans tous les contrats</span>
            <button className="btn btn--gold" onClick={claimEverything}>Tout récupérer ({totalReady})</button></div>}
          {prize && sub !== 'event' && <p className="cd__notice" role="status">{prize}</p>}
          {sub === 'day' && <>
            <p className="cn__meta">Univers du jour : <b>{featuredWorld(now)}</b> · de nouvelles quêtes chaque jour, les prochaines dans <b>{clock(msToDayEnd(now))}</b></p>
            <ul>{daily.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
            <ul className="cn__bonus"><Row c={DAILY_BONUS} now={now} /></ul>
          </>}
          {sub === 'week' && <>
            <p className="cn__meta">{weekly.length} quêtes, renouvelées chaque lundi · dans <b>{clock(msToWeekEnd(now))}</b></p>
            <ul>{weekly.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
          </>}
          {sub === 'story' && <>
            <p className="cn__meta">Récompenses uniques, gagnées en avançant dans L’Aventure.</p>
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
          {sub === 'career' && <>
            <p className="cn__meta">Des paliers à vie : chaque quête de carrière se récupère une seule fois. {CAREER.filter((c) => isClaimed(c, store.quests, now)).length} / {CAREER.length} récupérées.</p>
            <ul>{CAREER.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
          </>}
          {sub === 'pass' && <>
            <p className="cn__meta">Les défis de la saison du Chemin du Rift : ils changent quand le pass se termine. Chacun se refait {CHALLENGE_TIMES} fois par jour et donne de l'XP de pass.</p>
            <ul>{passList.map((c) => {
              const st = challengeState(c, store.quests, now)
              return (
                <li key={c.id} className={`ct ${st.ready ? 'is-ready' : ''} ${st.finished ? 'is-done' : ''}`}>
                  <div className="ct__main"><b>{c.title}</b><div className="ct__bar"><i style={{ width: `${st.finished ? 100 : (st.value / c.target) * 100}%` }} /></div><small>{st.finished ? 'Terminé pour aujourd’hui' : `${n(st.value)} / ${n(c.target)}`} · {st.done} / {CHALLENGE_TIMES} aujourd'hui</small></div>
                  <span className="rw"><span>+{c.xp} XP</span><span><Coin name="soul" size={18} />{c.gems}</span></span>
                  {st.finished ? <span className="ct__state">✓ {CHALLENGE_TIMES} / {CHALLENGE_TIMES}</span> : st.ready ? <button className="ct__claim" onClick={() => store.claimChallenge(c.id)}>Récupérer</button> : <span className="ct__state">En cours · {Math.floor((st.value / c.target) * 100)} %</span>}
                </li>
              )
            })}</ul>
          </>}
          {sub === 'event' && <>
            <p className="cn__meta">L'événement de la semaine : le Colosse <b>{colossusOf(now).boss.name}</b> · fin dans <b>{clock(msToWeekEnd(now))}</b></p>
            <ul>{EVENT_GOALS.map((g) => { const v = Math.min(g.target, g.value(col)); return (
              <li key={g.id} className={`ct ${v >= g.target ? 'is-done' : ''}`}><div className="ct__main"><b>{g.title}</b><div className="ct__bar"><i style={{ width: `${(v / g.target) * 100}%` }} /></div><small>{v} / {g.target}</small></div><span className="ct__state">{v >= g.target ? '✓ Fait' : `En cours · ${Math.floor((v / g.target) * 100)} %`}</span></li>
            ) })}</ul>
            <ul className="cn__bonus"><li className={`ct ${eventReady ? 'is-ready' : ''} ${col.final ? 'is-done' : ''}`}><div className="ct__main"><b>Termine toutes les quêtes de l'événement</b><small>Récompense : une carte SR ou mieux garantie</small></div>
              {col.final ? <span className="ct__state">✓ Récupéré</span> : eventReady ? <button className="ct__claim" onClick={() => { const c = store.claimEvent(); if (c) setPrize(`${c.name} rejoint ta collection !`) }}>Récupérer</button> : <span className="ct__state">À venir</span>}</li></ul>
            {prize && <p className="cd__notice" role="status">{prize}</p>}
          </>}
          {sub === 'pvp' && <>
            <p className="cn__meta">Les défis d'Arène de la semaine · renouvelés lundi, dans <b>{clock(msToWeekEnd(now))}</b></p>
            <ul>{PVP_GOALS.map((g) => { const v = Math.min(g.target, g.value(store.arena, pvpWeek)), done = pvpWeek.claimed.includes(g.id), ready = !done && v >= g.target; return (
              <li key={g.id} className={`ct ${ready ? 'is-ready' : ''} ${done ? 'is-done' : ''}`}><div className="ct__main"><b>{g.title}</b><div className="ct__bar"><i style={{ width: `${(v / g.target) * 100}%` }} /></div><small>{n(v)} / {n(g.target)}</small></div>
                <span className="rw"><span><Coin name="soul" size={18} />{g.gems}</span>{g.tickets ? <span><Coin name="seal" size={18} />{g.tickets}</span> : null}</span>
                {done ? <span className="ct__state">✓ Récupéré</span> : ready ? <button className="ct__claim" onClick={() => store.claimPvp(g.id)}>Récupérer</button> : <span className="ct__state">En cours · {Math.floor((v / g.target) * 100)} %</span>}</li>
            ) })}</ul>
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
              [uiArt('nav-cards'), 'Univers complétés', `${worldsDone} / ${BANNERS.length}`], [iconArt('scroll-medium'), 'Doublons fusionnés', n(life.merges ?? 0)], [iconArt('soul'), 'Éclats dépensées', n(Math.max(store.gemsSpent, life.gemsSpent ?? 0))],
              [uiArt('role-dps'), 'Combats gagnés', n(store.wins)], [uiArt('floor-boss'), 'Boss battus', n(life.bosses ?? 0)], [uiArt('floor-plate'), 'Meilleur étage de La Tour de l’Infini', n(store.spire.best)],
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
