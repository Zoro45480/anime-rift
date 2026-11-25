import { useCallback, useEffect, useRef, useState } from 'react'
import type { Hero } from '../data/heroes'
import { RARITIES, type RarityId } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { PRESETS } from './presets'
import { pickHeadliner } from './timeline'
import { isSoundOn, setSoundOn, SummonAudio } from './audio'
import type { Quality, SummonStage } from './SummonStage'

// Cinématique d'invocation. `heroes` est exactement ce que le tirage réel a renvoyé : 1, 5 ou 10 cartes.
//
//   1. Ouverture  — le portail 3D s'ouvre, aux couleurs de la carte la plus rare du tirage.
//   2. Lumières   — une lumière par carte jaillit du portail, chacune à la couleur de sa rareté.
//   3. Révélation — les lumières éclatent une à une et montrent leur carte ; les cartes LR et MR sont
//                   annoncées par un plan d'anime (bande en biais, personnage, mot qui claque).
//   4. Bilan      — la carte seule en grand, ou la grille de toutes les cartes.

const QUALITY_KEY = 'anime-rift-fx'
const CARD_MS: Record<RarityId, number> = { common: 520, rare: 620, epic: 800, ultra: 1300, legend: 1700, rift: 2100 }
const CUTIN_MS: Partial<Record<RarityId, number>> = { ultra: 1100, legend: 1300, rift: 1650 } // seules ces raretés ont un plan d'annonce

