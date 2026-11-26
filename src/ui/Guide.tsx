import { useState } from 'react'
import { createPortal } from 'react-dom'
import { extraArt } from '../assets/manifest'
import { useStore } from '../state/store'

// Kiri, l'esprit de la faille : il explique chaque écran la première fois qu'on l'ouvre.
// Son animation est une vraie animation 3D rendue dans Blender (16 images jouées en boucle).
const TALKS: Record<string, { title: string; lines: string[] }> = {
  banners: { title: 'Les invocations', lines: [
    'Salut ! Moi c’est Kiri, l’esprit de la faille. Ici tu invoques de nouvelles cartes.',
    'Choisis une bannière, puis ×1, ×5 ou ×10. Un sceau ou 30 âmes par invocation.',
    'Les cartes MR sont très rares. Au bout de 50 invocations sans carte SSR ou mieux, la suivante est garantie.',
  ] },
  play: { title: 'Le Nexus', lines: [
    'Voici le Nexus : chaque porte est un mode de jeu. La Saga est ouverte, les autres arrivent.',
    'Un combat coûte un éclair. Tes éclairs reviennent tout seuls, un toutes les 6 minutes.',
    'Tout en bas, la Renaissance : au niveau 100, tu repars de zéro mais plus fort, pour toujours.',
  ] },
  saga: { title: 'La Saga', lines: [
    'Forme une équipe de 3 cartes. Un tank protège, un soigneur soigne, un DPS frappe fort.',
    'Mets ensemble des cartes du même collectif (Équipe 7, Chapeaux de paille…) : elles gagnent un bonus.',
    'Chaque victoire donne de l’XP, des âmes pour tes nouvelles étoiles, et parfois un parchemin.',
  ] },
  bazaar: { title: 'Le Bazar', lines: [
    'Bienvenue au Bazar des Failles ! Chaque jour, des marchands proposent 8 cartes. Celles de ta liste d’envies passent en premier.',
    'Tes doublons se vendent ici : tout de suite pour 60 % de leur valeur, ou aux enchères pendant 4 heures pour espérer plus.',
    'Dans « Mon Bazar », crée des alertes de prix et suis la cote de tes cartes, calculée sur tes vraies ventes.',
  ] },
  arena: { title: 'L’Arène', lines: [
    'Bienvenue dans l’Arène ! Ici tu affrontes les Rivaux du Rift, des équipes jouées par le jeu et réglées sur ta force.',
    'Gagner te fait monter ta cote, perdre la fait baisser. Bats un rival mieux classé pour gagner plus de points !',
    'Tu as 5 duels par jour. Grimpe de Bronze jusqu’à Légende, et fais les défis de la semaine pour des âmes et des sceaux.',
  ] },
  colossus: { title: 'Les Colosses', lines: [
    'Voici le Colosse de la semaine ! Un grand méchant, beaucoup plus solide que d’habitude, avec deux sbires.',
    'Bats-le en Normal pour ouvrir Difficile, puis Extrême et Ultime. Chaque difficulté donne sa récompense une fois par semaine.',
    'Tu as 3 essais par jour. Fais les trois objectifs de l’événement pour gagner une carte SR ou mieux !',
  ] },
  spire: { title: 'La Spire', lines: [
    'Bienvenue dans La Spire ! Une tour sans fin : chaque étage est plus dur que le précédent.',
    'Lis bien la règle de l’étage : parfois elle aide tes Tanks, tes DPS ou tes Soigneurs. Change ton équipe pour en profiter !',
    'Les combats sont gratuits. Tous les 10 étages, un gardien t’attend avec des fragments d’âme pour libérer tes cartes.',
  ] },
  contracts: { title: 'Les Contrats', lines: [
    'Ici, tes objectifs. Chaque jour, une récompense t’attend : reviens sept jours de suite pour ouvrir le coffre.',
    'Les contrats du jour et de la semaine se remplissent tout seuls en jouant : invoquer, combattre, améliorer tes cartes.',
    'Quand une barre est pleine, touche « Récupérer ». Chaque contrat fait aussi avancer le Chemin du Rift : une récompense par palier, et une carte tous les 10 paliers !',
    'Le Parcours, lui, garde tes records pour toujours.',
  ] },
  collection: { title: 'La Collection', lines: [
    'Toutes tes cartes sont ici. Touche une carte, retourne-la, puis « En savoir plus » pour sa fiche.',
    'Sur la fiche : fusionne tes doublons, utilise tes parchemins et gagne les titres de son univers.',
    'L’onglet Inventaire montre tes objets ; l’onglet Renaissance, ce qui t’attend au niveau 100.',
  ] },
}

export const Kiri = ({ size = 120 }: { size?: number }) => (
  <span className="kiri" style={{ width: size, height: size, backgroundImage: `url(${extraArt('guide')})` }} role="img" aria-label="Kiri, l'esprit de la faille" />
)

export const Guide = ({ id }: { id: keyof typeof TALKS }) => {
  const { tutorialSeen, seeTutorial } = useStore()
  const [step, setStep] = useState(0)
  if (tutorialSeen.includes(id)) return null
  const talk = TALKS[id]
  const last = step >= talk.lines.length - 1
  // posé directement sur la page : à l'intérieur d'un écran animé, un élément « fixe » partirait avec lui hors de vue
  return createPortal(
    <aside className="guide" role="dialog" aria-label={`Explications : ${talk.title}`}>
      <Kiri />
      <div className="guide__bubble">
        <small>Kiri · {talk.title} · {step + 1}/{talk.lines.length}</small>
        <p key={step}>{talk.lines[step]}</p>
        <div className="guide__actions">
          <button className="linkbtn" onClick={() => seeTutorial(id)}>Passer</button>
          <button className="guide__next" onClick={() => (last ? seeTutorial(id) : setStep(step + 1))}>{last ? 'Compris !' : 'Suivant →'}</button>
        </div>
      </div>
    </aside>,
    document.body,
  )
}
