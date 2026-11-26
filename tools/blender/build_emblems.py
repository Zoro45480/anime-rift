"""ANIME RIFT — emblème 3D de chaque bannière : un objet qui évoque son animé (Cycles).
Lancer :  python3 tools/blender/build_emblems.py [naruto onepiece …]   →  src/assets/extras/emblem-<bannière>.png
  naruto : shuriken et kunai · onepiece : chapeau de paille · dragonball : boule de cristal à quatre étoiles ·
  bleach : sabre noir à garde en svastika · demonslayer : boucle d'oreille hanafuda · jujutsu : bouton doré à spirale ·
  hunter : licence de Hunter.
"""
import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'extras')
ALL = ['naruto', 'onepiece', 'dragonball', 'bleach', 'demonslayer', 'jujutsu', 'hunter']
ONLY = [a for a in sys.argv[1:] if a in ALL] or ALL
lin = lambda c: tuple(x ** 2.2 for x in c)


def mat(name, color, metallic=0.0, rough=0.4, emit=None, strength=0.0):
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


def add(m, smooth=True):
    o = bpy.context.object
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def box(m, loc, scale, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=scale, rotation=rot)
    o = add(m, smooth=False)
    if bevel:
        bv = o.modifiers.new('b', 'BEVEL')
        bv.width, bv.segments = bevel, 3
    return o


def cyl(m, loc, r, d, rot=(0, 0, 0), verts=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    return add(m)


def sphere(m, loc, r, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, scale=scale, segments=48, ring_count=24)
    return add(m)


def torus(m, loc, R, r, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=64)
    return add(m)


FRONT = (math.pi / 2, 0, 0)  # couché face à la caméra (qui regarde le long de +Y)


def naruto():
    steel = mat('Steel', (0.6, 0.63, 0.72), metallic=1.0, rough=0.22)
    wrap = mat('Wrap', (0.9, 0.45, 0.1), rough=0.6, emit=(0.9, 0.4, 0.05), strength=0.25)
    for k in range(4):                                   # shuriken à quatre branches
        a = k * math.pi / 2 + 0.4
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.34, radius2=0, depth=1.05, location=(-0.25 + 0.52 * math.cos(a), 0.15, 0.25 + 0.52 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, 0.18, 1))
        add(steel, smooth=False)
    torus(steel, (-0.25, 0.12, 0.25), 0.2, 0.07, rot=FRONT)
    # kunai en diagonale, devant
    ang = math.radians(-38)
    root = bpy.data.objects.new('Kunai', None)
    bpy.context.collection.objects.link(root)
    parts = []
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.3, radius2=0, depth=1.1, location=(0, 0, 0.75), scale=(1, 0.3, 1)); parts.append(add(steel, smooth=False))
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.3, radius2=0, depth=0.35, location=(0, 0, 0.03), rotation=(math.pi, 0, 0), scale=(1, 0.3, 1)); parts.append(add(steel, smooth=False))
    parts.append(cyl(wrap, (0, 0, -0.5), 0.085, 0.75, verts=24))
    parts.append(torus(steel, (0, 0, -1.05), 0.17, 0.045, rot=FRONT))
    for o in parts:
        o.parent = root
    root.rotation_euler = (0, ang, 0)
    root.location = (0.35, -0.3, -0.05)
    return (1.0, 0.55, 0.15)


def onepiece():
    straw = mat('Straw', (0.95, 0.78, 0.36), rough=0.75, emit=(0.9, 0.7, 0.25), strength=0.15)
    red = mat('Band', (0.82, 0.07, 0.08), rough=0.45, emit=(0.8, 0.05, 0.05), strength=0.3)
    tilt = (math.radians(62), 0, math.radians(8))
    brim = cyl(straw, (0, 0, -0.15), 1.25, 0.07, rot=tilt)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.68, location=(0, -0.13, 0.12), scale=(1, 1, 0.78), rotation=tilt, segments=48, ring_count=24)
    add(straw)
    torus(red, (0, -0.07, -0.02), 0.69, 0.1, rot=tilt)
    return (1.0, 0.8, 0.35)


def dragonball():
    orb = mat('Orb', (1.0, 0.55, 0.05), metallic=0.2, rough=0.04, emit=(1.0, 0.5, 0.05), strength=0.9)
    star = mat('Star', (0.9, 0.05, 0.03), emit=(0.95, 0.06, 0.03), strength=2.0)
    sphere(orb, (0, 0, 0), 1.0)
    for x, z in ((-0.3, 0.28), (0.3, 0.28), (-0.3, -0.3), (0.3, -0.3)):   # quatre étoiles
        for k in range(5):
            a = k * math.tau / 5 + math.pi / 2
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.085, radius2=0, depth=0.2, location=(x + 0.11 * math.cos(a), -0.93, z + 0.11 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, 0.3, 1))
            add(star, smooth=False)
        cyl(star, (x, -0.93, z), 0.085, 0.05, rot=FRONT, verts=5)
    return (1.0, 0.65, 0.2)


