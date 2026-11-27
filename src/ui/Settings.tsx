import { useState, type FormEvent } from 'react'
import { signInWith, signOut, useOnline } from '../state/online'
import { createPortal } from 'react-dom'
import { cosmeticArt, extraArt } from '../assets/manifest'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { getVolume, isSoundOn, setSoundOn, setVolume } from '../summon/audio'
import { effectiveGraphics, getGraphics, getTitleMode, setGraphics, setTitleMode, type GraphicsMode } from './graphics'
import { Kiri } from './Guide'
import { LevelBadge, levelStyle } from './LevelBadge'

// Réduit une image choisie par le joueur à une petite photo de profil carrée (gardée dans la sauvegarde).
const toAvatar = (file: File) => new Promise<string>((resolve, reject) => {
  const img = new Image()
  img.onload = () => {
    const size = 160
    const c = document.createElement('canvas')
    c.width = c.height = size
    const k = Math.max(size / img.width, size / img.height)
    c.getContext('2d')!.drawImage(img, (size - img.width * k) / 2, (size - img.height * k) / 2, img.width * k, img.height * k)
    URL.revokeObjectURL(img.src)
    resolve(c.toDataURL('image/jpeg', 0.85))
  }
  img.onerror = () => reject(new Error('image'))
  img.src = URL.createObjectURL(file)
})

export const Avatar = ({ size = 44 }: { size?: number }) => {
  const { profile } = useStore()
  const name = profile.name.trim() || 'Joueur'
  return profile.avatar
    ? <img className="avatar" src={profile.avatar} alt="" width={size} height={size} referrerPolicy="no-referrer" />
    : <span className="avatar avatar--letter" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">{name[0].toUpperCase()}</span>
}

// Photo de profil dans son cadre 3D (Blender), avec une aura derrière et un ornement par-dessus si le joueur en porte.
export const FramedAvatar = ({ size, style, aura, ornament }: { size: number; style: string; aura?: string; ornament?: string }) => (
  <span className={`avatar-frame avatar-frame--${style}`} style={{ width: size, height: size }}>
    {aura && <img className={`avatar-frame__aura avatar-frame__aura--${aura}`} src={cosmeticArt(`aura-${aura}`)} alt="" />}
    <Avatar size={Math.round(size * 0.44)} />
    <img className="avatar-frame__ring" src={cosmeticArt(`frame-${style}`)} alt="" />
    {ornament && <img className="avatar-frame__orn" src={cosmeticArt(`orn-${ornament}`)} alt="" />}
  </span>
)

const GRAPHICS: [GraphicsMode, string, string][] = [['auto', 'Automatique', 'Selon ton appareil'], ['high', 'Maximale', 'Tous les effets'], ['low', 'Fluide', 'Appareil modeste']]

