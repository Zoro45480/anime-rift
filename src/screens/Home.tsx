import { useState } from 'react'
import { HEROES } from '../data/heroes'
import { AFFINITIES } from '../data/affinities'
import { RARITIES } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { AffinityIcon } from '../ui/AffinityIcon'

// Entrées du menu. `phase` = phase du plan où l'écran devient jouable (affiché tel quel, sans faux contenu).
const NAV = [
  { id: 'story', label: 'Campagne', hint: 'Saga I — La Fracture', phase: 11 },
  { id: 'summon', label: 'Invocation', hint: 'Bannières et portail', phase: 8 },
  { id: 'heroes', label: 'Collection', hint: 'Vos personnages', phase: 4 },
  { id: 'team', label: 'Équipe', hint: 'Formation de 5', phase: 5 },
  { id: 'worlds', label: 'Mondes', hint: 'Carte du multivers', phase: 10 },
  { id: 'shop', label: 'Boutique', hint: 'Échanges et offres', phase: 13 },
]

export const Home = () => {
  const [heroId, setHeroId] = useState(HEROES[0].id)
  const [navId, setNavId] = useState(NAV[0].id)
  const hero = HEROES.find((h) => h.id === heroId)!
  const nav = NAV.find((n) => n.id === navId)!
  const rarity = RARITIES[hero.rarity]
  const accent = AFFINITIES[hero.affinity].color

  return (
    <div className="home" style={{ ['--accent' as string]: accent }}>
      <div className="home__bg" aria-hidden="true">
        <div className="home__glow" />
        <div className="home__rings"><i /><i /><i /></div>
        <div className="home__word" key={hero.id}>{hero.name}</div>
      </div>

      <header className="topbar">
        <div className="logo" role="img" aria-label="ANIME RIFT"><span>ANIME</span><b>RIFT</b></div>
        <span className="chip">Aperçu du style · Phase 1</span>
      </header>

      <nav className="menu" aria-label="Menu principal">
        {NAV.map((n, i) => (
          <button key={n.id} className={`menu__item ${n.id === navId ? 'is-active' : ''}`} onClick={() => setNavId(n.id)} aria-current={n.id === navId}>
            <span className="menu__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="menu__label">{n.label}</span>
            <span className="menu__hint">{n.hint}</span>
          </button>
        ))}
        <p className="menu__note">« {nav.label} » sera jouable à la phase {nav.phase}.</p>
      </nav>

      <figure className="stage" key={hero.id}>
        <img className="stage__art" src={heroArt(hero.model, 'full')} alt={`${hero.name}, ${hero.title}`} />
      </figure>

      <section className="plate" key={`p-${hero.id}`} aria-live="polite">
        <div className="plate__rarity" style={{ color: rarity.color }}>
          <span>{rarity.short}</span>
          <i>{'★'.repeat(rarity.stars)}</i>
        </div>
        <h1 className="plate__name">{hero.name}</h1>
        <p className="plate__title">{hero.title}</p>
        <div className="plate__tags">
          <span className="tag"><AffinityIcon id={hero.affinity} size={15} />{AFFINITIES[hero.affinity].label}</span>
          <span className="tag">{hero.role}</span>
        </div>
        <p className="plate__quote">« {hero.quote} »</p>
      </section>

      <div className="roster" role="listbox" aria-label="Choisir le personnage affiché">
        {HEROES.map((h) => (
          <button key={h.id} role="option" aria-selected={h.id === heroId} title={h.name}
            className={`roster__item ${h.id === heroId ? 'is-active' : ''}`}
            style={{ ['--rc' as string]: RARITIES[h.rarity].color }} onClick={() => setHeroId(h.id)}>
            <img src={heroArt(h.model, 'bust')} alt={h.name} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
