// Outil de production : modélise et rend en 3D le cadre des cartes pour chaque rareté, sur fond transparent.
// La carte mesure 5 × 7 unités ; l'image couvre 7.2 × 9.2 (marge de 1.1 pour les ornements qui débordent).
// Usage (voir tools/render-frames.cjs) : /frames.html?r=rare|epic|legend|rift
import * as THREE from 'three'

const rarity = new URLSearchParams(location.search).get('r') ?? 'rift'
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight)
renderer.setClearColor(0x000000, 0)
document.body.appendChild(renderer.domElement)

// Studio de reflets : fond sombre et panneaux lumineux, pour que le métal accroche des bandes nettes.
const studio = (accent: number) => {
  const s = new THREE.Scene()
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x4a4c5e, side: THREE.BackSide })))
  const panel = (color: number, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  panel(0xffffff, 26, 9, 0, 22, 12)
  panel(0xdfe8ff, 6, 30, -24, 2, 10)
  panel(0xfff1d8, 5, 24, 24, -4, 12)
  panel(accent, 22, 6, 4, -22, 10)
  panel(0xffffff, 8, 8, 6, 8, 30)
  return s
}

const ACCENT: Record<string, number> = { rare: 0x6fa8ff, epic: 0xb06bff, legend: 0xffc0e8, rift: 0xff2040 }
const scene = new THREE.Scene()
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(ACCENT[rarity]), 0.01).texture
scene.environmentIntensity = 1.5
const camera = new THREE.OrthographicCamera(-3.6, 3.6, 4.6, -4.6, 0.1, 50)
camera.position.set(0, 0, 10)
const key = new THREE.DirectionalLight(0xffffff, 1.6)
key.position.set(-3, 5, 6)
scene.add(key)

const roundRect = (ctx: THREE.Shape | THREE.Path, w: number, h: number, r: number) => {
  ctx.moveTo(-w + r, -h)
  ctx.lineTo(w - r, -h)
  ctx.quadraticCurveTo(w, -h, w, -h + r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(-w + r, h)
  ctx.quadraticCurveTo(-w, h, -w, h - r)
  ctx.lineTo(-w, -h + r)
  ctx.quadraticCurveTo(-w, -h, -w + r, -h)
}

// Moulure du cadre : un jonc bombé qui suit un rectangle arrondi (centre de la bande), pour accrocher la lumière.
const molding = (outW: number, outH: number, band: number, mat: THREE.Material, z = 0) => {
  const w = outW - band / 2
  const h = outH - band / 2
  const r = 0.3
  const pts: THREE.Vector3[] = []
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (i / 10) * (Math.PI / 2)
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
    }
  }
  const side = (x0: number, y0: number, x1: number, y1: number) => {
    for (let i = 1; i < 12; i++) pts.push(new THREE.Vector3(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12, 0))
  }
  arc(w - r, h - r, 0)
  side(w - r, h, -w + r, h)
  arc(-w + r, h - r, Math.PI / 2)
  side(-w, h - r, -w, -h + r)
  arc(-w + r, -h + r, Math.PI)
  side(-w + r, -h, w - r, -h)
  arc(w - r, -h + r, Math.PI * 1.5)
  side(w, -h + r, w, h - r)
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1), 400, band / 2, 18, true), mat)
  m.scale.z = 0.75
  m.position.z = z
  return m
}

const metal = (color: number, roughness = 0.1, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, ...extra })
const crystal = (color: number, emissive: number, glow = 0.55) =>
  new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: glow, metalness: 0.55, roughness: 0.08, clearcoat: 1, flatShading: true })

// Dégradé arc-en-ciel pastel appliqué au métal de la carte LR (effet holographique).
const rainbow = () => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 256, 256)
  ;['#ffe27a', '#ff9ad5', '#b79bff', '#7fd9ff', '#8dffc4', '#ffe27a', '#ffa07a', '#ff9ad5'].forEach((col, i, a) => grad.addColorStop(i / (a.length - 1), col))
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.16, 0.12)
  return t
}

// Lame de cristal à facettes : base à l'origine, pointe à `len` dans la direction `angle` (radians).
const blade = (x: number, y: number, angle: number, len: number, width: number, mat: THREE.Material, z = 0.2) => {
  const g = new THREE.ConeGeometry(width * 1.9, len * 1.15, 4)
  g.rotateY(Math.PI / 4)
  g.translate(0, (len * 1.15) / 2, 0)
  const m = new THREE.Mesh(g, mat)
  m.scale.z = 0.55
  m.position.set(x, y, z)
  m.rotation.z = angle - Math.PI / 2
  scene.add(m)
}
const deg = (d: number) => (d * Math.PI) / 180

