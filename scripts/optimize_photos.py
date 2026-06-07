"""Web-optimize wedding photos.

- Gallery: every image in uploads/Couple+Friends+Pictures/ (incl. iPhone .HEIC)
  -> uploads/Gallery/gNNNN.jpg (auto-oriented, max 1600px long edge,
  progressive JPEG q82, metadata stripped).
- Attire: optimize the inspo images in uploads/Inspo/ in place.

Raw originals stay out of git (gitignored); only the optimized Gallery output
+ attire images are committed.

Run from repo root:  python scripts/optimize_photos.py
Requires: pillow, pillow-heif (for .HEIC).
"""
import glob
import os
from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()   # lets PIL open iPhone .HEIC files
except ImportError:
    print('WARNING: pillow-heif not installed; .HEIC files will be skipped.')

MAX_EDGE = 1600
QUALITY = 82

SRC_DIR = 'uploads/Couple+Friends+Pictures'
GALLERY_DIR = 'uploads/Gallery'
INSPO_DIR = 'uploads/Inspo'
EXTS = ('jpg', 'jpeg', 'png', 'heic', 'heif')


def collect(folder):
    seen = {}
    for name in os.listdir(folder):
        ext = os.path.splitext(name)[1].lower().lstrip('.')
        if ext in EXTS:
            seen[name.lower()] = os.path.join(folder, name)
    return [seen[k] for k in sorted(seen)]


def optimize(im):
    im = ImageOps.exif_transpose(im)          # honor phone rotation
    if im.mode != 'RGB':
        im = im.convert('RGB')
    w, h = im.size
    scale = MAX_EDGE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    return im


def save_jpeg(im, path):
    im.save(path, 'JPEG', quality=QUALITY, optimize=True, progressive=True)


def build_gallery():
    os.makedirs(GALLERY_DIR, exist_ok=True)
    for old in glob.glob(os.path.join(GALLERY_DIR, 'g*.jpg')):
        os.remove(old)
    n = 0
    total = 0
    for f in collect(SRC_DIR):
        try:
            im = optimize(Image.open(f))
        except Exception as e:
            print('SKIP %s (%s)' % (os.path.basename(f), e))
            continue
        n += 1
        out = os.path.join(GALLERY_DIR, 'g%04d.jpg' % n)
        save_jpeg(im, out)
        total += os.path.getsize(out)
    print('gallery: wrote %d images, %.1f MB (avg %.0f KB)' %
          (n, total / 1e6, (total / n / 1024) if n else 0))
    return n


def optimize_attire():
    n = 0
    total = 0
    for f in collect(INSPO_DIR):
        try:
            im = optimize(Image.open(f))
        except Exception as e:
            print('SKIP %s (%s)' % (os.path.basename(f), e))
            continue
        out = os.path.splitext(f)[0] + '.jpg'
        save_jpeg(im, out)
        if out != f and os.path.exists(f):
            os.remove(f)
        n += 1
        total += os.path.getsize(out)
    print('attire: optimized %d images, %.1f MB (avg %.0f KB)' %
          (n, total / 1e6, (total / n / 1024) if n else 0))


if __name__ == '__main__':
    count = build_gallery()
    optimize_attire()
    print('DONE. gallery image count = %d' % count)
