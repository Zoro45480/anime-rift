import { logoArt } from '../assets/manifest'

// Écran titre : le logo 3D en grand, puis l'entrée dans le jeu.
export const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="splash">
    <div className="splash__beam" aria-hidden="true" />
    <img className="splash__logo" src={logoArt('full')} alt="ANIME RIFT" />
    <p className="splash__tag">Les mondes se fracturent. Rassemble ceux qui tiendront.</p>
    <button className="btn btn--gold splash__btn" onClick={onEnter} autoFocus>Entrer dans la faille</button>
  </div>
)
