// Effets animés des cadres MR (d'après le script « MR Card FX » fourni) : particules propres à chaque univers,
// dessinées dans un canvas posé sur la carte. Seulement sur la carte affichée en grand, pour ne pas peser sur les grilles.
type Fx = [kind: string, rate: number, color: string]
export const MR_THEMES: Record<string, { glow: string; fx: Fx[] }> = {
  naruto: { glow: '#ff7a00', fx: [['ember', 34, '#ff8a1c'], ['ember', 10, '#ffd27a'], ['swirl', 1.2, '#ff9a2e'], ['spark', 5, '#fff1d6']] },
  onepiece: { glow: '#ff3b30', fx: [['drop', 16, '#59b8ff'], ['coin', 2.2, '#ffd35a'], ['ember', 8, '#ff4433'], ['spark', 5, '#fff6d8']] },
  dragonball: { glow: '#ffc400', fx: [['aura', 46, '#ffcc22'], ['bolt', 3.5, '#79d4ff'], ['spark', 6, '#fffbe0']] },
  bleach: { glow: '#bfe3ff', fx: [['slash', 0.9, '#cfeaff'], ['ink', 10, '#0b0b10'], ['spark', 7, '#eaf6ff']] },
  demonslayer: { glow: '#2fd3a0', fx: [['petal', 9, '#ffb3cf'], ['bubble', 10, '#6cc8ff'], ['emberR', 18, '#ff6a1a'], ['spark', 4, '#e9fff7']] },
  jujutsu: { glow: '#9b4dff', fx: [['smoke', 22, '#7a2cff'], ['ember', 14, '#c69bff'], ['spark', 4, '#efe2ff']] },
  hunter: { glow: '#3dff7a', fx: [['suit', 2.4, '#ffe08a'], ['aura', 26, '#4dff8a'], ['spark', 6, '#f1ffe0']] },
}

type P = { kind: string; col: string; x: number; y: number; life: number; s: number; max: number; vx?: number; vy?: number; r?: number; rot?: number; vr?: number; g?: string; pts?: [number, number][]; cx?: number; cy?: number; R?: number; a?: number }
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
// Le canvas déborde de la carte : la carte occupe 20 %..80 % de sa largeur utile (voir .card__mrfx dans rift.css).
const CX0 = 0.2 / 1.4, CX1 = 1.2 / 1.4, CY0 = 0.14 / 1.28, CY1 = 1.14 / 1.28

const edgePoint = (side?: number): [number, number, number] => {
  const s = side ?? Math.floor(Math.random() * 4), t = Math.random(), b = rnd(0, 0.1)
  let u: number, v: number
  if (s === 0) { u = t; v = b } else if (s === 1) { u = 1 - b; v = t } else if (s === 2) { u = t; v = 1 - b } else { u = b; v = t }
  return [CX0 + u * (CX1 - CX0), CY0 + v * (CY1 - CY0), s]
}

