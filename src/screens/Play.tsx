import { useState } from 'react'
import { createPortal } from 'react-dom'
import { gateArt, heroArt } from '../assets/manifest'
import { ENERGY_OVER, ENERGY_REFILL, ENERGY_REFILL_COST, ENERGY_MAX, ENERGY_REGEN_MS, accountLevel, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_STAT, REBIRTH_XP } from '../game/progression'
import { useStore } from '../state/store'
import { Guide } from '../ui/Guide'
import { Avatar } from '../ui/Settings'
import { Saga } from './Saga'
import { Coin } from '../ui/Coin'
import { IconLock } from '../ui/icons'
import { LEVEL_STYLE_NAME, LevelBadge, levelStyle } from '../ui/LevelBadge'

// Les portes du Nexus. Aucune n'est encore ouverte : chaque fiche dit ce que le mode contiendra.
const GATES = [
  { id: 'saga', model: 'Vita', numeral: 'I', kanji: '物語', title: 'La Saga', tag: 'Histoire', text: 'Traverse chaque univers, combat après combat. Gagne de l’XP, des âmes et des parchemins.', hue: '#2bc8d9',
    points: ['Des chapitres à traverser avec ton équipe de cartes', 'Des combats au tour par tour avec les techniques de tes personnages', 'De l’XP de compte et des parchemins à chaque victoire'] },
  { id: 'raids', model: 'Darkness_Shibu', numeral: 'II', kanji: '巨人', title: 'Les Colosses', tag: 'Boss', text: 'Des boss à plusieurs phases qui demandent une vraie préparation.', hue: '#ff3d8b',
    points: ['Des boss géants qui changent de comportement à chaque phase', 'Tanks, DPS et soigneurs deviennent tous utiles', 'Des coffres de raid à ouvrir dans ton inventaire'] },
  { id: 'spire', model: 'Victoria_Rubin', numeral: 'III', kanji: '塔', title: 'La Spire', tag: 'Tour', text: 'Une tour sans fin, dont les règles changent à chaque étage.', hue: '#ffb829',
    points: ['Un étage après l’autre, de plus en plus dur', 'Une règle spéciale par étage', 'Jusqu’où ira ta meilleure équipe ?'] },
  { id: 'arena', model: 'Sendagaya_Shibu', numeral: 'IV', kanji: '闘', title: 'L’Arène', tag: 'Duel', text: 'Affronte les équipes des autres joueurs.', hue: '#ff6a2b',
    points: ['Ton équipe contre celle d’un autre joueur', 'Un classement à grimper', 'Les bonus de Renaissance n’y comptent pas : seul le talent parle'] },
] as const

type Gate = (typeof GATES)[number]

// Une porte : panneau de verre noir, lueur à sa couleur, personnage en fondu devant le décor 3D de son mode.
const GateTile = ({ gate, featured, playable, onOpen }: { gate: Gate; featured?: boolean; playable?: boolean; onOpen: () => void }) => (
  <button className={`nx-gate ${featured ? 'nx-gate--hero' : ''} ${playable ? 'nx-gate--play' : ''}`} style={{ ['--hue' as string]: gate.hue }} onClick={onOpen} aria-label={`${gate.title} : ${playable ? 'jouer' : 'voir le mode'}`}>
    <img className="nx-gate__scene" src={gateArt(gate.id)} alt="" loading="lazy" />
    <img className="nx-gate__art" src={heroArt(gate.model, 'full')} alt="" loading="lazy" />
    <span className="nx-gate__numeral" aria-hidden="true">{gate.numeral}</span>
    <span className="nx-gate__kanji" lang="ja" aria-hidden="true">{gate.kanji}</span>
    <span className="nx-gate__shine" aria-hidden="true" />
    <span className="nx-gate__text">
      <span className="nx-gate__kicker">Porte {gate.numeral} · {gate.tag}</span>
      <span className="nx-gate__title">{gate.title}</span>
      <span className="nx-gate__desc">{gate.text}</span>
      <span className="nx-gate__lock">{playable ? '▶ Jouer' : <><IconLock />Bientôt · voir le mode</>}</span>
    </span>
  </button>
)

