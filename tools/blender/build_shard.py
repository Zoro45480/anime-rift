"""ANIME RIFT — le Fragment d'âme (objet de Libération des cartes), rendu Cycles.
Lancer :  python3 tools/blender/build_shard.py   →  src/assets/icons/shard.png (fond transparent)
"""
import math
import os

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons', 'shard.png')
lin = lambda c: tuple(x ** 2.2 for x in c)
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metallic=0.0, rough=0.2, emit=None, strength=0.0):
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


crystal = mat('Crystal', (0.45, 0.3, 1.0), metallic=0.6, rough=0.08, emit=(0.5, 0.25, 1.0), strength=0.22)
core = mat('Core', (0.4, 0.95, 1.0), emit=(0.35, 0.95, 1.0), strength=6.0)
gold = mat('Gold', (1.0, 0.78, 0.35), metallic=1.0, rough=0.2)


def gem(m, loc, radius, stretch, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0, depth=radius * stretch, location=(loc[0], loc[1], loc[2] + radius * stretch / 2), rotation=rot)
    top = bpy.context.object
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0, depth=radius * stretch * 0.55, location=(loc[0], loc[1], loc[2] - radius * stretch * 0.275), rotation=(math.pi + rot[0], rot[1], rot[2]))
    for o in (top, bpy.context.object):
        o.data.materials.append(m)


gem(crystal, (0, 0, 0.1), 0.62, 2.6)                       # grand éclat
gem(core, (0, -0.05, 0.25), 0.22, 3.2)                      # cœur lumineux, visible à travers les arêtes
gem(crystal, (-0.85, 0.1, -0.35), 0.3, 2.4)
gem(crystal, (0.82, 0.15, -0.5), 0.26, 2.2)
gem(core, (0.55, -0.4, 0.9), 0.1, 2.5)
gem(core, (-0.6, -0.3, 1.1), 0.08, 2.5)
for R, tilt in ((1.3, 1.25), (1.5, 1.4)):                   # anneaux d'or en orbite
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=0.035, location=(0, 0, 0.45), rotation=(tilt, 0.5 if R < 1.4 else -0.5, 0), major_segments=96)
    bpy.context.object.data.materials.append(gold)
    for p in bpy.context.object.data.polygons:
        p.use_smooth = True

tgt = bpy.data.objects.new('T', None)
tgt.location = (0, 0, 0.45)
bpy.context.collection.objects.link(tgt)
for loc, energy, color in (((-3, -5, 4), 900, (1, 0.95, 1)), ((4, 2, 2), 900, lin((0.35, 0.9, 1.0))), ((-4, 3, -1), 600, lin((0.7, 0.3, 1.0)))):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy, l.data.color, l.data.size = energy, color, 4
    l.constraints.new('TRACK_TO').target = tgt

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.08, 0.06, 0.16, 1)
sc = bpy.context.scene
sc.world = world
bpy.ops.object.camera_add(location=(0, -9, 0.9))
cam = bpy.context.object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 3.7
cam.constraints.new('TRACK_TO').target = tgt
sc.camera = cam
sc.render.engine = 'CYCLES'
sc.cycles.samples = 96
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 384
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
