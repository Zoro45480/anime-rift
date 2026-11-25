import { useEffect, useRef } from 'react'

type Star = { x: number; y: number; z: number; tw: number }
type Shard = { x: number; y: number; size: number; rot: number; vr: number; vy: number; hue: number; pts: number[] }
type Mote = { t: number; off: number; speed: number; life: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// Tracé de la faille : une ligne brisée verticale, en coordonnées 0..1.
const buildCrack = () => {
  const pts: [number, number][] = []
  let x = 0.62
  for (let i = 0; i <= 14; i++) {
    const y = -0.05 + (i / 14) * 1.1
    x += rand(-0.035, 0.035)
    pts.push([x, y])
  }
  return pts
}

// Fond animé commun à tout le jeu : nébuleuse, étoiles, faille lumineuse, éclats.
export const RiftBackground = ({ intensity = 1 }: { intensity?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let raf = 0
    const crack = buildCrack()
    const stars: Star[] = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), tw: rand(0, 6.28) }))
    const shards: Shard[] = Array.from({ length: 16 }, () => ({
      x: rand(0.35, 0.9), y: Math.random(), size: rand(8, 34), rot: rand(0, 6.28), vr: rand(-0.3, 0.3), vy: rand(0.004, 0.014),
      hue: Math.random() < 0.5 ? 265 : 186,
      pts: Array.from({ length: 4 }, (_, i) => rand(0.5, 1) * (i % 2 ? 1 : 0.7)),
    }))
    const motes: Mote[] = Array.from({ length: 70 }, () => ({ t: Math.random(), off: 0, speed: rand(0.02, 0.07), life: Math.random() }))

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const crackAt = (t: number): [number, number] => {
      const f = t * (crack.length - 1)
      const i = Math.min(crack.length - 2, Math.floor(f))
      const k = f - i
      return [(crack[i][0] + (crack[i + 1][0] - crack[i][0]) * k) * w, (crack[i][1] + (crack[i + 1][1] - crack[i][1]) * k) * h]
    }

    const strokeCrack = (width: number, style: string, blur: number) => {
      ctx.beginPath()
      crack.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)))
      ctx.lineWidth = width
      ctx.strokeStyle = style
      ctx.shadowColor = style
      ctx.shadowBlur = blur
      ctx.lineJoin = 'miter'
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const time = now / 1000

      const bg = ctx.createLinearGradient(0, 0, w, h)
      bg.addColorStop(0, '#04050d')
      bg.addColorStop(0.55, '#0b0d28')
      bg.addColorStop(1, '#150a33')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Nébuleuses
      const blobs: [number, number, number, string][] = [
        [0.62 + Math.sin(time * 0.1) * 0.02, 0.45, 0.55, 'rgba(110,60,255,0.30)'],
        [0.8, 0.2 + Math.cos(time * 0.13) * 0.03, 0.4, 'rgba(40,200,255,0.16)'],
        [0.15, 0.85, 0.45, 'rgba(70,40,190,0.20)'],
      ]
      ctx.globalCompositeOperation = 'lighter'
      for (const [bx, by, br, col] of blobs) {
        const g = ctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * Math.max(w, h))
        g.addColorStop(0, col)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }

      // Étoiles
      for (const s of stars) {
        const a = (0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + s.tw))) * s.z
        ctx.fillStyle = `rgba(215,225,255,${a})`
        ctx.fillRect(s.x * w, s.y * h, s.z * 1.6, s.z * 1.6)
      }

      // Faille : halo violet, cœur cyan, fil blanc
      const pulse = 0.75 + 0.25 * Math.sin(time * 1.7)
      strokeCrack(26 * intensity, `rgba(139,92,255,${0.16 * pulse})`, 60)
      strokeCrack(7 * intensity, `rgba(62,240,255,${0.5 * pulse})`, 30)
      strokeCrack(1.6, 'rgba(246,248,255,0.95)', 12)

      // Particules aspirées le long de la faille
      for (const m of motes) {
        if (!reduce) { m.life += dt * 0.35; m.off += dt * m.speed * 900 }
        if (m.life > 1) { m.life = 0; m.off = 0; m.t = Math.random() }
        const [cx, cy] = crackAt(m.t)
        const side = m.speed > 0.045 ? 1 : -1
        const a = Math.sin(m.life * Math.PI)
        ctx.fillStyle = `rgba(143,247,255,${a * 0.9})`
        ctx.beginPath()
        ctx.arc(cx + side * m.off * 0.25, cy - m.off * 0.1, 1.4, 0, 6.28)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // Éclats de verre dimensionnel
      for (const s of shards) {
        if (!reduce) { s.y -= s.vy * dt * 3; s.rot += s.vr * dt }
        if (s.y < -0.1) s.y = 1.1
        ctx.save()
        ctx.translate(s.x * w, s.y * h)
        ctx.rotate(s.rot)
        ctx.beginPath()
        s.pts.forEach((r, i) => {
          const ang = (i / s.pts.length) * 6.28
          const px = Math.cos(ang) * r * s.size
          const py = Math.sin(ang) * r * s.size * 1.6
          if (i) ctx.lineTo(px, py)
          else ctx.moveTo(px, py)
        })
        ctx.closePath()
        const g = ctx.createLinearGradient(-s.size, -s.size, s.size, s.size)
        g.addColorStop(0, `hsla(${s.hue},100%,75%,0.28)`)
        g.addColorStop(1, `hsla(${s.hue},100%,60%,0.03)`)
        ctx.fillStyle = g
        ctx.fill()
        ctx.strokeStyle = `hsla(${s.hue},100%,85%,0.45)`
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.restore()
      }

      // Vignette
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(2,2,8,0.75)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [intensity])

  return <canvas ref={ref} className="rift-bg" aria-hidden="true" />
}