// Couronne de lames en éventail à chaque coin, la plus longue sur la diagonale.
const cornerFans = (lengths: number[], spreadDeg: number, width: number, mats: THREE.Material[], offset = 0) => {
  for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const base = Math.atan2(sy, sx)
    lengths.forEach((len, i) => {
      const k = lengths.length === 1 ? 0 : i / (lengths.length - 1) - 0.5
      blade(sx * (2.32 + offset), sy * (3.32 + offset), base + deg(k * spreadDeg), len, width * (0.75 + len * 0.22), mats[i % mats.length], 0.16 + (0.5 - Math.abs(k)) * 0.2)
    })
  }
}
// Blason au milieu d'un bord : une gemme sertie flanquée de lames.
const crest = (x: number, y: number, out: number, size: number, gemMat: THREE.Material, wingMat: THREE.Material, setMat: THREE.Material, wings: number[]) => {
  wings.forEach((len, i) => {
    const a = [0, 55, -55, 82, -82][i]
    blade(x, y, out + deg(a), len, 0.1 + len * 0.1, i === 0 ? gemMat : wingMat, 0.2)
  })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.35, size * 1.5, 0.14, 4), setMat)
  base.rotation.x = Math.PI / 2
  base.rotation.y = Math.PI / 4
  base.position.set(x, y, 0.32)
  const g = new THREE.Mesh(new THREE.OctahedronGeometry(size), gemMat)
  g.scale.set(1, 1, 0.6)
  g.position.set(x, y, 0.46)
  scene.add(base, g)
}
const cornerStuds = (size: number, gemMat: THREE.Material, setMat: THREE.Material) => {
  for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.3, size * 1.5, 0.16, 4), setMat)
    base.rotation.x = Math.PI / 2
    base.position.set(sx * 2.3, sy * 3.3, 0.34)
    const g = new THREE.Mesh(new THREE.OctahedronGeometry(size), gemMat)
    g.rotation.z = Math.PI / 4
    g.scale.set(1, 1, 0.6)
    g.position.set(sx * 2.3, sy * 3.3, 0.5)
    scene.add(base, g)
  }
}
// Ruban métallique tressé autour de la moulure, sur un tronçon du pourtour.
const ribbon = (from: [number, number], to: [number, number], waves: number, amp: number, radius: number, mat: THREE.Material, phase = 0) => {
  const pts: THREE.Vector3[] = []
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const l = Math.hypot(dx, dy)
  const nx = -dy / l
  const ny = dx / l
  for (let i = 0; i <= 120; i++) {
    const k = i / 120
    const a = k * waves * Math.PI * 2 + phase
    pts.push(new THREE.Vector3(from[0] + dx * k + nx * Math.sin(a) * amp, from[1] + dy * k + ny * Math.sin(a) * amp, 0.3 + Math.cos(a) * 0.17))
  }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, radius, 10), mat))
}
const braid = (waves: number, amp: number, radius: number, a: THREE.Material, b: THREE.Material) => {
  const sides: [[number, number], [number, number], number][] = [
    [[-1.9, 3.27], [1.9, 3.27], waves], [[1.9, -3.27], [-1.9, -3.27], waves],
    [[2.27, 2.9], [2.27, -2.9], waves * 1.5], [[-2.27, -2.9], [-2.27, 2.9], waves * 1.5],
  ]
  for (const [from, to, w] of sides) {
    ribbon(from, to, w, amp, radius, a)
    ribbon(from, to, w, amp, radius, b, Math.PI)
  }
}

// ---------------------------------------------------------------------------------------------
// Styles « organiques » proposés pour les cartes LR et MR (paramètre ?style=a|b|c|d).
// Même géométrie pour les deux raretés ; seule la palette change (chrome et rouge / irisé et prismes).
// ---------------------------------------------------------------------------------------------
const style = new URLSearchParams(location.search).get('style')

let seed = 11
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

