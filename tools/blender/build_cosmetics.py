"""ANIME RIFT — tous les objets d'apparence du profil, en 3D (Cycles).  →  src/assets/cosmetics/
  frame-<id>   : cadres de la photo (niveau, animés, styles). Même cadrage pour tous : la photo se loge au centre.
  orn-<id>     : ornements, posés par-dessus le cadre (même cadrage).
  aura-<id>    : auras d'effet, animées ensuite par le jeu (même cadrage).
  medal-<forme>-<métal> : médailles des badges.   plate-<rareté> : plaques des titres.
Lancer :  python3 tools/blender/build_cosmetics.py [frame|orn|aura|medal|plate | nom précis …]
"""
import math
import os
import random
import sys

import bpy

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'cosmetics')
lin = lambda c: tuple(x ** 2.2 for x in c)
FRONT = (math.pi / 2, 0, 0)
RAINBOW = [(1.0, 0.25, 0.35), (1.0, 0.6, 0.15), (1.0, 0.95, 0.3), (0.3, 1.0, 0.6), (0.25, 0.75, 1.0), (0.75, 0.4, 1.0)]
GOLD = (1.0, 0.8, 0.4)


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


metal_of = lambda c, e=0.12: mat('Metal', c, metallic=1.0, rough=0.18, emit=c, strength=e)
glow_of = lambda c, s=2.6: mat('Glow', c, metallic=0.3, rough=0.08, emit=c, strength=s)


def add(m, smooth=True):
    o = bpy.context.object
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def torus(m, R, r, y=0.0, z=0.0, rot=FRONT, x=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=(x, y, z), rotation=rot, major_segments=128, minor_segments=24)
    return add(m)


def blade(m, a, r0, length, width, y=0.0, thick=0.25, cx=0.0, cz=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=width, radius2=0, depth=length, location=(cx + (r0 + length / 2) * math.cos(a), y, cz + (r0 + length / 2) * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, thick, 1))
    return add(m, smooth=False)


def gem(m, a, r, size, y=-0.12):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(r * math.cos(a), y, r * math.sin(a)), scale=(1, 0.7, 1))
    return add(m, smooth=False)


def sphere(m, loc, r, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, scale=scale, rotation=rot, segments=40, ring_count=20)
    return add(m)


def cyl(m, loc, r, d, rot=FRONT, verts=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=loc, rotation=rot)
    return add(m)


def box(m, loc, scale, rot=(0, 0, 0), bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=scale, rotation=rot)
    o = add(m, smooth=False)
    if bevel:
        bv = o.modifiers.new('b', 'BEVEL')
        bv.width, bv.segments = bevel, 3
    return o


def star(m, cx, cz, R, y=0.0, thick=0.35):
    for k in range(5):
        a = k * math.tau / 5 + math.pi / 2
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=R * 0.42, radius2=0, depth=R, location=(cx + R * 0.52 * math.cos(a), y, cz + R * 0.52 * math.sin(a)), rotation=(0, -a + math.pi / 2, 0), scale=(1, thick, 1))
        add(m, smooth=False)
    cyl(m, (cx, y, cz), R * 0.42, R * 0.3 * thick * 2, verts=5)


