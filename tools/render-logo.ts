// Outil de production : modélise et rend le logo ANIME RIFT en 3D, sur fond transparent.
// Usage (voir tools/render-logo.cjs) : /logo.html?v=full (logo complet) | emblem (losange seul)
import * as THREE from 'three'
import opentype from 'opentype.js'
import heavyUrl from '@fontsource/barlow-condensed/files/barlow-condensed-latin-800-italic.woff?url'
import boldUrl from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff?url'

const variant = new URLSearchParams(location.search).get('v') ?? 'full'
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(2) // rendu en double définition pour des bords nets
renderer.setSize(innerWidth, innerHeight)
renderer.setClearColor(0x000000, 0)
renderer.localClippingEnabled = true
document.body.appendChild(renderer.domElement)

// Studio de reflets : fond sombre et panneaux lumineux, pour que le métal accroche des bandes nettes.
const studio = () => {
  const s = new THREE.Scene()
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x8286ad, side: THREE.BackSide })))
  const panel = (color: number, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  panel(0xffffff, 30, 8, 0, 22, 14)
  panel(0x8fe9ff, 6, 30, -26, 0, 10)
  panel(0xb48bff, 6, 30, 26, -2, 10)
  panel(0x6a4dff, 24, 6, 0, -22, 8)
  panel(0xffffff, 10, 5, -6, 6, 30)
  return s
}

const scene = new THREE.Scene()
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(), 0.01).texture
scene.environmentIntensity = 1.35
const key = new THREE.DirectionalLight(0xffffff, 2.6)
key.position.set(-4, 6, 10)
scene.add(key, new THREE.AmbientLight(0xffffff, 1.1))

const logo = new THREE.Group()
scene.add(logo)

const metal = (color: number, roughness = 0.12, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, ...extra })
const glow = (color: number, emissive: number, intensity = 1.6) =>
  new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: intensity, metalness: 0.2, roughness: 0.15, clearcoat: 1, flatShading: true })

// Colore la face avant d'un texte du bas (violet) vers le haut (blanc-cyan).
const paintGradient = (g: THREE.BufferGeometry, bottom: THREE.Color, mid: THREE.Color, top: THREE.Color) => {
  g.computeBoundingBox()
  const { min, max } = g.boundingBox!
  const pos = g.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - min.y) / (max.y - min.y)
    if (k < 0.5) c.copy(bottom).lerp(mid, k * 2)
    else c.copy(mid).lerp(top, (k - 0.5) * 2)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

type Font = opentype.Font

// Texte en relief : le contour des lettres vient de la police, puis il est extrudé et biseauté.
const text = (font: Font, str: string, size: number, depth: number, bevel: number, letterSpacing = 0) => {
  const path = new THREE.ShapePath()
  for (const c of font.getPath(str, 0, 0, size, { letterSpacing }).commands) {
    if (c.type === 'M') path.moveTo(c.x, -c.y)
    else if (c.type === 'L') path.lineTo(c.x, -c.y)
    else if (c.type === 'Q') path.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y)
    else if (c.type === 'C') path.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y)
  }
  const g = new THREE.ExtrudeGeometry(path.toShapes(true), { depth, curveSegments: 10, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5 })
  g.computeBoundingBox()
  return g
}

// Éclat de cristal libre.
const shard = (x: number, y: number, z: number, len: number, rot: number, mat: THREE.Material) => {
  const g = new THREE.OctahedronGeometry(1)
  const m = new THREE.Mesh(g, mat)
  m.scale.set(len * 0.44, len * 2, len * 0.32)
  m.position.set(x, y, z)
  m.rotation.set(0.3, rot, rot * 0.7 - 0.5)
  logo.add(m)
}

// Emblème : losange de métal sombre cerclé de chrome, traversé par une fissure lumineuse.
const emblem = (cx: number, cy: number, r: number) => {
  const g = new THREE.Group()
  const rhombus = (size: number) => {
    const s = new THREE.Shape()
    s.moveTo(0, size)
    s.lineTo(size * 0.82, 0)
    s.lineTo(0, -size)
    s.lineTo(-size * 0.82, 0)
    s.closePath()
    return s
  }
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rhombus(r), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6 }), metal(0xffffff, 0.05))
  const core = new THREE.Mesh(new THREE.ExtrudeGeometry(rhombus(r * 0.8), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 5 }), metal(0x1a1d48, 0.22, { clearcoat: 1 }))
  core.position.z = 0.06
  // fissure en zigzag (la même que sur l'icône du jeu), en relief et lumineuse
  const pts: [number, number][] = [[0.2, 0.86], [-0.2, 0.14], [0.16, -0.08], [-0.26, -0.84]]
  const w = 0.085
  const crack = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? crack.lineTo((x + w) * r, y * r) : crack.moveTo((x + w) * r, y * r)))
  ;[...pts].reverse().forEach(([x, y]) => crack.lineTo((x - w) * r, y * r))
  crack.closePath()
  const bolt = new THREE.Mesh(new THREE.ExtrudeGeometry(crack, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 }), glow(0xeafcff, 0x5ee6ff, 2.2))
  bolt.position.z = 0.36
  g.add(rim, core, bolt)
  g.position.set(cx, cy, 0)
  logo.add(g)
}

