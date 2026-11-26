"""ANIME RIFT — éléments 3D du profil (Cycles).  →  src/assets/extras/
  frame-t0 … frame-t4, frame-r.png : le cadre de la photo de profil, de plus en plus riche (même paliers que les chiffres du
      niveau : acier, or, braise, plasma, légende, puis arc-en-ciel après une Renaissance). Le centre est vide : la photo s'y loge.
  dist-rebirth / legend / collection / stars / trophy / summon.png : les médaillons des distinctions.
"""
import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'extras')
FRAMES = ['t0', 't1', 't2', 't3', 't4', 'r']
DISTS = ['rebirth', 'legend', 'collection', 'stars', 'trophy', 'summon']
ONLY = sys.argv[1:] or [f'frame-{f}' for f in FRAMES] + [f'dist-{d}' for d in DISTS]
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


def torus(m, R, r, y=0.0, z=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=(0, y, z), rotation=FRONT, major_segments=128, minor_segments=24)
    return add(m)


def blade(m, a, r0, length, width, y=0.0, thick=0.25):
    """Pointe qui rayonne depuis le cercle, dans la direction a."""
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=width, radius2=0, depth=length, location=((r0 + length / 2) * math.cos(a), y, (r0 + length / 2) * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, thick, 1))
    return add(m, smooth=False)


def gem(m, a, r, size, y=-0.12):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(r * math.cos(a), y, r * math.sin(a)), scale=(1, 0.7, 1))
    return add(m, smooth=False)


def sphere(m, loc, r, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, scale=scale, segments=48, ring_count=24)
    return add(m)


def cyl(m, loc, r, d, rot=FRONT, verts=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    return add(m)


def star(m, cx, cz, R, y=0.0, thick=0.35):
    for k in range(5):
        a = k * math.tau / 5 + math.pi / 2
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=R * 0.42, radius2=0, depth=R * 1.0, location=(cx + R * 0.52 * math.cos(a), y, cz + R * 0.52 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, thick, 1))
        add(m, smooth=False)
    cyl(m, (cx, y, cz), R * 0.42, R * 0.3 * thick * 2, verts=5)


# cadre : métal, lueur des gemmes, nombre de pointes, longueur, anneau extérieur, ailes, couronne
FRAME = {
    't0': dict(metal=(0.62, 0.68, 0.82), glow=(0.35, 0.6, 1.0), spikes=0, gems=4),
    't1': dict(metal=(1.0, 0.8, 0.38), glow=(1.0, 0.75, 0.25), spikes=8, length=0.22, gems=4),
    't2': dict(metal=(0.95, 0.35, 0.22), glow=(1.0, 0.25, 0.2), spikes=12, length=0.32, gems=6),
    't3': dict(metal=(0.45, 0.75, 1.0), glow=(0.3, 0.95, 1.0), spikes=12, length=0.34, gems=6, outer=True),
    't4': dict(metal=(1.0, 0.82, 0.45), glow=(1.0, 0.35, 0.8), spikes=16, length=0.4, gems=8, outer=True, wings=True),
    'r': dict(metal=(0.95, 0.95, 1.0), glow=(1.0, 1.0, 1.0), spikes=16, length=0.42, gems=8, outer=True, wings=True, crown=True, rainbow=True),
}
RAINBOW = [(1.0, 0.25, 0.35), (1.0, 0.6, 0.15), (1.0, 0.95, 0.3), (0.3, 1.0, 0.6), (0.25, 0.75, 1.0), (0.75, 0.4, 1.0)]


def frame(key):
    f = FRAME[key]
    metal = mat('Metal', f['metal'], metallic=1.0, rough=0.18, emit=f['metal'], strength=0.12)
    glow = mat('Glow', f['glow'], metallic=0.3, rough=0.08, emit=f['glow'], strength=2.6)
    glows = [mat(f'G{i}', c, metallic=0.3, rough=0.08, emit=c, strength=2.8) for i, c in enumerate(RAINBOW)] if f.get('rainbow') else [glow]
    torus(metal, 1.0, 0.11)
    torus(metal, 0.86, 0.035, y=-0.06)
    torus(glows[0], 0.93, 0.022, y=-0.1)
    if f.get('outer'):
        torus(metal, 1.2, 0.035, y=0.04)
    n = f['spikes']
    for k in range(n):
        a = k * math.tau / n + math.pi / 2
        big = k % 2 == 0
        blade(metal if big else glows[k % len(glows)], a, 1.06, f['length'] * (1.0 if big else 0.6), 0.13 if big else 0.08)
    for k in range(f['gems']):
        a = k * math.tau / f['gems'] + (0 if f['gems'] % 4 else math.pi / 4)
        gem(glows[k % len(glows)], a, 1.0, 0.1)
    if f.get('wings'):
        for sx in (-1, 1):
            for j in range(4):
                a = math.radians(200 - j * 17) if sx < 0 else math.radians(-20 + j * 17)
                blade(metal, a, 1.12, 0.62 - j * 0.1, 0.17 - j * 0.02, y=0.06)
                blade(glows[(j + 2) % len(glows)], a, 1.16, 0.34 - j * 0.05, 0.06, y=-0.04)
    if f.get('crown'):
        for j, da in enumerate((-0.22, 0, 0.22)):
            blade(metal, math.pi / 2 + da, 1.1, 0.5 if j == 1 else 0.36, 0.14)
            gem(glows[j * 2], math.pi / 2 + da, 1.66 if j == 1 else 1.5, 0.07)
    return 3.75 if (f.get('wings') or f.get('crown')) else 3.1


