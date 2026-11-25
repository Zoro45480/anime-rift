import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { iconArt } from '../assets/manifest'
import { AFFINITIES } from '../data/affinities'
import { HEROES, roleKind, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { cardRate } from '../game/gacha'
import { AWAKEN_COST, AWAKEN_STAT, LEVEL_CAP, baseRank, baseStats, cardState, kitOf, MAX_LEVEL, MERGE_XP, SCROLL_IDS, SCROLLS, type Collectif } from '../game/progression'
import { SHOWCASE_MAX, useStore } from '../state/store'
import { AffinityIcon } from './AffinityIcon'
import { Card } from './Card'
import { bannerOf, pct } from './CardViewer'

// Page complète d'une carte. Tout ce qui s'y affiche vient de l'état réel de la partie :
// rien n'est inventé (pas de marché, pas de statistiques de combat tant que ces modes n'existent pas).

const n = (x: number) => x.toLocaleString('fr-FR')
const when = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const Section = ({ title, aside, children, closed, hue }: { title: string; aside?: string; children: ReactNode; closed?: boolean; hue: string }) => (
  <details className="cd-sec" open={!closed} style={{ ['--sh' as string]: hue }}>
    <summary><span>{title}</span>{aside && <em>{aside}</em>}<i aria-hidden="true" /></summary>
    <div className="cd-sec__body">{children}</div>
  </details>
)

const Group = ({ group, owned, current, onOpen }: { group: Collectif; owned: Record<string, number>; current: Hero; onOpen: (h: Hero) => void }) => (
  <div className="cd-group">
    <header><b>{group.name}</b><em>{group.have} / {group.members.length}</em><strong>+{group.bonus} %</strong></header>
    <p>{group.rule}</p>
    <div className="cd-bar"><i style={{ width: `${(group.have / group.members.length) * 100}%` }} /></div>
    <ul className="cd-members">
      {group.members.map((m) => (
        <li key={m.id}><button className={`${owned[m.id] ? 'is-owned' : ''} ${m.id === current.id ? 'is-current' : ''}`} style={{ ['--rc' as string]: RARITIES[m.rarity].color }} onClick={() => onOpen(m)}>
          <b>{RARITIES[m.rarity].short}</b>{m.name}</button></li>
      ))}
    </ul>
  </div>
)

export const CardDetail = ({ hero, onClose, onOpen }: { hero: Hero; onClose: () => void; onOpen: (hero: Hero) => void }) => {
  const { awakened, shards, awaken, rebirths, owned, xp, scrolls, wish, pinned, log, merge, useScroll, toggleWish, togglePin } = useStore()
  const [notice, setNotice] = useState('')
  const top = useRef<HTMLDivElement>(null)
  const rarity = RARITIES[hero.rarity]
  const banner = bannerOf(hero)
  const rate = banner ? cardRate(banner, hero) : 0
  const copies = owned[hero.id] ?? 0
  const has = copies > 0
  const state = cardState(hero, xp, owned, rebirths, awakened)
  const base = baseStats(hero)
  const maxed = state.level >= state.cap
  const cost = AWAKEN_COST[hero.rarity]
  const wished = wish.includes(hero.id)
  const isPinned = pinned.includes(hero.id)
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

  const stat = (label: string, value: number, from: number, hue: string) => (
    <div className="cd-stat" style={{ ['--sc' as string]: hue }}><small>{label}</small><b>{n(value)}</b>{value !== from && <em>base {n(from)}</em>}</div>
  )

  return createPortal(
    <div className="cd" role="dialog" aria-modal="true" aria-label={`Fiche de ${hero.name}`} style={{ ['--rc' as string]: rarity.color }}>
      <div className="cd__in" ref={top} tabIndex={-1}>
        <nav className="cd__nav">
          <button className="cd__back" onClick={onClose}>← Retour</button>
          <p>{hero.world} <i>›</i> {rarity.label} <i>›</i> <b>{hero.name}</b></p>
        </nav>

        <header className="cd__hero">
          <div className="cd__card"><Card hero={hero} inert locked={!has} /></div>
          <div className="cd__id">
            <p className="cd__rar"><b>{rarity.short}</b>{rarity.label} · N° {String(hero.no).padStart(4, '0')}</p>
            <h1>{hero.name}</h1>
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
            </div>
            <p className="cd__notice" role="status">{notice}</p>
          </div>
        </header>

        {!has && (
          <section className="cd-locked">
            <p>Tu n'as pas encore cette carte. La fiche complète (statistiques, techniques, amélioration) se débloque dès que tu l'obtiens.</p>
            <div className="cd-locked__passive"><small>Passif</small><b>✦ {kit[3].name}</b><p>{kit[3].text}</p></div>
            <dl className="cd-info">
              <div><dt>Où la trouver</dt><dd>{banner ? `Invocation ${banner.world}` : '—'}</dd></div>
              <div><dt>Chance par invocation</dt><dd>{rate ? `${pct(rate)} · 1 sur ${n(Math.round(1 / rate))}` : '—'}</dd></div>
            </dl>
          </section>
        )}

        {has && <>
        <Section hue="#ff5d7a" title="Statistiques" aside={`Puissance ${n(state.power)}`}>
          <div className="cd-level">
            <b>Niveau {state.level}<i> / {state.cap}</i></b>
            <span>{maxed ? (state.freed ? 'Niveau maximum atteint' : `Bloquée au niveau ${LEVEL_CAP} : libère-la pour continuer`) : `${n(state.into)} / ${n(state.need)} XP`}</span>
            <div className="cd-bar"><i style={{ width: maxed ? '100%' : `${(state.into / state.need) * 100}%` }} /></div>
          </div>
          <div className="cd-stats">
            {stat('PV', state.stats.hp, base.hp, '#4be3a4')}
            {stat('Attaque', state.stats.atk, base.atk, '#ff5d7a')}
            {stat('Défense', state.stats.def, base.def, '#5aa8ff')}
            {stat('Vitesse', state.stats.speed, base.speed, '#ffd24d')}
            <div className="cd-stat cd-stat--power"><small>Puissance</small><b>{n(state.power)}</b></div>
            <div className="cd-stat" style={{ ['--sc' as string]: '#b78bff' }}><small>Classement de base</small><b>{baseRank(hero)}<i> / {HEROES.length}</i></b></div>
          </div>
          <p className="cd-note">Chaque niveau ajoute 2 % aux PV, à l’attaque et à la défense.{state.bonus > 0 ? ` Vos collectifs${rebirths ? ' et vos Renaissances' : ''} ajoutent ${state.bonus} %.` : ''}{!has ? ' Valeurs de base : vous ne possédez pas encore cette carte.' : ''}</p>
        </Section>

        <Section hue="#ff9a3d" title="Techniques" aside={hero.role}>
          <ul className="cd-kit">
            {kit.map((m) => (
              <li key={m.kind} className={`cd-kit--${m.kind === 'Attaque' ? 'a' : m.kind === 'Technique' ? 't' : m.kind === 'Ultime' ? 'u' : 'p'}`}><small>{m.kind}</small><b>{m.name}</b><p>{m.text}</p>{m.cost && <em>{m.cost}</em>}</li>
            ))}
          </ul>
          <p className="cd-note">Les chiffres sont calculés sur les statistiques actuelles de la carte : ils montent avec son niveau. Les techniques serviront quand les combats ouvriront.</p>
        </Section>

        <Section hue="#4be3a4" title="Collectifs" aside={`+${state.groups.reduce((s, g) => s + g.bonus, 0)} %`}>
          {state.groups.map((g) => <Group key={g.id} group={g} owned={owned} current={hero} onOpen={onOpen} />)}
        </Section>

        <Section hue="#ffc94d" title="Amélioration" aside={`${n(scrolls.small + scrolls.medium + scrolls.large)} parchemin${scrolls.small + scrolls.medium + scrolls.large > 1 ? 's' : ''}`}>
          <ul className="cd-scrolls">
            {SCROLL_IDS.map((id) => (
              <li key={id}>
                <img className={`cd-scroll cd-scroll--${id}`} src={iconArt(`scroll-${id}`)} alt="" />
                <div><b>{SCROLLS[id].label}</b><small>+{n(SCROLLS[id].xp)} XP · en réserve : {n(scrolls[id])}</small></div>
                <button className="cd-btn cd-btn--small" disabled={!has || maxed || scrolls[id] < 1} onClick={() => { if (useScroll(hero.id, id)) setNotice(`${SCROLLS[id].label} utilisé : +${n(SCROLLS[id].xp)} XP.`) }}>Utiliser</button>
              </li>
            ))}
          </ul>
          <div className={`cd-free ${state.freed ? 'is-free' : ''}`}>
            <img src={iconArt('shard')} alt="" />
            <div>
              <small lang="ja">解放 · Libération</small>
              <b>{state.freed ? 'Carte libérée' : 'Libérer cette carte'}</b>
              <p>+{AWAKEN_STAT} % de PV, d'attaque et de défense, et niveau maximum {MAX_LEVEL} au lieu de {LEVEL_CAP}. Définitif pour cette carte.</p>
              <p className="cd-free__cost">{state.freed ? 'Bonus actif.' : rebirths < 1 ? `Disponible après ta première Renaissance. Coût : ${cost} Fragments d'âme.` : `Coût : ${cost} Fragments d'âme · tu en as ${n(shards)}.`}</p>
            </div>
            {!state.freed && <button className="cd-btn cd-btn--small" disabled={rebirths < 1 || shards < cost} onClick={() => { if (awaken(hero.id)) setNotice('Carte libérée : niveau maximum 100.') }}>Libérer</button>}
          </div>
          <p className="cd-note">Les Fragments d'âme se gagneront dans La Spire (pas encore jouable) ; chaque Renaissance en offre aussi quelques-uns.</p>
          <p className="cd-note">Chaque carte invoquée donne un parchemin : petit pour N et R, moyen pour SR, grand pour SSR, LR et MR.{!has ? ' Il faut posséder la carte pour l’améliorer.' : ''}</p>
        </Section>

        <Section hue="#5ee6ff" title="Historique" aside={history.length ? `${history.length} ligne${history.length > 1 ? 's' : ''}` : undefined}>
          {history.length === 0 ? <p className="cd-note">Rien pour l’instant : cette carte n’a pas encore été obtenue.</p> : (
            <ol className="cd-log">
              {history.map((e, i) => <li key={i} className={`cd-log--${e.k}`}><time>{when(e.t)}</time><span>{e.note}</span></li>)}
            </ol>
          )}
        </Section>

        <Section hue="#7d9bff" title="Informations">
          <dl className="cd-info">
            <div><dt>Numéro</dt><dd>{String(hero.no).padStart(4, '0')}</dd></div>
            <div><dt>Univers</dt><dd>{hero.world}</dd></div>
            <div><dt>Rareté</dt><dd>{rarity.label} ({rarity.short}) · {rarity.stars} étoiles</dd></div>
            <div><dt>Rôle</dt><dd>{hero.role}</dd></div>
            <div><dt>Affinité</dt><dd>{AFFINITIES[hero.affinity].label}</dd></div>
            <div><dt>Bannière</dt><dd>{banner ? banner.world : 'Hors bannière'}</dd></div>
            <div><dt>Chance par invocation</dt><dd>{rate ? `${pct(rate)} · 1 sur ${n(Math.round(1 / rate))}` : '—'}</dd></div>
            <div><dt>Exemplaires</dt><dd>{copies}</dd></div>
            <div><dt>Première obtention</dt><dd>{first ? when(first.t) : '—'}</dd></div>
          </dl>
        </Section>

        </>}

        <Section hue="#b78bff" title="Dans le même univers" aside={`${same.filter((h) => owned[h.id]).length} / ${same.length}`}>
          <div className="cd-same">
            {same.map((h) => <button key={h.id} className="cd-same__item" onClick={() => onOpen(h)} aria-label={`Voir la fiche de ${h.name}`}><Card hero={h} inert locked={!owned[h.id]} /></button>)}
          </div>
        </Section>

        <Section hue="#8089a8" title="Pas encore disponible" closed>
          <p className="cd-note">La cote de la carte (marché entre joueurs), les performances en combat et l’éveil n’existent pas encore dans le jeu. Ces rubriques apparaîtront ici quand le marché et les combats seront construits ; aucun chiffre n’est inventé d’ici là.</p>
        </Section>
      </div>
    </div>,
    document.body,
  )
}
