"""ANIME RIFT — cadres des cartes, modélisés et rendus avec Blender (Cycles).

Lancer :  python3 tools/blender/build_frames.py            (les quatre raretés)
          python3 tools/blender/build_frames.py rift       (une seule)

Produit  src/assets/frames/<rareté>.png  : le cadre seul, sur fond transparent, vu de face.
La carte mesure 5 × 7 unités, centrée à l'origine ; l'image couvre 7.2 × 9.2 unités, soit une marge de 1.1
pour tout ce qui dépasse. Le jeu superpose cette image à la carte (voir .card__frame dans ui.css).

Chaque rareté suit une recette : une moulure, des lianes qui ondulent autour, des épines sur leurs crêtes,
des spirales et des lames aux coins, de grandes griffes qui sortent de derrière.
"""
import math
import os
import random
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'frames')
W, H = 2.5, 3.5  # demi-largeur et demi-hauteur de la carte
RES = (936, 1196)  # 7.2 × 9.2 unités à 130 px par unité
ONLY = [a for a in sys.argv[1:] if a in ('common', 'rare', 'epic', 'ultra', 'legend', 'rift')]
THEME_ARGS = [a for a in sys.argv[1:] if a in ('onepiece', 'dragonball', 'bleach', 'demonslayer', 'jujutsu', 'hunter')]


# --- matières ------------------------------------------------------------------------------------------------
def principled(name, color, metallic=1.0, roughness=0.08, emission=None, strength=0.0, film=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    if film and 'Thin Film Thickness' in b.inputs:  # irisation de surface (nacre)
        b.inputs['Thin Film Thickness'].default_value = film
        b.inputs['Thin Film IOR'].default_value = 1.45
    return m


def rainbow(name):
    """Métal holographique : la couleur suit la position sur la carte et parcourt l'arc-en-ciel."""
    m = principled(name, (1, 1, 1), 1.0, 0.1)
    nt = m.node_tree
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mix = nt.nodes.new('ShaderNodeMath')
    mix.operation = 'MULTIPLY_ADD'
    mix.inputs[1].default_value = 0.22
    wrap = nt.nodes.new('ShaderNodeMath')
    wrap.operation = 'FRACT'
    scale_y = nt.nodes.new('ShaderNodeMath')
    scale_y.operation = 'MULTIPLY'
    scale_y.inputs[1].default_value = 0.17
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    stops = [(0.0, (1, 0.85, 0.2)), (0.17, (1, 0.25, 0.6)), (0.34, (0.6, 0.35, 1)), (0.5, (0.2, 0.7, 1)), (0.67, (0.25, 1, 0.6)), (0.84, (1, 0.6, 0.2)), (1.0, (1, 0.85, 0.2))]
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = stops[0][0], (*stops[0][1], 1)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = ramp.color_ramp.elements.new(pos)
        e.color = (*col, 1)
    b = nt.nodes['Principled BSDF']
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], scale_y.inputs[0])
    nt.links.new(sep.outputs['X'], mix.inputs[0])
    nt.links.new(scale_y.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], wrap.inputs[0])
    nt.links.new(wrap.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    nt.links.new(ramp.outputs[0], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.35
    return m


def materials():
    return {
        'chrome': principled('Chrome', (0.96, 0.96, 1.0), 1, 0.05),
        'dark': principled('DarkChrome', (0.04, 0.04, 0.06), 1, 0.16),
        'red': principled('Blood', (0.75, 0.0, 0.02), 0.9, 0.14, (1.0, 0.0, 0.03), 0.28),
        'redlip': principled('RedLip', (0.9, 0.0, 0.03), 0.4, 0.3, (1.0, 0.0, 0.04), 1.1),
        'steel': principled('Steel', (0.5, 0.62, 0.86), 1, 0.2),
        'steellip': principled('SteelLip', (0.85, 0.92, 1.0), 1, 0.08),
        'violet': principled('Amethyst', (0.42, 0.2, 1.0), 1, 0.1, (0.45, 0.15, 1.0), 0.35),
        'violetlip': principled('VioletLip', (0.6, 0.4, 1.0), 0.5, 0.2, (0.5, 0.25, 1.0), 0.9),
        'holo': rainbow('Holo'),
        'pearl': principled('Pearl', (1.0, 0.97, 0.98), 0.75, 0.12, film=520),
        'gold': principled('Gold', (1.0, 0.72, 0.22), 1, 0.12, (1.0, 0.7, 0.2), 0.25),
        'sea': principled('Sea', (0.05, 0.32, 0.9), 0.8, 0.12, (0.05, 0.4, 1.0), 0.5),
        'jade': principled('Jade', (0.05, 0.7, 0.45), 0.7, 0.12, (0.05, 0.8, 0.5), 0.5),
        'curse': principled('Curse', (0.2, 0.1, 0.9), 0.5, 0.15, (0.3, 0.15, 1.0), 1.2),
        'emerald': principled('Emerald', (0.1, 0.75, 0.3), 0.7, 0.1, (0.1, 0.8, 0.3), 0.5),
        'iron': principled('Iron', (0.32, 0.3, 0.3), 1, 0.42),
        'ironlip': principled('IronLip', (0.55, 0.5, 0.46), 1, 0.3),
        'deepgold': principled('DeepGold', (0.55, 0.3, 0.05), 1, 0.2),
        'amber': principled('Amber', (1.0, 0.45, 0.05), 0.6, 0.12, (1.0, 0.4, 0.02), 0.8),
        'goldlip': principled('GoldLip', (1.0, 0.85, 0.4), 0.5, 0.2, (1.0, 0.8, 0.3), 1.2),
    }


# --- géométrie -----------------------------------------------------------------------------------------------
def curve(name, pts, radii, mat, bevel, cyclic=False):
    """Tube lisse le long d'une suite de points, d'épaisseur variable (rayon par point × bevel)."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = bevel
    data.bevel_resolution = 6
    data.use_fill_caps = True
    sp = data.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, (x, y, z), r in zip(sp.points, pts, radii):
        p.co = (x, y, z, 1)
        p.radius = r
    sp.use_cyclic_u = cyclic
    sp.use_endpoint_u = not cyclic
    sp.order_u = 4
    sp.resolution_u = 6
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def rim(t, w=W - 0.17, h=H - 0.17):
    """Point et normale sortante à la position t (0..1) du pourtour."""
    per = 4 * (w + h)
    d = (t % 1) * per
    if d < 2 * w:
        return (-w + d, h), (0, 1)
    d -= 2 * w
    if d < 2 * h:
        return (w, h - d), (1, 0)
    d -= 2 * h
    if d < 2 * w:
        return (w - d, -h), (0, -1)
    d -= 2 * w
    return (-w, -h + d), (-1, 0)


def molding(mat, band, z=0.0, inset=0.0):
    """Moulure du cadre : jonc bombé le long d'un rectangle arrondi."""
    w, h, r = W - band / 2 - inset, H - band / 2 - inset, 0.28
    pts = []
    for cx, cy, a0 in ((w - r, h - r, 0), (-w + r, h - r, 90), (-w + r, -h + r, 180), (w - r, -h + r, 270)):
        for i in range(7):
            a = math.radians(a0 + 90 * i / 6)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r, z))
        # points intermédiaires sur le côté suivant, pour garder les bords bien droits
        nxt = {0: (-w + r, h), 90: (-w, -h + r), 180: (w - r, -h), 270: (w, h - r)}[a0]
        last = pts[-1]
        for k in (0.25, 0.5, 0.75):
            pts.append((last[0] + (nxt[0] - last[0]) * k, last[1] + (nxt[1] - last[1]) * k, z))
    o = curve('Molding', pts, [1] * len(pts), mat, band / 2, cyclic=True)
    o.scale.z = 0.8
    return o


