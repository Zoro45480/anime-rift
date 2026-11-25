"""Assemble les 16 images de Kiri (tools/blender/build_extras.py guide) en une planche 4×4, et convertit rubans et micro en WebP."""
import glob
import os

from PIL import Image

D = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'extras')
frames = sorted(glob.glob(os.path.join(D, 'guide-*.png')))
if len(frames) == 16:
    sheet = Image.new('RGBA', (200 * 4, 200 * 4))
    for i, f in enumerate(frames):
        sheet.alpha_composite(Image.open(f).resize((200, 200), Image.LANCZOS), ((i % 4) * 200, (i // 4) * 200))
        os.remove(f)
    sheet.save(os.path.join(D, 'guide.webp'), quality=88, method=6)
for f in glob.glob(os.path.join(D, '*.png')):
    Image.open(f).save(f[:-4] + '.webp', quality=90, method=6)
    os.remove(f)
