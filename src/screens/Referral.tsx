import { useEffect, useMemo, useState } from 'react'
import { HEROES, type Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER } from '../data/rarities'
import { refStep, REFERRAL_MAIN, VALID_LEVEL, type RefIcon } from '../game/referral'
import { myReferralList, myReferrals, openSettings, referralCode, referralTop, useOnline, type Filleul } from '../state/online'
import { useStore } from '../state/store'
import { Coin } from '../ui/Coin'

const art = import.meta.glob('../assets/referral/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const Icon = ({ icon, size }: { icon: RefIcon; size: number }) => icon === 'eclats'
  ? <span className="rf2-gems" style={{ width: size, height: size }}><Coin name="soul" size={Math.round(size * 0.8)} /></span>
  : <img src={art[`../assets/referral/${icon}.webp`]} alt="" style={{ width: size, height: size }} />
const n = (x: number) => x.toLocaleString('fr-FR')
const Svg = ({ d, s = 18 }: { d: string; s?: number }) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const COPY = 'M9 9h10v10H9zM5 15V5h10'
const SHARE = 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4'
const LOCK = 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3'
const LINK = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'
const USERS = 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2'
const GIFT = 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0m5 0c2-4 6-3 5 0'

export const Referral = () => {
  const { session, me } = useOnline()
  const store = useStore()
  const [tab, setTab] = useState<'rewards' | 'list'>('rewards')
  const [valid, setValid] = useState(0)
  const [list, setList] = useState<Filleul[] | null>(null)
  const [top, setTop] = useState<{ name: string; player_no: number; avatar: string; validated: number }[] | null>(null)
  const [msg, setMsg] = useState('')
  const [found, setFound] = useState<Hero[]>([])
  const [trade, setTrade] = useState(false)
  useEffect(() => {
    if (!session) return
    void myReferrals().then(setValid)
    void myReferralList().then(setList)
    void referralTop().then(setTop)
  }, [session])
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 5000) }

  const code = me ? referralCode(me.player_no) : '……'
  const link = `https://zoro45480.github.io/anime-rift/?ref=${code}`
  const pending = list?.filter((f) => f.status === 'attente').length ?? 0
  const refused = list?.filter((f) => f.status === 'refuse').length ?? 0
  const shown = Math.max(20, Math.ceil((valid + 1) / 10) * 10) // toujours au moins 20 cases, puis par dizaines
  let next = 1
  while (store.refClaimed.includes(next)) next++
  const nextStep = refStep(next)
  const ready = Array.from({ length: valid }, (_, i) => i + 1).filter((s) => !store.refClaimed.includes(s)).length
  const items = store.items ?? { lr: 0, trade: 0 }
  const copy = (t: string, ok: string) => void navigator.clipboard?.writeText(t).then(() => flash(ok), () => flash('Sélectionne le texte et copie-le.'))
  const claim = (step: number) => { const r = store.claimReferral(step, valid); if (r) { setFound(r); flash(`Palier ${step} récupéré : ${refStep(step).label} !`) } }

  return (
    <div className="rf2">
      <p className="rf2-intro">Invite tes amis et débloque tes récompenses.</p>
      <div className="rf2-grid">
        <section className="rf2-main">
          <div className="rf2-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'rewards'} className={tab === 'rewards' ? 'is-active' : ''} onClick={() => setTab('rewards')}>Récompenses</button>
            <button role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'is-active' : ''} onClick={() => setTab('list')}>Tes filleuls <i>{list?.length ?? valid}</i></button>
          </div>

          {tab === 'rewards' ? <>
            <div className="rf2-prog"><h2>Ta progression</h2><span>{n(valid)} / {n(shown)}</span></div>
            <div className="rf2-bar"><i style={{ width: `${Math.min(100, (valid / shown) * 100)}%` }} /></div>
            {ready > 0 && <div className="claim-all"><span><b>{ready}</b> palier{ready > 1 ? 's' : ''} à récupérer</span>
              <button className="btn btn--gold" onClick={() => { const r = store.claimAllReferral(valid); if (r) { setFound(r); flash(`${ready} palier${ready > 1 ? 's' : ''} récupéré${ready > 1 ? 's' : ''} d'un coup !`) } }}>Tout récupérer ({ready})</button></div>}
            <ol className="rf2-cards">{Array.from({ length: shown }, (_, i) => {
              const step = i + 1, r = refStep(step), done = store.refClaimed.includes(step), open = !done && valid >= step, isNext = step === next
              return (
                <li key={step} className={`rf2-card ${done ? 'is-done' : open ? 'is-ready' : ''} ${isNext ? 'is-next' : ''} ${step % 10 === 0 ? 'is-big' : ''}`}>
                  <span className="rf2-card__n">{step} filleul{step > 1 ? 's' : ''}</span>
                  {!done && !open && <span className="rf2-card__lock"><Svg d={LOCK} s={14} /></span>}
                  <Icon icon={r.icon} size={step <= REFERRAL_MAIN ? 96 : 84} />
                  <b>{r.label}</b>
                  {isNext && !open && <em className="rf2-card__tag">prochain</em>}
                  {done ? <span className="rf2-card__btn is-done">✓ Récupéré</span> : open ? <button className="rf2-card__btn is-ready" onClick={() => claim(step)}>Récupérer</button> : <span className="rf2-card__btn">Verrouillé</span>}
                </li>
              )
            })}</ol>
            <div className="rf2-more"><h3>Les récompenses continuent, sans limite</h3>
              <p>Dès le 11e filleul validé : 50 Éclats à chaque palier, remplacés par 250 Éclats tous les 10 paliers (20, 30, 40…).</p>
              <small>100, 1 000 filleuls et au-delà : chaque nouveau filleul validé continue de te rapporter des Éclats.</small></div>
            <ul className="rf2-how">
              <li><Svg d={LINK} s={26} /><span>Partage ton lien</span></li>
              <li><Svg d={USERS} s={26} /><span>Ton ami crée son compte, atteint le niveau {VALID_LEVEL} et joue 2 jours différents</span></li>
              <li><Svg d={GIFT} s={26} /><span>Récupère tes récompenses</span></li>
            </ul>
          </> : <>
            <p className="eyebrow rf2-sub">Tes filleuls</p>
            {list === null ? <p className="rf2-empty">La liste détaillée arrive dès que le fichier SQL 05 est lancé sur le serveur. Filleuls validés : {valid}.</p>
              : list.length === 0 ? <p className="rf2-empty">Personne pour l’instant : partage ton lien !</p>
              : <ul className="rf2-list">{list.map((f) => (
                <li key={f.player_no}><span className="rf2-face">{f.avatar ? <img src={f.avatar} alt="" referrerPolicy="no-referrer" /> : f.name[0]}</span>
                  <span className="rf2-list__id"><b>{f.name}</b><i>#{f.player_no} · niveau {f.level} · {f.play_days} jour{f.play_days > 1 ? 's' : ''} de jeu</i></span>
                  <em className={`rf2-st rf2-st--${f.status}`}>{f.status === 'valide' ? 'Validé' : f.status === 'refuse' ? 'Refusé' : `En attente (niv. ${Math.min(f.level, VALID_LEVEL)}/${VALID_LEVEL}, ${Math.min(f.play_days, 2)}/2 j)`}</em></li>
              ))}</ul>}
            <details className="rf2-top"><summary>Classement des parrains · Top 10</summary>
              {!top ? <p className="rf2-empty">Disponible après le fichier SQL 05.</p> : top.length === 0 ? <p className="rf2-empty">Aucun parrain classé pour l’instant.</p>
                : <ol>{top.map((t, i) => <li key={t.player_no}><span>{i + 1}</span><b>{t.name}</b><i>#{t.player_no}</i><em>{n(Number(t.validated))} filleul{Number(t.validated) > 1 ? 's' : ''}</em></li>)}</ol>}
            </details>
          </>}
          {msg && <p className="cd__notice" role="status">{msg}</p>}
        </section>

        <aside className="rf2-side">
          {!session ? <section className="rf2-box"><h2>Invite tes amis</h2><p>Connecte-toi avec Discord ou Google pour obtenir ton code et ton lien de parrainage.</p>
            <button className="rf2-btn rf2-btn--main" onClick={openSettings}>Se connecter</button></section> : <section className="rf2-box">
            <h2>Invite tes amis</h2><p>Ton lien de parrainage</p>
            <div className="rf2-code"><div><small>Ton code</small><b>{code}</b></div><button className="rf2-icobtn" onClick={() => copy(code, 'Code copié !')} aria-label="Copier le code"><Svg d={COPY} /></button></div>
            <button className="rf2-btn rf2-btn--main" onClick={() => copy(link, 'Lien copié !')}><Svg d={COPY} />Copier le lien</button>
            <button className="rf2-btn" onClick={() => { if (typeof navigator.share === 'function') void navigator.share({ title: 'Anime Rift', text: `Rejoins-moi sur Anime Rift avec mon code ${code} !`, url: link }).catch(() => undefined); else copy(link, 'Lien copié : colle-le où tu veux !') }}><Svg d={SHARE} />Partager</button>
            <ul className="rf2-stats"><li><b>{valid}</b><span>Validés</span></li><li><b>{pending}</b><span>En attente</span></li><li><b>{refused}</b><span>Refusés</span></li></ul>
            <button className="linkbtn" onClick={() => setTab('list')}>Tes filleuls →</button>
          </section>}
          <section className="rf2-box rf2-next">
            <Icon icon={nextStep.icon} size={64} />
            <div><small>Prochaine récompense</small><b>{nextStep.label}</b><span>{valid >= next ? 'Prête à récupérer !' : `Encore ${next - valid} filleul${next - valid > 1 ? 's' : ''} actif${next - valid > 1 ? 's' : ''}`}</span></div>
            <strong>{Math.min(valid, next)} / {next}</strong>
            <div className="rf2-bar"><i style={{ width: `${Math.min(100, (valid / next) * 100)}%` }} /></div>
          </section>
          <section className="rf2-box">
            <h2>Mes tickets</h2>
            <div className="rf2-ticket"><Icon icon="ticket_LR" size={54} /><div><b>Ticket LR garanti <em>×{items.lr}</em></b><span>Donne une carte LR au hasard.</span></div>
              <button className="btn btn--gold" disabled={items.lr < 1} onClick={() => { const c = store.useLrTicket(); if (c) { setFound([c]); flash(`${c.name} (LR) rejoint ta collection !`) } }}>Utiliser</button></div>
            <div className="rf2-ticket"><Icon icon="ticket_echange" size={54} /><div><b>Ticket d’échange <em>×{items.trade}</em></b><span>Échange un doublon contre une autre carte de même rareté (de préférence une qui te manque).</span></div>
              <button className="btn btn--gold" disabled={items.trade < 1} onClick={() => setTrade(true)}>Utiliser</button></div>
          </section>
        </aside>
      </div>

      {found.length > 0 && <div className="modal" role="dialog" aria-modal="true" aria-label="Cartes obtenues" onClick={() => setFound([])}>
        <div className="modal__box rf2-found" onClick={(e) => e.stopPropagation()}>
          <h2>Tu obtiens</h2>
          <ul>{found.map((c, i) => <li key={i} style={{ ['--rc' as string]: RARITIES[c.rarity].color }}><b>{RARITIES[c.rarity].short}</b><span>{c.name}<small>{c.world}</small></span></li>)}</ul>
          <p className="set__note">Chaque coffre contient aussi 150 Éclats et 3 Clés de Faille.</p>
          <button className="btn btn--gold" onClick={() => setFound([])}>Super !</button>
        </div>
      </div>}
      {trade && <TradePicker onClose={() => setTrade(false)} onDone={(from, to) => { setTrade(false); setFound([to]); flash(`${from.name} échangé contre ${to.name} !`) }} />}
    </div>
  )
}

const TradePicker = ({ onClose, onDone }: { onClose: () => void; onDone: (from: Hero, to: Hero) => void }) => {
  const store = useStore()
  const dupes = useMemo(() => HEROES.filter((h) => h.rarity !== 'rift' && (store.owned[h.id] ?? 0) >= 2).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)), [store.owned])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ticket d'échange" onClick={onClose}>
      <div className="modal__box rf2-found" onClick={(e) => e.stopPropagation()}>
        <h2>Ticket d’échange</h2>
        <p className="set__note">Choisis un doublon à échanger. Tu reçois une autre carte de la même rareté (les MR ne s’échangent pas).</p>
        {dupes.length === 0 ? <p className="rf2-empty">Tu n’as pas encore de doublon.</p> : <ul className="rf2-pick">{dupes.map((h) => (
          <li key={h.id}><button style={{ ['--rc' as string]: RARITIES[h.rarity].color }} onClick={() => { const c = store.useTradeTicket(h.id); if (c) onDone(h, c) }}>
            <b>{RARITIES[h.rarity].short}</b><span>{h.name}<small>×{store.owned[h.id]} · {h.world}</small></span></button></li>
        ))}</ul>}
        <button className="cd-btn cd-btn--small" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
