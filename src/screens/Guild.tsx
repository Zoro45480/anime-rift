import { TabIcon } from '../ui/TabIcon'
import { useCallback, useEffect, useState } from 'react'
import { colossusOf } from '../game/colossus'
import { weekKey } from '../game/contracts'
import {
  answerRequest, answerRivalry, guildRenown, declareRivalry, fetchRivalries, type Rivalry, createGuild, fetchGuilds, fetchMyGuild, hitGuildBoss, joinGuild, leaveGuild, playersById, setMemberRole, useOnline, weekDamage,
  type Guild, type GuildMember, type PublicPlayer,
} from '../state/online'
import { useStore } from '../state/store'
import { heroById, roleKind } from '../data/heroes'
import { BRANCHES, currentSector, hqLevel, HQ_STEP, OPERATIONS, sectorProgress } from '../game/operations'
import { Battle } from './Saga'
import type { ColResult } from '../state/store'

const n = (x: number) => x.toLocaleString('fr-FR')
const EMBLEMS = ['狐', '龍', '鬼', '侍', '忍', '炎', '雷', '月', '桜', '虎', '神', '影']
const COLORS = ['#ff3d6e', '#ffc94d', '#22d3ee', '#a855f7', '#4ade80', '#f97316', '#3b82f6', '#e5e7eb']
const KIND: Record<Guild['kind'], string> = { open: 'Ouvert', invite: 'Sur invitation', closed: 'Fermé' }
export const GUILD_BOSS_HP = 50_000_000 // PV du boss de Guilde de la semaine
type Tab = 'find' | 'create' | 'rank'

const Emblem = ({ g, size = 64 }: { g: { emblem: string; color: string }; size?: number }) => (
  <span className="gd-emblem" style={{ width: size, height: size, fontSize: size * 0.55, ['--gc' as string]: g.color }} lang="ja">{g.emblem}</span>
)

export const GuildPage = ({ onConnect }: { onConnect: () => void }) => {
  const { session } = useOnline()
  const [mine, setMine] = useState<Awaited<ReturnType<typeof fetchMyGuild>> | undefined>(undefined)
  const reload = useCallback(async () => setMine(await fetchMyGuild()), [])
  useEffect(() => { if (session) void reload() }, [session, reload])
  if (!session) return <section className="so-login"><h2>Guilde</h2><p>Connecte-toi avec Discord ou Google pour rejoindre une Guilde ou fonder le tien.</p><button className="oauth oauth--discord" onClick={onConnect}>Se connecter</button></section>
  if (mine === undefined) return <p className="pf-empty">Chargement de ta Guilde…</p>
  return mine ? <MyGuild data={mine} reload={reload} /> : <NoGuild reload={reload} />
}

const Hero = () => (
  <header className="gd-hero">
    <span className="gd-hero__kanji" lang="ja" aria-hidden="true">組</span>
    <p className="eyebrow">Anime Rift — Guilde</p>
    <h1>Guilde</h1>
    <p>Rejoins une Guilde ou fonde le tien : on est plus forts à plusieurs.</p>
    <ul className="gd-perks">
      <li><b>Boss de la semaine</b><span>Cumulez vos dégâts contre un boss commun.</span></li>
      <li><b>Classement</b><span>La Guilde qui inflige le plus de dégâts mène la semaine.</span></li>
      <li><b>Entraide</b><span>Discute avec ta Guilde et échange tes doublons.</span></li>
    </ul>
  </header>
)

const GuildRow = ({ g, i, action }: { g: Guild; i?: number; action?: React.ReactNode }) => (
  <li className="gd-row">
    {i !== undefined && <span className="gd-row__rank">{i + 1}</span>}
    <Emblem g={g} size={46} />
    <div className="gd-row__id"><b>{g.name} <i>{g.tag}</i></b><small>{KIND[g.kind]} · {g.members} / {g.max_members} membres · {g.min_level ? `niveau ${g.min_level} requis` : 'aucune condition'}</small></div>
    <span className="gd-row__score">{n(Number(g.week_damage))}<small>dégâts</small></span>
    {action}
  </li>
)

