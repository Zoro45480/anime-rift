import { useEffect, useState, type FormEvent } from 'react'
import { extraArt, iconArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { heroById, HEROES, ROLE_KINDS, roleKind, type Hero, type RoleKind } from '../data/heroes'
import { AFFINITY_LIST, type AffinityId } from '../data/affinities'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import { fileToCardImage } from '../state/customArt'
import { levelFromXp, MAX_LEVEL, SCROLL_IDS, SCROLLS } from '../game/progression'
import { SHOWCASE_MAX, useStore } from '../state/store'
import { AffinityIcon } from '../ui/AffinityIcon'
import { Card, LazyCard } from '../ui/Card'
import { Guide } from '../ui/Guide'
import { Inventory, Rebirth } from './Rebirth'
import { Profile } from './Profile'

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

type OwnedFilter = 'all' | 'owned' | 'missing' | 'dupes' | 'fav' | 'wish'
const OWNED_LABELS: Record<OwnedFilter, string> = { all: 'Toutes', owned: 'Obtenues', missing: 'Manquantes', dupes: 'Doublons', fav: '★ Favorites', wish: '♥ Envies' }
type SortId = 'rarity' | 'level' | 'copies' | 'name' | 'no'
const SORTS: [SortId, string][] = [['rarity', 'Rareté'], ['level', 'Niveau'], ['copies', 'Exemplaires'], ['name', 'Nom'], ['no', 'Numéro']]

// Ignore la casse et les accents, pour que « celestine » trouve « Célestine ».
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

const Cards = ({ onSummon }: { onSummon: () => void }) => {
  const { markVisit } = useStore()
  useEffect(() => { markVisit() }, []) // contrat du jour « passe voir ta collection »
  const { xp, owned, wish, favs, toggleFav, pinned, scrolls, remoteStatus, remoteArt, dupes, mergeAll } = useStore()
  const [more, setMore] = useState(true) // filtres avancés (univers, affinité, rôle, tri)
  const [worlds, setWorlds] = useState<string[]>([]) // vide = tous
  const [sort, setSort] = useState<SortId>('rarity')
  const [merged, setMerged] = useState('')
  const [query, setQuery] = useState('')
  const [rarities, setRarities] = useState<RarityId[]>([]) // vide = toutes
  const [affinities, setAffinities] = useState<AffinityId[]>([]) // vide = toutes
  const [roles, setRoles] = useState<RoleKind[]>([]) // vide = tous
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all')

  const have = HEROES.filter((h) => owned[h.id]).length
  const q = fold(query.trim())
  const visible = HEROES.filter((h) =>
    (rarities.length === 0 || rarities.includes(h.rarity)) &&
    (affinities.length === 0 || affinities.includes(h.affinity)) &&
    (roles.length === 0 || roles.includes(roleKind(h.role))) &&
    (worlds.length === 0 || worlds.includes(h.world)) &&
    (ownedFilter === 'all' || (ownedFilter === 'wish' ? wish.includes(h.id) : ownedFilter === 'fav' ? favs.includes(h.id) : ownedFilter === 'dupes' ? (owned[h.id] ?? 0) >= 2 : (ownedFilter === 'owned') === Boolean(owned[h.id]))) &&
    (q === '' || fold(`${h.name} ${h.title} ${h.world} ${h.role}`).includes(q)))
  const filtering = q !== '' || rarities.length > 0 || affinities.length > 0 || roles.length > 0 || worlds.length > 0 || ownedFilter !== 'all' || sort !== 'rarity'
  const reset = () => { setQuery(''); setRarities([]); setAffinities([]); setRoles([]); setWorlds([]); setOwnedFilter('all'); setSort('rarity') }
  const lv = (h: Hero) => (owned[h.id] ? levelFromXp(xp[h.id] ?? 0, MAX_LEVEL).level : 0)
  const order = (list: Hero[]) => sort === 'rarity' ? list : [...list].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'fr') : sort === 'no' ? (a, b) => a.no - b.no : sort === 'level' ? (a, b) => lv(b) - lv(a) || a.no - b.no : (a, b) => (owned[b.id] ?? 0) - (owned[a.id] ?? 0) || a.no - b.no)

  const all = RARITY_ORDER.map((id) => ({ rarity: RARITIES[id], cards: HEROES.filter((h) => h.rarity === id) })).filter((g) => g.cards.length > 0)
  const groups = sort === 'rarity' || sort === 'level' || sort === 'copies'
    ? all.map((g) => ({ ...g, shown: order(g.cards.filter((h) => visible.includes(h))) })).filter((g) => g.shown.length > 0)
    : [{ rarity: { ...RARITIES.common, id: 'common' as RarityId, short: '', label: sort === 'name' ? 'Par nom (A → Z)' : 'Par numéro' }, cards: HEROES, shown: order(visible) }].filter((g) => g.shown.length > 0)
  const usedAffinities = AFFINITY_LIST.filter((a) => HEROES.some((h) => h.affinity === a.id))

  return (
    <div className="col">
      <header className="col__head col__head--pc">
        <div>
          <p className="eyebrow">Anime Rift · collection</p>
          <h1 className="col__title">Ma collection</h1>
          <p className="col__sub">{have} carte{have > 1 ? 's' : ''} sur {HEROES.length} obtenue{have > 1 ? 's' : ''}.</p>
        </div>
        <ul className="col__stats">
          <li><b>{have}<i>/{HEROES.length}</i></b><span>Cartes uniques</span></li>
          <li className="is-pct"><b>{Math.floor((have / HEROES.length) * 100)} %</b><span>Complétion</span></li>
          <li><b>{dupes}</b><span>Doublons</span></li>
        </ul>
      </header>

      <section className="vitrine" aria-label="Ma vitrine">
        <header><h2>Ma vitrine</h2><em>{pinned.length} / {SHOWCASE_MAX}</em>
          <p className="vitrine__scrolls" aria-label="Parchemins d'XP en réserve">Parchemins : {SCROLL_IDS.map((id) => <span key={id} title={SCROLLS[id].label}><img className="cd-scroll" src={iconArt(`scroll-${id}`)} alt="" />{scrolls[id]}</span>)}</p>
        </header>
        {pinned.length === 0
          ? <p className="vitrine__empty">Ouvrez une carte obtenue, puis « En savoir plus » → « Épingler dans ma vitrine » pour l'exposer ici.</p>
          : <div className="vitrine__row">{pinned.map((id) => <Card key={id} hero={heroById(id)} />)}</div>}
      </section>

      <section className="filters" aria-label="Filtres de la collection">
        <div className="filters__top">
          <div className="filters__search">
            <label htmlFor="col-search" className="filters__label">Recherche</label>
            <input id="col-search" type="search" placeholder="Rechercher un perso, un univers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className={`filters__more ${more ? 'is-on' : ''}`} aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Moins de filtres' : 'Plus de filtres'} ☰{affinities.length + roles.length + worlds.length > 0 ? ` (${affinities.length + roles.length + worlds.length})` : ''}</button>
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

        {more && <>
        <div className="filters__row">
          <span className="filters__label">Univers</span>
          <div className="filters__chips">
            {BANNERS.map((b) => (
              <button key={b.id} className={`fchip fchip--world ${worlds.includes(b.world) ? 'is-on' : ''}`} style={{ ['--rc' as string]: b.hue }} aria-pressed={worlds.includes(b.world)} onClick={() => setWorlds(toggle(worlds, b.world))}>
                <img src={extraArt(`emblem-${b.id}`)} alt="" />{b.world}<i>{HEROES.filter((h) => h.world === b.world && owned[h.id]).length}/{HEROES.filter((h) => h.world === b.world).length}</i>
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
          <span className="filters__label">Rôle</span>
          <div className="filters__chips">
            {(Object.keys(ROLE_KINDS) as RoleKind[]).map((id) => (
              <button key={id} className={`fchip role role--${id} ${roles.includes(id) ? 'is-on' : ''}`} aria-pressed={roles.includes(id)} onClick={() => setRoles(toggle(roles, id))}>
                {ROLE_KINDS[id]}<i>{HEROES.filter((h) => roleKind(h.role) === id).length}</i>
              </button>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label">Trier par</span>
          <div className="filters__chips" role="radiogroup" aria-label="Tri">
            {SORTS.map(([id, label]) => <button key={id} role="radio" aria-checked={sort === id} className={`fchip ${sort === id ? 'is-on' : ''}`} onClick={() => setSort(id)}>{label}</button>)}
          </div>
        </div>
        </>}

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

      <div className="col__dupes">
        <b>Doublons</b>
        <p>{merged || 'Tes doublons restent dans ta collection. À toi de choisir quand les fusionner (de l’XP pour la carte) ou les vendre au Bazar.'}</p>
        <button disabled={dupes === 0} onClick={() => { const r = mergeAll(); setMerged(r.merged ? `${r.merged} doublon${r.merged > 1 ? 's' : ''} fusionné${r.merged > 1 ? 's' : ''} sur ${r.cards} carte${r.cards > 1 ? 's' : ''}.` : 'Rien à fusionner : ces cartes sont déjà au niveau maximum.') }}>⇪ Fusionner tous les doublons <i>×{dupes}</i></button>
      </div>

      <p className="col__hint">
        {remoteStatus === 'loading' && 'Chargement des portraits officiels depuis AniList… '}
        {remoteStatus === 'ok' && `Portraits officiels chargés par votre navigateur depuis AniList (${Object.keys(remoteArt).length} personnages) : le jeu ne contient aucune image. `}
        {remoteStatus === 'blocked' && 'Portraits AniList indisponibles ici (page qui bloque les chargements externes, ou pas de connexion) : les cartes gardent leur portrait de remplacement. '}
        Pour changer l'image d'une carte : « Mon image » (un fichier de votre appareil) ou « Lien d'image » (l'adresse d'une image en ligne). Ce choix reste sur cet appareil.
      </p>

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
                  <LazyCard hero={h} count={owned[h.id]} locked={!owned[h.id]} />
                  <button className={`col-fav ${favs.includes(h.id) ? 'is-on' : ''}`} aria-pressed={favs.includes(h.id)} aria-label={`${h.name} : ${favs.includes(h.id) ? 'retirer des favorites' : 'ajouter aux favorites'}`} onClick={() => toggleFav(h.id)}>{favs.includes(h.id) ? '★' : '☆'}</button>
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

export type CollectionTab = 'cards' | 'inventory' | 'rebirth' | 'profile'
const TABS: [CollectionTab, string][] = [['cards', 'Cartes'], ['inventory', 'Inventaire'], ['rebirth', 'Ascension'], ['profile', 'Profil']]

// La Collection et ses onglets : les cartes, la réserve d'objets et l’Ascension.
export const Collection = ({ onSummon, tab, onTab }: { onSummon: () => void; tab: CollectionTab; onTab: (t: CollectionTab) => void }) => (
  <div className="coltabs">
    <div className="coltabs__bar" role="tablist" aria-label="Sections de la collection">
      {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => onTab(id)}>{label}</button>)}
    </div>
    {tab === 'cards' && <Cards onSummon={onSummon} />}
    {tab === 'inventory' && <Inventory />}
    {tab === 'rebirth' && <Rebirth />}
    {tab === 'profile' && <Profile onCollection={() => onTab('cards')} />}
    <Guide id="collection" />
  </div>
)
