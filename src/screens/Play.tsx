import { useState } from 'react'
import { createPortal } from 'react-dom'
import { gateArt, heroArt } from '../assets/manifest'
import { ENERGY_OVER, ENERGY_REFILL, ENERGY_REFILL_COST, ENERGY_MAX, ENERGY_REGEN_MS, accountLevel, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_STAT, REBIRTH_XP } from '../game/progression'
import { useStore } from '../state/store'
import { Guide } from '../ui/Guide'
import { Avatar } from '../ui/Settings'
import { Saga } from './Saga'
import { Spire } from './Spire'
import { Colossus } from './Colossus'
import { Arena } from './Arena'
import { Raids, WorldBoss } from './WorldRaid'
import { Coin } from '../ui/Coin'
import { IconLock } from '../ui/icons'
import { LEVEL_STYLE_NAME, LevelBadge, levelStyle } from '../ui/LevelBadge'

// Les portes du Nexus. Aucune n'est encore ouverte : chaque fiche dit ce que le mode contiendra.
const GATES = [
  { id: 'saga', anime: 'naruto', model: 'Vita', numeral: 'I', kanji: '物語', title: 'L’Aventure', tag: 'Histoire', text: 'Traverse chaque univers, combat après combat. Gagne de l’XP, des Éclats et des parchemins.', hue: '#2bc8d9',
    points: ['Des chapitres à traverser avec ton équipe de cartes', 'Des combats au tour par tour avec les techniques de tes personnages', 'De l’XP de compte et des parchemins à chaque victoire'] },
  { id: 'raids', anime: 'onepiece', model: 'Darkness_Shibu', numeral: 'II', kanji: '巨人', title: 'Les Colosses', tag: 'Boss', text: 'Chaque semaine, un grand méchant devient un boss colossal. Quatre difficultés, jusqu’à Ultime.', hue: '#ff3d8b',
    points: ['Un nouveau Colosse chaque lundi', 'Normal, Difficile, Extrême et Ultime', 'Un événement de la semaine avec une carte SR ou mieux garantie'] },
  { id: 'spire', anime: 'hunter', model: 'Victoria_Rubin', numeral: 'III', kanji: '塔', title: 'La Tour de l’Infini', tag: 'Tour', text: 'Une tour sans fin, dont les règles changent à chaque étage.', hue: '#ffb829',
    points: ['Un étage après l’autre, de plus en plus dur', 'Une règle spéciale par étage', 'Des fragments d’âme pour libérer tes cartes'] },
  { id: 'arena', anime: 'dragonball', model: 'Sendagaya_Shibu', numeral: 'IV', kanji: '闘', title: 'L’Arène', tag: 'Duel', text: 'Des duels classés contre les Rivaux du Rift. Grimpe de Bronze à Légende.', hue: '#ff6a2b',
    points: ['Une cote elo et six ligues, de Bronze à Légende', '5 duels par jour et des défis chaque semaine', 'Les bonus d’Ascension n’y comptent pas : seul le talent parle'] },
  { id: 'world', art: 'raids', anime: 'bleach', model: 'Darkness_Shibu', numeral: 'V', kanji: '界', title: 'Boss mondial', tag: 'Tous ensemble', text: 'Tous les joueurs du Rift contre un seul boss chaque semaine.', hue: '#22d3ee',
    points: ['Une barre de PV commune à tout le monde', '3 essais par jour', 'Le classement des meilleurs frappeurs'] },
  { id: 'coop', art: 'arena', anime: 'jujutsu', model: 'Sendagaya_Shibu', numeral: 'VI', kanji: '共闘', title: 'Raids', tag: 'Coop à 3', text: 'Un groupe de 3 joueurs, 9 cartes et 30 minutes pour abattre un boss.', hue: '#7c5cff',
    points: ['Un code de groupe à partager', '3 combats par joueur', 'Le coffre du destin : Éclats garantis'] },
] as const

type Gate = (typeof GATES)[number]

// Niveau de compte requis pour ouvrir chaque mode. Après une Ascension, tout reste ouvert.
export const UNLOCK_LEVEL: Record<string, number> = { saga: 1, raids: 15, world: 15, arena: 20, spire: 25, coop: 30 }
export const modeOpen = (id: string, level: number, rebirths: number) => rebirths > 0 || level >= (UNLOCK_LEVEL[id] ?? 1)