// Point, normale sortante et tangente à la position t (0..1) du pourtour (rectangle de demi-côtés w, h).
const rim = (t: number, w = 2.3, h = 3.3) => {
  const per = 4 * (w + h)
  let d = (((t % 1) + 1) % 1) * per
  if (d < 2 * w) return { x: -w + d, y: h, nx: 0, ny: 1 }
  d -= 2 * w
  if (d < 2 * h) return { x: w, y: h - d, nx: 1, ny: 0 }
  d -= 2 * h
  if (d < 2 * w) return { x: w - d, y: -h, nx: 0, ny: -1 }
  d -= 2 * w
  return { x: -w, y: -h + d, nx: -1, ny: 0 }
}
const CORNER_T = [0, 4.6 / 22.4, 11.2 / 22.4, 15.8 / 22.4] // haut-gauche, haut-droit, bas-droit, bas-gauche

// Griffe : un cône lisse et courbé (comme une corne), base à l'origine, dirigé selon `angle`.
const claw = (x: number, y: number, angle: number, len: number, rad: number, bend: number, mat: THREE.Material, z = 0.25) => {
  const g = new THREE.ConeGeometry(rad, len, 10, 14)
  g.translate(0, len / 2, 0)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) / len
    pos.setX(i, pos.getX(i) + bend * len * k * k)
  }
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, mat)
  m.scale.z = 0.7
  m.position.set(x, y, z)
  m.rotation.z = angle - Math.PI / 2
  scene.add(m)
}

// Liane métallique qui serpente tout autour du cadre ; peut porter des épines.
const vine = (waves: number, amp: number, radius: number, mat: THREE.Material, phase: number, thorns: { every: number; len: number; mat: THREE.Material } | null = null) => {
  const pts: THREE.Vector3[] = []
  const n = 520
  for (let i = 0; i < n; i++) {
    const t = i / n
    const { x, y, nx, ny } = rim(t)
    const a = t * waves * Math.PI * 2 + phase
    const wob = Math.sin(a) * amp + Math.sin(a * 2.7 + 1) * amp * 0.3
    pts.push(new THREE.Vector3(x + nx * wob, y + ny * wob, 0.3 + Math.cos(a) * 0.17))
    if (thorns && i % thorns.every === 0) {
      const out = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.5
      const len = thorns.len * (0.6 + rnd() * 0.8)
      claw(x + nx * wob, y + ny * wob, out, len, 0.05 + len * 0.07, (rnd() - 0.5) * 0.5, thorns.mat, 0.32)
    }
  }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 900, radius, 10, true), mat))
}

const smooth = (color: number, emissive: number, glow = 0.6) =>
  new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: glow, metalness: 0.65, roughness: 0.14, clearcoat: 1 })

