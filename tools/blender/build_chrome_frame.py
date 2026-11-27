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
import sys

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


VARIANTS = {
    # nom : (métal principal, métal d'accent, couleur lumineuse, couleur du halo)
    'chrome_ecarlate': ((0.98, 0.98, 1.0), (0.95, 0.12, 0.14), (1.0, 0.02, 0.06), (255, 20, 50)),
    'chrome_pur': ((0.98, 0.98, 1.0), (0.75, 0.78, 0.85), (0.9, 0.95, 1.0), (230, 235, 255)),
    'flamme_rouge': ((0.95, 0.12, 0.14), (0.98, 0.98, 1.0), (1.0, 0.1, 0.02), (255, 60, 20)),
    'givre_rift': ((0.92, 0.95, 1.0), (0.45, 0.35, 1.0), (0.1, 0.85, 1.0), (60, 200, 255)),
}


def build(variant):
    main_c, acc_c, glow_c, _ = VARIANTS[variant]
    chrome = principled('Chrome', main_c, 1, 0.03)
    accent = principled('Accent', acc_c, 1, 0.06, glow_c, 0.8)
    dark = principled('ChromeNoir', (0.04, 0.04, 0.06), 1, 0.08)
    lum = principled('Lumiere', glow_c, 0.4, 0.2, glow_c, 7.0)

    N = 480
    base = [rim(i / N) for i in range(N)]
    # corps du cadre : un jonc chrome poli, bord intérieur sombre, liseré lumineux
    curve('Corps', [(p[0] + n[0] * 0.08, p[1] + n[1] * 0.08, 0) for p, n in base], [1] * N, chrome, 0.2, cyclic=True)
    curve('BordInt', [(p[0] - n[0] * 0.12, p[1] - n[1] * 0.12, 0.05) for p, n in base], [1] * N, dark, 0.05, cyclic=True)
    curve('Lisere', [(p[0] - n[0] * 0.18, p[1] - n[1] * 0.18, 0.08) for p, n in base], [1] * N, lum, 0.02, cyclic=True)

    def flame(t, length, lean, sway, curl, r0, mat):
        """Langue de feu en métal : base épaisse posée sur le cadre, corps en S, pointe qui s'enroule."""
        (x, y), (nx, ny) = rim(t)
        tx, ty = -ny, nx
        # direction de départ : la normale, penchée vers la tangente (lean, en radians)
        dx, dy = nx * math.cos(lean) + tx * math.sin(lean), ny * math.cos(lean) + ty * math.sin(lean)
        px, py = -dy, dx  # côté de la flamme
        pts, radii = [], []
        steps = 16
        for k in range(steps):
            f = k / (steps - 1)
            fwd = length * f
            side = sway * math.sin(math.pi * f * 1.15) + curl * f ** 3
            pts.append((x + dx * fwd + px * side, y + dy * fwd + py * side, 0.16 + 0.18 * math.sin(math.pi * f)))
            radii.append(max(0.1, (1 - f) ** 0.7))
        curve('Flamme', pts, radii, mat, r0)

    # couronne serrée de flammes moyennes : elles couvrent le jonc et lui donnent sa silhouette ondulée
    for i in range(96):
        t = i / 96 + rng.uniform(-0.003, 0.003)
        (x, y), (nx, ny) = rim(t)
        top = ny > 0.5
        sgn = 1 if (i % 2) else -1
        flame(t, rng.uniform(0.22, 0.38) + (0.18 if top else 0), sgn * rng.uniform(0.5, 1.0), sgn * rng.uniform(0.05, 0.12),
              -sgn * rng.uniform(0.06, 0.16), rng.uniform(0.09, 0.13), accent if rng.random() < 0.14 else chrome)
    # grandes flammes : bouquets aux coins (surtout haut-gauche et bas-droit) et au milieu du haut
    bouquets = [(0.0, 7, 1.0), (0.5, 7, 1.0), (0.25, 4, 0.55), (0.75, 4, 0.55), (0.115, 5, 0.7), (0.62, 3, 0.45), (0.38, 3, 0.45), (0.88, 3, 0.45)]
    for t0, n, big in bouquets:
        for k in range(n):
            sgn = 1 if k % 2 else -1
            flame(t0 + (k - n / 2) * 0.009, (0.5 + rng.uniform(0, 0.45)) * big + 0.15, sgn * rng.uniform(0.2, 0.7),
                  sgn * rng.uniform(0.08, 0.2), -sgn * rng.uniform(0.15, 0.3), rng.uniform(0.12, 0.17) * (0.7 + 0.3 * big),
                  accent if k == n // 2 else chrome)
    # fines mèches lumineuses glissées dans le métal
    for i in range(36):
        t = rng.random()
        sgn = 1 if rng.random() < 0.5 else -1
        flame(t, rng.uniform(0.15, 0.4), sgn * 0.8, sgn * 0.06, -sgn * 0.1, 0.03, lum)


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
    wanted = [a for a in sys.argv[1:] if a in VARIANTS] or list(VARIANTS)
    for v in wanted:
        global rng
        rng = random.Random(7)
        reset()
        build(v)
        studio()
        path = os.path.join(OUT, f'cadre_{v}.png')
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        glow(path, VARIANTS[v][3])
        print('rendu :', path)


def glow(path, color=(255, 20, 50)):
    """Halo rouge derrière le cadre (comme une aura) : flou de la silhouette, teinté, glissé dessous."""
    from PIL import Image, ImageFilter
    fr = Image.open(path).convert('RGBA')
    a = fr.split()[3]
    halo = Image.new('RGBA', fr.size, (*color, 0))
    soft = a.filter(ImageFilter.GaussianBlur(16)).point(lambda v: min(200, int(v * 1.1)))
    halo.putalpha(soft)
    out = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    out.alpha_composite(halo)
    out.alpha_composite(fr)
    out.save(path)


main()
