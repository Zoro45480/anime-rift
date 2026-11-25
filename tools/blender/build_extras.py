"""ANIME RIFT — éléments 3D des titres, du didacticiel et du seiyū (Cycles).
Lancer :  python3 tools/blender/build_extras.py [ribbons] [guide] [mic]   →  src/assets/extras/
  ribbon-<univers>.png — le bandeau de titre de chaque univers, inspiré de son animé (le titre est écrit dessus par le jeu).
  guide-00 … guide-15.png — Kiri, l'esprit de la faille qui explique le jeu : 16 images d'une vraie animation 3D en boucle
                            (il flotte, ses anneaux tournent, ses éclats orbitent). tools/make_guide_sheet.py les assemble.
  mic.png — le micro du seiyū.
"""
import math
import os
import sys

import bpy
import bmesh  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'extras')
WHAT = [a for a in sys.argv[1:] if a in ('ribbons', 'guide', 'mic')] or ['ribbons', 'guide', 'mic']
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


def scene(res, ortho, cam=(0, -8, 0), target=(0, 0, 0), lights=(), samples=64):
    tgt = bpy.data.objects.new('T', None)
    tgt.location = target
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in lights:
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.12, 0.1, 0.2, 1)
    sc = bpy.context.scene
    sc.world = world
    bpy.ops.object.camera_add(location=cam)
    c = bpy.context.object
    c.data.type = 'ORTHO'
    c.data.ortho_scale = ortho
    c.constraints.new('TRACK_TO').target = tgt
    sc.camera = c
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    return sc


def strip(m, x0, x1, z0, z1, y=0.0, arc=0.06, segs=40, wave=0.0):
    """Bande de tissu légèrement bombée (et ondulée), entre x0 et x1."""
    bm = bmesh.new()
    rows = []
    for i in range(segs + 1):
        x = x0 + (x1 - x0) * i / segs
        dz = -arc * x * x + wave * math.sin(x * 2.6)
        dy = y + 0.05 * math.cos(x * 1.1)
        rows.append((bm.verts.new((x, dy, z0 + dz)), bm.verts.new((x, dy, z1 + dz))))
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], b[0], b[1], a[1]))
    me = bpy.data.meshes.new('Strip')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('Strip', me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    s = o.modifiers.new('s', 'SOLIDIFY')
    s.thickness = 0.03
    return o


def checker(m, c1, c2, scale):
    """Damier (motif ichimatsu) sur une matière."""
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexChecker')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Color1'].default_value = (*lin(c1), 1)
    tex.inputs['Color2'].default_value = (*lin(c2), 1)
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1, 1, 1)
    nt.links.new(coord.outputs['Object'], mp.inputs[0])
    nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    b = nt.nodes['Principled BSDF']
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.3


def stripes(m, c1, c2, scale):
    """Tressage : fines rayures horizontales (la paille du chapeau)."""
    nt = m.node_tree
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = scale
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*lin(c1), 1)
    ramp.color_ramp.elements[1].color = (*lin(c2), 1)
    coord = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(coord.outputs['Object'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], ramp.inputs[0])
    b = nt.nodes['Principled BSDF']
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])


def ball(m, loc, r):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    o = bpy.context.object
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def slab(m, loc, scale, rot=(0, 0, 0), bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=scale, rotation=rot)
    o = bpy.context.object
    o.data.materials.append(m)
    if bevel:
        bv = o.modifiers.new('b', 'BEVEL')
        bv.width, bv.segments = bevel, 3
    return o


