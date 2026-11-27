import { useCallback, useEffect, useState } from 'react'
import { colossusOf } from '../game/colossus'
import { weekKey } from '../game/contracts'
import {
  claimRaid, createRaid, fetchRaid, hitRaid, hitWorldBoss, joinRaid, myRaids, openSettings, playersById, useOnline, worldTop, worldTotal,
  type PublicPlayer, type Raid, type RaidMember,
} from '../state/online'
import { useStore, type ColResult } from '../state/store'
import { Battle, TeamPanel } from './Saga'

const n = (x: number) => Math.round(x).toLocaleString('fr-FR')
export const WORLD_BOSS_HP = 2_000_000_000 // PV du boss mondial de la semaine, pour tous les joueurs réunis
export const WORLD_TRIES = 3
export const RAID_TRIES = 3

const Login = ({ title, text }: { title: string; text: string }) => (
  <section className="so-login"><h2>{title}</h2><p>{text}</p><button className="oauth oauth--discord" onClick={openSettings}>Se connecter</button></section>
)

// ═════════ Boss mondial ═════════
export const WorldBoss = ({ onBack }: { onBack: () => void }) => {
  const { session } = useOnline()
  const store = useStore()
  const week = weekKey(new Date())
  const { boss } = colossusOf(new Date())
  const [total, setTotal] = useState<{ damage: number; players: number } | null | undefined>(undefined)
  const [top, setTop] = useState<{ p?: PublicPlayer; damage: number }[]>([])
  const [fight, setFight] = useState<{ result: ColResult; damage: number } | null>(null)
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const t = await worldTotal(week)
    setTotal(t)
    const list = await worldTop(week)
    const people = await playersById(list.map((x) => x.user_id))
    setTop(list.map((x) => ({ p: people.find((p) => p.id === x.user_id), damage: Number(x.damage) })))
  }, [week])
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20000); return () => clearInterval(t) }, [load])
  const left = store.bigTries('world', WORLD_TRIES)
  const hp = Math.max(0, WORLD_BOSS_HP - (total?.damage ?? 0))
  const attack = () => { const r = store.fightBig('world', WORLD_TRIES, 600); if (r) setFight(r) }
  return (
    <div className="wb">
      <button className="linkbtn" onClick={onBack}>← Jouer</button>
      <header className="wb-hero">
        <span className="wb-hero__kanji" lang="ja" aria-hidden="true">界</span>
        <p className="eyebrow">Boss mondial · nouvelle cible chaque lundi</p>
        <h1 className="page-title">{boss.name}</h1>
        <p>Tous les joueurs du Rift contre un seul boss. Chaque coup compte pour tout le monde.</p>
        <div className="wb-hp"><div className="wb-hp__bar"><i style={{ width: `${(hp / WORLD_BOSS_HP) * 100}%` }} /></div>
          <span><b>{n(hp)}</b> / {n(WORLD_BOSS_HP)} PV · {total ? `${n(total.players)} joueur${total.players > 1 ? 's' : ''} engagé${total.players > 1 ? 's' : ''}` : '…'}</span></div>
      </header>
      {!session ? <Login title="Boss mondial" text="Connecte-toi avec Discord ou Google pour frapper le boss avec tous les autres joueurs." /> : total === null ? <p className="td-locked">Pas encore activé sur le serveur : lance le fichier SQL 04 dans Supabase.</p> : <>
        <div className="so__grid">
          <section className="so-box">
            <header className="so-box__head"><h2>Attaquer</h2><span>{left} / {WORLD_TRIES} essais aujourd’hui</span></header>
            <p className="set__note">Ton équipe de 3 cartes affronte le boss pendant un combat entier. Tes dégâts s’ajoutent à ceux de tous les joueurs. Remise à zéro chaque lundi.</p>
            <button className="cd-btn cd-btn--main cd-btn--small" disabled={left < 1 || store.teamNow.length === 0} onClick={attack}>{store.teamNow.length === 0 ? 'Choisis ton équipe' : left < 1 ? 'Reviens demain' : 'Frapper le boss →'}</button>
            <TeamPanel />
          </section>
          <section className="so-box">
            <header className="so-box__head"><h2>Meilleurs frappeurs</h2><span>cette semaine</span></header>
            {top.length === 0 ? <p className="set__note">Personne n’a encore frappé : sois le premier !</p> : <ol className="wb-top">{top.map((x, i) => <li key={i}><span>{i + 1}</span><b>{x.p?.name ?? 'Joueur'}</b><i>#{x.p?.player_no ?? '?'}</i><em>{n(x.damage)}</em></li>)}</ol>}
          </section>
        </div>
      </>}
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {fight && <Battle result={fight.result} kicker="Boss mondial" title={boss.name} winBody={null}
        loseBody={<p className="sp-win">{n(fight.damage)} dégâts pour le Rift tout entier !</p>}
        onClose={async () => { const d = fight.damage; setFight(null); const r = await hitWorldBoss(week, d); setMsg(r === 'ok' ? `${n(d)} dégâts ajoutés au boss mondial.` : r); await load() }} />}
    </div>
  )
}

// ═════════ Raids à 3 joueurs ═════════
export const Raids = ({ onBack }: { onBack: () => void }) => {
  const { session } = useOnline()
  const store = useStore()
  const [code, setCode] = useState('')
  const [cur, setCur] = useState<{ raid: Raid; members: RaidMember[] } | null>(null)
  const [people, setPeople] = useState<Record<string, PublicPlayer>>({})
  const [mine, setMine] = useState<Raid[]>([])
  const [fight, setFight] = useState<{ result: ColResult; damage: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [now, setNow] = useState(Date.now())
  const { boss } = colossusOf(new Date())
  const open = useCallback(async (c: string) => {
    const r = await fetchRaid(c)
    if (!r) return setMsg('Aucun groupe avec ce code.')
    setCur(r)
    const ps = await playersById(r.members.map((m) => m.user_id))
    setPeople(Object.fromEntries(ps.map((p) => [p.id, p])))
  }, [])
  useEffect(() => { if (session) void myRaids().then(setMine) }, [session, cur])
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); if (cur) void open(cur.raid.code) }, 10000); return () => clearInterval(t) }, [cur, open])
  if (!session) return <div className="wb"><button className="linkbtn" onClick={onBack}>← Jouer</button><Login title="Raids" text="Les raids se jouent à 3 joueurs. Connecte-toi avec Discord ou Google." /></div>

  const make = async () => { const r = await createRaid(); if ('code' in r && r.code) { setMsg(`Groupe créé : donne le code ${r.code} à 2 amis.`); await open(r.code) } else setMsg(r.error ?? 'Erreur') }
  const join = async () => { const r = await joinRaid(code); if (r === 'ok') { setMsg('Tu as rejoint le groupe !'); await open(code) } else setMsg(r) }
  const total = cur ? cur.members.reduce((s, m) => s + Number(m.damage), 0) : 0
  const ends = cur ? new Date(cur.raid.ends_at).getTime() : 0
  const over = cur ? ends < now || total >= cur.raid.boss_hp : false
  const key = cur ? `raid-${cur.raid.code}` : ''
  const left = cur ? store.bigTries(key, RAID_TRIES) : 0
  const attack = () => { const r = store.fightBig(key, RAID_TRIES, 120); if (r) setFight(r) }
  const mm = Math.max(0, Math.floor((ends - now) / 60000))
  return (
    <div className="wb">
      <button className="linkbtn" onClick={onBack}>← Jouer</button>
      <header className="wb-hero wb-hero--raid">
        <span className="wb-hero__kanji" lang="ja" aria-hidden="true">共闘</span>
        <p className="eyebrow">Raid coopératif</p>
        <h1 className="page-title">Les Raids</h1>
        <ul className="wb-tiles"><li><b>3</b><span>joueurs</span></li><li><b>9</b><span>cartes</span></li><li><b>30</b><span>minutes</span></li></ul>
        <p>Formez un groupe avec un code, frappez le boss chacun 3 fois. Le coffre du destin : 100 Éclats garantis, et 300 Éclats + 3 Clés de Faille si le boss tombe.</p>
      </header>

      {!cur ? <div className="so__grid">
        <section className="so-box"><header className="so-box__head"><h2>Ton équipe t’attend ?</h2></header>
          <form className="so-code__form" onSubmit={(e) => { e.preventDefault(); void join() }}><input className="set__input" placeholder="Code du groupe" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Code du groupe" /><button className="cd-btn cd-btn--small" disabled={code.length < 6}>Rejoindre →</button></form>
          <p className="set__note">Ou crée ton propre groupe et partage son code.</p>
          <button className="cd-btn cd-btn--main cd-btn--small" onClick={() => void make()}>Créer un groupe</button>
        </section>
        <section className="so-box"><header className="so-box__head"><h2>Mes raids</h2></header>
          {mine.length === 0 ? <p className="set__note">Aucun raid pour l’instant.</p> : <ul className="wb-top">{mine.map((r) => <li key={r.id}><b>{r.code}</b><i>{new Date(r.ends_at).getTime() > now ? 'en cours' : 'terminé'}</i><button className="linkbtn" onClick={() => void open(r.code)}>Ouvrir</button></li>)}</ul>}
        </section>
      </div> : <section className="so-box wb-raid">
        <header className="so-box__head"><h2>Groupe <b className="wb-code">{cur.raid.code}</b></h2><span>{over ? 'Terminé' : `${mm} min restantes`}</span></header>
        <div className="wb-hp"><div className="wb-hp__bar"><i style={{ width: `${Math.max(0, 1 - total / cur.raid.boss_hp) * 100}%` }} /></div><span>{boss.name} · <b>{n(Math.max(0, cur.raid.boss_hp - total))}</b> / {n(cur.raid.boss_hp)} PV</span></div>
        <ul className="wb-top">{cur.members.map((m) => <li key={m.user_id}><b>{people[m.user_id]?.name ?? 'Joueur'}</b><i>{m.hits}/3 combats</i><em>{n(Number(m.damage))}</em></li>)}
          {Array.from({ length: 3 - cur.members.length }, (_, i) => <li key={`v${i}`} className="is-empty"><b>Place libre</b><i>donne le code {cur.raid.code}</i></li>)}</ul>
        {!over && <button className="cd-btn cd-btn--main cd-btn--small" disabled={left < 1 || store.teamNow.length === 0} onClick={attack}>{left < 1 ? 'Tes 3 combats sont faits' : `Combattre (${left} restant${left > 1 ? 's' : ''})`}</button>}
        <button className="sg__gold" onClick={() => void claimRaid(cur.raid.code).then((r) => setMsg(r === 'ok' ? 'Coffre ouvert : ta récompense arrive dans quelques secondes.' : r))}>Ouvrir le coffre du destin</button>
        <button className="linkbtn" onClick={() => setCur(null)}>← Retour aux groupes</button>
        <TeamPanel />
      </section>}
      {msg && <p className="cd__notice" role="status">{msg}</p>}
      {fight && cur && <Battle result={fight.result} kicker={`Raid ${cur.raid.code}`} title={boss.name} winBody={null}
        loseBody={<p className="sp-win">{n(fight.damage)} dégâts pour ton groupe !</p>}
        onClose={async () => { const d = fight.damage; setFight(null); const r = await hitRaid(cur.raid.code, d); setMsg(r === 'ok' ? `${n(d)} dégâts infligés.` : r); await open(cur.raid.code) }} />}
    </div>
  )
}