def thorn(x, y, angle, length, radius, bend, mat, z=0.12):
    """Épine ou griffe recourbée : un tube qui s'affine jusqu'à la pointe."""
    dx, dy = math.cos(angle), math.sin(angle)
    px, py = -dy, dx
    pts, radii = [], []
    for i in range(7):
        k = i / 6
        along, across = length * k, bend * length * k * k
        pts.append((x + dx * along + px * across, y + dy * along + py * across, z + math.sin(math.pi * k) * radius * 0.6))
        radii.append(max(0.02, (1 - k) ** 0.8))
    return curve('Thorn', pts, radii, mat, radius)


def vine(a, b, n, waves, amp, phase, radius, mat, crest_every=1):
    """Liane qui ondule d'un coin à l'autre, en passant dessus et dessous. Renvoie ses crêtes extérieures."""
    pts, radii, crests = [], [], []
    steps = 46
    prev = 0
    for i in range(steps + 1):
        t = i / steps
        env = math.sin(math.pi * t) ** 0.55
        ang = 2 * math.pi * waves * t + phase
        off = amp * math.sin(ang) * env
        p = (a[0] + (b[0] - a[0]) * t + n[0] * off, a[1] + (b[1] - a[1]) * t + n[1] * off, 0.2 + math.cos(ang) * 0.13)
        pts.append(p)
        radii.append(0.35 + 0.65 * env)
        slope = math.cos(ang)
        if i > 1 and prev > 0 and slope <= 0 and math.sin(ang) > 0.6:
            crests.append(p)
        prev = slope
    curve('Vine', pts, radii, mat, radius)
    return crests[::crest_every]


def spiral(cx, cy, start, turn, r0, radius, mat, z=0.26):
    pts, radii = [], []
    for i in range(26):
        s = i / 25
        a = start + turn * s * math.pi * 1.9
        r = r0 * (1 - 0.82 * s)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r, z + s * 0.1))
        radii.append(max(0.08, 1 - s * 0.9))
    return curve('Spiral', pts, radii, mat, radius)


def gem(x, y, size, mat, z=0.3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(x, y, z))
    o = bpy.context.object
    o.scale = (1, 1.35, 0.6)
    o.rotation_euler.z = math.pi / 4
    o.data.materials.append(mat)
    return o


