import { uiArt, type UiName } from '../assets/manifest'

// Thème anime : met les images de l'habillage (plaques de boutons, cadre des panneaux, fond) à disposition
// de la feuille de style, sous forme de variables --ui-<nom>. Appelé une fois au démarrage.
const NAMES: UiName[] = ['bg', 'btn-gold', 'btn-pink', 'btn-indigo', 'btn-ghost', 'panel']

export const installTheme = () => {
  for (const name of NAMES) document.documentElement.style.setProperty(`--ui-${name}`, `url("${uiArt(name)}")`)
}
