"""ANIME RIFT — icônes des ressources, dessinées dans Blender en style anime (aplats de couleur et contour noir).

Lancer :  python3 tools/blender/build_icons.py            (les trois)
          python3 tools/blender/build_icons.py soul       (une seule)

Produit  src/assets/icons/<nom>.png  sur fond transparent :
  seal  — le Sceau d'invocation : un talisman de papier, bordé de rouge, marqué du losange fendu.
  soul  — la Flamme d'âme : un feu follet bleu et violet, la monnaie du jeu.
  bolt  — l'énergie : un éclair.

Style anime : chaque matière émet sa couleur (aucune ombre réaliste), les dégradés sont en paliers,
et le contour est une coque noire retournée autour de chaque forme.
"""
import math
import os
import sys

import bpy
import bmesh  # noqa: E402 — n'existe qu'une fois Blender chargé

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons')
ONLY = [a for a in sys.argv[1:] if a in ('seal', 'soul', 'bolt')]
INK = (0.03, 0.03, 0.08)


def flat(name, color, strength=1.0):
    """Aplat : la matière émet sa couleur, sans ombre."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def banded(name, stops, axis='Z', lo=-1.0, hi=1.0):
    """Dégradé en paliers nets le long d'un axe de l'objet (le « cel shading » des animes)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = lo
    rng.inputs['From Max'].default_value = hi
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[1][0], (*stops[1][1], 1)
    for pos, col in stops[2:]:
        e = els.new(pos)
        e.color = (*col, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs[axis], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def outline_material():
    """Contour : une coque retournée, noire vue de dehors et invisible vue de face."""
    m = bpy.data.materials.new('Outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    ink = nt.nodes.new('ShaderNodeEmission')
    ink.inputs[0].default_value = (*INK, 1)
    clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs[0])
    nt.links.new(ink.outputs[0], mix.inputs[1])
    nt.links.new(clear.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


def outline(obj, ink, thickness=0.05):
    obj.data.materials.append(ink)
    mod = obj.modifiers.new('Outline', 'SOLIDIFY')
    mod.thickness = -thickness
    mod.offset = 1
    mod.use_flip_normals = True
    mod.material_offset = len(obj.data.materials) - 1
    mod.use_rim = False


def mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def slab(name, outline_xz, depth, mat, y=0.0):
    """Forme plate (contour donné dans le plan XZ), épaisse de `depth`, face à la caméra."""
    n = len(outline_xz)
    verts = [(x, y - depth / 2, z) for x, z in outline_xz] + [(x, y + depth / 2, z) for x, z in outline_xz]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    obj = mesh(name, verts, faces, mat)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def rect(w, h, cx=0.0, cz=0.0):
    return [(cx - w / 2, cz - h / 2), (cx + w / 2, cz - h / 2), (cx + w / 2, cz + h / 2), (cx - w / 2, cz + h / 2)]


# --- Sceau d'invocation : un talisman de papier -----------------------------------------------------------------
def build_seal(ink):
    paper = banded('Paper', [(0.0, (0.86, 0.78, 0.62)), (0.3, (0.98, 0.94, 0.82))], 'X', -0.6, 0.6)
    red = flat('Seal red', (0.9, 0.08, 0.14))
    black = flat('Ink', INK)
    gold = flat('Gold', (1.0, 0.76, 0.22))
    root = bpy.data.objects.new('Seal', None)
    bpy.context.scene.collection.objects.link(root)

    def part(obj):
        obj.parent = root
        return obj

    # la feuille : coins du haut coupés, bas en pointe double (comme un fanion)
    sheet = [(-0.55, -1.25), (-0.18, -1.05), (0.0, -1.25), (0.18, -1.05), (0.55, -1.25), (0.55, 1.05), (0.38, 1.25), (-0.38, 1.25), (-0.55, 1.05)]
    body = part(slab('Sheet', sheet, 0.08, paper))
    outline(body, ink, 0.055)
    part(slab('Band top', rect(1.1, 0.2, 0, 0.95), 0.02, red, y=-0.06))
    part(slab('Band low', rect(1.1, 0.09, 0, -0.72), 0.02, red, y=-0.06))
    for x in (-0.47, 0.47):
        part(slab('Edge', rect(0.05, 1.55, x, 0.1), 0.02, red, y=-0.06))
    # le losange fendu du logo, à l'encre, puis trois traits de calligraphie
    part(slab('Diamond', [(0, 0.72), (0.34, 0.3), (0, -0.12), (-0.34, 0.3)], 0.02, black, y=-0.07))
    part(slab('Diamond in', [(0, 0.58), (0.23, 0.3), (0, 0.02), (-0.23, 0.3)], 0.02, gold, y=-0.08))
    part(slab('Crack', [(0.07, 0.56), (-0.1, 0.33), (0.03, 0.27), (-0.07, 0.04), (0.01, 0.04), (0.12, 0.3), (-0.01, 0.36), (0.13, 0.56)], 0.02, red, y=-0.09))
    for i, (w, z) in enumerate(((0.62, -0.3), (0.42, -0.44), (0.56, -0.58))):
        part(slab(f'Stroke {i}', rect(w, 0.055, 0, z), 0.02, black, y=-0.07))
    # un cordon doré noué en haut
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.04, location=(0, 0, 1.36), rotation=(math.pi / 2, 0, 0))
    knot = part(bpy.context.object)
    knot.data.materials.append(gold)
    outline(knot, ink, 0.015)
    root.rotation_euler = (0.0, math.radians(-16), 0)  # penché, comme tenu entre deux doigts
    root.scale = (1.02, 1, 1.02)
    root.location = (0, 0, -0.08)


# --- Flamme d'âme : un feu follet -------------------------------------------------------------------------------
def flame(name, radius, height, sway, mat, ink, thickness, loc=(0, 0, 0)):
    """Une goutte de feu : une sphère dont le haut est étiré en pointe ondulante."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, radius=radius, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for v in bm.verts:
        k = min(1.0, max(0.0, v.co.z / radius))  # 0 à l'équateur, 1 au sommet
        if k > 0:
            squeeze = (1 - k) ** 0.75 * 0.92 + 0.08 * (1 - k)
            v.co.x *= squeeze
            v.co.y *= squeeze
            v.co.z = radius * k * height
            v.co.x += math.sin(k * 2.6) * sway * k
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(mat)
    if ink:
        outline(obj, ink, thickness)
    obj.location = loc
    return obj


def build_soul(ink):
    outer = banded('Flame outer', [(0.0, (0.42, 0.14, 1.0)), (0.3, (0.26, 0.42, 1.0)), (0.55, (0.16, 0.8, 1.0)), (0.8, (0.6, 1.0, 1.0))], 'Z', -0.8, 1.9)
    inner = banded('Flame inner', [(0.0, (0.35, 0.9, 1.0)), (0.45, (0.75, 1.0, 1.0))], 'Z', -0.5, 1.2)
    white = flat('Core', (1.0, 1.0, 1.0), 1.4)
    flame('Outer', 0.8, 2.4, 0.8, outer, ink, 0.06, loc=(0.05, 0, -0.6))
    # deux langues de feu sur les côtés, pour une silhouette de flamme et non de goutte
    left = flame('Tongue L', 0.44, 2.9, 0.5, outer, ink, 0.055, loc=(-0.5, 0.3, -0.5))
    left.rotation_euler.y = math.radians(-24)
    right = flame('Tongue R', 0.36, 2.6, -0.4, outer, ink, 0.05, loc=(0.52, 0.3, -0.62))
    right.rotation_euler.y = math.radians(20)
    flame('Inner', 0.54, 2.1, 0.5, inner, None, 0, loc=(0.04, -0.5, -0.66))
    flame('Core', 0.3, 1.7, 0.16, white, None, 0, loc=(0.03, -0.9, -0.66))
    # deux flammèches qui s'en détachent
    a = flame('Wisp A', 0.17, 2.4, 0.1, outer, ink, 0.045, loc=(-1.12, 0, 0.75))
    a.rotation_euler.y = math.radians(-18)
    b = flame('Wisp B', 0.13, 2.2, 0.08, inner, ink, 0.04, loc=(1.08, 0, 0.3))
    b.rotation_euler.y = math.radians(22)
    # reflet en amande, comme sur un dessin
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.12, location=(-0.36, -1.0, -0.42))
    glint = bpy.context.object
    glint.scale = (0.7, 0.3, 1.5)
    glint.rotation_euler.y = math.radians(24)
    glint.data.materials.append(white)


# --- Énergie : un éclair ------------------------------------------------------------------------------------------
def build_bolt(ink):
    body = banded('Bolt', [(0.0, (1.0, 0.5, 0.05)), (0.42, (1.0, 0.8, 0.12)), (0.7, (1.0, 0.95, 0.5))], 'Z', -1.4, 1.4)
    white = flat('Shine', (1, 1, 1), 1.3)
    shape = [(0.3, 1.4), (-0.72, -0.12), (-0.06, -0.12), (-0.42, -1.4), (0.78, 0.3), (0.1, 0.3)]
    bolt = slab('Bolt', shape, 0.3, body)
    # contour : la même forme, agrandie et noire, posée juste derrière
    cx = sum(x for x, _ in shape) / len(shape)
    cz = sum(z for _, z in shape) / len(shape)
    back = slab('Bolt outline', [(cx + (x - cx) * 1.16, cz + (z - cz) * 1.1) for x, z in shape], 0.1, flat('Ink', INK), y=0.3)
    back.rotation_euler = (0, math.radians(8), 0)
    shine = slab('Shine', [(0.17, 1.02), (-0.36, 0.14), (-0.2, 0.14), (0.26, 0.9)], 0.02, white, y=-0.17)
    for o in (bolt, shine):
        o.rotation_euler = (0, math.radians(8), 0)


BUILDERS = {'seal': build_seal, 'soul': build_soul, 'bolt': build_bolt}

os.makedirs(OUT, exist_ok=True)
for name in ONLY or list(BUILDERS):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    BUILDERS[name](outline_material())
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 3.25
    cam = bpy.data.objects.new('Cam', cam_data)
    cam.location = (0, -10, 0.1)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.world = bpy.data.worlds.new('World')
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    path = os.path.join(OUT, f'{name}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f'Blender {bpy.app.version_string} — icône {name} : {os.path.getsize(path) / 1024:.0f} Ko')