def dist(key):
    gold = mat('Gold', (1.0, 0.8, 0.4), metallic=1.0, rough=0.18, emit=(1.0, 0.65, 0.2), strength=0.2)
    steel = mat('Steel', (0.72, 0.76, 0.9), metallic=1.0, rough=0.2)
    dark = mat('Dark', (0.05, 0.06, 0.12), metallic=0.6, rough=0.3)
    if key == 'rebirth':     # lotus de lumière
        petal = mat('Petal', (1.0, 0.75, 0.5), rough=0.25, emit=(1.0, 0.5, 0.2), strength=0.5)
        core = mat('Core', (1.0, 0.9, 0.5), emit=(1.0, 0.8, 0.3), strength=5.0)
        for ring, (n, r, s) in enumerate(((8, 0.62, 1.0), (6, 0.36, 0.8))):
            for i in range(n):
                a = i * math.tau / n + ring * 0.4
                sphere(petal, (r * math.cos(a), -ring * 0.15, r * math.sin(a) * 0.9), 0.4 * s, scale=(0.5, 0.3, 1.0)).rotation_euler = (0, -a + math.pi / 2, 0)
        sphere(core, (0, -0.35, 0), 0.24)
    elif key == 'legend':    # cristal légendaire couronné d'un anneau
        crystal = mat('Crystal', (1.0, 0.45, 0.8), metallic=0.5, rough=0.06, emit=(1.0, 0.3, 0.7), strength=1.0)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.55, radius2=0, depth=1.05, location=(0, 0, 0.35), rotation=(0, 0, 0)); add(crystal, smooth=False)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.55, radius2=0, depth=0.7, location=(0, 0, -0.52), rotation=(math.pi, 0, 0)); add(crystal, smooth=False)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.85, minor_radius=0.05, location=(0, 0, -0.1), rotation=(1.2, 0.3, 0), major_segments=96); add(gold)
    elif key == 'collection':  # classeur de cartes
        cover = mat('Cover', (0.2, 0.75, 0.55), metallic=0.4, rough=0.3, emit=(0.15, 0.7, 0.5), strength=0.4)
        for o, m, sz in (((0, 0.1, 0), cover, (1.5, 0.3, 1.9)), ((0.05, 0.02, 0), steel, (1.36, 0.26, 1.76))):
            bpy.ops.mesh.primitive_cube_add(size=1, location=o, scale=sz); bx = add(m, smooth=False)
            bv = bx.modifiers.new('b', 'BEVEL'); bv.width, bv.segments = 0.06, 3
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.14, 0), scale=(1.5, 0.06, 1.9)); bx = add(cover, smooth=False)
        bv = bx.modifiers.new('b', 'BEVEL'); bv.width, bv.segments = 0.06, 3
        star(gold, 0, 0.05, 0.42, y=-0.2)
        for o in list(bpy.context.scene.objects):
            o.rotation_euler.rotate_axis('Z', math.radians(0))
    elif key == 'stars':     # trois étoiles
        s = mat('Star', (1.0, 0.82, 0.3), metallic=0.8, rough=0.15, emit=(1.0, 0.7, 0.15), strength=1.2)
        star(s, 0, 0.3, 0.72)
        star(s, -0.75, -0.5, 0.42, y=0.1)
        star(s, 0.75, -0.5, 0.42, y=0.1)
    elif key == 'trophy':    # coupe
        cyl(gold, (0, 0, 0.35), 0.75, 1.0, rot=(math.pi, 0, 0), r2=0.3)
        cyl(dark, (0, 0, 0.84), 0.66, 0.04, rot=(0, 0, 0))
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.06, location=(sx * 0.78, 0, 0.45), rotation=FRONT); add(gold)
        cyl(gold, (0, 0, -0.38), 0.12, 0.5, rot=(0, 0, 0))
        cyl(gold, (0, 0, -0.7), 0.5, 0.16, rot=(0, 0, 0))
        cyl(dark, (0, 0, -0.9), 0.62, 0.24, rot=(0, 0, 0))
        star(mat('S', (1, 1, 1), emit=(1, 0.95, 0.8), strength=3.0), 0, 0.42, 0.26, y=-0.62)
    else:                    # summon : portail d'invocation
        ring = mat('Ring', (0.5, 0.6, 1.0), metallic=1.0, rough=0.2)
        disc = mat('Disc', (0.4, 0.7, 1.0), emit=(0.35, 0.6, 1.0), strength=3.5)
        violet = mat('Violet', (0.7, 0.4, 1.0), emit=(0.7, 0.35, 1.0), strength=3.0)
        torus(ring, 0.95, 0.12)
        cyl(disc, (0, 0.1, 0), 0.86, 0.04)
        torus(violet, 0.6, 0.03, y=-0.05)
        torus(violet, 0.3, 0.03, y=-0.08)
        for k in range(6):
            blade(ring, k * math.tau / 6 + math.pi / 2, 1.02, 0.3, 0.12)
    return 2.95


for name in ONLY:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kind, key = name.split('-', 1)
    ortho = frame(key) if kind == 'frame' else dist(key)
    tgt = bpy.data.objects.new('T', None)
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in (((-3, -5, 4), 650, (1, 0.97, 0.94), 4), ((4, -2, 1), 420, lin((0.45, 0.85, 1.0)), 3), ((-3, 2, -2), 360, lin((0.85, 0.4, 1.0)), 3), ((0, -4, -3), 120, (0.7, 0.8, 1), 3)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.14, 0.24, 1)
    sc = bpy.context.scene
    sc.world = world
    front = kind == 'frame'
    bpy.ops.object.camera_add(location=(0, -8, 0) if front else (1.0, -8, 0.9))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho
    cam.constraints.new('TRACK_TO').target = tgt
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 360 if front else 192
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
