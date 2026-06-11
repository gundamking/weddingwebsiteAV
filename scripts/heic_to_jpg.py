"""Convert every .HEIC/.HEIF in the couple+friends folder to high-res JPEG.

- Full resolution (no resizing), EXIF orientation honored, quality 92.
- Originals are left untouched; JPEGs land in a sibling folder with the same
  base filename (IMG_6709.heic -> IMG_6709.jpg).

Run from repo root:  python scripts/heic_to_jpg.py
Requires: pillow, pillow-heif.
"""
import os

from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    raise SystemExit('pillow-heif not installed; run: pip install pillow-heif')

SRC_DIR = 'uploads/Couple+Friends+Pictures'
OUT_DIR = 'uploads/Couple+Friends+Pictures-JPG'
QUALITY = 92
HEIC_EXTS = ('.heic', '.heif')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    n, total = 0, 0
    for name in sorted(os.listdir(SRC_DIR)):
        if os.path.splitext(name)[1].lower() not in HEIC_EXTS:
            continue
        src = os.path.join(SRC_DIR, name)
        out = os.path.join(OUT_DIR, os.path.splitext(name)[0] + '.jpg')
        try:
            im = ImageOps.exif_transpose(Image.open(src))
            if im.mode != 'RGB':
                im = im.convert('RGB')
            im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        except Exception as e:
            print('SKIP %s (%s)' % (name, e))
            continue
        n += 1
        sz = os.path.getsize(out)
        total += sz
        print('%-28s -> %s  (%d x %d, %.1f MB)' %
              (name, os.path.basename(out), im.size[0], im.size[1], sz / 1e6))
    print('\nDONE: converted %d HEIC -> JPEG, %.1f MB total, in %s/' %
          (n, total / 1e6, OUT_DIR))


if __name__ == '__main__':
    main()
