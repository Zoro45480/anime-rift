import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gateArt, iconArt } from '../assets/manifest'
import { HEROES, roleKind } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import type { Unit } from '../game/battle'
import { ENERGY_OVER, ENERGY_REFILL, ENERGY_REFILL_COST, cardState, ENERGY_MAX, power, SCROLL_IDS, SCROLLS, STAT_LABEL } from '../game/progression'
import { foeUnits, isUnlocked, SOULS_PER_STAR, STAGES, STAGES_PER_ARC, TEAM_SIZE } from '../game/saga'
import { Guide } from '../ui/Guide'
import { useHoldNotifs } from '../ui/busy'
import { useStore, type FightResult } from '../state/store'
import { Coin } from '../ui/Coin'

const n = (x: number) => x.toLocaleString('fr-FR')
const pct = (x: number) => `${Math.round(x * 100)} %`
const Stars = ({ value }: { value: number }) => <span className="sg-stars" aria-label={`${value} étoile${value > 1 ? 's' : ''} sur 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= value ? 'is-on' : ''}>★</i>)}</span>

// Rejoue le combat action par action : barres de vie, boucliers, texte de l'action.
type Fight = Pick<FightResult, 'allies' | 'foes' | 'events' | 'win'>
export const Battle = ({ result, onClose, kicker, title, winBody, loseBody }: { result: Fight; onClose: () => void; kicker: string; title: string; winBody: ReactNode; loseBody: ReactNode }) => {
  useHoldNotifs() // pas de notification pendant le combat : elle dévoilerait l'issue
  const [step, setStep] = useState(0) // nombre d'actions déjà montrées
  const [fast, setFast] = useState(false)
  const total = result.events.length
  const done = step >= total
  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setStep((s) => s + 1), fast ? 160 : 620)
    return () => clearTimeout(t)
  }, [step, done, fast])

  // état des combattants après `step` actions
  const state = useMemo(() => {
    const map = new Map<string, { hp: number; shield: number }>([...result.allies, ...result.foes].map((u) => [u.key, { hp: u.hp, shield: 0 }]))
    for (const e of result.events.slice(0, step)) for (const c of [...e.hits, ...e.shields, ...e.heals]) map.set(c.target, { hp: c.hp, shield: c.shield })
    return map
  }, [result, step])
  const last = step > 0 ? result.events[step - 1] : null
  const unit = (key: string) => [...result.allies, ...result.foes].find((u) => u.key === key)!
  const line = last ? (() => {
    const who = unit(last.actor).hero.name
    const parts = [
      ...last.hits.map((h) => `${unit(h.target).hero.name} −${n(h.amount)}${h.ko ? ' (K.-O.)' : ''}`),
      ...last.heals.filter((h) => h.amount > 0).map((h) => `${unit(h.target).hero.name} +${n(h.amount)} PV`),
      ...(last.shields.length ? [`bouclier +${n(last.shields[0].amount)}`] : []),
      ...(last.taunt ? ['attire les attaques'] : []),
    ]
    return { who, move: last.move, kind: last.kind, text: parts.join(' · ') }
  })() : null

  const Row = ({ units }: { units: Unit[] }) => (
    <div className="bt-row">
      {units.map((u) => {
        const s = state.get(u.key)!
        const hit = last?.hits.some((h) => h.target === u.key)
        return (
          <div key={u.key} className={`bt-unit ${s.hp <= 0 ? 'is-ko' : ''} ${last?.actor === u.key ? 'is-acting' : ''} ${hit ? 'is-hit' : ''}`} style={{ ['--rc' as string]: RARITIES[u.hero.rarity].color }}>
            <span className="bt-unit__face" lang="ja">{u.hero.kana.slice(0, 2)}</span>
            <b>{u.hero.name}</b>
            <span className={`role role--${roleKind(u.hero.role)}`}>{u.hero.role}</span>
            <div className="bt-hp"><i style={{ width: `${(s.hp / u.maxHp) * 100}%` }} />{s.shield > 0 && <em style={{ width: `${Math.min(100, (s.shield / u.maxHp) * 100)}%` }} />}</div>
            <small>{n(s.hp)} / {n(u.maxHp)}{s.shield > 0 ? ` · 🛡 ${n(s.shield)}` : ''}</small>
          </div>
        )
      })}
    </div>
  )

  return createPortal(
    <div className="bt" role="dialog" aria-modal="true" aria-label={`Combat : ${title}`}>
      <div className="bt__in">
        <header className="bt__head"><p>{kicker}</p><h2>{title}</h2></header>
        <Row units={result.foes} />
        <div className={`bt-line ${line ? `bt-line--${line.kind === 'Ultime' ? 'u' : line.kind === 'Technique' ? 't' : 'a'}` : ''}`} aria-live="polite">
          {line ? <><small>{line.kind} · {line.who}</small><b>{line.move}</b><span>{line.text}</span></> : <b>Le combat commence…</b>}
        </div>
        <Row units={result.allies} />
        {!done ? (
          <div className="bt__ctrl">
            <button className="cd-btn cd-btn--small" aria-pressed={fast} onClick={() => setFast(!fast)}>{fast ? 'Vitesse ×1' : 'Vitesse ×4'}</button>
            <button className="cd-btn cd-btn--small" onClick={() => setStep(total)}>Passer</button>
            <span>{step} / {total}</span>
          </div>
        ) : (
          <section className={`bt-end ${result.win ? 'is-win' : 'is-lose'}`} role="status">
            <h3>{result.win ? 'Victoire' : 'Défaite'}</h3>
            {result.win ? winBody : loseBody}
            <button className="btn btn--gold" onClick={onClose}>Continuer</button>
          </section>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Mon équipe : les trois cartes qui combattent (L’Aventure et La Tour de l’Infini).
export const TeamPanel = () => {
  const store = useStore()
  const [picking, setPicking] = useState(false)
  const owned = HEROES.filter((h) => store.owned[h.id]).map((h) => ({ hero: h, state: cardState(h, store.xp, store.owned, store.rebirths, store.awakened, store.teamNow) }))
    .sort((a, b) => b.state.power - a.state.power)
  const team = store.teamNow
  const teamPower = team.reduce((s, id) => s + (owned.find((o) => o.hero.id === id)?.state.power ?? 0), 0)
  const activeGroups = [...new Map(owned.filter((o) => team.includes(o.hero.id)).flatMap((o) => o.state.groups.filter((g) => g.counted && g.stat !== 'all')).map((g) => [g.name, g])).values()]
  const toggle = (id: string) => store.setTeam(team.includes(id) ? team.filter((x) => x !== id) : team.length < TEAM_SIZE ? [...team, id] : team)
  return (
    <section className="sg-team">
      <header><h2>Mon équipe</h2><em>Puissance {n(teamPower)}</em><button className="linkbtn" aria-expanded={picking} onClick={() => setPicking(!picking)}>{picking ? 'Terminer' : 'Changer'}</button></header>
      {owned.length === 0 ? <p className="cd-note">Tu n'as encore aucune carte : fais une invocation d'abord.</p> : (
        <ul className="sg-team__slots">
          {Array.from({ length: TEAM_SIZE }, (_, i) => {
            const o = owned.find((x) => x.hero.id === team[i])
            return o ? (
              <li key={i} style={{ ['--rc' as string]: RARITIES[o.hero.rarity].color }}><b>{RARITIES[o.hero.rarity].short}</b><span>{o.hero.name}</span><small><span className={`role role--${roleKind(o.hero.role)}`}>{o.hero.role}</span> · Nv {o.state.level}</small></li>
            ) : <li key={i} className="is-empty">Place libre</li>
          })}
        </ul>
      )}
      {owned.length > 0 && <p className="sg-team__groups">{activeGroups.length === 0 ? 'Aucun collectif actif : mets ensemble deux membres d’un même collectif pour gagner un bonus.' : <>Collectifs actifs : {activeGroups.map((g) => <b key={g.name}>{g.name} +{g.pct} % {STAT_LABEL[g.stat]}</b>)}</>}</p>}
      {picking && (
        <ul className="sg-pick">
          {owned.map((o) => (
            <li key={o.hero.id}><button className={team.includes(o.hero.id) ? 'is-on' : ''} aria-pressed={team.includes(o.hero.id)} style={{ ['--rc' as string]: RARITIES[o.hero.rarity].color }} onClick={() => toggle(o.hero.id)}>
              <b>{RARITIES[o.hero.rarity].short}</b><span>{o.hero.name}</span><small>{o.hero.role} · Nv {o.state.level} · {n(o.state.power)}</small>
            </button></li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const Saga = ({ onBack }: { onBack: () => void }) => {
  const store = useStore()
  const [openId, setOpenId] = useState(() => STAGES.filter((s) => isUnlocked(s, store.saga)).at(-1)!.id)
  const [result, setResult] = useState<FightResult | null>(null)
  const stage = STAGES.find((s) => s.id === openId)!
  const foes = foeUnits(stage)
  const owned = HEROES.filter((h) => store.owned[h.id]).map((h) => ({ hero: h, state: cardState(h, store.xp, store.owned, store.rebirths, store.awakened, store.teamNow) }))
    .sort((a, b) => b.state.power - a.state.power)
  const team = store.teamNow
  const teamPower = team.reduce((s, id) => s + (owned.find((o) => o.hero.id === id)?.state.power ?? 0), 0)
  const foePower = foes.reduce((s, u) => s + power(u), 0)
  const totalStars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const start = () => { const r = store.fight(stage.id); if (r) setResult(r) }

  return (
    <div className="sg">
      <button className="summon__back" onClick={onBack}>← Le Nexus</button>
      <header className="sg__head">
        <img src={gateArt('saga')} alt="" />
        <div>
          <p className="eyebrow">Porte I · Histoire</p>
          <h1>L’Aventure</h1>
          <p>Traverse chaque univers, combat après combat. <b>{totalStars}</b> / {STAGES.length * 3} étoiles · <Coin name="bolt" size={18} /> {store.energyLeft}/{ENERGY_MAX}</p>
        </div>
      </header>

      <TeamPanel />

      <div className="sg-arcs">
        {Array.from({ length: STAGES.length / STAGES_PER_ARC }, (_, arc) => {
          const stages = STAGES.filter((s) => s.arc === arc)
          const open = isUnlocked(stages[0], store.saga)
          return (
            <section key={arc} className={`sg-arc ${open ? '' : 'is-locked'}`}>
              <header><span>Arc {arc + 1}</span><h2>{stages[0].world}</h2><em>{stages.reduce((s, x) => s + (store.saga[x.id] ?? 0), 0)} / {STAGES_PER_ARC * 3} ★</em></header>
              <div className="sg-arc__stages">
                {stages.map((s) => {
                  const ok = isUnlocked(s, store.saga)
                  return (
                    <button key={s.id} disabled={!ok} className={`sg-stage ${s.id === openId ? 'is-open' : ''} ${s.boss ? 'sg-stage--boss' : ''} ${(store.saga[s.id] ?? 0) > 0 ? 'is-done' : ok ? 'is-next' : ''}`} onClick={() => setOpenId(s.id)} aria-label={`${s.world}, combat ${s.index + 1} : ${s.name}${ok ? '' : ' (verrouillé)'}`}>
                      <b>{s.boss ? 'BOSS' : s.index + 1}</b>
                      {ok ? <Stars value={store.saga[s.id] ?? 0} /> : <small>Verrouillé</small>}
                    </button>
                  )
                })}
              </div>
              {stage.arc === arc && (
                <div className="sg-sheet">
                  <h3>{stage.index + 1}. {stage.name}</h3>
                  <ul className="sg-foes">
                    {foes.map((u) => <li key={u.key} style={{ ['--rc' as string]: RARITIES[u.hero.rarity].color }}><b>{u.hero.name}</b><small>{u.hero.role} · PV {n(u.maxHp)} · ATK {n(u.atk)} · DEF {n(u.def)}</small></li>)}
                  </ul>
                  <p className="sg-sheet__vs">Ton équipe : <b>{n(teamPower)}</b> de puissance · adversaires : <b>{n(foePower)}</b></p>
                  <div className="sg-rewards">
                    <div><small>À chaque victoire</small><b>+{n(stage.accountXp)} XP de compte</b><b>+{n(stage.cardXp)} XP par carte</b></div>
                    <div><small>Étoiles</small><b>+{SOULS_PER_STAR} Éclats par nouvelle étoile</b><span>3 ★ sans aucun K.-O. dans ton équipe</span></div>
                  </div>
                  <h4>Taux de drop des parchemins</h4>
                  <ul className="sg-drops">
                    {SCROLL_IDS.map((id) => <li key={id}><img src={iconArt(`scroll-${id}`)} alt="" /><span>{SCROLLS[id].label}</span><b>{pct(stage.drops[id])}</b></li>)}
                  </ul>
                  {store.energyLeft < 1 && <button className="cd-btn cd-btn--small" disabled={store.gems < ENERGY_REFILL_COST || store.energyLeft + ENERGY_REFILL > ENERGY_OVER} onClick={store.buyEnergy}>Recharger {ENERGY_REFILL} éclairs · {ENERGY_REFILL_COST} Éclats</button>}
                  <button className="btn btn--gold" disabled={store.energyLeft < 1 || team.length === 0} onClick={start}>
                    {team.length === 0 ? 'Il faut au moins une carte' : store.energyLeft < 1 ? 'Plus d’énergie : elle remonte toute seule' : <>Combattre · 1 <Coin name="bolt" size={20} /></>}
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <Guide id="saga" />
      {result && <Battle result={result} kicker={`${result.stage.world} · ${result.stage.index + 1}/${STAGES_PER_ARC}`} title={result.stage.name}
        winBody={<>
          <Stars value={result.stars} />
          <ul>
            <li><b>+{n(result.accountXp)}</b> XP de compte</li>
            <li><b>+{n(result.cardXp)}</b> XP pour chaque carte de l'équipe</li>
            {result.souls > 0 && <li><b>+{result.souls}</b> Éclats ({result.newStars} nouvelle{result.newStars > 1 ? 's' : ''} étoile{result.newStars > 1 ? 's' : ''})</li>}
            {result.scrolls.map((id) => <li key={id} className="bt-end__drop"><img src={iconArt(`scroll-${id}`)} alt="" /><b>{SCROLLS[id].label}</b> obtenu</li>)}
            {result.scrolls.length === 0 && <li>Aucun parchemin cette fois.</li>}
          </ul>
        </>}
        loseBody={<p>Ton équipe est tombée. L'éclair est dépensé, mais rien n'est perdu : monte tes cartes de niveau et réessaie.</p>}
        onClose={() => { setResult(null); const next = STAGES[STAGES.indexOf(result.stage) + 1]; if (result.win && next && result.newStars === result.stars) setOpenId(next.id) }} />}
    </div>
  )
}