export const Play = ({ onRebirth }: { onRebirth: () => void }) => {
  const { accountXp, rebirths, energyLeft, profile, gems, buyEnergy } = useStore()
  const [open, setOpen] = useState<Gate | null>(null)
  const [saga, setSaga] = useState(false)
  const acc = accountLevel(accountXp, rebirths)
  if (saga) return <Saga onBack={() => { setSaga(false); window.scrollTo(0, 0) }} />
  return (
    <div className="nx">
      <section className="energy" role="meter" aria-valuemin={0} aria-valuemax={ENERGY_MAX} aria-valuenow={energyLeft} aria-label="Énergie">
        <div className="energy__row">
          <Coin name="bolt" size={34} />
          <b>{energyLeft}<i>/{ENERGY_MAX}</i></b>
          <span className="energy__pips">{Array.from({ length: ENERGY_MAX }, (_, i) => <i key={i} className={i < energyLeft ? 'is-on' : ''} />)}</span>
          <button className="energy__plus" onClick={buyEnergy} disabled={gems < ENERGY_REFILL_COST || energyLeft + ENERGY_REFILL > ENERGY_OVER} aria-label={`Recharger ${ENERGY_REFILL} éclairs pour ${ENERGY_REFILL_COST} âmes`}>+</button>
        </div>
        {energyLeft > ENERGY_MAX && <p className="energy__bonus">Bonus : <b>+{energyLeft - ENERGY_MAX}</b> au-delà du maximum</p>}
        <p>Un éclair par combat · +1 toutes les {ENERGY_REGEN_MS / 60000} minutes. {energyLeft >= ENERGY_MAX ? 'Énergie pleine.' : 'Elle remonte toute seule.'} Elle se dépense dans La Saga. Le bouton + rend {ENERGY_REFILL} éclairs pour {ENERGY_REFILL_COST} âmes (jusqu'à {ENERGY_OVER} en réserve).</p>
      </section>
      <header className="nx__head">
        <p className="eyebrow">Le Nexus</p>
        <h1>Quatre portes.<br />Une seule s'ouvre à la fois.</h1>
        <p className="nx__who"><Avatar size={40} /><b>{profile.name.trim() || 'Joueur'}</b></p>
        <p className="nx__level"><LevelBadge level={acc.level} rebirths={rebirths} size={40} /><span>Style {LEVEL_STYLE_NAME[levelStyle(acc.level, rebirths)]} · {acc.need ? `${acc.into.toLocaleString('fr-FR')} / ${acc.need.toLocaleString('fr-FR')} XP de compte` : 'Niveau maximum'}</span></p>
      </header>
      <GateTile gate={GATES[0]} featured playable onOpen={() => { setSaga(true); window.scrollTo(0, 0) }} />
      <div className="nx__row">
        {GATES.slice(1).map((g) => <GateTile key={g.id} gate={g} onOpen={() => setOpen(g)} />)}
      </div>

      {/* Renaissance : tout en bas du Nexus */}
      <section className="nx-rebirth">
        <img className="nx-rebirth__art" src={gateArt('rebirth')} alt="" loading="lazy" />
        <header><span lang="ja" aria-hidden="true">転生</span><div><h2>Renaissance</h2><p>Recommence plus fort, pour toujours.</p></div></header>
        <h3>Tu gagnes pour toujours</h3>
        <ul>
          <li>+{REBIRTH_STAT} % de PV, d'attaque et de défense sur toutes tes cartes</li>
          <li>+{REBIRTH_XP} % d'XP pour tes cartes</li>
          <li>Des sceaux d'invocation et une partie de tes âmes dépensées</li>
          <li>Des titres exclusifs selon ton nombre de Renaissances</li>
        </ul>
        <h3>Tu gardes</h3>
        <p>{REBIRTH_KEEP} cartes de ton choix, tes sceaux, tes parchemins et ta liste d'envies.</p>
        <h3>Repart à zéro</h3>
        <p>Toutes tes autres cartes, ton niveau de compte et ton solde d'âmes.</p>
        <p className="nx-rebirth__old">Anciennes bannières : aucune pour l'instant. Elles reviendront ici pour les joueurs renés.</p>
        <button className="nx-rebirth__btn" onClick={onRebirth}>Voir la Renaissance {acc.level >= REBIRTH_LEVEL ? '(tu es prêt)' : `(niveau ${REBIRTH_LEVEL} requis, tu es niveau ${acc.level})`}</button>
      </section>

      <Guide id="play" />
      {open && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="modal__box gate-sheet" style={{ ['--hue' as string]: open.hue }} onClick={(e) => e.stopPropagation()}>
            <div className="gate-sheet__art"><img src={gateArt(open.id)} alt="" /><span lang="ja" aria-hidden="true">{open.kanji}</span></div>
            <p className="gate__kicker">Porte {open.numeral} · {open.tag}</p>
            <h2>{open.title}</h2>
            <p className="gate-sheet__desc">{open.text}</p>
            <ul>{open.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="gate-sheet__lock"><IconLock />Ce mode n'est pas encore jouable. Il est en préparation.</p>
            <button className="btn" onClick={() => setOpen(null)}>Fermer</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
