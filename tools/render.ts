// Outil de production : affiche un modèle VRM posé, sur fond transparent, pour en tirer les illustrations du jeu.
// Usage (voir tools/render-all.cjs) : /render.html?m=Vita&pose=0&shot=full|bust
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'

const q = new URLSearchParams(location.search)
const model = q.get('m') ?? 'Vita'
const poseId = Number(q.get('pose') ?? 0)
const shot = q.get('shot') ?? 'full'

type Pose = Record<string, [number, number, number]>
const POSES: Pose[] = [
  { leftUpperArm: [0, 0, 1.2], rightUpperArm: [0, 0, -1.2], leftLowerArm: [0, 0.2, 0.1], rightLowerArm: [0, -0.2, -0.1], spine: [0, 0.18, 0], head: [0.03, -0.2, 0.03] },
  { leftUpperArm: [0.2, 0, 1.25], rightUpperArm: [-0.5, 0.3, -0.75], rightLowerArm: [0, -1.9, 0], rightHand: [0, 0, -0.3], spine: [0, -0.28, 0.03], head: [-0.05, 0.3, -0.05], hips: [0, 0.15, 0] },
  { leftUpperArm: [0, 0.3, 1.0], leftLowerArm: [0, 2.0, 0], rightUpperArm: [0, -0.3, -1.0], rightLowerArm: [0, -2.0, 0], spine: [0.05, 0.1, 0], head: [0.1, -0.1, 0], chest: [-0.05, 0, 0] },
  { leftUpperArm: [-0.3, 0.2, 0.55], leftLowerArm: [0, 1.3, 0], rightUpperArm: [0.15, 0, -1.25], spine: [0, 0.32, -0.04], head: [0, -0.35, 0.06], leftUpperLeg: [0, 0, -0.06], rightUpperLeg: [0, 0, 0.06] },
  { leftUpperArm: [0, 0, 1.15], rightUpperArm: [-1.2, 0.2, -0.5], rightLowerArm: [0, -1.1, 0], spine: [-0.06, -0.2, 0], head: [-0.12, 0.2, 0], rightUpperLeg: [-0.12, 0, 0.05] },
]

const W = innerWidth
const H = innerHeight
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.setClearColor(0x000000, 0)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(shot === 'bust' ? 20 : 24, W / H, 0.1, 50)
const key = new THREE.DirectionalLight(0xffffff, Math.PI)
key.position.set(1, 1.5, 2)
scene.add(key)

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))
loader.load(`/models/${model}.vrm`, (gltf) => {
  const vrm = gltf.userData.vrm as VRM
  VRMUtils.rotateVRM0(vrm)
  scene.add(vrm.scene)
  const pose = POSES[poseId % POSES.length]
  for (const [bone, [x, y, z]] of Object.entries(pose)) {
    vrm.humanoid.getNormalizedBoneNode(bone as never)?.rotation.set(x, y, z)
  }
  vrm.expressionManager?.setValue(poseId % 2 ? 'fun' : 'relaxed', 0.25)
  for (let i = 0; i < 90; i++) vrm.update(1 / 60) // laisse retomber cheveux et vêtements
  const head = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(new THREE.Vector3())
  if (shot === 'bust') {
    camera.position.set(0.15, head.y + 0.02, 2.2)
    camera.lookAt(0, head.y - 0.05, 0)
  } else {
    const top = head.y + 0.28 // sommet du crâne et coiffure
    const mid = top / 2
    camera.position.set(0.45, mid + 0.08, 4.4 * (top / 1.62))
    camera.lookAt(0, mid, 0)
  }
  renderer.render(scene, camera)
  ;(window as unknown as { __ready: boolean }).__ready = true
})
