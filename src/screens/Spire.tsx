import { useState } from 'react'
import { gateArt, iconArt, uiArt } from '../assets/manifest'
import { RARITIES } from '../data/rarities'
import { power, SCROLLS } from '../game/progression'
import { BOSS_EVERY, floor, spireFoes, type Floor } from '../game/spire'
import type { Reward } from '../game/contracts'
import { useStore, type SpireResult } from '../state/store'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'
import { Battle, TeamPanel } from './Saga'
import { cardState } from '../game/progression'
import { heroById } from '../data/heroes'

const n = (x: number) => x.toLocaleString('fr-FR')

const Plate = ({ f, size = 92 }: { f: Floor; size?: number }) => (
  <span className={`sp-plate ${f.boss ? 'sp-plate--boss' : ''}`} style={{ width: size, ['--s' as string]: `${size}px` }}>
    <img src={uiArt(f.boss ? 'floor-boss' : 'floor-plate')} alt="" />
    <b>{f.n}</b>
  </span>
)

const Loot = ({ r }: { r: Reward }) => (
  <ul className="sp-loot">
    {r.gems ? <li><Coin name="soul" size={30} /><b>{r.gems}</b><small>âmes</small></li> : null}
    {r.shards ? <li><img src={iconArt('shard')} alt="" /><b>{r.shards}</b><small>fragments d'âme</small></li> : null}
    {r.tickets ? <li><Coin name="seal" size={30} /><b>{r.tickets}</b><small>sceau</small></li> : null}
    {Object.entries(r.scrolls ?? {}).map(([k, v]) => <li key={k}><img src={iconArt(`scroll-${k as 'small'}`)} alt="" /><b>{v}</b><small>{SCROLLS[k as 'small'].label.toLowerCase()}</small></li>)}
  </ul>
)

export const Spire = ({ onBack }: { onBack: () => void }) => {
  const store = useStore()
  const [result, setResult] = useState<SpireResult | null>(null)
  const best = store.spire.best
  const f = floor(best + 1)
  const foes = spireFoes(f)
  const team = store.teamNow
  const teamPower = team.reduce((s, id) => s + cardState(heroById(id), store.xp, store.owned, store.rebirths, store.awakened, team).power, 0)
  const foePower = foes.reduce((s, u) => s + power(u), 0)
  const ahead = Array.from({ length: 6 }, (_, i) => floor(best + 2 + i))
  const nextBoss = Math.ceil((best + 1) / BOSS_EVERY) * BOSS_EVERY
  const start = () => { const r = store.fightSpire(); if (r) setResult(r) }

  return (
    <div className="sp">
      <button className="summon__back" onClick={onBack}>← Le Nexus</button>
      <header className="sp__head">
        <img src={gateArt('spire')} alt="" />
        <div>
          <p className="eyebrow">Porte III · Tour</p>
          <h1>La Tour de l’Infini</h1>
          <p>Une tour sans fin. Chaque étage a sa règle. Combats gratuits, sans éclair.</p>
          <p className="sp__best">Meilleur étage : <b>{best}</b></p>
        </div>
      </header>

      <TeamPanel />

      <section className={`sp-floor ${f.boss ? 'sp-floor--boss' : ''}`}>
        <div className="sp-floor__top">
          <Plate f={f} size={110} />
          <div>
            <p className="eyebrow">{f.boss ? 'Étage du gardien' : 'Prochain étage'}</p>
            <h2>Étage {f.n}</h2>
            <p className="sp-rule"><b>{f.rule.name}</b><span>{f.rule.text}</span></p>
          </div>
        </div>
        <ul className="sg-foes">
          {foes.map((u, i) => <li key={u.key} style={{ ['--rc' as string]: RARITIES[u.hero.rarity].color }}><b>{f.boss && i === 0 ? '👑 ' : ''}{u.hero.name}</b><small>{u.hero.world} · {u.hero.role} · PV {n(u.maxHp)} · ATK {n(u.atk)} · DEF {n(u.def)}</small></li>)}
        </ul>
        <p className="sg-sheet__vs">Ton équipe : <b>{n(teamPower)}</b> de puissance · adversaires : <b>{n(foePower)}</b>{teamPower < foePower * 0.8 ? ' · ça va être dur !' : ''}</p>
        <h3 className="sp-sub">Récompense de la première victoire</h3>
        <Loot r={f.reward} />
        <p className="sp-note">+{f.accountXp} XP de compte · +10 XP sur le Chemin du Rift</p>
        <button className="btn btn--gold" disabled={team.length === 0} onClick={start}>{team.length === 0 ? 'Il faut au moins une carte' : `Combattre l'étage ${f.n} · gratuit`}</button>
      </section>

      <section className="sp-tower">
        <h3 className="sp-sub">Plus haut dans la tour</h3>
        <ol>
          {ahead.map((x) => (
            <li key={x.n} className={x.boss ? 'is-boss' : ''}>
              <Plate f={x} size={52} />
              <div><b>{x.boss ? 'Gardien' : x.rule.name}</b><small>{x.rule.text}</small></div>
              <span className="sp-tower__loot">
                {x.reward.shards ? <><img src={iconArt('shard')} alt="" />{x.reward.shards}</> : <><Coin name="soul" size={18} />{x.reward.gems}</>}
              </span>
            </li>
          ))}
        </ol>
        <p className="set__note">Prochain gardien : étage {nextBoss}. Les gardiens donnent des fragments d'âme, un sceau et un parchemin. Les fragments d'âme servent à libérer tes cartes (niveau maximum 100). La Tour de l’Infini ne donne pas d'XP de carte : elle mesure la force de ton équipe. Si tu perds, rien n'est perdu, tu peux réessayer tout de suite.</p>
      </section>

      <Guide id="spire" />
      {result && <Battle result={result} kicker={`La Tour de l’Infini · étage ${result.floor.n}`} title={result.floor.boss ? `Gardien de l'étage ${result.floor.n}` : result.floor.rule.name}
        winBody={<><p className="sp-win">Étage {result.floor.n} franchi !</p><Loot r={result.floor.reward} /></>}
        loseBody={<p>Ton équipe est tombée. La Tour de l’Infini ne coûte pas d'éclair : change d'équipe, monte tes cartes de niveau et réessaie quand tu veux.</p>}
        onClose={() => setResult(null)} />}
    </div>
  )
}
