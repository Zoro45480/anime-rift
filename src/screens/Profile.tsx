import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { cosmeticArt, extraArt } from '../assets/manifest'
import { BANNERS } from '../data/banners'
import { HEROES } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { fetchMyGuild, friendCode, myRank, openCommunity, useOnline } from '../state/online'
import { leagueOf } from '../game/arena'
import { ACHIEVEMENTS, DEFAULT_TITLE, GROUPS, METAL_LABEL, medalOf, progressOf, unlockedTitles, type AchState } from '../game/achievements'
import { canBuy, COSMETICS, cosmeticById, hasCosmetic, howToGet, RARITY_HUE, RARITY_LABEL, type Cosmetic, type CosmeticKind, type Owned, type Rarity } from '../game/cosmetics'
import { accountLevel, cardState } from '../game/progression'
import { Coin } from '../ui/Coin'
import { STAGES } from '../game/saga'
import { SHOWCASE_MAX, useStore } from '../state/store'
import { Card, LazyCard } from '../ui/Card'
import { LevelBadge, levelStyle } from '../ui/LevelBadge'
import { Avatar, FramedAvatar } from '../ui/Settings'

const n = (x: number) => x.toLocaleString('fr-FR')
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const BADGE_MAX = 6
const COLORS = ['#16233f', '#3a2a66', '#5a1f4a', '#124a4a', '#1f4a2a', '#5c3418', '#4a1c22', '#23262e']

// Réduit une image du joueur (photo ou bannière) avant de la garder dans la sauvegarde.
const shrink = (file: File, w: number, h: number) => new Promise<string>((resolve, reject) => {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const k = Math.max(w / img.width, h / img.height)
    c.getContext('2d')!.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k)
    URL.revokeObjectURL(img.src)
    resolve(c.toDataURL('image/jpeg', 0.82))
  }
  img.onerror = () => reject(new Error('image'))
  img.src = URL.createObjectURL(file)
})

// Ce que le joueur possède, pour savoir quels objets d'apparence sont à lui.
const useOwned = (): Owned => {
  const { cosmetics, accountXp, rebirths, saga } = useStore()
  return { bought: cosmetics, level: accountLevel(accountXp, rebirths).level, rebirths, arcs: BANNERS.filter((_, i) => (saga[`${i}-4`] ?? 0) > 0).map((b) => b.id) }
}

// Apparence choisie par le joueur (ou celle par défaut).
const useLook = () => {
  const { profile } = useStore()
  const own = useOwned()
  const pick = (id: string, kind: CosmeticKind) => {
    const c = cosmeticById(id)
    return c && c.kind === kind && hasCosmetic(c, own) ? c : undefined
  }
  return {
    frame: pick(profile.frame, 'frame')?.value ?? levelStyle(own.level, own.rebirths),
    ornament: pick(profile.ornament, 'ornament')?.value,
    aura: pick(profile.aura, 'aura')?.value,
    color: pick(profile.color, 'color')?.value ?? '#ffffff',
    effect: pick(profile.effect, 'effect')?.value ?? 'none',
    theme: pick(profile.theme, 'theme')?.value ?? '#7d5cff',
    own,
  }
}

// Rareté d'un titre : ceux des succès suivent leur médaille, ceux de la boutique leur prix.
const titleRarity = (title: string): Rarity => {
  const a = ACHIEVEMENTS.find((x) => x.title === title)
  if (a) return a.metal === 'gold' ? 'legend' : a.metal === 'silver' ? 'epic' : 'rare'
  return COSMETICS.find((x) => x.kind === 'title' && x.name === title)?.rarity ?? 'common'
}
// Le titre, écrit sur sa plaque 3D.
export const TitlePlate = ({ title, small }: { title: string; small?: boolean }) => (
  <span className={`plate plate--${titleRarity(title)} ${small ? 'plate--small' : ''}`}><img src={cosmeticArt(`plate-${titleRarity(title)}`)} alt="" /><b>{title}</b></span>
)

