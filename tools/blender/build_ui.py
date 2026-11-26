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


def rift_path():
    """Emblème du Chemin du Rift : une arche de cristal au bout d'une route d'or, une faille de lumière au cœur."""
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    crystal = pbr((0.55, 0.85, 1.0), 0.2, 0.05, (0.35, 0.75, 1.0), 1.2, coat=1)
    violet = pbr((0.6, 0.35, 1.0), 0.3, 0.08, (0.55, 0.3, 1.0), 1.0, coat=1)
    stone = pbr((0.1, 0.09, 0.2), 0.5, 0.3)
    # la route : des dalles de cristal violet serties d'or, qui rétrécissent en montant vers l'arche
    slab = pbr((0.32, 0.16, 0.62), 0.3, 0.12, (0.3, 0.12, 0.6), 0.35, coat=1)
    for k in range(5):
        t0, t1 = k / 5 + 0.02, (k + 1) / 5 - 0.03
        wl = lambda t: 1.25 - 0.92 * t
        z = lambda t: -1.65 + 1.35 * t
        quad = [(-wl(t0), z(t0)), (wl(t0), z(t0)), (wl(t1), z(t1)), (-wl(t1), z(t1))]
        solid(quad, 0.12, gold, bevel=0.03)
        inner = [(-wl(t0) + 0.07, z(t0) + 0.04), (wl(t0) - 0.07, z(t0) + 0.04), (wl(t1) - 0.07, z(t1) - 0.03), (-wl(t1) + 0.07, z(t1) - 0.03)]
        solid(inner, 0.06, slab, bevel=0.02, back=-0.08)
        solid(circle(0, (z(t0) + z(t1)) / 2, 0.06 * (1 - t0 * 0.6)), 0.03, glow((1.0, 0.86, 0.45), 6.0), bevel=0.0, back=-0.15)
    # l'arche : deux piliers de cristal et une voûte d'or
    arch_out = [(math.cos(a) * 1.15, 0.2 + math.sin(a) * 1.25) for a in [math.pi * i / 32 for i in range(33)]]
    arch_in = [(math.cos(a) * 0.86, 0.2 + math.sin(a) * 0.96) for a in [math.pi * i / 32 for i in range(32, -1, -1)]]
    solid(arch_out + arch_in, 0.3, gold, bevel=0.06)
    for x in (-1.0, 1.0):
        solid([(x - 0.15, -0.5), (x + 0.15, -0.5), (x + 0.18, 0.2), (x, 0.42), (x - 0.18, 0.2)], 0.3, crystal, bevel=0.06)
    # la faille dans l'arche
    crack = [(0.0, 1.12), (0.12, 0.8), (-0.08, 0.55), (0.1, 0.25), (-0.06, -0.05), (0.04, -0.3)]
    for wdt, c, st in ((0.16, (0.35, 0.25, 1.0), 3.0), (0.07, (0.5, 0.85, 1.0), 6.0), (0.025, (1.0, 1.0, 1.0), 12.0)):
        left = [(x - wdt * math.sin(math.pi * i / 5 + 0.3), z) for i, (x, z) in enumerate(crack)]
        right = [(x + wdt * math.sin(math.pi * i / 5 + 0.3), z) for i, (x, z) in reversed(list(enumerate(crack)))]
        flat_shape(left + right, glow(c, st), 0.1 + wdt * 0.4)
    flat_shape(arch_in[::-1] + [(0.86, -0.32), (-0.86, -0.32)], gradient([(0.0, (0.1, 0.05, 0.3)), (1.0, (0.03, 0.02, 0.1))], -0.3, 1.2), 0.25)
    # gemme au sommet et éclats qui flottent
    solid([(0, 1.62), (0.2, 1.42), (0, 1.2), (-0.2, 1.42)], 0.2, violet, bevel=0.05, back=-0.12)
    random.seed(7)
    for _ in range(9):
        x, z = random.uniform(-1.5, 1.5), random.uniform(-0.4, 1.7)
        if abs(x) < 1.25 and z < 1.5:
            continue
        r = random.uniform(0.05, 0.11)
        solid([(x, z + r * 1.6), (x + r, z), (x, z - r * 1.6), (x - r, z)], 0.06, crystal, bevel=0.02, back=-0.2)
    return 3.6, 3.6


