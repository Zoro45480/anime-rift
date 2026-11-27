import { useCallback, useEffect, useState } from 'react'
import { colossusOf } from '../game/colossus'
import { weekKey } from '../game/contracts'
import {
  answerRequest, createGuild, fetchGuilds, fetchMyGuild, hitGuildBoss, joinGuild, leaveGuild, playersById, setMemberRole, useOnline, weekDamage,
  type Guild, type GuildMember, type PublicPlayer,
} from '../state/online'
import { useStore } from '../state/store'
import { Battle } from './Saga'
import type { ColResult } from '../state/store'

const n = (x: number) => x.toLocaleString('fr-FR')
const EMBLEMS = ['狐', '龍', '鬼', '侍', '忍', '炎', '雷', '月', '桜', '虎', '神', '影']
const COLORS = ['#ff3d6e', '#ffc94d', '#22d3ee', '#a855f7', '#4ade80', '#f97316', '#3b82f6', '#e5e7eb']
const KIND: Record<Guild['kind'], string> = { open: 'Ouverte', invite: 'Sur invitation', closed: 'Fermée' }
export const GUILD_BOSS_HP = 50_000_000 // PV du boss d’Ordre de la semaine
type Tab = 'find' | 'create' | 'rank'

const Emblem = ({ g, size = 64 }: { g: { emblem: string; color: string }; size?: number }) => (
  <span className="gd-emblem" style={{ width: size, height: size, fontSize: size * 0.55, ['--gc' as string]: g.color }} lang="ja">{g.emblem}</span>
)

export const GuildPage = ({ onConnect }: { onConnect: () => void }) => {
  const { session } = useOnline()
  const [mine, setMine] = useState<Awaited<ReturnType<typeof fetchMyGuild>> | undefined>(undefined)
  const reload = useCallback(async () => setMine(await fetchMyGuild()), [])
  useEffect(() => { if (session) void reload() }, [session, reload])
  if (!session) return <section className="so-login"><h2>Ordre</h2><p>Connecte-toi avec Discord ou Google pour rejoindre un Ordre ou fonder la tienne.</p><button className="oauth oauth--discord" onClick={onConnect}>Se connecter</button></section>
  if (mine === undefined) return <p className="pf-empty">Chargement de ton Ordre…</p>
  return mine ? <MyGuild data={mine} reload={reload} /> : <NoGuild reload={reload} />
}

const Hero = () => (
  <header className="gd-hero">
    <span className="gd-hero__kanji" lang="ja" aria-hidden="true">組</span>
    <p className="eyebrow">Anime Rift — Ordre</p>
    <h1>Ordre</h1>
    <p>Rejoins un Ordre ou fonde la tienne : on est plus forts à plusieurs.</p>
    <ul className="gd-perks">
      <li><b>Boss de la semaine</b><span>Cumulez vos dégâts contre un boss commun.</span></li>
      <li><b>Classement</b><span>L’Ordre qui inflige le plus de dégâts mène la semaine.</span></li>
      <li><b>Entraide</b><span>Discute avec ton Ordre et échange tes doublons.</span></li>
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
        {([['find', 'Trouver un Ordre'], ['create', 'Créer un Ordre'], ['rank', 'Classement']] as [Tab, string][]).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {tab === 'find' && <div className="so__grid">
        <section className="so-box">
          <header className="so-box__head"><h2>Trouver un Ordre</h2></header>
          <form className="so-send" onSubmit={(e) => { e.preventDefault(); void load() }}><input className="set__input" type="search" placeholder="Nom ou tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nom ou tag" /><button className="btn btn--gold" type="submit">Rechercher</button></form>
          <label className="gd-check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Seulement celles que je peux rejoindre (niveau, place)</label>
          {!list ? <p className="pf-empty">Chargement…</p> : shown.length === 0 ? <p className="pf-empty">Aucun Ordre pour l'instant : fonde la première !</p> :
            <ul className="gd-list">{shown.map((g) => <GuildRow key={g.id} g={g} action={g.kind === 'closed' ? <small>Fermée</small> : <button className="btn btn--gold gd-join" onClick={() => void join(g)}>{g.kind === 'invite' ? 'Candidater' : 'Rejoindre'}</button>} />)}</ul>}
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Pas d’Ordre à ton goût ?</h2></header><p className="set__note">Crée la tienne : tu en deviens le chef, tu choisis son nom, son emblème et qui peut la rejoindre.</p><button className="btn btn--gold" onClick={() => setTab('create')}>+ Créer un Ordre</button></section>
      </div>}
      {tab === 'create' && <div className="so__grid">
        <section className="so-box">
          <header className="so-box__head"><h2>Créer un Ordre</h2></header>
          <form className="gd-form" onSubmit={async (e) => { e.preventDefault(); const r = await createGuild(form); setMsg(r === 'ok' ? 'Ton Ordre est fondée !' : r); if (r === 'ok') await reload() }}>
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
            <button className="btn btn--gold" type="submit">Fonder l’Ordre</button>
          </form>
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Aperçu</h2></header>
          <div className="gd-preview" style={{ ['--gc' as string]: form.color }}><Emblem g={form} size={96} /><b>{form.name || 'Nom de ton Ordre'}</b><i>{form.tag || 'TAG'}</i><small>{KIND[form.kind as Guild['kind']]}</small></div>
          <ul className="gd-notes"><li>Tu deviens chef : tu nommes tes adjoints et tu règles l’Ordre.</li><li>Jusqu'à 50 membres : ouverte, sur invitation ou fermée.</li><li>Ton niveau actuel : {store.accountXp ? lvl : 1}.</li></ul>
        </section>
      </div>}
      {tab === 'rank' && <section className="so-box"><header className="so-box__head"><h2>Classement de la semaine</h2><span>fin lundi</span></header>
        {!list ? <p className="pf-empty">Chargement…</p> : list.length === 0 ? <p className="pf-empty">Aucun Ordre classée.</p> : <ul className="gd-list">{list.map((g, i) => <GuildRow key={g.id} g={g} i={i} />)}</ul>}</section>}
    </div>
  )
}