// Le pseudo, avec sa couleur et son effet.
const Name = ({ tag: Tag = 'h1' }: { tag?: 'h1' | 'b' }) => {
  const { profile } = useStore()
  const look = useLook()
  const grad = look.color.startsWith('linear')
  return <Tag className={`pf-name pf-name--${look.effect} ${look.color === 'rainbow' ? 'pf-name--rainbow' : ''} ${grad ? 'pf-name--grad' : ''}`} style={{ ['--nc' as string]: grad || look.color === 'rainbow' ? '#fff' : look.color, ...(grad ? { backgroundImage: look.color } : {}) }}>{profile.name.trim() || 'Joueur'}</Tag>
}
const Photo = ({ size }: { size: number }) => {
  const look = useLook()
  return <FramedAvatar size={size} style={look.frame} aura={look.aura} ornament={look.ornament} />
}

// Carte d'aperçu du profil, dans la fenêtre de modification.
const Preview = () => {
  const { profile } = useStore()
  const playerNo = usePlayerNo()
  const look = useLook()
  return (
    <div className="pe__card" style={{ ['--tc' as string]: look.theme }}>
      <Photo size={150} />
      <div><Name tag="b" /><small>#{playerNo(profile.tag)}</small><TitlePlate title={profile.title || DEFAULT_TITLE} small /></div>
    </div>
  )
}

const swatch = (c: Cosmetic) => c.kind === 'frame' ? <img src={cosmeticArt(`frame-${c.value}`)} alt="" />
  : c.kind === 'ornament' ? <span className="pe__stack"><img src={cosmeticArt('frame-t0')} alt="" /><img src={cosmeticArt(`orn-${c.value}`)} alt="" /></span>
    : c.kind === 'aura' ? <span className="pe__stack"><img className={`avatar-frame__aura avatar-frame__aura--${c.value}`} src={cosmeticArt(`aura-${c.value}`)} alt="" /><img src={cosmeticArt('frame-t0')} alt="" /></span>
      : c.kind === 'effect' ? <i className={`pf-name pf-name--${c.value}`} style={{ ['--nc' as string]: '#fff' }}>Aa</i>
        : c.kind === 'title' ? <TitlePlate title={c.name} small />
          : <i className="pe__dot" style={{ background: c.value === 'rainbow' ? 'conic-gradient(#ff5d7a, #ffd24d, #4be3a4, #5ee6ff, #b78bff, #ff5d7a)' : c.value }} />

// Les sept catégories de l'apparence.
type Cat = 'title' | 'badge' | 'frame' | 'effect' | 'color' | 'ornament' | 'theme'
const CATS: [Cat, string, CosmeticKind[]][] = [['title', 'Titres', ['title']], ['badge', 'Badges', []], ['frame', 'Cadres', ['frame']], ['effect', 'Effets', ['aura', 'effect']], ['color', 'Couleurs', ['color']], ['ornament', 'Ornements', ['ornament']], ['theme', 'Thèmes', ['theme']]]

type EditTab = 'id' | 'banner' | 'cards' | 'look' | 'ach' | 'shop'
const EDIT_TABS: [EditTab, string][] = [['id', 'Identité'], ['banner', 'Bannière'], ['cards', 'Cartes favorites'], ['look', 'Apparence'], ['ach', 'Succès'], ['shop', 'Boutique']]

