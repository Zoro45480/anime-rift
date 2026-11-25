"""ANIME RIFT — habillage de l'interface, dessiné dans Blender en style anime (aplats, paliers de couleur, contour à l'encre).

Lancer :  python3 tools/blender/build_ui.py            puis   python3 tools/optimize_images.py
          python3 tools/blender/build_ui.py bg         (un seul élément)

Produit dans src/assets/ui/ :
  bg            fond des menus : ciel de nuit, lune, nuages, îles flottantes, portail
  btn-gold      plaque du bouton principal          btn-pink    plaque d'action secondaire
  btn-indigo    plaque de bouton neutre             btn-ghost   plaque discrète
  panel         cadre des panneaux et des fenêtres
  nav-nexus, nav-summon, nav-cards                   icônes de la barre de navigation

Les plaques et le cadre sont faits pour être étirés par leurs bords (border-image) : seuls les coins gardent leurs
détails, le centre est uni.
"""
import math
import os
import random
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'ui')
INK = (0.025, 0.025, 0.07)
PX = 100  # pixels par unité Blender


# --- matières : des aplats qui émettent leur couleur, sans ombre -----------------------------------------------
def lin(color):
    """Les couleurs de ce fichier sont écrites telles qu'on les voit à l'écran ; Blender calcule en lumière linéaire."""
    return tuple(c ** 2.2 for c in color)



