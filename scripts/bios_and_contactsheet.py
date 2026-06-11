"""Make bio headshots + a gallery contact sheet for review.

- Bio headshots: square center-crop, 600px, -> uploads/Bios/{anjani,varun}.jpg
    Anjani: uploads/Couple+Friends+Pictures/IMG_6709.heic
    Varun:  uploads/Gallery/g0050.jpg
- Contact sheet: all uploads/Gallery/gNNNN.jpg tiled with index labels
    -> review_contact_sheet.jpg (gitignored scratch, for review only)

Run from repo root:  python scripts/bios_and_contactsheet.py
Requires: pillow, pillow-heif.
"""
import glob
import os

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print('WARNING: pillow-heif not installed; HEIC will fail.')

BIO_DIR = 'uploads/Bios'
GALLERY_DIR = 'uploads/Gallery'


def square_headshot(src, dst, size=600):
    im = ImageOps.exif_transpose(Image.open(src))
    if im.mode != 'RGB':
        im = im.convert('RGB')
    w, h = im.size
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    im = im.crop((left, top, left + s, top + s)).resize((size, size), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=88, optimize=True, progressive=True)
    print('wrote %s (%.0f KB)' % (dst, os.path.getsize(dst) / 1024))


def contact_sheet(out='review_contact_sheet.jpg', cols=8, thumb=220, pad=6, label_h=22):
    files = sorted(glob.glob(os.path.join(GALLERY_DIR, 'g*.jpg')))
    rows = (len(files) + cols - 1) // cols
    cell_w = thumb + pad
    cell_h = thumb + pad + label_h
    sheet = Image.new('RGB', (cols * cell_w + pad, rows * cell_h + pad), '#f5f1ea')
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('arial.ttf', 14)
    except Exception:
        font = ImageFont.load_default()
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x = pad + c * cell_w
        y = pad + r * cell_h
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
        im = ImageOps.fit(im, (thumb, thumb), Image.LANCZOS)
        sheet.paste(im, (x, y))
        name = os.path.splitext(os.path.basename(f))[0]
        draw.text((x + 2, y + thumb + 3), name, fill='#333333', font=font)
    sheet.save(out, 'JPEG', quality=80, optimize=True)
    print('wrote %s (%d images, %.1f MB)' % (out, len(files), os.path.getsize(out) / 1e6))


if __name__ == '__main__':
    os.makedirs(BIO_DIR, exist_ok=True)
    square_headshot('uploads/Couple+Friends+Pictures/IMG_6709.heic',
                    os.path.join(BIO_DIR, 'anjani.jpg'))
    square_headshot(os.path.join(GALLERY_DIR, 'g0050.jpg'),
                    os.path.join(BIO_DIR, 'varun.jpg'))
    contact_sheet()
