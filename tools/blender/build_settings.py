"""ANIME RIFT — icônes 3D des Paramètres (Cycles).  →  src/assets/extras/set-<nom>.png
gear (titre), profile, sound, graphics, phone, cards (doublons), medal (titres), reset.
"""
import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'extras')
ALL = ['gear', 'profile', 'sound', 'graphics', 'phone', 'cards', 'medal', 'reset']
ONLY = [a for a in sys.argv[1:] if a in ALL] or ALL
lin = lambda c: tuple(x ** 2.2 for x in c)
FRONT = (math.pi / 2, 0, 0)


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


def box(m, loc, scale, rot=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=scale, rotation=rot)
    o = add(m, smooth=False)
    if bevel:
        bv = o.modifiers.new('b', 'BEVEL')
        bv.width, bv.segments = bevel, 4
    return o


def cyl(m, loc, r, d, rot=FRONT, verts=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    return add(m)


def sphere(m, loc, r, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, scale=scale, segments=48, ring_count=24)
    return add(m)


def torus(m, loc, R, r, rot=FRONT):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=72)
    return add(m)


def arc(m, cx, cz, R, a0, a1, thick, y=0.0, n=40):
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        sphere(m, (cx + R * math.cos(a), y, cz + R * math.sin(a)), thick)