CORNERS = [(-1, 1), (1, 1), (1, -1), (-1, -1)]
SIDES = [  # départ, arrivée, normale sortante, ondulations
    ((-W + 0.45, H - 0.17), (W - 0.45, H - 0.17), (0, 1), 2.5),
    ((W - 0.17, H - 0.45), (W - 0.17, -H + 0.45), (1, 0), 3.5),
    ((W - 0.45, -H + 0.17), (-W + 0.45, -H + 0.17), (0, -1), 2.5),
    ((-W + 0.17, -H + 0.45), (-W + 0.17, H - 0.45), (-1, 0), 3.5),
]

RECIPES = {
    # N — fer brut : une simple moulure sombre et quatre rivets. Rien ne dépasse.
    'common': dict(band=0.26, frame='iron', lip='ironlip', vines=[], amp=0, vine_r=0, thorn=None,
                   spiral=None, blades=None, studs=None, back=None, gems=('ironlip', 0.085), tendrils=0),
    # SSR — or massif : deux lianes d'or clair et d'or sombre, épines d'ambre, gerbes dorées derrière.
    'ultra': dict(band=0.34, frame='gold', lip='goldlip', vines=['deepgold', 'gold'], amp=0.22, vine_r=0.08, thorn=(0.4, 0.052, ['gold', 'amber']),
                  spiral=(0.38, 0.07, 'gold', None), blades=(0.82, 0.095, 'gold'), studs=None,
                  back=([-56, -18, 20, 58], [0.62, 1.0, 1.0, 0.62], 0.14, ['gold', 'deepgold']), gems=('amber', 0.15), tendrils=6),
    # R — acier : moulure sobre, deux lames et un cabochon par coin, un fleuron au milieu de chaque bord.
    'rare': dict(band=0.3, frame='steel', lip='steellip', vines=[], amp=0, vine_r=0, thorn=None,
                 spiral=None, blades=(0.55, 0.075, 'steellip'), studs=(0.3, 'steellip'), back=None, gems=('steellip', 0.11), tendrils=0),
    # SR — améthyste : une liane violette, épines chromées, petites spirales.
    'epic': dict(band=0.32, frame='violet', lip='violetlip', vines=['violet'], amp=0.2, vine_r=0.07, thorn=(0.34, 0.045, ['chrome']),
                 spiral=(0.3, 0.06, 'violet', None), blades=(0.7, 0.085, 'chrome'), studs=None,
                 back=([-38, 0, 38], [0.55, 0.8, 0.55], 0.11, ['violet']), gems=('violetlip', 0.13), tendrils=4),
    # LR — holographique : deux lianes arc-en-ciel et nacre, épines irisées, grandes gerbes derrière.
    'legend': dict(band=0.34, frame='holo', lip='gold', vines=['holo', 'pearl'], amp=0.24, vine_r=0.085, thorn=(0.46, 0.055, ['holo', 'pearl']),
                   spiral=(0.42, 0.075, 'pearl', 'holo'), blades=(0.9, 0.1, 'holo'), studs=None,
                   back=([-70, -36, -4, 30, 62], [0.6, 0.95, 1.25, 1.05, 0.62], 0.15, ['holo', 'gold']), gems=('pearl', 0.15), tendrils=8),
    # MR — chrome liquide et rouge sang : ronces entrelacées, épines rouges, grandes griffes rouges et noires.
    'rift': dict(band=0.36, frame='chrome', lip='redlip', vines=['dark', 'chrome'], amp=0.27, vine_r=0.095, thorn=(0.52, 0.06, ['red']),
                 spiral=(0.46, 0.085, 'chrome', 'dark'), blades=(1.0, 0.11, 'chrome'), studs=None,
                 back=([-74, -40, -8, 26, 60], [0.68, 1.08, 1.42, 1.2, 0.7], 0.18, ['red', 'dark']), gems=('red', 0.16), tendrils=12),
}


