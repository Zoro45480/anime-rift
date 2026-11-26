import { useState } from 'react'
import { gateArt, iconArt } from '../assets/manifest'
import { HEROES } from '../data/heroes'
import { RARITY_ORDER } from '../data/rarities'
import { accountLevel, nextRebirthTitle, AWAKEN_STAT, LEVEL_CAP, MAX_LEVEL, REBIRTH_SHARDS, REBIRTH_KEEP, REBIRTH_LEVEL, REBIRTH_REFUND, REBIRTH_SEALS, REBIRTH_STAT, REBIRTH_XP, rebirthTitle, SCROLL_IDS, SCROLLS } from '../game/progression'
import { START_GEMS, useStore } from '../state/store'
import { LazyCard } from '../ui/Card'
import { Coin } from '../ui/Coin'

const n = (x: number) => x.toLocaleString('fr-FR')
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Inventaire : tout ce que le compte garde en réserve.
export const Inventory = () => {
  const { tickets, gems, scrolls, shards } = useStore()
  return (
    <div className="inv">
      <header>
        <p className="eyebrow">Votre réserve</p>
        <h1>Mes objets</h1>
        <p>Sceaux, âmes et parchemins conservés sur votre compte.</p>
      </header>
      <ul className="inv__list">
        <li style={{ ['--ic' as string]: '#ff5d7a' }}><Coin name="seal" size={58} /><div><b>Sceaux d'invocation</b><small>Une invocation par sceau.</small></div><strong>{n(tickets)}</strong></li>
        <li style={{ ['--ic' as string]: '#7d9bff' }}><Coin name="soul" size={58} /><div><b>Flammes d'âme</b><small>30 âmes pour une invocation.</small></div><strong>{n(gems)}</strong></li>
        {SCROLL_IDS.map((id, i) => (
          <li key={id} style={{ ['--ic' as string]: ['#4fb8ff', '#a56bff', '#ffc94d'][i] }}>
            <img src={iconArt(`scroll-${id}`)} alt="" width={64} height={64} />
            <div><b>{SCROLLS[id].label}</b><small>+{n(SCROLLS[id].xp)} XP pour une carte. S'utilise depuis la fiche d'une carte (« En savoir plus »).</small></div>
            <strong>{n(scrolls[id])}</strong>
          </li>
        ))}
        <li style={{ ['--ic' as string]: '#8f6bff' }}><img src={iconArt('shard')} alt="" width={64} height={64} /><div><b>Fragments d'âme</b><small>Servent à libérer une carte (niveau maximum {MAX_LEVEL}). Se gagnent dans La Spire ; chaque Renaissance en offre {REBIRTH_SHARDS}.</small></div><strong>{n(shards)}</strong></li>
      </ul>
      <h2>Objets de raid</h2>
      <p className="inv__empty">Aucun coffre à ouvrir. Les raids (Les Colosses) ne sont pas encore jouables : leurs récompenses arriveront ici.</p>
    </div>
  )
}