# ───── Cadres ─────
F = lambda **k: k
FRAMES = {
    't0': F(metal=(0.62, 0.68, 0.82), glow=(0.35, 0.6, 1.0), gems=4),
    't1': F(metal=GOLD, glow=(1.0, 0.75, 0.25), spikes=8, length=0.22, gems=4),
    't2': F(metal=(0.95, 0.35, 0.22), glow=(1.0, 0.25, 0.2), spikes=12, length=0.32, gems=6),
    't3': F(metal=(0.45, 0.75, 1.0), glow=(0.3, 0.95, 1.0), spikes=12, length=0.34, gems=6, outer=True),
    't4': F(metal=(1.0, 0.82, 0.45), glow=(1.0, 0.35, 0.8), spikes=16, length=0.4, gems=8, outer=True, wings=True),
    'r': F(metal=(0.95, 0.95, 1.0), glow=(1, 1, 1), spikes=16, length=0.42, gems=8, outer=True, wings=True, crown=True, rainbow=True),
    'naruto': F(metal=(1.0, 0.5, 0.1), glow=(0.25, 0.55, 1.0), spikes=4, length=0.62, width=0.24, gems=4, outer=True),
    'onepiece': F(metal=(0.95, 0.8, 0.4), glow=(0.95, 0.1, 0.1), gems=10, outer=True, band=(0.85, 0.08, 0.08)),
    'dragonball': F(metal=(1.0, 0.5, 0.08), glow=(1.0, 0.65, 0.1), orbs=7, orb=(1.0, 0.55, 0.05), gems=0),
    'bleach': F(metal=(0.06, 0.06, 0.08), glow=(1.0, 0.12, 0.15), spikes=8, length=0.5, width=0.07, gems=4, outer=True),
    'demonslayer': F(metal=(0.1, 0.55, 0.4), glow=(1.0, 0.2, 0.2), spikes=12, length=0.2, gems=6, outer=True, band=(0.03, 0.04, 0.04)),
    'jujutsu': F(metal=(0.1, 0.12, 0.35), glow=(0.7, 0.3, 1.0), spikes=6, length=0.36, gems=6, outer=True, band=(0.8, 0.08, 0.15)),
    'hunter': F(metal=(0.8, 0.83, 0.9), glow=(0.9, 0.1, 0.12), gems=2, outer=True, band=(0.05, 0.05, 0.07), crown=True),
    'ice': F(metal=(0.75, 0.9, 1.0), glow=(0.5, 0.9, 1.0), spikes=16, length=0.36, width=0.09, gems=8),
    'lava': F(metal=(0.22, 0.08, 0.05), glow=(1.0, 0.4, 0.05), spikes=10, length=0.34, gems=10, orbs=5, orb=(1.0, 0.35, 0.05)),
    'emerald': F(metal=(0.2, 0.8, 0.5), glow=(0.4, 1.0, 0.6), gems=8, outer=True, spikes=4, length=0.3),
    'shadow': F(metal=(0.1, 0.08, 0.16), glow=(0.65, 0.2, 1.0), spikes=14, length=0.46, width=0.09, gems=6, wings=True),
    'sakura': F(metal=(1.0, 0.72, 0.82), glow=(1.0, 0.45, 0.7), petals=12, gems=6),
    'thunder': F(metal=(0.95, 0.85, 0.3), glow=(1.0, 1.0, 0.4), spikes=8, length=0.55, width=0.1, gems=8, outer=True),
    'galaxy': F(metal=(0.3, 0.25, 0.65), glow=(0.6, 0.5, 1.0), orbs=8, orb=(0.8, 0.6, 1.0), gems=8, outer=True, rainbow=True),
    'royal': F(metal=GOLD, glow=(0.65, 0.2, 0.95), gems=8, crown=True, outer=True, spikes=8, length=0.2),
    'toxic': F(metal=(0.3, 0.42, 0.1), glow=(0.6, 1.0, 0.1), spikes=10, length=0.38, gems=10),
    'ocean': F(metal=(0.1, 0.4, 0.85), glow=(0.2, 0.9, 1.0), orbs=6, orb=(0.3, 0.9, 1.0), gems=6, outer=True),
    'blood': F(metal=(0.4, 0.02, 0.05), glow=(1.0, 0.05, 0.1), spikes=16, length=0.42, width=0.08, gems=8, wings=True),
    'celestial': F(metal=(1.0, 1.0, 0.95), glow=(1.0, 0.8, 0.3), spikes=8, length=0.3, gems=8, outer=True, wings=True, crown=True),
}


def wings(metal, glows, cx=0.0):
    for sx in (-1, 1):
        for j in range(4):
            a = math.radians(200 - j * 17) if sx < 0 else math.radians(-20 + j * 17)
            blade(metal, a, 1.12, 0.62 - j * 0.1, 0.17 - j * 0.02, y=0.06)
            blade(glows[(j + 2) % len(glows)], a, 1.16, 0.34 - j * 0.05, 0.06, y=-0.04)


