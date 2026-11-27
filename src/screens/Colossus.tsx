import { useState } from 'react'
import { gateArt, heroArt, iconArt, uiArt } from '../assets/manifest'
import { heroById, type Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { colossusFoes, colossusOf, DIFFICULTIES, EVENT_GOALS, eventDone, isOpen, rollCol, TRIES_PER_DAY, WIN_SOULS, type Difficulty } from '../game/colossus'
import { msToWeekEnd, type Reward } from '../game/contracts'
import { cardState, power, SCROLLS } from '../game/progression'
import { useStore, type ColResult } from '../state/store'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'
import { Battle, TeamPanel } from './Saga'

const n = (x: number) => x.toLocaleString('fr-FR')
const left = (ms: number) => { const h = Math.floor(ms / 3600000); return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min` }

const Loot = ({ r, card }: { r: Reward; card?: boolean }) => (
  <ul className="sp-loot">
    {card && <li><img src={uiArt('card-pack')} alt="" /><b>1</b><small>carte SR ou mieux</small></li>}
    {r.gems ? <li><Coin name="soul" size={30} /><b>{r.gems}</b><small>âmes</small></li> : null}
    {r.tickets ? <li><Coin name="seal" size={30} /><b>{r.tickets}</b><small>sceaux</small></li> : null}
    {r.shards ? <li><img src={iconArt('shard')} alt="" /><b>{r.shards}</b><small>fragments d'âme</small></li> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <li key={k}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" /><b>{v}</b><small>{SCROLLS[k as 'small'].label.toLowerCase()}</small></li>)}
  </ul>
)

export const Colossus = ({ onBack }: { onBack: () => void }) => {
  const store = useStore()
  const now = new Date()
  const { banner, boss, minions } = colossusOf(now)
  const col = rollCol(store.col, now)
  const [pick, setPick] = useState<Difficulty['id']>(() => [...DIFFICULTIES].reverse().find((d) => isOpen(col, d))!.id)
  const [result, setResult] = useState<ColResult | null>(null)
  const [prize, setPrize] = useState<Hero | null>(null)
  const diff = DIFFICULTIES.find((d) => d.id === pick)!
  const foes = colossusFoes(boss, minions, diff)
  const team = store.teamNow
  const teamPower = team.reduce((s, id) => s + cardState(heroById(id), store.xp, store.owned, store.rebirths, store.awakened, team).power, 0)
  const foePower = foes.reduce((s, u) => s + power(u), 0)
  const art = store.customArt[boss.id] ?? store.remoteArt[boss.id] ?? (boss.model ? heroArt(boss.model, 'full') : '')
  const start = () => { const r = store.fightColossus(diff.id); if (r) setResult(r) }
  const done = eventDone(col)

  return (
    <div className="co" style={{ ['--hue' as string]: banner.hue }}>
      <button className="summon__back" onClick={onBack}>← Le Nexus</button>
      <header className="co__head">
        <img className="co__gate" src={gateArt('raids')} alt="" />
        {art && <img className="co__boss" src={art} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <div className="co__text">
          <p className="eyebrow">Porte II · Colosse de la semaine</p>
          <h1>{boss.name}</h1>
          <p>{boss.title} · {banner.world}</p>
          <p className="co__end">Nouveau Colosse dans <b>{left(msToWeekEnd(now))}</b> · essais aujourd'hui : <b>{store.colTries} / {TRIES_PER_DAY}</b></p>
        </div>
      </header>

      <TeamPanel />

      <section className="co-diff">
        <div className="co-diff__tabs" role="radiogroup" aria-label="Difficulté">
          {DIFFICULTIES.map((d) => {
            const open = isOpen(col, d), beaten = col.cleared.includes(d.id)
            return (
              <button key={d.id} role="radio" aria-checked={pick === d.id} disabled={!open} className={`${pick === d.id ? 'is-on' : ''} ${beaten ? 'is-beaten' : ''}`} style={{ ['--dc' as string]: d.hue }} onClick={() => setPick(d.id)}>
                <b>{d.label}</b><small>{beaten ? '✓ battu' : open ? 'ouvert' : '🔒'}</small>
              </button>
            )
          })}
        </div>
        <ul className="sg-foes">
          {foes.map((u, i) => <li key={u.key} style={{ ['--rc' as string]: RARITIES[u.hero.rarity].color }}><b>{i === 0 ? '👑 ' : ''}{u.hero.name}{i === 0 ? ' (colossal)' : ''}</b><small>{u.hero.role} · PV {n(u.maxHp)} · ATK {n(u.atk)} · DEF {n(u.def)}</small></li>)}
        </ul>
        <p className="sg-sheet__vs">Ton équipe : <b>{n(teamPower)}</b> de puissance · Colosse et sbires : <b>{n(foePower)}</b></p>
        <h3 className="sp-sub">{col.cleared.includes(diff.id) ? `Déjà battu cette semaine : +${WIN_SOULS} Éclats par victoire` : `Récompense de la première victoire en ${diff.label} (cette semaine)`}</h3>
        {!col.cleared.includes(diff.id) && <Loot r={{ ...diff.reward, gems: (diff.reward.gems ?? 0) + WIN_SOULS }} card={diff.card} />}
        <button className="btn btn--gold" disabled={team.length === 0 || store.colTries < 1} onClick={start}>
          {team.length === 0 ? 'Il faut au moins une carte' : store.colTries < 1 ? 'Plus d’essai aujourd’hui : reviens demain' : `Affronter ${boss.name} en ${diff.label}`}
        </button>
      </section>

      <section className="co-event">
        <h3 className="sp-sub">Événement de la semaine</h3>
        <ul>
          {EVENT_GOALS.map((g) => {
            const v = Math.min(g.target, g.value(col))
            return (
              <li key={g.id} className={`ct ${v >= g.target ? 'is-done' : ''}`}>
                <div className="ct__main"><b>{g.title}</b><div className="ct__bar"><i style={{ width: `${(v / g.target) * 100}%` }} /></div><small>{v} / {g.target}</small></div>
                <span className="ct__state">{v >= g.target ? '✓' : `${Math.floor((v / g.target) * 100)} %`}</span>
              </li>
            )
          })}
        </ul>
        <div className={`co-final ${done && !col.final ? 'is-ready' : ''}`}>
          <img src={uiArt('card-pack')} alt="" />
          <div><b>Récompense finale : une carte SR ou mieux garantie</b><small>{col.final ? 'Récupérée cette semaine.' : done ? 'Les trois objectifs sont faits !' : 'Fais les trois objectifs avant lundi.'}</small></div>
          {!col.final && <button className="ct__claim" disabled={!done} onClick={() => { const c = store.claimEvent(); if (c) setPrize(c) }}>Récupérer</button>}
        </div>
      </section>

      <Guide id="colossus" />
      {result && <Battle result={result} kicker={`Colosse · ${result.diff.label}`} title={boss.name}
        winBody={<><p className="sp-win">{result.first ? `${result.diff.label} : première victoire de la semaine !` : `+${WIN_SOULS} Éclats`}</p>{result.first && <Loot r={{ ...result.diff.reward, gems: (result.diff.reward.gems ?? 0) + WIN_SOULS }} card={result.diff.card} />}{result.card && <div className="pt-reveal__cards"><Card hero={result.card} /></div>}</>}
        loseBody={<p>Le Colosse est trop fort pour l'instant. Un essai est utilisé ; renforce ton équipe ou choisis une difficulté plus basse.</p>}
        onClose={() => setResult(null)} />}
      {prize && (
        <div className="pt-reveal" role="dialog" aria-modal="true" aria-label="Récompense de l'événement" onClick={() => setPrize(null)}>
          <div className="pt-reveal__box" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Événement des Colosses</p><h3>Nouvelle carte !</h3>
            <div className="pt-reveal__cards"><Card hero={prize} /></div>
            <button className="btn btn--gold" onClick={() => setPrize(null)}>Super !</button>
          </div>
        </div>
      )}
    </div>
  )
}