const MyGuild = ({ data, reload }: { data: NonNullable<Awaited<ReturnType<typeof fetchMyGuild>>>; reload: () => Promise<void> }) => {
  const store = useStore()
  const { guild, me, members, requests } = data
  const [tab, setTab] = useState<'boss' | 'members' | 'requests' | 'rank' | 'settings'>('boss')
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [dmg, setDmg] = useState<{ user_id: string; damage: number; tries: number }[]>([])
  const [rank, setRank] = useState<Guild[]>([])
  const [fight, setFight] = useState<{ result: ColResult; damage: number } | null>(null)
  const [msg, setMsg] = useState('')
  const week = weekKey(new Date())
  const lead = me.role !== 'membre'
  const load = useCallback(async () => {
    const ids = [...new Set([...members.map((m) => m.user_id), ...requests.map((r) => r.user_id)])]
    const [list, d, g] = await Promise.all([playersById(ids), weekDamage(guild.id, week), fetchGuilds()])
    setPeople(Object.fromEntries(list.map((p) => [p.id, p]))); setDmg(d); setRank(g)
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
        <div className="gd-mine__id"><p className="eyebrow">Ton Ordre · {role(me)}</p><h1>{guild.name} <i>{guild.tag}</i></h1>
          <p className="gd-mine__chips"><span>{KIND[guild.kind]}</span><span>{guild.min_level ? `Niveau ${guild.min_level}+` : 'Aucune condition'}</span></p>
          <p>{guild.description || 'Pas encore de description.'}</p></div>
        <ul className="gd-mine__stats">
          <li><b>{place ? `#${place}` : '—'}</b><span>Classement</span></li><li><b>{n(total)}</b><span>Dégâts semaine</span></li>
          <li><b>{members.length}<i>/{guild.max_members}</i></b><span>Membres</span></li><li><b>{members.filter((m) => people[m.user_id] && Date.now() - new Date(people[m.user_id].last_seen).getTime() < 300000).length}</b><span>En ligne</span></li>
        </ul>
      </header>
      <div className="coltabs__bar so__tabs" role="tablist">
        {([['boss', 'Boss de la semaine'], ['members', `Membres (${members.length})`], ...(lead ? [['requests', `Candidatures (${requests.length})`]] : []), ['rank', 'Classement'], ['settings', 'Paramètres']] as [typeof tab, string][]).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {tab === 'boss' && <div className="so__grid">
        <section className="so-box gd-boss">
          <p className="eyebrow">Semaine du {week}</p>
          <h2>{boss.name}</h2><p className="set__note">{boss.title} · un Colosse géant que toute l’Ordre affronte ensemble.</p>
          <div className="gd-hp"><i style={{ width: `${Math.max(0, 100 - (total / GUILD_BOSS_HP) * 100)}%` }} /><span>{n(Math.max(0, GUILD_BOSS_HP - total))} / {n(GUILD_BOSS_HP)} PV</span></div>
          {total >= GUILD_BOSS_HP && <p className="sp-win">Boss vaincu cette semaine, bravo à toute l’Ordre !</p>}
          <button className="btn btn--gold" disabled={store.guildTries < 1 || store.teamNow.length === 0} onClick={attack}>{store.guildTries < 1 ? 'Plus d’essai aujourd’hui' : `Attaquer · ${store.guildTries} essai${store.guildTries > 1 ? 's' : ''} aujourd'hui`}</button>
          <p className="set__note">3 essais par jour. Ton équipe frappe pendant 40 tours ; tous les dégâts s'ajoutent à ceux de l’Ordre. Nouveau boss chaque lundi.</p>
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
      {tab === 'rank' && <section className="so-box"><header className="so-box__head"><h2>Classement de la semaine</h2></header><ul className="gd-list">{rank.map((g, i) => <GuildRow key={g.id} g={g} i={i} />)}</ul></section>}
      {tab === 'settings' && <section className="so-box"><p className="set__note">{me.role === 'chef' ? 'Si tu quittes l’Ordre, un adjoint (ou le plus ancien membre) devient chef. Si tu étais seul, l’Ordre est dissoute.' : 'Tu peux quitter l’Ordre quand tu veux.'}</p>
        <button className="cd-btn cd-btn--small" onClick={async () => { const r = await leaveGuild(); setMsg(r === 'ok' ? 'Tu as quitté l’Ordre.' : r); await reload() }}>Quitter l’Ordre</button></section>}
      {fight && <Battle result={fight.result} kicker={`Boss d’Ordre · ${guild.name}`} title={boss.name}
        winBody={null} loseBody={<p className="sp-win">{n(fight.damage)} dégâts infligés pour ton Ordre !</p>}
        onClose={async () => { const d = fight.damage; setFight(null); const r = await hitGuildBoss(week, d); setMsg(r === 'ok' ? `${n(d)} dégâts ajoutés au boss de l’Ordre.` : r); await load() }} />}
    </div>
  )
}
