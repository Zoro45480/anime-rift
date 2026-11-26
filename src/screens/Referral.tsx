import { useEffect, useState } from 'react'
import { uiArt } from '../assets/manifest'
import { REFERRAL } from '../game/referral'
import { myReferrals, openSettings, useOnline } from '../state/online'
import { useStore } from '../state/store'

export const Referral = () => {
  const { session, me } = useOnline()
  const store = useStore()
  const [count, setCount] = useState(0)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (session) void myReferrals().then(setCount) }, [session])
  if (!session) return <section className="so-login"><h2>Parrainage</h2><p>Connecte-toi pour obtenir ton lien de parrainage et débloquer 10 récompenses.</p><button className="oauth oauth--discord" onClick={openSettings}>Se connecter</button></section>
  const link = `https://zoro45480.github.io/anime-rift/?ref=${me?.player_no ?? ''}`
  const next = REFERRAL.findIndex((_, i) => !store.refClaimed.includes(i + 1))
  return (
    <div className="rf">
      <header className="gd-hero"><p className="eyebrow">Invite tes amis</p><h1>Parrainage</h1><p>Chaque ami qui rejoint le jeu avec ton lien ouvre une case. La dernière cache le plus gros lot.</p></header>
      <div className="so__grid">
        <section className="so-box">
          <header className="so-box__head"><h2>Récompenses</h2><span><b>{count}</b> / 10 amis</span></header>
          <div className="ct__bar"><i style={{ width: `${Math.min(100, count * 10)}%` }} /></div>
          <ol className="rf-grid">{REFERRAL.map((r, i) => {
            const step = i + 1, done = store.refClaimed.includes(step), ready = !done && count >= step
            return (
              <li key={step} className={`rf-step ${done ? 'is-done' : ready ? 'is-ready' : ''} ${step === 10 ? 'is-big' : ''}`}>
                <span className="rf-step__n">{step}</span>
                <img src={r.card ? uiArt('card-pack') : uiArt('chest')} alt="" />
                <b>{r.label}</b><small>{step} ami{step > 1 ? 's' : ''}</small>
                {done ? <em>✓ Récupéré</em> : ready ? <button className="ct__claim" onClick={() => { if (store.claimReferral(step, count)) setMsg(`Case ${step} ouverte : ${r.label} !`) }}>Récupérer</button> : <em>🔒 Verrouillé</em>}
              </li>
            )
          })}</ol>
          {msg && <p className="cd__notice" role="status">{msg}</p>}
          <p className="set__note">Partage ton lien → ton ami se connecte avec Discord ou Google en venant de ce lien → la case s'ouvre pour toi.</p>
        </section>
        <section className="so-box">
          <header className="so-box__head"><h2>Invite un ami</h2></header>
          <p className="set__note">Ton lien de parrainage</p>
          <input className="set__input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Ton lien de parrainage" />
          <button className="home__cta" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setMsg('Lien copié !'), () => setMsg('Sélectionne le lien et copie-le.')) }}>Copier le lien<i>↗</i></button>
          {typeof navigator.share === 'function' && <button className="cd-btn cd-btn--small" onClick={() => void navigator.share({ title: 'Anime Rift', text: 'Rejoins-moi sur Anime Rift !', url: link })}>Partager</button>}
          <div className="so-pair"><div><b>{count}</b><span>amis inscrits</span></div><div><b>{next < 0 ? '—' : next + 1}</b><span>prochaine case</span></div></div>
          {next >= 0 && <p className="set__note">Prochaine récompense : <b>{REFERRAL[next].label}</b>.</p>}
        </section>
      </div>
    </div>
  )
}
