"""ANIME RIFT — illustrations 3D des portes du Nexus (Cycles).

Lancer :  python3 tools/blender/build_gates.py            (toutes)
          python3 tools/blender/build_gates.py spire      (une seule)

Produit  src/assets/gates/<nom>.png  (fond noir, lumières à la couleur de la porte) :
  saga    — un torii devant une faille lumineuse.
  raids   — l'épée d'un colosse plantée dans un sol fissuré.
  spire   — une pagode sans fin, entourée d'anneaux.
  arena   — deux sabres croisés au-dessus d'un cercle de duel.
  rebirth — un lotus de lumière : la Renaissance.
"""
import math
import os
import random
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'gates')
lin = lambda c: tuple(x ** 2.2 for x in c)
HUES = {'saga': (0.17, 0.85, 0.95), 'raids': (1.0, 0.22, 0.55), 'spire': (1.0, 0.72, 0.18), 'arena': (1.0, 0.4, 0.15), 'rebirth': (1.0, 0.62, 0.2)}
ONLY = [a for a in sys.argv[1:] if a in HUES] or list(HUES)


def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def put(m, smooth=True):
    o = bpy.context.object
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def box(m, loc, scale, rot=(0, 0, 0), bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=scale, rotation=rot)
    o = put(m, smooth=False)
    if bevel:
        b = o.modifiers.new('b', 'BEVEL')
        b.width, b.segments = bevel, 2
    return o


def cyl(m, loc, r, h, rot=(0, 0, 0), verts=48, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=loc, rotation=rot)
    return put(m)


def torus(m, loc, R, r, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=96, minor_segments=16)
    return put(m)


def shards(m, n, spread, zmin, zmax, size=0.12, seed=1):
    random.seed(seed)
    for _ in range(n):
        loc = (random.uniform(-spread, spread), random.uniform(-1.5, 2.5), random.uniform(zmin, zmax))
        s = random.uniform(0.4, 1.2) * size
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=s, location=loc, scale=(1, 1, random.uniform(1.5, 3)),
                                              rotation=(random.random() * 3, random.random() * 3, random.random() * 3))
        put(m, smooth=False)


def ground(hue, crack=False):
    g = mat('Ground', (0.012, 0.013, 0.02), rough=0.28, metallic=0.85)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    put(g)


def saga(h, glow, dark, metal):
    red = mat('Lacquer', (0.75, 0.08, 0.07), rough=0.3)
    black = mat('Black', (0.03, 0.03, 0.04), rough=0.4)
    for x in (-1.7, 1.7):
        cyl(red, (x, 0, 1.9), 0.2, 3.8)
        cyl(black, (x, 0, 0.2), 0.28, 0.4)
    box(red, (0, 0, 3.1), (4.3, 0.26, 0.26))
    box(red, (0, 0, 3.85), (5.0, 0.34, 0.3))
    box(black, (0, 0, 4.12), (5.5, 0.44, 0.2))
    box(black, (0, 0, 3.45), (0.34, 0.16, 0.5))
    for i in range(5):  # marches
        box(dark, (0, -1.2 - i * 0.55, 0.12 - i * 0.05 + 0.1), (5.2 + i * 0.5, 0.56, 0.2 - 0.0), bevel=0.02)
    # la faille : un disque de lumière derrière le torii, cerclé d'anneaux
    cyl(glow, (0, 3.2, 2.6), 2.1, 0.05, rot=(math.pi / 2, 0, 0), verts=96)
    torus(metal, (0, 3.1, 2.6), 2.35, 0.07, rot=(math.pi / 2, 0, 0))
    torus(glow, (0, 3.0, 2.6), 2.75, 0.03, rot=(math.pi / 2, 0.2, 0))
    shards(glow, 34, 4.5, 0.6, 5.2, seed=3)
    return (0, -9.5, 1.5), (0, 0, 2.4), 34


