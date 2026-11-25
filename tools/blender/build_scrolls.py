"""ANIME RIFT — parchemins d'XP en 3D (Cycles, métal et papier ancien).

Lancer :  python3 tools/blender/build_scrolls.py            (les trois)
          python3 tools/blender/build_scrolls.py large      (un seul)

Produit  src/assets/icons/scroll-<taille>.png  sur fond transparent :
  small  — petit parchemin : embouts d'acier, runes bleues.
  medium — parchemin : embouts d'argent violacé, runes violettes, gemme.
  large  — grand parchemin : embouts d'or, runes dorées, gemme rouge et halo.
"""
import math
import os
import random
import sys

import bpy
import bmesh  # noqa: E402 — n'existe qu'une fois Blender chargé

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons')
lin = lambda c: tuple(x ** 2.2 for x in c)  # sRGB -> linéaire

TIERS = {
    'small': dict(metal=(0.62, 0.72, 0.9), rune=(0.25, 0.75, 1.0), gem=None, runes=3, glow=2.5),
    'medium': dict(metal=(0.74, 0.62, 1.0), rune=(0.66, 0.4, 1.0), gem=(0.6, 0.3, 1.0), runes=4, glow=3.0),
    'large': dict(metal=(1.0, 0.76, 0.28), rune=(1.0, 0.72, 0.2), gem=(1.0, 0.12, 0.2), runes=5, glow=4.0),
}
ONLY = [a for a in sys.argv[1:] if a in TIERS] or list(TIERS)


def principled(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0):
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


def paper():
    """Papier ancien : crème, taché par un bruit, un peu de relief."""
    m = principled('Paper', (0.93, 0.84, 0.62), rough=0.85)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.5
    noise.inputs['Detail'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.3, (*lin((0.7, 0.52, 0.3)), 1)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.7, (*lin((0.97, 0.9, 0.7)), 1)
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    nt.links.new(noise.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], b.inputs['Normal'])
    return m


def add(obj, root, mat, smooth=True):
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    obj.parent = root
    return obj


def cyl(root, mat, radius, length, x=0.0, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=length, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    o = add(bpy.context.object, root, mat)
    bev = o.modifiers.new('b', 'BEVEL')
    bev.width, bev.segments = min(0.03, radius * 0.3), 3
    return o


def sheet(root, mat, width, r, drop):
    """La feuille déroulée : elle part de l'avant du rouleau, tombe droit, puis s'enroule un peu en bas."""
    bm = bmesh.new()
    rows, cols = 40, 2
    prof = []
    for i in range(rows + 1):
        t = i / rows
        if t < 0.82:
            prof.append((-r, -t / 0.82 * drop))
        else:  # petit enroulement vers l'avant
            a = (t - 0.82) / 0.18 * math.pi * 1.25
            cr = 0.13
            prof.append((-r - cr + cr * math.cos(a), -drop - cr * math.sin(a)))
    grid = [[bm.verts.new((-width / 2 + width * c / cols, y, z)) for c in range(cols + 1)] for y, z in prof]
    for i in range(rows):
        for c in range(cols):
            bm.faces.new((grid[i][c], grid[i][c + 1], grid[i + 1][c + 1], grid[i + 1][c]))
    me = bpy.data.meshes.new('Sheet')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('Sheet', me)
    bpy.context.collection.objects.link(o)
    add(o, root, mat)
    sol = o.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = 0.02
    return o


def build(tier):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    t = TIERS[tier]
    random.seed(tier)
    root = bpy.data.objects.new('Root', None)
    bpy.context.collection.objects.link(root)

    pap = paper()
    metal = principled('Metal', t['metal'], metallic=1.0, rough=0.22)
    wood = principled('Wood', (0.2, 0.09, 0.05), rough=0.5)
    rune = principled('Rune', t['rune'], rough=0.4, emit=t['rune'], strength=t['glow'])

    R, W, DROP = 0.4, 1.9, 1.35
    cyl(root, pap, R, W)                      # le rouleau de papier
    cyl(root, wood, 0.13, W + 0.5, verts=32)  # la baguette
    for s in (-1, 1):                          # embouts de métal
        cyl(root, metal, 0.5, 0.1, x=s * (W / 2 + 0.03))
        cyl(root, metal, 0.24, 0.26, x=s * (W / 2 + 0.3))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(s * (W / 2 + 0.5), 0, 0), segments=48, ring_count=24)
        add(bpy.context.object, root, metal)
    sheet(root, pap, W - 0.14, R, DROP)

    # liseré de métal en haut et en bas de la feuille
    for z in (-0.16, -DROP + 0.1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -R - 0.04, z), scale=(W - 0.3, 0.014, 0.035))
        add(bpy.context.object, root, metal, smooth=False)

    # runes : des rangées de traits lumineux, posés juste devant la feuille
    rows = t['runes']
    top, bottom = -0.32, -DROP + 0.26
    for i in range(rows):
        z = top + (bottom - top) * i / (rows - 1)
        x = -W / 2 + 0.3
        while x < W / 2 - 0.42:
            w = random.uniform(0.1, 0.34)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x + w / 2, -R - 0.04, z), scale=(w, 0.012, 0.06))
            add(bpy.context.object, root, rune, smooth=False)
            x += w + random.uniform(0.07, 0.13)

    if t['gem']:  # gemme taillée au centre du rouleau, sertie de métal
        gem = principled('Gem', t['gem'], rough=0.05, emit=t['gem'], strength=1.6)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.2, location=(0, -R - 0.06, 0), scale=(1, 0.55, 1))
        add(bpy.context.object, root, gem, smooth=False)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.04, location=(0, -R + 0.01, 0), rotation=(math.pi / 2, 0, 0))
        add(bpy.context.object, root, metal)
        cyl(root, metal, R + 0.025, 0.2)

    root.rotation_euler = (math.radians(-12), math.radians(-20), math.radians(8))
    root.location = (0, 0, 0.55)

    # lumières : clé chaude, contre-jour à la couleur du parchemin, remplissage froid
    def area(loc, energy, color, size=4):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.rotation_euler = (0, 0, 0)
        c = l.constraints.new('TRACK_TO')
        c.target = root
    area((-2.5, -5, 4), 420, (1, 0.96, 0.9))
    area((4, 3, 2), 1400, lin(t['rune']), size=3)
    area((3, -4, -2), 250, (0.7, 0.8, 1))

    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.1, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    sc = bpy.context.scene
    sc.world = world

    bpy.ops.object.camera_add(location=(0, -10, 0.1), rotation=(math.pi / 2, 0, 0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.5
    sc.camera = cam

    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 384
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, f'scroll-{tier}.png')
    bpy.ops.render.render(write_still=True)


for name in ONLY:
    build(name)