export const Settings = ({ onClose }: { onClose: () => void }) => {
  const store = useStore()
  const [name, setName] = useState(store.profile.name)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [volume, setVol] = useState(getVolume())
  const [sound, setSound] = useState(isSoundOn())
  const [graphics, setGfx] = useState(getGraphics())
  const [titles, setTitles] = useState(getTitleMode())
  const [replay, setReplay] = useState(false)
  const [armed, setArmed] = useState(false)
  const acc = accountLevel(store.accountXp, store.rebirths)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try { store.setProfile({ avatar: await toAvatar(file) }) } catch { setError('Cette image n’a pas pu être lue.') }
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
  const reset = () => {
    if (!armed) return setArmed(true)
    store.resetGame()
    setArmed(false)
    onClose()
  }

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Paramètres" onClick={onClose}>
      <div className="modal__box set" onClick={(e) => e.stopPropagation()}>
        <header className="set__head">
          <img className="set__gear" src={extraArt('set-gear')} alt="" />
          <div><p>Réglages</p><h2>Paramètres</h2></div>
          <button className="notifs__close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <section className="set__profile">
          <FramedAvatar size={150} style={levelStyle(acc.level, store.rebirths)} />
          <div><b>{store.profile.name.trim() || 'Joueur'}</b><LevelBadge level={acc.level} rebirths={store.rebirths} size={26} /></div>
        </section>
        <p className="set__note">Ta partie est gardée sur cet appareil : il n'y a pas encore de compte en ligne ni de connexion.</p>

        <AccountCard />

        <section className="set-card" style={{ ['--sc' as string]: '#b78bff' }}>
          <header className="set-card__head"><img src={extraArt('set-profile')} alt="" /><h3>Profil</h3></header>
          <h4>Pseudo</h4>
          <input className="set__input" type="text" maxLength={20} placeholder="Joueur" aria-label="Pseudo" value={name} onChange={(e) => { setName(e.target.value); store.setProfile({ name: e.target.value }) }} />
          <h4>Photo de profil</h4>
          <div className="set__row">
            <label className="cd-btn cd-btn--small" htmlFor="set-avatar">Choisir une image</label>
            <input id="set-avatar" className="artpick__input" type="file" accept="image/*" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            {store.profile.avatar && <button className="cd-btn cd-btn--small" onClick={() => store.setProfile({ avatar: '' })}>Retirer</button>}
          </div>
          <form className="set__link" onSubmit={onLink}>
            <input className="set__input" type="url" inputMode="url" placeholder="…ou colle le lien d’une image" aria-label="Lien d'une image de profil" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="cd-btn cd-btn--small" type="submit">OK</button>
          </form>
          {error && <p className="artpick__error" role="alert">{error}</p>}
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#5ee6ff' }}>
          <header className="set-card__head"><img src={extraArt('set-sound')} alt="" /><h3>Son</h3></header>
          <label className="set__slider"><span>Bruitages</span><b>{Math.round(volume * 100)} %</b>
            <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} onChange={(e) => { const v = Number(e.target.value) / 100; setVol(v); setVolume(v) }} />
          </label>
          <button className={`cd-btn cd-btn--small ${sound ? '' : 'is-on'}`} aria-pressed={!sound} onClick={() => { setSoundOn(!sound); setSound(!sound) }}>{sound ? 'Couper le son' : 'Son coupé · remettre'}</button>
          <p className="set__note">Le jeu n'a pas encore de musique : ce réglage concerne les bruitages d'invocation.</p>
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#a56bff' }}>
          <header className="set-card__head"><img src={extraArt('set-graphics')} alt="" /><h3>Graphismes</h3></header>
          <div className="set__seg" role="radiogroup" aria-label="Qualité graphique">
            {GRAPHICS.map(([id, label, sub]) => (
              <button key={id} role="radio" aria-checked={graphics === id} className={graphics === id ? 'is-on' : ''} onClick={() => { setGraphics(id); setGfx(id) }}><b>{label}</b><small>{sub}</small></button>
            ))}
          </div>
          <p className="set__note">Qualité en ce moment : <b>{effectiveGraphics(graphics) === 'low' ? 'Fluide' : 'Maximale'}</b>. Le mode Fluide fige les lueurs animées, retire les flous et allège l'animation d'invocation : idéal si le jeu saccade.</p>
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#4be3a4' }}>
          <header className="set-card__head"><img src={extraArt('set-phone')} alt="" /><h3>Ajouter à l'écran d'accueil</h3></header>
          <ol className="set__steps">
            <li>Ouvre le jeu dans le navigateur de ton téléphone (Safari sur iPhone, Chrome sur Android).</li>
            <li>Touche le bouton de partage (iPhone) ou le menu ⋮ (Android).</li>
            <li>Choisis « Sur l'écran d'accueil ».</li>
          </ol>
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#ffc94d' }}>
          <header className="set-card__head"><img src={extraArt('set-cards')} alt="" /><h3>Doublons</h3></header>
          <p className="set__note">Tes doublons restent dans ta collection. À toi de choisir quand les fusionner, depuis la fiche d'une carte.</p>
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#ff9a4a' }}>
          <header className="set-card__head"><img src={extraArt('set-medal')} alt="" /><h3>Titres des cartes</h3></header>
          <div className="set__seg set__seg--two" role="radiogroup" aria-label="Affichage des titres">
            <button role="radio" aria-checked={titles === 'all'} className={titles === 'all' ? 'is-on' : ''} onClick={() => { setTitleMode('all'); setTitles('all') }}><b>Partout</b><small>Par défaut</small></button>
            <button role="radio" aria-checked={titles === 'big'} className={titles === 'big' ? 'is-on' : ''} onClick={() => { setTitleMode('big'); setTitles('big') }}><b>Carte ouverte</b><small>Mini-cartes épurées</small></button>
          </div>
          <p className="set__note">Le ruban du titre gagné s'affiche sur la carte. « Carte ouverte » le retire des petites cartes des grilles.</p>
        </section>

        <section className="set-card" style={{ ['--sc' as string]: '#5aa8ff' }}>
          <header className="set-card__head"><Kiri size={54} /><h3>Didacticiel</h3></header>
          <button className="set__replay" onClick={() => { store.resetTutorial(); setReplay(true) }}>
            <span><b>Revoir les explications de Nyx</b><small>{replay ? 'C’est noté : Nyx réexpliquera chaque écran.' : 'Nyx réexplique chaque écran la prochaine fois que tu l’ouvres.'}</small></span>
          </button>
        </section>


        <section className="set-card set__danger" style={{ ['--sc' as string]: '#ff5d7a' }}>
          <header className="set-card__head"><img src={extraArt('set-reset')} alt="" /><h3>Recommencer la partie</h3></header>
          <p className="set__note">Efface toutes tes cartes, tes niveaux, tes Ascensions et ta progression sur cet appareil. Ton pseudo et ta photo sont gardés.</p>
          <button className="cd-btn cd-btn--small" onClick={reset}>{armed ? 'Appuie encore pour tout effacer : c’est définitif' : 'Effacer ma partie'}</button>
        </section>
      </div>
    </div>,
    document.body,
  )
}