def raids(h, glow, dark, metal):
    steel = mat('Steel', (0.5, 0.52, 0.6), metallic=1.0, rough=0.2)
    tilt = (0, math.radians(14), math.radians(20))
    root = bpy.data.objects.new('Sword', None)
    bpy.context.collection.objects.link(root)
    parts = [box(steel, (0, 0, 2.6), (0.9, 0.12, 5.2), bevel=0.05),      # lame
             box(glow, (0, -0.07, 2.6), (0.1, 0.02, 4.6), bevel=0),      # gouttière lumineuse
             box(metal, (0, 0, 5.3), (2.6, 0.3, 0.3)),                   # garde
             cyl(dark, (0, 0, 6.0), 0.16, 1.2),                           # poignée
             cyl(metal, (0, 0, 6.75), 0.3, 0.3)]                          # pommeau
    for p in parts:
        p.parent = root
    root.rotation_euler = tilt
    root.location = (0.3, 0, -0.9)
    # sol fissuré : des dalles brisées et des fissures de lumière qui partent de l'épée
    random.seed(7)
    for i in range(9):
        a = i / 9 * math.tau + random.uniform(-0.2, 0.2)
        L = random.uniform(2.5, 5.5)
        box(glow, (math.cos(a) * L / 2, math.sin(a) * L / 2, 0.012), (L, 0.07, 0.02), rot=(0, 0, a), bevel=0)
    for _ in range(16):
        a, d = random.uniform(0, math.tau), random.uniform(0.9, 4.5)
        box(dark, (math.cos(a) * d, math.sin(a) * d, 0.1), (random.uniform(0.5, 1.2), random.uniform(0.4, 0.9), random.uniform(0.2, 0.7)),
            rot=(random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.random() * 3), bevel=0.02)
    shards(glow, 26, 4.5, 0.5, 6, seed=5)
    return (0, -11, 2.2), (0.2, 0, 3.0), 36


def spire(h, glow, dark, metal):
    wall = mat('Wall', (0.12, 0.1, 0.16), rough=0.5)
    roof = mat('Roof', (0.05, 0.05, 0.09), rough=0.3, metallic=0.5)
    z, r = 0.0, 1.5
    for i in range(9):
        hh = 0.9
        cyl(wall, (0, 0, z + hh / 2), r, hh, verts=8, r2=r * 0.93)
        cyl(glow, (0, 0, z + hh * 0.5), r * 0.975, 0.22, verts=8)        # fenêtres éclairées
        cyl(roof, (0, 0, z + hh + 0.09), r * 1.55, 0.2, verts=8, r2=r * 0.85)
        torus(metal, (0, 0, z + hh + 0.02), r * 1.52, 0.035).rotation_euler = (0, 0, math.pi / 8)
        z += hh + 0.22
        r *= 0.88
    cyl(metal, (0, 0, z + 0.7), 0.06, 1.4, r2=0.0)
    for k, (R, zz, tx) in enumerate([(3.0, 2.6, 0.25), (2.5, 5.2, -0.3), (1.9, 7.6, 0.2)]):  # anneaux en orbite
        torus(glow, (0, 0, zz), R, 0.035, rot=(tx, 0.15 * (k - 1), 0))
    shards(glow, 30, 4.5, 0.5, 9.5, seed=9)
    return (0, -15, 2.0), (0, 0, 5.2), 38


