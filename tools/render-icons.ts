// Outil de production : modélise et rend les icônes 3D des monnaies (gemme, ticket, énergie) sur fond transparent.
// Usage (voir tools/render-icons.cjs) : /icons.html?i=gem|ticket|bolt
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const which = new URLSearchParams(location.search).get('i') ?? 'gem'
const S = innerWidth
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(S, S)
renderer.setClearColor(0x000000, 0)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50)
camera.position.set(0, 0, 7.9)
scene.environmentIntensity = 0.55
const key = new THREE.DirectionalLight(0xffffff, 1.5)
key.position.set(-2, 3, 4)
const rim = new THREE.DirectionalLight(0xffffff, 0.9)
rim.position.set(3, -1, -2)
scene.add(key, rim)

const group = new THREE.Group()
scene.add(group)

const facet = (color: number, emissive: number) =>
  new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.55, metalness: 0.1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true })

// Cristal de faille : prisme hexagonal à deux pointes, avec deux éclats satellites.
const crystal = (h: number, r: number, mat: THREE.Material) => {
  const g = new THREE.Group()
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h * 0.42, 6), mat)
  const top = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.3, 6), mat)
  top.position.y = h * 0.36
  const bottom = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, h * 0.4, 6), mat)
  bottom.rotation.x = Math.PI
  bottom.position.y = -h * 0.41
  g.add(mid, top, bottom)
  return g
}

const roundedTicket = () => {
  const w = 1.5, h = 0.85, r = 0.14, n = 0.2
  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.quadraticCurveTo(w, -h, w, -h + r)
  s.lineTo(w, -n)
  s.absarc(w, 0, n, -Math.PI / 2, Math.PI / 2, true)
  s.lineTo(w, h - r)
  s.quadraticCurveTo(w, h, w - r, h)
  s.lineTo(-w + r, h)
  s.quadraticCurveTo(-w, h, -w, h - r)
  s.lineTo(-w, n)
  s.absarc(-w, 0, n, Math.PI / 2, -Math.PI / 2, true)
  s.lineTo(-w, -h + r)
  s.quadraticCurveTo(-w, -h, -w + r, -h)
  return s
}

if (which === 'gem') {
  const main = crystal(2.9, 0.78, facet(0xb548ff, 0x5a12c8))
  main.rotation.set(0.25, 0.5, -0.32)
  const a = crystal(1.3, 0.34, facet(0xff5fd2, 0x9a1a8a))
  a.position.set(1.0, -0.75, 0.4)
  a.rotation.set(0.2, 0.3, -0.75)
  const b = crystal(1.0, 0.27, facet(0x6fd8ff, 0x1a5fc8))
  b.position.set(-0.95, -0.9, 0.5)
  b.rotation.set(0.1, 0.9, 0.55)
  group.add(main, a, b)
} else if (which === 'ticket') {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf5a623, metalness: 0.55, roughness: 0.34, clearcoat: 0.5 })
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedTicket(), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 24 }), gold)
  body.position.z = -0.1
  // Emblème : le losange fendu du logo, en relief
  const d = new THREE.Shape()
  d.moveTo(0, 0.55); d.lineTo(0.5, 0); d.lineTo(0, -0.55); d.lineTo(-0.5, 0); d.closePath()
  const red = new THREE.MeshPhysicalMaterial({ color: 0xff3b4e, emissive: 0x7a0010, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.25, clearcoat: 1 })
  const emblem = new THREE.Mesh(new THREE.ExtrudeGeometry(d, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }), red)
  emblem.position.set(-0.45, 0, 0.15)
  // Perforation
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x7a4a00, metalness: 0.5, roughness: 0.5 })
  for (let i = -3; i <= 3; i++) {
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), dotMat)
    dot.rotation.x = Math.PI / 2
    dot.position.set(0.55, i * 0.21, 0.19)
    group.add(dot)
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.06), red)
  bar.position.set(1.0, 0.25, 0.19)
  const bar2 = bar.clone()
  bar2.position.y = -0.05
  bar2.scale.x = 0.6
  bar2.position.x = 0.9
  group.add(body, emblem, bar, bar2)
  group.rotation.set(-0.3, -0.5, 0.38)
  group.scale.setScalar(1.05)
} else {
  const s = new THREE.Shape()
  const pts: [number, number][] = [[0.35, 1.5], [-0.75, -0.15], [-0.05, -0.15], [-0.4, -1.5], [0.8, 0.3], [0.1, 0.3]]
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffc21a, emissive: 0xff7a00, emissiveIntensity: 0.3, metalness: 0.35, roughness: 0.3, clearcoat: 1 })
  const bolt = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4 }), mat)
  bolt.position.z = -0.16
  group.add(bolt)
  group.rotation.set(-0.15, -0.55, 0.12)
  group.scale.setScalar(1.05)
}

renderer.render(scene, camera)
;(window as unknown as { __ready: boolean }).__ready = true
