import type { RarityId } from '../data/rarities'
import type { SummonPreset } from './presets'
import { phaseStarts } from './timeline'

// Bande-son de l'invocation. Les bruitages sont de vrais fichiers audio, générés pour ANIME RIFT avec ElevenLabs
// (effets sonores) et rangés dans src/assets/sfx/. Pour en remplacer un : déposer un fichier du même nom.
//
//   portal.mp3  ouverture du portail            charge.mp3  montée en puissance
//   burst.mp3   explosion                       pop.mp3     une carte se révèle
//   cutin.mp3   plan d'annonce (LR, MR)         legend.mp3  révélation légendaire      mythic.mp3  révélation mythique
//
// Chaque son est programmé sur l'horloge audio, aux mêmes instants que les phases de l'image.

const files = import.meta.glob('../assets/sfx/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
type SfxName = 'portal' | 'charge' | 'burst' | 'pop' | 'cutin' | 'legend' | 'mythic'
const NAMES: SfxName[] = ['portal', 'charge', 'burst', 'pop', 'cutin', 'legend', 'mythic']

const SOUND_KEY = 'anime-rift-sound'
let ctx: AudioContext | null = null
let loading: Promise<void> | null = null
const buffers = new Map<SfxName, AudioBuffer>()
const levels = new Map<SfxName, number>() // correction de volume : les fichiers n'ont pas tous la même force

export const isSoundOn = (): boolean => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}
export const setSoundOn = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off') } catch { /* non enregistré */ }
}

// Volume des bruitages, de 0 à 1 (réglé dans les Paramètres).
const VOLUME_KEY = 'anime-rift-volume'
export const getVolume = (): number => {
  try { const v = Number(localStorage.getItem(VOLUME_KEY) ?? '0.8'); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8 } catch { return 0.8 }
}
export const setVolume = (v: number) => {
  try { localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, v)))) } catch { /* non enregistré */ }
}

// Lit un fichier son. Dans la version « un seul fichier » du jeu il est intégré à la page (data:) : on le décode sur place.
const readBytes = async (url: string): Promise<ArrayBuffer> => {
  if (!url.startsWith('data:')) return (await fetch(url)).arrayBuffer()
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

const loadAll = async (c: AudioContext) => {
  await Promise.all(NAMES.map(async (name) => {
    const url = files[`../assets/sfx/${name}.mp3`]
    if (!url) return
    try {
      const buffer = await c.decodeAudioData(await readBytes(url))
      const data = buffer.getChannelData(0)
      let peak = 0
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
      buffers.set(name, buffer)
      levels.set(name, Math.min(6, 0.7 / Math.max(peak, 0.01))) // tous ramenés à la même crête
    } catch { /* son illisible : on s'en passe */ }
  }))
}

// À appeler dans le clic qui lance l'invocation : les navigateurs n'autorisent le son qu'à ce moment-là.
// Le premier appel charge aussi les bruitages.
export const primeAudio = () => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    loading ??= loadAll(ctx)
  } catch {
    ctx = null // pas de son disponible : la cinématique se joue en silence
  }
}

const POWER: Record<RarityId, number> = { common: 0.5, rare: 0.6, epic: 0.72, ultra: 0.85, legend: 0.95, rift: 1 }

export class SummonAudio {
  private live: { src: AudioBufferSourceNode; gain: GainNode }[] = []
  private cancelled = false

  // Joue un bruitage à l'instant `at` (horloge audio). `rate` change sa vitesse et sa hauteur.
  private play(name: SfxName, at: number, volume: number, rate = 1) {
    const buffer = buffers.get(name)
    if (!ctx || !buffer || !isSoundOn()) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume * (levels.get(name) ?? 1) * getVolume()
    src.connect(gain).connect(ctx.destination)
    src.start(Math.max(at, ctx.currentTime))
    const entry = { src, gain }
    this.live.push(entry)
    src.onended = () => { this.live = this.live.filter((l) => l !== entry) }
  }

  // Sons de l'ouverture : portail, montée en puissance calée pour finir pile avant l'explosion, puis l'explosion.
  async start(preset: SummonPreset, rarity: RarityId) {
    if (!ctx) return
    this.cancelled = false
    const t0 = ctx.currentTime + 0.05 // l'instant de départ est pris tout de suite, pour rester calé sur l'image
    await loading
    if (this.cancelled || !ctx) return
    const s = phaseStarts(preset.times)
    const power = POWER[rarity]
    this.play('portal', t0 + s.open, 0.55 * power)
    // la montée dure 3 s ; on l'accélère un peu pour les ouvertures courtes, sans jamais la déformer franchement
    const charge = buffers.get('charge')
    if (charge) {
      const room = preset.times.surge + preset.times.open * 0.4
      const rate = Math.min(1.5, Math.max(0.85, charge.duration / room))
      this.play('charge', t0 + s.hush - charge.duration / rate, 0.5 * power, rate)
    }
    this.play('burst', t0 + s.burst, 0.8 * power)
    if (rarity === 'ultra' || rarity === 'legend') this.play('legend', t0 + s.burst + 0.25, rarity === 'legend' ? 0.7 : 0.5)
    if (rarity === 'rift') this.play('mythic', t0 + s.burst - 0.15, 0.85)
  }

  // Une lumière éclate et révèle sa carte : le tintement monte légèrement de carte en carte.
  pop(rarity: RarityId, step = 0) {
    if (!ctx) return
    const now = ctx.currentTime + 0.01
    this.play('pop', now, 0.6, 1 + Math.min(step, 9) * 0.035)
    if (rarity === 'ultra' || rarity === 'legend') this.play('legend', now + 0.05, rarity === 'legend' ? 0.7 : 0.5, rarity === 'legend' ? 1 : 1.12)
    if (rarity === 'rift') this.play('burst', now, 0.6, 0.85)
  }

  // Plan d'annonce d'une carte LR ou MR.
  cutIn(rarity: RarityId) {
    if (!ctx) return
    this.play('cutin', ctx.currentTime + 0.01, 0.85, rarity === 'rift' ? 0.88 : 1)
  }

  // Tout passer : on coupe ce qui joue et on garde un simple tintement.
  skip() {
    this.stop(0.12)
    this.cancelled = false
    if (ctx) this.play('pop', ctx.currentTime + 0.05, 0.6)
  }

  stop(fade = 0.3) {
    this.cancelled = true
    if (!ctx) return
    const now = ctx.currentTime
    const old = this.live
    this.live = []
    for (const { src, gain } of old) {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + fade)
      try { src.stop(now + fade + 0.05) } catch { /* déjà arrêté */ }
    }
  }
}

// Contrôle qualité (outil de test) : durée et niveau de chaque bruitage une fois décodé.
export const inspectSfx = async (): Promise<Record<string, { seconds: number; peak: number }>> => {
  primeAudio()
  await loading
  const out: Record<string, { seconds: number; peak: number }> = {}
  for (const [name, buffer] of buffers) {
    const data = buffer.getChannelData(0)
    let peak = 0
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
    out[name] = { seconds: Number(buffer.duration.toFixed(2)), peak: Number(peak.toFixed(2)) }
  }
  return out
}
