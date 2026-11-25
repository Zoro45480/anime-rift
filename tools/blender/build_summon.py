"""ANIME RIFT — scène 3D de la cinématique d'invocation, construite avec Blender.

Lancer :  python3 tools/blender/build_summon.py
(nécessite le module Blender :  pip install bpy)

Produit  src/assets/summon/summon.glb  : le portail, ses anneaux d'énergie, les cristaux, les fragments de
dimension, la faille, les colonnes de lumière, le sol fracturé, l'onde de choc et trois caméras animées.
Les noms d'objets et de matériaux sont le contrat avec le moteur du jeu (src/summon/SummonStage.ts),
qui applique les couleurs de la rareté et pilote les effets dynamiques (particules, éclairs, halo).

Repère Blender : le portail est debout dans le plan XZ, la caméra est du côté des Y négatifs. Z = haut.
"""
import math
import os
import random

import bpy
from mathutils import Vector

FPS = 30
LOOP = 240  # durée de la boucle d'ambiance et des plans caméra (8 s)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'summon', 'summon.glb')
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = LOOP + 1


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    return m


def add_mesh(name, verts, faces, mat, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    return obj


def key(obj, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert('location', frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert('rotation_euler', frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert('scale', frame=frame)


def linear(obj):
    """Interpolation linéaire, pour des rotations qui bouclent sans à-coup."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return
    for layer in ad.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'LINEAR'


def arc_tube(R, r, a0, a1, nseg=24, nrad=8):
    """Portion d'anneau (tube) dans le plan XZ, de l'angle a0 à a1."""
    verts, faces = [], []
    for i in range(nseg + 1):
        a = a0 + (a1 - a0) * i / nseg
        cx, cz = math.cos(a) * R, math.sin(a) * R
        for j in range(nrad):
            b = 2 * math.pi * j / nrad
            rr = R + math.cos(b) * r
            verts.append((math.cos(a) * rr, math.sin(b) * r, math.sin(a) * rr))
    for i in range(nseg):
        for j in range(nrad):
            a = i * nrad + j
            b = i * nrad + (j + 1) % nrad
            faces.append((a, b, b + nrad, a + nrad))
    return verts, faces


def merge(parts):
    verts, faces = [], []
    for v, f in parts:
        off = len(verts)
        verts += v
        faces += [tuple(i + off for i in face) for face in f]
    return verts, faces


def box(cx, cy, cz, sx, sy, sz, angle=0.0):
    """Petit pavé, tourné de `angle` autour de Y (dans le plan du portail)."""
    verts = []
    for dx in (-1, 1):
        for dy in (-1, 1):
            for dz in (-1, 1):
                x, z = dx * sx / 2, dz * sz / 2
                verts.append((cx + x * math.cos(angle) - z * math.sin(angle), cy + dy * sy / 2, cz + x * math.sin(angle) + z * math.cos(angle)))
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return verts, faces


# --- 1. Cadre du portail : un anneau massif, crénelé de douze runes -------------------------------------------
parts = [arc_tube(2.05, 0.11, 0, 2 * math.pi, 96, 10)]
for i in range(12):
    a = 2 * math.pi * i / 12
    big = i % 3 == 0
    rad = 2.05 + (0.3 if big else 0.2)
    parts.append(box(math.cos(a) * rad, 0, math.sin(a) * rad, 0.42 if big else 0.26, 0.16, 0.13, a + math.pi / 2))
frame = add_mesh('PortalFrame', *merge(parts), 'M_Frame', smooth=True)
key(frame, 1, rot=(0, 0, 0))
key(frame, LOOP + 1, rot=(0, -2 * math.pi, 0))
linear(frame)

# Disque du portail (le moteur y applique un tourbillon) et onde de choc
N = 64
disc = add_mesh('PortalDisc', [(0, 0, 0)] + [(math.cos(2 * math.pi * i / N) * 1.98, 0, math.sin(2 * math.pi * i / N) * 1.98) for i in range(N)],
                [(0, 1 + i, 1 + (i + 1) % N) for i in range(N)], 'M_Disc')
ring_v = [(math.cos(2 * math.pi * i / N) * r, 0, math.sin(2 * math.pi * i / N) * r) for r in (0.86, 1.0) for i in range(N)]
shock = add_mesh('Shock', ring_v, [(i, (i + 1) % N, N + (i + 1) % N, N + i) for i in range(N)], 'M_Shock')

# --- 2. Anneaux d'énergie : arcs ouverts, chacun sur son orbite inclinée -------------------------------------
RINGS = [  # rayon, épaisseur, nombre d'arcs, part ouverte, inclinaison (x, z), tours par boucle
    (2.55, 0.035, 3, 0.22, (0.0, 0.0), 2),
    (3.05, 0.05, 5, 0.3, (0.5, 0.2), -1),
    (3.6, 0.03, 2, 0.12, (-0.75, -0.35), 1),
    (4.25, 0.06, 7, 0.4, (0.28, 0.9), -1),
    (5.0, 0.025, 4, 0.18, (1.1, -0.5), 1),
]
for i, (R, r, arcs, gap, tilt, turns) in enumerate(RINGS, start=1):
    span = 2 * math.pi / arcs
    ring = add_mesh(f'Ring_{i}', *merge([arc_tube(R, r, k * span, k * span + span * (1 - gap), 28, 6) for k in range(arcs)]), 'M_Ring', smooth=True)
    pivot = bpy.data.objects.new(f'RingPivot_{i}', None)  # porte l'inclinaison ; l'anneau tourne dedans
    scene.collection.objects.link(pivot)
    pivot.rotation_euler = (tilt[0], 0, tilt[1])
    ring.parent = pivot
    key(ring, 1, rot=(0, 0, 0))
    key(ring, LOOP + 1, rot=(0, turns * 2 * math.pi, 0))
    linear(ring)


# --- 3. Cristaux flottants : bipyramides à six pans ---------------------------------------------------------
def bipyramid(h, r, n=6):
    verts = [(0, 0, h * 0.5)]
    verts += [(math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r, h * 0.16) for i in range(n)]
    verts += [(math.cos(2 * math.pi * i / n) * r * 0.86, math.sin(2 * math.pi * i / n) * r * 0.86, -h * 0.12) for i in range(n)]
    verts.append((0, 0, -h * 0.5))
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    faces += [(1 + i, 1 + n + i, 1 + n + (i + 1) % n, 1 + (i + 1) % n) for i in range(n)]
    faces += [(2 * n + 1, 1 + n + (i + 1) % n, 1 + n + i) for i in range(n)]
    return verts, faces


for i in range(1, 15):
    a = 2 * math.pi * i / 14 + random.uniform(-0.15, 0.15)
    rad = random.uniform(3.1, 5.6)
    h = random.uniform(0.5, 1.25)
    c = add_mesh(f'Crystal_{i:02d}', *bipyramid(h, h * 0.26), 'M_Crystal')
    base = Vector((math.cos(a) * rad, random.uniform(-1.6, 2.4), math.sin(a) * rad * 0.8))
    tilt = (random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5))
    phase = random.uniform(0, 2 * math.pi)
    amp = random.uniform(0.15, 0.4)
    turns = random.choice((-2, -1, 1, 2))
    for f in range(0, LOOP + 1, 20):  # flottement sinusoïdal et rotation lente, parfaitement bouclés
        t = f / LOOP
        key(c, f + 1, loc=base + Vector((0, 0, math.sin(2 * math.pi * t + phase) * amp)), rot=(tilt[0], tilt[1], turns * 2 * math.pi * t))

# --- 4. Fragments de dimension : éclats plats qui dérivent en profondeur --------------------------------------
for i in range(1, 19):
    pts = sorted([(random.uniform(0.2, 0.75), random.uniform(0, 2 * math.pi)) for _ in range(random.choice((3, 4, 5)))], key=lambda p: p[1])
    n = len(pts)
    front = [(math.cos(a) * r, -0.02, math.sin(a) * r) for r, a in pts]
    back = [(x, 0.02, z) for x, _, z in front]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))] + [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    fr = add_mesh(f'Fragment_{i:02d}', front + back, faces, 'M_Fragment')
    a = random.uniform(0, 2 * math.pi)
    rad = random.uniform(3.4, 8.5)
    base = Vector((math.cos(a) * rad, random.uniform(-3.5, 5.5), math.sin(a) * rad * 0.75))
    spin = [random.choice((-1, 1)) for _ in range(3)]
    for f in range(0, LOOP + 1, 30):
        t = f / LOOP
        key(fr, f + 1, loc=base + Vector((0, 0, math.sin(2 * math.pi * t + i) * 0.3)), rot=tuple(s * 2 * math.pi * t + i for s in spin))
    linear(fr)

# --- 5. La faille : une déchirure verticale en zigzag --------------------------------------------------------
steps = 14
left, right = [], []
for i in range(steps + 1):
    t = i / steps
    z = 3.4 - 6.8 * t
    width = math.sin(math.pi * t) ** 0.7 * 0.62
    jitter = random.uniform(-0.16, 0.16) if 0 < i < steps else 0
    left.append((-width * random.uniform(0.6, 1.0) + jitter, 0.02, z))
    right.append((width * random.uniform(0.6, 1.0) + jitter, 0.02, z))
crack_v = left + list(reversed(right))
crack = add_mesh('Crack', crack_v, [tuple(range(len(crack_v)))], 'M_Crack')

# --- 6. Colonnes de lumière et sol fracturé ------------------------------------------------------------------
FLOOR_Z = -2.75
for i in range(1, 7):
    a = 2 * math.pi * i / 6 + 0.3
    n = 12
    v = [(math.cos(2 * math.pi * k / n) * 0.22, math.sin(2 * math.pi * k / n) * 0.22, z) for z in (0, 15) for k in range(n)]
    beam = add_mesh(f'Beam_{i}', v, [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)], 'M_Beam', smooth=True)
    beam.location = (math.cos(a) * 4.8, 1.2 + math.sin(a) * 2.6, FLOOR_Z)

tile = 0
for ring_i, (ri, ro, count) in enumerate(((0.5, 2.6, 7), (2.75, 5.4, 11), (5.55, 9.5, 15))):
    for k in range(count):
        tile += 1
        a0 = 2 * math.pi * k / count + ring_i * 0.4
        a1 = a0 + 2 * math.pi / count - 0.07 / max(ri, 0.5) - 0.02
        seg = 5
        top = [(math.cos(a0 + (a1 - a0) * s / seg) * r, math.sin(a0 + (a1 - a0) * s / seg) * r, 0) for r in (ri, ro) for s in range(seg + 1)]
        bottom = [(x, y, -0.35) for x, y, _ in top]
        m = seg + 1
        faces = [(s, s + 1, m + s + 1, m + s) for s in range(seg)]
        faces += [(2 * m + s + 1, 2 * m + s, 3 * m + s, 3 * m + s + 1) for s in range(seg)]
        faces += [(0, m, 3 * m, 2 * m), (seg, 2 * m + seg, 3 * m + seg, m + seg)]
        faces += [(s + 1, s, 2 * m + s, 2 * m + s + 1) for s in range(seg)] + [(m + s, m + s + 1, 3 * m + s + 1, 3 * m + s) for s in range(seg)]
        t = add_mesh(f'FloorTile_{tile:02d}', top + bottom, faces, 'M_Floor')
        t.location = (0, 1.2, FLOOR_Z + random.uniform(-0.1, 0.1))
        t.rotation_euler = (random.uniform(-0.04, 0.04), random.uniform(-0.04, 0.04), 0)
glow = add_mesh('FloorGlow', [(math.cos(2 * math.pi * i / 32) * 10, 1.2 + math.sin(2 * math.pi * i / 32) * 10, FLOOR_Z - 0.3) for i in range(32)], [tuple(range(32))], 'M_FloorGlow')


# --- 7. Caméras : trois plans de 8 s, joués selon la rareté ---------------------------------------------------
def camera(name, path):
    """path(t) -> (position, point visé), t de 0 à 1. Une clé toutes les 4 images."""
    data = bpy.data.cameras.new(name)
    data.lens = 28
    data.sensor_fit = 'VERTICAL'
    data.clip_start = 0.1
    data.clip_end = 200
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    for f in range(0, LOOP + 1, 4):
        pos, look = path(f / LOOP)
        rot = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        key(cam, f + 1, loc=pos, rot=rot)
    return cam


def ease(t):
    return t * t * (3 - 2 * t)


def push(t):  # R et SR : lente approche, puis léger recul à la révélation
    if t < 0.8:
        k = ease(t / 0.8)
        return (math.sin(k * 1.2) * 1.2, -13.5 + 7.2 * k, 1.4 - 1.1 * k), (0, 0, 0.1)
    k = ease((t - 0.8) / 0.2)
    return (1.12 - 1.12 * k, -6.3 - 2.2 * k, 0.3 + 0.2 * k), (0, 0, 0.1 + 0.2 * k)


def orbit(t):  # LR : travelling circulaire qui se resserre, puis face au personnage
    if t < 0.8:
        k = ease(t / 0.8)
        ang = -0.75 + 1.25 * k
        dist = 14.5 - 8.0 * k
        return (math.sin(ang) * dist, -math.cos(ang) * dist, 2.6 - 2.2 * k), (0, 0, 0.2)
    k = ease((t - 0.8) / 0.2)
    ang = 0.5 - 0.5 * k
    dist = 6.5 + 2.0 * k
    return (math.sin(ang) * dist, -math.cos(ang) * dist, 0.4 + 0.1 * k), (0, 0, 0.2 + 0.1 * k)


def pull(t):  # MR : la caméra recule et s'élève pour montrer l'immensité, se fige, puis replonge
    if t < 0.62:
        k = ease(t / 0.62)
        return (-0.6 + 3.4 * k, -5.2 - 12.5 * k, 0.1 + 4.2 * k), (0, 0, 0.4 * k)
    if t < 0.8:
        k = (t - 0.62) / 0.18
        return (2.8 + 0.25 * k, -17.7 - 0.5 * k, 4.3 + 0.1 * k), (0, 0, 0.4)
    k = ease((t - 0.8) / 0.2)
    return (3.05 - 3.05 * k, -18.2 + 9.6 * k, 4.4 - 3.9 * k), (0, 0, 0.4 - 0.1 * k)


camera('Cam_Push', push)
camera('Cam_Orbit', orbit)
scene.camera = camera('Cam_Pull', pull)

# --- 8. Export -----------------------------------------------------------------------------------------------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='SCENE',
    export_cameras=True, export_yup=True, export_apply=False, export_materials='EXPORT',
    export_force_sampling=True, export_frame_step=2, export_optimize_animation_size=True,
)
print(f'Blender {bpy.app.version_string} — {len(scene.objects)} objets — {os.path.getsize(OUT) / 1024:.0f} Ko -> {os.path.normpath(OUT)}')