def crown(metal, glows):
    for j, da in enumerate((-0.22, 0, 0.22)):
        blade(metal, math.pi / 2 + da, 1.1, 0.5 if j == 1 else 0.36, 0.14)
        gem(glows[(j * 2) % len(glows)], math.pi / 2 + da, 1.66 if j == 1 else 1.5, 0.07)


def frame(key):
    f = FRAMES[key]
    metal = metal_of(f['metal'])
    glows = [glow_of(c, 2.8) for c in RAINBOW] if f.get('rainbow') else [glow_of(f['glow'])]
    torus(metal, 1.0, 0.11)
    torus(metal_of(f['band']) if f.get('band') else metal, 0.86, 0.04, y=-0.06)
    torus(glows[0], 0.93, 0.022, y=-0.1)
    if f.get('outer'):
        torus(metal, 1.2, 0.035, y=0.04)
    n = f.get('spikes', 0)
    for k in range(n):
        a = k * math.tau / n + math.pi / 2
        big = k % 2 == 0 or n <= 4
        w = f.get('width', 0.13)
        blade(metal if big else glows[k % len(glows)], a, 1.06, f['length'] * (1.0 if big else 0.6), w if big else w * 0.6)
    g = f.get('gems', 4)
    for k in range(g):
        gem(glows[k % len(glows)], k * math.tau / g + (0 if g % 4 else math.pi / 4), 1.0, 0.1)
    for k in range(f.get('orbs', 0)):
        a = k * math.tau / f['orbs'] + math.pi / 2
        sphere(glow_of(f['orb'], 1.4) if not f.get('rainbow') else glows[k % len(glows)], (1.3 * math.cos(a), -0.02, 1.3 * math.sin(a)), 0.13)
    for k in range(f.get('petals', 0)):
        a = k * math.tau / f['petals'] + 0.2
        sphere(glow_of(f['glow'], 0.7), (1.22 * math.cos(a), 0.0, 1.22 * math.sin(a)), 0.2, scale=(0.55, 0.3, 1.0), rot=(0, -a + math.pi / 2, 0))
    if f.get('wings'):
        wings(metal, glows)
    if f.get('crown'):
        crown(metal, glows)


