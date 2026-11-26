import { useState } from 'react'
import { gateArt, uiArt } from '../assets/manifest'
import { RARITIES } from '../data/rarities'
import { DUELS_PER_DAY, LEAGUES, leagueOf, PVP_GOALS, rivalsFor, rollWeek, WIN_SOULS, type LeagueId } from '../game/arena'
import { msToWeekEnd } from '../game/contracts'
import { useStore, type DuelResult } from '../state/store'
import { Coin } from '../ui/Coin'
import { Guide } from '../ui/Guide'
import { Battle, TeamPanel } from './Saga'

const n = (x: number) => x.toLocaleString('fr-FR')
const left = (ms: number) => { const h = Math.floor(ms / 3600000); return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min` }
const Emblem = ({ id, size }: { id: LeagueId; size: number }) => <img className="ar-emblem" src={uiArt(`league-${id}`)} alt="" style={{ height: size }} />

export const Arena = ({ onBack }: { onBack: () => void }) => {
  const store = useStore()
  const [result, setResult] = useState<DuelResult | null>(null)
  const a = store.arena
  const lg = leagueOf(a.elo)
  const next = LEAGUES[LEAGUES.findIndex((l) => l.id === lg.id) + 1]
  const rivals = rivalsFor(a.elo, a.seed)
  const w = rollWeek(a, new Date())
  const fight = (id: string) => { const r = store.duel(id); if (r) setResult(r) }

  return (
    <div className="ar" style={{ ['--lg' as string]: lg.hue }}>
      <button className="summon__back" onClick={onBack}>← Le Nexus</button>
      <header className="ar__head">
        <img className="ar__gate" src={gateArt('arena')} alt="" />
        <div className="ar__me">
          <Emblem id={lg.id} size={120} />
          <div>
            <p className="eyebrow">Porte IV · Duel</p>
            <h1>L'Arène</h1>
            <p className="ar__league">Ligue <b>{lg.label}</b> · <b>{n(a.elo)}</b> de cote</p>
            {next ? <div className="ar__bar"><i style={{ width: `${Math.max(0, Math.min(100, ((a.elo - lg.min) / (next.min - lg.min)) * 100))}%` }} /><span>{next.min - a.elo} points avant {next.label}</span></div> : <p className="ar__league">Plus haute ligue atteinte !</p>}
          </div>
        </div>
        <ul className="ar__stats">
          <li><b>{a.wins}</b><span>victoires</span></li><li><b>{a.losses}</b><span>défaites</span></li>
          <li><b>{a.streak}</b><span>d'affilée</span></li><li><b>{n(a.best)}</b><span>meilleure cote</span></li>
        </ul>
      </header>

      <p className="ar__note">Tes rivaux sont des équipes contrôlées par le jeu, réglées sur ta force : un rival mieux classé que toi est plus fort. Les bonus de Renaissance ne comptent pas ici. Le jeu en ligne contre de vrais joueurs demandera un serveur.</p>

      <TeamPanel />
      <p className="ar__power">Puissance en arène (sans Renaissance) : <b>{n(store.arenaPower)}</b></p>

      <section className="ar-rivals">
        <header><h3 className="sp-sub">Choisis ton rival</h3><span>Duels aujourd'hui : <b>{store.duelsLeft} / {DUELS_PER_DAY}</b></span><button className="linkbtn" onClick={store.newRivals}>Autres rivaux</button></header>
        <ul>
          {rivals.map((r) => {
            const rl = leagueOf(r.elo)
            return (
              <li key={r.id} className="ar-rival" style={{ ['--rl' as string]: rl.hue }}>
                <Emblem id={rl.id} size={54} />
                <div className="ar-rival__id"><b>{r.name}</b><small>{rl.label} · {n(r.elo)} · {r.elo > a.elo ? 'plus fort' : r.elo < a.elo ? 'plus faible' : 'même niveau'}</small>
                  <span className="ar-rival__team">{r.heroes.map((h) => <i key={h.id} style={{ ['--rc' as string]: RARITIES[h.rarity].color }}>{RARITIES[h.rarity].short} {h.name}</i>)}</span>
                </div>
                <button className="btn btn--gold ar-rival__go" disabled={store.duelsLeft < 1 || store.teamNow.length === 0} onClick={() => fight(r.id)}>Défier</button>
              </li>
            )
          })}
        </ul>
        {store.duelsLeft < 1 && <p className="ar__note">Plus de duel aujourd'hui : reviens demain.</p>}
      </section>

      <section className="co-event">
        <h3 className="sp-sub">Défis d'arène de la semaine <small>· nouveaux dans {left(msToWeekEnd(new Date()))}</small></h3>
        <ul>
          {PVP_GOALS.map((g) => {
            const v = Math.min(g.target, g.value(a, w)), done = w.claimed.includes(g.id), ready = !done && v >= g.target
            return (
              <li key={g.id} className={`ct ${ready ? 'is-ready' : ''} ${done ? 'is-done' : ''}`}>
                <div className="ct__main"><b>{g.title}</b><div className="ct__bar"><i style={{ width: `${(v / g.target) * 100}%` }} /></div><small>{n(v)} / {n(g.target)}</small></div>
                <span className="rw"><span><Coin name="soul" size={18} />{g.gems}</span>{g.tickets ? <span><Coin name="seal" size={18} />{g.tickets}</span> : null}</span>
                {done ? <span className="ct__state">✓ Récupéré</span> : ready ? <button className="ct__claim" onClick={() => store.claimPvp(g.id)}>Récupérer</button> : <span className="ct__state">En cours</span>}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="ar-leagues">
        <h3 className="sp-sub">Les ligues</h3>
        <ol>{LEAGUES.map((l) => <li key={l.id} className={l.id === lg.id ? 'is-me' : ''} style={{ ['--rl' as string]: l.hue }}><Emblem id={l.id} size={58} /><b>{l.label}</b><small>{l.min ? `${n(l.min)}+` : 'départ'}</small></li>)}</ol>
      </section>

      <Guide id="arena" />
      {result && <Battle result={result} kicker={`Arène · ${leagueOf(result.rival.elo).label}`} title={result.rival.name}
        winBody={<p className="sp-win">+{result.delta} de cote ({n(result.elo)}) · +{WIN_SOULS} âmes</p>}
        loseBody={<p>{result.delta} de cote ({n(result.elo)}). Change d'équipe ou choisis un rival moins bien classé.</p>}
        onClose={() => setResult(null)} />}
    </div>
  )
}