def arena(h, glow, dark, metal):
    steel = mat('Steel', (0.72, 0.75, 0.82), metallic=1.0, rough=0.16)
    wrap = mat('Wrap', (0.07, 0.03, 0.03), rough=0.6)
    for s in (-1, 1):  # deux sabres croisés
        root = bpy.data.objects.new('Katana', None)
        bpy.context.collection.objects.link(root)
        parts = [box(steel, (0, 0, 2.4), (0.2, 0.05, 4.2), bevel=0.02),
                 box(glow, (0.09, -0.03, 2.4), (0.025, 0.02, 4.1), bevel=0),   # tranchant embrasé
                 cyl(metal, (0, 0, 0.25), 0.3, 0.07, verts=6),                 # tsuba
                 cyl(wrap, (0, 0, -0.45), 0.09, 1.3),
                 cyl(metal, (0, 0, -1.13), 0.11, 0.1)]
        for p in parts:
            p.parent = root
        root.rotation_euler = (0, s * math.radians(34), 0)
        root.location = (s * -1.25, s * 0.12, 1.7)
    # le cercle de duel
    torus(glow, (0, 0, 0.03), 3.6, 0.05)
    torus(metal, (0, 0, 0.05), 3.9, 0.1)
    torus(glow, (0, 0, 0.03), 2.2, 0.025)
    for i in range(10):  # piliers autour
        a = i / 10 * math.tau + 0.3
        hh = 1.2 + (i % 3) * 0.6
        if math.sin(a) < 0.1:
            continue  # rien devant les sabres
        box(dark, (math.cos(a) * 5.2, math.sin(a) * 5.2, hh / 2), (0.55, 0.55, hh), rot=(0, 0, a))
        box(glow, (math.cos(a) * 5.2, math.sin(a) * 5.2, hh + 0.06), (0.4, 0.4, 0.08), rot=(0, 0, a), bevel=0)
    shards(glow, 36, 4.5, 0.3, 6, size=0.09, seed=11)
    return (0, -11.5, 2.6), (0, 0, 2.7), 36


def rebirth(h, glow, dark, metal):
    petal = mat('Petal', (1.0, 0.86, 0.6), rough=0.25, emit=(1.0, 0.5, 0.15), strength=0.12)
    for ring, (n, r, tilt, s) in enumerate([(8, 1.6, 1.15, 1.15), (8, 1.15, 0.8, 1.0), (6, 0.7, 0.45, 0.85), (5, 0.3, 0.15, 0.65)]):
        for i in range(n):
            a = i / n * math.tau + ring * 0.39
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(math.cos(a) * r * 0.75, math.sin(a) * r * 0.75, 1.3 + math.cos(tilt) * s * 0.75),
                                                 scale=(0.42 * s, 0.1 * s, 1.0 * s), segments=32, ring_count=16)
            o = put(petal)
            o.rotation_euler = (0, tilt, a)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.42, location=(0, 0, 1.9))
    put(glow)
    cyl(metal, (0, 0, 0.5), 0.5, 1.0, r2=0.2)
    for R, zz, tx in [(2.9, 2.1, 1.35), (3.5, 2.1, 1.2), (2.2, 0.06, 0)]:
        torus(glow if R != 3.5 else metal, (0, 0.4 if tx else 0, zz), R, 0.035 if R != 3.5 else 0.06, rot=(tx, 0, 0))
    shards(glow, 40, 4.5, 0.4, 6, size=0.08, seed=13)
    return (0, -8.5, 3.4), (0, 0, 1.9), 40


SCENES = {'saga': saga, 'raids': raids, 'spire': spire, 'arena': arena, 'rebirth': rebirth}


def build(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    h = HUES[name]
    glow = mat('Glow', h, emit=h, strength=3.2)
    dark = mat('Dark', (0.06, 0.06, 0.09), rough=0.45, metallic=0.3)
    metal = mat('Metal', (0.95, 0.78, 0.4), metallic=1.0, rough=0.22)
    ground(h)
    cam_loc, target, lens = SCENES[name](h, glow, dark, metal)

    tgt = bpy.data.objects.new('Target', None)
    tgt.location = target
    bpy.context.collection.objects.link(tgt)

    def light(loc, energy, color, size=5):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    light((-6, -7, 8), 1700, (1, 0.95, 0.9))
    light((7, 5, 6), 2200, lin(h), size=4)
    light((-7, 4, 3), 1300, lin(h), size=4)
    light((0, -6, 0.6), 500, (0.55, 0.65, 1))

    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (*[c * 0.012 for c in lin(h)], 1)
    sc = bpy.context.scene
    sc.world = world

    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    cam.data.lens = lens
    cam.constraints.new('TRACK_TO').target = tgt
    sc.camera = cam

    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = (880, 620) if name != 'rebirth' else (620, 620)
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)


for n in ONLY:
    build(n)