# ───── Ornements (par-dessus le cadre) ─────
def ornament(key):
    gold = metal_of(GOLD, 0.25)
    white = metal_of((0.95, 0.97, 1.0), 0.3)
    if key == 'crown':
        for j, da in enumerate((-0.42, -0.21, 0, 0.21, 0.42)):
            blade(gold, math.pi / 2 + da, 1.05, 0.62 if j == 2 else 0.5 if j in (1, 3) else 0.36, 0.15)
            gem(glow_of(RAINBOW[j], 2.5), math.pi / 2 + da, 1.72 if j == 2 else 1.6 if j in (1, 3) else 1.45, 0.08)
    elif key == 'halo':
        bpy.ops.mesh.primitive_torus_add(major_radius=0.72, minor_radius=0.07, location=(0, 0, 1.5), rotation=(0.32, 0, 0), major_segments=96)
        add(glow_of((1.0, 0.9, 0.5), 4.0))
    elif key == 'wings':
        for sx in (-1, 1):
            for j in range(6):
                a = math.radians(215 - j * 14) if sx < 0 else math.radians(-35 + j * 14)
                blade(white, a, 1.12, 0.74 - j * 0.07, 0.19 - j * 0.015, y=0.08)
    elif key == 'demonwings':
        dark = metal_of((0.12, 0.05, 0.16))
        red = glow_of((1.0, 0.1, 0.25), 2.0)
        for sx in (-1, 1):
            for j in range(4):
                a = math.radians(210 - j * 22) if sx < 0 else math.radians(-30 + j * 22)
                blade(dark, a, 1.1, 0.74 - j * 0.06, 0.22, y=0.08, thick=0.15)
                blade(red, a, 1.14, 0.36, 0.04, y=-0.02)
    elif key == 'horns':
        m = metal_of((0.75, 0.12, 0.15), 0.3)
        tip = glow_of((1.0, 0.3, 0.2), 2.0)
        for sx in (-1, 1):
            a = math.radians(90 + sx * 36)
            blade(m, a, 0.98, 0.5, 0.24, thick=0.85)
            blade(m, a - sx * 0.22, 1.36, 0.36, 0.17, thick=0.85)
            blade(tip, a - sx * 0.42, 1.62, 0.26, 0.1, thick=0.85)
    elif key == 'catears':
        m = metal_of((0.95, 0.6, 0.75), 0.2)
        pink = glow_of((1.0, 0.5, 0.7), 1.5)
        for sx in (-1, 1):
            a = math.radians(90 + sx * 38)
            blade(m, a, 0.98, 0.62, 0.3, thick=0.3)
            blade(pink, a, 1.02, 0.38, 0.15, y=-0.08, thick=0.2)
    elif key == 'flames':
        random.seed(3)
        for k in range(22):
            a = math.radians(200 + k * 6.7)
            c = (1.0, random.uniform(0.25, 0.8), 0.05)
            blade(glow_of(c, 3.0), a + random.uniform(-0.1, 0.1), 1.1, random.uniform(0.2, 0.55), 0.1, thick=0.5)
    elif key == 'sakura':
        random.seed(5)
        for k in range(18):
            a, r = random.uniform(0, math.tau), random.uniform(1.15, 1.75)
            sphere(glow_of((1.0, random.uniform(0.5, 0.75), 0.8), 1.0), (r * math.cos(a), random.uniform(-0.2, 0.1), r * math.sin(a)), random.uniform(0.07, 0.13), scale=(1, 0.25, 0.6), rot=(0, random.uniform(0, 3), 0))
    elif key == 'lightning':
        y = glow_of((1.0, 1.0, 0.45), 5.0)
        for a0 in (math.radians(40), math.radians(140), math.radians(220), math.radians(320)):
            r = 1.1
            for seg in range(3):
                a = a0 + (0.11 if seg % 2 else -0.11)
                box(y, ((r + 0.13) * math.cos(a), -0.05, (r + 0.13) * math.sin(a)), (0.1, 0.06, 0.34), rot=(0, -a0 + math.pi / 2 + (0.6 if seg % 2 else -0.6), 0), bevel=0)
                r += 0.2
    elif key == 'stars':
        for k in range(7):
            a = k * math.tau / 7 + 0.3
            star(glow_of(RAINBOW[k % 6], 2.2), 1.45 * math.cos(a), 1.45 * math.sin(a), 0.15 + (k % 2) * 0.05)
    elif key == 'laurel':
        leaf = metal_of((0.95, 0.8, 0.35), 0.2)
        for sx in (-1, 1):
            for j in range(9):
                a = math.radians(270 + sx * (22 + j * 15))
                sphere(leaf, (1.25 * math.cos(a), 0.0, 1.25 * math.sin(a)), 0.2, scale=(0.42, 0.25, 1.0), rot=(0, -a + math.pi / 2 + sx * 0.9, 0))
    elif key == 'kunai':
        steel = metal_of((0.65, 0.68, 0.78))
        wrap = glow_of((0.95, 0.45, 0.1), 0.5)
        for sx in (-1, 1):
            a = math.radians(90 + sx * 45)
            blade(steel, a, 1.12, 0.62, 0.17, y=0.1, thick=0.3)
            blade(steel, a + math.pi, -1.9, 0.01, 0.01)
            cyl(wrap, (1.02 * math.cos(a), 0.12, 1.02 * math.sin(a)), 0.06, 0.26, rot=(0, -a + math.pi / 2, 0), verts=16)
    elif key == 'dragonballs':
        orb = mat('Orb', (1.0, 0.55, 0.05), metallic=0.2, rough=0.04, emit=(1.0, 0.5, 0.05), strength=1.0)
        for k in range(7):
            a = math.radians(205 + k * 21.7)
            sphere(orb, (1.42 * math.cos(a), 0, 1.42 * math.sin(a)), 0.17)
    elif key == 'chains':
        steel = metal_of((0.55, 0.58, 0.68))
        for k in range(26):
            a = k * math.tau / 26
            bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.03, location=(1.32 * math.cos(a), 0, 1.32 * math.sin(a)), rotation=(math.pi / 2 if k % 2 else 0.2, -a, 0))
            add(steel)
    else:  # orbit : anneaux d'atome
        for tilt, c in ((1.15, (0.3, 0.9, 1.0)), (1.95, (0.75, 0.4, 1.0))):
            bpy.ops.mesh.primitive_torus_add(major_radius=1.5, minor_radius=0.03, location=(0, 0, 0), rotation=(tilt, 0.5, 0), major_segments=128)
            add(glow_of(c, 3.0))
        for a in (0.6, 2.4, 4.3):
            sphere(glow_of((1, 1, 1), 5.0), (1.5 * math.cos(a), -0.3, 0.62 * math.sin(a)), 0.09)


