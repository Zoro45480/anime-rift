// Page « styleguide » : tous les éléments de base du design Rift, au même endroit (ouvrir avec ?styleguide).
const COLORS: [string, string][] = [
  ['--bg', 'Fond'], ['--panel', 'Panneau'], ['--panel2', 'Panneau 2'], ['--accent', 'Violet Rift'], ['--accent2', 'Cyan faille'],
  ['--hot', 'Magenta'], ['--gold', 'Or'], ['--ok', 'Succès'], ['--danger', 'Danger'],
]
const RARITIES: [string, string, string][] = [
  ['C', 'Commune', '--r-common'], ['R', 'Rare', '--r-rare'], ['É', 'Épique', '--r-epic'], ['M', 'Mythique', '--r-ultra'], ['L', 'Légendaire', '--r-legend'], ['RIFT', 'Rift', '--r-rift'],
]

export const Styleguide = () => (
  <main className="screen sg">
    <header>
      <p className="eyebrow">Design system</p>
      <h1 className="sg__title">Le style Rift</h1>
      <p style={{ color: 'var(--muted)' }}>Couleurs, polices et composants de base du jeu.</p>
    </header>

    <section className="sg__panel"><h2>Couleurs</h2>
      <div className="sg__row">{COLORS.map(([v, l]) => <span key={v} className="sg__sw"><i style={{ background: `var(${v})` }} />{l}<code>{v}</code></span>)}</div>
    </section>

    <section className="sg__panel"><h2>Raretés</h2>
      <div className="sg__row">{RARITIES.map(([k, l, v]) => <span key={k} className="sg__sw"><b className="sg__rar" style={{ color: `var(${v})` }}>{k}</b>{l}</span>)}</div>
      <div className="sg__row" style={{ marginTop: 14 }}>{RARITIES.map(([k, l, v], i) => <button key={k} className={`sg__pill ${i === 0 ? 'is-on' : ''}`} style={{ ['--c' as string]: `var(${v})` }}><i />{l}</button>)}</div>
    </section>

    <section className="sg__panel"><h2>Typographie</h2>
      <p className="eyebrow">Entre collectionneurs</p>
      <p className="sg__title">Le Marché</p>
      <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em' }}>Titre H1 en Manrope</p>
      <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>Titre H2 en Manrope</p>
      <p>Texte courant en Manrope : lisible, net, à 14 px.</p>
      <p className="sg__num">12 480 <small style={{ fontSize: 16, color: 'var(--muted)' }}>Éclats</small></p>
    </section>

    <section className="sg__panel"><h2>Boutons</h2>
      <div className="sg__row">
        <button className="cd-btn cd-btn--main cd-btn--small">Invoquer →</button>
        <button className="sg__ghost">Secondaire</button>
        <button className="sg__gold">Récupérer</button>
        <button className="cd-btn cd-btn--small" disabled>Désactivé</button>
        <button className="linkbtn">Lien souligné</button>
      </div>
    </section>

    <section className="sg__panel"><h2>Étiquettes et barres</h2>
      <div className="sg__row">
        <span className="sg__tag" style={{ ['--c' as string]: 'var(--gold)' }}>J'échange</span>
        <span className="sg__tag" style={{ ['--c' as string]: 'var(--hot)' }}>Je cherche</span>
        <span className="sg__tag" style={{ ['--c' as string]: 'var(--ok)' }}>Ouvert</span>
        <span className="sg__tag" style={{ ['--c' as string]: '#d98a56' }}>Bronze</span>
      </div>
      <div className="sg__row" style={{ marginTop: 14 }}>
        <span className="sg__bar" style={{ ['--w' as string]: '64%' }}><i /></span>
        <input className="set__input" placeholder="Champ de saisie" />
      </div>
    </section>
  </main>
)