def card_pack():
    """Récompense « carte » : trois cartes au dos violet et or, en éventail, une rune de lumière au centre."""
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    back = pbr((0.26, 0.1, 0.5), 0.4, 0.2, coat=1)
    for i, ang in enumerate((0.42, 0.0, -0.42)):
        cx = (i - 1) * 0.5
        rim = rotated(rounded(1.3, 1.85, 0.12, 0, 0, 0), ang, 0, -0.9)
        rim = [(x + cx, z + (0.1 if i == 1 else 0)) for x, z in rim]
        solid(rim, 0.1, gold, bevel=0.03, back=0.3 - i * 0.15 if i != 1 else -0.2)
        face = rotated(rounded(1.12, 1.66, 0.08, 0, 0, 0), ang, 0, -0.9)
        face = [(x + cx, z + (0.1 if i == 1 else 0)) for x, z in face]
        solid(face, 0.1, back, bevel=0.02, back=(0.3 - i * 0.15 if i != 1 else -0.2) - 0.04)
    star = []
    for i in range(16):
        a = math.pi / 2 + i * math.pi / 8
        r = 0.42 if i % 2 == 0 else 0.13
        star.append((math.cos(a) * r, 0.1 + math.sin(a) * r))
    solid(star, 0.04, glow((1.0, 0.88, 0.5), 5.0), bevel=0.0, back=-0.32)
    solid(circle(0, 0.1, 0.12), 0.04, glow((1.0, 1.0, 1.0), 8.0), bevel=0.0, back=-0.36)
    return 3.2, 3.2


def floor_plate(boss=False):
    """Plaque d'étage de La Spire : hexagone d'or, verre sombre au centre, cristaux aux pointes (rouges pour un gardien)."""
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    glass = pbr((0.04, 0.04, 0.1), 0.5, 0.18, coat=1)
    gem = pbr((1.0, 0.25, 0.3), 0.2, 0.05, (1.0, 0.15, 0.2), 1.6, coat=1) if boss else pbr((1.0, 0.8, 0.35), 0.2, 0.05, (1.0, 0.7, 0.25), 1.2, coat=1)
    hexa = lambda r: [(math.cos(math.pi / 6 + k * math.pi / 3) * r, math.sin(math.pi / 6 + k * math.pi / 3) * r) for k in range(6)]
    solid(hexa(1.3), 0.22, gold, bevel=0.07)
    solid(hexa(1.08), 0.26, glass, bevel=0.04)
    flat_shape([(x * 1.0, z * 1.0) for x, z in hexa(1.0)], gradient([(0.0, (0.02, 0.02, 0.06)), (1.0, (0.12, 0.08, 0.25) if not boss else (0.3, 0.05, 0.08))], -1.0, 1.0), -0.3)
    for k in range(6):
        a = math.pi / 6 + k * math.pi / 3
        cx, cz = math.cos(a) * 1.3, math.sin(a) * 1.3
        r = 0.13
        solid([(cx + math.cos(a) * r * 1.8, cz + math.sin(a) * r * 1.8), (cx + math.cos(a + 1.57) * r, cz + math.sin(a + 1.57) * r), (cx - math.cos(a) * r, cz - math.sin(a) * r), (cx + math.cos(a - 1.57) * r, cz + math.sin(a - 1.57) * r)], 0.14, gem, bevel=0.04, back=-0.18)
    if boss:  # deux cornes d'or au-dessus
        for side in (-1, 1):
            horn = [(side * 0.45, 1.02), (side * 0.75, 1.0), (side * 1.05, 1.55), (side * 0.95, 1.75), (side * 0.85, 1.5)]
            solid(horn, 0.16, gold, bevel=0.05, back=-0.05)
    return 3.2, 3.8 if boss else 3.2


LEAGUES = {  # métal, couleur de la gemme, nombre de pointes, ailes
    'bronze': ((0.8, 0.45, 0.25), (1.0, 0.55, 0.3), 0, False), 'silver': ((0.82, 0.86, 0.95), (0.6, 0.85, 1.0), 0, False),
    'gold': ((1.0, 0.78, 0.3), (1.0, 0.85, 0.35), 3, False), 'platinum': ((0.75, 0.95, 0.92), (0.3, 1.0, 0.85), 3, True),
    'diamond': ((0.7, 0.85, 1.0), (0.4, 0.7, 1.0), 5, True), 'legend': ((1.0, 0.7, 0.35), (1.0, 0.3, 0.6), 5, True),
}


