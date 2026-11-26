import { useState, type FormEvent } from 'react'
import { signIn, signOut, signUp, useOnline } from '../state/online'
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
            <span><b>Revoir les explications de Kiri</b><small>{replay ? 'C’est noté : Kiri réexpliquera chaque écran.' : 'Kiri réexplique chaque écran la prochaine fois que tu l’ouvres.'}</small></span>
          </button>
        </section>

        <AccountCard />
        <SaveCard />

        <section className="set-card set__danger" style={{ ['--sc' as string]: '#ff5d7a' }}>
          <header className="set-card__head"><img src={extraArt('set-reset')} alt="" /><h3>Recommencer la partie</h3></header>
          <p className="set__note">Efface toutes tes cartes, tes niveaux, tes Renaissances et ta progression sur cet appareil. Ton pseudo et ta photo sont gardés.</p>
          <button className="cd-btn cd-btn--small" onClick={reset}>{armed ? 'Appuie encore pour tout effacer : c’est définitif' : 'Effacer ma partie'}</button>
        </section>
      </div>
    </div>,
    document.body,
  )
}

// Sauvegarde : un code à copier (ou un fichier) pour garder sa partie ou la reprendre sur un autre appareil.
const SAVE_KEY = 'anime-rift-save-v1'
const encode = (text: string) => btoa(unescape(encodeURIComponent(text)))
const decode = (code: string) => decodeURIComponent(escape(atob(code.trim())))
const SaveCard = () => {
  const [code, setCode] = useState('')
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')
  const current = () => localStorage.getItem(SAVE_KEY) ?? '{}'
  const load = (text: string) => {
    try {
      const data = JSON.parse(text)
      if (typeof data !== 'object' || data === null || typeof data.owned !== 'object') throw new Error('format')
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      setMsg('Partie chargée : le jeu redémarre…')
      setTimeout(() => window.location.reload(), 600)
    } catch { setMsg('Ce code ou ce fichier ne contient pas une partie d’ANIME RIFT.') }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([current()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `anime-rift-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg('Fichier préparé. S’il ne se télécharge pas ici, utilise plutôt le code.')
  }
  return (
    <section className="set-card" style={{ ['--sc' as string]: '#4be3a4' }}>
      <header className="set-card__head"><img src={extraArt('set-phone')} alt="" /><h3>Ma sauvegarde</h3></header>
      <p className="set__note">Ta partie est gardée sur cet appareil. Pour la mettre à l’abri ou la reprendre ailleurs, copie ton code de sauvegarde (ou télécharge le fichier), puis colle-le sur l’autre appareil.</p>
      <div className="set__row">
        <button className="cd-btn cd-btn--small" onClick={() => { const c = encode(current()); setCode(c); navigator.clipboard?.writeText(c).then(() => setMsg('Code copié !'), () => setMsg('Sélectionne le code ci-dessous et copie-le.')) }}>Copier mon code</button>
        <button className="cd-btn cd-btn--small" onClick={download}>Télécharger le fichier</button>
        <label className="cd-btn cd-btn--small" htmlFor="set-load">Charger un fichier</label>
        <input id="set-load" type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(load) }} />
      </div>
      {code && <textarea className="set__input set__code" readOnly value={code} onFocus={(e) => e.currentTarget.select()} aria-label="Mon code de sauvegarde" />}
      <form className="set__row" onSubmit={(e) => { e.preventDefault(); try { load(decode(paste)) } catch { setMsg('Ce code n’est pas valide.') } }}>
        <input className="set__input" placeholder="Colle ici un code de sauvegarde" aria-label="Code de sauvegarde à charger" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <button className="cd-btn cd-btn--small" type="submit" disabled={!paste.trim()}>Charger</button>
      </form>
      <p className="set__note" role="status">{msg || 'Attention : charger une sauvegarde remplace la partie de cet appareil.'}</p>
    </section>
  )
}

// Compte en ligne : la partie est sauvegardée sur le serveur et retrouvée sur tous les appareils.
const AccountCard = () => {
  const { session, me, ready } = useOnline()
  const store = useStore()
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = mode === 'up' ? await signUp(email.trim(), password, store.profile.name.trim() || 'Joueur') : await signIn(email.trim(), password)
    setMsg(r.message); setBusy(false)
  }
  return (
    <section className="set-card set-account" style={{ ['--sc' as string]: '#7d9bff' }}>
      <header className="set-card__head"><img src={extraArt('set-profile')} alt="" /><h3>Compte en ligne</h3></header>
      {!ready ? <p className="set__note">Connexion au serveur…</p> : session ? (
        <>
          <p className="set-account__me"><b>{me?.name ?? 'Joueur'}</b> <span>#{me?.player_no ?? '…'}</span></p>
          <p className="set__note">Connecté avec {session.user.email}. Ta partie est sauvegardée en ligne toute seule, et tu la retrouves en te connectant sur un autre appareil. Ton numéro de joueur dit dans quel ordre tu as rejoint le jeu.</p>
          <button className="cd-btn cd-btn--small" onClick={() => void signOut()}>Se déconnecter</button>
        </>
      ) : (
        <>
          <p className="set__note">Crée un compte pour sauvegarder ta partie en ligne, recevoir ton numéro de joueur et apparaître dans le Hall of Fame.</p>
          <div className="set__seg set__seg--two" role="radiogroup" aria-label="Compte">
            <button role="radio" aria-checked={mode === 'up'} className={mode === 'up' ? 'is-on' : ''} onClick={() => setMode('up')}><b>Créer un compte</b></button>
            <button role="radio" aria-checked={mode === 'in'} className={mode === 'in' ? 'is-on' : ''} onClick={() => setMode('in')}><b>Se connecter</b></button>
          </div>
          <form className="set-account__form" onSubmit={(e) => void submit(e)}>
            <input className="set__input" type="email" required autoComplete="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="set__input" type="password" required minLength={6} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder="Mot de passe (6 caractères ou plus)" aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn--gold" type="submit" disabled={busy}>{busy ? '…' : mode === 'up' ? 'Créer mon compte' : 'Me connecter'}</button>
          </form>
          {mode === 'up' && <p className="set__note">Ton pseudo actuel ({store.profile.name.trim() || 'Joueur'}) sera celui du compte. Ta partie de cet appareil part avec toi.</p>}
        </>
      )}
      {msg && <p className="cd__notice" role="status">{msg}</p>}
    </section>
  )
}