def ribbon(key):
    """Le bandeau de titre d'un univers : chacun reprend un objet ou un motif de son animé.
    Le jeu écrit le titre au centre, sur la partie sombre ou unie."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    steel = mat('Steel', (0.72, 0.76, 0.84), metallic=1.0, rough=0.22)
    gold = mat('Gold', (1.0, 0.8, 0.38), metallic=1.0, rough=0.2, emit=(1.0, 0.7, 0.2), strength=0.3)
    rim = (0.6, 0.8, 1.0)
    if key == 'naruto':        # bandeau frontal de ninja : tissu bleu nuit noué, plaque d'acier rivetée
        cloth = mat('Cloth', (0.07, 0.12, 0.32), rough=0.6, emit=(0.07, 0.12, 0.32), strength=0.25)
        strip(cloth, -3.0, 3.0, -0.36, 0.36, wave=0.03)
        slab(steel, (0, -0.1, 0.0), (3.9, 0.08, 0.62), bevel=0.08)
        for sx in (-1, 1):
            for z in (-0.2, 0.2):
                ball(steel, (sx * 1.75, -0.16, z), 0.055)
    elif key == 'onepiece':    # le chapeau de paille : paille tressée et son ruban rouge
        straw = mat('Straw', (0.95, 0.8, 0.4), rough=0.7)
        stripes(straw, (0.8, 0.6, 0.22), (1.0, 0.88, 0.5), 26)
        red = mat('Red', (0.8, 0.07, 0.08), rough=0.4, emit=(0.8, 0.07, 0.08), strength=0.3)
        strip(straw, -3.0, 3.0, -0.48, 0.48, wave=0.03)
        strip(red, -3.0, 3.0, -0.27, 0.27, y=-0.04, wave=0.03)
        rim = (1.0, 0.8, 0.4)
    elif key == 'dragonball':  # tenue orange de l'école de la Tortue, ceinture bleue, boules de cristal
        orange = mat('Gi', (1.0, 0.45, 0.05), rough=0.5, emit=(1.0, 0.42, 0.05), strength=0.3)
        blue = mat('Belt', (0.08, 0.2, 0.6), rough=0.45, emit=(0.08, 0.2, 0.6), strength=0.35)
        crystal = mat('Ball', (1.0, 0.6, 0.1), metallic=0.3, rough=0.05, emit=(1.0, 0.55, 0.05), strength=1.2)
        star = mat('Star', (0.85, 0.05, 0.05), emit=(0.9, 0.05, 0.05), strength=1.5)
        strip(orange, -3.0, 3.0, -0.46, 0.46, wave=0.03)
        strip(blue, -3.0, 3.0, -0.26, 0.26, y=-0.04, wave=0.03)
        for sx in (-1, 1):
            ball(crystal, (sx * 2.75, -0.2, -0.08), 0.36)
            for k in range(4):
                a = k * math.pi / 2 + 0.6
                ball(star, (sx * 2.75 + 0.13 * math.cos(a), -0.55, -0.08 + 0.13 * math.sin(a)), 0.05)
        rim = (1.0, 0.7, 0.3)
    elif key == 'bleach':      # shihakushô noir et haori blanc de capitaine, avec sa rangée de losanges
        black = mat('Black', (0.03, 0.03, 0.04), rough=0.5)
        white = mat('White', (0.96, 0.96, 0.98), rough=0.5, emit=(1, 1, 1), strength=0.25)
        strip(white, -3.0, 3.0, -0.5, 0.5, wave=0.03)
        strip(black, -3.0, 3.0, -0.26, 0.3, y=-0.04, wave=0.03)
        for i in range(-8, 9):
            slab(black, (i * 0.33, -0.06, -0.385 - 0.06 * (i * 0.33) ** 2 + 0.03 * math.sin(i * 0.33 * 2.6)), (0.13, 0.03, 0.13), rot=(0, math.pi / 4, 0), bevel=0)
    elif key == 'demonslayer':  # le haori de Tanjirô : damier vert et noir
        check = mat('Check', (0.1, 0.5, 0.35), rough=0.55)
        checker(check, (0.1, 0.55, 0.38), (0.02, 0.03, 0.03), 5.2)
        black = mat('Black', (0.02, 0.03, 0.03), rough=0.5)
        strip(check, -3.0, 3.0, -0.5, 0.5, wave=0.03)
        strip(black, -2.2, 2.2, -0.24, 0.24, y=-0.04, wave=0.03)
        for z in (0.27, -0.33):
            strip(gold, -2.2, 2.2, z, z + 0.05, y=-0.06, wave=0.03)
        rim = (0.4, 1.0, 0.7)
    elif key == 'jujutsu':     # uniforme bleu nuit de l'école d'exorcisme et ses boutons dorés à spirale
        navy = mat('Uniform', (0.05, 0.07, 0.2), rough=0.5, emit=(0.05, 0.07, 0.25), strength=0.3)
        red = mat('Lining', (0.7, 0.05, 0.12), rough=0.4, emit=(0.7, 0.05, 0.12), strength=0.4)
        strip(red, -3.0, 3.0, -0.48, 0.48, wave=0.03)
        strip(navy, -3.0, 3.0, -0.38, 0.38, y=-0.04, wave=0.03)
        for sx in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.1, location=(sx * 2.6, -0.14, -0.1), rotation=(math.pi / 2, 0, 0))
            bpy.context.object.data.materials.append(gold)
            for k, r in enumerate((0.2, 0.11)):
                bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.025, location=(sx * 2.6, -0.2, -0.1), rotation=(math.pi / 2, 0, 0))
                bpy.context.object.data.materials.append(mat('Dark', (0.25, 0.15, 0.02), metallic=1.0, rough=0.3))
        rim = (0.5, 0.5, 1.0)
    else:                       # hunter : la licence de Hunter, carte argentée barrée de rouge et de noir
        card = mat('Card', (0.86, 0.88, 0.93), metallic=0.8, rough=0.25, emit=(0.8, 0.85, 1.0), strength=0.15)
        black = mat('Black', (0.03, 0.03, 0.05), rough=0.4)
        red = mat('Red', (0.85, 0.08, 0.1), rough=0.35, emit=(0.85, 0.08, 0.1), strength=0.4)
        strip(card, -3.0, 3.0, -0.5, 0.5, wave=0.0, arc=0.02)
        strip(black, -3.0, 3.0, -0.26, 0.28, y=-0.04, wave=0.0, arc=0.02)
        strip(red, -3.0, 3.0, -0.4, -0.31, y=-0.05, wave=0.0, arc=0.02)
        for sx in (-1, 1):       # le double X de l'Association
            for a in (0.6, -0.6):
                slab(card, (sx * 2.6, -0.1, 0.02), (0.07, 0.03, 0.44), rot=(0, a, 0), bevel=0)
    sc = scene((640, 230), 7.4, cam=(0, -8, 0.5), target=(0, 0, -0.25), samples=64,
               lights=(((-3, -5, 4), 520, (1, 0.97, 0.92), 5), ((4, -3, 1), 260, lin(rim), 3), ((0, -4, -3), 120, (0.7, 0.8, 1), 3)))
    sc.render.filepath = os.path.join(OUT, f'ribbon-{key}.png')
    bpy.ops.render.render(write_still=True)


def guide():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = mat('Body', (0.35, 0.75, 1.0), metallic=0.5, rough=0.1, emit=(0.3, 0.6, 1.0), strength=0.55)
    core = mat('Core', (0.8, 0.5, 1.0), emit=(0.75, 0.45, 1.0), strength=4.0)
    eye = mat('Eye', (1, 1, 1), emit=(1, 1, 1), strength=9.0)
    gold = mat('Gold', (1.0, 0.8, 0.4), metallic=1.0, rough=0.18)
    root = bpy.data.objects.new('Kiri', None)
    bpy.context.collection.objects.link(root)

    def child(o, m, smooth=False):
        o.data.materials.append(m)
        o.parent = root
        if smooth:
            for p in o.data.polygons:
                p.use_smooth = True
        return o
    # corps : un cristal à deux pointes
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.8, radius2=0, depth=1.2, location=(0, 0, 0.6))
    child(bpy.context.object, body)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.8, radius2=0, depth=0.85, location=(0, 0, -0.425), rotation=(math.pi, 0, 0))
    child(bpy.context.object, body)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.3, location=(0, 0, 0.1))
    child(bpy.context.object, core)
    for s in (-1, 1):                             # deux yeux lumineux, un peu en amande
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(s * 0.27, -0.66, 0.22), scale=(1, 0.5, 1.5))
        child(bpy.context.object, eye, smooth=True)
    rings = []
    for R, tilt in ((1.25, 1.15), (1.5, 1.85)):
        bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=0.04, location=(0, 0, 0.1), major_segments=96)
        o = child(bpy.context.object, gold, smooth=True)
        o.rotation_euler = (tilt, 0, 0)
        rings.append((o, tilt))
    shards = []
    for k in range(3):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.12, radius2=0, depth=0.34)
        shards.append(child(bpy.context.object, core))

    sc = scene((256, 256), 4.3, cam=(0, -8, 0.6), target=(0, 0, 0.1), samples=48,
               lights=(((-3, -5, 4), 420, (1, 0.97, 1), 4), ((4, 2, 2), 520, lin((0.35, 0.9, 1.0)), 3), ((-4, 3, -1), 380, lin((0.8, 0.35, 1.0)), 3)))
    FRAMES = 16
    for f in range(FRAMES):
        t = f / FRAMES * math.tau
        root.location = (0, 0, 0.14 * math.sin(t))          # il flotte
        root.rotation_euler = (0.06 * math.sin(t), 0, 0.16 * math.sin(t))  # et se balance
        for i, (o, tilt) in enumerate(rings):                # les anneaux basculent en sens inverse l'un de l'autre
            o.rotation_euler = (tilt, 0, t * (1 if i == 0 else -1))
        for k, o in enumerate(shards):                       # les éclats orbitent
            a = t + k * math.tau / 3
            o.location = (1.75 * math.cos(a), 0.9 * math.sin(a), 0.5 + 0.35 * math.sin(a * 2 + k))
            o.rotation_euler = (a, a * 0.5, 0)
        sc.render.filepath = os.path.join(OUT, f'guide-{f:02d}.png')
        bpy.ops.render.render(write_still=True)


def mic():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    chrome = mat('Chrome', (0.8, 0.82, 0.9), metallic=1.0, rough=0.2)
    grille = mat('Grille', (0.25, 0.2, 0.4), metallic=1.0, rough=0.35, emit=(0.6, 0.35, 1.0), strength=0.5)
    gold = mat('Gold', (1.0, 0.8, 0.4), metallic=1.0, rough=0.2)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(0, 0, 1.2), scale=(1, 1, 1.25), segments=24, ring_count=12)
    bpy.context.object.data.materials.append(grille)   # tête à facettes : la grille
    bpy.ops.mesh.primitive_torus_add(major_radius=0.63, minor_radius=0.07, location=(0, 0, 0.72))
    bpy.context.object.data.materials.append(gold)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.26, radius2=0.5, depth=1.7, location=(0, 0, -0.2))
    bpy.context.object.data.materials.append(chrome)
    for p in bpy.context.object.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.14, location=(0, 0, -1.1))
    bpy.context.object.data.materials.append(gold)
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH':
            o.rotation_euler = (0, math.radians(-28), 0)
            o.location.rotate(o.rotation_euler)
    sc = scene((256, 256), 3.9, cam=(0, -8, 0.4), target=(0, 0, 0.1), samples=64,
               lights=(((-3, -5, 4), 420, (1, 0.97, 1), 4), ((4, 2, 2), 480, lin((0.4, 0.9, 1.0)), 3), ((-4, 3, -1), 320, lin((0.85, 0.4, 1.0)), 3)))
    sc.render.filepath = os.path.join(OUT, 'mic.png')
    bpy.ops.render.render(write_still=True)


if 'ribbons' in WHAT:
    for world in ('naruto', 'onepiece', 'dragonball', 'bleach', 'demonslayer', 'jujutsu', 'hunter'):
        ribbon(world)
if 'guide' in WHAT:
    guide()
if 'mic' in WHAT:
    mic()