// Mode encore fermé : image en noir et blanc floutée, cadenas, niveau requis et progression.
const LockedTile = ({ gate, level }: { gate: Gate; level: number }) => {
  const need = UNLOCK_LEVEL[gate.id]
  const anime = useStore().bannerArt[gate.anime]
  return (
    <div className="nx-lock" role="group" aria-label={`${gate.title} : débloqué au niveau ${need}`}>
      <img className="nx-lock__bg" src={anime || gateArt('art' in gate ? gate.art : gate.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="nx-lock__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1" /></svg></span>
      <b className="nx-lock__title">{gate.title}</b>
      <span className="nx-lock__need">Débloqué au niveau <em>{need}</em></span>
      <span className="nx-lock__bar"><i style={{ width: `${Math.min(100, (level / need) * 100)}%` }} /></span>
      <small>Encore {need - level} niveau{need - level > 1 ? 'x' : ''}</small>
    </div>
  )
}

// Une porte : panneau de verre noir, lueur à sa couleur, personnage en fondu devant le décor 3D de son mode.
const GateTile = ({ gate, featured, playable, onOpen }: { gate: Gate; featured?: boolean; playable?: boolean; onOpen: () => void }) => {
  // image officielle de l'animé (AniList, chargée par le navigateur) ; sans elle, le décor 3D et le personnage du jeu
  const anime = useStore().bannerArt[gate.anime]
  const [failed, setFailed] = useState(false)
  const show = Boolean(anime) && !failed
  return (
  <button className={`nx-gate ${featured ? 'nx-gate--hero' : ''} ${playable ? 'nx-gate--play' : ''} ${show ? 'nx-gate--anime' : ''}`} style={{ ['--hue' as string]: gate.hue }} onClick={onOpen} aria-label={`${gate.title} : ${playable ? 'jouer' : 'voir le mode'}`}>
    {show
      ? <img className="nx-gate__anime" src={anime} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <><img className="nx-gate__scene" src={gateArt('art' in gate ? gate.art : gate.id)} alt="" loading="lazy" /><img className="nx-gate__art" src={heroArt(gate.model, 'full')} alt="" loading="lazy" /></>}
    <span className="nx-gate__slash" aria-hidden="true" />
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
}

export const Play = ({ onRebirth, onProfile, start }: { onRebirth: () => void; onProfile: () => void; start?: 'saga' | 'spire' | 'colossus' | 'arena' }) => {
  const { accountXp, rebirths, energyLeft, profile, gems, buyEnergy } = useStore()
  const [open, setOpen] = useState<Gate | null>(null)
  const [saga, setSaga] = useState(start === 'saga')
  const [spire, setSpire] = useState(start === 'spire')
  const [colossus, setColossus] = useState(start === 'colossus')
  const [arena, setArena] = useState(start === 'arena')
  const [world, setWorld] = useState(false)
  const [coop, setCoop] = useState(false)
  const acc = accountLevel(accountXp, rebirths)
  const ok = (id: string) => modeOpen(id, acc.level, rebirths)
  if (world && ok('world')) return <WorldBoss onBack={() => { setWorld(false); window.scrollTo(0, 0) }} />
  if (coop && ok('coop')) return <Raids onBack={() => { setCoop(false); window.scrollTo(0, 0) }} />
  if (arena && ok('arena')) return <Arena onBack={() => { setArena(false); window.scrollTo(0, 0) }} />
  if (colossus && ok('raids')) return <Colossus onBack={() => { setColossus(false); window.scrollTo(0, 0) }} />
  if (spire && ok('spire')) return <Spire onBack={() => { setSpire(false); window.scrollTo(0, 0) }} />
  if (saga) return <Saga onBack={() => { setSaga(false); window.scrollTo(0, 0) }} />
  return (
    <div className="nx">
      <section className="energy" role="meter" aria-valuemin={0} aria-valuemax={ENERGY_MAX} aria-valuenow={energyLeft} aria-label="Flux">
        <div className="energy__row">
          <Coin name="bolt" size={34} />
          <b>{energyLeft}<i>/{ENERGY_MAX}</i></b>
          <span className="energy__pips">{Array.from({ length: ENERGY_MAX }, (_, i) => <i key={i} className={i < energyLeft ? 'is-on' : ''} />)}</span>
          <button className="energy__plus" onClick={buyEnergy} disabled={gems < ENERGY_REFILL_COST || energyLeft + ENERGY_REFILL > ENERGY_OVER} aria-label={`Recharger ${ENERGY_REFILL} éclairs pour ${ENERGY_REFILL_COST} Éclats`}>+</button>
        </div>
        {energyLeft > ENERGY_MAX && <p className="energy__bonus">Bonus : <b>+{energyLeft - ENERGY_MAX}</b> au-delà du maximum</p>}
        <p>Un éclair par combat · +1 toutes les {ENERGY_REGEN_MS / 60000} minutes. {energyLeft >= ENERGY_MAX ? 'Énergie pleine.' : 'Elle remonte toute seule.'} Elle se dépense dans L’Aventure. Le bouton + rend {ENERGY_REFILL} éclairs pour {ENERGY_REFILL_COST} Éclats (jusqu'à {ENERGY_OVER} en réserve).</p>
      </section>
      <header className="nx__head">
        <p className="eyebrow">Le Nexus</p>
        <h1>Six portes.<br />{GATES.every((g) => modeOpen(g.id, acc.level, rebirths)) ? 'Toutes sont ouvertes.' : 'Monte de niveau pour les ouvrir.'}</h1>
        <button className="nx__who" onClick={onProfile} aria-label="Voir mon profil"><Avatar size={40} /><b>{profile.name.trim() || 'Joueur'}</b><span>Voir mon profil →</span></button>
        <p className="nx__level"><LevelBadge level={acc.level} rebirths={rebirths} size={40} /><span>Style {LEVEL_STYLE_NAME[levelStyle(acc.level, rebirths)]} · {acc.need ? `${acc.into.toLocaleString('fr-FR')} / ${acc.need.toLocaleString('fr-FR')} XP de compte` : 'Niveau maximum'}</span></p>
      </header>
      <GateTile gate={GATES[0]} featured playable onOpen={() => { setSaga(true); window.scrollTo(0, 0) }} />
      <div className="nx__row">
        {GATES.slice(1).map((g) => !modeOpen(g.id, acc.level, rebirths) ? <LockedTile key={g.id} gate={g} level={acc.level} /> : <GateTile key={g.id} gate={g} playable onOpen={() => { if (g.id === 'spire') setSpire(true); else if (g.id === 'raids') setColossus(true); else if (g.id === 'world') setWorld(true); else if (g.id === 'coop') setCoop(true); else setArena(true); window.scrollTo(0, 0) }} />)}
      </div>

      {/* Ascension : tout en bas du Nexus */}
      <section className="nx-rebirth">
        <img className="nx-rebirth__art" src={gateArt('rebirth')} alt="" loading="lazy" />
        <header><span lang="ja" aria-hidden="true">転生</span><div><h2>Ascension</h2><p>Recommence plus fort, pour toujours.</p></div></header>
        <h3>Tu gagnes pour toujours</h3>
        <ul>
          <li>+{REBIRTH_STAT} % de PV, d'attaque et de défense sur toutes tes cartes</li>
          <li>+{REBIRTH_XP} % d'XP pour tes cartes</li>
          <li>Des Clés de Faille et une partie de tes Éclats dépensées</li>
          <li>Des titres exclusifs selon ton nombre d’Ascensions</li>
        </ul>
        <h3>Tu gardes</h3>
        <p>{REBIRTH_KEEP} cartes de ton choix, tes sceaux, tes parchemins et ta liste d'envies.</p>
        <h3>Repart à zéro</h3>
        <p>Toutes tes autres cartes, ton niveau de compte et ton solde d’Éclats.</p>
        <p className="nx-rebirth__old">Anciennes bannières : aucune pour l'instant. Elles reviendront ici pour les joueurs renés.</p>
        <button className="nx-rebirth__btn" onClick={onRebirth}>Voir l’Ascension {acc.level >= REBIRTH_LEVEL ? '(tu es prêt)' : `(niveau ${REBIRTH_LEVEL} requis, tu es niveau ${acc.level})`}</button>
      </section>

      <Guide id="play" />
      {open && createPortal(
        <div className="modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="modal__box gate-sheet" style={{ ['--hue' as string]: open.hue }} onClick={(e) => e.stopPropagation()}>
            <div className="gate-sheet__art"><img src={gateArt('art' in open ? open.art : open.id)} alt="" /><span lang="ja" aria-hidden="true">{open.kanji}</span></div>
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