// Renaissance : au niveau de compte 100, repartir du niveau 1 avec 5 cartes et des bonus définitifs.
export const Rebirth = () => {
  const store = useStore()
  const [keep, setKeep] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState(false)
  const acc = accountLevel(store.accountXp, store.rebirths)
  const ready = acc.level >= REBIRTH_LEVEL
  const ownedCards = HEROES.filter((h) => store.owned[h.id]).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.no - b.no)
  const kept = keep.filter((id) => store.owned[id])
  const shown = ownedCards.filter((h) => fold(`${h.name} ${h.world}`).includes(fold(query.trim())))
  const refund = Math.floor(store.gemsSpent * REBIRTH_REFUND)
  const title = rebirthTitle(store.rebirths)
  const next = nextRebirthTitle(store.rebirths)
  const toggle = (id: string) => { setArmed(false); setKeep(kept.includes(id) ? kept.filter((x) => x !== id) : kept.length < REBIRTH_KEEP ? [...kept, id] : kept) }
  const confirm = () => {
    if (!armed) return setArmed(true)
    if (store.rebirth(kept)) { setDone(true); setKeep([]); window.scrollTo(0, 0) }
    setArmed(false)
  }

  return (
    <div className="rb">
      <section className="rb-hero">
        <img className="rb-hero__art" src={gateArt('rebirth')} alt="" />
        {/* image d'animé (AniList) : Dragon Ball, où l'on revient toujours plus fort */}
        {store.bannerArt.dragonball && <img className="rb-hero__anime" src={store.bannerArt.dragonball} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
        <span className="rb-hero__kanji" lang="ja" aria-hidden="true">転生</span>
        <p className="rb-hero__kicker">Anime Rift · Renaissance</p>
        <h1>Tout recommencer, plus fort</h1>
        <p>Tu repars du niveau 1 avec {REBIRTH_KEEP} cartes de ton choix, et tu gardes des bonus pour toujours.</p>
        <p className="rb-hero__count">{store.rebirths === 0 ? 'Aucune Renaissance pour l’instant.' : `${store.rebirths} Renaissance${store.rebirths > 1 ? 's' : ''}${title ? ` · titre « ${title} »` : ''}`}</p>
        {done && <p className="rb-hero__done" role="status">Renaissance accomplie. Tes bonus sont actifs.</p>}
      </section>

      <section className="rb-box rb-box--gold">
        <h2>Ce que tu gagnes, pour toujours</h2>
        <ul className="rb-gains">
          <li><b>+{REBIRTH_STAT} %</b><strong>PV, attaque et défense</strong><p>Sur toutes tes cartes. Se cumule à chaque Renaissance{store.rebirths ? ` : tu es à +${store.rebirths * REBIRTH_STAT} %` : ''}.</p></li>
          <li><b>+{REBIRTH_XP} %</b><strong>XP pour tes cartes</strong><p>Parchemins et fusions de doublons donnent plus d'XP. Se cumule aussi.</p></li>
          <li><b>+{REBIRTH_SEALS} <Coin name="seal" size={30} /></b><strong>Sceaux d'invocation</strong><p>Offerts tout de suite, pour repartir.</p></li>
          <li><b>{n(refund)} <Coin name="soul" size={30} /></b><strong>{REBIRTH_REFUND * 100} % de tes âmes dépensées</strong><p>Rendues tout de suite. Comptées depuis ta dernière Renaissance ({n(store.gemsSpent)} dépensées).</p></li>
          <li><b lang="ja">解放</b><strong>La Libération de tes cartes</strong><p>Dès ta première Renaissance, tu peux libérer une carte avec des Fragments d'âme : +{AWAKEN_STAT} % de PV, d'attaque et de défense, et niveau maximum {MAX_LEVEL} au lieu de {LEVEL_CAP}.</p></li>
          <li><b>+{REBIRTH_SHARDS} <img src={iconArt('shard')} alt="" width={34} height={34} /></b><strong>Fragments d'âme</strong><p>Offerts à chaque Renaissance. Le reste se gagnera dans La Spire, étage après étage.</p></li>
          <li><b lang="ja">称</b><strong>Titres exclusifs</strong><p>{next ? `Prochain titre : « ${next[1]} » à ${next[0]} Renaissance${next[0] > 1 ? 's' : ''}.` : 'Tu as tous les titres.'} Il s'affiche sur cette page.</p></li>
          <li><b>0</b><strong>Anciennes bannières</strong><p>Aucune pour l'instant : les bannières fermées reviendront ici, réservées aux joueurs renés.</p></li>
        </ul>
      </section>

      <section className="rb-box">
        <h2>Prérequis</h2>
        <div className={`rb-req ${ready ? 'is-ok' : ''}`}>
          <i aria-hidden="true">{ready ? '✓' : '×'}</i>
          <div><b>Niveau de compte {REBIRTH_LEVEL}</b><small>{ready ? 'Atteint.' : `Tu es niveau ${acc.level} : encore ${REBIRTH_LEVEL - acc.level} niveau${REBIRTH_LEVEL - acc.level > 1 ? 'x' : ''}.`}</small></div>
        </div>
        <div className="rb-level" role="meter" aria-valuemin={1} aria-valuemax={REBIRTH_LEVEL} aria-valuenow={acc.level} aria-label="Niveau de compte">
          <i style={{ width: `${(acc.level / REBIRTH_LEVEL) * 100}%` }} /><span>Niveau {acc.level} / {REBIRTH_LEVEL}{ready ? '' : ` · ${n(acc.into)} / ${n(acc.need)} XP`}</span>
        </div>
        <p className="rb-note">Ton compte gagne de l'XP à chaque victoire dans La Saga, à chaque carte invoquée et à chaque amélioration de carte.</p>
      </section>

      <section className="rb-box">
        <h2>Ce que la Renaissance te coûte</h2>
        <div className="rb-cost rb-cost--lose">
          <h3>Tu perds</h3>
          <ul>
            <li>{ownedCards.length - kept.length} carte{ownedCards.length - kept.length > 1 ? 's' : ''}, avec leurs niveaux et leurs doublons</li>
            <li>Ton niveau de compte : retour au niveau 1, et chaque niveau demande ensuite deux fois plus d'XP</li>
            <li>Ta progression dans La Saga : les étoiles repartent à zéro (et peuvent donc redonner des âmes)</li>
            <li>Ton solde d'âmes : il repart à {n(START_GEMS)}, plus les {n(refund)} rendues</li>
          </ul>
        </div>
        <div className="rb-cost rb-cost--keep">
          <h3>Tu gardes</h3>
          <ul>
            <li>{REBIRTH_KEEP} cartes de ton choix, telles qu'elles sont (niveau, doublons, Libération, historique)</li>
            <li>Tes sceaux, tes parchemins, tes Fragments d'âme et ta liste d'envies</li>
            <li>Ta progression de garantie (pity) sur chaque bannière</li>
            <li>Tes images personnelles</li>
          </ul>
        </div>
      </section>

      <section className="rb-box">
        <header className="rb-pick__head">
          <div><h2>Choisis les cartes que tu gardes</h2><p>Elles gardent leur niveau. Tout le reste disparaît.</p></div>
          <strong>{kept.length} / {REBIRTH_KEEP}</strong>
        </header>
        {ownedCards.length === 0 ? <p className="rb-note">Tu n'as encore aucune carte.</p> : <>
          <input className="rb-pick__search" type="search" placeholder="Rechercher un perso, une série…" aria-label="Rechercher une carte" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="rb-pick__grid">
            {shown.map((h) => (
              <button key={h.id} className={`rb-pick__item ${kept.includes(h.id) ? 'is-kept' : ''}`} aria-pressed={kept.includes(h.id)} aria-label={`${kept.includes(h.id) ? 'Ne plus garder' : 'Garder'} ${h.name}`} onClick={() => toggle(h.id)}>
                <LazyCard hero={h} inert count={store.owned[h.id]} />
                <span>{kept.includes(h.id) ? '✓ Gardée' : 'Garder'}</span>
              </button>
            ))}
          </div>
        </>}
      </section>

      <section className="rb-confirm">
        <p>Tu gardes {kept.length} carte{kept.length > 1 ? 's' : ''} et tu en perds {ownedCards.length - kept.length}. Ce choix est définitif.</p>
        <button className="rb-confirm__btn" disabled={!ready} onClick={confirm}>
          {!ready ? `Débloquée au niveau ${REBIRTH_LEVEL} (tu es niveau ${acc.level})` : armed ? 'Appuie encore pour confirmer : c’est définitif' : 'Renaître'}
        </button>
      </section>
    </div>
  )
}
