"""ANIME RIFT — cadre « Chrome écarlate » pour les cartes MR (modélisé et rendu avec Blender, Cycles).

Lancer :  python3 tools/blender/build_chrome_frame.py
Produit  tools/blender/renders/cadre_chrome.png  (cadre seul, fond transparent)
     et  tools/blender/renders/cadre_chrome_apercu.png  (le même sur une carte d'exemple sombre, pour le voir).

Recette : une moulure chrome, deux rubans chrome qui s'enroulent l'un autour de l'autre tout le long du bord,
un liseré rouge lumineux à l'intérieur, des éclats chromés qui jaillissent en flammes, surtout en haut et aux coins.
"""
import math
import os
import random

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'renders')
W, H = 2.5, 3.5          # demi-largeur et demi-hauteur de la carte (5 × 7)
RES = (936, 1196)        # 7.2 × 9.2 unités à 130 px par unité
R_CORNER = 0.32
rng = random.Random(7)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def principled(name, color, metallic=1.0, roughness=0.06, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def curve(name, pts, radii, mat, bevel, cyclic=False, order=4):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = bevel
    data.bevel_resolution = 8
    data.use_fill_caps = True
    sp = data.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, (x, y, z), r in zip(sp.points, pts, radii):
        p.co = (x, y, z, 1)
        p.radius = r
    sp.use_cyclic_u = cyclic
    sp.use_endpoint_u = not cyclic
    sp.order_u = order
    sp.resolution_u = 10
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def rim(t, w=W, h=H, r=R_CORNER):
    """Point et normale sortante sur le bord arrondi, t de 0 à 1 (sens horaire depuis le haut gauche)."""
    sw, sh = w - r, h - r
    arc = math.pi * r / 2
    segs = [('line', 2 * sw), ('arc', arc), ('line', 2 * sh), ('arc', arc), ('line', 2 * sw), ('arc', arc), ('line', 2 * sh), ('arc', arc)]
    per = sum(s[1] for s in segs)
    d = (t % 1) * per
    corners = [(sw, sh), (sw, -sh), (-sw, -sh), (-sw, sh)]
    starts = [math.pi / 2, 0, -math.pi / 2, math.pi]
    for i, (kind, ln) in enumerate(segs):
        if d <= ln:
            k = i // 2
            if kind == 'line':
                f = d / ln
                if k == 0: return (-sw + 2 * sw * f, h), (0, 1)
                if k == 1: return (w, sh - 2 * sh * f), (1, 0)
                if k == 2: return (sw - 2 * sw * f, -h), (0, -1)
                return (-w, -sh + 2 * sh * f), (-1, 0)
            a = starts[k] - (d / ln) * (math.pi / 2)
            cx, cy = corners[k]
            return (cx + r * math.cos(a), cy + r * math.sin(a)), (math.cos(a), math.sin(a))
        d -= ln
    return (-sw, h), (0, 1)


def build():
    chrome = principled('Chrome', (0.97, 0.97, 1.0), 1, 0.04)
    dark = principled('ChromeNoir', (0.05, 0.05, 0.07), 1, 0.12)
    red = principled('Ecarlate', (0.85, 0.0, 0.05), 0.6, 0.18, (1.0, 0.02, 0.08), 4.0)
    redchrome = principled('ChromeRouge', (0.9, 0.08, 0.12), 1, 0.1, (1.0, 0.0, 0.05), 0.6)

    N = 420
    # 1. moulure : un jonc chrome sombre et un jonc chrome clair, posés sur le bord
    base = [rim(i / N) for i in range(N)]
    curve('Moulure', [(p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, 0) for p, n in base], [1] * N, dark, 0.11, cyclic=True)
    curve('Jonc', [(p[0] - n[0] * 0.14, p[1] - n[1] * 0.14, 0.06) for p, n in base], [1] * N, chrome, 0.035, cyclic=True)
    # 2. liseré rouge lumineux à l'intérieur
    curve('Lisere', [(p[0] - n[0] * 0.22, p[1] - n[1] * 0.22, 0.04) for p, n in base], [1] * N, red, 0.018, cyclic=True)

    # 3. rubans torsadés : deux larges rubans chrome argent qui s'enroulent, et un fin ruban rouge entre eux
    turns = 15
    for phase, mat, amp, bev, base_r in ((0.0, chrome, 0.2, 0.085, 1.0), (math.pi, chrome, 0.2, 0.075, 0.95), (math.pi / 2, redchrome, 0.16, 0.03, 1.0)):
        pts, radii = [], []
        for i in range(N):
            t = i / N
            (x, y), (nx, ny) = rim(t)
            a = t * turns * 2 * math.pi + phase
            off = amp * math.sin(a)
            z = 0.2 + 0.16 * math.cos(a)
            pts.append((x + nx * (0.02 + off), y + ny * (0.02 + off), z))
            radii.append(base_r * (0.55 + 0.6 * (0.5 + 0.5 * math.cos(a))))
        curve('Ruban', pts, radii, mat, bev, cyclic=True)

    # 4. éclats chromés en flammes : effilés, courbés vers l'extérieur ; plus nombreux et grands en haut
    def blade(t, length, width, bend, mat):
        (x, y), (nx, ny) = rim(t)
        tx, ty = -ny, nx  # tangente
        pts, radii = [], []
        steps = 9
        for s in range(steps):
            f = s / (steps - 1)
            out = 0.05 + length * f
            side = bend * f * f
            pts.append((x + nx * out + tx * side, y + ny * out + ty * side, 0.1 + 0.15 * f))
            radii.append(max(0.02, (1 - f) ** 1.3))
        curve('Eclat', pts, radii, mat, width)

    for i in range(64):
        t = rng.random()
        (x, y), (nx, ny) = rim(t)
        top = 1.0 if ny > 0.5 else 0.0
        length = 0.15 + rng.random() * 0.25 + top * rng.random() * 0.45
        blade(t, length, 0.045 + rng.random() * 0.03, (rng.random() - 0.5) * 0.9, redchrome if rng.random() < 0.15 else chrome)
    # grandes flammes chromées aux coins haut-gauche et bas-droit (comme un feu de métal), plus discrètes ailleurs
    corner_t = [0.0 - 0.004, 0.5 - 0.004]
    for t0 in corner_t:
        for k in range(7):
            blade(t0 + (k - 3) * 0.007, 0.6 + (3 - abs(k - 3)) * 0.28, 0.075, (k - 3) * 0.32 + 0.4, redchrome if k == 3 else chrome)
    for t0 in (0.25 - 0.004, 0.75 - 0.004):
        for k in range(4):
            blade(t0 + (k - 1.5) * 0.006, 0.45 + (k % 2) * 0.2, 0.06, (k - 1.5) * 0.3, chrome)


def studio():
    scene = bpy.context.scene
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.18, 0.18, 0.22, 1)  # fond clair : le chrome a de quoi refléter
    scene.world = world

    def panel(loc, size, color, strength):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
        p = bpy.context.object
        p.scale = (size[0], size[1], 1)
        p.rotation_euler = (math.atan2(loc[1], loc[2]) * -1, math.atan2(loc[0], loc[2]), 0)
        m = bpy.data.materials.new('Lumiere')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs[0].default_value = (*color, 1)
        e.inputs[1].default_value = strength
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(e.outputs[0], o.inputs[0])
        p.data.materials.append(m)
        p.visible_camera = False

    panel((0, 0, 9), (7, 3), (1, 1, 1), 5)
    panel((-6, 3, 5), (1.5, 9), (0.8, 0.9, 1), 10)
    panel((6, -2, 5), (1.2, 9), (1, 0.85, 0.85), 8)
    panel((0, 7, 4), (9, 1.2), (1, 1, 1), 9)
    panel((1, -8, 3), (8, 2), (1, 0.05, 0.1), 2.2)    # contre-jour rouge : quelques reflets écarlates dans le chrome
    panel((0, -5, 8), (6, 2), (1, 1, 1), 7)           # lumière basse : le chrome reste clair partout
    panel((-3, -2, 7), (1.2, 1.2), (1, 1, 1), 16)

    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 9.2
    cam = bpy.data.objects.new('Cam', cam_data)
    cam.location = (0, 0, 20)
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = RES
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'


def main():
    os.makedirs(OUT, exist_ok=True)
    reset()
    build()
    studio()
    path = os.path.join(OUT, 'cadre_chrome.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('rendu :', path)


main()