const spawn = (kind: string, col: string, W: number, H: number): P => {
  const S = W / 600
  const side = kind === 'emberR' ? (Math.random() < 0.6 ? 1 : Math.random() < 0.5 ? 0 : 2) : kind === 'bubble' ? (Math.random() < 0.6 ? 3 : Math.random() < 0.5 ? 0 : 2) : undefined
  const [ex, ey, s] = edgePoint(side)
  const p: P = { kind, col, x: ex * W, y: ey * H, life: 0, s: S, max: 1 }
  switch (kind) {
    case 'ember': case 'emberR': p.vx = rnd(-15, 15) * S; p.vy = rnd(-70, -30) * S; p.r = rnd(1.2, 3.2) * S; p.max = rnd(1, 2.2); break
    case 'aura': p.vx = rnd(-8, 8) * S; p.vy = rnd(-160, -80) * S; p.r = rnd(2, 6) * S; p.max = rnd(0.4, 0.9); break
    case 'spark': p.r = rnd(6, 16) * S; p.max = rnd(0.5, 1.1); break
    case 'drop': p.vx = rnd(-40, 40) * S; p.vy = rnd(-120, -40) * S; p.r = rnd(1.5, 4) * S; p.max = rnd(1, 1.8); break
    case 'bubble': p.vx = rnd(-6, 6) * S; p.vy = rnd(-50, -20) * S; p.r = rnd(2, 6) * S; p.max = rnd(1.4, 2.6); break
    case 'coin': p.r = rnd(5, 9) * S; p.max = rnd(0.8, 1.3); break
    case 'petal': p.x = rnd(0, W); p.y = -10; p.vx = rnd(10, 40) * S; p.vy = rnd(30, 60) * S; p.r = rnd(4, 7) * S; p.rot = rnd(0, 6); p.vr = rnd(-3, 3); p.max = rnd(4, 7); break
    case 'ink': p.vx = rnd(-10, 10) * S; p.vy = rnd(10, 35) * S; p.r = rnd(2, 6) * S; p.max = rnd(1.2, 2.2); break
    case 'smoke': p.vx = rnd(-10, 10) * S; p.vy = rnd(-45, -15) * S; p.r = rnd(10, 22) * S; p.max = rnd(1.5, 2.8); break
    case 'suit': p.vx = rnd(-8, 8) * S; p.vy = rnd(-40, -20) * S; p.r = rnd(10, 16) * S; p.g = '♠♥♦♣'[Math.floor(Math.random() * 4)]; p.rot = rnd(-0.4, 0.4); p.max = rnd(1.8, 2.8); break
    case 'bolt': {
      p.max = rnd(0.12, 0.25)
      const horiz = s === 0 || s === 2, len = rnd(0.15, 0.3) * (horiz ? W : H), pts: [number, number][] = []
      for (let i = 0, n = 9; i <= n; i++) { const t = i / n; pts.push(horiz ? [p.x - len / 2 + t * len, p.y + rnd(-12, 12) * S] : [p.x + rnd(-12, 12) * S, p.y - len / 2 + t * len]) }
      p.pts = pts; break
    }
    case 'slash': p.max = 0.7; p.cx = rnd(0.3, 0.7) * W; p.cy = rnd(0.3, 0.7) * H; p.R = rnd(0.25, 0.4) * W; p.a = rnd(0, 6.28); break
    case 'swirl': p.max = 1.6; p.cx = (Math.random() < 0.5 ? CX0 + 0.05 : CX1 - 0.05) * W; p.cy = (Math.random() < 0.5 ? CY0 + 0.05 : CY1 - 0.05) * H; break
  }
  return p
}

