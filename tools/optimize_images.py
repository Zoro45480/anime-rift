"""ANIME RIFT — allège les images du jeu : convertit chaque PNG de src/assets en WebP (transparence conservée).

Lancer après tout rendu Blender :  python3 tools/optimize_images.py
Les scripts Blender écrivent des PNG ; le jeu ne charge que les WebP produits ici, cinq à dix fois plus légers.
"""
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
QUALITY = {'frames': 86, 'art': 88, 'logo': 90, 'icons': 92, 'ui': 90}

before = after = 0
for folder, quality in QUALITY.items():
    path = os.path.join(ROOT, folder)
    if not os.path.isdir(path):
        continue
    for folder_path, _, names in os.walk(path):  # sous-dossiers compris (cadres par bannière)
        for name in sorted(names):
            if not name.endswith('.png'):
                continue
            src = os.path.join(folder_path, name)
            dst = src[:-4] + '.webp'
            Image.open(src).save(dst, 'WEBP', quality=quality, method=6)
            before += os.path.getsize(src)
            after += os.path.getsize(dst)
            os.remove(src)  # le PNG se régénère avec le script Blender correspondant
print(f'{before / 1e6:.1f} Mo de PNG -> {after / 1e6:.1f} Mo de WebP')
