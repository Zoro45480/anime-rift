import { useState, type FormEvent } from 'react'
import { HEROES, type Hero } from '../data/heroes'
import { AFFINITY_LIST, type AffinityId } from '../data/affinities'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import { fileToCardImage } from '../state/customArt'
import { useStore } from '../state/store'
import { AffinityIcon } from '../ui/AffinityIcon'
import { Card } from '../ui/Card'

// Vérifie qu'un lien mène bien à une image que le navigateur peut afficher.
const canLoad = (url: string) =>
  new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })

// Illustration personnelle d'une carte : une image de l'appareil (« Mon image ») ou l'adresse d'une image en ligne
// (« Lien d'image »). Avec un lien, rien n'est copié dans le jeu : c'est le navigateur du joueur qui charge l'image.
const ArtPicker = ({ hero }: { hero: Hero }) => {
  const { customArt, setCustomArt, clearCustomArt } = useStore()
  const [error, setError] = useState('')
  const [linking, setLinking] = useState(false)
  const [link, setLink] = useState('')
  const [checking, setChecking] = useState(false)
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

  const onLink = async (e: FormEvent) => {
    e.preventDefault()
    const url = link.trim()
    setError('')
    if (!/^https?:\/\/\S+$/i.test(url)) return setError('Collez une adresse complète, qui commence par https://')
    setChecking(true)
    const loads = await canLoad(url)
    setChecking(false)
    if (!loads) return setError("Ce lien n'a pas pu être chargé comme image (adresse incorrecte, ou site qui bloque l'affichage ailleurs).")
    const ok = await setCustomArt(hero.id, url)
    if (!ok) setError('Image affichée, mais lien non enregistré sur cet appareil.')
    setLinking(false)
    setLink('')
  }

  return (
    <div className="artpick">
      <label className="artpick__btn" htmlFor={inputId}>{customArt[hero.id] ? "Changer l'image" : 'Mon image'}</label>
      <input id={inputId} className="artpick__input" type="file" accept="image/*" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      <button className="artpick__btn" aria-expanded={linking} onClick={() => { setLinking(!linking); setError('') }}>Lien d'image</button>
      {customArt[hero.id] && <button className="artpick__btn artpick__btn--ghost" onClick={() => clearCustomArt(hero.id)}>Retirer</button>}
      {linking && (
        <form className="artpick__link" onSubmit={(e) => void onLink(e)}>
          <label htmlFor={`link-${hero.id}`}>Adresse de l'image pour {hero.name}</label>
          <input id={`link-${hero.id}`} type="url" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} autoFocus />
          <button className="artpick__btn" type="submit" disabled={checking}>{checking ? 'Vérification…' : 'Valider'}</button>
        </form>
      )}
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

type OwnedFilter = 'all' | 'owned' | 'missing'
const OWNED_LABELS: Record<OwnedFilter, string> = { all: 'Toutes', owned: 'Obtenues', missing: 'Manquantes' }

// Ignore la casse et les accents, pour que « celestine » trouve « Célestine ».
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

export const Collection = ({ onSummon }: { onSummon: () => void }) => {
  const { owned } = useStore()
  const [query, setQuery] = useState('')
  const [rarities, setRarities] = useState<RarityId[]>([]) // vide = toutes
  const [affinities, setAffinities] = useState<AffinityId[]>([]) // vide = toutes
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all')

  const have = HEROES.filter((h) => owned[h.id]).length
  const q = fold(query.trim())
  const visible = HEROES.filter((h) =>
    (rarities.length === 0 || rarities.includes(h.rarity)) &&
    (affinities.length === 0 || affinities.includes(h.affinity)) &&
    (ownedFilter === 'all' || (ownedFilter === 'owned') === Boolean(owned[h.id])) &&
    (q === '' || fold(`${h.name} ${h.title} ${h.world} ${h.role}`).includes(q)))
  const filtering = q !== '' || rarities.length > 0 || affinities.length > 0 || ownedFilter !== 'all'
  const reset = () => { setQuery(''); setRarities([]); setAffinities([]); setOwnedFilter('all') }

  const all = RARITY_ORDER.map((id) => ({ rarity: RARITIES[id], cards: HEROES.filter((h) => h.rarity === id) })).filter((g) => g.cards.length > 0)
  const groups = all.map((g) => ({ ...g, shown: g.cards.filter((h) => visible.includes(h)) })).filter((g) => g.shown.length > 0)
  const usedAffinities = AFFINITY_LIST.filter((a) => HEROES.some((h) => h.affinity === a.id))

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

      <section className="filters" aria-label="Filtres de la collection">
        <div className="filters__search">
          <label htmlFor="col-search" className="filters__label">Recherche</label>
          <input id="col-search" type="search" placeholder="Nom, titre, univers ou rôle…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="filters__row">
          <span className="filters__label">Rareté</span>
          <div className="filters__chips">
            {all.map(({ rarity, cards }) => (
              <button key={rarity.id} className={`fchip ${rarities.includes(rarity.id) ? 'is-on' : ''}`} style={{ ['--rc' as string]: rarity.color }}
                aria-pressed={rarities.includes(rarity.id)} onClick={() => setRarities(toggle(rarities, rarity.id))}>
                <b>{rarity.short}</b>{cards.filter((h) => owned[h.id]).length}/{cards.length}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label">Affinité</span>
          <div className="filters__chips">
            {usedAffinities.map((a) => (
              <button key={a.id} className={`fchip fchip--affinity ${affinities.includes(a.id) ? 'is-on' : ''}`} style={{ ['--rc' as string]: a.color }}
                aria-pressed={affinities.includes(a.id)} onClick={() => setAffinities(toggle(affinities, a.id))}>
                <AffinityIcon id={a.id} size={14} />{a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label">Cartes</span>
          <div className="filters__chips" role="radiogroup" aria-label="Possession">
            {(Object.keys(OWNED_LABELS) as OwnedFilter[]).map((id) => (
              <button key={id} role="radio" aria-checked={ownedFilter === id} className={`fchip ${ownedFilter === id ? 'is-on' : ''}`} onClick={() => setOwnedFilter(id)}>{OWNED_LABELS[id]}</button>
            ))}
          </div>
        </div>

        <div className="filters__foot">
          <p role="status">{visible.length} carte{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''} sur {HEROES.length}</p>
          {filtering && <button className="linkbtn" onClick={reset}>Réinitialiser les filtres</button>}
        </div>
      </section>

      <p className="col__hint">« Mon image » met une image de votre appareil sur une carte ; « Lien d'image » utilise l'adresse d'une image en ligne, chargée par votre navigateur. Ce choix reste sur cet appareil.</p>

      {groups.length === 0 && (
        <div className="col__empty">
          <p>Aucune carte ne correspond à ces filtres.</p>
          <button className="btn" onClick={reset}>Réinitialiser les filtres</button>
        </div>
      )}

      <div className="col__groups">
        {groups.map(({ rarity, cards, shown }) => (
          <section key={rarity.id} className="col-group" style={{ ['--rc' as string]: rarity.color }}>
            <header className="col-group__head">
              <b>{rarity.short}</b><span>{rarity.label}</span><i />
              <em>{cards.filter((h) => owned[h.id]).length} / {cards.length}</em>
            </header>
            <div className="col-group__grid">
              {shown.map((h) => (
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