const build = (heavy: Font, bold: Font) => {
  if (variant === 'emblem') {
    emblem(0, 0, 2.3)
    shard(-2.15, 1.5, 0.3, 0.5, 0.4, glow(0xb48bff, 0x6a2be0, 0.9))
    shard(2.1, -1.45, 0.3, 0.42, 1.4, glow(0x8fe9ff, 0x1f8fd0, 0.9))
    return new THREE.Vector3(0, 0, 0)
  }

  // RIFT : métal extrudé, dégradé violet → cyan → blanc, coupé en deux par la faille
  const rift = text(heavy, 'RIFT', 4.2, 0.9, 0.09)
  const bb = rift.boundingBox!
  rift.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0)
  paintGradient(rift, new THREE.Color(0x8a5bff), new THREE.Color(0x6fe9ff), new THREE.Color(0xffffff))
  const angle = -0.16 // pente de la faille
  const normal = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0)
  const gap = 0.12
  const half = (sign: 1 | -1) => {
    const plane = new THREE.Plane(normal.clone().multiplyScalar(sign), -gap)
    const front = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.22, clearcoat: 1, clippingPlanes: [plane], side: THREE.DoubleSide })
    const side = metal(0x3a2aa8, 0.25, { clippingPlanes: [plane], side: THREE.DoubleSide })
    const back = metal(0xffffff, 0.05, { clippingPlanes: [plane] })
    const m = new THREE.Mesh(rift, [front, side])
    // les deux moitiés glissent le long de la faille, en sens opposés
    m.position.set(sign * 0.34 * Math.cos(angle), sign * -0.34 * Math.sin(angle), 0)
    plane.translate(m.position)
    // liseré chromé : la même forme, un peu plus grande, juste derrière
    const outline = new THREE.Mesh(rift, back)
    outline.scale.set(1.035, 1.07, 1)
    outline.position.copy(m.position).setZ(-0.3)
    logo.add(outline, m)
  }
  half(1)
  half(-1)

  // la faille elle-même : une lame de lumière entre les deux moitiés
  const width = bb.max.x - bb.min.x
  const blade = new THREE.Mesh(new THREE.BoxGeometry(width * 1.2, 0.085, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  blade.rotation.z = angle
  blade.position.z = 0.45
  const halo = new THREE.Mesh(new THREE.BoxGeometry(width * 1.14, 0.3, 1.3), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.5 }))
  halo.rotation.z = angle
  halo.position.z = 0.4
  logo.add(halo, blade)

  // ANIME : chrome, lettres espacées, posé au-dessus
  const anime = text(bold, 'ANIME', 1.3, 0.3, 0.035, 0.42)
  const rowW = anime.boundingBox!.max.x
  const row = new THREE.Mesh(anime, metal(0xffffff, 0.06))
  row.position.set(-width / 2 + 0.25, 2.05, 0.2)
  logo.add(row)
  // filet chromé qui prolonge ANIME jusqu'au bord droit
  const rule = new THREE.Mesh(new THREE.BoxGeometry(width - rowW - 0.9, 0.09, 0.2), metal(0xffffff, 0.06))
  rule.position.set(-width / 2 + 0.25 + rowW + 0.45 + (width - rowW - 0.9) / 2, 2.5, 0.3)
  logo.add(rule)

  emblem(-width / 2 - 2.25, 0.35, 2.0)

  const violet = glow(0xb48bff, 0x6a2be0, 0.9)
  const cyan = glow(0x8fe9ff, 0x1f8fd0, 0.9)
  const white = glow(0xffffff, 0x9fdcff, 0.8)
  shard(width / 2 + 0.75, 0.75, 0.5, 0.62, 0.5, cyan)
  shard(width / 2 + 1.35, -0.25, 0.2, 0.36, 1.3, violet)
  shard(width / 2 + 0.55, -1.25, 0.6, 0.3, 2.1, white)
  shard(-width / 2 - 4.35, 1.75, 0.3, 0.4, 0.9, violet)
  shard(-width / 2 - 4.5, -0.95, 0.4, 0.3, 1.9, cyan)
  shard(-0.6, -2.25, 0.8, 0.26, 0.4, cyan)
  return new THREE.Vector3(-1.45, 0.35, 0)
}

const load = async (url: string) => opentype.parse(await (await fetch(url)).arrayBuffer())

Promise.all([load(heavyUrl), load(boldUrl)]).then(([heavy, bold]) => {
  const center = build(heavy, bold)
  const aspect = innerWidth / innerHeight
  const camera = new THREE.PerspectiveCamera(variant === 'emblem' ? 24 : 21, aspect, 0.1, 100)
  // vue légèrement de côté et par en dessous, pour montrer l'épaisseur
  const dist = variant === 'emblem' ? 13 : 16.6
  camera.position.set(center.x - dist * 0.16, center.y - dist * 0.13, dist)
  camera.lookAt(center)
  renderer.render(scene, camera)
  ;(window as unknown as { __ready: boolean }).__ready = true
})