def league(kind):
    """Emblème de ligue d'arène : un écu de métal, une gemme au centre, une couronne de pointes et des ailes aux rangs élevés."""
    metal_c, gem_c, spikes, wings = LEAGUES[kind]
    metal = pbr(metal_c, 1, 0.14)
    dark = pbr((0.05, 0.05, 0.1), 0.6, 0.3)
    gem = pbr(gem_c, 0.2, 0.04, gem_c, 1.4 if kind != 'bronze' else 0.6, coat=1)
    shield = [(0, -1.25), (0.9, -0.55), (0.95, 0.75), (0, 1.0), (-0.95, 0.75), (-0.9, -0.55)]
    inner = [(0, -1.02), (0.74, -0.46), (0.78, 0.62), (0, 0.82), (-0.78, 0.62), (-0.74, -0.46)]
    if wings:
        for side in (-1, 1):
            for k in range(3):
                feather = [(side * 0.8, 0.5 - k * 0.32), (side * (1.55 - k * 0.12), 0.9 - k * 0.42), (side * (1.45 - k * 0.15), 0.62 - k * 0.42), (side * 0.85, 0.25 - k * 0.32)]
                solid(feather, 0.1, metal, bevel=0.03, back=0.12)
    solid(shield, 0.24, metal, bevel=0.07)
    solid(inner, 0.28, dark, bevel=0.03)
    solid([(0, 0.55), (0.42, 0.0), (0, -0.62), (-0.42, 0.0)], 0.3, gem, bevel=0.08, back=-0.18)
    for k in range(spikes):
        x = (k - (spikes - 1) / 2) * 0.32
        hgt = 0.42 - abs(k - (spikes - 1) / 2) * 0.08
        solid([(x - 0.12, 0.95), (x + 0.12, 0.95), (x, 0.95 + hgt)], 0.14, metal, bevel=0.03, back=-0.02)
        solid(circle(x, 0.97 + hgt, 0.06), 0.06, gem, bevel=0.02, back=-0.08)
    if kind == 'legend':  # rayons de lumière derrière l'écu
        for k in range(12):
            a = k * math.pi / 6 + math.pi / 12
            solid([(math.cos(a - 0.05) * 0.5, math.sin(a - 0.05) * 0.5), (math.cos(a) * 1.75, math.sin(a) * 1.5), (math.cos(a + 0.05) * 0.5, math.sin(a + 0.05) * 0.5)], 0.01, glow((1.0, 0.55, 0.75), 2.5), bevel=0.0, back=0.4)
    return (3.6 if wings else 2.6), 3.0


def shop():
    """La boutique : une bourse de velours violet nouée d'or, d'où s'échappent des flammes d'âme bleues."""
    velvet = pbr((0.36, 0.13, 0.62), 0.2, 0.35, coat=0.6)
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    body = [(math.cos(a) * 1.05, -0.35 + math.sin(a) * 0.95) for a in [math.pi * (i / 40) * 2 for i in range(40)]]
    solid(body, 0.9, velvet, bevel=0.25)
    neck = [(-0.42, 0.5), (0.42, 0.5), (0.62, 0.95), (0.3, 0.85), (0, 1.0), (-0.3, 0.85), (-0.62, 0.95)]
    solid(neck, 0.5, velvet, bevel=0.12, back=0.1)
    solid(rounded(1.05, 0.18, 0.08, 0, 0, 0.55), 1.1, gold, bevel=0.05, back=0.05)
    solid(circle(0.35, 0.42, 0.12), 0.1, gold, bevel=0.04, back=-0.8)
    solid([(0.3, 0.38), (0.4, 0.38), (0.5, -0.05), (0.36, -0.02)], 0.06, gold, bevel=0.02, back=-0.8)
    # emblème : une pièce d'or sertie d'une gemme d'âme bleue
    solid(circle(0, -0.45, 0.38), 0.1, gold, bevel=0.04, back=-0.82)
    solid([(0, -0.17), (0.2, -0.45), (0, -0.73), (-0.2, -0.45)], 0.1, pbr((0.45, 0.8, 1.0), 0.2, 0.05, (0.4, 0.75, 1.0), 2.0, coat=1), bevel=0.04, back=-0.9)
    for x, z, r in ((-0.95, 1.05, 0.16), (0.9, 1.2, 0.12), (-0.55, 1.45, 0.1), (0.5, 1.55, 0.09)):
        solid([(x, z + r * 1.8), (x + r, z), (x, z - r * 0.6), (x - r, z)], 0.1, pbr((0.45, 0.8, 1.0), 0.2, 0.05, (0.4, 0.75, 1.0), 2.5, coat=1), bevel=0.04, back=-0.2)
    return 3.2, 3.6