def build(rarity, mats):
    r = RECIPES[rarity]
    random.seed(11)
    molding(mats[r['frame']], r['band'])
    molding(mats[r['lip']], 0.07, z=0.1, inset=r['band'] - 0.02)

    thorns = []
    for a, b, n, waves in SIDES:
        base = math.atan2(n[1], n[0])
        for v, tone in enumerate(r['vines']):
            phase = math.pi if len(r['vines']) > 1 and v == 0 else 0
            for i, p in enumerate(vine(a, b, n, waves, r['amp'], phase, r['vine_r'] * (1 if v == len(r['vines']) - 1 else 0.88), mats[tone])):
                thorns.append((p, base, i + v))
        if r['studs']:
            length, tone = r['studs']
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            for off, k in ((-0.85, 0.7), (0, 1), (0.85, 0.7)):
                thorn(mx, my, base + off, length * k, 0.05, 0.15 * (1 if off > 0 else -1), mats[tone])
    if r['thorn']:
        length, radius, tones = r['thorn']
        for p, base, k in thorns:
            lean = 0.5 if k % 2 else -0.5
            thorn(p[0], p[1], base + lean, length * (1 + (k % 3) * 0.4), radius, 0.5 if k % 2 else -0.5, mats[tones[k % len(tones)]], z=p[2] + 0.05)

    for sx, sy in CORNERS:
        x, y = sx * (W - 0.14), sy * (H - 0.14)
        diag = math.atan2(sy, sx)
        turn = 1 if sx * sy > 0 else -1
        if r['spiral']:
            r0, radius, tone, second = r['spiral']
            spiral(x + sx * r0 * 0.66, y + sy * r0 * 0.66, diag + math.pi, turn, r0, radius, mats[tone])
            if second:
                spiral(x + sx * 0.18 - sy * r0 * 0.85 * turn, y + sy * 0.18 + sx * r0 * 0.85 * turn, diag + 2.6, -turn, r0 * 0.6, radius * 0.7, mats[second])
        if r['blades']:
            length, radius, tone = r['blades']
            thorn(x, y, diag - 0.6, length, radius, 0.4, mats[tone], z=0.2)
            thorn(x, y, diag + 0.6, length, radius, -0.4, mats[tone], z=0.2)
        if r['back']:
            offsets, lengths, radius, tones = r['back']
            for i, (o, length) in enumerate(zip(offsets, lengths)):
                thorn(x - sx * 0.2, y - sy * 0.2, diag + math.radians(o), length, radius, 0.42 * turn, mats[tones[i % len(tones)]], z=-0.25)
        tone, size = r['gems']
        gem(x, y, size, mats[tone])

    # petites vrilles qui se détachent du cadre, pour le côté organique
    for i in range(r['tendrils']):
        (px, py), (nx, ny) = rim(random.random())
        a = math.atan2(ny, nx) + random.uniform(-0.5, 0.5)
        spiral(px + nx * 0.3, py + ny * 0.3, a + math.pi, random.choice((-1, 1)), random.uniform(0.14, 0.24), 0.035, mats[r['vines'][-1] if r['vines'] else r['frame']], z=0.3)


# --- familles de cadres : une par bannière --------------------------------------------------------------------------
# La rareté garde sa matière (fer, acier, améthyste, or, arc-en-ciel, chrome) ; la bannière change la FORME des
# ornements et leur couleur d'accent. Lancer par exemple :  python3 tools/blender/build_frames.py onepiece bleach
THEMES = {
    'onepiece': dict(vine='rope', thorn='none', corner='wheel', back='waves', accent='sea'),          # cordages, barres à roue, vagues
    'dragonball': dict(vine='none', thorn='straight', corner='orb', back='rays', accent='amber'),     # boules d'ambre, aura en pointes
    'bleach': dict(vine='none', thorn='none', corner='cross', back='rays', accent='dark'),            # lames droites croisées
    'demonslayer': dict(vine='wave', thorn='flame', corner='orb', back='claws', accent='jade'),       # flammes couchées par le vent
    'jujutsu': dict(vine='wave', thorn='none', corner='curl', back='none', accent='curse'),           # volutes d'énergie
    'hunter': dict(vine='chain', thorn='none', corner='orb', back='rays', accent='emerald'),          # chaînes
}
LEVEL = {'common': 0, 'rare': 1, 'epic': 2, 'ultra': 3, 'legend': 4, 'rift': 5}


