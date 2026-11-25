import type { RarityId } from '../data/rarities'
import type { SummonPreset } from './presets'
import { phaseStarts } from './timeline'

// Bande-son de l'invocation, entièrement synthétisée dans le navigateur (aucun fichier audio, aucun son emprunté).
// Tous les sons sont programmés d'avance sur l'horloge audio, à partir des mêmes durées que l'image :
// ils restent donc calés sur les phases, même si l'affichage ralentit.

let ctx: AudioContext | null = null

// À appeler dans le clic qui lance l'invocation : les navigateurs n'autorisent le son qu'à ce moment-là.
export const primeAudio = () => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null // pas de son disponible : la cinématique se joue en silence
  }
}

const NOTE = (semitonesFromA3: number) => 220 * Math.pow(2, semitonesFromA3 / 12)

// Accord de révélation propre à chaque rareté (demi-tons depuis le la 3).
const CHORDS: Record<RarityId, number[]> = {
  rare: [0, 7, 12],
  epic: [0, 3, 7, 10, 15],
  legend: [0, 4, 7, 11, 12, 16, 19, 24],
  rift: [-12, -5, 0, 3, 7, 10, 15, 19],
}

export class SummonAudio {
  private master: GainNode | null = null
  private nodes: AudioScheduledSourceNode[] = []

  start(preset: SummonPreset, rarity: RarityId) {
    if (!ctx) return
    const c = ctx
    const t0 = c.currentTime + 0.05
    const s = phaseStarts(preset.times)
    const power = { rare: 0.55, epic: 0.7, legend: 0.9, rift: 1 }[rarity]

    this.master = c.createGain()
    this.master.gain.value = 0.5
    // un écho court donne de l'espace à tous les sons
    const delay = c.createDelay(1)
    delay.delayTime.value = 0.23
    const feedback = c.createGain()
    feedback.gain.value = 0.32
    this.master.connect(c.destination)
    this.master.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(c.destination)

    const noise = this.noiseBuffer(c)
    const out = this.master

    // 1. Rassemblement : souffle grave qui monte
    this.sweep(c, out, noise, t0 + s.gather, preset.times.gather + preset.times.open, 120, 700, 0.16 * power, 'bandpass')
    // 2. Ouverture du portail : déchirure
    this.sweep(c, out, noise, t0 + s.open, 0.9, 300, 2600, 0.3 * power, 'bandpass')
    this.tone(c, out, t0 + s.open, 0.7, 90, 45, 0.35 * power, 'sine')
    // 3. Montée en puissance : bourdon qui grimpe, sifflement, décharges électriques
    const surgeEnd = t0 + s.hush
    this.drone(c, out, t0 + s.open + 0.2, surgeEnd, 55, 110 + 60 * power, 0.13 * power)
    this.sweep(c, out, noise, t0 + s.surge, preset.times.surge, 600, 7000, 0.2 * power, 'highpass')
    this.tone(c, out, t0 + s.surge, preset.times.surge, 220, 880 + 440 * power, 0.07 * power, 'sawtooth')
    const zaps = Math.round(preset.times.surge * (3 + preset.bolts * 2))
    for (let i = 0; i < zaps; i++) {
      const at = t0 + s.surge + ((i + Math.random() * 0.8) / zaps) * preset.times.surge
      this.sweep(c, out, noise, at, 0.05 + Math.random() * 0.07, 2500 + Math.random() * 4000, 1500, 0.22 * power, 'bandpass')
    }
    // 4. Silence dramatique : rien n'est programmé pendant `hush` (le bourdon et le sifflement s'arrêtent net)
    // 5. Explosion : coup grave, souffle, puis l'accord de la rareté
    const boom = t0 + s.burst
    this.tone(c, out, boom, 1.4 + power, 150, 28, 0.9 * power, 'sine')
    this.sweep(c, out, noise, boom, 1.1 + power * 0.6, 5000, 180, 0.5 * power, 'lowpass')
    if (rarity === 'rift') this.tone(c, out, boom, 2.4, 55, 22, 0.7, 'sawtooth', 220)
    const chord = CHORDS[rarity]
    chord.forEach((n, i) => {
      const at = boom + 0.12 + i * (rarity === 'rift' ? 0.11 : 0.07)
      if (rarity === 'rift') this.pad(c, out, at, 3.2, NOTE(n), 0.07)
      else this.bell(c, out, at, 1.6 + power, NOTE(n + (rarity === 'legend' ? 12 : 0)), 0.16 * power)
    })
    if (rarity === 'legend' || rarity === 'rift') {
      // scintillement aigu réservé aux deux plus hautes raretés
      for (let i = 0; i < 14; i++) this.bell(c, out, boom + 0.5 + i * 0.09, 0.9, NOTE(24 + chord[i % chord.length]), 0.045)
    }
  }

  // Une lumière éclate et révèle sa carte : petit souffle et note de la rareté (plus riche si la carte est rare).
  pop(rarity: RarityId) {
    if (!ctx) return
    const c = ctx
    const out = this.bus(c, 0.42)
    const at = c.currentTime + 0.01
    this.sweep(c, out, this.noiseBuffer(c), at, 0.22, 3200, 500, 0.28, 'bandpass')
    const notes = { rare: [12], epic: [12, 19], legend: [12, 16, 19, 24], rift: [0, 7, 12, 15, 19] }[rarity]
    notes.forEach((n, i) => this.bell(c, out, at + 0.03 + i * 0.045, rarity === 'rare' ? 0.6 : 1.3, NOTE(n), 0.16))
    if (rarity === 'legend' || rarity === 'rift') this.tone(c, out, at, 0.9, 140, 34, 0.6, 'sine')
  }

