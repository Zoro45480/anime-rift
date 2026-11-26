"""ANIME RIFT — habillage de l'interface, modélisé et rendu dans Blender (Cycles).

Lancer :  python3 tools/blender/build_ui.py            puis   python3 tools/optimize_images.py
          python3 tools/blender/build_ui.py bg         (un seul élément)

Style : sobre et haut de gamme. Boutons et panneaux en métal et en verre sombre, avec de vrais reflets ;
icônes en volume ; fond de ciel nocturne doux, sans aplats ni contours.

Produit dans src/assets/ui/ :
  bg            fond des menus : ciel de nuit, lune voilée, nuages, îles flottantes, portail
  btn-gold      plaque du bouton principal (or)       btn-pink    plaque d'action (améthyste)
  btn-indigo    plaque neutre (verre bleu nuit)       btn-ghost   plaque discrète (verre noir)
  panel         cadre des panneaux et des fenêtres
  nav-nexus, nav-summon, nav-cards, nav-contracts, nav-profile   icônes de la barre de navigation

Les plaques et le cadre sont faits pour être étirés par leurs bords (border-image) : seuls les coins gardent leurs
détails, le centre est uni.
"""
import math
import os
import random
import sys

import bpy
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'ui')
PX = 100  # pixels par unité Blender
# Repère : les objets sont posés dans le plan XZ, face à la caméra placée du côté des Y négatifs.


def lin(color):
    """Les couleurs de ce fichier sont écrites telles qu'on les voit à l'écran ; Blender calcule en lumière linéaire."""
    return tuple(c ** 2.2 for c in color)


