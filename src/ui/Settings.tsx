import { useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { getLang, LANGS, setLang } from './i18n'
import { deleteAccount, signInWith, signOut, useOnline } from '../state/online'
import { createPortal } from 'react-dom'
import { cosmeticArt } from '../assets/manifest'
import { accountLevel } from '../game/progression'
import { useStore } from '../state/store'
import { getVolume, isSoundOn, setSoundOn, setVolume } from '../summon/audio'
import { effectiveGraphics, getGraphics, getTitleMode, setGraphics, setTitleMode, type GraphicsMode } from './graphics'

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

  const onDrop = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]) }
  const quality = effectiveGraphics(graphics) === 'low' ? 'Fluide' : 'Maximale'

  return createPortal(
    <div className="st-wrap" role="dialog" aria-modal="true" aria-label="Paramètres" onClick={onClose}>
      <aside className="st" onClick={(e) => e.stopPropagation()}>
        <header className="st__head">
          <p className="st__kick"><i />Réglages du compte</p>
          <h2>Paramètres</h2>
          <p>Ton pseudo et ta photo apparaissent dans tes dialogues de l’Aventure, le Panthéon et les gros tirages.</p>
          <button className="st__close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <AccountHead level={acc.level} />

        <Row label="Compte"><p className="st__note">Ta partie est enregistrée sur cet appareil, et aussi en ligne quand tu es connecté.</p><DataZone /></Row>

        <Row label="Moyens de connexion"><Providers /></Row>

        <Row label="Photo de profil">
          <div className="st-photo">
            <div className="st-photo__pic">
              <Avatar size={112} />
              {store.profile.avatar && <button className="st-photo__del" onClick={() => store.setProfile({ avatar: '' })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>Retirer</button>}
            </div>
            <div className="st-photo__form">
              <label className="st__label" htmlFor="st-name">Pseudo</label>
              <input id="st-name" className="st__input" type="text" maxLength={20} placeholder="Joueur" value={name} onChange={(e) => { setName(e.target.value); store.setProfile({ name: e.target.value }) }} />
              <label className="st-drop" htmlFor="set-avatar" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                <span className="st-drop__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" /></svg></span>
                <span><b>Choisir une image</b><small>ou dépose-la ici</small></span>
              </label>
              <input id="set-avatar" className="artpick__input" type="file" accept="image/*" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              <form className="st-link" onSubmit={onLink}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
                <input type="url" inputMode="url" placeholder="…ou colle le lien d’une image (ex. ta photo Discord)" aria-label="Lien d'une image de profil" value={link} onChange={(e) => setLink(e.target.value)} />
                <button type="submit">OK</button>
              </form>
              {error && <p className="artpick__error" role="alert">{error}</p>}
              <p className="st__note">Sur Discord : clic droit sur ta photo de profil → « Copier le lien de l’image ».</p>
            </div>
          </div>
        </Row>

        <Row label="Langue">
          <div className="st-seg">{LANGS.map(([id, label]) => <button key={id} className={getLang() === id ? 'is-on' : ''} aria-pressed={getLang() === id} onClick={() => { if (getLang() !== id) setLang(id) }}><b>{label}</b><small>{id === 'fr' ? 'Version d’origine' : id === 'en' ? 'Traduction anglaise' : 'Traduction allemande'}</small></button>)}</div>
          <p className="st__note">Le français est la version d’origine ; en anglais et en allemand, les menus et les boutons sont traduits.</p>
        </Row>

        <Row label="Appli et notifications"><InstallButton /></Row>

        <Row label="Son">
          <label className="st-slider is-off" title="Le jeu n’a pas encore de musique"><span className="st-slider__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg></span><span className="st-slider__name"><b>Musique</b><small>Bientôt</small></span>
            <input type="range" min={0} max={100} value={0} disabled style={{ ['--v' as string]: '0%' }} /><em>0 %</em></label>
          <label className="st-slider"><span className="st-slider__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2Z" /></svg></span><span className="st-slider__name"><b>Bruitages</b><small>Effets</small></span>
            <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} style={{ ['--v' as string]: `${Math.round(volume * 100)}%` }} onChange={(e) => { const v = Number(e.target.value) / 100; setVol(v); setVolume(v) }} /><em>{Math.round(volume * 100)} %</em></label>
          <button className={`st-btn ${sound ? '' : 'is-on'}`} aria-pressed={!sound} onClick={() => { setSoundOn(!sound); setSound(!sound) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6" /></svg>{sound ? 'Couper le son' : 'Remettre le son'}</button>
        </Row>

        <Row label="Graphismes">
          <div className="st-seg" role="radiogroup" aria-label="Qualité graphique">
            {GRAPHICS.map(([id, label, sub]) => <button key={id} role="radio" aria-checked={graphics === id} className={graphics === id ? 'is-on' : ''} onClick={() => { setGraphics(id); setGfx(id) }}><b>{label}</b><small>{sub}</small></button>)}
          </div>
          <p className="st-now">Qualité en ce moment <b>{quality}</b></p>
          <p className="st__note">Le mode Fluide retire les flous d’arrière-plan et fige les lueurs animées : idéal si le jeu saccade.</p>
        </Row>

        <Row label="Doublons"><p className="st__note">Tes doublons restent dans ta collection. À toi de choisir quand les fusionner ou les échanger.</p></Row>

        <Row label="Titres des cartes">
          <div className="st-seg" role="radiogroup" aria-label="Affichage des titres">
            <button role="radio" aria-checked={titles === 'all'} className={titles === 'all' ? 'is-on' : ''} onClick={() => { setTitleMode('all'); setTitles('all') }}><b>Partout</b><small>Par défaut</small></button>
            <button role="radio" aria-checked={titles === 'big'} className={titles === 'big' ? 'is-on' : ''} onClick={() => { setTitleMode('big'); setTitles('big') }}><b>Fiche et équipe</b><small>Mini-cartes épurées</small></button>
          </div>
          <p className="st__note">Le ruban du titre choisi s’affiche sur ta carte dans la collection, la fiche et l’équipe. « Fiche et équipe » le retire des mini-cartes de la collection.</p>
        </Row>

        <Row label="Didacticiel">
          <button className="st-card" onClick={() => { store.resetTutorial(); setReplay(true) }}>
            <span className="st-card__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2" /></svg></span>
            <span><b>Revoir les explications de Nyx</b><small>{replay ? 'C’est noté : Nyx réexpliquera chaque écran.' : 'Nyx réexplique chaque onglet la prochaine fois que tu l’ouvres.'}</small></span>
            <i>→</i>
          </button>
        </Row>
      </aside>
    </div>,
    document.body,
  )
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="st-row"><h3>{label}</h3><div className="st-row__body">{children}</div></section>
)

const provider = (p?: string) => (p === 'discord' ? 'Discord' : p === 'google' ? 'Google' : 'ton compte')

// En haut : qui est connecté, et le bouton « Se déconnecter ».
const AccountHead = ({ level }: { level: number }) => {
  const { session, me, ready } = useOnline()
  const { profile } = useStore()
  const [msg, setMsg] = useState('')
  const go = async (p: 'google' | 'discord') => { setMsg(''); const e = await signInWith(p); if (e) setMsg(e) }
  return (
    <section className="st-acc">
      <span className="st-acc__pic"><Avatar size={64} /></span>
      <div className="st-acc__id">
        <small className={session ? 'is-on' : ''}>{!ready ? 'Connexion au serveur…' : session ? <>● Connecté avec {provider(session.user.app_metadata.provider)}</> : 'Hors ligne · partie sur cet appareil'}</small>
        <b>{me?.name ?? (profile.name.trim() || 'Joueur')} {me && <i>#{me.player_no}</i>}</b>
        <span>Niveau <em>{level}</em></span>
      </div>
      {session ? <button className="st-btn st-acc__out" onClick={() => { if (window.confirm('Se déconnecter ? Ta partie reste enregistrée en ligne et sur cet appareil.')) void signOut() }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>Se déconnecter</button>
        : ready && <button className="st-btn st-acc__out" onClick={() => void go('discord')}>Se connecter</button>}
      {msg && <p className="cd__notice" role="status">{msg}</p>}
    </section>
  )
}

// Moyens de connexion : Discord, Google (et l'e-mail, à venir).
const Providers = () => {
  const { session } = useOnline()
  const [msg, setMsg] = useState('')
  const cur = session?.user.app_metadata.provider
  const go = async (p: 'google' | 'discord') => { setMsg(''); const e = await signInWith(p); if (e) setMsg(e) }
  const item = (id: 'discord' | 'google', name: string, ico: ReactNode) => (
    <li className="st-prov">
      <span className="st-prov__ico">{ico}</span>
      <span><b>{name}</b><small>{cur === id ? 'Lié' : session ? 'Non lié à ce compte' : 'Se connecter avec ' + name}</small></span>
      {cur === id ? <i className="st-prov__ok">✓</i> : !session ? <button className="st-btn" onClick={() => void go(id)}>Se connecter</button> : null}
    </li>
  )
  return (
    <>
      <ul className="st-provs">
        {item('discord', 'Discord', <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.4-5.2-.7-9.7-3.4-13.7ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" /></svg>)}
        {item('google', 'Google', <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" /></svg>)}
        <li className="st-prov is-soon">
          <span className="st-prov__ico"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg></span>
          <span><b>E-mail + mot de passe</b><small>Pour te connecter sans Discord ni Google</small></span>
          <button className="st-btn" disabled>Bientôt</button>
        </li>
      </ul>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
    </>
  )
}

// Mes données (RGPD) : suppression du compte en ligne.
const DataZone = () => {
  const { session } = useOnline()
  const [msg, setMsg] = useState('')
  if (!session) return null
  return (
    <details className="set-danger"><summary>Mes données (RGPD)</summary>
      <p className="st__note">Tu peux supprimer ton compte en ligne : profil, sauvegarde, amis, messages, annonces et place dans ta Guilde. C’est définitif.</p>
      <button className="st-btn set-danger__btn" onClick={() => { if (window.confirm('Supprimer définitivement ton compte en ligne ?')) void deleteAccount().then((r) => setMsg(r === 'ok' ? 'Compte supprimé.' : r)) }}>Supprimer mon compte</button>
      {msg && <p className="cd__notice" role="status">{msg}</p>}
    </details>
  )
}

// Bouton « Installer l'appli » : proposé par le navigateur (Chrome, Edge, Android) quand le jeu peut s'installer.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent })
const InstallButton = () => {
  const [state, setState] = useState<'idle' | 'done' | 'help'>('idle')
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const click = async () => { if (deferred) { await deferred.prompt(); setState('done') } else setState('help') }
  return (
    <>
      <button className="st-card st-card--app" onClick={() => void click()} disabled={standalone || state === 'done'}>
        <span className="st-card__ico st-card__ico--red"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M12 7v7m0 0-3-3m3 3 3-3" /></svg></span>
        <span><b>{standalone ? 'Appli installée ✓' : state === 'done' ? 'C’est parti !' : 'Installer l’appli'}</b><small>ANIME RIFT dans sa propre fenêtre, lancé en un clic</small></span>
      </button>
      {state === 'help' && <ol className="set__steps"><li>Sur ordinateur (Chrome ou Edge) : l’icône d’installation est dans la barre d’adresse.</li><li>Sur iPhone : bouton de partage, puis « Sur l’écran d’accueil ».</li><li>Sur Android : menu ⋮, puis « Installer l’application ».</li></ol>}
    </>
  )
}