const NoGuild = ({ reload }: { reload: () => Promise<void> }) => {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('find')
  const [q, setQ] = useState('')
  const [only, setOnly] = useState(false)
  const [list, setList] = useState<Guild[] | null>(null)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', tag: '', description: '', kind: 'open', min_level: 0, max_members: 50, emblem: '狐', color: '#ff3d6e' })
  const load = useCallback(async () => setList(await fetchGuilds(q)), [q])
  useEffect(() => { void load() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const lvl = useOnline().me?.level ?? 1
  const shown = (list ?? []).filter((g) => !only || (g.kind !== 'closed' && g.members < g.max_members && lvl >= g.min_level))
  const join = async (g: Guild) => { const r = await joinGuild(g.id); setMsg(r === 'ok' ? `Bienvenue dans ${g.name} !` : r === 'demande' ? `Candidature envoyée à ${g.name}.` : r); if (r === 'ok') await reload() }
  return (
    <div className="gd">
      <Hero />
      <div className="coltabs__bar so__tabs" role="tablist">
        {([['find', 'Trouver une Guilde'], ['create', 'Créer une Guilde'], ['rank', 'Classement']] as [Tab, string][]).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><TabIcon id={id} />{l}</button>)}
      </div>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {tab === 'find' && <div className="so__grid">
        <section className="so-box">
          <header className="so-box__head"><h2>Trouver une Guilde</h2></header>
          <form className="so-send" onSubmit={(e) => { e.preventDefault(); void load() }}><input className="set__input" type="search" placeholder="Nom ou tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nom ou tag" /><button className="btn btn--gold" type="submit">Rechercher</button></form>
          <label className="gd-check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Seulement celles que je peux rejoindre (niveau, place)</label>
          {!list ? <p className="pf-empty">Chargement…</p> : shown.length === 0 ? <p className="pf-empty">Aucune Guilde pour l'instant : fonde la première !</p> :
            <ul className="gd-list">{shown.map((g) => <GuildRow key={g.id} g={g} action={g.kind === 'closed' ? <small>Fermée</small> : <button className="btn btn--gold gd-join" onClick={() => void join(g)}>{g.kind === 'invite' ? 'Candidater' : 'Rejoindre'}</button>} />)}</ul>}
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Pas de Guilde à ton goût ?</h2></header><p className="set__note">Crée la tienne : tu en deviens le chef, tu choisis son nom, son emblème et qui peut la rejoindre.</p><button className="btn btn--gold" onClick={() => setTab('create')}>+ Créer une Guilde</button></section>
      </div>}
      {tab === 'create' && <div className="so__grid">
        <section className="so-box">
          <header className="so-box__head"><h2>Créer une Guilde</h2></header>
          <form className="gd-form" onSubmit={async (e) => { e.preventDefault(); const r = await createGuild(form); setMsg(r === 'ok' ? 'Ta Guilde est fondée !' : r); if (r === 'ok') await reload() }}>
            <div className="gd-form__two"><label>Nom<input className="set__input" required minLength={3} maxLength={24} placeholder="Ex. Les Renards de Feu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Tag<input className="set__input" required pattern="[A-Za-z0-9]{2,5}" maxLength={5} placeholder="RDF" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} /></label></div>
            <label>Description<textarea className="set__input" maxLength={200} placeholder="Notre but : finir L’Aventure à 3 étoiles" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <p className="gd-label">Type</p>
            <div className="gd-kinds">{(['open', 'invite', 'closed'] as const).map((k) => <button type="button" key={k} className={form.kind === k ? 'is-on' : ''} onClick={() => setForm({ ...form, kind: k })}><b>{KIND[k]}</b><small>{k === 'open' ? 'on rejoint directement' : k === 'invite' ? 'demande à valider' : 'personne ne rejoint'}</small></button>)}</div>
            <div className="gd-form__two"><label>Niveau minimum<input className="set__input" type="number" min={0} max={100} value={form.min_level} onChange={(e) => setForm({ ...form, min_level: Number(e.target.value) })} /></label>
              <label>Membres max<input className="set__input" type="number" min={5} max={50} value={form.max_members} onChange={(e) => setForm({ ...form, max_members: Number(e.target.value) })} /></label></div>
            <p className="gd-label">Emblème</p>
            <div className="gd-emblems">{EMBLEMS.map((x) => <button type="button" key={x} lang="ja" className={form.emblem === x ? 'is-on' : ''} onClick={() => setForm({ ...form, emblem: x })}>{x}</button>)}</div>
            <p className="gd-label">Couleur</p>
            <div className="gd-colors">{COLORS.map((c) => <button type="button" key={c} aria-label={c} className={form.color === c ? 'is-on' : ''} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />)}</div>
            <button className="btn btn--gold" type="submit">Fonder la Guilde</button>
          </form>
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Aperçu</h2></header>
          <div className="gd-preview" style={{ ['--gc' as string]: form.color }}><Emblem g={form} size={96} /><b>{form.name || 'Nom de ta Guilde'}</b><i>{form.tag || 'TAG'}</i><small>{KIND[form.kind as Guild['kind']]}</small></div>
          <ul className="gd-notes"><li>Tu deviens chef : tu nommes tes adjoints et tu règles la Guilde.</li><li>Jusqu'à 50 membres : ouverte, sur invitation ou fermée.</li><li>Ton niveau actuel : {store.accountXp ? lvl : 1}.</li></ul>
        </section>
      </div>}
      {tab === 'rank' && <section className="so-box"><header className="so-box__head"><h2>Classement de la semaine</h2><span>fin lundi</span></header>
        {!list ? <p className="pf-empty">Chargement…</p> : list.length === 0 ? <p className="pf-empty">Aucune Guilde classée.</p> : <ul className="gd-list">{list.map((g, i) => <GuildRow key={g.id} g={g} i={i} />)}</ul>}</section>}
    </div>
  )
}

const MyGuild = ({ data, reload }: { data: NonNullable<Awaited<ReturnType<typeof fetchMyGuild>>>; reload: () => Promise<void> }) => {
  const store = useStore()
  const { guild, me, members, requests } = data
  const [tab, setTab] = useState<'ops' | 'boss' | 'rival' | 'members' | 'requests' | 'rank' | 'badges' | 'settings'>('boss')
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [dmg, setDmg] = useState<{ user_id: string; damage: number; tries: number }[]>([])
  const [rank, setRank] = useState<Guild[]>([])
  const [rivals, setRivals] = useState<Rivalry[]>([])
  const [fight, setFight] = useState<{ result: ColResult; damage: number } | null>(null)
  const [msg, setMsg] = useState('')
  const week = weekKey(new Date())
  const lead = me.role !== 'membre'
  const load = useCallback(async () => {
    const ids = [...new Set([...members.map((m) => m.user_id), ...requests.map((r) => r.user_id)])]
    const [list, d, g] = await Promise.all([playersById(ids), weekDamage(guild.id, week), fetchGuilds()])
    setPeople(Object.fromEntries(list.map((p) => [p.id, p]))); setDmg(d); setRank(g)
    setRivals(await fetchRivalries(guild.id).catch(() => []))
  }, [members, requests, guild.id, week])
  useEffect(() => { void load() }, [load])
  const total = dmg.reduce((s, x) => s + Number(x.damage), 0)
  const place = rank.findIndex((g) => g.id === guild.id) + 1
  const { boss } = colossusOf(new Date())
  const attack = () => { const r = store.fightGuildBoss(); if (r) setFight(r) }
  const role = (m: GuildMember) => (m.role === 'chef' ? 'Chef' : m.role === 'adjoint' ? 'Adjoint' : 'Membre')
  return (
    <div className="gd">
      <header className="gd-mine" style={{ ['--gc' as string]: guild.color }}>
        <Emblem g={guild} size={110} />
        <div className="gd-mine__id"><p className="eyebrow">Ta Guilde · {role(me)}{weekTitle(place) && <b className="gd-title"> · {weekTitle(place)}</b>}</p><h1>{guild.name} <i>{guild.tag}</i></h1>
          <p className="gd-mine__chips"><span>{KIND[guild.kind]}</span><span>{guild.min_level ? `Niveau ${guild.min_level}+` : 'Aucune condition'}</span></p>
          <p>{guild.description || 'Pas encore de description.'}</p></div>
        <ul className="gd-mine__stats">
          <li><b>{place ? `#${place}` : '—'}</b><span>Classement</span></li><li><b>{n(total)}</b><span>Dégâts semaine</span></li>
          <li><b>{members.length}<i>/{guild.max_members}</i></b><span>Membres</span></li><li><b>{members.filter((m) => people[m.user_id] && Date.now() - new Date(people[m.user_id].last_seen).getTime() < 300000).length}</b><span>En ligne</span></li>
        </ul>
      </header>
      <div className="coltabs__bar so__tabs" role="tablist">
        {([['ops', 'Opérations'], ['boss', 'Boss de la semaine'], ['rival', 'Rivalité'], ['members', `Membres (${members.length})`], ...(lead ? [['requests', `Candidatures (${requests.length})`]] : []), ['rank', 'Classement'], ['badges', 'Insignes'], ['settings', 'Paramètres']] as [typeof tab, string][]).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><TabIcon id={id} />{l}</button>)}
      </div>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {tab === 'boss' && <div className="so__grid">
        <section className="so-box gd-boss">
          <p className="eyebrow">Semaine du {week}</p>
          <h2>{boss.name}</h2><p className="set__note">{boss.title} · un Colosse géant que toute la Guilde affronte ensemble.</p>
          <div className="gd-hp"><i style={{ width: `${Math.max(0, 100 - (total / GUILD_BOSS_HP) * 100)}%` }} /><span>{n(Math.max(0, GUILD_BOSS_HP - total))} / {n(GUILD_BOSS_HP)} PV</span></div>
          {total >= GUILD_BOSS_HP && <p className="sp-win">Boss vaincu cette semaine, bravo à toute la Guilde !</p>}
          <button className="btn btn--gold" disabled={store.guildTries < 1 || store.teamNow.length === 0} onClick={attack}>{store.guildTries < 1 ? 'Plus d’essai aujourd’hui' : `Attaquer · ${store.guildTries} essai${store.guildTries > 1 ? 's' : ''} aujourd'hui`}</button>
          <p className="set__note">3 essais par jour. Ton équipe frappe pendant 40 tours ; tous les dégâts s'ajoutent à ceux de la Guilde. Nouveau boss chaque lundi.</p>
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Dégâts des membres</h2></header>
          {dmg.length === 0 ? <p className="pf-empty">Personne n'a encore attaqué cette semaine.</p> : <ol className="gd-dmg">{[...dmg].sort((a, b) => b.damage - a.damage).map((d) => <li key={d.user_id}><b>{people[d.user_id]?.name ?? '…'}</b><span>{n(Number(d.damage))}</span><small>{d.tries} essai{d.tries > 1 ? 's' : ''}</small></li>)}</ol>}
        </section>
      </div>}
      {tab === 'members' && <section className="so-box"><ul className="gd-list">{[...members].sort((a, b) => ['chef', 'adjoint', 'membre'].indexOf(a.role) - ['chef', 'adjoint', 'membre'].indexOf(b.role)).map((m) => {
        const p = people[m.user_id]
        return (
          <li key={m.user_id} className="gd-row"><span className="so-face" style={{ width: 40, height: 40 }}>{p?.name[0] ?? '?'}</span>
            <div className="gd-row__id"><b>{p?.name ?? '…'} <i>#{p?.player_no}</i></b><small>{role(m)} · {n(p?.collection ?? 0)} persos · niveau {p?.level ?? 1}</small></div>
            {me.role === 'chef' && m.user_id !== me.user_id && <span className="gd-acts">
              <button className="cd-btn cd-btn--small" onClick={() => void setMemberRole(m.user_id, m.role === 'adjoint' ? 'membre' : 'adjoint').then(reload)}>{m.role === 'adjoint' ? 'Retirer adjoint' : 'Nommer adjoint'}</button>
              <button className="linkbtn" onClick={() => void setMemberRole(m.user_id, 'exclure').then(reload)}>Exclure</button></span>}
          </li>
        )
      })}</ul></section>}
      {tab === 'requests' && <section className="so-box">{requests.length === 0 ? <p className="pf-empty">Aucune candidature.</p> : <ul className="gd-list">{requests.map((r) => (
        <li key={r.user_id} className="gd-row"><div className="gd-row__id"><b>{people[r.user_id]?.name ?? '…'} <i>#{people[r.user_id]?.player_no}</i></b><small>Niveau {people[r.user_id]?.level ?? 1} · {n(people[r.user_id]?.collection ?? 0)} persos</small></div>
          <button className="btn btn--gold gd-join" onClick={() => void answerRequest(guild.id, r.user_id, true).then(reload)}>Accepter</button><button className="cd-btn cd-btn--small" onClick={() => void answerRequest(guild.id, r.user_id, false).then(reload)}>Refuser</button></li>
      ))}</ul>}</section>}
      {tab === 'ops' && <Operations guildId={guild.id} total={total} tries={store.guildTries} team={store.teamNow} onFight={attack} />}
      {tab === 'rival' && <Rivals guildId={guild.id} lead={lead} rivals={rivals} rank={rank} reload={load} say={setMsg} />}
      {tab === 'badges' && <Insignias guild={guild} members={members.length} total={total} place={place} rivals={rivals} />}
      {tab === 'rank' && <section className="so-box"><header className="so-box__head"><h2>Classement de la semaine</h2></header><ul className="gd-list">{rank.map((g, i) => <GuildRow key={g.id} g={g} i={i} />)}</ul></section>}
      {tab === 'settings' && <section className="so-box"><p className="set__note">{me.role === 'chef' ? 'Si tu quittes la Guilde, un adjoint (ou le plus ancien membre) devient chef. Si tu étais seul, la Guilde est dissous.' : 'Tu peux quitter la Guilde quand tu veux.'}</p>
        <button className="cd-btn cd-btn--small" onClick={async () => { const r = await leaveGuild(); setMsg(r === 'ok' ? 'Tu as quitté la Guilde.' : r); await reload() }}>Quitter la Guilde</button></section>}
      {fight && <Battle result={fight.result} kicker={`Boss de Guilde · ${guild.name}`} title={boss.name}
        winBody={null} loseBody={<p className="sp-win">{n(fight.damage)} dégâts infligés pour ta Guilde !</p>}
        onClose={async () => { const d = fight.damage; setFight(null); const r = await hitGuildBoss(week, d); setMsg(r === 'ok' ? `${n(d)} dégâts ajoutés au boss de la Guilde.` : r); await load() }} />}
    </div>
  )
}

// Titre de la semaine selon la place : 1er Légende, 2e-3e Maîtres, 4e-10e Élite.
export const weekTitle = (place: number) => (place === 1 ? 'Légende' : place >= 2 && place <= 3 ? 'Maîtres' : place >= 4 && place <= 10 ? 'Élite' : '')

// Les 13 insignes d'une Guilde. Ceux des rivalités arrivent avec les rivalités.
export const insigniasOf = (g: { id?: string; created_at?: string }, members: number, total: number, place: number, rivals: Rivalry[] = [], now = Date.now()) => {
  const age = g.created_at ? Math.floor((now - new Date(g.created_at).getTime()) / 86400000) : 0
  const kills = Math.floor(total / GUILD_BOSS_HP)
  const done = rivals.filter((r) => r.status === 'accepted' && r.finished)
  const mine = (r: Rivalry) => (r.a === g.id ? [Number(r.a_score), Number(r.b_score)] : [Number(r.b_score), Number(r.a_score)])
  const won = done.filter((r) => { const [x, y] = mine(r); return x > y }).length
  const lost = done.filter((r) => { const [x, y] = mine(r); return x < y }).length
  return [
    { id: 'found', name: 'Première pierre', need: '30 jours d’existence', done: age >= 30, soon: false },
    { id: 'old', name: 'Gardiens anciens', need: '180 jours d’existence', done: age >= 180, soon: false },
    { id: 'circle', name: 'Cercle', need: '10 membres', done: members >= 10, soon: false },
    { id: 'legion', name: 'Légion', need: '30 membres', done: members >= 30, soon: false },
    { id: 'hunt', name: 'Traqueurs de Faille', need: 'Abattre le boss de la semaine', done: kills >= 1, soon: false },
    { id: 'break', name: 'Brise-Colosses', need: 'Abattre le boss 3 fois en une semaine', done: kills >= 3, soon: false },
    { id: 'stars', name: 'Mangeurs d’étoiles', need: 'Abattre le boss 10 fois en une semaine', done: kills >= 10, soon: false },
    { id: 'rival1', name: 'Premier duel', need: 'Gagner une rivalité', done: won >= 1, soon: false },
    { id: 'rival5', name: 'Rivaux redoutés', need: 'Gagner 5 rivalités', done: won >= 5, soon: false },
    { id: 'unbeaten', name: 'Invaincus', need: '5 rivalités sans défaite', done: won >= 5 && lost === 0, soon: false },
    { id: 'elite', name: 'Élite', need: 'Finir la semaine dans le top 10', done: place >= 1 && place <= 10, soon: false },
    { id: 'podium', name: 'Podium', need: 'Finir la semaine dans le top 3', done: place >= 1 && place <= 3, soon: false },
    { id: 'legend', name: 'Légende du Rift', need: 'Finir la semaine 1er', done: place === 1, soon: false },
  ]
}
const Insignias = ({ guild, members, total, place, rivals }: { guild: { id?: string; created_at?: string }; members: number; total: number; place: number; rivals: Rivalry[] }) => {
  const list = insigniasOf(guild, members, total, place, rivals)
  return (
    <section className="so-box"><header className="so-box__head"><h2>Insignes de la Guilde</h2><span><b>{list.filter((x) => x.done).length}</b> / {list.length}</span></header>
      <ul className="gd-ins">{list.map((x) => <li key={x.id} className={x.done ? 'is-done' : ''}><i aria-hidden="true">{x.done ? '✦' : '◇'}</i><b>{x.name}</b><small>{x.need}{x.soon ? ' · bientôt' : ''}</small></li>)}</ul>
      <p className="set__note">Les insignes de classement comptent la semaine en cours ; ceux des rivalités comptent les rivalités terminées.</p>
    </section>
  )
}

// Rivalité : un duel d'une semaine contre un autre Ordre. Le score = les dégâts au boss d'Ordre de la semaine.
const Rivals = ({ guildId, lead, rivals, rank, reload, say }: { guildId: string; lead: boolean; rivals: Rivalry[]; rank: Guild[]; reload: () => Promise<void>; say: (t: string) => void }) => {
  const [target, setTarget] = useState('')
  const week = rivals.find((r) => !r.finished && r.status !== 'refused')
  const side = (r: Rivalry) => (r.a === guildId ? { me: r.a_name, them: r.b_name, x: Number(r.a_score), y: Number(r.b_score) } : { me: r.b_name, them: r.a_name, x: Number(r.b_score), y: Number(r.a_score) })
  const act = async (p: Promise<string>, ok: string) => { const r = await p; say(r === 'ok' ? ok : r); await reload() }
  return (
    <div className="so__grid">
      <section className="so-box">
        <header className="so-box__head"><h2>Rivalité de la semaine</h2><span>fin lundi</span></header>
        {!week ? <>
          <p className="set__note">Le chef ou un adjoint déclare une rivalité par semaine contre la Guilde de son choix. L’autre Guilde a 48 h pour accepter. Il faut au moins 3 membres de chaque côté. La Guilde qui inflige le plus de dégâts à son boss de la semaine l’emporte.</p>
          {lead ? <div className="so-code__form">
            <select className="set__input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Guilde à défier"><option value="">Choisis une Guilde…</option>{rank.filter((g) => g.id !== guildId).map((g) => <option key={g.id} value={g.id}>{g.name} [{g.tag}] · {g.members} membres</option>)}</select>
            <button className="cd-btn cd-btn--small" disabled={!target} onClick={() => void act(declareRivalry(target), 'Rivalité déclarée : l’autre Guilde a 48 h pour répondre.')}>Défier</button>
          </div> : <p className="set__note">Seuls le chef et les adjoints peuvent déclarer une rivalité.</p>}
        </> : week.status === 'pending' ? (
          week.b === guildId ? <>
            <p><b>{week.a_name}</b> défie ta Guilde cette semaine !</p>
            {lead ? <div className="pmini__btns"><button className="cd-btn cd-btn--main cd-btn--small" onClick={() => void act(answerRivalry(week.id, true), 'Rivalité acceptée : que le meilleur gagne !')}>Accepter</button><button className="cd-btn cd-btn--small" onClick={() => void act(answerRivalry(week.id, false), 'Rivalité refusée.')}>Refuser</button></div> : <p className="set__note">Le chef ou un adjoint doit répondre sous 48 h.</p>}
          </> : <p>En attente de la réponse de <b>{week.b_name}</b> (48 h maximum).</p>
        ) : (() => { const s = side(week); return (
          <div className="rv-duel"><div><b>{s.me}</b><strong>{n(s.x)}</strong></div><span>VS</span><div><b>{s.them}</b><strong>{n(s.y)}</strong></div>
            <p className="set__note">{s.x === s.y ? 'Égalité pour l’instant.' : s.x > s.y ? 'Ta Guilde mène ! Frappez le boss pour garder l’avance.' : 'Ta Guilde est derrière : tous au boss !'}</p></div>) })()}
      </section>
      <section className="so-box">
        <header className="so-box__head"><h2>Palmarès</h2></header>
        {rivals.filter((r) => r.finished && r.status === 'accepted').length === 0 ? <p className="set__note">Aucune rivalité terminée pour l’instant.</p> :
          <ul className="wb-top">{rivals.filter((r) => r.finished && r.status === 'accepted').map((r) => { const s = side(r); return <li key={r.id}><b>{s.x > s.y ? 'Victoire' : s.x < s.y ? 'Défaite' : 'Égalité'}</b><i>contre {s.them} · semaine du {r.week}</i><em>{n(s.x)} – {n(s.y)}</em></li> })}</ul>}
      </section>
    </div>
  )
}

// Opérations : le boss de la semaine en 4 chapitres et 7 secteurs, plus le Quartier général.
const Operations = ({ guildId, total, tries, team, onFight }: { guildId: string; total: number; tries: number; team: string[]; onFight: () => void }) => {
  const [sub, setSub] = useState<'ops' | 'hq' | 'squads'>('ops')
  const [renown, setRenown] = useState<number | null>(null)
  useEffect(() => { void guildRenown(guildId).then(setRenown) }, [guildId, total])
  const cur = currentSector(total)
  const kinds = team.map((id) => roleKind(heroById(id).role))
  const level = hqLevel(renown ?? 0)
  return (
    <div className="ops">
      <div className="coltabs__bar" role="tablist">{([['ops', 'Opérations'], ['hq', 'Quartier général'], ['squads', 'Escouades']] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'is-active' : ''} onClick={() => setSub(id)}><TabIcon id={id} />{l}</button>)}</div>
      {sub === 'ops' && <>
        <p className="set__note">Cette semaine, la Guilde a infligé <b>{n(total)}</b> dégâts. Chaque combat contre le boss de Guilde fait avancer le secteur en cours. 3 essais par jour et par joueur.</p>
        {OPERATIONS.map((ch, ci) => (
          <section key={ch.name} className="so-box ops-ch">
            <header className="so-box__head"><h2><small>Chapitre {ci + 1}</small> {ch.name}</h2></header>
            <ul className="ops-sec">{ch.sectors.map((sct) => {
              const p = sectorProgress(sct, total), done = p >= 1, active = cur?.id === sct.id, locked = !done && !active
              const ok = !sct.needs || kinds.some((k) => sct.needs!.includes(k))
              return (
                <li key={sct.id} className={done ? 'is-done' : active ? 'is-active' : 'is-locked'}>
                  <div><b>{done ? '✓ ' : locked ? '🔒 ' : ''}{sct.name}</b><small>{sct.text}</small></div>
                  <div className="cd-bar"><i style={{ width: `${p * 100}%` }} /></div>
                  <span className="ops-sec__num">{n(Math.min(total, sct.goal))} / {n(sct.goal)}</span>
                  {active && <button className="cd-btn cd-btn--main cd-btn--small" disabled={!ok || tries < 1 || team.length === 0} onClick={onFight}>{!ok ? 'Rôle requis dans ton équipe' : tries < 1 ? 'Reviens demain' : 'Contribuer →'}</button>}
                </li>
              )
            })}</ul>
          </section>
        ))}
        {!cur && <p className="td-check is-ok">Toutes les opérations de la semaine sont terminées. Bravo à toute la Guilde !</p>}
      </>}
      {sub === 'hq' && <section className="so-box">
        <header className="so-box__head"><h2>Quartier général · niveau {level} / 20</h2><span>{renown === null ? '…' : `${n(renown)} de Renommée`}</span></header>
        <div className="cd-bar"><i style={{ width: level >= 20 ? '100%' : `${(((renown ?? 0) % HQ_STEP) / HQ_STEP) * 100}%` }} /></div>
        <p className="set__note">La Renommée = tous les dégâts infligés par la Guilde depuis sa création. Elle ne se dépense pas : chaque tranche de {n(HQ_STEP)} fait monter le QG d’un niveau.</p>
        <ul className="gd-ins">{BRANCHES.flatMap((b) => b.ranks.map((r, i) => (
          <li key={`${b.id}${i}`} className={level >= r.level ? 'is-done' : ''}><i aria-hidden="true">{level >= r.level ? '✦' : '◇'}</i><b>{b.name} · rang {i + 1}</b><small>{r.text} (niveau {r.level})</small></li>
        )))}</ul>
      </section>}
      {sub === 'squads' && <section className="so-box"><header className="so-box__head"><h2>Escouades</h2><span>bientôt</span></header>
        <p className="set__note">Les escouades (groupes de 3 à 10 membres avec une mission commune et des cartes de soutien prêtées) arrivent dans une prochaine mise à jour. En attendant, formez un groupe de 3 dans les Raids (Jouer → Raids).</p></section>}
    </div>
  )
}
