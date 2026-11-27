import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { extraArt, iconArt, uiArt } from '../assets/manifest'
import { AFFINITIES } from '../data/affinities'
import { frameOf } from '../data/banners'
import { HEROES, roleKind, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { cardRate } from '../game/gacha'
import { titleRank, TITLE_RULES, TITLES, STAT_SCALE, AWAKEN_COST, AWAKEN_STAT, LEVEL_CAP, baseRank, baseStats, cardState, kitOf, MAX_GROUPS, STAT_LABEL, MAX_LEVEL, MERGE_XP, SCROLL_IDS, SCROLLS, REBIRTH_XP, type Collectif, type ScrollId } from '../game/progression'
import { SHOWCASE_MAX, useStore } from '../state/store'
import { coteOf, quickPrice, valueOf } from '../game/bazaar'
import { dayKey } from '../game/contracts'
import { Spark } from '../screens/Bazaar'
import { AffinityIcon } from './AffinityIcon'
import { Card, LazyCard } from './Card'
import { bannerOf, pct } from './CardViewer'

// Page complète d'une carte. Tout ce qui s'y affiche vient de l'état réel de la partie :
// rien n'est inventé (pas de marché, pas de statistiques de combat tant que ces modes n'existent pas).

const n = (x: number) => x.toLocaleString('fr-FR')
const when = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const slug = (t: string) => 'cd-' + t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-')
const Section = ({ title, aside, children, closed, hue }: { title: string; aside?: string; children: ReactNode; closed?: boolean; hue: string }) => (
  <details className="cd-sec" id={slug(title)} open={!closed} style={{ ['--sh' as string]: hue }}>
    <summary><span>{title}</span>{aside && <em>{aside}</em>}<i aria-hidden="true" /></summary>
    <div className="cd-sec__body">{children}</div>
  </details>
)

const Group = ({ group, owned, team, current, onOpen }: { group: Collectif; owned: Record<string, number>; team: string[]; current: Hero; onOpen: (h: Hero) => void }) => (
  <div className={`cd-group ${group.counted ? 'is-active' : ''}`}>
    <header>
      <b>{group.name}</b><em>{group.stat === 'all' ? `${group.have} / ${group.members.length}` : `${group.have} dans l’équipe`}</em>
      <strong>{group.stat === 'all' ? `+${group.bonus} %` : `+${group.pct} % ${STAT_LABEL[group.stat]}`}</strong>
    </header>
    <p>{group.rule}. {group.stat === 'all' ? '' : group.counted ? 'Actif.' : group.active ? `Actif, mais seuls les ${MAX_GROUPS} plus forts comptent.` : 'Pas encore actif.'}</p>
    {group.stat === 'all' && <div className="cd-bar"><i style={{ width: `${(group.have / group.members.length) * 100}%` }} /></div>}
    <ul className="cd-members">
      {group.members.map((m) => (
        <li key={m.id}><button className={`${owned[m.id] ? 'is-owned' : ''} ${m.id === current.id ? 'is-current' : ''} ${group.stat !== 'all' && team.includes(m.id) ? 'is-team' : ''}`} style={{ ['--rc' as string]: RARITIES[m.rarity].color }} onClick={() => onOpen(m)}>
          <b>{RARITIES[m.rarity].short}</b>{m.name}</button></li>
      ))}
    </ul>
  </div>
)

export const CardDetail = ({ hero, onClose, onOpen }: { hero: Hero; onClose: () => void; onOpen: (hero: Hero) => void }) => {
  const { remoteSeiyu, teamNow, arcHeroes, remoteFans, awakened, shards, awaken, rebirths, owned, xp, scrolls, wish, pinned, favs, bazaar, log, merge, useScroll, scrollsUseful, toggleFav, toggleWish, togglePin } = useStore()
  const [qty, setQty] = useState<Record<ScrollId, 1 | 10 | 0>>({ small: 1, medium: 1, large: 1 }) // 0 = le maximum utile
  const [notice, setNotice] = useState('')
  const top = useRef<HTMLDivElement>(null)
  const rarity = RARITIES[hero.rarity]
  const banner = bannerOf(hero)
  const rate = banner ? cardRate(banner, hero) : 0
  const copies = owned[hero.id] ?? 0
  const has = copies > 0
  const state = cardState(hero, xp, owned, rebirths, awakened, teamNow)
  const base = baseStats(hero)
  const rank = titleRank(state.level, state.freed, Boolean(arcHeroes[hero.id]))
  const maxed = state.level >= state.cap
  const cost = AWAKEN_COST[hero.rarity]
  const wished = wish.includes(hero.id)
  const isPinned = pinned.includes(hero.id)
  const isFav = favs.includes(hero.id)
  const today = dayKey(new Date())
  const cote = coteOf(bazaar.trades, hero.id, Date.now())
  const kit = kitOf(hero, state.stats)
  const history = log[hero.id] ?? []
  const first = history.filter((e) => e.k === 'pull').at(-1)
  const same = HEROES.filter((h) => h.world === hero.world && h.id !== hero.id)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.no - b.no)

  useEffect(() => {
    top.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const onMerge = () => setNotice(merge(hero.id) ? `Doublon fusionné : +${n(MERGE_XP[hero.rarity])} XP.` : '')
  const onPin = () => setNotice(togglePin(hero.id) ? (isPinned ? 'Retirée de la vitrine.' : 'Épinglée dans la vitrine.') : `La vitrine est pleine (${SHOWCASE_MAX} cartes). Retirez-en une d’abord.`)

  // la barre se lit par rapport au maximum possible : la meilleure valeur de base du jeu, portée au niveau 100
  const stat = (label: string, value: number, from: number, hue: string, scale: number) => (
    <div className="cd-stat" style={{ ['--sc' as string]: hue }}>
      <small>{label}</small><b>{n(value)}</b>
      <span className="cd-stat__bar"><i style={{ width: `${Math.min(100, (value / (scale * 3)) * 100)}%` }} /></span>
      {value !== from && <em>base {n(from)}</em>}
    </div>
  )

  return createPortal(
    <div className="cd" role="dialog" aria-modal="true" aria-label={`Fiche de ${hero.name}`} style={{ ['--rc' as string]: rarity.color }}>
      <div className="cd__in" ref={top} tabIndex={-1}>
        <nav className="cd__nav">
          <button className="cd__back" onClick={onClose}>← Retour</button>
          <p>{hero.world} <i>›</i> {rarity.label} <i>›</i> <b>{hero.name}</b></p>
        </nav>

        <header className="cd__hero">
          <div className="cd__card"><Card hero={hero} inert hd /></div>
          <div className="cd__id">
            <p className="cd__rar"><b>{rarity.short}</b>{rarity.label} · N° {String(hero.no).padStart(4, '0')}</p>
            <h1>{hero.name}<button className={`cd-fav ${isFav ? 'is-on' : ''}`} aria-pressed={isFav} aria-label={isFav ? 'Retirer des favorites' : 'Ajouter aux favorites'} onClick={() => toggleFav(hero.id)}>{isFav ? '★' : '☆'}</button></h1>
            <p className="cd__kana" lang="ja">{hero.kana}</p>
            <p className="cd__title">{hero.title}</p>
            <ul className="cd__chips">
              <li>{hero.world}</li>
              <li className={`role role--${roleKind(hero.role)}`}>{hero.role}</li>
              <li><AffinityIcon id={hero.affinity} size={13} />{AFFINITIES[hero.affinity].label}</li>
              <li>{has ? `Niveau ${state.level}` : 'Non obtenue'}</li>
              <li>{copies} exemplaire{copies > 1 ? 's' : ''}</li>
            </ul>
            <div className="cd__actions">
              {has && <button className="cd-btn cd-btn--main" disabled={copies < 2 || maxed} onClick={onMerge}>Fusionner un doublon<small>{maxed ? 'Niveau maximum' : copies < 2 ? 'Il faut 2 exemplaires' : `+${n(MERGE_XP[hero.rarity])} XP`}</small></button>}
              {has && <button className={`cd-btn ${isPinned ? 'is-on' : ''}`} aria-pressed={isPinned} onClick={onPin}>{isPinned ? 'Retirer de ma vitrine' : 'Épingler dans ma vitrine'}<small>{pinned.length} / {SHOWCASE_MAX} places</small></button>}
              <button className={`cd-btn ${wished ? 'is-on' : ''}`} aria-pressed={wished} onClick={() => toggleWish(hero.id)}>{wished ? '♥ Dans mes envies' : '♡ Ajouter aux envies'}</button>
              <button className="cd-btn" onClick={() => { try { sessionStorage.setItem('anime-rift:bz-q', hero.name) } catch { /* rien */ } onClose(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'bazaar' })) }}>Chercher au Bazar →<small>Annonces de cette carte</small></button>
            </div>
            <p className="cd__notice" role="status">{notice}</p>
          </div>
        </header>

        <nav className="cd-anchors" aria-label="Sections de la fiche">
          {['Statistiques', 'Techniques', 'Collectifs', 'Amélioration', 'Historique', 'Cote de la carte', 'Où l\'obtenir'].map((t) => (
            <button key={t} onClick={() => { const el = document.getElementById(slug(t)); if (el) { (el as HTMLDetailsElement).open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }}>{t === 'Cote de la carte' ? 'Cote' : t}</button>
          ))}
        </nav>

        {!has && <p className="cd-locked-note">Tu n'as pas encore cette carte : statistiques au niveau 1, sans bonus.</p>}

        <Section hue="#ff5d7a" title="Statistiques" aside={`Puissance ${n(state.power)}`}>
          <div className="cd-level">
            <b>Niveau {state.level}<i> / {state.cap}</i></b>
            <span>{maxed ? (state.freed ? 'Niveau maximum atteint' : `Bloquée au niveau ${LEVEL_CAP} : libère-la pour continuer`) : `${n(state.into)} / ${n(state.need)} XP`}</span>
            <div className="cd-bar"><i style={{ width: maxed ? '100%' : `${(state.into / state.need) * 100}%` }} /></div>
          </div>
          <div className="cd-stats">
            {stat('PV', state.stats.hp, base.hp, '#4be3a4', STAT_SCALE.hp)}
            {stat('Attaque', state.stats.atk, base.atk, '#ff5d7a', STAT_SCALE.atk)}
            {stat('Défense', state.stats.def, base.def, '#5aa8ff', STAT_SCALE.def)}
            {stat('Vitesse', state.stats.speed, base.speed, '#ffd24d', STAT_SCALE.speed / 3 * 1.2)}
            <div className="cd-stat cd-stat--power"><small>Puissance</small><b>{n(state.power)}</b></div>
            <div className="cd-stat" style={{ ['--sc' as string]: '#b78bff' }}><small>Classement de base</small><b>{baseRank(hero)}<i> / {HEROES.length}</i></b></div>
          </div>
          <p className="cd-note">Chaque niveau ajoute 2 % aux PV, à l’attaque et à la défense.{state.bonus > 0 ? ` Univers, Ascensions et Libération ajoutent ${state.bonus} % à tout.` : ''} Les collectifs actifs s'ajoutent par statistique.{!has ? ' Valeurs de base : vous ne possédez pas encore cette carte.' : ''}</p>
        </Section>

        <Section hue="#ff9a3d" title="Techniques" aside={hero.role}>
          <ul className="cd-kit">
            {kit.map((m) => (
              <li key={m.kind} className={`cd-kit--${m.kind === 'Attaque' ? 'a' : m.kind === 'Technique' ? 't' : m.kind === 'Ultime' ? 'u' : 'p'}`}><small>{m.kind}</small><b>{m.name}</b><p>{m.text}</p>{m.cost && <em>{m.cost}</em>}</li>
            ))}
          </ul>
          <p className="cd-note">Les chiffres sont calculés sur les statistiques actuelles de la carte : ils montent avec son niveau. Ils sont donnés avant la défense de la cible. Les techniques servent dans L’Aventure.</p>
        </Section>

        <Section hue="#4be3a4" title="Collectifs" aside={`${state.groups.filter((g) => g.counted).length} actif${state.groups.filter((g) => g.counted).length > 1 ? 's' : ''} sur ${state.groups.length}`}>
          <p className="cd-note">Un collectif s'active quand cette carte est dans ton équipe de L’Aventure avec au moins un autre membre (les noms entourés de vert sont dans l'équipe). {MAX_GROUPS} collectifs au plus comptent pour une carte : les plus forts.</p>
          {state.groups.map((g) => <Group key={g.id} group={g} owned={owned} team={teamNow} current={hero} onOpen={onOpen} />)}
        </Section>

        {has && <Section hue="#ffc94d" title="Amélioration" aside={`${n(scrolls.small + scrolls.medium + scrolls.large)} parchemin${scrolls.small + scrolls.medium + scrolls.large > 1 ? 's' : ''}`}>
          <ul className="cd-scrolls">
            {SCROLL_IDS.map((id) => {
              const useful = scrollsUseful(hero.id, id)
              const want = qty[id] === 0 ? useful : Math.min(qty[id], useful)
              const per = Math.round(SCROLLS[id].xp * (1 + (rebirths * REBIRTH_XP) / 100))
              return (
                <li key={id}>
                  <img className={`cd-scroll cd-scroll--${id}`} src={iconArt(`scroll-${id}`)} alt="" />
                  <div><b>{SCROLLS[id].label}</b><small>+{n(per)} XP chacun · en réserve : {n(scrolls[id])}</small></div>
                  <div className="cd-qty" role="radiogroup" aria-label={`Quantité de ${SCROLLS[id].label}`}>
                    {([1, 10, 0] as const).map((q) => <button key={q} role="radio" aria-checked={qty[id] === q} className={qty[id] === q ? 'is-on' : ''} onClick={() => setQty({ ...qty, [id]: q })}>{q === 0 ? 'Max' : `×${q}`}</button>)}
                  </div>
                  <button className="cd-btn cd-btn--small cd-use" disabled={!has || maxed || want < 1} onClick={() => { const u = useScroll(hero.id, id, want); if (u) setNotice(`${u} × ${SCROLLS[id].label} utilisé${u > 1 ? 's' : ''} : +${n(u * per)} XP.`) }}>
                    Utiliser{want > 0 ? ` ${want}` : ''}<small>{want > 0 ? `+${n(want * per)} XP` : maxed ? 'Niveau max' : 'Aucun'}</small>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className={`cd-free ${state.freed ? 'is-free' : ''}`}>
            <img src={iconArt('shard')} alt="" />
            <div>
              <small lang="ja">解放 · Libération</small>
              <b>{state.freed ? 'Carte libérée' : 'Libérer cette carte'}</b>
              <p>+{AWAKEN_STAT} % de PV, d'attaque et de défense, et niveau maximum {MAX_LEVEL} au lieu de {LEVEL_CAP}. Définitif pour cette carte.</p>
              <p className="cd-free__cost">{state.freed ? 'Bonus actif.' : rebirths < 1 ? `Disponible après ta première Ascension. Coût : ${cost} Fragments d'âme.` : `Coût : ${cost} Fragments d'âme · tu en as ${n(shards)}.`}</p>
            </div>
            {!state.freed && <button className="cd-btn cd-btn--small" disabled={rebirths < 1 || shards < cost} onClick={() => { if (awaken(hero.id)) setNotice('Carte libérée : niveau maximum 100.') }}>Libérer</button>}
          </div>
          <p className="cd-note">Les Fragments d'âme se gagnent dans La Tour de l’Infini (Nexus), sur le Chemin du Rift et dans les contrats ; chaque Ascension en offre aussi quelques-uns.</p>
          <p className="cd-note">« Max » utilise juste ce qu'il faut pour atteindre le niveau maximum : aucun parchemin n'est gaspillé.</p>
          <p className="cd-note">Les parchemins se gagnent dans L’Aventure (Nexus) : chaque combat affiche son taux de drop.{!has ? ' Il faut posséder la carte pour l’améliorer.' : ''}</p>
        </Section>}

        {has && <Section hue="#5ee6ff" title="Historique" aside={history.length ? `${history.length} ligne${history.length > 1 ? 's' : ''}` : undefined}>
          {history.length === 0 ? <p className="cd-note">Rien pour l’instant : cette carte n’a pas encore été obtenue.</p> : (
            <ol className="cd-log">
              {history.map((e, i) => <li key={i} className={`cd-log--${e.k}`}><time>{when(e.t)}</time><span>{e.note}</span></li>)}
            </ol>
          )}
        </Section>}

        <Section hue="#ffc94d" title="Titres" aside={has && rank >= 0 ? (TITLES[hero.world] as string[])[rank] : 'Aucun'}>
          <ol className="cd-titles">
            {TITLES[hero.world].map((name, i) => (
              <li key={name} className={`cd-titles--${i < 2 ? 'bronze' : i < 4 ? 'silver' : 'gold'} ${has && (i === 3 ? Boolean(arcHeroes[hero.id]) : i <= rank && (i < 3 || state.freed)) ? 'is-earned' : ''} ${has && i === rank ? 'is-worn' : ''}`}>
                <span className={`cd-titles__ribbon card__title--${frameOf(hero.world)}`}><img src={extraArt(`ribbon-${frameOf(hero.world)}`)} alt="" /><b>{name}</b></span>
                <small>{TITLE_RULES[i]}</small>
              </li>
            ))}
          </ol>
          <p className="cd-note">Les titres de l'univers {hero.world}. La carte porte le plus haut qu'elle a mérité.</p>
        </Section>

        <Section hue="#b78bff" title="Cote de la carte" aside="Bazar">
          <div className="cd-market">
            <div><small>Valeur du jour</small><b>{n(valueOf(hero, has ? state.level : 1, today))} Éclats</b></div>
            <div><small>Vente immédiate</small><b>{n(quickPrice(hero, has ? state.level : 1, today))} Éclats</b></div>
            <div><small>Médiane 7 j</small><b>{cote.d7 ? `${n(cote.d7)} Éclats` : '—'}</b></div>
            <div><small>Médiane 30 j</small><b>{cote.d30 ? `${n(cote.d30)} Éclats` : '—'}</b></div>
            <div><small>Transactions (30 j)</small><b>{cote.count30}</b></div>
            <div><small>Exemplaires chez toi</small><b>{copies}</b></div>
          </div>
          <Spark trades={cote.all} />
          <p className="cd-note">La valeur suit la rareté, le niveau de la carte et la demande du jour au Bazar. Les médianes viennent uniquement de tes vrais achats et ventes : aucun prix n'est inventé. Le Bazar est dans la barre du bas.</p>
        </Section>

        <Section hue="#4be3a4" title="Où l'obtenir">
          <ul className="cd-where">
            <li><img src={extraArt(`emblem-${frameOf(hero.world)}`)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /><div><b>Invocation · {hero.rarity === 'rift' ? `bannière ${banner ? banner.world : hero.world} seulement` : 'toutes les bannières'}</b><small>{rate ? `${pct(rate)} par invocation, soit environ 1 sur ${n(Math.round(1 / rate))}.` : 'Cette carte n’est sur aucune bannière en ce moment.'} {hero.rarity === 'rift' ? 'Les cartes MR ne sortent que sur la bannière de leur univers.' : 'Toutes les cartes (sauf MR) sont mélangées : elle peut sortir sur n’importe quelle bannière.'} Avec des Éclats ou des sceaux, dans Invoquer.</small></div></li>
            {['epic', 'ultra', 'legend'].includes(hero.rarity) && <li><img src={uiArt('card-pack')} alt="" /><div><b>Chemin du Rift</b><small>Les paliers 10, 20, 30 et 40 donnent une carte {RARITIES.epic.short} ou mieux, tirée au hasard parmi toutes les cartes de cette rareté.</small></div></li>}
            <li><img src={iconArt('scroll-medium')} alt="" /><div><b>Doublons</b><small>Chaque nouvel exemplaire peut être fusionné pour faire monter la carte de niveau (+{n(MERGE_XP[hero.rarity])} XP).</small></div></li>
          </ul>
        </Section>

        <Section hue="#7d9bff" title="Informations">
          <dl className="cd-info">
            <div><dt>Numéro</dt><dd>{String(hero.no).padStart(4, '0')}</dd></div>
            <div><dt>Univers</dt><dd>{hero.world}</dd></div>
            <div><dt>Rareté</dt><dd>{rarity.label} ({rarity.short}) · {rarity.stars} étoiles</dd></div>
            <div><dt>Rôle</dt><dd>{hero.role}</dd></div>
            <div><dt>Affinité</dt><dd>{AFFINITIES[hero.affinity].label}</dd></div>
            <div><dt>Bannière</dt><dd>{hero.rarity === 'rift' ? (banner ? banner.world : 'Hors bannière') : 'Toutes'}</dd></div>
            <div><dt>Chance par invocation</dt><dd>{rate ? `${pct(rate)} · 1 sur ${n(Math.round(1 / rate))}` : '—'}</dd></div>
            <div><dt>Exemplaires</dt><dd>{copies}</dd></div>
            <div><dt><img className="cd-mic" src={extraArt('mic')} alt="" />Seiyū (voix japonaise)</dt><dd>{remoteSeiyu[hero.id] ?? '—'}</dd></div>
            <div><dt>Popularité</dt><dd>{remoteFans[hero.id] ? `♥ ${n(remoteFans[hero.id])} fans sur AniList` : '—'}</dd></div>
            <div><dt>Première obtention</dt><dd>{first ? when(first.t) : '—'}</dd></div>
          </dl>
        </Section>

        <Section hue="#b78bff" title="Dans le même univers" aside={`${same.filter((h) => owned[h.id]).length} / ${same.length}`}>
          <div className="cd-same">
            {same.map((h) => <button key={h.id} className="cd-same__item" onClick={() => onOpen(h)} aria-label={`Voir la fiche de ${h.name}`}><LazyCard hero={h} inert locked={!owned[h.id]} /></button>)}
          </div>
        </Section>

        <Section hue="#8089a8" title="Pas encore disponible" closed>
          <p className="cd-note">Les ventes entre vrais joueurs et les statistiques de combat détaillées par carte demandent un jeu en ligne. Aucun chiffre n’est inventé d’ici là.</p>
        </Section>
      </div>
    </div>,
    document.body,
  )
}