def nav_bazaar():
    """Le Bazar : une balance d'or, une gemme bleue sur un plateau, une pile d'âmes sur l'autre."""
    gold = pbr((1.0, 0.78, 0.3), 1, 0.14)
    dark = pbr((0.08, 0.06, 0.14), 0.6, 0.3)
    gem = pbr((0.45, 0.8, 1.0), 0.2, 0.05, (0.4, 0.75, 1.0), 1.8, coat=1)
    ruby = pbr((1.0, 0.3, 0.55), 0.2, 0.05, (1.0, 0.25, 0.5), 1.4, coat=1)
    solid(rounded(1.3, 0.22, 0.08, 0, 0, -1.25), 0.5, gold, bevel=0.06)
    solid(rounded(0.16, 2.0, 0.06, 0, 0, -0.2), 0.16, gold, bevel=0.05)
    solid(circle(0, 0.85, 0.16), 0.2, ruby, bevel=0.06, back=-0.05)
    solid(rotated(rounded(2.6, 0.12, 0.05, 0, 0, 0.62), 0.12, 0, 0.62), 0.14, gold, bevel=0.04)
    for side, z in ((-1, 0.48), (1, 0.78)):
        x = side * 1.2
        for dx in (-0.35, 0.35):
            solid([(x - 0.03, z), (x + 0.03, z), (x + dx + 0.03, z - 0.7), (x + dx - 0.03, z - 0.7)], 0.05, gold, bevel=0.0, back=0.1)
        solid([(x - 0.5, z - 0.7), (x + 0.5, z - 0.7), (x + 0.36, z - 0.88), (x - 0.36, z - 0.88)], 0.4, gold, bevel=0.06)
        solid([(x - 0.42, z - 0.72), (x + 0.42, z - 0.72), (x + 0.3, z - 0.84), (x - 0.3, z - 0.84)], 0.42, dark, bevel=0.02, back=-0.02)
    solid([(-1.2, 0.3), (-0.92, 0.0), (-1.2, -0.2), (-1.48, 0.0)], 0.2, gem, bevel=0.05, back=-0.15)
    for k in range(3):
        solid(circle(1.2 + (k - 1) * 0.2, 0.22 + (0.16 if k == 1 else 0), 0.14), 0.12, ruby, bevel=0.05, back=-0.15)
    return 3.6, 3.2


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
    'rift-path': rift_path,
    'card-pack': card_pack,
    'floor-plate': floor_plate,
    'shop': shop,
    'nav-bazaar': nav_bazaar,
    'league-bronze': lambda k='bronze': league(k),
    'league-silver': lambda k='silver': league(k),
    'league-gold': lambda k='gold': league(k),
    'league-platinum': lambda k='platinum': league(k),
    'league-diamond': lambda k='diamond': league(k),
    'league-legend': lambda k='legend': league(k),
    'floor-boss': lambda: floor_plate(True),
}
SCALE = {'nav-nexus': 60, 'nav-summon': 60, 'nav-cards': 60, 'nav-contracts': 60, 'nav-profile': 60, 'chest': 60, 'rift-path': 90, 'card-pack': 80, 'floor-plate': 70, 'floor-boss': 70, 'shop': 70, 'nav-bazaar': 60, 'league-bronze': 70, 'league-silver': 70, 'league-gold': 70, 'league-platinum': 70, 'league-diamond': 70, 'league-legend': 70}  # pixels par unité, quand ce n'est pas PX

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
