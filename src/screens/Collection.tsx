import { useState } from 'react'
import { HEROES, type Hero } from '../data/heroes'
import { fileToCardImage } from '../state/customArt'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'

// Bouton « Mon image » : le joueur choisit une image sur son appareil pour illustrer la carte.
const ArtPicker = ({ hero }: { hero: Hero }) => {
  const { customArt, setCustomArt, clearCustomArt } = useStore()
  const [error, setError] = useState('')
  const inputId = `art-${hero.id}`

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const ok = await setCustomArt(hero.id, await fileToCardImage(file))
      if (!ok) setError("Image affichée, mais pas enregistrée sur cet appareil.")
    } catch {
      setError("Cette image n'a pas pu être lue.")
    }
  }

  return (
    <div className="artpick">
      <label className="artpick__btn" htmlFor={inputId}>{customArt[hero.id] ? "Changer l'image" : 'Mon image'}</label>
      <input id={inputId} className="artpick__input" type="file" accept="image/*" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      {customArt[hero.id] && <button className="artpick__btn artpick__btn--ghost" onClick={() => clearCustomArt(hero.id)}>Retirer</button>}
      {error && <p className="artpick__error" role="alert">{error}</p>}
    </div>
  )
}

export const Collection = ({ onSummon }: { onSummon: () => void }) => {
  const { owned } = useStore()
  const have = HEROES.filter((h) => owned[h.id]).length
  return (
    <div className="collection">
      <header className="section__head"><span>{String(have).padStart(2, '0')}</span><div><h2>Collection</h2><p>{have} carte{have > 1 ? 's' : ''} sur {HEROES.length} obtenue{have > 1 ? 's' : ''}.</p></div></header>
      <div className="bar bar--wide"><i style={{ width: `${(have / HEROES.length) * 100}%` }} /></div>
      <p className="collection__hint">« Mon image » remplace l'illustration d'une carte par une image de votre appareil. Elle reste sur cet appareil.</p>
      <div className="collection__grid">
        {HEROES.map((h) => (
          <div key={h.id} className="collection__item">
            <Card hero={h} count={owned[h.id]} locked={!owned[h.id]} />
            <ArtPicker hero={h} />
          </div>
        ))}
      </div>
      {have === 0 && <button className="btn btn--gold collection__cta" onClick={onSummon}>Faire une première invocation</button>}
    </div>
  )
}