const draw = (ctx: CanvasRenderingContext2D, p: P, dt: number) => {
  p.life += dt
  const k = p.life / p.max
  if (k >= 1) return false
  const fade = Math.sin(Math.PI * Math.min(k, 1))
  if (p.vx !== undefined && p.vy !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt }
  const r0 = p.r ?? 1
  ctx.save()
  switch (p.kind) {
    case 'ember': case 'emberR': case 'aura': {
      p.vx = (p.vx ?? 0) + rnd(-30, 30) * dt * p.s; ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r0 * 3)
      g.addColorStop(0, '#fff'); g.addColorStop(0.3, p.col); g.addColorStop(1, 'transparent')
      ctx.globalAlpha = fade; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r0 * 3, 0, 7); ctx.fill(); break
    }
    case 'spark': case 'coin': {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade; ctx.strokeStyle = p.col; ctx.lineWidth = 1.5 * p.s
      const r = r0 * fade
      ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r * 1.4); ctx.lineTo(p.x, p.y + r * 1.4); ctx.stroke()
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0.1, r * 0.6)); g.addColorStop(0, '#fff'); g.addColorStop(1, 'transparent')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, r * 0.6), 0, 7); ctx.fill(); break
    }
    case 'drop': case 'bubble': {
      if (p.kind === 'drop') p.vy = (p.vy ?? 0) + 260 * dt * p.s
      ctx.globalAlpha = fade * 0.9; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, r0, 0, 7); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(p.x - r0 * 0.35, p.y - r0 * 0.35, r0 * 0.35, 0, 7); ctx.fill()
      break
    }
    case 'petal': {
      p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt; p.vx = (p.vx ?? 0) + Math.sin(p.life * 2) * 8 * dt
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, fade * 2) * 0.9; ctx.fillStyle = p.col
      ctx.beginPath(); ctx.ellipse(0, 0, r0, r0 * 0.55, 0, 0, 7); ctx.fill(); break
    }
    case 'ink': ctx.globalAlpha = fade * 0.8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, r0 * (1 - k * 0.5), 0, 7); ctx.fill(); break
    case 'smoke': {
      ctx.globalCompositeOperation = 'lighter'
      const r = r0 * (1 + k * 1.5)
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, p.col + '66'); g.addColorStop(1, 'transparent')
      ctx.globalAlpha = fade * 0.8; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); break
    }
    case 'suit': {
      ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0); ctx.globalAlpha = fade; ctx.font = `bold ${r0 * 2}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#3dff7a'; ctx.shadowBlur = 12 * p.s
      ctx.fillStyle = p.g === '♥' || p.g === '♦' ? '#ff5a6a' : p.col; ctx.fillText(p.g ?? '♠', 0, 0); break
    }
    case 'bolt': {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.random() < 0.3 ? 0.3 : 1
      ctx.shadowColor = p.col; ctx.shadowBlur = 14 * p.s; ctx.strokeStyle = '#eaf8ff'; ctx.lineWidth = 2 * p.s
      ctx.beginPath(); (p.pts ?? []).forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke()
      ctx.strokeStyle = p.col; ctx.lineWidth = 5 * p.s; ctx.globalAlpha *= 0.4; ctx.stroke(); break
    }
    case 'slash': {
      ctx.globalCompositeOperation = 'lighter'
      const sweep = Math.min(1, k * 2.2) * 2.2
      ctx.shadowColor = p.col; ctx.shadowBlur = 25 * p.s; ctx.strokeStyle = p.col; ctx.globalAlpha = 1 - k
      ctx.lineWidth = 10 * p.s * (1 - k); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(p.cx ?? 0, p.cy ?? 0, p.R ?? 1, p.a ?? 0, (p.a ?? 0) + sweep); ctx.stroke()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * p.s * (1 - k); ctx.stroke(); break
    }
    case 'swirl': {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * p.s
      ctx.shadowColor = p.col; ctx.shadowBlur = 12 * p.s; ctx.beginPath()
      for (let i = 0; i < 80; i++) { const t = i / 80, a = t * 12 + p.life * 6, r = (1 - t) * 40 * p.s * (0.5 + k); const X = (p.cx ?? 0) + Math.cos(a) * r, Y = (p.cy ?? 0) + Math.sin(a) * r; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y) }
      ctx.stroke(); break
    }
  }
  ctx.restore()
  return true
}

// Lance l'animation dans le canvas ; renvoie la fonction qui l'arrête.
export const startMrFx = (cv: HTMLCanvasElement, theme: string) => {
  const T = MR_THEMES[theme]
  const ctx = cv.getContext('2d')
  if (!T || !ctx) return () => {}
  let parts: P[] = [], last = performance.now(), raf = 0, visible = true
  const acc = T.fx.map(() => 0)
  const resize = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d) }
  const ro = new ResizeObserver(resize); ro.observe(cv); resize()
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting }); io.observe(cv)
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    if (visible && cv.width) {
      ctx.clearRect(0, 0, cv.width, cv.height)
      T.fx.forEach(([kind, rate, col], i) => { acc[i] += rate * dt; while (acc[i] >= 1) { acc[i]--; parts.push(spawn(kind, col, cv.width, cv.height)) } })
      parts = parts.filter((p) => draw(ctx, p, dt))
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); parts = [] }
}
