import { useState } from 'react'
import { HEROES, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
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

// Anneau de progression de la collection.
const Ring = ({ value, total }: { value: number; total: number }) => {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="col-ring" role="img" aria-label={`${value} cartes sur ${total}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs><linearGradient id="col-ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9b7bff" /><stop offset="1" stopColor="#5ee6ff" /></linearGradient></defs>
        <circle cx="50" cy="50" r={r} className="col-ring__track" />
        <circle cx="50" cy="50" r={r} className="col-ring__fill" stroke="url(#col-ring-g)" strokeDasharray={c} strokeDashoffset={c * (1 - value / total)} />
      </svg>
      <b>{Math.round((value / total) * 100)}<i>%</i></b>
    </div>
  )
}

export const Collection = ({ onSummon }: { onSummon: () => void }) => {
  const { owned } = useStore()
  const have = HEROES.filter((h) => owned[h.id]).length
  const groups = RARITY_ORDER.map((id) => ({ rarity: RARITIES[id], cards: HEROES.filter((h) => h.rarity === id) })).filter((g) => g.cards.length > 0)

  return (
    <div className="col">
      <header className="col__head">
        <div>
          <p className="eyebrow">Collection</p>
          <h1 className="section__head-title"><b>{String(have).padStart(2, '0')}</b><i> / {String(HEROES.length).padStart(2, '0')}</i></h1>
          <p className="col__sub section__head-sub">{have} carte{have > 1 ? 's' : ''} sur {HEROES.length} obtenue{have > 1 ? 's' : ''}.</p>
        </div>
        <Ring value={have} total={HEROES.length} />
      </header>

      <div className="col__tally" aria-label="Cartes obtenues par rareté">
        {groups.map(({ rarity, cards }) => (
          <span key={rarity.id} style={{ ['--rc' as string]: rarity.color }}><b>{rarity.short}</b>{cards.filter((h) => owned[h.id]).length}/{cards.length}</span>
        ))}
      </div>

      <p className="col__hint">« Mon image » remplace l'illustration d'une carte par une image de votre appareil. Elle reste sur cet appareil.</p>

      <div className="col__groups">
      {groups.map(({ rarity, cards }) => (
        <section key={rarity.id} className="col-group" style={{ ['--rc' as string]: rarity.color }}>
          <header className="col-group__head">
            <b>{rarity.short}</b><span>{rarity.label}</span><i />
            <em>{cards.filter((h) => owned[h.id]).length} / {cards.length}</em>
          </header>
          <div className="col-group__grid">
            {cards.map((h) => (
              <div key={h.id} className="col-item">
                <Card hero={h} count={owned[h.id]} locked={!owned[h.id]} />
                <ArtPicker hero={h} />
              </div>
            ))}
          </div>
        </section>
      ))}
      </div>

      {have === 0 && <button className="btn btn--gold col__cta" onClick={onSummon}>Faire une première invocation</button>}
    </div>
  )
}