ORNAMENTS = ['crown', 'halo', 'wings', 'demonwings', 'horns', 'catears', 'flames', 'sakura', 'lightning', 'stars', 'laurel', 'kunai', 'dragonballs', 'chains', 'orbit']


# ───── Auras d'effet (tournent autour du cadre dans le jeu) ─────
def aura(key):
    random.seed(key)
    if key == 'fire':
        for k in range(40):
            a = k * math.tau / 40
            blade(glow_of((1.0, random.uniform(0.25, 0.8), 0.05), 3.2), a + 0.5, 1.2, random.uniform(0.18, 0.5), 0.09, thick=0.5)
    elif key == 'frost':
        for k in range(28):
            a = k * math.tau / 28
            blade(glow_of((random.uniform(0.5, 0.8), 0.95, 1.0), 2.4), a, 1.22, random.uniform(0.15, 0.45), 0.07, thick=0.6)
    elif key == 'spark':
        for k in range(16):
            a, r = k * math.tau / 16, random.uniform(1.3, 1.7)
            star(glow_of((1.0, 0.95, 0.6), 4.0), r * math.cos(a), r * math.sin(a), random.uniform(0.07, 0.14))
    elif key == 'shadow':
        for k in range(46):
            a, r = random.uniform(0, math.tau), random.uniform(1.2, 1.7)
            sphere(glow_of((random.uniform(0.35, 0.6), 0.1, random.uniform(0.7, 1.0)), 1.6), (r * math.cos(a), random.uniform(-0.1, 0.2), r * math.sin(a)), random.uniform(0.06, 0.16))
    elif key == 'rainbow':
        for k in range(36):
            a = k * math.tau / 36
            sphere(glow_of(RAINBOW[k % 6], 3.4), (1.42 * math.cos(a), 0, 1.42 * math.sin(a)), 0.085)
        torus(glow_of((1, 1, 1), 2.0), 1.6, 0.012)
    else:  # volt
        for k in range(10):
            a0, r = k * math.tau / 10, 1.22
            for seg in range(3):
                a = a0 + (0.07 if seg % 2 else -0.07)
                box(glow_of((0.6, 0.85, 1.0), 5.0), ((r + 0.08) * math.cos(a), 0, (r + 0.08) * math.sin(a)), (0.035, 0.035, 0.19), rot=(0, -a0 + math.pi / 2 + (0.55 if seg % 2 else -0.55), 0), bevel=0)
                r += 0.14


AURAS = ['fire', 'frost', 'spark', 'shadow', 'rainbow', 'volt']

# ───── Médailles des badges ─────
METALS = {'bronze': (0.8, 0.45, 0.25), 'silver': (0.8, 0.84, 0.93), 'gold': GOLD, 'prism': (0.86, 0.78, 1.0)}
SHAPES = ['shield', 'portal', 'swords', 'gem', 'tower', 'scroll', 'orb', 'hourglass']


