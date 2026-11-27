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
    chrome = principled('Chrome', (0.98, 0.98, 1.0), 1, 0.03)
    chrome_soft = principled('ChromeDoux', (0.95, 0.95, 1.0), 1, 0.03)
    dark = principled('ChromeNoir', (0.04, 0.04, 0.06), 1, 0.1)
    red = principled('Ecarlate', (0.85, 0.0, 0.05), 0.5, 0.2, (1.0, 0.02, 0.06), 6.0)
    redchrome = principled('ChromeRouge', (0.95, 0.1, 0.12), 1, 0.08, (1.0, 0.0, 0.04), 1.2)

    N = 480
    base = [rim(i / N) for i in range(N)]
    # 1. bandeau chrome épais tout autour (le corps du cadre), bord intérieur sombre et liseré rouge lumineux
    curve('Corps', [(p[0] + n[0] * 0.08, p[1] + n[1] * 0.08, 0) for p, n in base], [1] * N, chrome_soft, 0.22, cyclic=True)
    curve('BordInt', [(p[0] - n[0] * 0.13, p[1] - n[1] * 0.13, 0.02) for p, n in base], [1] * N, dark, 0.05, cyclic=True)
    curve('Lisere', [(p[0] - n[0] * 0.19, p[1] - n[1] * 0.19, 0.05) for p, n in base], [1] * N, red, 0.02, cyclic=True)

    # 2. flammes de chrome liquide : chaque mèche part du bord, file le long du cadre puis s'enroule vers l'extérieur
    def wisp(t, span, rise, curl, thick, mat, direction):
        pts, radii = [], []
        steps = 18
        for k in range(steps):
            f = k / (steps - 1)
            (x, y), (nx, ny) = rim(t + direction * span * f)
            h = 0.02 + rise * (f ** 1.6) + 0.05 * math.sin(f * math.pi * 2.2) * f
            # enroulement en bout de flamme : la pointe repart vers l'arrière
            ang = curl * max(0.0, f - 0.45) ** 2 * 10
            tx, ty = -ny * direction, nx * direction
            bx = x + nx * h - tx * ang
            by = y + ny * h - ty * ang
            pts.append((bx, by, 0.12 + 0.25 * f + 0.1 * math.sin(f * 5)))
            radii.append(max(0.12, (1 - f) ** 0.55 * (0.8 + 0.2 * math.sin(f * 4 + t * 40))))  # bouts arrondis : du métal liquide, pas des épines
        curve('Flamme', pts, radii, mat, thick)

    # couche serrée de petites flammes tout le long
    for i in range(110):
        t = i / 110 + rng.random() * 0.004
        (x, y), (nx, ny) = rim(t)
        top = ny > 0.5
        rise = 0.12 + rng.random() * 0.16 + (0.22 * rng.random() if top else 0)
        wisp(t, 0.022 + rng.random() * 0.025, rise, 0.04 + rng.random() * 0.06, 0.1 + rng.random() * 0.06,
             redchrome if rng.random() < 0.12 else chrome, 1 if rng.random() < 0.6 else -1)
    # grandes flammes : en haut, aux coins, et quelques-unes qui jaillissent sur les côtés
    for t0, n, big in ((0.0, 9, 1.0), (0.12, 7, 0.8), (0.25, 6, 0.75), (0.5, 9, 1.0), (0.75, 6, 0.75), (0.62, 5, 0.6), (0.37, 5, 0.6), (0.88, 5, 0.6)):
        for k in range(n):
            t = t0 + (k - n / 2) * 0.006 + rng.random() * 0.003
            wisp(t, 0.035 + rng.random() * 0.04, (0.3 + rng.random() * 0.4) * big, 0.08 + rng.random() * 0.08, 0.14 + rng.random() * 0.06,
                 redchrome if k == n // 2 else chrome, 1 if k % 2 else -1)
    # fines mèches rouges lumineuses glissées entre les flammes
    for i in range(40):
        t = rng.random()
        wisp(t, 0.02 + rng.random() * 0.02, 0.08 + rng.random() * 0.2, 0.05, 0.03, red, 1 if rng.random() < 0.5 else -1)


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

    panel((0, 0, 9), (7, 3), (1, 1, 1), 2)
    panel((-6, 3, 5), (1.5, 9), (0.8, 0.9, 1), 10)
    panel((6, -2, 5), (1.2, 9), (1, 0.85, 0.85), 8)
    panel((0, 7, 4), (9, 1.2), (1, 1, 1), 9)
    panel((1, -8, 3), (8, 2), (1, 0.05, 0.1), 2.2)    # contre-jour rouge : quelques reflets écarlates dans le chrome
    panel((0, -5, 8), (6, 2), (1, 1, 1), 7)           # lumière basse : le chrome reste clair partout
    panel((-3, -2, 7), (1.2, 1.2), (1, 1, 1), 16)
    for k in range(-4, 5):
        panel((k * 1.6, 0.8 * k, 10), (0.35, 12), (1, 1, 1), 12)  # rayures de lumière : reflets nets dans le chrome

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
    glow(path)
    print('rendu :', path)


def glow(path):
    """Halo rouge derrière le cadre (comme une aura) : flou de la silhouette, teinté, glissé dessous."""
    from PIL import Image, ImageFilter
    fr = Image.open(path).convert('RGBA')
    a = fr.split()[3]
    halo = Image.new('RGBA', fr.size, (255, 20, 50, 0))
    soft = a.filter(ImageFilter.GaussianBlur(16)).point(lambda v: min(200, int(v * 1.1)))
    halo.putalpha(soft)
    out = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    out.alpha_composite(halo)
    out.alpha_composite(fr)
    out.save(path)


main()