// Sauvegarde : un code à copier (ou un fichier) pour garder sa partie ou la reprendre sur un autre appareil.
const AccountCard = () => {
  const { session, me, ready } = useOnline()
  const [msg, setMsg] = useState('')
  const go = async (p: 'google' | 'discord') => { setMsg(''); const e = await signInWith(p); if (e) setMsg(e) }
  return (
    <section className="set-card set-account" style={{ ['--sc' as string]: '#7d9bff' }}>
      <header className="set-card__head"><img src={extraArt('set-profile')} alt="" /><h3>Compte en ligne</h3></header>
      {!ready ? <p className="set__note">Connexion au serveur…</p> : session ? (
        <>
          <p className="set-account__me"><b>{me?.name ?? 'Joueur'}</b> <span>#{me?.player_no ?? '…'}</span></p>
          <p className="set__note">Connecté avec {session.user.app_metadata.provider === 'discord' ? 'Discord' : session.user.app_metadata.provider === 'google' ? 'Google' : 'ton compte'}. Ta partie est sauvegardée en ligne toute seule : tu la retrouves en te connectant sur un autre appareil. Ton numéro de joueur dit dans quel ordre tu as rejoint le jeu.</p>
          <button className="cd-btn cd-btn--small" onClick={() => void signOut()}>Se déconnecter</button>
        </>
      ) : (
        <>
          <p className="set__note">Connecte-toi pour sauvegarder ta partie en ligne, recevoir ton numéro de joueur et apparaître dans le Panthéon. Ta partie de cet appareil part avec toi.</p>
          <div className="set-account__oauth">
            <button className="oauth oauth--discord" onClick={() => void go('discord')}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.4-5.2-.7-9.7-3.4-13.7ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" /></svg>Se connecter avec Discord</button>
            <button className="oauth oauth--google" onClick={() => void go('google')}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" /></svg>Se connecter avec Google</button>
          </div>
        </>
      )}
      {msg && <p className="cd__notice" role="status">{msg}</p>}
    </section>
  )
}