def bleach():
    blade = mat('Blade', (0.03, 0.03, 0.05), metallic=1.0, rough=0.18)
    edge = mat('Edge', (0.85, 0.1, 0.12), emit=(0.9, 0.08, 0.1), strength=1.6)
    wrapm = mat('Wrap', (0.5, 0.05, 0.07), rough=0.6)
    root = bpy.data.objects.new('Sword', None)
    bpy.context.collection.objects.link(root)
    parts = [box(blade, (0, 0, 0.45), (0.36, 0.07, 1.9), bevel=0.03), box(edge, (0.18, -0.03, 0.45), (0.05, 0.04, 1.85), bevel=0),
             cyl(wrapm, (0, 0, -0.98), 0.12, 0.75, verts=16)]
    for k in range(4):                                   # garde en forme de manji
        a = k * math.pi / 2
        parts.append(box(blade, (0.17 * math.cos(a), -0.02, -0.55 + 0.17 * math.sin(a)), (0.4, 0.1, 0.1), rot=(0, -a, 0), bevel=0.01))
        parts.append(box(blade, (0.32 * math.cos(a) - 0.08 * math.sin(a), -0.02, -0.55 + 0.32 * math.sin(a) + 0.08 * math.cos(a)), (0.1, 0.1, 0.24), rot=(0, -a, 0), bevel=0.01))
    for o in parts:
        o.parent = root
    root.rotation_euler = (0, math.radians(38), 0)
    root.location = (0.15, 0, 0.1)
    root.scale = (1.15, 1.15, 1.15)
    return (1.0, 0.25, 0.3)


def demonslayer():
    card = mat('Card', (0.97, 0.95, 0.9), rough=0.4, emit=(1, 1, 1), strength=0.25)
    red = mat('Sun', (0.85, 0.08, 0.08), rough=0.4, emit=(0.9, 0.06, 0.06), strength=0.9)
    gold = mat('Gold', (1.0, 0.8, 0.4), metallic=1.0, rough=0.2)
    torus(gold, (0, 0, 1.02), 0.13, 0.03, rot=FRONT)
    box(card, (0, 0, 0), (0.86, 0.07, 1.7), bevel=0.05)
    sphere(red, (0, -0.02, 0.36), 0.3, scale=(1, 0.2, 1))            # soleil levant
    for k in range(-5, 6):                                              # rayons
        a = math.radians(90 + k * 13)
        box(red, (0.42 * math.cos(a) * 0.9, -0.04, 0.36 + 0.52 * math.sin(a) * 0.9), (0.025, 0.02, 0.4), rot=(0, -a + math.pi / 2, 0), bevel=0)
    box(red, (0, -0.04, -0.52), (0.86, 0.02, 0.5), bevel=0)             # bande rouge du bas
    return (0.3, 1.0, 0.7)


def jujutsu():
    gold = mat('Gold', (1.0, 0.78, 0.35), metallic=1.0, rough=0.2, emit=(1.0, 0.65, 0.15), strength=0.25)
    dark = mat('Dark', (0.2, 0.11, 0.02), metallic=1.0, rough=0.35)
    cyl(gold, (0, 0, 0), 1.0, 0.16, rot=FRONT)
    torus(gold, (0, -0.02, 0), 1.0, 0.09, rot=FRONT)
    pts, n = [], 120                                                    # spirale gravée
    for i in range(n):
        t = i / n * math.tau * 2.4
        r = 0.1 + 0.3 * t / math.tau
        sphere(dark, (r * math.cos(t), -0.1, r * math.sin(t)), 0.055)
    return (0.55, 0.5, 1.0)


def hunter():
    card = mat('Card', (0.86, 0.88, 0.94), metallic=0.85, rough=0.22, emit=(0.8, 0.85, 1.0), strength=0.12)
    black = mat('Black', (0.03, 0.03, 0.05), rough=0.35)
    red = mat('Red', (0.85, 0.08, 0.1), rough=0.35, emit=(0.9, 0.06, 0.08), strength=0.6)
    root = bpy.data.objects.new('Card', None)
    bpy.context.collection.objects.link(root)
    parts = [box(card, (0, 0, 0), (2.0, 0.06, 1.3), bevel=0.08), box(black, (0, -0.035, 0.38), (2.0, 0.02, 0.26), bevel=0), box(red, (0, -0.035, -0.5), (2.0, 0.02, 0.1), bevel=0)]
    for sx in (-0.2, 0.2):                                              # double X de l'Association
        for a in (0.6, -0.6):
            parts.append(box(red, (sx, -0.04, -0.08), (0.08, 0.02, 0.5), rot=(0, a, 0), bevel=0))
    for o in parts:
        o.parent = root
    root.rotation_euler = (math.radians(-12), math.radians(-14), math.radians(-18))
    return (0.3, 1.0, 0.5)


for key in ONLY:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rim = globals()[key]()
    tgt = bpy.data.objects.new('T', None)
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in (((-3, -5, 4), 650, (1, 0.97, 0.92), 4), ((4, -2, 1), 450, lin(rim), 3), ((-3, 2, -2), 350, lin(rim), 3), ((0, -4, -3), 120, (0.7, 0.8, 1), 3)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.14, 0.12, 0.2, 1)
    sc = bpy.context.scene
    sc.world = world
    bpy.ops.object.camera_add(location=(0, -8, 0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.9
    cam.constraints.new('TRACK_TO').target = tgt
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 256
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, f'emblem-{key}.png')
    bpy.ops.render.render(write_still=True)
