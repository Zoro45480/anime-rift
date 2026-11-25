import { useEffect, useState } from 'react'
import { RiftBackground } from '../fx/RiftBackground'
import { Logo } from '../ui/Logo'
import { RiftButton } from '../ui/RiftButton'
import { RiftPanel } from '../ui/RiftPanel'
import { Gauge } from '../ui/Gauge'
import { AffinityIcon } from '../ui/AffinityIcon'
import { RarityCard, type CardData } from '../ui/RarityCard'
import { AFFINITY_LIST } from '../data/affinities'
import { RARITIES } from '../data/rarities'

// Personnages ORIGINAUX de démonstration (les vrais kits arrivent en phase 4).
const DEMO: CardData[] = [
  { id: 'kael', name: 'Kael', title: 'Le Porte-Faille', role: 'Hybride', rarity: 'rift', affinity: 'rift', level: 60, seed: 3 },
  { id: 'ryuna', name: 'Ryuna', title: 'Lame du Brasier', role: 'Burst DPS', rarity: 'legend', affinity: 'fire', level: 52, seed: 8 },
  { id: 'sorel', name: 'Sorel', title: 'Veilleur des Marées', role: 'Soigneur', rarity: 'epic', affinity: 'water', level: 41, seed: 21 },
  { id: 'toma', name: 'Toma', title: 'Bouclier de Granit', role: 'Tank', rarity: 'rare', affinity: 'earth', level: 30, seed: 34 },
  { id: 'nyx', name: 'Nyx', title: 'Ombre Sans Nom', role: 'Contrôle', rarity: 'legend', affinity: 'dark', level: 47, seed: 55 },
]

const SWATCHES = [
  ['Abysse', '--abyss'], ['Nuit', '--night'], ['Violet', '--violet'], ['Cyan', '--cyan'], ['Argent', '--silver'], ['Or', '--gold'], ['Blanc', '--white'],
]

export const StyleShowcase = () => {
  const [selected, setSelected] = useState('kael')
  const [hp, setHp] = useState(7200)
  const [energy, setEnergy] = useState(2)
  const [ult, setUlt] = useState(60)
  const [toast, setToast] = useState('')
  const hero = DEMO.find((d) => d.id === selected)!

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const attack = () => { setEnergy((e) => Math.min(5, e + 1)); setUlt((u) => Math.min(100, u + 20)); setHp((h) => Math.max(0, h - 900)) }
  const skill = () => { if (energy < 2) return setToast('Énergie insuffisante'); setEnergy((e) => e - 2); setUlt((u) => Math.min(100, u + 30)) }
  const ultimate = () => { if (ult < 100) return setToast('Ultime non chargé'); setUlt(0); setToast('ULTIME — Rupture dimensionnelle !') }
  const reset = () => { setHp(7200); setEnergy(2); setUlt(60) }

  return (
    <div className="showcase">
      <RiftBackground />
      <div className="showcase__content">
        <header className="hero-head">
          <Logo size={3.2} />
          <p className="hero-head__tag">Phase 1 — Identité visuelle · planche de style interactive</p>
        </header>

        <div className="grid">
          <RiftPanel title="Palette" tag="Couleurs" accent="violet">
            <div className="swatches">
              {SWATCHES.map(([name, v]) => (
                <div key={v} className="swatch"><span style={{ background: `var(${v})` }} /><b>{name}</b></div>
              ))}
            </div>
            <h3 className="sub">Affinités</h3>
            <div className="affinities">
              {AFFINITY_LIST.map((a) => (
                <div key={a.id} className="affinities__item"><AffinityIcon id={a.id} /><span>{a.label}</span></div>
              ))}
            </div>
          </RiftPanel>

          <RiftPanel title="Typographie" tag="Hiérarchie">
            <p className="t-display">Les mondes se fracturent</p>
            <p className="t-title">Saga I — La Fracture</p>
            <p className="t-body">Le Nexus relie ce qui n'aurait jamais dû se toucher. Chaque faille ouverte est une promesse, et une menace.</p>
            <p className="t-stat"><span>ATQ</span> 2 480 <span>VIT</span> 132 <span>CRIT</span> 34,5 %</p>
            <h3 className="sub">Boutons</h3>
            <div className="btn-row">
              <RiftButton onClick={() => setToast('Bouton principal')}>Entrer dans la Faille</RiftButton>
              <RiftButton variant="gold" sub="×10" onClick={() => setToast('Bouton prestige')}>Invoquer</RiftButton>
              <RiftButton variant="ghost" onClick={() => setToast('Bouton secondaire')}>Retour</RiftButton>
              <RiftButton disabled>Verrouillé</RiftButton>
            </div>
          </RiftPanel>
        </div>

        <RiftPanel title="Cartes de personnage" tag="4 raretés · survolez et cliquez" accent="gold">
          <div className="cards">
            {DEMO.map((d) => <RarityCard key={d.id} data={d} selected={d.id === selected} onSelect={setSelected} />)}
          </div>
        </RiftPanel>

        <RiftPanel title={`${hero.name} — ${hero.title}`} tag={`${RARITIES[hero.rarity].label} · ${hero.role}`}>
          <div className="combat-demo">
            <div className="combat-demo__gauges">
              <Gauge kind="hp" value={hp} max={7200} label="Points de vie" />
              <Gauge kind="energy" value={energy} max={5} label="Énergie" segments={5} />
              <Gauge kind="ultimate" value={ult} max={100} label="Ultime" />
              <Gauge kind="guard" value={3} max={6} label="Garde ennemie" segments={6} />
            </div>
            <div className="btn-row">
              <RiftButton variant="ghost" sub="+1 énergie" onClick={attack}>Attaque</RiftButton>
              <RiftButton sub="2 énergie" onClick={skill}>Compétence</RiftButton>
              <RiftButton variant="gold" sub={ult >= 100 ? 'Prêt' : `${ult} %`} onClick={ultimate}>Ultime</RiftButton>
              <RiftButton variant="ghost" onClick={reset}>Réinitialiser</RiftButton>
            </div>
          </div>
        </RiftPanel>

        <footer className="foot">Illustrations temporaires originales · remplaçables via <code>src/assets/manifest.ts</code></footer>
      </div>
      <div className={`toast ${toast ? 'is-on' : ''}`} role="status">{toast}</div>
    </div>
  )
}
