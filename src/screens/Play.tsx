import { heroById } from '../data/heroes'
import { heroArt } from '../assets/manifest'
import { IconCompass, IconLock, IconSwords, IconTower } from '../ui/icons'

// Modes de jeu. Aucun n'est encore jouable : chaque tuile annonce la phase où il le deviendra.
const MODES = [
  { id: 'adventure', title: 'Aventure', text: 'Explore les mondes et vis la Saga I — La Fracture.', phase: 11, icon: <IconCompass />, hue: '#e8502f', word: 'SAGA I', cast: ['ren', 'akane', 'lyss', 'kaito', 'shizu'] },
  { id: 'raids', title: 'Raids', text: 'Des boss à plusieurs phases qui demandent une vraie préparation.', phase: 12, icon: <IconSwords />, hue: '#b0306e', word: '', cast: ['mirelle'] },
  { id: 'tower', title: 'Tour infinie', text: 'Étage après étage, des règles qui changent.', phase: 12, icon: <IconTower />, hue: '#3d4a8f', word: '', cast: ['celestine', 'poppy'] },
]

export const Play = () => (
  <div className="play">
    <header className="play__head">
      <h1><span>Jouer</span></h1>
      <p>Choisis ton prochain défi.</p>
    </header>
    <div className="modes">
      {MODES.map((m) => (
        <article key={m.id} className={`mode mode--${m.id}`} style={{ ['--hue' as string]: m.hue }} aria-disabled="true">
          <div className="mode__art">
            {m.word && <span className="mode__word" aria-hidden="true">{m.word}</span>}
            {m.cast.map((id) => <img key={id} src={heroArt(heroById(id).model, 'full')} alt="" loading="lazy" />)}
          </div>
          <div className="mode__info">
            <i>{m.icon}</i>
            <div><h2>{m.title}</h2><p>{m.text}</p></div>
            <span className="mode__lock"><IconLock />Phase {m.phase}</span>
          </div>
        </article>
      ))}
    </div>
    <p className="play__note">Ces modes ne sont pas encore jouables. Le numéro indique la phase du plan où chacun le deviendra.</p>
  </div>
)
