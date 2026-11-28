import { cosmeticById } from '../game/cosmetics'
import { useEffect, useState } from 'react'
import { iconArt, uiArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { HEROES } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { CHALLENGE_TIMES, challengesFor, challengeState, DAILY_BONUS, DAILY_REWARDS, dailyContracts, dailyStatus, featuredWorld, isClaimed, msToDayEnd, msToWeekEnd, progress, STORY, CAREER, COLLECTION, weeklyContracts, type Contract, type Reward } from '../game/contracts'
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
const useNow = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return now
}

const LR_TICKET = Object.values(import.meta.glob('../assets/referral/ticket_LR.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)[0]
// Récompenses d'une mission : la principale en gros (Éclats, carte garantie, Multi ×10, Ticket LR…), puis +3 éclairs.
const Rewards = ({ r }: { r: Reward }) => (
  <span className="rw">
    {r.gems ? <span className="rw__main"><Coin name="soul" size={20} />+{n(r.gems)}</span> : null}
    {r.sure ? <span className="rw__sure"><b className={`rw__rar rw__rar--${r.sure}`}>{RARITIES[r.sure].short}</b>garantie</span> : null}
    {r.multi ? <span className="rw__item"><Coin name="seal" size={18} /><b>×{r.multi}</b>Multi ×10</span> : null}
    {r.lr ? <span className="rw__item"><img src={LR_TICKET} alt="" /><b>×{r.lr}</b>Ticket LR</span> : null}
    {r.tickets ? <span className="rw__item"><Coin name="seal" size={18} /><b>×{r.tickets}</b></span> : null}
    {r.shards ? <span className="rw__item"><img src={iconArt('shard')} alt="" /><b>×{r.shards}</b></span> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <span key={k} className="rw__item" title={SCROLLS[k as 'small'].label}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" /><b>×{v}</b></span>)}
    {r.title && cosmeticById(r.title) ? <span className={`rw__title rw__title--${cosmeticById(r.title)!.rarity}`} title="Titre à afficher sur ton profil">Titre « {cosmeticById(r.title)!.name} »</span> : null}
    {r.energy ? <span className="rw__bolt"><Coin name="bolt" size={15} />+{r.energy}</span> : null}
  </span>
)
const rewardText = (r: Reward) => [r.gems && `${n(r.gems)} Éclats`, r.sure && `${RARITIES[r.sure].short} garantie`, r.multi && `${r.multi} Multi ×10`, r.lr && `${r.lr} Ticket LR`, r.tickets && `${r.tickets} clé${r.tickets > 1 ? 's' : ''}`, r.energy && `${r.energy} éclairs`].filter(Boolean).join(' · ')
// Petit message en bas de l'écran après une récupération.
let toastFn: (t: string) => void = () => undefined
const toast = (t: string) => toastFn(t)

// Encadré d'en-tête d'un onglet : icône, texte, compte à rebours et lien.
const Info = ({ icon, label, text, timeLabel, time, link, onLink }: { icon: string; label: string; text: string; timeLabel?: string; time?: string; link?: string; onLink?: () => void }) => (
  <div className="mi-info">
    <CtIcon id={icon} />
    <div className="mi-info__txt"><small>{label}</small><b>{text}</b></div>
    {time && <div className="mi-info__time"><CtIcon id="clock" /><div><small>{timeLabel}</small><b>{time}</b></div></div>}
    {link && <button className="mi-info__link" onClick={onLink}>{link} <span>→</span></button>}
  </div>
)
const short = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d} j ${h} h` : `${h} h ${String(m % 60).padStart(2, '0')}` }
const go = (tab: string) => window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: tab }))

const Row = ({ c, now }: { c: Contract; now: Date }) => {
  const store = useStore()
  const owned = Object.values(store.owned).filter((v) => v > 0).length
  const value = Math.min(c.target, progress(c, store.quests, store.saga, now, owned))
  const done = isClaimed(c, store.quests, now)
  const ready = !done && value >= c.target
  const pc = Math.floor((value / c.target) * 100)
  return (
    <li className={`ct ${ready ? 'is-ready' : ''} ${done ? 'is-done' : ''}`}>
      <b className="ct__title">{c.title}</b>
      <div className="ct__prog"><div className="ct__bar"><i style={{ width: `${pc}%` }} /></div><small><b>{n(value)}</b>/{n(c.target)}</small></div>
      <Rewards r={c.reward} />
      {done ? <span className="ct__state ct__state--done">✓ Récupérée</span>
        : ready ? <button className="ct__claim" onClick={() => { if (store.claimContract(c.id)) toast(`1 mission récupérée : ${rewardText(c.reward)}`) }}>Récupérer</button>
          : <span className="ct__state">En cours · {pc} %</span>}
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
  collection: 'M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5Zm16 0a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2V5Z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 2 4 1-2 1-5 1-7Z',
  torii: 'M3 6h18M5 9h14M7 6v14M17 6v14',
}
const CtIcon = ({ id }: { id: string }) => <svg className="ct-ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CT_ICON[id] ?? CT_ICON.contracts} /></svg>

type Tab = 'daily' | 'contracts' | 'rift' | 'path'
type Sub = 'day' | 'week' | 'story' | 'pass' | 'event' | 'pvp' | 'collection'

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
  const ownedCount = Object.values(store.owned).filter((v) => v > 0).length
  const readyIn = (list: Contract[]) => list.filter((c) => !isClaimed(c, store.quests, now) && progress(c, store.quests, store.saga, now, ownedCount) >= c.target).length
  const [toastText, setToast] = useState('')
  useEffect(() => { toastFn = (t) => setToast(t); return () => { toastFn = () => undefined } }, [])
  useEffect(() => { if (!toastText) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toastText])
  const [prize, setPrize] = useState('')
  const contractsReady = readyIn([...daily, DAILY_BONUS, ...weekly, ...STORY, ...CAREER, ...COLLECTION])
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
        <div><p className="eyebrow">Tes objectifs</p><h1>Missions</h1><p>Accomplis-les en jouant, puis récupère tes récompenses.</p></div>
      </header>
      <div className="coltabs__bar" role="tablist" aria-label="Sections des missions">
        {([['daily', 'Chaque jour', st.claimed ? 0 : 1], ['contracts', 'Missions', contractsReady + passReady + eventReady + pvpReady], ['rift', 'Pass de combat', claimableTiers(rollPath(store.path, now)).length + challengesFor(now).filter((c) => challengeState(c, store.quests, now).ready).length], ['path', 'Parcours', 0]] as [Tab, string, number][]).map(([id, label, dot]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><CtIcon id={id} />{label}{dot > 0 && <i className="dot" aria-label={`${dot} à récupérer`} />}</button>
        ))}
      </div>

      {tab === 'daily' && (() => {
        const next = st.claimed ? (st.day < 7 ? st.day + 1 : 1) : st.day
        const left = msToDayEnd(now)
        const hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000), ss = Math.floor((left % 60000) / 1000)
        const chest = DAILY_REWARDS[6]
        const toChest = 7 - (st.claimed ? st.day : st.day - 1)
        const main = (r: Reward) => (r.gems ? <>+{n(r.gems)}<Coin name="soul" size={22} /></> : r.energy ? <>+{r.energy}<Coin name="bolt" size={22} /></> : r.tickets ? <>+{r.tickets}<Coin name="seal" size={22} /></> : null)
        return (
          <section className="dl">
            <div className="dl__card">
              <div className="dl__left">
                <p className="dl__kick">Connexion quotidienne <i /> Jour {st.claimed ? st.day : st.day} sur 7</p>
                <h2>{st.claimed ? 'À demain' : `Jour ${st.day}`}</h2>
                <p className="dl__txt">{st.claimed
                  ? <>Le jour {next} ({rewardText({ ...DAILY_REWARDS[next - 1], energy: DAILY_REWARDS[next - 1].energy })}) t’attend demain. Reviens avant minuit demain soir pour garder ta série.</>
                  : <>Ta récompense du jour {st.day} t’attend : {rewardText(DAILY_REWARDS[st.day - 1])}. Récupère-la avant minuit.</>}</p>
                <div className="dl__row">
                  <div className="dl__streak"><svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1c1.5 6.5 9 9.6 9 19.5a9 9 0 0 1-18 0C7 13.4 15.4 9.6 16 1Z" fill="#ff4d6d" /><path d="M16.5 19c3.3 3.2 5.7 6 5.7 10.2a6.2 6.2 0 0 1-12.4 0c0-3 1.7-4.9 3.5-6.6.1 2 1.1 3.3 2.2 3.6-.6-2.6.1-5 1-7.2Z" fill="#ffd0b0" /></svg><b>{streak}</b><span>Jour{streak > 1 ? 's' : ''}<br />d’affilée</span></div>
                  <div className="dl__clock"><small>{st.claimed ? 'Prochaine récompense dans' : 'Fin de la journée dans'}</small><b>{String(hh).padStart(2, '0')}<i>h</i> {String(mm).padStart(2, '0')}<i>min</i> {String(ss).padStart(2, '0')}<i>s</i></b></div>
                </div>
                {st.claimed ? <span className="dl__got">✓ Reçu aujourd’hui</span> : <button className="dl__claim" onClick={() => { store.claimDaily(); toast(`Jour ${st.day} récupéré : ${rewardText(DAILY_REWARDS[st.day - 1])}`) }}>Récupérer le jour {st.day}</button>}
              </div>
              <div className="dl__right">
                <small>Ta prochaine étape</small>
                <img src={uiArt('chest')} alt="" />
                <b>7 jours de connexion</b>
                <p className="dl__big">{main(chest)}</p>
                <span className="dl__more">{rewardText({ ...chest, gems: undefined })}</span>
                <small>{toChest <= 0 ? 'Récupère-le aujourd’hui !' : `Dans ${toChest} jour${toChest > 1 ? 's' : ''} de série`}</small>
              </div>
              <ol className="dl__days">
                {DAILY_REWARDS.map((r, i) => {
                  const day = i + 1
                  const state = day < st.day || (day === st.day && st.claimed) ? 'done' : day === st.day ? 'today' : day === st.day + 1 && st.claimed ? 'tomorrow' : 'next'
                  return (
                    <li key={day} className={`dl__day dl__day--${state}`}>
                      <small>Jour {day}</small>
                      <b>{main(r)}</b>
                      <em>{state === 'done' ? '✓ Reçu' : state === 'today' ? 'Aujourd’hui' : state === 'tomorrow' ? 'Demain' : 'À venir'}</em>
                    </li>
                  )
                })}
              </ol>
            </div>
            {st.missed && <p className="dl__warn" role="alert"><b>Série perdue :</b> tu as manqué un jour, elle repart du jour 1.</p>}
            {!st.missed && <p className="dl__warn"><b>{st.claimed ? 'Reviens demain' : 'Récupère avant minuit'}</b>, sinon la série repart du jour 1.</p>}
            {toastText && <div className="mi-toast" role="status">🎁 {toastText}</div>}
          </section>
        )
      })()}

      {tab === 'contracts' && (
        <section className="cn__list mi">
          <div className="mi-tabs" role="tablist" aria-label="Sortes de missions">
            {([['day', 'Quotidiennes', readyIn([...daily, DAILY_BONUS])], ['week', 'Hebdomadaires', readyIn(weekly)], ['story', 'Histoire', readyIn(STORY)], ['pass', 'Défis du pass', passReady], ['event', 'Événement', eventReady], ['pvp', 'PvP', pvpReady], ['collection', 'Collection', readyIn([...COLLECTION, ...CAREER])]] as [Sub, string, number][]).map(([id, label, dot]) => (
              <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'is-on' : ''} onClick={() => setSub(id)}>{label}{dot > 0 && <i>{dot}</i>}</button>
            ))}
          </div>
          {totalReady > 0 && <div className="claim-all"><span><b>{totalReady}</b> récompense{totalReady > 1 ? 's' : ''} à récupérer dans toutes les missions</span>
            <button className="btn btn--gold" onClick={claimEverything}>Tout récupérer ({totalReady})</button></div>}
          {prize && sub !== 'event' && <p className="cd__notice" role="status">{prize}</p>}
          {sub === 'day' && <>
            <Info icon="day" label={`Univers du jour · ${featuredWorld(now)}`} text="De nouvelles missions chaque jour" timeLabel="Nouvelles missions dans" time={short(msToDayEnd(now))} link="Jouer" onLink={() => go('play')} />
            <ul className="mi-list">{daily.map((c) => <Row key={c.id} c={c} now={now} />)}<Row c={DAILY_BONUS} now={now} /></ul>
          </>}
          {sub === 'week' && <>
            <Info icon="clock" label="Renouvelées chaque lundi · encore" text={short(msToWeekEnd(now))} />
            <ul className="mi-list">{weekly.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
          </>}
          {sub === 'story' && <>
            <Info icon="torii" label="Récompenses uniques" text="Termine les arcs de l’Aventure, puis vise les 3 étoiles partout" link="Aventure" onLink={() => go('play')} />
            {BANNERS.map((b, arc) => {
              const list = STORY.filter((c) => c.arc === arc)
              return (
                <div key={b.id} className="mi-group">
                  <h3>{b.world} <small>{list.filter((c) => isClaimed(c, store.quests, now)).length}/{list.length}</small></h3>
                  <ul className="mi-list">{list.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
                </div>
              )
            })}
          </>}
          {sub === 'pass' && <>
            <Info icon="flame" label={`Chaque défi se refait ${CHALLENGE_TIMES} fois par jour`} text="De l’XP de pass sans passer par l’Aventure" timeLabel="Nouveaux défis dans" time={short(msToDayEnd(now))} link="Pass de combat" onLink={() => setTab('rift')} />
            <ul className="mi-list">{passList.map((c) => {
              const st = challengeState(c, store.quests, now)
              const pc = st.finished ? 100 : Math.floor((st.value / c.target) * 100)
              return (
                <li key={c.id} className={`ct ${st.ready ? 'is-ready' : ''} ${st.finished ? 'is-done' : ''}`}>
                  <b className="ct__title">{c.title}</b>
                  <div className="ct__prog"><div className="ct__bar"><i style={{ width: `${pc}%` }} /></div><small><b>{st.finished ? n(c.target) : n(st.value)}</b>/{n(c.target)}</small></div>
                  <span className="rw"><span className="rw__xp">★ <b>+{c.xp}</b> XP de pass</span><span className="rw__count">{st.done}/{CHALLENGE_TIMES}</span></span>
                  {st.finished ? <span className="ct__state ct__state--done">✓ {CHALLENGE_TIMES}/{CHALLENGE_TIMES}</span> : st.ready ? <button className="ct__claim" onClick={() => { store.claimChallenge(c.id); toast(`1 défi récupéré : +${c.xp} XP de pass · ${c.gems} Éclats`) }}>Récupérer</button> : <span className="ct__state">En cours · {pc} %</span>}
                </li>
              )
            })}</ul>
          </>}
          {sub === 'event' && <>
            <Info icon="event" label="Événement de la semaine" text={`Le Colosse ${colossusOf(now).boss.name}`} timeLabel="Se termine dans" time={short(msToWeekEnd(now))} link="Événements" onLink={() => go('play')} />
            <ul className="mi-list">{EVENT_GOALS.map((g) => { const v = Math.min(g.target, g.value(col)), pc = Math.floor((v / g.target) * 100); return (
              <li key={g.id} className={`ct ${v >= g.target ? 'is-done' : ''}`}><b className="ct__title">{g.title}</b><div className="ct__prog"><div className="ct__bar"><i style={{ width: `${pc}%` }} /></div><small><b>{v}</b>/{g.target}</small></div>
                <span className="rw"><span className="rw__bolt"><Coin name="bolt" size={15} />compte pour la carte finale</span></span>
                <span className={`ct__state ${v >= g.target ? 'ct__state--done' : ''}`}>{v >= g.target ? '✓ Fait' : `En cours · ${pc} %`}</span></li>
            ) })}
              <li className={`ct ${eventReady ? 'is-ready' : ''} ${col.final ? 'is-done' : ''}`}><b className="ct__title">Termine toutes les autres missions de l’événement</b><div className="ct__prog"><div className="ct__bar"><i style={{ width: col.final || eventReady ? '100%' : '0%' }} /></div><small><b>{col.final || eventReady ? 1 : 0}</b>/1</small></div>
                <span className="rw"><span className="rw__sure"><b className="rw__rar rw__rar--epic">SR</b>ou mieux garantie</span></span>
                {col.final ? <span className="ct__state ct__state--done">✓ Récupérée</span> : eventReady ? <button className="ct__claim" onClick={() => { const c = store.claimEvent(); if (c) { setPrize(`${c.name} rejoint ta collection !`); toast(`1 mission récupérée : ${c.name}`) } }}>Récupérer</button> : <span className="ct__state">En cours · 0 %</span>}</li>
            </ul>
            {prize && <p className="cd__notice" role="status">{prize}</p>}
          </>}
          {sub === 'pvp' && <>
            <Info icon="clock" label="Duels de l’Arène · renouvelés chaque lundi" text={short(msToWeekEnd(now))} link="Arène" onLink={() => go('play')} />
            <ul className="mi-list">{PVP_GOALS.map((g) => { const v = Math.min(g.target, g.value(store.arena, pvpWeek)), done = pvpWeek.claimed.includes(g.id), ready = !done && v >= g.target, pc = Math.floor((v / g.target) * 100); return (
              <li key={g.id} className={`ct ${ready ? 'is-ready' : ''} ${done ? 'is-done' : ''}`}><b className="ct__title">{g.title}</b><div className="ct__prog"><div className="ct__bar"><i style={{ width: `${pc}%` }} /></div><small><b>{n(v)}</b>/{n(g.target)}</small></div>
                <Rewards r={{ gems: g.gems, tickets: g.tickets }} />
                {done ? <span className="ct__state ct__state--done">✓ Récupérée</span> : ready ? <button className="ct__claim" onClick={() => { store.claimPvp(g.id); toast(`1 mission récupérée : ${rewardText({ gems: g.gems, tickets: g.tickets })}`) }}>Récupérer</button> : <span className="ct__state">En cours · {pc} %</span>}</li>
            ) })}</ul>
          </>}
          {sub === 'collection' && <>
            <Info icon="collection" label="Récompenses uniques" text={`${n(ownedCount)} personnages différents dans ta collection`} link="Collection" onLink={() => go('collection')} />
            <div className="mi-group">
              <h3>Personnages différents <small>{COLLECTION.filter((c) => isClaimed(c, store.quests, now)).length}/{COLLECTION.length}</small></h3>
              <ul className="mi-list">{COLLECTION.map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
            </div>
            {([['pulls', 'Invocations'], ['newCards', 'Découvertes'], ['wins', 'Combats'], ['win3', 'Victoires parfaites'], ['levels', 'Entraînement'], ['merges', 'Fusions'], ['bosses', 'Boss'], ['floors', 'Tour de l’Infini'], ['damage', 'Dégâts'], ['gemsSpent', 'Dépenses'], ['dailies', 'Fidélité'], ['claims', 'Missions'], ['dailyAll', 'Journées parfaites'], ['featuredPull', 'Univers du jour']] as [string, string][]).map(([counter, label]) => {
              const list = CAREER.filter((c) => c.counter === counter)
              if (!list.length) return null
              return (
                <div key={counter} className="mi-group">
                  <h3>{label} <small>{list.filter((c) => isClaimed(c, store.quests, now)).length}/{list.length}</small></h3>
                  <ul className="mi-list">{[...list].sort((x, y) => x.target - y.target).map((c) => <Row key={c.id} c={c} now={now} />)}</ul>
                </div>
              )
            })}
          </>}
          {toastText && <div className="mi-toast" role="status">🎁 {toastText}</div>}
        </section>
      )}

      {tab === 'rift' && <RiftPath now={now} onGo={(to) => { setTab('contracts'); setSub(to) }} />}

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
          <p className="set__note">Les doublons fusionnés, les boss, les dégâts et les niveaux sont comptés depuis l'arrivée des Missions.</p>
        </section>
      )}
      <Guide id="contracts" />
    </div>
  )
}