def medal(shape, tier):
    m = metal_of(METALS[tier], 0.18)
    dark = mat('Dark', (0.05, 0.06, 0.12), metallic=0.6, rough=0.3)
    accent = glow_of({'shield': (0.3, 0.9, 0.6), 'portal': (0.4, 0.65, 1.0), 'swords': (1.0, 0.3, 0.35), 'gem': (0.75, 0.4, 1.0),
                      'tower': (1.0, 0.7, 0.2), 'scroll': (0.3, 0.95, 0.65), 'orb': (0.3, 0.85, 1.0), 'hourglass': (1.0, 0.85, 0.5)}[shape], 2.2)
    if shape == 'shield':
        cyl(m, (0, 0, 0.1), 1.0, 0.22, verts=6)
        cyl(dark, (0, -0.1, 0.1), 0.8, 0.1, verts=6)
        torus(accent, 0.62, 0.035, y=-0.18, z=0.1)
        blade(m, -math.pi / 2, 0.75, 0.45, 0.5, thick=0.2)
    elif shape == 'portal':
        torus(m, 0.9, 0.15)
        cyl(dark, (0, 0.05, 0), 0.8, 0.08)
        for k in range(8):
            blade(m, k * math.tau / 8, 0.98, 0.26, 0.12)
        torus(accent, 0.55, 0.035, y=-0.08)
    elif shape == 'swords':
        cyl(m, (0, 0.05, 0), 0.95, 0.2)
        cyl(dark, (0, -0.06, 0), 0.8, 0.08)
        for sx in (-1, 1):
            box(accent, (0, -0.14, 0), (0.1, 0.04, 1.35), rot=(0, sx * 0.75, 0), bevel=0.01)
            box(m, (sx * 0.34, -0.15, -0.37), (0.36, 0.05, 0.08), rot=(0, sx * 0.75, 0), bevel=0.01)
    elif shape == 'tower':  # La Spire : une tour de disques empilés sur un médaillon
        cyl(m, (0, 0.08, 0), 0.95, 0.18)
        cyl(dark, (0, -0.02, 0), 0.8, 0.08)
        for k in range(5):
            r = 0.42 - k * 0.07
            cyl(m if k % 2 == 0 else accent, (0, -0.18, -0.62 + k * 0.27), r, 0.24, rot=(0, 0, 0), r2=r - 0.05)
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.12, radius2=0, depth=0.35, location=(0, -0.18, 0.8)); add(accent)
    elif shape == 'scroll':  # Contrats : parchemin roulé et cachet
        cyl(m, (0, 0.08, 0), 0.95, 0.18)
        cyl(dark, (0, -0.02, 0), 0.8, 0.08)
        box(mat('Paper', (0.95, 0.88, 0.7), metallic=0.0, rough=0.5), (0, -0.14, 0), (0.95, 0.05, 0.7), bevel=0.02)
        for z in (0.38, -0.38):
            cyl(m, (0, -0.18, z), 0.09, 1.2, rot=(0, math.pi / 2, 0))
        cyl(accent, (0.25, -0.22, -0.12), 0.17, 0.08)
    elif shape == 'orb':  # Univers : un monde et son anneau
        cyl(m, (0, 0.08, 0), 0.95, 0.18)
        cyl(dark, (0, -0.02, 0), 0.8, 0.08)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(0, -0.3, 0), segments=48, ring_count=24); add(accent)
        torus(m, 0.68, 0.05, y=-0.3, rot=(math.pi / 2 - 0.35, 0.5, 0))
    elif shape == 'hourglass':  # Ancienneté : un sablier
        cyl(m, (0, 0.08, 0), 0.95, 0.18)
        cyl(dark, (0, -0.02, 0), 0.8, 0.08)
        for z in (0.62, -0.62):
            cyl(m, (0, -0.2, z), 0.45, 0.1, rot=(0, 0, 0))
        cyl(accent, (0, -0.2, 0.3), 0.36, 0.55, rot=(0, 0, 0), r2=0.03)
        cyl(accent, (0, -0.2, -0.3), 0.03, 0.55, rot=(0, 0, 0), r2=0.36)
        for x in (-0.4, 0.4):
            cyl(m, (x, -0.2, 0), 0.035, 1.2, rot=(0, 0, 0))
    else:
        torus(m, 0.9, 0.11)
        for k in range(4):
            blade(m, k * math.pi / 2 + math.pi / 4, 0.95, 0.3, 0.14)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.5, radius2=0, depth=0.85, location=(0, -0.05, 0.3)); add(accent, smooth=False)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.5, radius2=0, depth=0.6, location=(0, -0.05, -0.42), rotation=(math.pi, 0, 0)); add(accent, smooth=False)
    if tier == 'prism':  # Légendaire : couronne d'étoiles et halo irisé
        torus(glow_of((1.0, 0.45, 0.95), 2.5), 1.12, 0.03, y=0.05)
        torus(glow_of((0.4, 0.95, 1.0), 2.5), 1.2, 0.02, y=0.06)
    if tier in ('gold', 'prism'):
        for k in range(3):
            star(glow_of((1, 1, 0.8), 3.0), -0.4 + k * 0.4, 1.12 - abs(k - 1) * 0.12, 0.13, y=-0.1)