const Edit = ({ ach, start, onClose }: { ach: AchState; start: EditTab; onClose: () => void }) => {
  const store = useStore()
  const { profile } = store
  const [tab, setTab] = useState<EditTab>(start)
  const [link, setLink] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const titles = unlockedTitles(ach)
  const look = useLook()
  const [cat, setCat] = useState<Cat>('frame')
  const own = look.own
  const allTitles = [DEFAULT_TITLE, ...ACHIEVEMENTS.map((a) => a.title), ...COSMETICS.filter((c) => c.kind === 'title').map((c) => c.name)]
  const myTitles = [...titles, ...COSMETICS.filter((c) => c.kind === 'title' && hasCosmetic(c, own)).map((c) => c.name)]
  const equip = (c: Cosmetic) => store.setProfile({ [c.kind]: profile[c.kind as 'frame'] === c.id ? '' : c.id })
  const badges = ACHIEVEMENTS.filter((a) => progressOf(a, ach).done)
  const toggleBadge = (id: string) => store.setProfile({ badges: profile.badges.includes(id) ? profile.badges.filter((x) => x !== id) : profile.badges.length < BADGE_MAX ? [...profile.badges, id] : profile.badges })
  const ownedCards = HEROES.filter((h) => store.owned[h.id]).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.no - b.no)
  const shown = ownedCards.filter((h) => fold(`${h.name} ${h.world}`).includes(fold(query.trim())))
  const pick = async (file: File | undefined, kind: 'avatar' | 'banner') => {
    if (!file) return
    setError('')
    try {
      if (kind === 'avatar') store.setProfile({ avatar: await shrink(file, 160, 160) })
      else store.setProfile({ banner: { kind: 'image', value: await shrink(file, 900, 420) } })
    } catch { setError('Cette image n’a pas pu être lue.') }
  }
  const onLink = (e: FormEvent) => {
    e.preventDefault()
    const url = link.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) return setError('Colle une adresse complète, qui commence par https://')
    const img = new Image()
    img.onload = () => { store.setProfile({ avatar: url }); setLink(''); setError('') }
    img.onerror = () => setError('Ce lien n’a pas pu être chargé comme image.')
    img.src = url
  }
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Modifier le profil" onClick={onClose}>
      <div className="modal__box pe" onClick={(e) => e.stopPropagation()}>
        <header className="pe__head">
          <div><p>Ton profil</p><h2>Modifier le profil</h2></div>
          <button className="notifs__close" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <div className="coltabs__bar pe__tabs" role="tablist">
          {EDIT_TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </div>

        {tab === 'id' && (
          <section className="pe__sec">
            <div className="pe__photo">
              <Avatar size={92} />
              <div>
                <h3>Photo de profil</h3>
                <label className="cd-btn cd-btn--small" htmlFor="pe-avatar">Choisir une image</label>
                <input id="pe-avatar" className="artpick__input" type="file" accept="image/*" onChange={(e) => { void pick(e.target.files?.[0], 'avatar'); e.target.value = '' }} />
                {profile.avatar && <button className="linkbtn" onClick={() => store.setProfile({ avatar: '' })}>Retirer la photo</button>}
              </div>
            </div>
            <form className="set__link" onSubmit={onLink}>
              <input className="set__input" type="url" inputMode="url" placeholder="…ou colle le lien d’une image" aria-label="Lien d'une image de profil" value={link} onChange={(e) => setLink(e.target.value)} />
              <button className="cd-btn cd-btn--small" type="submit">OK</button>
            </form>
            <h3>Pseudo</h3>
            <input className="set__input" type="text" maxLength={20} placeholder="Joueur" aria-label="Pseudo" value={profile.name} onChange={(e) => store.setProfile({ name: e.target.value })} />
            <h3>Bio <small>160 caractères maximum</small></h3>
            <textarea className="set__input pe__bio" maxLength={160} placeholder="Présente-toi en quelques mots…" aria-label="Bio" value={profile.bio} onChange={(e) => store.setProfile({ bio: e.target.value })} />
          </section>
        )}

        {tab === 'banner' && (
          <section className="pe__sec">
            <h3>Bannière du profil</h3>
            <Banner className="pe__preview" />
            <label className="cd-btn cd-btn--small" htmlFor="pe-banner">↑ Importer une image</label>
            <input id="pe-banner" className="artpick__input" type="file" accept="image/*" onChange={(e) => { void pick(e.target.files?.[0], 'banner'); e.target.value = '' }} />
            <h3>Image d'un animé</h3>
            <div className="pe__animes">
              {BANNERS.map((b) => (
                <button key={b.id} className={profile.banner.kind === 'anime' && profile.banner.value === b.id ? 'is-on' : ''} style={{ ['--hue' as string]: b.hue }} aria-pressed={profile.banner.kind === 'anime' && profile.banner.value === b.id} onClick={() => store.setProfile({ banner: { kind: 'anime', value: b.id } })}>
                  <img src={extraArt(`emblem-${b.id}`)} alt="" /><span>{b.world}</span>
                </button>
              ))}
            </div>
            <h3>Couleur de fond</h3>
            <div className="pe__colors">
              {COLORS.map((c) => <button key={c} style={{ background: c }} className={profile.banner.kind === 'color' && profile.banner.value === c ? 'is-on' : ''} aria-label={`Couleur ${c}`} aria-pressed={profile.banner.kind === 'color' && profile.banner.value === c} onClick={() => store.setProfile({ banner: { kind: 'color', value: c } })} />)}
            </div>
          </section>
        )}

        {tab === 'cards' && (
          <section className="pe__sec">
            <h3>Cartes favorites <small>jusqu'à {SHOWCASE_MAX}</small></h3>
            <p className="set__note">Touche une carte pour l'exposer sur ton profil, touche-la encore pour la retirer. Ce sont les mêmes que « Ma vitrine ».</p>
            <ol className="pe__slots">
              {Array.from({ length: SHOWCASE_MAX }, (_, i) => {
                const h = HEROES.find((x) => x.id === store.pinned[i])
                return <li key={i} className={h ? 'is-set' : ''}><b>{i + 1}</b><span>{h ? h.name : 'Emplacement libre'}</span></li>
              })}
            </ol>
            <input className="set__input" type="search" placeholder="Rechercher une carte" aria-label="Rechercher une carte" value={query} onChange={(e) => setQuery(e.target.value)} />
            {ownedCards.length === 0 ? <p className="set__note">Tu n'as encore aucune carte.</p> : (
              <ul className="pe__pick">
                {shown.map((h) => (
                  <li key={h.id}><button className={store.pinned.includes(h.id) ? 'is-on' : ''} aria-pressed={store.pinned.includes(h.id)} style={{ ['--rc' as string]: RARITIES[h.rarity].color }} onClick={() => store.togglePin(h.id)}>
                    <b>{RARITIES[h.rarity].short}</b><span>{h.name}</span><small>{h.world}</small>
                  </button></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'look' && (
          <section className="pe__sec">
            <Preview />
            <div className="pe__kinds" role="tablist" aria-label="Catégories d'apparence">
              {CATS.map(([id, label, kinds]) => {
                const [have, total] = id === 'title' ? [myTitles.length, allTitles.length] : id === 'badge' ? [badges.length, ACHIEVEMENTS.length]
                  : [COSMETICS.filter((c) => kinds.includes(c.kind) && hasCosmetic(c, own)).length, COSMETICS.filter((c) => kinds.includes(c.kind)).length]
                return <button key={id} role="tab" aria-selected={cat === id} className={cat === id ? 'is-on' : ''} onClick={() => setCat(id)}>{label} <small>{have}/{total}</small></button>
              })}
            </div>

            {cat === 'title' && (
              <ul className="pe__titles">
                {allTitles.map((t) => {
                  const ok = myTitles.includes(t)
                  const worn = (profile.title || DEFAULT_TITLE) === t
                  const a = ACHIEVEMENTS.find((x) => x.title === t)
                  const shop = COSMETICS.find((x) => x.kind === 'title' && x.name === t)
                  return <li key={t}><button disabled={!ok} className={worn ? 'is-on' : ''} aria-pressed={worn} aria-label={`Titre ${t}`} onClick={() => store.setProfile({ title: t })}>
                    <TitlePlate title={t} small /><small>{worn ? 'Équipé' : ok ? RARITY_LABEL[titleRarity(t)] : a ? `Succès « ${a.name} »` : shop ? <Price text={`${n(shop.price)} âmes en boutique`} /> : ''}</small>
                  </button></li>
                })}
              </ul>
            )}

            {cat === 'badge' && <>
              <p className="set__note">Chaque succès donne un badge. Épingle-en jusqu'à {BADGE_MAX} sur ton profil ({profile.badges.length} épinglé{profile.badges.length > 1 ? 's' : ''}).</p>
              <ul className="pe__items">
                {ACHIEVEMENTS.map((a) => {
                  const ok = progressOf(a, ach).done
                  const on = profile.badges.includes(a.id)
                  return <li key={a.id}><button disabled={!ok} className={on ? 'is-on' : ''} aria-pressed={on} aria-label={`Badge ${a.name}`} onClick={() => toggleBadge(a.id)}>
                    <img className="pe__medal" src={cosmeticArt(medalOf(a))} alt="" /><b>{a.name}</b><small>{on ? 'Épinglé' : ok ? 'Obtenu' : a.goal}</small>
                  </button></li>
                })}
              </ul>
            </>}

            {cat !== 'title' && cat !== 'badge' && <>
              <ul className="pe__items">
                {COSMETICS.filter((c) => CATS.find((x) => x[0] === cat)![2].includes(c.kind)).map((c) => {
                  const ok = hasCosmetic(c, own)
                  const worn = profile[c.kind as 'frame'] === c.id
                  return (
                    <li key={c.id}><button disabled={!ok} className={worn ? 'is-on' : ''} aria-pressed={worn} aria-label={`${c.name}${worn ? ' (équipé)' : ''}`} style={{ ['--rh' as string]: RARITY_HUE[c.rarity] }} onClick={() => equip(c)}>
                      {swatch(c)}<b>{c.name}</b><small>{worn ? 'Équipé' : ok ? RARITY_LABEL[c.rarity] : <Price text={howToGet(c)} />}</small>
                    </button></li>
                  )
                })}
              </ul>
              <p className="set__note">{cat === 'frame' ? 'Sans cadre choisi, ton profil porte celui de ton niveau. Les cadres d’animé sont offerts en finissant leur arc dans La Saga.' : 'Touche un objet équipé pour le retirer.'}</p>
            </>}
          </section>
        )}

        {tab === 'shop' && (
          <section className="pe__sec">
            <Preview />
            <p className="pe__wallet"><Coin name="soul" size={26} /><b>{n(store.gems)}</b> âmes</p>
            <p className="set__note">Tout se paie en âmes, gagnées en jouant. L'objet acheté est équipé aussitôt. Certains objets se gagnent aussi sans payer (niveau, arc terminé) ; le cadre Arc-en-ciel ne s'obtient qu'avec une Renaissance.</p>
            {CATS.filter(([id]) => id !== 'badge').map(([id, label, kinds]) => {
              const list = COSMETICS.filter((c) => kinds.includes(c.kind) && c.price > 0 && !c.needRebirth && !hasCosmetic(c, own))
              return list.length === 0 ? null : (
                <div key={id}>
                  <h3>{label} <small>{list.length} à vendre</small></h3>
                  <ul className={id === 'title' ? 'pe__titles' : 'pe__items'}>
                    {list.map((c) => (
                      <li key={c.id}><button disabled={!canBuy(c, own, store.gems)} style={{ ['--rh' as string]: RARITY_HUE[c.rarity] }} onClick={() => store.buyCosmetic(c.id)} aria-label={`Acheter ${c.name} pour ${c.price} âmes`}>
                        {swatch(c)}{c.kind !== 'title' && <b>{c.name}</b>}<small className="pe__price"><Coin name="soul" size={16} />{n(c.price)}</small>
                      </button></li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>
        )}

        {tab === 'ach' && <section className="pe__sec"><Achievements ach={ach} /></section>}
        {error && <p className="artpick__error" role="alert">{error}</p>}
        <button className="btn btn--gold" onClick={onClose}>Terminer</button>
      </div>
    </div>,
    document.body,
  )
}

const Achievements = ({ ach }: { ach: AchState }) => (
  <>
    {GROUPS.map((group) => {
      const list = ACHIEVEMENTS.filter((a) => a.group === group)
      return (
        <div key={group} className="ach">
          <h3><img src={extraArt('dist-trophy')} alt="" />{group} <small>{list.filter((a) => progressOf(a, ach).done).length} / {list.length}</small></h3>
          <ul>
            {list.map((a) => {
              const p = progressOf(a, ach)
              return (
                <li key={a.id} className={p.done ? 'is-done' : ''}>
                  <img className="ach__medal" src={cosmeticArt(medalOf(a))} alt="" />
                  <div><b>{a.name}</b><span>{a.goal}</span><div className="cd-bar"><i style={{ width: `${(p.value / a.target) * 100}%` }} /></div></div>
                  <em>{p.done ? '✓' : `${n(p.value)} / ${n(a.target)}`}</em>
                  <small><i className={`ach__rar ach__rar--${a.metal}`}>{METAL_LABEL[a.metal]}</i> Titre : {a.title}</small>
                </li>
              )
            })}
          </ul>
        </div>
      )
    })}
  </>
)

// La bannière du profil : image d'un animé (AniList), couleur ou image du joueur.
const Banner = ({ className }: { className: string }) => {
  const { profile, bannerArt } = useStore()
  const b = profile.banner
  const src = b.kind === 'image' ? b.value : b.kind === 'anime' ? bannerArt[b.value] : ''
  const hue = b.kind === 'color' ? b.value : BANNERS.find((x) => x.id === b.value)?.hue ?? '#3a2a66'
  return (
    <div className={className} style={{ ['--hue' as string]: hue }}>
      {src && <img src={src} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
    </div>
  )
}

type View = 'overview' | 'collection' | 'stats'

export const Profile = ({ onCollection }: { onCollection: () => void }) => {
  const store = useStore()
  const { profile, owned, bannerArt } = store
  const look = useLook()
  const online = useOnline()
  const playerNo = usePlayerNo()
  const [view, setView] = useState<View>('overview')
  const [edit, setEdit] = useState<EditTab | null>(null)
  const acc = accountLevel(store.accountXp, store.rebirths)
  const ach: AchState = store
  const mine = HEROES.filter((h) => owned[h.id])
  const legends = mine.filter((h) => h.rarity === 'legend' || h.rarity === 'rift').length
  const stars = Object.values(store.saga).reduce((a, b) => a + b, 0)
  const done = ACHIEVEMENTS.filter((a) => progressOf(a, ach).done).length
  const worlds = BANNERS.map((b) => ({ banner: b, total: HEROES.filter((h) => h.world === b.world).length, have: mine.filter((h) => h.world === b.world).length }))
    .sort((a, b) => b.have - a.have)
  const collected = worlds.filter((w) => w.have > 0).length
  const strongest = mine.map((h) => ({ h, p: cardState(h, store.xp, owned, store.rebirths, store.awakened, store.teamNow).power })).sort((a, b) => b.p - a.p)[0]
  const byRarity = RARITY_ORDER.map((id) => ({ id, count: mine.filter((h) => h.rarity === id).length }))
  // anneau de répartition : un arc par rareté
  const R = 44, C = 2 * Math.PI * R
  let offset = 0
  const arcs = byRarity.filter((r) => r.count > 0).map((r) => { const len = (r.count / Math.max(1, mine.length)) * C; const a = { ...r, len, offset }; offset += len; return a })
  const stats: [string, string, string][] = [
    ['集', 'Cartes collectées', `${n(mine.length)} / ${n(HEROES.length)}`], ['光', 'Cartes LR et MR', n(legends)], ['闘', 'Combats gagnés', n(store.wins)],
    ['界', 'Univers collectionnés', `${collected} / ${BANNERS.length}`], ['星', 'Étoiles de La Saga', `${stars} / ${STAGES.length * 3}`], ['召', 'Invocations réalisées', n(store.pulls)],
    ['剣', 'Victoires en arène', n(store.arena.wins)], ['塔', 'Meilleur étage de La Spire', n(store.spire.best)],
  ]

  return (
    <div className="pf">
      <section className="pf-hero" style={{ ['--tc' as string]: look.theme }}>
        <Banner className="pf-hero__bg" />
        <div className="pf-hero__id">
          <span className="pf-hero__photo"><Photo size={typeof window !== 'undefined' && window.innerWidth < 640 ? 118 : 220} />{online.me && <i className="pf-online" title="En ligne" />}</span>
          <div>
            <Name />
            <p className="pf-hero__chips"><TitlePlate title={profile.title || DEFAULT_TITLE} /><span title={online.me ? 'Ton numéro de joueur : l’ordre dans lequel tu as rejoint le jeu' : 'Crée un compte (Réglages) pour recevoir ton vrai numéro de joueur'}>#{playerNo(profile.tag)}</span>{online.me && <span className="pf-code" title="Ton code ami : donne-le pour qu'on t'ajoute (Communauté → Social)">Code ami <b>{friendCode(online.me.player_no)}</b></span>}</p>
            <HeroFacts elo={store.arena.elo} />
            <p className="pf-hero__bio">{profile.bio.trim() || 'Aucune bio pour l’instant. Présente-toi dans « Modifier le profil ».'}</p>
          </div>
        </div>
        <div className="pf-hero__level">
          <LevelBadge level={acc.level} rebirths={store.rebirths} size={54} />
          <div><div className="cd-bar"><i style={{ width: acc.need ? `${(acc.into / acc.need) * 100}%` : '100%' }} /></div><small>{acc.need ? `${n(acc.into)} / ${n(acc.need)} XP` : 'Niveau maximum'}</small></div>
        </div>
        <div className="pf-hero__actions">
          <button className="cd-btn cd-btn--small" onClick={() => setEdit('id')}>✎ Modifier le profil</button>
          <button className="cd-btn cd-btn--small" onClick={() => setEdit('look')}>✦ Apparence</button>
        </div>
      </section>

      <section className="pf-box pf-box--badges">
        <header className="pf-box__head"><h2>Badges épinglés <small>{profile.badges.filter((id) => ACHIEVEMENTS.some((a) => a.id === id && progressOf(a, ach).done)).length} / {BADGE_MAX}</small></h2><button className="linkbtn" onClick={() => setEdit('look')}>Choisir</button></header>
        {profile.badges.length === 0 ? <p className="pf-empty">Épingle jusqu'à {BADGE_MAX} badges depuis « Apparence ». Chaque succès obtenu en donne un.</p> : (
          <ul className="pf-badges">
            {ACHIEVEMENTS.filter((a) => profile.badges.includes(a.id) && progressOf(a, ach).done).map((a) => <li key={a.id}><img src={cosmeticArt(medalOf(a))} alt="" /><b>{a.name}</b><span>{a.title}</span></li>)}
          </ul>
        )}
      </section>

      <section className="pf-box pf-box--dist">
        <header className="pf-box__head"><h2>Distinctions</h2><button className="linkbtn" onClick={() => setEdit('ach')}>Voir mes {ACHIEVEMENTS.length} succès</button></header>
        <ul className="pf-dist">
          <li style={{ ['--dc' as string]: '#ff9a4a' }}><img src={extraArt('dist-rebirth')} alt="" /><b>{store.rebirths}</b><span>Renaissance{store.rebirths > 1 ? 's' : ''}</span></li>
          <li style={{ ['--dc' as string]: '#ff7ab8' }}><img src={extraArt('dist-legend')} alt="" /><b>{legends}</b><span>Cartes LR et MR</span></li>
          <li style={{ ['--dc' as string]: '#4be3a4' }}><img src={extraArt('dist-collection')} alt="" /><b>{((mine.length / HEROES.length) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</b><span>{n(mine.length)} persos</span></li>
          <li style={{ ['--dc' as string]: '#ffc94d' }}><img src={extraArt('dist-stars')} alt="" /><b>{stars}</b><span>Étoiles de La Saga</span></li>
          <li style={{ ['--dc' as string]: '#b78bff' }}><img src={extraArt('dist-trophy')} alt="" /><b>{done} / {ACHIEVEMENTS.length}</b><span>Succès</span></li>
          <li style={{ ['--dc' as string]: '#5aa8ff' }}><img src={extraArt('dist-summon')} alt="" /><b>{n(store.pulls)}</b><span>Invocations</span></li>
        </ul>
      </section>

      <div className="coltabs__bar" role="tablist" aria-label="Sections du profil">
        {([['overview', 'Aperçu'], ['collection', `Collection ${mine.length}`], ['stats', 'Statistiques']] as [View, string][]).map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>{label}</button>)}
      </div>

      {view === 'overview' && <>
        <section className="pf-fav">
          <header><h2>Cartes favorites</h2><em>{store.pinned.length} exposée{store.pinned.length > 1 ? 's' : ''}</em><button className="linkbtn" onClick={() => setEdit('cards')}>Choisir</button></header>
          {store.pinned.length === 0 ? <p className="pf-empty">Aucune carte exposée. Touche « Choisir » pour mettre tes préférées en avant.</p>
            : <div className="pf-fav__row">{store.pinned.map((id) => <Card key={id} hero={HEROES.find((h) => h.id === id)!} />)}</div>}
        </section>
        <section className="pf-box pf-box--brief">
          <h2>En bref</h2>
          <ul className="pf-brief">{stats.slice(0, 4).map(([k, label, value]) => <li key={label}><i lang="ja">{k}</i><span>{label}</span><b>{value}</b></li>)}</ul>
        </section>
      </>}

      {view === 'collection' && <>
        <section className="pf-box">
          <header className="pf-box__head"><h2>Collection</h2><button className="linkbtn" onClick={onCollection}>Ouvrir la collection complète →</button></header>
          <div className="pf-ring" role="img" aria-label={`${mine.length} cartes uniques`}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={R} className="pf-ring__track" />
              {arcs.map((a) => <circle key={a.id} cx="50" cy="50" r={R} stroke={RARITIES[a.id].color} strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} />)}
            </svg>
            <div><b>{n(mine.length)}</b><span>cartes uniques</span></div>
          </div>
          <ul className="pf-rar">
            {byRarity.map((r) => <li key={r.id} style={{ ['--rc' as string]: RARITIES[r.id].color }}><span>{RARITIES[r.id].short}</span><b>{r.count}</b><small>{mine.length ? Math.round((r.count / mine.length) * 100) : 0} %</small></li>)}
          </ul>
        </section>
        <section className="pf-box">
          <h2>Univers collectionnés <small>{collected}</small></h2>
          <ul className="pf-worlds">
            {worlds.map(({ banner, total, have }) => {
              const pct = Math.round((have / total) * 100)
              return (
                <li key={banner.id} style={{ ['--hue' as string]: banner.hue }}>
                  {bannerArt[banner.id] && <img className="pf-worlds__bg" src={bannerArt[banner.id]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                  <span className="pf-worlds__pct" style={{ ['--p' as string]: `${pct}%` }}><b>{pct}%</b></span>
                  <div><b>{banner.world}</b><span>{have} / {total}</span></div>
                  <img className="pf-worlds__emblem" src={extraArt(`emblem-${banner.id}`)} alt="" />
                </li>
              )
            })}
          </ul>
        </section>
        <section className="pf-box">
          <h2>Cartes collectionnées</h2>
          {mine.length === 0 ? <p className="pf-empty">Aucune carte pour l'instant.</p>
            : <div className="pf-cards">{[...mine].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.no - b.no).map((h) => <LazyCard key={h.id} hero={h} count={owned[h.id]} />)}</div>}
        </section>
      </>}

      {view === 'stats' && (
        <section className="pf-box">
          <h2>Statistiques</h2>
          <ul className="pf-stats">
            {[...stats, ['解', 'Cartes libérées', n(store.awakened.length)] as [string, string, string], ['力', 'Carte la plus puissante', strongest ? `${strongest.h.name} · ${n(strongest.p)}` : '—'] as [string, string, string], ['魂', 'Âmes dépensées', n(store.gemsSpent)] as [string, string, string]]
              .map(([k, label, value]) => <li key={label}><i lang="ja">{k}</i><span>{label}</span><b>{value}</b></li>)}
          </ul>
          <p className="set__note">Le classement contre les autres joueurs et la guilde demandent un jeu en ligne. L'Arène se joue contre les Rivaux du Rift.</p>
        </section>
      )}

      {edit && <Edit ach={ach} start={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

// Remplace « 150 âmes » par 150 suivi du logo des âmes.
const Price = ({ text }: { text: string }) => {
  const parts = text.split(/([\d\s\u202f]+) âmes/)
  return <span className="pe__cost">{parts.map((x, i) => (i % 2 ? <span key={i} className="pe__cost-n">{x.trim()}<Coin name="soul" size={15} /></span> : x))}</span>
}

// Numéro de joueur : celui du serveur quand on est connecté (ordre d'inscription), sinon le numéro local.
const usePlayerNo = () => { const { me } = useOnline(); return (local: string) => (me ? String(me.player_no) : local) }

// Classement en arène et guilde, affichés sous le nom.
const HeroFacts = ({ elo }: { elo: number }) => {
  const { me } = useOnline()
  const [rank, setRank] = useState<number | null>(null)
  const [guild, setGuild] = useState<string | null>(null)
  useEffect(() => {
    if (!me) { setRank(null); setGuild(null); return }
    let live = true
    void myRank(me, 'arena').then((r) => { if (live) setRank(r) })
    void fetchMyGuild().then((g) => { if (live) setGuild(g?.guild?.name ?? null) }).catch(() => undefined)
    return () => { live = false }
  }, [me])
  const lg = leagueOf(elo)
  return (
    <ul className="pf-facts">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4" /></svg>
        <span>{rank ? `Classé : ${rank.toLocaleString('fr-FR')}e` : 'Classement'}</span><b style={{ color: lg.hue }}>{lg.label}</b><i>({elo.toLocaleString('fr-FR')} élo)</i></li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6zM9 10h6M9 14h6" /></svg>
        <span>Guilde</span>{guild ? <button className="pf-facts__link" onClick={() => openCommunity('guild')}>{guild} <em aria-hidden="true">›</em></button>
          : <button className="pf-facts__link pf-facts__link--none" onClick={() => openCommunity('guild')}>Aucune <em aria-hidden="true">›</em></button>}</li>
    </ul>
  )
}