const buildStyle = (s: string) => {
  const rift = rarity === 'rift'
  // Palette : chrome et rouge sang pour MR, métal irisé et prismes pour LR.
  const main = rift ? metal(0xffffff, 0.04) : metal(0xffffff, 0.14, { map: rainbow() })
  const dark = rift ? metal(0x2a2b38, 0.14) : metal(0xffcf5c, 0.1)
  const lip = rift ? metal(0xff2e4f, 0.18, { emissive: 0x9a0018, emissiveIntensity: 0.9 }) : metal(0xffcf5c, 0.1)
  const accents = rift
    ? [smooth(0xff2343, 0xb0001c, 0.8), smooth(0xff5a6e, 0xd0102a, 0.9)]
    : [smooth(0xff9ad5, 0xd0308a), smooth(0x8fe0ff, 0x1f7fd0), smooth(0xffe27a, 0xd09010), smooth(0x9dffc9, 0x18a868), smooth(0xc9a8ff, 0x6a30e0)]
  const accent = (i: number) => accents[i % accents.length]
  const corner = (i: number) => {
    const { x, y } = rim(CORNER_T[i])
    const sx = Math.sign(x)
    const sy = Math.sign(y)
    return { x, y, sx, sy, diag: Math.atan2(sy, sx) }
  }

  if (s === 'a') {
    // A — Ronces : lianes chromées couvertes d'épines, trois griffes à chaque coin.
    scene.add(molding(2.5, 3.5, 0.42, main), molding(2.1, 3.1, 0.09, lip, 0.14))
    vine(13, 0.2, 0.06, dark, 0, { every: 13, len: 0.5, mat: main })
    vine(13, 0.2, 0.045, main, Math.PI, { every: 17, len: 0.42, mat: accent(0) })
    for (let i = 0; i < 4; i++) {
      const c = corner(i)
      claw(c.x, c.y, c.diag, 1.5, 0.2, 0.22 * c.sx * c.sy, accent(i), 0.4)
      claw(c.x, c.y, c.diag + deg(42), 1.05, 0.15, -0.3, main, 0.3)
      claw(c.x, c.y, c.diag - deg(42), 1.05, 0.15, 0.3, main, 0.3)
    }
  } else if (s === 'b') {
    // B — Griffes : cadre épais et nu, de grandes cornes qui s'enroulent depuis les coins.
    scene.add(molding(2.5, 3.5, 0.5, main), molding(2.3, 3.3, 0.1, dark, 0.2), molding(2.02, 3.02, 0.1, lip, 0.15))
    for (let i = 0; i < 4; i++) {
      const c = corner(i)
      // deux grandes cornes qui longent chaque bord en se recourbant vers l'extérieur
      claw(c.x, c.y, c.sy > 0 ? deg(90) : deg(-90), 1.7, 0.26, 0.42 * c.sx * c.sy, accent(i), 0.42)
      claw(c.x, c.y, c.sx > 0 ? deg(0) : deg(180), 1.35, 0.22, -0.42 * c.sx * c.sy, accent(i + 1), 0.38)
      claw(c.x, c.y, c.diag, 1.15, 0.14, 0, main, 0.5)
      claw(c.x - c.sx * 0.9, c.y, c.sy > 0 ? deg(90) : deg(-90), 0.6, 0.11, 0.3 * c.sx * c.sy, main, 0.3)
      claw(c.x, c.y - c.sy * 1.1, c.sx > 0 ? deg(0) : deg(180), 0.6, 0.11, -0.3 * c.sx * c.sy, main, 0.3)
    }
    for (const sy of [1, -1]) {
      claw(-0.22, sy * 3.36, deg(90 * sy), 0.85, 0.14, -0.35 * sy, accent(0), 0.4)
      claw(0.22, sy * 3.36, deg(90 * sy), 0.85, 0.14, 0.35 * sy, accent(1), 0.4)
    }
  } else if (s === 'c') {
    // C — Brasier : des langues de flamme tout autour, toutes couchées dans le même sens.
    scene.add(molding(2.5, 3.5, 0.4, dark), molding(2.12, 3.12, 0.1, lip, 0.14))
    const count = 86
    for (let i = 0; i < count; i++) {
      const t = (i + rnd() * 0.6) / count
      const { x, y, nx, ny } = rim(t, 2.36, 3.36)
      const near = Math.min(...CORNER_T.map((c) => Math.min(Math.abs(t - c), 1 - Math.abs(t - c))))
      const len = (0.45 + rnd() * 0.75) * (near < 0.05 ? 1.6 : 1)
      const mat = i % 3 === 0 ? main : accent(i)
      claw(x, y, Math.atan2(ny, nx) - deg(38), len, 0.07 + len * 0.1, -0.45, mat, 0.2 + rnd() * 0.25)
    }
  } else {
    // D — Barbelés : deux fils torsadés autour du cadre, hérissés de pointes en croix.
    scene.add(molding(2.5, 3.5, 0.34, main), molding(2.18, 3.18, 0.09, lip, 0.13))
    vine(26, 0.15, 0.05, dark, 0)
    vine(26, 0.15, 0.05, main, Math.PI)
    const barbs = 52
    for (let i = 0; i < barbs; i++) {
      const { x, y, nx, ny } = rim(i / barbs, 2.33, 3.33)
      const out = Math.atan2(ny, nx)
      const mat = i % 4 === 0 ? accent(i) : main
      claw(x, y, out + deg(38), 0.5, 0.055, 0, mat, 0.36)
      claw(x, y, out - deg(38), 0.5, 0.055, 0, mat, 0.36)
    }
    for (let i = 0; i < 4; i++) {
      const c = corner(i)
      claw(c.x, c.y, c.diag, 1.3, 0.17, 0.25 * c.sx * c.sy, accent(i), 0.45)
      claw(c.x, c.y, c.diag + deg(35), 0.8, 0.12, -0.2, accent(i + 1), 0.4)
      claw(c.x, c.y, c.diag - deg(35), 0.8, 0.12, 0.2, accent(i + 1), 0.4)
    }
  }
}