# ───── Plaques des titres ─────
RARITY = {'common': ((0.6, 0.65, 0.78), (0.6, 0.75, 1.0)), 'rare': ((0.25, 0.5, 1.0), (0.4, 0.8, 1.0)), 'epic': ((0.6, 0.3, 1.0), (0.85, 0.5, 1.0)),
          'legend': (GOLD, (1.0, 0.75, 0.2)), 'mythic': ((1.0, 0.25, 0.4), (1, 1, 1))}


def plate(key):
    base, g = RARITY[key]
    m = metal_of(base, 0.22)
    dark = mat('Dark', tuple(c * 0.16 for c in base), metallic=0.7, rough=0.3)
    glows = [glow_of(c, 2.6) for c in RAINBOW] if key == 'mythic' else [glow_of(g, 2.6)]
    box(m, (0, 0.05, 0), (5.3, 0.18, 0.98), bevel=0.16)
    box(dark, (0, -0.06, 0), (4.95, 0.08, 0.7), bevel=0.1)
    for sx in (-1, 1):
        blade(m, 0 if sx > 0 else math.pi, 2.62, 0.38, 0.3, thick=0.3)
        gem(glows[0 if sx < 0 else -1], 0 if sx > 0 else math.pi, 2.52, 0.13, y=-0.14)
    n = {'common': 0, 'rare': 2, 'epic': 4, 'legend': 6, 'mythic': 8}[key]
    for k in range(n):
        x = -2.0 + 4.0 * k / max(1, n - 1)
        for z in (0.52, -0.52):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.07, location=(x, -0.1, z)); add(glows[k % len(glows)], smooth=False)
    if key in ('legend', 'mythic'):
        for sx in (-1, 1):
            for j in range(3):
                blade(m, math.radians(90 - sx * (62 + j * 12)), 0.0, 0.01, 0.01)
                blade(m, (0 if sx > 0 else math.pi) + sx * (0.5 + j * 0.28), 2.5, 0.42 - j * 0.08, 0.1)


def render(name, ortho, res, cam=(0, -8, 0)):
    tgt = bpy.data.objects.new('T', None)
    bpy.context.collection.objects.link(tgt)
    for loc, energy, color, size in (((-3, -5, 4), 650, (1, 0.97, 0.94), 4), ((4, -2, 1), 420, lin((0.45, 0.85, 1.0)), 3), ((-3, 2, -2), 360, lin((0.85, 0.4, 1.0)), 3), ((0, -4, -3), 120, (0.7, 0.8, 1), 3)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy, l.data.color, l.data.size = energy, color, size
        l.constraints.new('TRACK_TO').target = tgt
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.14, 0.24, 1)
    sc = bpy.context.scene
    sc.world = world
    bpy.ops.object.camera_add(location=cam)
    c = bpy.context.object
    c.data.type = 'ORTHO'
    c.data.ortho_scale = ortho
    c.constraints.new('TRACK_TO').target = tgt
    sc.camera = c
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)


JOBS = ([(f'frame-{k}', lambda k=k: frame(k), 3.9, (320, 320)) for k in FRAMES] + [(f'orn-{k}', lambda k=k: ornament(k), 3.9, (320, 320)) for k in ORNAMENTS]
        + [(f'aura-{k}', lambda k=k: aura(k), 3.9, (320, 320)) for k in AURAS]
        + [(f'medal-{s}-{t}', lambda s=s, t=t: medal(s, t), 2.9, (160, 160)) for s in SHAPES for t in METALS]
        + [(f'plate-{k}', lambda k=k: plate(k), 6.3, (504, 136)) for k in RARITY])
want = sys.argv[1:]
for name, build, ortho, res in JOBS:
    if want and not any(name == w or name.startswith(w + '-') for w in want):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    render(name, ortho, res)