def smooth(obj, mat):
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def build_themed(rarity, theme, mats):
    r, t, k = RECIPES[rarity], THEMES[theme], LEVEL[rarity]
    random.seed(11)
    acc, main = mats[t['accent']], mats[r['frame']]
    second = mats[r['vines'][0]] if r['vines'] else main
    molding(main, r['band'])
    molding(mats[r['lip']], 0.07, z=0.1, inset=r['band'] - 0.02)

    # tour du cadre (à partir de SR)
    if k >= 2:
        for a, b, n, waves in SIDES:
            if t['vine'] == 'wave':
                for v, tone in enumerate(r['vines']):
                    vine(a, b, n, waves, r['amp'], math.pi if len(r['vines']) > 1 and v == 0 else 0, r['vine_r'], mats[tone])
            elif t['vine'] == 'rope':  # deux torons serrés
                vine(a, b, n, waves * 3.4, 0.085, 0, r['vine_r'] * 1.2, second)
                vine(a, b, n, waves * 3.4, 0.085, math.pi, r['vine_r'] * 1.2, main)
            elif t['vine'] == 'chain':  # maillons alternés, à plat puis de chant
                length = math.hypot(b[0] - a[0], b[1] - a[1])
                count = int(length / 0.4)
                horizontal = abs(b[0] - a[0]) > abs(b[1] - a[1])
                for i in range(count):
                    f = (i + 0.5) / count
                    bpy.ops.mesh.primitive_torus_add(major_radius=0.15 + 0.01 * k, minor_radius=0.042 + 0.004 * k, location=(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.2))
                    link = smooth(bpy.context.object, main if i % 2 else second)
                    link.scale = (1.45, 1, 1) if horizontal else (1, 1.45, 1)
                    if i % 2:
                        link.rotation_euler = (math.pi / 2, 0, 0) if horizontal else (0, math.pi / 2, 0)

    # pointes autour du cadre
    count = [0, 8, 14, 20, 28, 38][k]
    for i in range(count if t['thorn'] != 'none' else 0):
        (x, y), (nx, ny) = rim((i + 0.5) / count, W - 0.05, H - 0.05)
        out = math.atan2(ny, nx)
        if t['thorn'] == 'straight':
            thorn(x, y, out, (0.3 + 0.09 * k) * (1.6 if i % 2 == 0 else 1), 0.05 + 0.006 * k, 0, acc if i % 3 == 0 else main, z=0.15)
        else:  # flammes : toutes couchées dans le même sens
            thorn(x, y, out - 0.7, (0.3 + 0.1 * k) * random.uniform(0.7, 1.4), 0.06 + 0.008 * k, -0.5, acc if i % 2 else main, z=0.15)

    size = 0.16 + 0.06 * k
    for sx, sy in CORNERS:
        x, y = sx * (W - 0.14), sy * (H - 0.14)
        diag = math.atan2(sy, sx)
        turn = 1 if sx * sy > 0 else -1
        # derrière le coin
        if k >= 2 and t['back'] == 'claws' and r['back']:
            offsets, lengths, radius, tones = r['back']
            for i, (o, length) in enumerate(zip(offsets, lengths)):
                thorn(x - sx * 0.2, y - sy * 0.2, diag + math.radians(o), length, radius, 0.42 * turn, acc if i % 2 else main, z=-0.25)
        elif k >= 2 and t['back'] == 'rays':
            rays = 3 + k
            for i in range(rays):
                spread = (i / (rays - 1) - 0.5) * 2.4
                thorn(x - sx * 0.2, y - sy * 0.2, diag + spread, (0.45 + 0.2 * k) * (1 - abs(spread) * 0.28), 0.07 + 0.02 * k, 0, acc if i % 2 else main, z=-0.25)
        elif k >= 2 and t['back'] == 'waves':
            spiral(x + sx * 0.3, y + sy * 0.3, diag + math.pi, turn, 0.32 + 0.1 * k, 0.07 + 0.014 * k, acc, z=-0.2)
            spiral(x + sx * 0.1 - sy * 0.5 * turn, y + sy * 0.1 + sx * 0.5 * turn, diag + 2.4, -turn, 0.2 + 0.06 * k, 0.05 + 0.01 * k, main, z=-0.22)
        # sur le coin
        if t['corner'] == 'wheel':
            bpy.ops.mesh.primitive_torus_add(major_radius=size, minor_radius=size * 0.17, location=(x, y, 0.36))
            smooth(bpy.context.object, main)
            for i in range(4):
                bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.075, depth=size * 2.7, location=(x, y, 0.36), rotation=(math.pi / 2, 0, i * math.pi / 4))
                smooth(bpy.context.object, second)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.3, location=(x, y, 0.42))
            smooth(bpy.context.object, acc)
        elif t['corner'] == 'orb':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.72, location=(x, y, 0.36))
            smooth(bpy.context.object, acc)
            bpy.ops.mesh.primitive_torus_add(major_radius=size * 0.95, minor_radius=size * 0.12, location=(x, y, 0.3))
            smooth(bpy.context.object, main)
        elif t['corner'] == 'cross':
            for i, lean in enumerate((-0.55, 0.55, 0)):
                thorn(x - sx * 0.25, y - sy * 0.25, diag + lean, (0.55 + 0.26 * k) * (1.25 if lean == 0 else 1), 0.06 + 0.012 * k, 0, acc if i == 2 else main, z=0.3)
            gem(x, y, size * 0.55, main)
        else:  # volutes
            spiral(x + sx * size, y + sy * size, diag + math.pi, turn, size * 1.5, 0.05 + 0.01 * k, acc)
            spiral(x + sx * 0.1 - sy * size * 1.4 * turn, y + sy * 0.1 + sx * size * 1.4 * turn, diag + 2.6, -turn, size, 0.04 + 0.008 * k, main)
            gem(x, y, size * 0.5, acc)

    if k >= 3:  # un cabochon au milieu de chaque bord
        for a, b, n, _ in SIDES:
            gem((a[0] + b[0]) / 2 + n[0] * 0.05, (a[1] + b[1]) / 2 + n[1] * 0.05, 0.1 + 0.02 * k, acc, z=0.4)
    if t['corner'] == 'curl':  # énergie qui s'échappe tout autour
        for i in range(4 * k):
            (px, py), (nx, ny) = rim(random.random())
            ang = math.atan2(ny, nx) + random.uniform(-0.6, 0.6)
            spiral(px + nx * 0.32, py + ny * 0.32, ang + math.pi, random.choice((-1, 1)), random.uniform(0.16, 0.3), 0.04, acc if i % 2 else main, z=0.3)


# --- effets lumineux autour du cadre (seconde image, que le jeu anime par-dessus le cadre) -------------------------
def glow(name, color, strength):
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


def flat_mesh(name, pts, mat, z=0.6):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, z) for x, y in pts], [], [tuple(range(len(pts)))])
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def star(x, y, size, mat, angle=0.0):
    """Étoile à quatre branches, comme un éclat de lumière."""
    pts = []
    for i in range(8):
        a = angle + i * math.pi / 4
        r = size if i % 2 == 0 else size * 0.16
        pts.append((x + math.cos(a) * r, y + math.sin(a) * r))
    return flat_mesh('Star', pts, mat)