const readQuality = (): Quality => {
  try {
    const saved = localStorage.getItem(QUALITY_KEY)
    if (saved === 'high' || saved === 'low') return saved
  } catch { /* stockage indisponible */ }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : 'high'
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

type Step = 'loading' | 'intro' | 'cards' | 'summary'
type Sub = 'cutin' | 'card'

// Plan d'annonce d'une carte rare : une bande en biais traverse l'écran avec le personnage, et le mot claque.
const CutIn = ({ hero, art }: { hero: Hero; art: string }) => (
  <div className={`cutin cutin--${hero.rarity}`}>
    <div className="cutin__flash" />
    <div className="cutin__band">
      <div className="cutin__streaks" />
      {art ? <img className={art.startsWith('data:image/jpeg') || /^https?:/.test(art) ? 'is-photo' : ''} src={art} alt="" /> : <span className="cutin__kana" lang="ja">{hero.kana}</span>}
    </div>
    <p className="cutin__word">{PRESETS[hero.rarity].rank}&nbsp;!</p>
  </div>
)

export const SummonCinematic = ({ heroes, onClose }: { heroes: Hero[]; onClose: () => void }) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const dark = useRef<HTMLDivElement>(null)
  const stage = useRef<SummonStage | null>(null)
  const audio = useRef(new SummonAudio())
  const timer = useRef(0)
  const [step, setStep] = useState<Step>('loading')
  const [index, setIndex] = useState(0)
  const [sub, setSub] = useState<Sub>('card')
  const [quality, setQuality] = useState<Quality>(readQuality)
  const [sound, setSound] = useState(isSoundOn)
  const { customArt } = useStore()

  const single = heroes.length === 1
  const star = pickHeadliner(heroes) // la carte la plus rare décide des couleurs et de l'ampleur de l'ouverture
  const preset = PRESETS[star.rarity]
  const hero = heroes[Math.min(index, heroes.length - 1)]
  const artOf = (h: Hero) => customArt[h.id] ?? heroArt(h.model, 'full')
  const firstSub = (h: Hero): Sub => (CUTIN_MS[h.rarity] ? 'cutin' : 'card')

  const beginCards = useCallback(() => {
    setIndex(0)
    setSub(firstSub(heroes[0]))
    setStep('cards')
  }, [heroes])

  // --- ouverture : charge et lance la scène 3D ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const sound = audio.current
    ;(async () => {
      try {
        const { SummonStage } = await import('./SummonStage') // le moteur 3D n'est chargé qu'à la première invocation
        if (cancelled || !canvas.current) return
        const s = new SummonStage(canvas.current, quality)
        stage.current = s
        await s.load()
        if (cancelled) return
        await s.start(preset, null, {
          onPhase: () => {},
          onReady: () => { if (!cancelled) beginCards() }, // toutes les lumières sont en place
          onFrame: (f, d) => {
            if (flash.current) flash.current.style.opacity = String(f)
            if (dark.current) dark.current.style.opacity = String(d)
          },
        }, heroes.map((h) => PRESETS[h.rarity].colors.accent))
        if (cancelled) return
        void sound.start(preset, star.rarity)
        setStep('intro')
        window.addEventListener('resize', s.resize)
      } catch {
        if (!cancelled) setStep('summary') // pas de 3D sur cet appareil : on montre directement le résultat
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
      sound.stop()
      if (stage.current) window.removeEventListener('resize', stage.current.resize)
      stage.current?.dispose()
      stage.current = null
    }
    // la cinématique se joue une fois, pour le tirage reçu à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const next = useCallback(() => {
    if (index + 1 < heroes.length) {
      setSub(firstSub(heroes[index + 1]))
      setIndex(index + 1)
    } else setStep('summary')
  }, [index, heroes])

  // --- révélation : chaque carte a son temps à l'écran, puis on passe à la suivante --------------------------
  useEffect(() => {
    if (step !== 'cards') return
    const h = heroes[index]
    if (sub === 'cutin') {
      audio.current.cutIn(h.rarity)
      timer.current = window.setTimeout(() => setSub('card'), CUTIN_MS[h.rarity])
    } else {
      stage.current?.popOrb(index)
      audio.current.pop(h.rarity, index)
      timer.current = window.setTimeout(next, CARD_MS[h.rarity] + (single ? 500 : 0))
    }
    return () => window.clearTimeout(timer.current)
  }, [step, index, sub, heroes, next, single])

  // Avancer d'un cran (clic, Entrée, Espace) : écourte l'ouverture, le plan d'annonce ou la carte en cours.
  const advance = () => {
    if (step === 'intro') stage.current?.skip()
    else if (step === 'cards') {
      window.clearTimeout(timer.current)
      if (sub === 'cutin') setSub('card')
      else next()
    } else if (step === 'summary') onClose()
  }

  // Tout passer (bouton, Échap) : droit au bilan.
  const skipAll = () => {
    if (step === 'summary') return onClose()
    window.clearTimeout(timer.current)
    audio.current.skip()
    heroes.forEach((_, i) => stage.current?.popOrb(i))
    setStep('summary')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); skipAll() }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleQuality = () => {
    const nextQuality: Quality = quality === 'high' ? 'low' : 'high'
    setQuality(nextQuality)
    try { localStorage.setItem(QUALITY_KEY, nextQuality) } catch { /* non enregistré */ }
  }

  const toggleSound = () => {
    const on = !sound
    setSound(on)
    setSoundOn(on)
    if (!on) audio.current.stop(0.1)
  }

  const shown = step === 'cards' ? hero : star
  const tint = PRESETS[shown.rarity].colors

  return (
    <div className={`sc sc--${shown.rarity} sc--${step}`} style={{ ['--sc' as string]: hex(tint.accent), ['--sc2' as string]: hex(tint.second) }}
      role="dialog" aria-modal="true" aria-label="Invocation">
      <canvas ref={canvas} className="sc__canvas" />
      <div ref={dark} className="sc__dark" />
      <div className="sc__speed" />
      <div ref={flash} className="sc__flash" />
      <div className="sc__bar sc__bar--top" />
      <div className="sc__bar sc__bar--bottom" />

      {step === 'loading' && <p className="sc__loading">Ouverture de la faille…</p>}

      {(step === 'intro' || step === 'cards') && <button className="sc__tap" onClick={advance} aria-label="Avancer" />}

      {step === 'cards' && (
        <>
          <div className="sc__stagecard" key={`${index}-${sub}`}>
            {sub === 'cutin' ? <CutIn hero={hero} art={artOf(hero)} /> : (
              <>
                <div className="sc__burst" />
                <div className="sc__bigcard"><Card hero={hero} /></div>
              </>
            )}
          </div>
          {!single && (
            <div className="sc__tray" aria-label={`Carte ${index + 1} sur ${heroes.length}`}>
              {heroes.map((h, i) => {
                const on = i < index || (i === index && sub === 'card')
                return <i key={i} className={`sc__chip ${on ? `is-on sc__chip--${h.rarity}` : ''} ${i === index ? 'is-current' : ''}`}>{on ? RARITIES[h.rarity].short : ''}</i>
              })}
            </div>
          )}
        </>
      )}

      {(step === 'intro' || step === 'cards') && (
        <div className="sc__controls">
          <button className="sc__btn" onClick={toggleSound} aria-pressed={sound}>Son : {sound ? 'activé' : 'coupé'}</button>
          <button className="sc__btn" onClick={toggleQuality} title="S'applique à la prochaine invocation">Effets : {quality === 'high' ? 'complets' : 'réduits'}</button>
          <button className="sc__btn sc__btn--skip" onClick={skipAll}>Passer ▸▸</button>
        </div>
      )}

      {step === 'summary' && single && (
        <div className="sc__solo">
          <div className="sc__burst" />
          <div className="sc__bigcard sc__bigcard--stay"><Card hero={star} /></div>
          <p className="sc__rank"><b>{RARITIES[star.rarity].short}</b>{preset.rank}</p>
          <h2 className="sc__name" aria-label={star.name}>
            {[...star.name].map((ch, i) => <span key={i} style={{ animationDelay: `${0.15 + i * 0.06}s` }}>{ch}</span>)}
          </h2>
          <p className="sc__title">{star.title} · {star.world}</p>
          <button className="btn btn--gold sc__continue" onClick={onClose} autoFocus>Continuer</button>
        </div>
      )}

      {step === 'summary' && !single && (
        <div className="sc__multi">
          <div className="result">
            <h2 className="result__title">La faille répond</h2>
            <div className={`result__grid result__grid--${heroes.length}`}>
              {heroes.map((h, i) => <Card key={i} hero={h} className="result__card" style={{ animationDelay: `${i * 70}ms` }} />)}
            </div>
            <button className="btn btn--gold" onClick={onClose} autoFocus>Continuer</button>
          </div>
        </div>
      )}
    </div>
  )
}
