import { useEffect, useRef, useState } from 'react'
import type { Hero } from '../data/heroes'
import { RARITIES } from '../data/rarities'
import { heroArt } from '../assets/manifest'
import { useStore } from '../state/store'
import { Card } from '../ui/Card'
import { PRESETS } from './presets'
import { pickHeadliner } from './timeline'
import { SummonAudio } from './audio'
import type { Quality, SummonStage } from './SummonStage'

// Écran de la cinématique d'invocation : la scène 3D en fond, et par-dessus l'habillage
// (bandes cinéma, éclat blanc, révélation du personnage, résultats d'un tirage multiple).
// La rareté vient du tirage réel : `heroes` est exactement ce que le système de gacha a renvoyé.

const QUALITY_KEY = 'anime-rift-fx'

const readQuality = (): Quality => {
  try {
    const saved = localStorage.getItem(QUALITY_KEY)
    if (saved === 'high' || saved === 'low') return saved
  } catch { /* stockage indisponible */ }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : 'high'
}

type Step = 'loading' | 'playing' | 'revealed'

export const SummonCinematic = ({ heroes, onClose }: { heroes: Hero[]; onClose: () => void }) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const dark = useRef<HTMLDivElement>(null)
  const stage = useRef<SummonStage | null>(null)
  const audio = useRef(new SummonAudio())
  const [step, setStep] = useState<Step>('loading')
  const [quality, setQuality] = useState<Quality>(readQuality)
  const { customArt } = useStore()

  const single = heroes.length === 1
  const star = pickHeadliner(heroes) // le plus rare du tirage décide de la mise en scène
  const preset = PRESETS[star.rarity]
  const rarity = RARITIES[star.rarity]

  useEffect(() => {
    let cancelled = false
    const sound = audio.current
    const reveal = () => { if (!cancelled) setStep('revealed') }
    ;(async () => {
      try {
        const { SummonStage } = await import('./SummonStage') // le moteur 3D n'est chargé qu'à la première invocation
        if (cancelled || !canvas.current) return
        const s = new SummonStage(canvas.current, quality)
        stage.current = s
        await s.load()
        if (cancelled) return
        await s.start(preset, single ? (customArt[star.id] ?? heroArt(star.model, 'full')) : null, {
          onPhase: (phase) => { if (phase === 'reveal') reveal() },
          onFrame: (f, d) => {
            if (flash.current) flash.current.style.opacity = String(f)
            if (dark.current) dark.current.style.opacity = String(d)
          },
        })
        if (cancelled) return
        sound.start(preset, star.rarity)
        setStep('playing')
        window.addEventListener('resize', s.resize)
      } catch {
        reveal() // pas de 3D disponible sur cet appareil : on montre directement le résultat
      }
    })()
    return () => {
      cancelled = true
      sound.stop()
      if (stage.current) window.removeEventListener('resize', stage.current.resize)
      stage.current?.dispose()
      stage.current = null
    }
    // la cinématique se joue une fois, pour le tirage reçu à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => {
    if (step !== 'playing') return
    stage.current?.skip()
    audio.current.skip(star.rarity)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (step === 'playing') skip()
      else if (step === 'revealed') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleQuality = () => {
    const next: Quality = quality === 'high' ? 'low' : 'high'
    setQuality(next)
    try { localStorage.setItem(QUALITY_KEY, next) } catch { /* non enregistré */ }
  }

  return (
    <div className={`sc sc--${star.rarity} sc--${step}`} style={{ ['--sc' as string]: `#${preset.colors.accent.toString(16).padStart(6, '0')}`, ['--sc2' as string]: `#${preset.colors.second.toString(16).padStart(6, '0')}` }}
      role="dialog" aria-modal="true" aria-label="Invocation">
      <canvas ref={canvas} className="sc__canvas" onClick={skip} />
      <div ref={dark} className="sc__dark" />
      <div ref={flash} className="sc__flash" />
      <div className="sc__bar sc__bar--top" />
      <div className="sc__bar sc__bar--bottom" />

      {step === 'loading' && <p className="sc__loading">Ouverture de la faille…</p>}

      {step === 'playing' && (
        <div className="sc__controls">
          <button className="sc__btn" onClick={toggleQuality} title="S'applique à la prochaine invocation">Effets : {quality === 'high' ? 'complets' : 'réduits'}</button>
          <button className="sc__btn sc__btn--skip" onClick={skip}>Passer ▸▸</button>
        </div>
      )}

      {step === 'revealed' && single && (
        <div className="sc__reveal">
          <p className="sc__rank"><b>{rarity.short}</b>{preset.rank}</p>
          <h2 className="sc__name" aria-label={star.name}>
            {[...star.name].map((ch, i) => <span key={i} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>{ch}</span>)}
          </h2>
          <p className="sc__title">{star.title} · {star.world}</p>
          <p className="sc__stats"><span><small>ATK</small>{star.atk.toLocaleString('fr-FR')}</span><span><small>DEF</small>{star.def.toLocaleString('fr-FR')}</span><span><small>Rôle</small>{star.role}</span></p>
          <button className="btn btn--gold sc__continue" onClick={onClose} autoFocus>Continuer</button>
        </div>
      )}

      {step === 'revealed' && !single && (
        <div className="sc__multi">
          <div className="result">
            <h2 className="result__title">La faille répond</h2>
            <div className={`result__grid result__grid--${heroes.length}`}>
              {heroes.map((h, i) => <Card key={i} hero={h} className="result__card" style={{ animationDelay: `${i * 90}ms` }} />)}
            </div>
            <button className="btn btn--gold" onClick={onClose} autoFocus>Continuer</button>
          </div>
        </div>
      )}
    </div>
  )
}