def streak(x, y, angle, length, width, mat):
    """Trait de lumière effilé aux deux bouts."""
    dx, dy = math.cos(angle), math.sin(angle)
    px, py = -dy, dx
    return flat_mesh('Streak', [(x - dx * length / 2, y - dy * length / 2), (x + px * width, y + py * width), (x + dx * length / 2, y + dy * length / 2), (x - px * width, y - py * width)], mat)


def lightning(a, b, mat, jitter=0.22, radius=0.022):
    """Arc électrique : une ligne brisée entre deux points, avec une petite branche."""
    pts = []
    n = 9
    for i in range(n + 1):
        k = i / n
        j = 0 if i in (0, n) else jitter
        pts.append((a[0] + (b[0] - a[0]) * k + random.uniform(-j, j), a[1] + (b[1] - a[1]) * k + random.uniform(-j, j), 0.6))
    data = bpy.data.curves.new('Arc', 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    for line in (pts, [pts[4], (pts[4][0] + random.uniform(-0.5, 0.5), pts[4][1] + random.uniform(-0.5, 0.5), 0.6)]):
        sp = data.splines.new('POLY')
        sp.points.add(len(line) - 1)
        for p, co in zip(sp.points, line):
            p.co = (*co, 1)
    obj = bpy.data.objects.new('Arc', data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def ember(x, y, r, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=(x, y, 0.6))
    bpy.context.object.data.materials.append(mat)


def outside(reach=0.9):
    """Un point au hasard autour du cadre, à l'extérieur de la carte."""
    (x, y), (nx, ny) = rim(random.random(), W, H)
    d = random.uniform(0.05, reach)
    return x + nx * d, y + ny * d, math.atan2(ny, nx)


def build_fx(rarity):
    random.seed(29)
    white = glow('White', (1, 1, 1), 1.0)
    if rarity == 'common':
        grey = glow('Grey', (0.7, 0.75, 0.85), 1.0)
        for sx, sy in ((-1, 1), (1, -1)):  # deux reflets discrets, rien de plus
            star(sx * (W - 0.1), sy * (H - 0.1), 0.2, grey, 0.2)
    elif rarity == 'ultra':
        gold = glow('Gold', (1, 0.82, 0.3), 1.0)
        amber = glow('Amber', (1, 0.55, 0.1), 1.0)
        for i in range(18):
            x, y, _ = outside(0.9)
            star(x, y, random.uniform(0.14, 0.46), (white, gold, amber)[i % 3], random.uniform(0, 0.6))
        for sx, sy in CORNERS:  # un grand rayon doré sur chaque coin
            streak(sx * (W - 0.1), sy * (H - 0.1), math.atan2(sy, sx) + math.pi / 2, 2.2, 0.045, gold)
        for i in range(8):  # filets d'or qui s'échappent du cadre
            x, y, a = outside(0.2)
            thorn(x, y, a + random.uniform(-0.8, 0.8), random.uniform(0.45, 0.85), 0.035, random.choice((-0.6, 0.6)), gold, z=0.6)
        for i in range(14):
            x, y, _ = outside(1.0)
            ember(x, y, random.uniform(0.03, 0.065), gold if i % 2 else amber)
    elif rarity == 'rare':
        blue = glow('Blue', (0.5, 0.75, 1), 1.0)
        for sx, sy in CORNERS:
            star(sx * (W + 0.2), sy * (H + 0.2), 0.42, white, 0.2)
            star(sx * (W - 0.4), sy * (H + 0.45), 0.2, blue)
    elif rarity == 'epic':
        violet = glow('Violet', (0.7, 0.4, 1), 1.0)
        for i in range(14):
            x, y, _ = outside(0.8)
            star(x, y, random.uniform(0.14, 0.4), white if i % 3 == 0 else violet, random.uniform(0, 0.6))
        for i in range(10):  # filets d'énergie qui s'échappent du cadre
            x, y, a = outside(0.2)
            thorn(x, y, a + random.uniform(-0.9, 0.9), random.uniform(0.5, 0.95), 0.035, random.choice((-0.6, 0.6)), violet, z=0.6)
    elif rarity == 'legend':
        tints = [glow('Pink', (1, 0.45, 0.8), 1.0), glow('Cyan', (0.4, 0.9, 1), 1.0), glow('Gold', (1, 0.85, 0.35), 1.0), glow('Mint', (0.5, 1, 0.7), 1.0), white]
        for i in range(22):
            x, y, _ = outside(0.95)
            star(x, y, random.uniform(0.14, 0.5), tints[i % 5], random.uniform(0, 0.7))
        for sx, sy in CORNERS:  # grands traits de lumière en croix sur chaque coin
            for k, (length, tilt) in enumerate(((2.6, 0.0), (1.7, 0.5), (1.5, -0.5))):
                streak(sx * (W - 0.1), sy * (H - 0.1), math.atan2(sy, sx) + math.pi / 2 + tilt, length, 0.045, tints[(k + (sx > 0)) % 5])
        for i in range(18):
            x, y, _ = outside(1.0)
            ember(x, y, random.uniform(0.03, 0.07), tints[i % 5])
    else:
        red = glow('Red', (1, 0.05, 0.1), 1.0)
        hot = glow('Hot', (1, 0.55, 0.45), 1.0)
        orange = glow('Orange', (1, 0.4, 0.05), 1.0)
        corners = [(sx * (W + 0.05), sy * (H + 0.05)) for sx, sy in CORNERS]
        for i in range(4):  # arcs électriques qui courent d'un coin à l'autre, juste hors du cadre
            a, b = corners[i], corners[(i + 1) % 4]
            mid = ((a[0] + b[0]) / 2 * 1.16, (a[1] + b[1]) / 2 * 1.1)
            lightning(a, mid, hot if i % 2 else white)
            lightning(mid, b, red, jitter=0.3, radius=0.03)
        for i in range(16):  # flammes qui montent du cadre
            x, y, a = outside(0.15)
            thorn(x, y, a * 0.35 + math.pi / 2 * 0.65 + random.uniform(-0.4, 0.4), random.uniform(0.45, 1.0), 0.05, random.choice((-0.7, 0.7)), red if i % 3 else orange, z=0.6)
        for i in range(26):
            x, y, _ = outside(1.0)
            ember(x, y, random.uniform(0.025, 0.07), orange if i % 2 else red)
        for i in range(10):
            x, y, _ = outside(0.9)
            star(x, y, random.uniform(0.16, 0.44), white if i % 2 else hot, random.uniform(0, 0.6))


# Effets lumineux propres à chaque bannière : mêmes outils (étoiles, braises, traits, arcs, flammes), dosés autrement.
#   c1, c2 : couleurs ; stars, embers, streaks, arcs, flames : quantités à la rareté maximale (réduites pour les autres).
FX_THEMES = {
    'onepiece': dict(c1=(0.3, 0.75, 1), c2=(0.85, 0.97, 1), stars=6, embers=40, streaks=0, arcs=0, flames=10, lean=1.2),      # embruns et vagues
    'dragonball': dict(c1=(1, 0.85, 0.2), c2=(1, 0.55, 0.1), stars=10, embers=14, streaks=0, arcs=6, flames=12, lean=0),         # aura et éclairs
    'bleach': dict(c1=(1, 1, 1), c2=(0.75, 0.7, 1), stars=6, embers=6, streaks=14, arcs=0, flames=0, lean=0),                    # entailles
    'demonslayer': dict(c1=(0.2, 1, 0.65), c2=(1, 0.6, 0.15), stars=6, embers=30, streaks=0, arcs=0, flames=22, lean=-0.8),      # flammes
    'jujutsu': dict(c1=(0.55, 0.35, 1), c2=(0.3, 0.6, 1), stars=8, embers=12, streaks=0, arcs=8, flames=8, lean=0.6),            # énergie occulte
    'hunter': dict(c1=(0.3, 1, 0.45), c2=(1, 0.9, 0.4), stars=16, embers=26, streaks=4, arcs=0, flames=6, lean=0),              # aura
}


def build_fx_themed(rarity, theme):
    f, k = FX_THEMES[theme], LEVEL[rarity]
    random.seed(29)
    dose = [0.0, 0.2, 0.4, 0.62, 0.82, 1.0][k]
    a, b, white = glow('A', f['c1'], 1.0), glow('B', f['c2'], 1.0), glow('White', (1, 1, 1), 1.0)
    pick = lambda i: (a, b, white)[i % 3]
    if k == 0:  # carte commune : deux reflets discrets
        for sx, sy in ((-1, 1), (1, -1)):
            star(sx * (W - 0.1), sy * (H - 0.1), 0.2, a, 0.2)
        return
    for i in range(round(f['stars'] * dose) + 2):
        x, y, _ = outside(0.9)
        star(x, y, random.uniform(0.14, 0.44), pick(i), random.uniform(0, 0.6))
    for i in range(round(f['embers'] * dose)):
        x, y, _ = outside(1.0)
        ember(x, y, random.uniform(0.025, 0.07), pick(i))
    for i in range(round(f['streaks'] * dose)):  # entailles : longs traits obliques, tous dans le même sens
        x, y, _ = outside(0.5)
        streak(x, y, math.radians(-58) + random.uniform(-0.12, 0.12), random.uniform(0.9, 2.2), 0.035, pick(i))
    for i in range(round(f['flames'] * dose)):
        x, y, ang = outside(0.15)
        thorn(x, y, ang * 0.4 + math.pi / 2 * 0.6 + f['lean'] + random.uniform(-0.3, 0.3), random.uniform(0.4, 0.95), 0.05, random.choice((-0.7, 0.7)), a if i % 3 else b, z=0.6)
    arcs = round(f['arcs'] * dose)
    corners = [(sx * (W + 0.05), sy * (H + 0.05)) for sx, sy in CORNERS]
    for i in range(arcs):
        p0, p1 = corners[i % 4], corners[(i + 1) % 4]
        mid = ((p0[0] + p1[0]) / 2 * 1.14, (p0[1] + p1[1]) / 2 * 1.09)
        lightning(p0 if i < 4 else mid, mid if i < 4 else p1, pick(i), jitter=0.26)


# --- studio et rendu -------------------------------------------------------------------------------------------
def studio(accent):
    scene = bpy.context.scene
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.03, 0.03, 0.045, 1)
    scene.world = world

    def panel(loc, size, color, strength):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
        p = bpy.context.object
        p.scale = (size[0], size[1], 1)
        p.rotation_euler = (math.atan2(loc[1], loc[2]) * -1, math.atan2(loc[0], loc[2]), 0)
        m = bpy.data.materials.new('Light')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs[0].default_value = (*color, 1)
        e.inputs[1].default_value = strength
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(e.outputs[0], out.inputs[0])
        p.data.materials.append(m)
        p.visible_camera = False  # les panneaux éclairent et se reflètent, mais n'apparaissent pas à l'image

    panel((0, 0, 9), (7, 3), (1, 1, 1), 5)            # grande boîte à lumière de face
    panel((-6, 3, 5), (1.5, 9), (0.8, 0.9, 1), 9)     # bande froide à gauche
    panel((6, -2, 5), (1.2, 9), (1, 0.92, 0.82), 7)   # bande chaude à droite
    panel((0, 7, 4), (9, 1.2), (1, 1, 1), 8)          # bande haute
    panel((1, -8, 3), (8, 2), accent, 3)              # contre-jour à la couleur de la rareté
    panel((-3, -2, 7), (1.2, 1.2), (1, 1, 1), 14)     # petit éclat ponctuel

    cam_data = bpy.data.cameras.new('Cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 9.2  # la plus grande dimension de l'image, en unités
    cam = bpy.data.objects.new('Cam', cam_data)
    cam.location = (0, 0, 20)
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 56
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = RES
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 90
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'


ACCENT = {'common': (0.6, 0.6, 0.7), 'ultra': (1, 0.6, 0.15), 'rare': (0.3, 0.6, 1), 'epic': (0.6, 0.3, 1), 'legend': (1, 0.5, 0.8), 'rift': (1, 0.05, 0.12)}

os.makedirs(OUT, exist_ok=True)
for rarity in [] if THEME_ARGS else (ONLY or list(RECIPES)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build(rarity, materials())
    studio(ACCENT[rarity])
    path = os.path.join(OUT, f'{rarity}.png')
    bpy.context.scene.render.filepath = path
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError:
        # pas de débruiteur dans cette version de Blender : on compense par plus d'échantillons
        bpy.context.scene.cycles.use_denoising = False
        bpy.context.scene.cycles.samples = 160
        bpy.ops.render.render(write_still=True)
    print(f'Blender {bpy.app.version_string} — cadre {rarity} : {os.path.getsize(path) / 1024:.0f} Ko')

    # seconde passe : les effets seuls, sans éclairage (ils émettent leur propre lumière)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()  # recrée les matières partagées dont `thorn` a besoin
    build_fx(rarity)
    studio(ACCENT[rarity])
    scene = bpy.context.scene
    for obj in [o for o in scene.objects if o.name.startswith('Plane')]:
        bpy.data.objects.remove(obj)  # pas de panneaux lumineux pour cette passe
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0
    scene.cycles.samples = 12
    scene.cycles.use_denoising = False
    fx_path = os.path.join(OUT, f'{rarity}-fx.png')
    scene.render.filepath = fx_path
    bpy.ops.render.render(write_still=True)
    print(f'Blender {bpy.app.version_string} — effets {rarity} : {os.path.getsize(fx_path) / 1024:.0f} Ko')

# cadres des autres bannières : une image par rareté, dans un sous-dossier (les effets lumineux sont communs)
for theme in THEME_ARGS:
    os.makedirs(os.path.join(OUT, theme), exist_ok=True)
    for rarity in ONLY or list(RECIPES):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_themed(rarity, theme, materials())
        studio(ACCENT[rarity])
        path = os.path.join(OUT, theme, f'{rarity}.png')
        bpy.context.scene.render.filepath = path
        if 'fx-only' not in sys.argv:
            bpy.ops.render.render(write_still=True)
            print(f'Blender {bpy.app.version_string} — cadre {theme}/{rarity}')
        # effets de cette bannière, sans éclairage
        bpy.ops.wm.read_factory_settings(use_empty=True)
        materials()
        build_fx_themed(rarity, theme)
        studio(ACCENT[rarity])
        scene = bpy.context.scene
        for obj in [o for o in scene.objects if o.name.startswith('Plane')]:
            bpy.data.objects.remove(obj)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0
        scene.cycles.samples = 12
        scene.cycles.use_denoising = False
        scene.render.filepath = os.path.join(OUT, theme, f'{rarity}-fx.png')
        bpy.ops.render.render(write_still=True)
        print(f'Blender {bpy.app.version_string} — effets {theme}/{rarity}')
        continue
        print(f'Blender {bpy.app.version_string} — cadre {theme}/{rarity} : {os.path.getsize(path) / 1024:.0f} Ko')