# --- matières ---------------------------------------------------------------------------------------------------
def pbr(color, metallic=1.0, roughness=0.15, emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new('Pbr')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if emission:
        b.inputs['Emission Color'].default_value = (*lin(emission), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def glow(color, strength=1.0):
    m = bpy.data.materials.new('Glow')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*lin(color), 1)
    e.inputs[1].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def gradient(stops, lo, hi):
    """Dégradé doux le long de la hauteur (pour le ciel)."""
    m = bpy.data.materials.new('Gradient')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = lo
    rng.inputs['From Max'].default_value = hi
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*lin(stops[0][1]), 1)
    els[1].position, els[1].color = stops[1][0], (*lin(stops[1][1]), 1)
    for pos, col in stops[2:]:
        el = els.new(pos)
        el.color = (*lin(col), 1)
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(coord.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


# --- formes -----------------------------------------------------------------------------------------------------
def flat_shape(pts, mat, depth=0.0):
    """Forme plate face à la caméra (pour le fond). `depth` plus grand = plus loin."""
    me = bpy.data.meshes.new('Flat')
    me.from_pydata([(x, depth, z) for x, z in pts], [], [tuple(range(len(pts)))])
    obj = bpy.data.objects.new('Flat', me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def solid(pts, thickness, mat, bevel=0.04, back=0.0):
    """Pièce en volume : le contour `pts` extrudé vers la caméra, arêtes adoucies pour accrocher la lumière."""
    n = len(pts)
    verts = [(x, back, z) for x, z in pts] + [(x, back - thickness, z) for x, z in pts]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    me = bpy.data.meshes.new('Solid')
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new('Solid', me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = 'ANGLE'
    for p in me.polygons:
        p.use_smooth = True
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


def rotated(pts, angle, cx=0.0, cz=0.0):
    c, s = math.cos(angle), math.sin(angle)
    return [(cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c) for x, z in pts]


# --- plaques de boutons -------------------------------------------------------------------------------------------
def plate(rim, face):
    """Plaque penchée : un jonc de métal fin autour d'une face bombée, en métal ou en verre sombre."""
    w, h, s = 4.0, 1.0, 0.3
    solid(slanted(w, h, s, 0.045), 0.1, rim, bevel=0.035)
    solid(slanted(w - 0.06, h - 0.06, s), 0.16, face, bevel=0.06)
    return 4.5, 1.4


# --- cadre des panneaux ---------------------------------------------------------------------------------------------
def panel():
    w, h, r, cut = 4.0, 3.0, 0.16, 0.36
    solid(rounded(w, h, r, 0.03, cut=cut + 0.012), 0.08, pbr((0.75, 0.8, 1.0), 1, 0.12), bevel=0.02)   # filet de métal clair
    solid(rounded(w - 0.05, h - 0.05, r, cut=cut), 0.11, pbr((0.022, 0.026, 0.085), 0.2, 0.78), bevel=0.03)  # verre sombre, mat
    return 4.5, 3.5


# --- icônes de navigation ---------------------------------------------------------------------------------------------
def nav_nexus():
    """Le Nexus : un portique laqué devant un portail de lumière."""
    lacquer = pbr((0.62, 0.06, 0.12), 0.55, 0.2, coat=1)
    gold = pbr((1.0, 0.74, 0.25), 1, 0.16)
    flat_shape(circle(0, 0.0, 0.92), glow((0.35, 0.8, 1.0), 1.1), 0.3)
    flat_shape(circle(0, 0.0, 0.5), glow((0.9, 1.0, 1.0), 1.4), 0.25)
    for x in (-0.78, 0.78):
        solid([(x - 0.13, -1.2), (x + 0.13, -1.2), (x + 0.11, 0.62), (x - 0.11, 0.62)], 0.24, lacquer, bevel=0.05)
        solid([(x - 0.2, -1.28), (x + 0.2, -1.28), (x + 0.2, -1.1), (x - 0.2, -1.1)], 0.3, gold, bevel=0.04)
    solid([(-1.4, 0.94), (-1.2, 0.62), (1.2, 0.62), (1.4, 0.94), (1.28, 1.06), (-1.28, 1.06)], 0.3, lacquer, bevel=0.05)
    solid([(-1.46, 1.02), (1.46, 1.02), (1.36, 1.14), (-1.36, 1.14)], 0.34, gold, bevel=0.03)
    solid([(-1.02, 0.22), (1.02, 0.22), (1.02, 0.38), (-1.02, 0.38)], 0.2, lacquer, bevel=0.04)
    return 3.2, 3.2


def nav_summon():
    """L'invocation : un cristal taillé, cerclé de métal."""
    violet = pbr((0.5, 0.3, 1.0), 0.45, 0.08, (0.4, 0.25, 1.0), 0.5, coat=1)
    cyan = pbr((0.45, 0.9, 1.0), 0.45, 0.08, (0.3, 0.8, 1.0), 0.5, coat=1)
    chrome = pbr((0.95, 0.96, 1.0), 1, 0.06)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.22, minor_radius=0.05, location=(0, 0, 0), rotation=(math.radians(68), math.radians(18), 0))
    bpy.context.object.data.materials.append(chrome)
    for p in bpy.context.object.data.polygons:
        p.use_smooth = True
    # deux moitiés de cristal, séparées par une fente de lumière
    top = [(0, 1.18), (0.62, 0.16), (-0.62, 0.02)]
    bottom = [(0.62, 0.02), (0, -1.18), (-0.62, -0.12)]
    solid([(x + 0.04, z + 0.03) for x, z in top], 0.5, cyan, bevel=0.1)
    solid([(x - 0.04, z - 0.03) for x, z in bottom], 0.5, violet, bevel=0.1)
    flat_shape([(-0.9, -0.1), (0.9, 0.12), (0.9, 0.17), (-0.9, -0.05)], glow((1, 1, 1), 2.0), -0.6)
    return 3.2, 3.2


def nav_cards():
    """La collection : deux cartes de métal en éventail, une étoile d'or."""
    for angle, cx, color in ((0.24, -0.34, (0.5, 0.2, 0.75)), (-0.16, 0.3, (0.12, 0.3, 0.75))):
        back = 0.0 if cx < 0 else -0.14
        solid(rotated(rounded(1.3, 1.9, 0.14, 0.03, cx, 0), angle, cx, -0.6), 0.08, pbr((0.9, 0.92, 1.0), 1, 0.1), bevel=0.02, back=back)
        solid(rotated(rounded(1.24, 1.84, 0.12, 0, cx, 0), angle, cx, -0.6), 0.12, pbr(color, 0.7, 0.2, coat=1), bevel=0.03, back=back)
    star = []
    for i in range(8):
        a = 0.2 + i * math.pi / 4
        r = 0.44 if i % 2 == 0 else 0.11
        star.append((0.36 + math.cos(a) * r, 0.1 + math.sin(a) * r))
    solid(star, 0.1, pbr((1.0, 0.8, 0.3), 1, 0.12, (1.0, 0.75, 0.25), 0.4), bevel=0.02, back=-0.26)
    return 3.2, 3.2


def nav_contracts():
    """Les contrats : un parchemin tenu par deux baguettes d'or, scellé d'un cachet de cire rouge."""
    paper = pbr((0.96, 0.89, 0.7), 0.0, 0.55)
    gold = pbr((1.0, 0.76, 0.28), 1, 0.14)
    ink = pbr((0.32, 0.22, 0.16), 0.0, 0.7)
    wax = pbr((0.78, 0.07, 0.13), 0.2, 0.22, (0.6, 0.02, 0.06), 0.25, coat=1)
    solid(rounded(1.46, 1.96, 0.06, 0, 0, 0), 0.06, paper, bevel=0.02)
    for z in (1.02, -1.02):
        solid(rounded(1.86, 0.2, 0.1, 0, 0, z), 0.2, gold, bevel=0.06, back=-0.04)
    for i, z in enumerate((0.58, 0.32, 0.06, -0.2)):
        solid(rounded(1.0 - 0.22 * (i % 2), 0.07, 0.03, 0, -0.1 - 0.11 * (i % 2), z), 0.02, ink, bevel=0.005, back=-0.06)
    solid(circle(0.42, -0.56, 0.34), 0.14, wax, bevel=0.05, back=-0.08)
    star = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.19 if i % 2 == 0 else 0.08
        star.append((0.42 + math.cos(a) * r, -0.56 + math.sin(a) * r))
    solid(star, 0.04, pbr((1.0, 0.82, 0.35), 1, 0.14), bevel=0.01, back=-0.22)
    return 3.2, 3.2


def nav_profile():
    """Le profil : un médaillon d'or, une silhouette de cristal violet."""
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    dark = pbr((0.05, 0.05, 0.14), 0.6, 0.3)
    violet = pbr((0.62, 0.38, 1.0), 0.4, 0.1, (0.5, 0.3, 1.0), 0.5, coat=1)
    solid(circle(0, 0, 1.25), 0.16, gold, bevel=0.06)
    solid(circle(0, 0, 1.06), 0.2, dark, bevel=0.04)
    solid(circle(0, 0.34, 0.4), 0.18, violet, bevel=0.1, back=-0.2)
    body = [(math.cos(a) * 0.72, -0.74 + math.sin(a) * 0.5) for a in [math.pi * i / 24 for i in range(25)]]
    solid(body, 0.18, violet, bevel=0.1, back=-0.2)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        solid(circle(math.cos(a) * 1.16, math.sin(a) * 1.16, 0.09), 0.1, pbr((0.5, 0.95, 1.0), 0.3, 0.1, (0.4, 0.9, 1.0), 1.5), bevel=0.03, back=-0.18)
    return 3.2, 3.2


def chest():
    """Le coffre du 7e jour : bois laqué violet, cerclages et serrure d'or, lueur qui s'échappe du couvercle."""
    wood = pbr((0.32, 0.14, 0.55), 0.3, 0.3, coat=1)
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    solid(rounded(2.2, 1.2, 0.1, 0, 0, -0.45), 0.9, wood, bevel=0.06)
    solid([(math.cos(a) * 1.1, 0.15 + math.sin(a) * 0.62) for a in [math.pi * i / 24 for i in range(25)]], 0.9, wood, bevel=0.06)
    flat_shape(rounded(2.0, 0.08, 0.02, 0, 0, 0.16), glow((1.0, 0.85, 0.4), 6.0), -1.0)
    for x in (-0.72, 0.72):
        solid(rounded(0.2, 1.24, 0.04, 0, x, -0.45), 0.08, gold, bevel=0.03, back=-0.9)
        solid([(x - 0.1 + 0.2 * (i / 24 > 0.5), 0) for i in range(1)] and [(x - 0.1, 0.15), (x + 0.1, 0.15), (x + 0.1, 0.7), (x - 0.1, 0.7)], 0.08, gold, bevel=0.03, back=-0.9)
    solid(rounded(2.3, 0.14, 0.05, 0, 0, 0.12), 0.1, gold, bevel=0.03, back=-0.88)
    solid(rounded(0.42, 0.52, 0.08, 0, 0, -0.18), 0.14, gold, bevel=0.04, back=-0.92)
    solid(circle(0, -0.12, 0.08), 0.05, pbr((0.08, 0.04, 0.12), 0.5, 0.3), bevel=0.01, back=-1.06)
    for k in range(5):
        a = math.radians(30 + k * 30)
        solid([(math.cos(a) * 0.3, 0.25 + math.sin(a) * 0.3), (math.cos(a) * 1.4, 0.25 + math.sin(a) * 1.0), (math.cos(a + 0.06) * 1.4, 0.25 + math.sin(a + 0.06) * 1.0)], 0.01, glow((1.0, 0.85, 0.45), 2.5), bevel=0.0, back=0.3)
    return 3.4, 3.0


# --- fond des menus -----------------------------------------------------------------------------------------------------
def background():
    """Ciel nocturne en dégradés doux. L'image est ensuite légèrement floutée : elle doit rester en retrait."""
    random.seed(4)
    w, h = 9.0, 16.0
    sky = gradient([(0.0, (0.3, 0.13, 0.33)), (0.14, (0.2, 0.1, 0.32)), (0.34, (0.11, 0.075, 0.25)), (0.6, (0.055, 0.05, 0.17)), (1.0, (0.025, 0.03, 0.1))], -h / 2, h / 2)
    flat_shape([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], sky, 5.0)

    for _ in range(140):
        x, z = random.uniform(-w / 2, w / 2), random.uniform(-2.5, h / 2)
        flat_shape(circle(x, z, random.uniform(0.012, 0.04), 8), glow((0.85, 0.9, 1.0), random.uniform(0.4, 1.0)), 4.8)

    # la lune : un disque pâle dans plusieurs halos de plus en plus sombres
    mx, mz = 2.0, 4.3
    for i, (r, c) in enumerate(((3.6, (0.075, 0.065, 0.2)), (3.0, (0.095, 0.08, 0.24)), (2.5, (0.12, 0.1, 0.29)), (2.05, (0.16, 0.13, 0.35)), (1.72, (0.22, 0.18, 0.43)))):
        flat_shape(circle(mx, mz, r, 72), glow(c), 4.7 - i * 0.02)
    flat_shape(circle(mx, mz, 1.45, 72), gradient([(0.0, (0.72, 0.66, 0.84)), (1.0, (0.96, 0.94, 1.0))], mz - 1.45, mz + 1.45), 4.5)

    # la faille : un trait de lumière fin qui descend jusqu'au portail
    crack, x = [], -1.3
    for i in range(13):
        x += random.uniform(-0.4, 0.4)
        crack.append((x, 7.6 - i * 0.62))
    width = [0.02 + 0.06 * math.sin(math.pi * i / 12) for i in range(13)]
    for scale, color in ((4.5, (0.12, 0.2, 0.45)), (2.2, (0.25, 0.5, 0.85)), (1.0, (0.85, 0.95, 1.0))):
        left = [(cx - wd * scale, cz) for (cx, cz), wd in zip(crack, width)]
        right = [(cx + wd * scale, cz) for (cx, cz), wd in reversed(list(zip(crack, width)))]
        flat_shape(left + right, glow(color), 4.3 - scale * 0.01)

    def cloud(cx, cz, scale, color, depth):
        mat = gradient([(0.0, tuple(c * 0.55 for c in color)), (1.0, color)], cz - scale, cz + scale * 1.2)
        for i in range(7):
            r = scale * (0.55 + 0.45 * math.sin(math.pi * (i + 0.5) / 7)) * random.uniform(0.8, 1.15)
            flat_shape(circle(cx + (i - 3) * scale * 0.72, cz + r * 0.45, r, 32), mat, depth)
        flat_shape([(cx - scale * 3.2, cz - scale * 3), (cx + scale * 3.2, cz - scale * 3), (cx + scale * 3.2, cz + scale * 0.5), (cx - scale * 3.2, cz + scale * 0.5)], mat, depth)

    def island(cx, cz, size, depth, gate=False):
        rock = gradient([(0.0, (0.02, 0.02, 0.07)), (1.0, (0.07, 0.06, 0.17))], cz - size, cz + size * 0.2)
        top = [(cx - size, cz), (cx - size * 0.7, cz + size * 0.16), (cx + size * 0.75, cz + size * 0.14), (cx + size, cz)]
        under = [(cx + size * 0.62, cz - size * 0.42), (cx + size * 0.2, cz - size * 0.7), (cx - size * 0.05, cz - size * 1.15), (cx - size * 0.36, cz - size * 0.6), (cx - size * 0.72, cz - size * 0.34)]
        flat_shape(top + under, rock, depth)
        for k in range(3):
            bx = cx + size * random.uniform(-0.75, 0.75)
            ht = size * random.uniform(0.2, 0.42)
            flat_shape([(bx - ht * 0.18, cz + size * 0.1), (bx + ht * 0.18, cz + size * 0.1), (bx + ht * 0.05, cz + size * 0.1 + ht)], glow((0.3, 0.6, 0.85) if k % 2 else (0.45, 0.35, 0.8), 0.8), depth - 0.03)
        if gate:
            gz = cz + size * 0.13
            dark = glow((0.02, 0.018, 0.06))
            for r, c in ((0.78, (0.1, 0.16, 0.4)), (0.6, (0.16, 0.3, 0.62)), (0.46, (0.3, 0.6, 0.9)), (0.24, (0.85, 0.95, 1.0))):
                flat_shape(circle(cx, gz + size * 0.6, size * r, 48), glow(c), depth - 0.04 - (1 - r) * 0.01)
            for sx in (-1, 1):
                flat_shape([(cx + sx * size * 0.62, gz), (cx + sx * size * 0.5, gz), (cx + sx * size * 0.5, gz + size * 1.1), (cx + sx * size * 0.62, gz + size * 1.1)], dark, depth - 0.06)
            flat_shape([(cx - size * 0.92, gz + size * 1.26), (cx - size * 0.8, gz + size * 1.08), (cx + size * 0.8, gz + size * 1.08), (cx + size * 0.92, gz + size * 1.26), (cx + size * 0.84, gz + size * 1.33), (cx - size * 0.84, gz + size * 1.33)], dark, depth - 0.06)
            flat_shape([(cx - size * 0.68, gz + size * 0.86), (cx + size * 0.68, gz + size * 0.86), (cx + size * 0.68, gz + size * 0.94), (cx - size * 0.68, gz + size * 0.94)], dark, depth - 0.06)

    cloud(-2.6, 1.3, 0.7, (0.13, 0.09, 0.27), 4.0)
    cloud(3.0, -0.2, 0.9, (0.15, 0.1, 0.29), 3.9)
    island(3.1, 0.9, 0.9, 3.6)
    island(-3.2, -1.4, 0.75, 3.5)
    cloud(-1.0, -2.8, 1.1, (0.2, 0.11, 0.31), 3.4)
    island(-0.6, -2.5, 2.0, 3.0, gate=True)
    cloud(2.8, -4.6, 1.25, (0.24, 0.12, 0.32), 2.6)
    cloud(-2.9, -5.6, 1.5, (0.18, 0.09, 0.27), 2.4)
    cloud(1.4, -7.0, 1.9, (0.11, 0.06, 0.2), 2.2)
    cloud(-2.0, -8.2, 2.2, (0.06, 0.04, 0.13), 2.0)
    return w, h


def studio():
    """Éclairage des pièces en volume : des panneaux lumineux, visibles seulement dans les reflets."""
    scene = bpy.context.scene
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.02, 0.035, 1)

    def light(loc, size, color, strength):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
        p = bpy.context.object
        p.scale = (size[0], size[1], 1)
        direction = (-loc[0], -loc[1], -loc[2])
        p.rotation_euler = (math.atan2(math.hypot(direction[0], direction[1]), direction[2]), 0, math.atan2(direction[1], direction[0]) + math.pi / 2)
        p.data.materials.append(glow(color, strength))
        p.visible_camera = False

    light((0, -9, 2.5), (8, 2.6), (1, 1, 1), 5)            # grande boîte à lumière, un peu au-dessus
    light((-6, -5, 1), (1.4, 8), (0.8, 0.9, 1.0), 8)       # bande froide à gauche
    light((6, -5, -1), (1.2, 8), (1.0, 0.92, 0.84), 6)     # bande chaude à droite
    light((0, -4, 6), (9, 1.2), (1, 1, 1), 8)              # liseré du haut
    light((0, -5, -6), (8, 1.5), (0.55, 0.4, 1.0), 3)      # contre-jour violet par en dessous


ELEMENTS = {
    'bg': background,
    'btn-gold': lambda: plate(pbr((1.0, 0.86, 0.5), 1, 0.1), pbr((1.0, 0.7, 0.2), 1, 0.2)),
    'btn-pink': lambda: plate(pbr((0.92, 0.85, 1.0), 1, 0.08), pbr((0.42, 0.18, 0.7), 0.75, 0.2, coat=1)),
    'btn-indigo': lambda: plate(pbr((0.8, 0.86, 1.0), 1, 0.08), pbr((0.07, 0.1, 0.32), 0.6, 0.24, coat=1)),
    'btn-ghost': lambda: plate(pbr((0.4, 0.44, 0.6), 1, 0.16), pbr((0.03, 0.035, 0.09), 0.4, 0.36, coat=0.5)),
    'panel': panel,
    'nav-nexus': nav_nexus,
    'nav-summon': nav_summon,
    'nav-cards': nav_cards,
    'nav-contracts': nav_contracts,
    'nav-profile': nav_profile,
    'chest': chest,
}
SCALE = {'nav-nexus': 60, 'nav-summon': 60, 'nav-cards': 60, 'nav-contracts': 60, 'nav-profile': 60, 'chest': 60}  # pixels par unité, quand ce n'est pas PX

os.makedirs(OUT, exist_ok=True)
for name in [a for a in sys.argv[1:] if a in ELEMENTS] or list(ELEMENTS):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('World')
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
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.render.film_transparent = name != 'bg'
    if name == 'bg':
        scene.cycles.samples = 16
        scene.cycles.use_denoising = False
    else:
        studio()
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = round(width * px), round(height * px)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    path = os.path.join(OUT, f'{name}.png')
    scene.render.filepath = path
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError:
        scene.cycles.use_denoising = False
        scene.cycles.samples = 160
        bpy.ops.render.render(write_still=True)
    if name == 'bg':  # léger flou : le fond reste doux et ne dispute pas l'attention aux menus
        Image.open(path).filter(ImageFilter.GaussianBlur(5)).save(path)
    print(f'Blender {bpy.app.version_string} — {name} : {scene.render.resolution_x}×{scene.render.resolution_y}, {os.path.getsize(path) / 1024:.0f} Ko')