def build(key):
    steel = mat('Steel', (0.72, 0.76, 0.88), metallic=1.0, rough=0.2)
    gold = mat('Gold', (1.0, 0.8, 0.4), metallic=1.0, rough=0.18, emit=(1.0, 0.65, 0.2), strength=0.2)
    dark = mat('Dark', (0.06, 0.07, 0.13), metallic=0.7, rough=0.3)
    cyan = mat('Cyan', (0.3, 0.9, 1.0), emit=(0.3, 0.9, 1.0), strength=3.0)
    violet = mat('Violet', (0.65, 0.4, 1.0), metallic=0.4, rough=0.12, emit=(0.6, 0.35, 1.0), strength=0.9)
    red = mat('Red', (1.0, 0.25, 0.35), metallic=0.5, rough=0.25, emit=(1.0, 0.15, 0.25), strength=1.0)
    if key == 'gear':
        torus(steel, (0, 0, 0), 0.72, 0.26)
        for k in range(8):
            a = k * math.tau / 8
            box(steel, (1.02 * math.cos(a), 0, 1.02 * math.sin(a)), (0.34, 0.5, 0.36), rot=(0, -a, 0))
        cyl(dark, (0, 0, 0), 0.5, 0.3)
        sphere(cyan, (0, -0.12, 0), 0.26)
        torus(gold, (0, -0.2, 0), 0.5, 0.05)
    elif key == 'profile':
        torus(gold, (0, 0, 0), 1.08, 0.09)
        cyl(dark, (0, 0.1, 0), 1.05, 0.1)
        sphere(violet, (0, -0.15, 0.3), 0.42)
        sphere(violet, (0, -0.15, -0.72), 0.72, scale=(1, 0.6, 0.62))
    elif key == 'sound':
        box(steel, (-0.72, 0, 0), (0.42, 0.5, 0.6))
        cyl(steel, (-0.2, 0, 0), 0.3, 0.75, rot=(0, math.pi / 2, 0), r2=0.72)
        cyl(dark, (0.18, 0, 0), 0.68, 0.04, rot=(0, math.pi / 2, 0))
        for R in (0.55, 0.9):
            arc(cyan, 0.1, 0, R, -0.75, 0.75, 0.065, y=-0.1)
    elif key == 'graphics':
        box(steel, (0, 0.1, 0.05), (2.1, 0.16, 1.45), bevel=0.1)
        box(dark, (0, 0, 0.05), (1.86, 0.1, 1.2), bevel=0.04)
        box(steel, (0, 0.1, -0.95), (0.9, 0.3, 0.12))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, -0.3, 0.07), scale=(1, 0.6, 1.15))
        add(violet, smooth=False)
        for x, z in ((-0.62, 0.42), (0.62, -0.3), (0.55, 0.45)):
            sphere(cyan, (x, -0.1, z), 0.05)
    elif key == 'phone':
        root = [box(steel, (0, 0.05, 0), (1.15, 0.16, 2.1), bevel=0.14), box(dark, (0, -0.03, 0.04), (0.98, 0.06, 1.72), bevel=0.06)]
        root.append(box(cyan, (0, -0.08, -0.05), (0.09, 0.03, 0.75), bevel=0))                 # flèche vers le bas : installer
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.3, radius2=0, depth=0.05, location=(0, -0.08, -0.48), rotation=(math.pi / 2, math.pi, 0)); root.append(add(cyan, smooth=False))
        root.append(box(cyan, (0, -0.08, -0.72), (0.6, 0.03, 0.07), bevel=0))
        for o in root:
            o.rotation_euler.rotate_axis('Y', math.radians(-12))
            o.location.rotate(bpy.context.object.rotation_euler.to_matrix().to_euler()) if False else None
    elif key == 'cards':
        for k, (x, rot, m) in enumerate(((-0.34, 0.26, steel), (0.3, -0.2, gold))):
            o = box(m, (x, 0.15 - k * 0.2, 0), (1.05, 0.07, 1.55), rot=(0, rot, 0), bevel=0.07)
            box(dark, (x, 0.1 - k * 0.2, 0), (0.86, 0.03, 1.34), rot=(0, rot, 0), bevel=0.03)
        for k in range(5):                                                                        # étoile sur la carte du dessus
            a = k * math.tau / 5 + math.pi / 2 + 0.2
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.16, radius2=0, depth=0.4, location=(0.3 + 0.2 * math.cos(a), -0.14, 0.02 + 0.2 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, 0.3, 1))
            add(cyan, smooth=False)
        cyl(cyan, (0.3, -0.14, 0.02), 0.16, 0.05, verts=5)
    elif key == 'medal':
        for sx in (-1, 1):
            box(red, (sx * 0.3, 0.1, 0.72), (0.42, 0.06, 1.0), rot=(0, sx * 0.3, 0), bevel=0.02)
        cyl(gold, (0, 0, -0.3), 0.78, 0.16)
        torus(gold, (0, -0.02, -0.3), 0.78, 0.07)
        for k in range(5):
            a = k * math.tau / 5 + math.pi / 2
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.2, radius2=0, depth=0.5, location=(0.25 * math.cos(a), -0.12, -0.3 + 0.25 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, 0.3, 1))
            add(steel, smooth=False)
        cyl(steel, (0, -0.12, -0.3), 0.2, 0.06, verts=5)
    else:  # reset : une flèche qui boucle
        arc(red, 0, 0, 0.85, math.radians(60), math.radians(360), 0.13, n=60)
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.42, radius2=0, depth=0.26, location=(0.85 * math.cos(math.radians(60)) + 0.1, 0, 0.85 * math.sin(math.radians(60)) + 0.03), rotation=(math.pi / 2, math.radians(150), 0))
        add(red, smooth=False)
        sphere(steel, (0, 0, 0), 0.22)


for key in ONLY:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build(key)
    tgt = bpy.data.objects.new('T', None)
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in (((-3, -5, 4), 600, (1, 0.97, 0.94), 4), ((4, -2, 1), 420, lin((0.4, 0.85, 1.0)), 3), ((-3, 2, -2), 340, lin((0.8, 0.4, 1.0)), 3), ((0, -4, -3), 110, (0.7, 0.8, 1), 3)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.14, 0.12, 0.22, 1)
    sc = bpy.context.scene
    sc.world = world
    bpy.ops.object.camera_add(location=(1.2, -8, 1.0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.1
    cam.constraints.new('TRACK_TO').target = tgt
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 192
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, f'set-{key}.png')
    bpy.ops.render.render(write_still=True)
