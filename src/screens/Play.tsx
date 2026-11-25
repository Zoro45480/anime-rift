import { heroById } from '../data/heroes'
import { heroArt } from '../assets/manifest'
import { IconLock } from '../ui/icons'

// Les portes du Nexus. Aucune n'est encore ouverte : chacune annonce la phase du plan où elle le sera.
const GATES = [
  { id: 'saga', numeral: 'I', title: 'La Saga', text: 'Vis la Saga I — La Fracture, chapitre après chapitre.', phase: 11, hue: '#2bb7c9', hero: 'lyss' },
  { id: 'raids', numeral: 'II', title: 'Les Colosses', text: 'Des boss à plusieurs phases qui demandent une vraie préparation.', phase: 12, hue: '#d0457f', hero: 'mirelle' },
  { id: 'tower', numeral: 'III', title: 'La Spire', text: 'Une tour sans fin, dont les règles changent à chaque étage.', phase: 12, hue: '#e0a52a', hero: 'celestine' },
  { id: 'arena', numeral: 'IV', title: "L'Arène", text: 'Affronte les équipes des autres joueurs.', phase: 15, hue: '#ff6a3d', hero: 'akane' },
]

type Gate = (typeof GATES)[number]

// Une porte : panneau de verre noir, lueur à sa couleur, personnage en fondu.
const GateTile = ({ gate, featured }: { gate: Gate; featured?: boolean }) => (
  <article className={`nx-gate ${featured ? 'nx-gate--hero' : ''}`} style={{ ['--hue' as string]: gate.hue }} aria-disabled="true">
    <img className="nx-gate__art" src={heroArt(heroById(gate.hero).model, 'full')} alt="" loading="lazy" />
    <span className="nx-gate__numeral" aria-hidden="true">{gate.numeral}</span>
    <div className="nx-gate__text">
      <p className="nx-gate__kicker">Porte {gate.numeral}</p>
      <h2>{gate.title}</h2>
      <p className="nx-gate__desc">{gate.text}</p>
      <span className="nx-gate__lock"><IconLock />Ouverture · phase {gate.phase}</span>
    </div>
  </article>
)

export const Play = () => (
  <div className="nx">
    <header className="nx__head">
      <p className="eyebrow">Le Nexus</p>
      <h1>Quatre portes.<br />Une seule s'ouvre à la fois.</h1>
    </header>
    <GateTile gate={GATES[0]} featured />
    <div className="nx__row">
      {GATES.slice(1).map((g) => <GateTile key={g.id} gate={g} />)}
    </div>
    <p className="nx__note">Ces modes ne sont pas encore jouables. Le numéro de phase indique quand chacun le deviendra.</p>
  </div>
)