def flat(color):
    m = bpy.data.materials.new('Flat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*lin(color), 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def banded(stops, lo, hi, axis='Z'):
    """Dégradé en paliers nets le long d'un axe : le « cel shading » des animes."""
    m = bpy.data.materials.new('Banded')
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
    els[0].position, els[0].color = stops[0][0], (*lin(stops[0][1]), 1)
    els[1].position, els[1].color = stops[1][0], (*lin(stops[1][1]), 1)
    for pos, col in stops[2:]:
        el = els.new(pos)
        el.color = (*lin(col), 1)
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs[axis], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


# --- formes plates, posées face à la caméra ; `depth` = plus grand, plus loin ------------------------------------
def shape(pts, mat, depth=0.0):
    me = bpy.data.meshes.new('Shape')
    me.from_pydata([(x, depth, z) for x, z in pts], [], [tuple(range(len(pts)))])
    obj = bpy.data.objects.new('Shape', me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def slanted(w, h, slant, grow=0.0, cx=0.0, cz=0.0):
    """Parallélogramme penché vers la droite : la forme signature des boutons."""
    return [(cx - w / 2 - slant / 2 - grow, cz - h / 2 - grow), (cx + w / 2 - slant / 2 + grow, cz - h / 2 - grow),
            (cx + w / 2 + slant / 2 + grow, cz + h / 2 + grow), (cx - w / 2 + slant / 2 - grow, cz + h / 2 + grow)]


def rounded(w, h, r, grow=0.0, cx=0.0, cz=0.0, cut=0.0):
    """Rectangle arrondi ; `cut` remplace le coin haut-gauche par un pan coupé."""
    w, h, r = w + 2 * grow, h + 2 * grow, r + grow
    pts = []
    for ox, oz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        if a0 == 90 and cut:
            pts += [(cx - w / 2 + cut, cz + h / 2), (cx - w / 2, cz + h / 2 - cut)]
            continue
        for i in range(9):
            a = math.radians(a0 + 90 * i / 8)
            pts.append((cx + ox + math.cos(a) * r, cz + oz + math.sin(a) * r))
    return pts


def circle(cx, cz, r, n=48):
    return [(cx + math.cos(2 * math.pi * i / n) * r, cz + math.sin(2 * math.pi * i / n) * r) for i in range(n)]


def star(cx, cz, size, mat, depth, angle=0.0):
    pts = []
    for i in range(8):
        a = angle + i * math.pi / 4
        r = size if i % 2 == 0 else size * 0.18
        pts.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
    return shape(pts, mat, depth)


def rotated(pts, angle, cx=0.0, cz=0.0):
    c, s = math.cos(angle), math.sin(angle)
    return [(cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c) for x, z in pts]


# --- plaques de boutons ------------------------------------------------------------------------------------------
def plate(low, high, shine):
    """Plaque penchée : ombre portée décalée, contour à l'encre, deux paliers de couleur, reflet en haut."""
    w, h, s = 4.0, 1.0, 0.3
    ink = flat(INK)
    shape(slanted(w, h, s, 0.07, 0.09, -0.1), ink, 0.4)                     # ombre portée, façon autocollant
    shape(slanted(w, h, s, 0.07), ink, 0.3)                                 # contour
    shape(slanted(w, h, s), banded([(0.0, low), (0.46, high)], -h / 2, h / 2), 0.2)
    shape(slanted(w - 0.16, 0.13, 0.04, 0, 0.12, h / 2 - 0.13), flat(shine), 0.1)  # reflet
    return 4.5, 1.4


# --- cadre des panneaux --------------------------------------------------------------------------------------------
def panel():
    w, h, r, cut = 4.0, 3.0, 0.2, 0.42
    ink = flat(INK)
    shape(rounded(w, h, r, 0.07, 0.1, -0.11, cut), ink, 0.5)
    shape(rounded(w, h, r, 0.07, cut=cut + 0.03), ink, 0.4)
    shape(rounded(w, h, r, cut=cut), banded([(0.0, (0.05, 0.055, 0.15)), (0.72, (0.075, 0.085, 0.21))], -h / 2, h / 2), 0.3)
    # liseré clair le long du pan coupé, et deux petits traits d'accent : tout tient dans les coins
    cyan = flat((0.3, 0.86, 1.0))
    pink = flat((1.0, 0.35, 0.7))
    x0, z1 = -w / 2, h / 2
    shape([(x0 + cut + 0.02, z1 - 0.07), (x0 + 0.07, z1 - cut - 0.02), (x0 + 0.07, z1 - cut - 0.16), (x0 + cut + 0.16, z1 - 0.07)], cyan, 0.2)
    shape(slanted(0.34, 0.07, 0.05, 0, x0 + cut + 0.5, z1 - 0.1), pink, 0.2)
    shape(slanted(0.14, 0.07, 0.05, 0, x0 + cut + 0.82, z1 - 0.1), cyan, 0.2)
    shape([(w / 2 - 0.08, -h / 2 + 0.08), (w / 2 - 0.08, -h / 2 + 0.36), (w / 2 - 0.36, -h / 2 + 0.08)], pink, 0.2)  # coin bas-droit
    return 4.5, 3.5


# --- icônes de navigation ------------------------------------------------------------------------------------------
def nav_nexus():
    """Le Nexus : un portique devant un portail."""
    ink = flat(INK)
    shape(circle(0, 0.05, 1.06), ink, 0.5)
    shape(circle(0, 0.05, 0.98), banded([(0.0, (0.35, 0.2, 1.0)), (0.4, (0.25, 0.6, 1.0)), (0.7, (0.5, 0.95, 1.0))], -1, 1), 0.4)
    shape(circle(0, 0.05, 0.42), flat((1, 1, 1)), 0.35)
    red = banded([(0.0, (0.8, 0.1, 0.2)), (0.5, (1.0, 0.25, 0.3))], -1.2, 1.2)
    for parts in ([(-0.92, -1.15, -0.62, 0.62), (0.62, -1.15, 0.92, 0.62)],):
        for x0, z0, x1, z1 in parts:
            shape([(x0 - 0.06, z0 - 0.06), (x1 + 0.06, z0 - 0.06), (x1 + 0.06, z1 + 0.06), (x0 - 0.06, z1 + 0.06)], ink, 0.3)
            shape([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], red, 0.2)
    beam = [(-1.42, 0.86), (-1.22, 0.56), (1.22, 0.56), (1.42, 0.86), (1.3, 0.98), (-1.3, 0.98)]
    shape([(x * 1.04, 0.77 + (z - 0.77) * 1.3) for x, z in beam], ink, 0.3)
    shape(beam, red, 0.2)
    shape([(-1.08, 0.2), (1.08, 0.2), (1.08, 0.4), (-1.08, 0.4)], ink, 0.25)
    shape([(-1.02, 0.25), (1.02, 0.25), (1.02, 0.35), (-1.02, 0.35)], red, 0.2)
    return 3.2, 3.2


def nav_summon():
    """L'invocation : le losange fendu du logo, auréolé de rayons."""
    ink = flat(INK)
    gold = flat((1.0, 0.82, 0.25))
    for i in range(8):
        shape(rotated([(-0.07, 1.02), (0.07, 1.02), (0.0, 1.5)], i * math.pi / 4), gold, 0.5)
    diamond = [(0, 1.05), (0.8, 0), (0, -1.05), (-0.8, 0)]
    shape([(x * 1.12, z * 1.1) for x, z in diamond], ink, 0.4)
    shape(diamond, banded([(0.0, (0.3, 0.16, 0.9)), (0.45, (0.25, 0.55, 1.0)), (0.75, (0.45, 0.92, 1.0))], -1.05, 1.05), 0.3)
    crack = [(0.2, 0.85), (-0.2, 0.14), (0.14, -0.06), (-0.26, -0.84), (-0.08, -0.84), (0.34, 0.02), (0.02, 0.2), (0.38, 0.85)]
    shape(crack, flat((1, 1, 1)), 0.2)
    return 3.2, 3.2


def nav_cards():
    """La collection : deux cartes en éventail et une étoile."""
    ink = flat(INK)
    for angle, cx, low, high in ((0.24, -0.34, (0.75, 0.12, 0.5), (1.0, 0.35, 0.7)), (-0.16, 0.3, (0.1, 0.4, 0.95), (0.3, 0.8, 1.0))):
        shape(rotated(rounded(1.26, 1.86, 0.16, 0.07, cx, 0), angle, cx, -0.6), ink, 0.4 - cx * 0.1)
        card = shape(rotated(rounded(1.26, 1.86, 0.16, 0, cx, 0), angle, cx, -0.6), banded([(0.0, low), (0.5, high)], -1, 1), 0.3 - cx * 0.1)
        card.name = 'Card'
    star(0.36, 0.1, 0.46, flat((1, 1, 1)), 0.1, 0.2)
    star(0.36, 0.1, 0.6, flat(INK), 0.15, 0.2)
    return 3.2, 3.2


# --- fond des menus --------------------------------------------------------------------------------------------------
def background():
    random.seed(4)
    w, h = 9.0, 16.0
    sky = banded([(0.0, (0.86, 0.34, 0.42)), (0.07, (0.66, 0.22, 0.52)), (0.17, (0.42, 0.16, 0.56)), (0.3, (0.24, 0.12, 0.46)),
                  (0.46, (0.13, 0.09, 0.34)), (0.64, (0.075, 0.065, 0.24)), (0.82, (0.04, 0.04, 0.15))], -h / 2, h / 2)
    shape([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], sky, 5.0)

    white = flat((1, 1, 1))
    soft = flat((0.75, 0.8, 1.0))
    for _ in range(90):  # étoiles : surtout en haut
        x, z = random.uniform(-w / 2, w / 2), random.uniform(-1.5, h / 2)
        star(x, z, random.uniform(0.03, 0.11), white if random.random() < 0.5 else soft, 4.8, random.uniform(0, 0.7))

    # la lune et son halo, en trois paliers
    mx, mz = 2.0, 4.3
    shape(circle(mx, mz, 2.9, 64), flat((0.17, 0.12, 0.4)), 4.6)
    shape(circle(mx, mz, 2.2, 64), flat((0.26, 0.17, 0.52)), 4.5)
    shape(circle(mx, mz, 1.55, 64), banded([(0.0, (0.95, 0.8, 0.9)), (0.45, (1.0, 0.96, 0.9))], mz - 1.55, mz + 1.55), 4.4)
    shape(circle(mx - 0.5, mz + 0.45, 0.28), flat((0.93, 0.82, 0.9)), 4.3)
    shape(circle(mx + 0.4, mz - 0.5, 0.42), flat((0.93, 0.82, 0.9)), 4.3)

    # la faille : une déchirure lumineuse qui descend du ciel jusqu'au portail
    crack, x = [], -1.3
    for i in range(13):
        z = 7.6 - i * 0.62
        x += random.uniform(-0.42, 0.42)
        crack.append((x, z))
    width = [0.03 + 0.11 * math.sin(math.pi * i / 12) for i in range(13)]
    shape([(cx - wd * 2.4, cz) for (cx, cz), wd in zip(crack, width)] + [(cx + wd * 2.4, cz) for (cx, cz), wd in reversed(list(zip(crack, width)))], flat((0.35, 0.75, 1.0)), 4.2)
    shape([(cx - wd, cz) for (cx, cz), wd in zip(crack, width)] + [(cx + wd, cz) for (cx, cz), wd in reversed(list(zip(crack, width)))], white, 4.1)

    def cloud(cx, cz, scale, color, depth):
        mat = flat(color)
        for i in range(7):
            r = scale * (0.55 + 0.45 * math.sin(math.pi * (i + 0.5) / 7)) * random.uniform(0.8, 1.15)
            shape(circle(cx + (i - 3) * scale * 0.72, cz + r * 0.45, r, 28), mat, depth)
        shape([(cx - scale * 3.2, cz - scale * 0.5), (cx + scale * 3.2, cz - scale * 0.5), (cx + scale * 3.2, cz + scale * 0.5), (cx - scale * 3.2, cz + scale * 0.5)], mat, depth)

    def island(cx, cz, size, depth, gate=False):
        rock = banded([(0.0, (0.05, 0.04, 0.15)), (0.55, (0.1, 0.07, 0.24))], cz - size, cz + size * 0.2)
        top = [(cx - size, cz), (cx - size * 0.7, cz + size * 0.16), (cx + size * 0.75, cz + size * 0.14), (cx + size, cz)]
        under = [(cx + size * 0.62, cz - size * 0.42), (cx + size * 0.2, cz - size * 0.7), (cx - size * 0.05, cz - size * 1.15), (cx - size * 0.36, cz - size * 0.6), (cx - size * 0.72, cz - size * 0.34)]
        shape(top + under, rock, depth)
        shape([(cx - size, cz), (cx - size * 0.7, cz + size * 0.16), (cx + size * 0.75, cz + size * 0.14), (cx + size, cz), (cx + size * 0.8, cz - size * 0.08), (cx - size * 0.8, cz - size * 0.08)], flat((0.2, 0.42, 0.5)), depth - 0.02)
        for k in range(3):  # cristaux
            bx = cx + size * random.uniform(-0.75, 0.75)
            ht = size * random.uniform(0.22, 0.5)
            shape([(bx - ht * 0.2, cz + size * 0.1), (bx + ht * 0.2, cz + size * 0.1), (bx + ht * 0.06, cz + size * 0.1 + ht)], flat((0.4, 0.9, 1.0) if k % 2 else (0.7, 0.5, 1.0)), depth - 0.03)
        if gate:  # le portique du Nexus et son portail
            gz = cz + size * 0.13
            dark = flat((0.035, 0.03, 0.1))
            shape(circle(cx, gz + size * 0.62, size * 0.5, 40), banded([(0.0, (0.3, 0.25, 1.0)), (0.4, (0.3, 0.7, 1.0)), (0.72, (0.75, 1.0, 1.0))], gz + size * 0.12, gz + size * 1.12), depth - 0.04)
            shape(circle(cx, gz + size * 0.62, size * 0.2, 28), white, depth - 0.05)
            for sx in (-1, 1):
                shape([(cx + sx * size * 0.62, gz), (cx + sx * size * 0.48, gz), (cx + sx * size * 0.48, gz + size * 1.1), (cx + sx * size * 0.62, gz + size * 1.1)], dark, depth - 0.06)
            shape([(cx - size * 0.92, gz + size * 1.26), (cx - size * 0.8, gz + size * 1.06), (cx + size * 0.8, gz + size * 1.06), (cx + size * 0.92, gz + size * 1.26), (cx + size * 0.84, gz + size * 1.34), (cx - size * 0.84, gz + size * 1.34)], dark, depth - 0.06)
            shape([(cx - size * 0.68, gz + size * 0.84), (cx + size * 0.68, gz + size * 0.84), (cx + size * 0.68, gz + size * 0.94), (cx - size * 0.68, gz + size * 0.94)], dark, depth - 0.06)

    cloud(-2.6, 1.3, 0.7, (0.3, 0.17, 0.52), 4.0)
    cloud(3.0, -0.2, 0.9, (0.36, 0.17, 0.54), 3.9)
    island(3.1, 0.9, 0.9, 3.6)
    island(-3.2, -1.4, 0.75, 3.5)
    cloud(-1.0, -2.6, 1.1, (0.52, 0.2, 0.55), 3.4)
    island(-0.6, -2.5, 2.0, 3.0, gate=True)   # l'île du Nexus, au bas de la faille
    cloud(2.8, -4.4, 1.25, (0.66, 0.24, 0.52), 2.6)
    cloud(-2.9, -5.4, 1.5, (0.5, 0.17, 0.5), 2.4)
    cloud(1.4, -6.9, 1.9, (0.3, 0.11, 0.4), 2.2)
    cloud(-2.0, -8.0, 2.2, (0.16, 0.07, 0.28), 2.0)
    return w, h


ELEMENTS = {
    'bg': background,
    'btn-gold': lambda: plate((1.0, 0.58, 0.06), (1.0, 0.8, 0.2), (1.0, 0.96, 0.62)),
    'btn-pink': lambda: plate((0.82, 0.12, 0.5), (1.0, 0.32, 0.68), (1.0, 0.76, 0.9)),
    'btn-indigo': lambda: plate((0.11, 0.12, 0.34), (0.18, 0.2, 0.5), (0.42, 0.55, 1.0)),
    'btn-ghost': lambda: plate((0.055, 0.06, 0.17), (0.085, 0.095, 0.24), (0.26, 0.3, 0.58)),
    'panel': panel,
    'nav-nexus': nav_nexus,
    'nav-summon': nav_summon,
    'nav-cards': nav_cards,
}
SCALE = {'nav-nexus': 50, 'nav-summon': 50, 'nav-cards': 50}  # pixels par unité, quand ce n'est pas PX

os.makedirs(OUT, exist_ok=True)
for name in [a for a in sys.argv[1:] if a in ELEMENTS] or list(ELEMENTS):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    width, height = ELEMENTS[name]()
    px = SCALE.get(name, PX)
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(width, height)
    cam = bpy.data.objects.new('Cam', cam_data)
    cam.location = (0, -20, 0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.world = bpy.data.worlds.new('World')
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.film_transparent = name != 'bg'
    scene.render.resolution_x, scene.render.resolution_y = round(width * px), round(height * px)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    path = os.path.join(OUT, f'{name}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f'Blender {bpy.app.version_string} — {name} : {scene.render.resolution_x}×{scene.render.resolution_y}, {os.path.getsize(path) / 1024:.0f} Ko')
