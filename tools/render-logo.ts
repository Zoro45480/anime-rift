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

const ANGLE = -0.16 // pente de la faille, commune au mot RIFT et à l'emblème
const NORMAL = new THREE.Vector3(Math.sin(ANGLE), Math.cos(ANGLE), 0)

// Emblème : un cristal taillé, fendu en deux par la faille, au cœur lumineux, cerclé de deux anneaux comme un portail.
const emblem = (cx: number, cy: number, r: number) => {
  const center = new THREE.Vector3(cx, cy, 0.5)
  const facets = new THREE.OctahedronGeometry(r, 0)
  const half = (sign: 1 | -1, color: number, emissive: number) => {
    const shift = new THREE.Vector3(Math.cos(ANGLE), Math.sin(ANGLE), 0).multiplyScalar(sign * 0.3 * (r / 2))
    const pos = center.clone().add(shift)
    const plane = new THREE.Plane(NORMAL.clone().multiplyScalar(sign), -sign * NORMAL.dot(pos) - 0.1 * (r / 2))
    const mat = new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.08, clearcoat: 1, flatShading: true, clippingPlanes: [plane], side: THREE.DoubleSide })
    const m = new THREE.Mesh(facets, mat)
    m.scale.set(0.74, 1.22, 0.6)
    m.rotation.y = 0.42
    m.position.copy(pos)
    logo.add(m)
  }
  half(1, 0xbff4ff, 0x2fb8e8) // moitié haute : cyan clair
  half(-1, 0x9a6bff, 0x5a22d8) // moitié basse : violet
  // cœur de lumière visible dans la fente
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  core.scale.set(1.5, 0.5, 0.6)
  core.rotation.z = ANGLE
  core.position.copy(center)
  logo.add(core)
  // grand anneau chromé, serti de quatre éclats
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.075, 20, 120), metal(0xffffff, 0.04))
  ring.position.copy(center)
  ring.rotation.set(0.55, -0.5, 0.2)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const stud = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.13), glow(i % 2 ? 0xb48bff : 0x8fe9ff, i % 2 ? 0x6a2be0 : 0x1f8fd0, 1.2))
    stud.position.set(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 0)
    stud.scale.set(1, 1.7, 1)
    stud.rotation.z = a - Math.PI / 2
    ring.add(stud)
  }
  // second anneau, fin et lumineux, sur une autre orbite
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.03, 12, 120), new THREE.MeshBasicMaterial({ color: 0x8fe9ff }))
  orbit.position.copy(center)
  orbit.rotation.set(-1.0, 0.55, 0)
  logo.add(ring, orbit)
}

// Lame de lumière le long de la faille, centrée au point `t` de la droite, de longueur `len`.
const lightBlade = (t: number, len: number) => {
  const at = new THREE.Vector3(Math.cos(ANGLE) * t, Math.sin(ANGLE) * t, 0)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(len, 0.085, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  blade.rotation.z = ANGLE
  blade.position.copy(at).setZ(0.45)
  const halo = new THREE.Mesh(new THREE.BoxGeometry(len * 0.96, 0.3, 1.3), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.5 }))
  halo.rotation.z = ANGLE
  halo.position.copy(at).setZ(0.4)
  logo.add(halo, blade)
}

const build = (heavy: Font, bold: Font) => {
  if (variant === 'emblem') {
    emblem(0, 0, 1.75)
    lightBlade(0, 4.7)
    return new THREE.Vector3(0, 0, 0)
  }

  // RIFT : métal extrudé, dégradé violet → cyan → blanc, coupé en deux par la faille
  const rift = text(heavy, 'RIFT', 4.2, 0.9, 0.09)
  const bb = rift.boundingBox!
  rift.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0)
  paintGradient(rift, new THREE.Color(0x8a5bff), new THREE.Color(0x6fe9ff), new THREE.Color(0xffffff))
  const angle = ANGLE
  const normal = NORMAL
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

  // la faille elle-même : une lame de lumière qui traverse l'emblème puis le mot
  const width = bb.max.x - bb.min.x
  const emblemX = -width / 2 - 2.35
  lightBlade(-1.75, width * 1.2 + 3.9)

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

  emblem(emblemX, Math.tan(ANGLE) * emblemX, 1.55)

  const violet = glow(0xb48bff, 0x6a2be0, 0.9)
  const cyan = glow(0x8fe9ff, 0x1f8fd0, 0.9)
  const white = glow(0xffffff, 0x9fdcff, 0.8)
  shard(width / 2 + 0.75, 0.75, 0.5, 0.62, 0.5, cyan)
  shard(width / 2 + 1.35, -0.25, 0.2, 0.36, 1.3, violet)
  shard(width / 2 + 0.55, -1.25, 0.6, 0.3, 2.1, white)
  shard(-0.6, -2.25, 0.8, 0.26, 0.4, cyan)
  return new THREE.Vector3(-1.95, 0.45, 0)
}

const load = async (url: string) => opentype.parse(await (await fetch(url)).arrayBuffer())

Promise.all([load(heavyUrl), load(boldUrl)]).then(([heavy, bold]) => {
  const center = build(heavy, bold)
  const aspect = innerWidth / innerHeight
  const camera = new THREE.PerspectiveCamera(variant === 'emblem' ? 24 : 21, aspect, 0.1, 100)
  // vue légèrement de côté et par en dessous, pour montrer l'épaisseur
  const dist = variant === 'emblem' ? 13 : 17.6
  camera.position.set(center.x - dist * 0.16, center.y - dist * 0.13, dist)
  camera.lookAt(center)
  renderer.render(scene, camera)
  ;(window as unknown as { __ready: boolean }).__ready = true
})
