"""ANIME RIFT — chiffres 3D du niveau de compte (Cycles), en six styles de plus en plus beaux.
Lancer :  python3 tools/blender/build_digits.py   →  src/assets/digits/<style>/0.png … 9.png et nv.png (fond transparent)
Styles : t0 acier (niveaux 1-24), t1 or (25-49), t2 braise (50-74), t3 plasma (75-99), t4 légende (100),
         r arc-en-ciel (après une Renaissance).
Police : Barlow Condensed ExtraBold Italic (celle des titres du jeu), extrudée et biseautée.
"""
import math
import os

import bpy

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', '..', 'src', 'assets', 'digits')
lin = lambda c: tuple(x ** 2.2 for x in c)
# style : dégradé du chiffre (positions, couleurs), axe du dégradé, couleur et lueur du contour, force de la lueur du chiffre
STYLES = {
    't0': dict(stops=[(0.0, (0.2, 0.3, 0.55)), (0.38, (0.55, 0.7, 0.92)), (0.72, (0.96, 0.98, 1.0))], axis='Y', edge=(0.08, 0.1, 0.2), edge_emit=(0.25, 0.45, 1.0), glow=0.7),
    't1': dict(stops=[(0.0, (1.0, 0.36, 0.08)), (0.38, (1.0, 0.74, 0.2)), (0.72, (1.0, 0.97, 0.78))], axis='Y', edge=(0.16, 0.07, 0.3), edge_emit=(0.5, 0.25, 1.0), glow=0.85),
    't2': dict(stops=[(0.0, (0.6, 0.0, 0.2)), (0.38, (1.0, 0.2, 0.25)), (0.72, (1.0, 0.85, 0.55))], axis='Y', edge=(0.3, 0.12, 0.0), edge_emit=(1.0, 0.7, 0.15), glow=1.0),
    't3': dict(stops=[(0.0, (0.25, 0.15, 1.0)), (0.38, (0.2, 0.85, 1.0)), (0.72, (0.92, 1.0, 1.0))], axis='Y', edge=(0.25, 0.02, 0.25), edge_emit=(1.0, 0.25, 0.9), glow=1.1),
    't4': dict(stops=[(0.0, (0.5, 0.05, 1.0)), (0.3, (1.0, 0.25, 0.75)), (0.6, (1.0, 0.8, 0.3)), (0.8, (1.0, 1.0, 0.92))], axis='Y', edge=(0.0, 0.15, 0.25), edge_emit=(0.3, 1.0, 1.0), glow=1.25),
    'r': dict(stops=[(0.0, (1.0, 0.2, 0.3)), (0.2, (1.0, 0.6, 0.1)), (0.4, (1.0, 0.95, 0.3)), (0.6, (0.3, 1.0, 0.6)), (0.8, (0.25, 0.75, 1.0)), (1.0, (0.75, 0.4, 1.0))], axis='X', edge=(0.3, 0.3, 0.3), edge_emit=(1.0, 0.95, 0.8), glow=1.3),
}


def mat(name, color, metallic, rough, emit=None, strength=0.0):
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


def render(text, name, width, style):
    st = STYLES[style]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    font = bpy.data.fonts.load(os.path.join(HERE, 'fonts', 'BarlowCondensed-ExtraBoldItalic.ttf'))
    bpy.ops.object.text_add(location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object
    t.data.body = text
    t.data.font = font
    t.data.align_x = 'CENTER'
    t.data.extrude = 0.09
    t.data.bevel_depth = 0.022
    t.data.bevel_resolution = 4
    face = mat('Face', (1.0, 0.8, 0.36), 0.55, 0.2)
    nt = face.node_tree  # dégradé vertical : blanc chaud en haut, or, puis orange profond en bas
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    els = ramp.color_ramp.elements
    for k, (pos, col) in enumerate(st['stops']):
        e = els[k] if k < 2 else els.new(pos)
        e.position, e.color = pos, (*lin(col), 1)
    rng = nt.nodes.new('ShaderNodeMapRange')  # sur l'axe X, le texte centré va d'environ -0.3 à 0.3
    rng.inputs['From Min'].default_value = -0.3 if st['axis'] == 'X' else 0.0
    rng.inputs['From Max'].default_value = 0.3 if st['axis'] == 'X' else 1.0
    b = nt.nodes['Principled BSDF']
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs[st['axis']], rng.inputs['Value'])  # l'axe Y du texte est sa hauteur
    nt.links.new(rng.outputs['Result'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    nt.links.new(ramp.outputs[0], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = st['glow']
    t.data.materials.append(face)
    # contour sombre derrière le chiffre : une copie plus épaisse, en retrait
    bpy.ops.object.text_add(location=(0, 0.1, 0), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.data.body, o.data.font, o.data.align_x = text, font, 'CENTER'
    o.data.extrude = 0.03
    o.data.offset = 0.035
    o.data.materials.append(mat('Edge', st['edge'], 0.8, 0.3, emit=st['edge_emit'], strength=1.6 if style in ('t4', 'r') else 0.7))

    tgt = bpy.data.objects.new('T', None)
    tgt.location = (0, 0, 0.35)
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in (((-2, -4, 3), 260, (1, 0.97, 0.9), 3), ((3, -2, 1), 240, lin((0.4, 0.9, 1.0)), 2), ((-3, -1, -1), 200, lin((0.75, 0.35, 1.0)), 2), ((0, -3, -2), 60, (1, 0.8, 0.5), 2)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt

    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.2, 0.16, 0.3, 1)
    sc = bpy.context.scene
    sc.world = world
    bpy.ops.object.camera_add(location=(0.25, -6, 0.7))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.15 * width
    cam.constraints.new('TRACK_TO').target = tgt
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = int(200 * width), 230
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, style, f'{name}.png')
    bpy.ops.render.render(write_still=True)


for style in STYLES:
    for d in '0123456789':
        render(d, d, 1.0, style)
    render('NV', 'nv', 1.6, style)