if (style && (rarity === 'legend' || rarity === 'rift')) {
  buildStyle(style)
} else if (rarity === 'rare') {
  const steel = metal(0x9fb6e6, 0.16)
  scene.add(molding(2.5, 3.5, 0.38, steel), molding(2.14, 3.14, 0.09, metal(0xf2f6ff, 0.08), 0.12))
  cornerStuds(0.17, crystal(0xbcd6ff, 0x2a5fc0, 0.4), steel)
} else if (rarity === 'epic') {
  const violet = metal(0x9a6cff, 0.12)
  const silver = metal(0xf1ebff, 0.07)
  const amethyst = crystal(0xc9a2ff, 0x6a25d8)
  scene.add(molding(2.5, 3.5, 0.42, violet), molding(2.1, 3.1, 0.09, silver, 0.13))
  cornerFans([0.5, 0.78, 0.5], 84, 0.11, [silver, amethyst, silver])
  cornerStuds(0.19, amethyst, silver)
  crest(0, 3.36, deg(90), 0.17, amethyst, silver, silver, [0.5])
  crest(0, -3.36, deg(-90), 0.17, amethyst, silver, silver, [0.5])
} else if (rarity === 'legend') {
  const holo = metal(0xffffff, 0.14, { map: rainbow() })
  const gold = metal(0xffcf5c, 0.1)
  const prism = [crystal(0xff9ad5, 0xd0308a), crystal(0x8fe0ff, 0x1f7fd0), crystal(0xffe27a, 0xd09010), crystal(0x9dffc9, 0x18a868), crystal(0xc9a8ff, 0x6a30e0)]
  scene.add(molding(2.5, 3.5, 0.46, holo), molding(2.06, 3.06, 0.09, gold, 0.14))
  braid(5, 0.13, 0.04, gold, gold)
  cornerFans([0.5, 0.82, 1.15, 0.82, 0.5], 110, 0.1, prism)
  cornerStuds(0.22, crystal(0xffffff, 0xffd070, 0.7), gold)
  crest(0, 3.38, deg(90), 0.2, prism[0], gold, gold, [0.75, 0.48, 0.48])
  crest(0, -3.38, deg(-90), 0.2, prism[1], gold, gold, [0.75, 0.48, 0.48])
  crest(-2.38, 0, deg(180), 0.16, prism[3], gold, gold, [0.55, 0.36, 0.36])
  crest(2.38, 0, deg(0), 0.16, prism[4], gold, gold, [0.55, 0.36, 0.36])
} else {
  // Chrome et cristal rouge sang : la carte la plus rare.
  const chrome = metal(0xffffff, 0.04)
  const dark = metal(0x2a2b38, 0.14)
  const blood = crystal(0xff2343, 0xc80020, 0.75)
  const ruby = crystal(0xff7d8f, 0xe01030, 1)
  scene.add(molding(2.5, 3.5, 0.5, chrome), molding(2.02, 3.02, 0.1, metal(0xff2e4f, 0.18, { emissive: 0x9a0018, emissiveIntensity: 0.9 }), 0.15))
  braid(6, 0.17, 0.052, dark, chrome)
  cornerFans([0.55, 0.85, 1.2, 1.6, 1.2, 0.85, 0.55], 150, 0.105, [chrome, blood, chrome, blood, chrome, blood, chrome])
  cornerFans([0.5, 0.75, 0.5], 60, 0.07, [dark, ruby, dark], -0.12)
  cornerStuds(0.24, ruby, chrome)
  crest(0, 3.4, deg(90), 0.24, ruby, chrome, chrome, [1.0, 0.7, 0.7, 0.42, 0.42])
  crest(0, -3.4, deg(-90), 0.24, ruby, chrome, chrome, [1.0, 0.7, 0.7, 0.42, 0.42])
  crest(-2.4, 0, deg(180), 0.19, ruby, chrome, chrome, [0.78, 0.55, 0.55])
  crest(2.4, 0, deg(0), 0.19, ruby, chrome, chrome, [0.78, 0.55, 0.55])
  for (const sy of [-1.75, 1.75]) {
    blade(-2.42, sy, deg(180), 0.5, 0.09, blood)
    blade(2.42, sy, deg(0), 0.5, 0.09, blood)
  }
  for (const sx of [-1.25, 1.25]) {
    blade(sx, 3.42, deg(90), 0.5, 0.09, blood)
    blade(sx, -3.42, deg(-90), 0.5, 0.09, blood)
  }
}

renderer.render(scene, camera)
;(window as unknown as { __ready: boolean }).__ready = true
