import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { BIG_PITY, COST, PITY_MAX, type Banner } from '../data/banners'
import { heroById } from '../data/heroes'
import { cardRate, indexCards, isLocal } from '../game/gacha'
import type { Hero } from '../data/heroes'
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/rarities'
import type { Currency } from '../state/store'
import { useStore } from '../state/store'
import { heroArt } from '../assets/manifest'
import { Card } from '../ui/Card'
import { Coin } from '../ui/Coin'
import './rift-summon.css'
import { primeAudio, SummonAudio } from './audio'
import { MrEdit } from './MrEdit'
import { boomDraw, drawShards, soul, soulTrail, makeBoom, makeRift, makeShards, makeSky, RARITY_RGB, rgb, sizeCanvas, type Boom, type Gl, type RGB } from './riftFx'

const art = import.meta.glob('../assets/summon/rift-*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const SKY = art['../assets/summon/rift-sky.webp']
const LOGO = art['../assets/summon/rift-logo.webp']

// Couleurs de chaque Portail : accent (lueur de la faille, bouton, pity) et couleur secondaire (cœur d'énergie, arcs).
const ACCENT: Record<string, [RGB, RGB]> = {
  naruto: [[255, 120, 20], [255, 215, 110]], onepiece: [[235, 40, 40], [255, 205, 90]], dragonball: [[255, 160, 20], [80, 150, 255]],
  bleach: [[160, 205, 255], [255, 255, 255]], demonslayer: [[30, 210, 150], [255, 120, 160]], jujutsu: [[240, 140, 170], [150, 80, 255]],
  hunter: [[60, 235, 110], [255, 215, 80]],
}
const RANK: Record<RarityId, number> = { common: 0, rare: 1, epic: 2, ultra: 3, legend: 4, rift: 5 }
const RARITY_OF: RarityId[] = ['common', 'rare', 'epic', 'ultra', 'legend', 'rift']
type Pull = { hero: Hero; k: number; dup: number } // dup = exemplaires déjà possédés avant celui-ci (0 = nouvelle carte)
type View = 'hub' | 'seq' | 'rev' | 'recap'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const restart = (el: Element | null, cls: string) => { if (!el) return; el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls) }
const leftOf = (iso: string) => {
  const m = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000))
  return `${Math.floor(m / 1440)} j ${Math.floor((m % 1440) / 60)} h ${m % 60} min`
}
const pct = (x: number, d = 3) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: d })} %`
const favKey = 'anime-rift-fav-banners'
export const toggleFav = (id: string, on: boolean) => { const l = readFav().filter((x) => x !== id); if (on) l.push(id); try { localStorage.setItem(favKey, JSON.stringify(l)) } catch { /* stockage bloqué */ } }
export const readFav = (): string[] => { try { return JSON.parse(localStorage.getItem(favKey) || '[]') } catch { return [] } }

const CRACK = 'M50 2 L46 20 L54 34 L44 52 L57 70 L47 88 L55 104 L49 131|M46 20 L30 26 L22 40|M54 34 L72 30 L80 18|M44 52 L24 60 L14 78|M57 70 L78 76 L88 96|M47 88 L32 98 L26 118|M55 104 L70 112 L74 128'.split('|')

// Écran d'invocation complet : la faille au repos → ouverture (déchirure, verre, âmes, explosion MR) → révélation carte par carte → récapitulatif.
// Le tirage est fait par le jeu (store.summon, avec la pity) AVANT l'animation : l'animation ne fait que mettre en scène le résultat.
export const RiftSummon = ({ banner, count = 10, currency = 'ticket', onClose }: { banner: Banner; count?: number; currency?: Currency; onClose: () => void }) => {
  const store = useStore()
  const [n, setN] = useState(count)
  const [pay, setPay] = useState<Currency>(currency)
  const [view, setView] = useState<View>('hub')
  const [pulls, setPulls] = useState<Pull[]>([])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [whoOn, setWhoOn] = useState(false)
  const [hideUi, setHideUi] = useState(false)
  const [edit, setEdit] = useState<Hero | null>(null)
  const [fav, setFav] = useState(() => readFav().includes(banner.id))
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)

  const root = useRef<HTMLDivElement>(null)
  const skyCv = useRef<HTMLCanvasElement>(null)
  const riftCv = useRef<HTMLCanvasElement>(null)
  const portal = useRef<HTMLDivElement>(null)
  const fxCv = useRef<HTMLCanvasElement>(null)
  const fx2Cv = useRef<HTMLCanvasElement>(null)
  const zone = useRef<HTMLDivElement>(null)
  const cardEl = useRef<HTMLDivElement>(null)
  const flashEl = useRef<HTMLDivElement>(null)
  const topline = useRef<HTMLDivElement>(null)
  const prog = useRef<HTMLElement>(null)
  const vig = useRef<HTMLDivElement>(null)
  const rays = useRef<HTMLDivElement>(null)
  const hubUi = useRef<HTMLDivElement>(null)
  const hubEl = useRef<HTMLElement>(null)
  const audio = useRef(new SummonAudio())
  // état de l'animation, hors React (lu et écrit à chaque image)
  const anim = useRef({ pull: 0, pullTarget: 0, dive: 0, skyGlow: 0, mo: [0, 0], moT: [0, 0], seq: 0, rev: 0, view: 'hub' as View })
  anim.current.view = view

  const [c1, c2] = ACCENT[banner.id] ?? ACCENT.naruto
  const can = store.canAfford(pay, n)
  const pity = store.pity[banner.id] ?? 0
  const multis = store.multis[banner.id] ?? 0
  const pool = indexCards(banner)
  const star = heroById(banner.star)
  const p = pulls[i]

  // Ciel et faille : une seule boucle d'images pour tout l'écran.
  useEffect(() => {
    const a = anim.current
    const sky: Gl | null = skyCv.current ? makeSky(skyCv.current, SKY) : null
    const rift: Gl | null = riftCv.current ? makeRift(riftCv.current) : null
    const onMove = (e: PointerEvent) => { a.moT = [(e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * -2] }
    addEventListener('pointermove', onMove)
    const t0 = performance.now()
    let raf = 0
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      if (sky) { a.mo[0] += (a.moT[0] - a.mo[0]) * 0.04; a.mo[1] += (a.moT[1] - a.mo[1]) * 0.04; sky.set('t', t); sky.set('glow', a.skyGlow); sky.set('mo', a.mo[0], a.mo[1]); sky.draw() }
      if (rift && a.view === 'hub') {
        a.pull += (a.pullTarget - a.pull) * 0.15
        portal.current?.style.setProperty('--pull', a.pull.toFixed(3))
        rift.set('t', t); rift.set('pull', a.pull); rift.set('dive', a.dive); rift.set('c1', ...c1.map((v) => v / 255)); rift.set('c2', ...c2.map((v) => v / 255)); rift.draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const clock = setInterval(() => tick((x) => x + 1), 30000) // compte à rebours de la bannière
    const au = audio.current
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); clearInterval(clock); a.seq++; a.rev++; au.stop() }
  }, [c1, c2])

  // on bloque le défilement de la page derrière l'écran d'invocation
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  const flash = (al: number) => {
    const f = flashEl.current
    if (!f) return
    f.style.transition = 'none'; f.style.opacity = String(al)
    requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0' })
  }
  const shake = () => { if (!calm()) { restart(root.current, 'rs--shake') } }

  /* ================= tirage + ouverture ================= */
  const summon = () => {
    if (anim.current.view !== 'hub' || busy || !store.canAfford(pay, n)) return
    primeAudio()
    const before = store.owned
    const heroes = store.summon(banner, pay, n) // le vrai tirage (pity, garanties) : il fixe les raretés
    if (!heroes) return
    const seen: Record<string, number> = {}
    const list: Pull[] = heroes.map((h) => { const had = (before[h.id] ?? 0) + (seen[h.id] ?? 0); seen[h.id] = (seen[h.id] ?? 0) + 1; return { hero: h, k: RANK[h.rarity], dup: had } })
      .sort((x, y) => x.k - y.k) // de la moins rare à la plus rare : la meilleure carte en dernier
    setPulls(list); setBusy(true)
    const run = ++anim.current.seq
    // « Réduire les animations » : pas de déchirure ni de secousse, mais on garde une ouverture courte (flash, lumière, âmes)
    if (calm()) { setBusy(false); shatter(run, list, true); return }
    const tl = topline.current!
    tl.style.transition = 'width .6s'; tl.style.width = '35%'
    const s = performance.now()
    const sp = () => {
      if (run !== anim.current.seq) return
      const k = Math.min(1, (performance.now() - s) / 1300)
      anim.current.dive = k < 0.55 ? k * 0.25 : 0.14 + Math.pow((k - 0.55) / 0.45, 2) * 0.86
      const sh = k > 0.4 ? (k - 0.4) * 10 : 0
      if (portal.current) portal.current.style.transform = `translate(${(Math.random() - 0.5) * sh}px,${(Math.random() - 0.5) * sh}px) scale(${1 + k * k * 0.25})`
      if (hubUi.current) hubUi.current.style.opacity = String(Math.max(0, 1 - k * 2.5))
      if (k < 1) { requestAnimationFrame(sp); return }
      tl.style.width = '100%'
      setTimeout(() => { tl.style.transition = 'none'; tl.style.width = '0' }, 500)
      shatter(run, list)
      setTimeout(() => { if (portal.current) portal.current.style.transform = ''; anim.current.dive = 0; if (hubUi.current) hubUi.current.style.opacity = ''; setBusy(false) }, 400)
    }
    requestAnimationFrame(sp)
  }

  const shatter = (run: number, list: Pull[], short = false) => {
    setView('seq')
    const cv = fxCv.current!, ctx = sizeCanvas(cv)
    const W = innerWidth, H = innerHeight, cx = W / 2, cy = H * 0.44, best = Math.max(...list.map((x) => x.k))
    const shards = makeShards(cx, cy, W, H), nn = list.length
    const cr = list.map((x, j) => ({ k: x.k, t0: 700 + j * (1300 / nn), a: (j / nn) * Math.PI * 2 - Math.PI / 2, R: Math.min(W, H) * 0.3, len: 40 + x.k * 8, spin: Math.random() * 6, rang: false }))
    const RAYS = [...Array(11)].map(() => ({ a: Math.random() * 6.28, w: 6 + Math.random() * 40, l: 0.5 + Math.random() * 0.6, o: 0.08 + Math.random() * 0.16 }))
    const MR = best === 5 && !short, T = MR ? 5600 : 3900, start = performance.now(), speed = short ? 1.8 : 1 // version courte : tout va 1,8 fois plus vite
    let boom: Boom | null = null, fl = false
    anim.current.skyGlow = 0.4; flash(0.55); audio.current.pop('common', 0)
    const f = () => {
      if (run !== anim.current.seq) return
      const t = (performance.now() - start) * speed
      ctx.clearRect(0, 0, W, H)
      if (prog.current) prog.current.style.width = `${Math.min(100, (t / T) * 100)}%`
      // lumière de la faille ouverte et rayons fins
      const lk = Math.min(1, t / 500), fade = t > 3200 ? Math.max(0, 1 - (t - 3200) / 600) : 1
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`); g.addColorStop(0.08, `rgba(${rgb(c1)},${0.75 * fade})`); g.addColorStop(0.35, `rgba(${rgb(c2)},${0.18 * fade})`); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.globalAlpha = lk; ctx.fillRect(0, 0, W, H)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t / 5000)
      for (const ry of RAYS) {
        ctx.save(); ctx.rotate(ry.a)
        const rg = ctx.createLinearGradient(0, 0, 0, -H * ry.l)
        rg.addColorStop(0, `rgba(${rgb(c1)},${ry.o * fade * (0.7 + 0.3 * Math.sin(t / 300 + ry.a * 5))})`); rg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(1, 0); ctx.lineTo(ry.w, -H * ry.l); ctx.lineTo(-ry.w, -H * ry.l); ctx.fill(); ctx.restore()
      }
      ctx.restore(); ctx.globalCompositeOperation = 'source-over'
      if (!short) drawShards(ctx, shards, t / 1000, c1)
      // âmes : une par carte, la plus rare en dernier, puis fusion au centre
      ctx.globalCompositeOperation = 'lighter'
      const merge = t > 2850 ? Math.min(1, (t - 2850) / 450) : 0
      if (t > 3280 && !fl) {
        fl = true
        if (MR) { boom = makeBoom(); shake(); setTimeout(shake, 260); audio.current.pop('rift', 9) } else { flash(0.85); audio.current.pop(RARITY_OF[best], 9) }
      }
      cr.forEach((c, j) => {
        const k = (t - c.t0) / 700
        if (k < 0 || (MR && t > 3330)) return
        if (!c.rang) { c.rang = true; audio.current.pop(RARITY_OF[c.k], j) } // tintement de chaque âme, plus aigu au fil des cartes
        const e = 1 - Math.pow(1 - Math.min(k, 1), 3), R = c.R * e * (1 - merge * merge), a = c.a + (1 - e) * 2.2 + t / 2600
        // traînée : la position de l'âme quelques instants plus tôt
        const trail: number[][] = []
        for (let q = 1; q <= 7; q++) {
          const tq = t - q * 22, kq = Math.max(0, (tq - c.t0) / 700)
          if (kq <= 0) break
          const eq = 1 - Math.pow(1 - Math.min(kq, 1), 3), Rq = c.R * eq * (1 - merge * merge), aq = c.a + (1 - eq) * 2.2 + tq / 2600
          trail.push([cx + Math.cos(aq) * Rq, cy + Math.sin(aq) * Rq * 0.62])
        }
        soulTrail(ctx, trail, c.k, t)
        soul(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.62, c.len * (0.4 + 0.6 * e) * (1 - merge * 0.6), c.k, c.k >= 3 ? 1 + 0.15 * Math.sin(t / 80) : 1, t, c.spin)
      })
      if (boom) boomDraw(ctx, boom, (t - 3300) / 1000, cx, cy, W, H)
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      if (t < T) requestAnimationFrame(f); else { if (MR) flash(0.8); startReveal() }
    }
    requestAnimationFrame(f)
  }

  const skip = () => { if (anim.current.view === 'seq') { audio.current.skip(); startReveal() } }

  /* ================= révélation ================= */
  const startReveal = () => {
    anim.current.seq++
    const cv = fxCv.current
    cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height)
    if (prog.current) prog.current.style.width = '0'
    anim.current.skyGlow = 1
    setI(0); setFlipped(false); setWhoOn(false); setHideUi(false); setView('rev')
  }

  const fx2 = () => { const cv = fx2Cv.current!; return sizeCanvas(cv) }
  const stopFx2 = () => { anim.current.rev++; const cv = fx2Cv.current; cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height) }
  // traînées de lumière aspirées vers la carte pendant le suspense
  const gather = (pl: Pull, rate: number) => {
    const ctx = fx2(), run = ++anim.current.rev, z = zone.current!.getBoundingClientRect(), cx = z.left + z.width / 2, cy = z.top + z.height / 2
    const pts: { x: number; y: number; v: number }[] = [], col = rgb(RARITY_RGB[pl.k])
    const f = () => {
      if (run !== anim.current.rev) return
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (let j = 0; j < rate; j++) { const a = Math.random() * 6.28, d = Math.max(innerWidth, innerHeight) * 0.55; pts.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, v: 0 }) }
      ctx.globalCompositeOperation = 'lighter'
      for (let j = pts.length - 1; j >= 0; j--) {
        const q = pts[j]; q.v += 0.6
        const dx = cx - q.x, dy = cy - q.y, L = Math.hypot(dx, dy)
        if (L < 30) { pts.splice(j, 1); continue }
        const ox = q.x, oy = q.y; q.x += (dx / L) * q.v * 2; q.y += (dy / L) * q.v * 2
        ctx.globalAlpha = Math.min(1, (600 - L) / 300 + 0.3)
        ctx.strokeStyle = pl.k === 4 ? `hsl(${(j * 37 + performance.now() / 4) % 360},100%,70%)` : `rgb(${col})`
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(q.x, q.y); ctx.stroke()
      }
      ctx.globalAlpha = 1; requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }
  // après l'explosion MR : braises qui flottent autour de la carte tant qu'on reste dessus
  const embers = () => {
    anim.current.skyGlow = 0.7
    const ctx = fx2(), run = ++anim.current.rev, z = zone.current!.getBoundingClientRect(), cx = z.left + z.width / 2, cy = z.top + z.height / 2
    const E: { x: number; y: number; vy: number; vx: number; l: number; m: number; s: number }[] = []
    const f = () => {
      if (run !== anim.current.rev) return
      ctx.clearRect(0, 0, innerWidth, innerHeight); ctx.globalCompositeOperation = 'lighter'
      for (let j = 0; j < 3; j++) { const a = Math.random() * 6.28; E.push({ x: cx + Math.cos(a) * z.width * 0.6, y: cy + Math.sin(a) * z.height * 0.55, vy: -(40 + Math.random() * 90), vx: (Math.random() - 0.5) * 20, l: 0, m: 1.5 + Math.random() * 1.5, s: 1 + Math.random() * 2.5 }) }
      for (let j = E.length - 1; j >= 0; j--) {
        const e = E[j]; e.l += 1 / 60
        if (e.l > e.m) { E.splice(j, 1); continue }
        e.x += e.vx / 60 + Math.sin(e.l * 4 + j) * 0.4; e.y += e.vy / 60
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.s * 4); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgb(255,150,60)'); g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = 1 - e.l / e.m; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.s * 4, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1; requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }
  // éclats de lumière qui jaillissent de la carte au retournement
  const burst = (pl: Pull) => {
    if (pl.k >= 3) rays.current?.classList.add('is-on')
    if (pl.k >= 4) { flash(pl.k === 5 ? 0.85 : 0.6); shake() } else if (pl.k >= 2) flash(0.25)
    const count = [0, 10, 26, 50, 80, 120][pl.k]
    if (!count || !zone.current || !root.current || calm()) return
    const r = zone.current.getBoundingClientRect()
    for (let j = 0; j < count; j++) {
      const s = document.createElement('i'), a = Math.random() * 6.28, d = 80 + Math.random() * (120 + pl.k * 40), sz = 3 + Math.random() * 4
      const c = pl.k === 4 ? [[255, 110, 220], [110, 240, 255], [255, 230, 110]][j % 3] : RARITY_RGB[pl.k]
      s.className = 'rs__spark'
      s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${sz}px;height:${sz}px;background:rgb(${c.join(',')});color:rgb(${rgb(RARITY_RGB[pl.k])})`
      root.current.appendChild(s)
      s.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`, opacity: 0 }], { duration: 800 + Math.random() * 600, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => s.remove()
    }
  }

  const flipping = useRef(false)
  const flip = async () => {
    const c = cardEl.current
    if (!p || flipped || flipping.current || !c) return
    flipping.current = true
    c.classList.remove('is-in')
    const aura = c.querySelector('.rs-card__aura')!
    const v = vig.current!
    const still = calm()
    if (!still) {
      if (p.k === 1) { aura.classList.add('is-on'); await wait(300) }
      else if (p.k === 2) { aura.classList.add('is-on'); c.classList.add('t1'); await wait(650) }
      else if (p.k === 3) { v.classList.add('is-on'); aura.classList.add('is-on'); c.classList.add('t2'); gather(p, 3); await wait(1200) }
      else if (p.k === 4) { v.classList.add('is-on'); aura.classList.add('is-on', 'is-rainbow'); c.classList.add('t2'); gather(p, 6); audio.current.cutIn('legend'); await wait(900); c.classList.replace('t2', 't3'); await wait(700) }
      else if (p.k === 5) { // la cinématique MR
        v.classList.add('is-on'); anim.current.skyGlow = 0; setHideUi(true)
        c.classList.add('lift'); await wait(500)
        c.querySelector('.rs-cracks')?.classList.add('is-on')
        aura.classList.add('is-on'); gather(p, 4); audio.current.cutIn('rift')
        for (let b = 0; b < 3; b++) { restart(c, 'beat'); if (b === 2) shake(); await wait(480 - b * 80) }
        c.classList.add('t3'); gather(p, 12); await wait(700)
        stopFx2(); flash(1); c.classList.remove('t3', 'lift')
        // grande explosion rouge-orange sur le calque de révélation
        const ctx = fx2(), zr = zone.current!.getBoundingClientRect(), bx = zr.left + zr.width / 2, by = zr.top + zr.height / 2
        const B = makeBoom(); B.noCore = true; shake(); setTimeout(shake, 260); audio.current.pop('rift', 9)
        const run = ++anim.current.rev, st = performance.now()
        const f = () => {
          if (run !== anim.current.rev) return
          const s = (performance.now() - st) / 1000
          ctx.clearRect(0, 0, innerWidth, innerHeight); boomDraw(ctx, B, s + 0.18, bx, by, innerWidth, innerHeight)
          if (s < 2.2) requestAnimationFrame(f); else { ctx.clearRect(0, 0, innerWidth, innerHeight); setEdit(p.hero) } // puis l'edit du perso en plein écran
        }
        requestAnimationFrame(f)
      }
    }
    if (p.k < 5) stopFx2()
    c.classList.remove('t1', 't2', 't3'); aura.classList.remove('is-on')
    c.classList.add('is-flip')
    setTimeout(() => c.classList.add('is-half'), 170) // à mi-rotation : on cache le dos et on montre la face
    if (p.k < 5) audio.current.pop(p.hero.rarity, i)
    setTimeout(() => { burst(p); if (p.k < 5) v.classList.remove('is-on') }, 300)
    setFlipped(true)
    setTimeout(() => setWhoOn(true), p.k === 5 && !still ? 1400 : 0)
    setTimeout(() => { flipping.current = false }, p.k === 5 && !still ? 1600 : 350)
  }
  const afterEdit = () => { setEdit(null); setHideUi(false); embers() }

  const next = () => {
    if (flipping.current || edit) return
    stopFx2(); vig.current?.classList.remove('is-on'); rays.current?.classList.remove('is-on')
    cardEl.current?.classList.add('is-out')
    flipping.current = true
    setTimeout(() => {
      flipping.current = false
      if (i + 1 >= pulls.length) { setView('recap'); anim.current.skyGlow = 0.7 } else { setI(i + 1); setFlipped(false); setWhoOn(false) }
    }, 300)
  }
  const onCard = () => { if (!flipped) void flip(); else next() }
  const revealAll = () => { stopFx2(); vig.current?.classList.remove('is-on'); rays.current?.classList.remove('is-on'); setEdit(null); setHideUi(false); setView('recap'); anim.current.skyGlow = 0.7 }
  const swipe = useRef<number | null>(null)

  /* ================= récap & navigation ================= */
  // retour à la faille : on rejoue son arrivée SANS recréer l'écran (sinon la faille WebGL perd sa zone de dessin et disparaît)
  const backToHub = () => {
    stopFx2(); anim.current.skyGlow = 0; anim.current.dive = 0; anim.current.pull = 0; anim.current.pullTarget = 0
    flipping.current = false; setEdit(null); setHideUi(false); setPulls([]); setView('hub'); setBusy(false)
    if (portal.current) portal.current.style.transform = ''
    if (hubUi.current) hubUi.current.style.opacity = ''
    hubEl.current?.scrollTo({ top: 0 })
    restart(portal.current, 'is-intro')
    hubEl.current?.querySelectorAll<HTMLElement>('.rs__ui-item').forEach((e) => { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '' })
  }
  const again = () => { backToHub(); setTimeout(() => summonRef.current(), 350) }
  const summonRef = useRef(summon)
  summonRef.current = summon

  // clavier : Échap passe l'ouverture ou ferme ; Espace / Entrée retourne ou passe à la carte suivante
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined)
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { if (view === 'seq') skip(); else if (view === 'hub') onClose(); else if (view === 'rev' && !edit) revealAll() }
    if ((e.key === ' ' || e.key === 'Enter') && view === 'rev' && !edit) { e.preventDefault(); onCard() }
  }
  useEffect(() => { const k = (e: KeyboardEvent) => keyRef.current(e); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])

  // la faille : clic, ou écarter en glissant
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const pDown = (e: RPointerEvent<HTMLDivElement>) => { down.current = { x: e.clientX, y: e.clientY, moved: false }; portal.current?.classList.add('is-pressed'); e.currentTarget.setPointerCapture(e.pointerId) }
  const pMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d0 = down.current
    if (!d0) return
    const d = Math.hypot(e.clientX - d0.x, e.clientY - d0.y)
    if (d > 8) { d0.moved = true; portal.current?.classList.remove('is-pressed') }
    anim.current.pullTarget = Math.min(1, d / 160)
    if (anim.current.pullTarget >= 1) { down.current = null; anim.current.pullTarget = 0; summon() }
  }
  const pUp = () => { const d0 = down.current; if (!d0) return; portal.current?.classList.remove('is-pressed'); down.current = null; anim.current.pullTarget = 0; if (!d0.moved) summon() }
  const pCancel = () => { down.current = null; anim.current.pullTarget = 0; portal.current?.classList.remove('is-pressed') }

  const style = { ['--acc' as string]: rgb(c1), ['--acc2' as string]: rgb(c2) } as CSSProperties
  const bi = pulls.reduce((b, x, j) => (x.k > pulls[b].k ? j : b), 0)
  let order = pulls.map((_, j) => j)
  if (pulls.length === 10) { order = order.filter((j) => j !== bi); order.splice(2, 0, bi) }
  const nNew = pulls.filter((x) => !x.dup).length
  const cost = (q: number) => <>{pay === 'ticket' ? q : q * COST.gems}<Coin name={pay === 'ticket' ? 'seal' : 'soul'} size={18} /></>
  const rc = p ? rgb(RARITY_RGB[p.k]) : rgb(c1)

  return createPortal(
    <div ref={root} className={`rs rs--${view}`} style={style} role="dialog" aria-modal="true" aria-label={`Invocation · ${banner.world}`}>
      <canvas ref={skyCv} className="rs__sky" aria-hidden="true" />
      <div ref={topline} className="rs__topline" />
      <div ref={flashEl} className="rs__flash" />

      {/* ═══ la faille au repos ═══ */}
      <section ref={hubEl} className={`rs__scr rs__hub ${view === 'hub' ? 'is-on' : ''}`} aria-hidden={view !== 'hub'}>
        <div className="rs__top rs__ui-item">
          <button className="rs__back" onClick={onClose}>‹ Bannières</button>
          <h1 className="rs__cap"><span lang="ja">{banner.glyph}</span> {banner.world}</h1>
          <button className={`rs__fav ${fav ? 'is-on' : ''}`} aria-pressed={fav} aria-label="Bannière favorite" onClick={() => { toggleFav(banner.id, !fav); setFav(!fav) }}>★</button>
        </div>
        <p className="rs__mono rs__tag rs__ui-item">✦ MR {(RARITIES.rift.rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} % · Bannière limitée pendant <b>{leftOf(banner.endsAt)}</b></p>
        <div className="rs__stage">
          <div ref={portal} className="rs__portal is-intro" role="button" tabIndex={0} aria-label="Ouvrir la faille"
            onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pCancel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); summon() } }}>
            <span className="rs__glow" /><canvas ref={riftCv} />
          </div>
        </div>
        <div ref={hubUi} className="rs__ui">
          <p className="rs__hint rs__ui-item">Touche la faille ou écarte-la pour l'ouvrir</p>
          <div className="rs__ctrl rs__ui-item">
            <div className="rs__seg" role="radiogroup" aria-label="Quantité">{[1, 5, 10].map((q) => <button key={q} role="radio" aria-checked={n === q} className={n === q ? 'is-on' : ''} onClick={() => setN(q)}>×{q}</button>)}</div>
            <div className="rs__seg rs__pay" role="radiogroup" aria-label="Moyen de paiement">
              <button role="radio" aria-checked={pay === 'ticket'} className={pay === 'ticket' ? 'is-on' : ''} onClick={() => setPay('ticket')}><Coin name="seal" size={20} />Clés <i>{store.tickets}</i></button>
              <button role="radio" aria-checked={pay === 'gems'} className={pay === 'gems' ? 'is-on' : ''} onClick={() => setPay('gems')}><Coin name="soul" size={20} />Éclats <i>{store.gems}</i></button>
            </div>
          </div>
          <button className="rs__open rs__ui-item" disabled={!can || busy} onClick={summon}>Ouvrir <span>{cost(n)}</span></button>
          {!can && <p className="rs__poor rs__ui-item">Pas assez de {pay === 'ticket' ? 'clés' : 'Éclats'} pour ×{n}.</p>}
          <div className="rs__pity rs__ui-item">
            <div><span>Garantie SSR</span><b>{pity}<i> / {PITY_MAX}</i></b><div className="rs__bar"><i style={{ width: `${Math.max(2, (pity / PITY_MAX) * 100)}%` }} /></div></div>
            <div><span>Grande garantie MR</span><b>{multis}<i> / {BIG_PITY} multis</i></b><div className="rs__bar rs__bar--mr"><i style={{ width: `${Math.max(2, (multis / BIG_PITY) * 100)}%` }} /></div></div>
          </div>
          <button className="rs__more rs__ui-item" onClick={() => document.querySelector('.rs__cards')?.scrollIntoView({ behavior: 'smooth' })}>Les cartes de la bannière ▾</button>
        </div>

        {/* ═══ en descendant : les cartes de la bannière et ses « plus » ═══ */}
        <div className="rs__cards">
          <header className="rs__chead">
            <span className="rs__cglyph" lang="ja">{banner.glyph}</span>
            <div><p>Bannière limitée · {banner.world}</p><h2>Les cartes de la bannière</h2><small>{pool.length} cartes mises en avant. Touche une carte pour ouvrir sa fiche.</small></div>
            <div className="rs__cend"><small>Se termine dans</small><b>{leftOf(banner.endsAt)}</b></div>
          </header>
          {banner.featured.map((id) => {
            const h = heroById(id)
            return (
              <article key={id} className="rs__head">
                <div className="rs__headcard"><Card hero={h} /></div>
                <div>
                  <p className="rs__kick">Tête d'affiche · {RARITIES[h.rarity].short}</p>
                  <h3>{h.name} <i>({h.title})</i></h3>
                  <p className="rs__desc">{isLocal(h.rarity) ? 'L’une des cartes les plus rares du jeu. Elle ne tombe que sur cette bannière, en plus des cartes habituelles.' : 'Une carte à l’affiche de cette bannière.'} {store.owned[id] ? `Tu en possèdes ${store.owned[id]}.` : 'Tu ne la possèdes pas encore.'}</p>
                  <ul className="rs__facts">
                    <li><b>{pct(cardRate(banner, h))}</b><span>par carte invoquée</span></li>
                    <li><b>Animée</b><span>cadre et effets en mouvement</span></li>
                    <li><b>Invocation {RARITIES[h.rarity].short}</b><span>son animation dédiée si elle tombe</span></li>
                  </ul>
                </div>
              </article>
            )
          })}
          {RARITY_ORDER.map((rid) => {
            const cards = pool.filter((h) => h.rarity === rid)
            if (!cards.length) return null
            const rates = [...new Set(cards.map((h) => pct(cardRate(banner, h))))]
            return (
              <div key={rid} className="rs__group" style={{ ['--rc' as string]: RARITIES[rid].color }}>
                <header><i /><b>{RARITIES[rid].short}</b><span>{cards.length} carte{cards.length > 1 ? 's' : ''} · {rates.length === 1 ? `${rates[0]}${cards.length > 1 ? ' chacune' : ''}` : `${pct(RARITIES[rid].rate)} en tout`}</span></header>
                <div className="rs__ggrid">{cards.map((h) => (
                  <figure key={h.id}>
                    {isLocal(h.rarity) && <span className="rs__excl">Exclusive</span>}
                    <Card hero={h} />
                    <figcaption>{pct(cardRate(banner, h))}{store.owned[h.id] ? <> · <em>obtenue</em></> : null}</figcaption>
                  </figure>
                ))}</div>
              </div>
            )
          })}
          <h2 className="rs__plustitle">Les plus de la bannière</h2>
          <div className="rs__plus">
            <section><h3>Grande garantie MR</h3><div className="rs__bar rs__bar--mr"><i style={{ width: `${Math.max(2, (multis / BIG_PITY) * 100)}%` }} /></div>
              <p><b>{multis} / {BIG_PITY}</b> multi-invocations ×10. Au {BIG_PITY}e ×10 sans MR, une MR de {banner.world} tombe à coup sûr{star ? ` (souvent ${star.name})` : ''}.</p>
              <p><b>{pity} / {PITY_MAX}</b> invocations avant une SSR, LR ou MR garantie.</p></section>
            <section><h3>Taux par carte</h3><ul className="rs__rates">{RARITY_ORDER.map((rid) => <li key={rid}><span>{RARITIES[rid].short}</span><b>{pct(RARITIES[rid].rate, 2)}</b></li>)}</ul>
              <button className="rs__ghost" onClick={() => document.querySelector('.rs__group')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Index de la bannière</button></section>
            <section><h3>Ticket LR</h3><p>Le parrainage offre des tickets LR : une carte LR garantie, tirée au hasard. Tu en as <b>{store.items?.lr ?? 0}</b>.</p>
              <button className="rs__ghost" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('anime-rift:community', { detail: 'referral' })) }}>Voir le parrainage ↗</button></section>
            <section><h3>Raid · {banner.subtitle}</h3><p>Les raids et le boss mondial se jouent dans « Jouer », avec leurs récompenses propres.</p>
              <button className="rs__ghost" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'play' })) }}>Accéder au raid ↗</button></section>
          </div>
        </div>
      </section>

      {/* ═══ ouverture ═══ */}
      <section className={`rs__scr rs__seq ${view === 'seq' ? 'is-on' : ''}`} aria-hidden={view !== 'seq'}>
        <canvas ref={fxCv} className="rs__fx" />
        <button className="rs__skip" onClick={skip}>PASSER ›</button>
        <i ref={prog} className="rs__prog" />
      </section>

      {/* ═══ révélation carte par carte ═══ */}
      <section className={`rs__scr rs__rev ${view === 'rev' ? 'is-on' : ''} ${hideUi ? 'is-bare' : ''}`} aria-hidden={view !== 'rev'}>
        <div ref={vig} className="rs__vig" />
        <div className="rs__cnt">{i + 1}<small>/{pulls.length}</small></div>
        <div ref={zone} className="rs__zone" style={{ ['--rc' as string]: rc }}>
          <div ref={rays} className="rs__rays" />
          {view === 'rev' && p && (
            <div ref={cardEl} key={i} className="rs-card is-in" style={{ ['--rc' as string]: rc }} role="button" tabIndex={0} aria-label={flipped ? `${p.hero.name}, carte suivante` : 'Retourner la carte'}
              onClick={onCard} onPointerDown={(e) => { swipe.current = e.clientX }} onPointerUp={(e) => { if (swipe.current !== null && flipped && swipe.current - e.clientX > 50) next(); swipe.current = null }}>
              <div className="rs-card__aura" />
              <div className={`rs-card__face rs-card__back ${p.k >= 3 ? 'is-hot' : ''}`}>
                <div className="rs-card__ring"><img src={LOGO} alt="" /></div>
                <span className="rs-card__sheen" />
                {p.k === 5 && <svg className="rs-cracks" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true">{CRACK.map((d) => <path key={d} pathLength={1} d={d} />)}</svg>}
              </div>
              <div className="rs-card__face rs-card__front"><Card hero={p.hero} hd inert /></div>
            </div>
          )}
        </div>
        <div className={`rs__who ${whoOn && p ? 'is-on' : ''}`}>
          <h2>{p?.hero.name}</h2>
          <p>{p?.hero.world} · {p && (p.dup ? `Doublon ×${p.dup + 1}` : <em>Nouvelle carte</em>)} · {p && RARITIES[p.hero.rarity].short}</p>
        </div>
        <div className="rs__strip">{pulls.map((x, j) => (
          <i key={j} className={`${j === i ? 'is-cur' : ''} ${j < i || (j === i && flipped) ? 'is-done' : ''}`} style={{ ['--rc' as string]: rgb(RARITY_RGB[x.k]), backgroundImage: j < i || (j === i && flipped) ? `url("${store.customArt[x.hero.id] ?? store.remoteArt[x.hero.id] ?? heroArt(x.hero.model, 'full')}")` : undefined }} />
        ))}</div>
        <div className="rs__revbar">
          <span>{!flipped ? 'Touche la carte pour la retourner' : i === pulls.length - 1 ? 'Touche pour voir le récapitulatif' : 'Touche ou glisse pour la suivante'}</span>
          <button className="rs__ghost" onClick={revealAll}>Tout révéler</button>
        </div>
      </section>

      {/* ═══ récapitulatif ═══ */}
      <section className={`rs__scr rs__recap ${view === 'recap' ? 'is-on' : ''}`} aria-hidden={view !== 'recap'}>
        <h1 className="rs__cap">{banner.world}</h1>
        <span className="rs__sum">{nNew} nouvelle{nNew > 1 ? 's' : ''} carte{nNew > 1 ? 's' : ''}{pulls.length - nNew ? `, ${pulls.length - nNew} doublon${pulls.length - nNew > 1 ? 's' : ''}` : ''}</span>
        {view === 'recap' && (
          <div className="rs__grid" style={{ gridTemplateColumns: `repeat(${Math.min(5, pulls.length)}, minmax(0, 150px))` }}>
            {order.map((j, k) => {
              const x = pulls[j], row2 = pulls.length === 10 && k >= 5
              return (
                <div key={j} className={`rs__mini ${j === bi && pulls.length > 1 ? 'is-best' : ''}`} style={{ animationDelay: `${k * 0.05 + (x.k >= 3 ? 0.25 : 0)}s`, rotate: row2 ? `${(k - 7) * 2.5}deg` : undefined }}>
                  <span className={`rs__lab ${x.dup ? 'is-dup' : ''}`}>{x.dup ? `DOUBLE ×${x.dup + 1}` : 'NOUVEAU'}</span>
                  <Card hero={x.hero} />
                </div>
              )
            })}
          </div>
        )}
        <div className="rs__acts">
          <button className="rs__open" disabled={!can} onClick={again}>Réinvoquer ×{n} <span>{cost(n)}</span></button>
          <button className="rs__ghost" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('anime-rift:go', { detail: 'collection' })) }}>Ma collection</button>
          <button className="rs__ghost" onClick={backToHub}>Fermer</button>
        </div>
      </section>

      <canvas ref={fx2Cv} className="rs__fx2" aria-hidden="true" />
      {edit && <div className="rs__edit"><MrEdit hero={edit} art={store.customArt[edit.id] ?? store.remoteArt[edit.id] ?? heroArt(edit.model, 'full')} onDone={afterEdit} /></div>}
    </div>,
    document.body,
  )
}
