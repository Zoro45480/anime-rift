"""Fabrique les cadres de cartes en petite taille (src/assets/frames-sm), pour les grilles de cartes.
Les grands cadres (936×1196) ne servent plus que pour la carte ouverte en grand : afficher les 84 à la fois
demandait environ 360 Mo de mémoire d'image, ce qui faisait planter la Collection sur téléphone.
Lancer après tools/blender/build_frames.py :  python3 tools/make_small_frames.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
for path in glob.glob(os.path.join(ROOT, 'frames', '**', '*.webp'), recursive=True):
    out = path.replace(os.sep + 'frames' + os.sep, os.sep + 'frames-sm' + os.sep)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = Image.open(path)
    im.resize((im.width * 2 // 5, im.height * 2 // 5), Image.LANCZOS).save(out, quality=82, method=6)
