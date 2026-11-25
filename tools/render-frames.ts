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

if (rarity === 'rare') {
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
