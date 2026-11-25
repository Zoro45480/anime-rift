import { heroById } from '../data/heroes'
import { heroArt } from '../assets/manifest'
import { IconLock } from '../ui/icons'

// Les portes du Nexus. Aucune n'est encore ouverte : chacune annonce la phase du plan où elle le sera.
const GATES = [
  { id: 'saga', numeral: 'I', title: 'La Saga', text: 'Vis la Saga I — La Fracture, chapitre après chapitre.', phase: 11, hue: '#2bb7c9', hero: 'lyss' },
  { id: 'raids', numeral: 'II', title: 'Les Colosses', text: 'Des boss à plusieurs phases qui demandent une vraie préparation.', phase: 12, hue: '#b0306e', hero: 'mirelle' },
  { id: 'tower', numeral: 'III', title: 'La Spire', text: 'Une tour sans fin, dont les règles changent à chaque étage.', phase: 12, hue: '#c98a1e', hero: 'celestine' },
  { id: 'arena', numeral: 'IV', title: "L'Arène", text: 'Affronte les équipes des autres joueurs.', phase: 15, hue: '#e8502f', hero: 'akane' },
]

export const Play = () => (
  <div className="nexus">
    <header className="nexus__head">
      <p className="eyebrow">Le Nexus</p>
      <h1>Quatre portes.<br />Une seule s'ouvre à la fois.</h1>
    </header>
    <div className="gates">
      {GATES.map((g, i) => (
        <article key={g.id} className={`gate ${i % 2 ? 'gate--flip' : ''}`} style={{ ['--hue' as string]: g.hue }} aria-disabled="true">
          <div className="gate__panel">
            <span className="gate__numeral" aria-hidden="true">{g.numeral}</span>
            <div className="gate__text">
              <h2>{g.title}</h2>
              <p>{g.text}</p>
              <span className="gate__lock"><IconLock />Ouverture · phase {g.phase}</span>
            </div>
          </div>
          <img className="gate__art" src={heroArt(heroById(g.hero).model, 'full')} alt="" loading="lazy" />
        </article>
      ))}
    </div>
    <p className="nexus__note">Ces modes ne sont pas encore jouables. Le numéro de phase indique quand chacun le deviendra.</p>
  </div>
)
