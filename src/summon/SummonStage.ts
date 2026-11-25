import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import sceneUrl from '../assets/summon/summon.glb?url'
import type { SummonPreset } from './presets'
import { locate, phaseStarts, type Phase } from './timeline'

// Moteur 3D de la cinématique d'invocation.
// La scène (portail, anneaux, cristaux, fragments, faille, colonnes, sol, caméras animées) vient de Blender
// (tools/blender/build_summon.py). Ce fichier lui applique les couleurs de la rareté, joue la séquence
// et ajoute les effets qui doivent rester dynamiques : particules, éclairs, rayons, ondes de choc, halo.

export type Quality = 'high' | 'low'
export type StageEvents = {
  onPhase: (phase: Phase) => void
  onFrame: (flash: number, dark: number) => void // éclat blanc et assombrissement, appliqués par l'interface
  onReady?: () => void // toutes les lumières des cartes sont en place autour du portail
}

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

// Distorsion de l'espace autour du portail + assombrissement des bords (post-traitement).
const WarpShader = {
  uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uWarp: { value: 0 }, uDark: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uWarp, uDark, uTime, uAspect; varying vec2 vUv;
    void main(){
      vec2 d = vUv - uCenter; d.x *= uAspect;
      float r = length(d);
      float wave = sin(r * 34.0 - uTime * 7.0) * exp(-r * 3.2);
      vec2 uv = vUv + normalize(d + 1e-5) * wave * 0.012 * uWarp - d * 0.06 * uWarp * exp(-r * 4.0);
      vec3 c = texture2D(tDiffuse, uv).rgb;
      c.r = mix(c.r, texture2D(tDiffuse, uv + d * 0.012 * uWarp).r, 0.6);
      c.b = mix(c.b, texture2D(tDiffuse, uv - d * 0.012 * uWarp).b, 0.6);
      c *= 1.0 - uDark * smoothstep(0.08, 0.75, r);
      gl_FragColor = vec4(c, 1.0);
    }`,
}

export class SummonStage {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private warp: ShaderPass | null = null
  private clock = new THREE.Clock()
  private raf = 0
  private time = 0
  private phase: Phase | null = null
  private running = false

  private preset!: SummonPreset
  private events!: StageEvents
  private cameras = new Map<string, THREE.PerspectiveCamera>()
  private baseFov = 50
  private camMixer!: THREE.AnimationMixer
  private camAction: THREE.AnimationAction | null = null
  private camClips = new Map<string, THREE.AnimationClip>()
  private ambient!: THREE.AnimationMixer

  private portal = new THREE.Group()
  private frame!: THREE.Mesh
  private disc!: THREE.Mesh
  private crack!: THREE.Mesh
  private rings: THREE.Mesh[] = []
  private crystals: THREE.Mesh[] = []
  private crystalHome: THREE.Vector3[] = []
  private fragments: THREE.Mesh[] = []
  private beams: THREE.Mesh[] = []
  private shocks: THREE.Mesh[] = []
  private floorGlow!: THREE.Mesh
  private light = new THREE.PointLight(0xffffff, 0, 60, 1.6)
  private particles!: THREE.Points
  private bolts!: THREE.Mesh
  private boltTimer = 0
  private rays!: THREE.Mesh
  private flare!: THREE.Sprite
  private hero: THREE.Mesh | null = null
  private orbs: { root: THREE.Group; gem: THREE.Mesh; glow: THREE.Sprite; home: THREE.Vector3; popAt: number }[] = []
  private pulse = 0 // petit éclat à chaque lumière qui éclate
  private ready = false
  private disposables: { dispose: () => void }[] = []

  private canvas: HTMLCanvasElement
  private quality: Quality

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.canvas = canvas
    this.quality = quality
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25))
    this.renderer.setClearColor(0x03040a, 1)
    this.scene.fog = new THREE.FogExp2(0x03040a, 0.028)
    this.scene.add(this.portal, this.light, new THREE.AmbientLight(0x6070a0, 0.35))
    this.light.position.set(0, 0, 1.2)
  }

  // Charge la scène Blender et range ses objets par rôle (d'après leurs noms).
  async load() {
    const gltf = await new GLTFLoader().parseAsync(await this.readScene(), '')
    const root = gltf.scene
    this.scene.add(root)
    this.ambient = new THREE.AnimationMixer(root)
    this.camMixer = new THREE.AnimationMixer(root)
    for (const clip of gltf.animations) {
      if (clip.name.startsWith('Cam_')) this.camClips.set(clip.name, clip)
      else this.ambient.clipAction(clip).play()
    }
    const pivots: THREE.Object3D[] = []
    root.traverse((o) => {
      const cam = o as THREE.PerspectiveCamera
      if (cam.isPerspectiveCamera) {
        // le nœud animé est le parent ; glTF place la caméra elle-même dans un enfant
        const name = cam.parent && cam.parent.name.startsWith('Cam_') ? cam.parent.name : cam.name
        this.cameras.set(name, cam)
        this.baseFov = cam.fov
      }
      const m = o as THREE.Mesh
      if (o.name.startsWith('RingPivot_')) pivots.push(o)
      if (!m.isMesh) return
      if (o.name === 'PortalFrame') this.frame = m
      else if (o.name === 'PortalDisc') this.disc = m
      else if (o.name === 'Crack') this.crack = m
      else if (o.name === 'Shock') this.shocks.push(m)
      else if (o.name === 'FloorGlow') this.floorGlow = m
      else if (o.name.startsWith('Ring_')) this.rings.push(m)
      else if (o.name.startsWith('Crystal_')) this.crystals.push(m)
      else if (o.name.startsWith('Fragment_')) this.fragments.push(m)
      else if (o.name.startsWith('Beam_')) this.beams.push(m)
      else if (o.name.startsWith('FloorTile_')) m.material = this.keep(new THREE.MeshStandardMaterial({ color: 0x0b0c1a, roughness: 0.75, metalness: 0.35 }))
    })
    const byName = (a: THREE.Object3D, b: THREE.Object3D) => a.name.localeCompare(b.name)
    this.rings.sort(byName)
    this.crystals.sort(byName)
    this.fragments.sort(byName)
    this.beams.sort(byName)
    for (const o of [this.frame, this.disc, this.crack, this.shocks[0], ...pivots]) this.portal.add(o) // tout ce qui grandit avec le portail
  }

  // Lit le fichier de la scène. Dans la version « un seul fichier » du jeu, il est intégré à la page (data:) :
  // on le décode alors sur place, sans requête réseau.
  private async readScene(): Promise<ArrayBuffer> {
    if (!sceneUrl.startsWith('data:')) return (await fetch(sceneUrl)).arrayBuffer()
    const bin = atob(sceneUrl.slice(sceneUrl.indexOf(',') + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes.buffer
  }

  // Lance la séquence pour une rareté. `artUrl` = illustration du personnage révélé (absente pour un tirage multiple).
  async start(preset: SummonPreset, artUrl: string | null, events: StageEvents, orbColors: number[] = []) {
    this.preset = preset
    this.events = events
    const c = preset.colors
    const low = this.quality === 'low'
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const

    this.portal.scale.setScalar(preset.portalScale)
    this.light.color.setHex(c.accent)
    this.frame.material = this.keep(new THREE.MeshStandardMaterial({ color: 0x15172e, metalness: 0.9, roughness: 0.28, emissive: c.accent, emissiveIntensity: 0 }))
    this.disc.material = this.keep(new THREE.ShaderMaterial({
      ...additive, blending: preset.voidDisc ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uEnergy: { value: 0 }, uDim: { value: 1 }, uVoid: { value: preset.voidDisc ? 1 : 0 }, uCore: { value: new THREE.Color(c.core) }, uAccent: { value: new THREE.Color(c.accent) }, uSecond: { value: new THREE.Color(c.second) } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 1.98; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime, uOpen, uEnergy, uVoid, uDim; uniform vec3 uCore, uAccent, uSecond; varying vec2 vP;
        void main(){
          float r = length(vP); float a = atan(vP.y, vP.x);
          float swirl = sin(a * 3.0 + r * 9.0 - uTime * (2.0 + uEnergy * 3.0)) * 0.5 + 0.5;
          float arms = sin(a * 7.0 - r * 14.0 + uTime * 3.2) * 0.5 + 0.5;
          float rim = smoothstep(0.55, 1.0, r);
          vec3 col = mix(uAccent, uSecond, arms * 0.6) * (0.25 + swirl * 0.6) + uCore * pow(1.0 - r, 4.0) * (0.5 + uEnergy * 0.7);
          col += uCore * rim * rim * (0.4 + uEnergy * 0.4);
          float alpha = smoothstep(uOpen, uOpen - 0.18, r) * (1.0 - smoothstep(0.96, 1.0, r));
          // faille mythique : un disque noir qui avale la lumière, bordé d'un liseré incandescent
          vec3 voidCol = mix(vec3(0.0), mix(uAccent, uSecond, swirl) * 2.2, pow(rim, 5.0)) + uAccent * arms * 0.12 * (1.0 - rim);
          gl_FragColor = vec4(mix(col * uDim, voidCol, uVoid), alpha * mix(0.95, 1.0, uVoid));
        }`,
    }))
    this.crack.material = this.keep(new THREE.MeshBasicMaterial({ color: preset.voidDisc ? c.accent : c.core, ...additive, side: THREE.DoubleSide, opacity: 0 }))
    this.crack.position.z = 0.05
    this.floorGlow.material = this.keep(new THREE.MeshBasicMaterial({ color: c.accent, ...additive, opacity: 0 }))

    this.rings.forEach((r, i) => {
      r.visible = i < preset.rings
      r.material = this.keep(new THREE.MeshBasicMaterial({ color: i % 2 ? c.second : c.core, ...additive, opacity: 0 }))
    })
    const crystalMat = this.keep(new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.15, flatShading: true, transparent: true, opacity: 0 }))
    this.crystals.forEach((m, i) => {
      m.visible = i < preset.crystals
      m.material = crystalMat
      this.crystalHome[i] = new THREE.Vector3()
    })
    const fragmentMat = this.keep(new THREE.MeshBasicMaterial({ color: preset.voidDisc ? c.deep : c.second, ...additive, side: THREE.DoubleSide, opacity: 0 }))
    this.fragments.forEach((m, i) => { m.visible = i < preset.fragments; m.material = fragmentMat })
    const beamMat = this.keep(new THREE.ShaderMaterial({
      ...additive, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(c.second) }, uPower: { value: 0 } },
      vertexShader: 'varying float vH; void main(){ vH = position.y / 15.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPower; varying float vH; void main(){ gl_FragColor = vec4(uColor, uPower * (1.0 - vH) * (0.35 + 0.65 * smoothstep(0.0, 0.06, vH))); }',
    }))
    this.beams.forEach((m) => { m.visible = preset.beams; m.material = beamMat })

    // ondes de choc : on duplique l'anneau venu de Blender
    const shockMat = () => this.keep(new THREE.MeshBasicMaterial({ color: c.core, ...additive, side: THREE.DoubleSide, opacity: 0 }))
    this.shocks[0].material = shockMat()
    while (this.shocks.length < preset.shocks) {
      const s = this.shocks[0].clone()
      s.material = shockMat()
      this.portal.add(s)
      this.shocks.push(s)
    }

    this.buildParticles(Math.round(preset.particles * (low ? 0.4 : 1)), c)
    this.buildBolts(c)
    this.buildRays(c)
    this.flare = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: this.radialTexture(), color: c.core, ...additive, opacity: 0 })))
    this.flare.position.z = 0.4
    this.scene.add(this.flare)
    this.buildBackdrop(c)
    if (artUrl) await this.buildHero(artUrl, c)
    this.buildOrbs(orbColors)

    // caméra : le plan animé dans Blender, piloté par l'avancement de la séquence
    const cam = this.cameras.get(preset.camera)
    const clip = this.camClips.get(preset.camera)
    if (cam && clip) {
      this.camera = cam
      this.camAction = this.camMixer.clipAction(clip)
      this.camAction.play()
      this.camAction.paused = true
    } else {
      this.camera.position.set(0, 0.4, 9)
    }

    if (!low) {
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), preset.bloom, 0.55, 0.62)
      this.composer.addPass(this.bloom)
      this.warp = new ShaderPass(WarpShader)
      this.composer.addPass(this.warp)
      this.composer.addPass(new OutputPass())
    }
    this.resize()
    this.time = 0
    this.phase = null
    this.running = true
    this.clock.start()
    this.raf = requestAnimationFrame(this.tick)
  }

  // Saute directement à la fin de l'ouverture : les lumières sont en place autour du portail.
  skip() {
    const reveal = phaseStarts(this.preset.times).reveal
    if (this.time < reveal + 2) this.time = reveal + 2
  }

  // Durée, en secondes, entre l'explosion et le moment où toutes les lumières ont pris leur place.
  orbsSettleTime(): number {
    return this.preset.times.burst + 0.15 + this.orbs.length * 0.08 + 0.75
  }

  // Fait éclater la lumière n° i : elle fonce vers la caméra et disparaît dans un éclat.
  popOrb(i: number) {
    const orb = this.orbs[i]
    if (!orb || orb.popAt >= 0) return
    orb.popAt = this.time
    this.pulse = 1
  }

  resize = () => {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    // en portrait, on élargit le champ pour garder le portail entier à l'écran
    const base = THREE.MathUtils.degToRad(this.baseFov)
    const target = this.camera.aspect >= 1.2 ? base : 2 * Math.atan((Math.tan(base / 2) * 1.2) / this.camera.aspect)
    this.camera.fov = Math.min(100, THREE.MathUtils.radToDeg(target))
    this.camera.updateProjectionMatrix()
    if (this.warp) this.warp.uniforms.uAspect.value = w / h
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.scene.traverse((o) => { (o as THREE.Mesh).geometry?.dispose() })
    for (const d of this.disposables) d.dispose()
    this.composer?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private keep<T extends { dispose: () => void }>(x: T): T {
    this.disposables.push(x)
    return x
  }

  private radialTexture() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return this.keep(new THREE.CanvasTexture(c))
  }

  // Une lumière par carte tirée : un cristal blanc dans un halo à la couleur de sa rareté.
  // Elles jaillissent du portail à l'explosion et se rangent en cercle autour de lui (ou au centre s'il n'y en a qu'une).
  private buildOrbs(colors: number[]) {
    if (colors.length === 0) return
    const glowTex = this.radialTexture()
    const geo = this.crystals[0].geometry
    const R = 2.05 * this.preset.portalScale + 1.2
    // sur un écran en hauteur (téléphone), le cercle devient un ovale pour que toutes les lumières restent visibles
    const portrait = this.canvas.clientWidth < this.canvas.clientHeight
    const squeeze = portrait ? 0.6 : 1
    const stretch = portrait ? 1.2 : 1
    colors.forEach((color, i) => {
      const root = new THREE.Group()
      const glow = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })))
      glow.scale.setScalar(2.6)
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.53, 40), this.keep(new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide })))
      const gem = new THREE.Mesh(geo, this.keep(new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })))
      gem.scale.setScalar(0.6)
      root.add(glow, halo, gem)
      root.visible = false
      root.renderOrder = 20
      const a = Math.PI / 2 - (i / colors.length) * Math.PI * 2 // la première en haut, puis dans le sens des aiguilles
      const home = colors.length === 1 ? new THREE.Vector3(0, 0.15, 1.8) : new THREE.Vector3(Math.cos(a) * R * squeeze, Math.sin(a) * R * stretch, 0.8)
      this.scene.add(root)
      this.orbs.push({ root, gem, glow, home, popAt: -1 })
    })
  }

  // Particules : elles sont aspirées en spirale vers le portail, puis soufflées par l'explosion.
  private buildParticles(count: number, c: SummonPreset['colors']) {
    const start = new Float32Array(count * 3)
    const seed = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3().randomDirection()
      dir.z = Math.abs(dir.z) * 0.9 + 0.1 // surtout devant le portail, vers la caméra
      dir.multiplyScalar(5 + Math.random() * 9)
      start.set([dir.x, dir.y, dir.z], i * 3)
      seed.set([Math.random(), 0.35 + Math.random() * 0.9, Math.random()], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const mat = this.keep(new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uFlow: { value: 0 }, uBurst: { value: 0 }, uSize: { value: 1 }, uCore: { value: new THREE.Color(c.core) }, uAccent: { value: new THREE.Color(c.accent) }, uSecond: { value: new THREE.Color(c.second) } },
      vertexShader: `
        attribute vec3 aSeed; uniform float uTime, uFlow, uBurst, uSize; varying float vA; varying float vMix;
        void main(){
          float life = fract(uTime * 0.22 * aSeed.y + aSeed.x);
          float pull = pow(life, 1.6);
          vec3 p = position * (1.0 - pull);
          float ang = pull * 3.4 * (aSeed.z - 0.5) * 2.0;               // spirale autour de l'axe du portail
          p.xy = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xy;
          p += normalize(position) * uBurst * (6.0 + 22.0 * aSeed.y);     // souffle de l'explosion
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (2.0 + 5.0 * aSeed.z) * (1.0 + uBurst * 1.5) * (9.0 / -mv.z);
          vA = sin(3.14159 * life) * uFlow * (1.0 - uBurst * 0.75);
          vMix = aSeed.z;
        }`,
      fragmentShader: `
        uniform vec3 uCore, uAccent, uSecond; varying float vA; varying float vMix;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(mix(uAccent, uSecond, step(0.66, vMix)), uCore, step(0.9, vMix)) , a * a * vA);
        }`,
    }))
    this.particles = new THREE.Points(geo, mat)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)
  }

  // Éclairs : des rubans brisés, redessinés plusieurs fois par seconde.
  private buildBolts(c: SummonPreset['colors']) {
    const SEG = 10
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.preset.bolts * SEG * 18), 3))
    this.bolts = new THREE.Mesh(geo, this.keep(new THREE.MeshBasicMaterial({ color: c.core, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 })))
    this.bolts.frustumCulled = false
    this.scene.add(this.bolts)
  }

  private redrawBolts() {
    const SEG = 10
    const pos = this.bolts.geometry.getAttribute('position') as THREE.BufferAttribute
    const R = 2.05 * this.preset.portalScale
    let v = 0
    for (let b = 0; b < this.preset.bolts; b++) {
      const a0 = Math.random() * Math.PI * 2
      const a1 = a0 + (Math.random() - 0.5) * 1.4
      const reach = R * (1.6 + Math.random() * 2.2)
      const from = new THREE.Vector3(Math.cos(a0) * R, Math.sin(a0) * R, 0.1)
      const to = new THREE.Vector3(Math.cos(a1) * reach, Math.sin(a1) * reach, (Math.random() - 0.3) * 3)
      let prev = from.clone()
      for (let s = 1; s <= SEG; s++) {
        const p = from.clone().lerp(to, s / SEG)
        if (s < SEG) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4))
        const dir = p.clone().sub(prev).normalize()
        const side = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.05 * (1 - (s / SEG) * 0.7))
        const quad = [prev.clone().add(side), prev.clone().sub(side), p.clone().add(side), prev.clone().sub(side), p.clone().sub(side), p.clone().add(side)]
        for (const q of quad) pos.setXYZ(v++, q.x, q.y, q.z)
        prev = p
      }
    }
    pos.needsUpdate = true
  }

  // Rayons lumineux qui partent du centre du portail.
  private buildRays(c: SummonPreset['colors']) {
    const N = 18
    const pos: number[] = []
    const uv: number[] = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.2
      const len = 7 + Math.random() * 9
      const w = 0.05 + Math.random() * 0.1
      pos.push(0, 0, 0, Math.cos(a - w) * len, Math.sin(a - w) * len, 0, Math.cos(a + w) * len, Math.sin(a + w) * len, 0)
      uv.push(0, 0, 1, 0, 1, 1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    this.rays = new THREE.Mesh(geo, this.keep(new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(c.second) }, uPower: { value: 0 } },
      vertexShader: 'varying float vL; void main(){ vL = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPower; varying float vL; void main(){ gl_FragColor = vec4(uColor, uPower * (1.0 - vL) * (1.0 - vL)); }',
    })))
    this.rays.position.z = -0.2
    this.scene.add(this.rays)
  }

  // Fond d'étoiles lointain, pour la profondeur.
  private buildBackdrop(c: SummonPreset['colors']) {
    const n = this.quality === 'low' ? 300 : 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 60)
      pos.set([d.x, d.y * 0.7 + 8, -Math.abs(d.z) - 10], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(geo, this.keep(new THREE.PointsMaterial({ color: c.second, size: 0.35, transparent: true, opacity: 0.7, fog: false, depthWrite: false })))
    this.scene.add(stars)
  }

  // Le personnage : son illustration sur un plan, d'abord en silhouette dans la lumière, puis en couleurs.
  private async buildHero(url: string, c: SummonPreset['colors']) {
    const tex = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    this.keep(tex)
    const img = tex.image as HTMLImageElement
    const h = 5.7 // hauteur du personnage dans la scène, identique pour toutes les raretés
    const mat = this.keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: tex }, uAppear: { value: 0 }, uColor: { value: 0 }, uRim: { value: new THREE.Color(c.core) }, uShade: { value: new THREE.Color(c.deep) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D uMap; uniform float uAppear, uColor; uniform vec3 uRim, uShade; varying vec2 vUv;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          vec3 silhouette = mix(uShade * 0.25, uRim, pow(1.0 - t.a, 2.0) * 0.0 + smoothstep(0.7, 1.0, vUv.y) * 0.25);
          vec3 col = mix(silhouette, t.rgb + uRim * (1.0 - uColor) * 0.6, uColor);
          gl_FragColor = vec4(col, t.a * uAppear);
          #include <colorspace_fragment>
        }`,
    }))
    this.hero = new THREE.Mesh(new THREE.PlaneGeometry((h * img.width) / img.height, h), mat)
    this.hero.position.set(0, 0.7, 1.3)
    this.hero.renderOrder = 10
    this.scene.add(this.hero)
  }

  private tick = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(0.1, this.clock.getDelta()) // sous 10 images/s on ralentit plutôt que de sauter
    this.time += dt
    const p = this.preset
    const T = p.times
    const { phase, k, into } = locate(T, this.time)
    if (phase !== this.phase) {
      this.phase = phase
      this.events.onPhase(phase)
    }
    const is = (name: Phase) => phase === name

    // --- grandeurs directrices de la séquence -------------------------------------------------------------
    const energy = is('gather') ? 0.15 * k : is('open') ? 0.15 + 0.35 * k : is('surge') ? 0.5 + 0.5 * k * k : is('hush') ? 1 - 0.85 * ease(k) : is('burst') ? 1.5 - 0.5 * k : 0.7 - 0.25 * clamp01(into / 1.2)
    const flow = is('gather') ? 0.6 * k : is('open') ? 0.6 + 0.4 * k : is('surge') ? 1 : is('hush') ? 1 - k : is('burst') ? 1 : 0.35
    const open = is('gather') ? 0 : is('open') ? ease(k) : is('hush') ? 1 - 0.8 * ease(k) * (p.voidDisc ? 1 : 0.4) : 1
    const burst = is('burst') ? k : 0
    const flash = is('burst') ? Math.pow(1 - k, 2.2) : 0
    const dark = p.darkness * (is('surge') ? 0.75 * k : is('hush') ? 0.75 + 0.25 * k : is('burst') ? 1 - k : 0)
    const settled = is('reveal') ? clamp01(into / 1.2) : 0

    // --- animations venues de Blender ---------------------------------------------------------------------
    this.ambient.update(dt * (0.6 + energy * 3.2)) // les anneaux accélèrent avec l'énergie
    if (this.camAction) {
      const clip = this.camAction.getClip()
      const approach = p.camera === 'Cam_Pull' ? 0.62 : 0.8 // part du plan consacrée à l'approche (voir build_summon.py)
      const beforeHush = T.gather + T.open + T.surge
      const progress = this.time < beforeHush ? (this.time / beforeHush) * approach
        : this.time < beforeHush + T.hush ? approach + ((this.time - beforeHush) / Math.max(T.hush, 0.001)) * (0.8 - approach)
        : 0.8 + clamp01((this.time - beforeHush - T.hush) / (T.burst + 0.9)) * 0.2
      this.camAction.time = Math.min(progress, 0.999) * clip.duration
      this.camMixer.update(0)
      if (flash > 0 && p.shake) {
        const s = flash * p.shake * 0.22
        // on secoue le nœud animé de la caméra ; l'animation le replace à l'image suivante
        const rig = this.camera.parent && this.camera.parent.name.startsWith('Cam_') ? this.camera.parent : this.camera
        rig.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0))
      }
    }

    // --- portail ------------------------------------------------------------------------------------------
    const frameMat = this.frame.material as THREE.MeshStandardMaterial
    frameMat.emissiveIntensity = 0.1 + energy * 0.7
    this.frame.visible = !is('gather')
    this.frame.scale.setScalar(is('open') ? ease(clamp01(k * 1.4)) : 1)
    const discU = (this.disc.material as THREE.ShaderMaterial).uniforms
    discU.uTime.value = this.time
    discU.uOpen.value = open * 1.2
    discU.uEnergy.value = energy
    discU.uDim.value = 1 - 0.7 * settled
    const crackMat = this.crack.material as THREE.MeshBasicMaterial
    const tear = is('gather') ? 0 : is('open') ? ease(clamp01(k * 1.8)) : 1
    this.crack.scale.set(tear * (p.crackStays ? 1.5 : 1), 0.25 + 0.75 * tear, 1)
    crackMat.opacity = is('open') ? tear * 0.9 : p.crackStays ? (is('reveal') ? 0.25 * (1 - settled) : is('hush') ? 0.5 - 0.4 * k : 0.5) : is('surge') ? 0.9 * (1 - clamp01(k * 2.2)) : 0
    this.light.intensity = (energy * 22 + flash * 160) * (p.voidDisc && is('hush') ? 0.2 : 1)
    ;(this.floorGlow.material as THREE.MeshBasicMaterial).opacity = clamp01(energy * 0.22 + flash * 0.5) * (is('gather') ? k : 1)

    // --- anneaux, cristaux, fragments, colonnes -----------------------------------------------------------
    const ringsIn = is('gather') ? 0 : is('open') ? k * p.rings * 0.7 : p.rings
    this.rings.forEach((r, i) => {
      if (!r.visible) return
      const a = clamp01(ringsIn - i * 0.7)
      ;(r.material as THREE.MeshBasicMaterial).opacity = a * (0.3 + energy * 0.35) * (is('hush') ? 1 - 0.7 * k : 1)
      r.scale.setScalar((0.6 + 0.4 * ease(a)) * (1 + burst * 0.5))
    })
    const scatter = is('burst') ? ease(k) : is('reveal') ? 1 - 0.55 * settled : 0
    this.crystals.forEach((m, i) => {
      if (!m.visible) return
      // la position vient de l'animation Blender ; on l'écarte du centre pendant l'explosion
      this.crystalHome[i].copy(m.position)
      m.position.addScaledVector(this.crystalHome[i].clone().normalize(), scatter * 3.5)
    })
    const crystalMat = this.crystals[0].material as THREE.MeshStandardMaterial
    crystalMat.opacity = is('gather') ? k : 1
    crystalMat.emissiveIntensity = 0.25 + energy * 0.6
    ;(this.fragments[0].material as THREE.MeshBasicMaterial).opacity = (is('gather') ? k : 1) * (0.18 + energy * 0.3)
    const beamU = (this.beams[0].material as THREE.ShaderMaterial).uniforms
    beamU.uPower.value = p.beams ? (is('surge') ? k * 0.3 : is('hush') ? 0.3 * (1 - k) : is('burst') ? 0.6 : is('reveal') ? 0.32 : 0) : 0
    this.beams.forEach((b) => b.scale.set(1 + flash * 2, is('surge') ? 0.2 + 0.8 * k : 1, 1 + flash * 2))

    // --- particules, éclairs, rayons, ondes de choc, halo -------------------------------------------------
    const pu = (this.particles.material as THREE.ShaderMaterial).uniforms
    pu.uTime.value = this.time
    pu.uFlow.value = flow
    pu.uBurst.value = burst
    pu.uSize.value = this.renderer.getPixelRatio()
    const storm = is('surge') ? 0.4 + 0.6 * k : is('open') && p.voidDisc ? k * 0.6 : is('burst') ? 1 - k : is('reveal') && p.voidDisc ? 0.25 : 0
    this.boltTimer -= dt
    if (storm > 0 && this.boltTimer <= 0) {
      this.redrawBolts()
      this.boltTimer = 0.05 + Math.random() * 0.09
    }
    ;(this.bolts.material as THREE.MeshBasicMaterial).opacity = storm > 0 ? storm * (0.5 + Math.random() * 0.5) : 0
    const rayU = (this.rays.material as THREE.ShaderMaterial).uniforms
    rayU.uPower.value = is('surge') ? k * k * 0.2 : is('burst') ? 0.7 - 0.35 * k : is('reveal') ? 0.35 - 0.2 * settled : 0
    this.rays.rotation.z += dt * (0.12 + energy * 0.3)
    this.rays.scale.setScalar(p.portalScale * (1 + burst * 0.6))
    this.shocks.forEach((s, i) => {
      const local = clamp01((burst - i * 0.14) / 0.8)
      s.visible = is('burst') && local > 0
      s.scale.setScalar(1 + local * (11 + i * 3))
      ;(s.material as THREE.MeshBasicMaterial).opacity = (1 - local) * 0.9
    })
    const flareMat = this.flare.material as THREE.SpriteMaterial
    flareMat.opacity = clamp01(energy * 0.16 + flash * 0.9) * (p.voidDisc && !is('burst') ? 0.25 : 1) * (is('reveal') ? 1 - 0.9 * settled : 1)
    this.flare.scale.setScalar((4 + energy * 3 + flash * 16) * p.portalScale)

    // --- lumières des cartes --------------------------------------------------------------------------------
    this.pulse = Math.max(0, this.pulse - dt * 3.2)
    const sinceBurst = this.time - phaseStarts(T).burst
    if (!this.ready && sinceBurst >= this.orbsSettleTime()) {
      this.ready = true
      this.events.onReady?.()
    }
    const facing = this.camera.getWorldQuaternion(new THREE.Quaternion())
    this.orbs.forEach((orb, i) => {
      if (orb.popAt >= 0) {
        const u = (this.time - orb.popAt) / 0.32
        orb.root.visible = u < 1
        orb.root.position.lerpVectors(orb.home, new THREE.Vector3(0, 0, 3), ease(clamp01(u)))
        orb.root.scale.setScalar(1 + u * 3)
        orb.glow.material.opacity = 1 - clamp01(u) * 0.6
        return
      }
      const u = clamp01((sinceBurst - 0.15 - i * 0.08) / 0.75)
      orb.root.visible = u > 0
      if (u <= 0) return
      const out = 1 - Math.pow(1 - u, 3) // jaillit vite, se pose doucement
      orb.root.position.copy(orb.home).multiplyScalar(out)
      orb.root.position.z = orb.home.z * out + Math.sin(Math.PI * u) * 2.6 // arc vers la caméra pendant le vol
      orb.root.position.y += Math.sin(this.time * 2.2 + i) * 0.07 * out
      orb.root.scale.setScalar(0.3 + 0.7 * out + Math.sin(this.time * 5 + i * 1.7) * 0.05)
      orb.root.quaternion.copy(facing)
      orb.gem.rotation.z += dt * 2.4
    })

    // --- personnage ---------------------------------------------------------------------------------------
    if (this.hero) {
      const hu = (this.hero.material as THREE.ShaderMaterial).uniforms
      const appear = is('burst') ? clamp01((k - 0.45) / 0.55) : is('reveal') ? 1 : 0
      hu.uAppear.value = appear
      hu.uColor.value = is('reveal') ? ease(clamp01((into - 0.25) / 0.8)) : 0
      this.hero.scale.setScalar(0.82 + 0.18 * ease(appear))
      this.hero.quaternion.copy(this.camera.getWorldQuaternion(new THREE.Quaternion()))
      this.hero.position.y = 0.7 + Math.sin(this.time * 1.3) * 0.05
    }

    // --- rendu --------------------------------------------------------------------------------------------
    this.events.onFrame(Math.max(flash, this.pulse * 0.55), this.composer ? 0 : dark * 0.8)
    if (this.composer && this.bloom && this.warp) {
      this.bloom.strength = (p.bloom * (0.3 + energy * 0.4) + flash * 1.1) * (1 - 0.65 * settled)
      const center = new THREE.Vector3(0, 0, 0).project(this.camera)
      const wu = this.warp.uniforms
      wu.uCenter.value.set(center.x * 0.5 + 0.5, center.y * 0.5 + 0.5)
      wu.uWarp.value = p.distortion * (is('reveal') ? 0.25 * (1 - settled) : Math.min(1.2, energy))
      wu.uDark.value = dark
      wu.uTime.value = this.time
      this.composer.render(dt)
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }
}