  // Plan d'annonce d'une carte LR ou MR : sifflement tranchant puis coup grave.
  cutIn(rarity: RarityId) {
    if (!ctx) return
    const c = ctx
    const out = this.bus(c, 0.45)
    const at = c.currentTime + 0.01
    this.sweep(c, out, this.noiseBuffer(c), at, 0.35, 900, 9000, 0.4, 'highpass')
    this.tone(c, out, at + 0.28, 1.1, 180, 30, rarity === 'rift' ? 0.95 : 0.75, 'sine')
    this.tone(c, out, at + 0.28, 0.5, 880, 220, 0.12, 'sawtooth', 1800)
  }

  // Sortie audio indépendante de la piste principale (pour les sons déclenchés à la demande).
  private bus(c: AudioContext, gain: number) {
    const g = c.createGain()
    g.gain.value = gain
    g.connect(c.destination)
    return g
  }

  // Passer la cinématique : on coupe tout et on joue seulement l'accord.
  skip(rarity: RarityId) {
    this.stop(0.08)
    if (!ctx) return
    const c = ctx
    this.master = c.createGain()
    this.master.gain.value = 0.4
    this.master.connect(c.destination)
    CHORDS[rarity].slice(0, 4).forEach((n, i) => this.bell(c, this.master!, c.currentTime + 0.03 + i * 0.05, 1.2, NOTE(n + 12), 0.14))
  }

  stop(fade = 0.25) {
    if (!ctx || !this.master) return
    const m = this.master
    const now = ctx.currentTime
    m.gain.cancelScheduledValues(now)
    m.gain.setValueAtTime(m.gain.value, now)
    m.gain.linearRampToValueAtTime(0, now + fade)
    const nodes = this.nodes
    this.nodes = []
    this.master = null
    setTimeout(() => {
      for (const n of nodes) { try { n.stop() } catch { /* déjà arrêté */ } }
      m.disconnect()
    }, fade * 1000 + 60)
  }

  private noiseBuffer(c: AudioContext) {
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  private env(g: GainNode, at: number, dur: number, peak: number, attack = 0.02) {
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + Math.min(attack, dur * 0.5))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  }

  // Bruit filtré dont la fréquence glisse : souffles, déchirures, décharges.
  private sweep(c: AudioContext, out: AudioNode, noise: AudioBuffer, at: number, dur: number, f0: number, f1: number, peak: number, type: BiquadFilterType) {
    const src = c.createBufferSource()
    src.buffer = noise
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.Q.value = type === 'bandpass' ? 1.4 : 0.7
    filter.frequency.setValueAtTime(f0, at)
    filter.frequency.exponentialRampToValueAtTime(f1, at + dur)
    const g = c.createGain()
    this.env(g, at, dur, peak, dur * 0.35)
    src.connect(filter).connect(g).connect(out)
    src.start(at)
    src.stop(at + dur + 0.05)
    this.nodes.push(src)
  }

  // Note dont la hauteur glisse : coups graves, sifflements.
  private tone(c: AudioContext, out: AudioNode, at: number, dur: number, f0: number, f1: number, peak: number, type: OscillatorType, cutoff = 0) {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, at)
    osc.frequency.exponentialRampToValueAtTime(f1, at + dur)
    const g = c.createGain()
    this.env(g, at, dur, peak)
    if (cutoff) {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = cutoff
      osc.connect(lp).connect(g).connect(out)
    } else osc.connect(g).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
    this.nodes.push(osc)
  }

  // Bourdon : deux scies légèrement désaccordées, coupées net à la fin (pour le silence).
  private drone(c: AudioContext, out: AudioNode, from: number, to: number, f0: number, f1: number, peak: number) {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(200, from)
    lp.frequency.exponentialRampToValueAtTime(2200, to)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, from)
    g.gain.exponentialRampToValueAtTime(peak, to - 0.05)
    g.gain.linearRampToValueAtTime(0, to)
    lp.connect(g).connect(out)
    for (const detune of [-9, 8]) {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.detune.value = detune
      osc.frequency.setValueAtTime(f0, from)
      osc.frequency.exponentialRampToValueAtTime(f1, to)
      osc.connect(lp)
      osc.start(from)
      osc.stop(to + 0.02)
      this.nodes.push(osc)
    }
  }

  // Cloche : fondamentale et harmonique claire, décroissance longue.
  private bell(c: AudioContext, out: AudioNode, at: number, dur: number, freq: number, peak: number) {
    for (const [mult, level] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * mult
      const g = c.createGain()
      this.env(g, at, dur / (1 + (mult - 1) * 0.3), peak * level, 0.005)
      osc.connect(g).connect(out)
      osc.start(at)
      osc.stop(at + dur + 0.05)
      this.nodes.push(osc)
    }
  }

  // Nappe lente et sombre, pour la révélation mythique.
  private pad(c: AudioContext, out: AudioNode, at: number, dur: number, freq: number, peak: number) {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(400, at)
    lp.frequency.exponentialRampToValueAtTime(3000, at + dur * 0.5)
    const g = c.createGain()
    this.env(g, at, dur, peak, dur * 0.3)
    lp.connect(g).connect(out)
    for (const detune of [-11, 0, 12]) {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.detune.value = detune
      osc.frequency.value = freq
      osc.connect(lp)
      osc.start(at)
      osc.stop(at + dur + 0.05)
      this.nodes.push(osc)
    }
  }
}
