"""One-off: derive a transparent navbar logo + a square favicon from the
white-background source logo. Run from repo root:  python scripts/make_logo_assets.py
"""
from PIL import Image

SRC = 'uploads/Logo - source.png'
NAV_OUT = 'uploads/logo-transparent.png'
FAV_OUT = 'uploads/favicon.png'
GOLD = (193, 154, 107)        # --gold  #c19a6b
PURPLE = (107, 78, 122)       # --primary-deep #6b4e7a

img = Image.open(SRC).convert('RGBA')
px = img.load()
w, h = img.size

# --- analyze ink (non-white) pixels: bbox + average color ---
minx, miny, maxx, maxy = w, h, 0, 0
rs = gs = bs = cnt = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        d = 255 - min(r, g, b)        # distance from white
        if d > 30:                     # real ink
            cnt += 1
            rs += r; gs += g; bs += b
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y

if cnt == 0:
    raise SystemExit('No ink detected; aborting.')

ink = (rs // cnt, gs // cnt, bs // cnt)
ink_lum = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2]
print('image=%dx%d ink_pixels=%d ink_avg=%r ink_lum=%.0f' % (w, h, cnt, ink, ink_lum))
print('ink_bbox=(%d,%d)-(%d,%d)  -> %dx%d' % (minx, miny, maxx, maxy, maxx - minx, maxy - miny))

# --- transparent version: white -> alpha 0 with a soft edge band, color preserved ---
LO, HI = 24, 60
trans = Image.new('RGBA', (w, h), (0, 0, 0, 0))
tp = trans.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        d = 255 - min(r, g, b)
        if d <= LO:
            alpha = 0
        elif d >= HI:
            alpha = 255
        else:
            alpha = int((d - LO) / (HI - LO) * 255)
        tp[x, y] = (r, g, b, alpha)

pad = max(4, (maxx - minx) // 20)
box = (max(0, minx - pad), max(0, miny - pad), min(w, maxx + pad + 1), min(h, maxy + pad + 1))
nav = trans.crop(box)
nav.save(NAV_OUT)
print('wrote %s (%dx%d, transparent, trimmed)' % (NAV_OUT, nav.width, nav.height))

# --- favicon: trimmed logo centered on a white rounded tile, zoomed in close ---
tile_color = (255, 255, 255)                      # white background
S = 512
tile = Image.new('RGBA', (S, S), tile_color + (255,))
# rounded corners
from PIL import ImageDraw
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=96, fill=255)
tile.putalpha(mask)

logo = nav.copy()
target = int(S * 0.92)   # zoomed in close, minimal padding
scale = min(target / logo.width, target / logo.height)
logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))), Image.LANCZOS)
ox = (S - logo.width) // 2
oy = (S - logo.height) // 2
tile.alpha_composite(logo, (ox, oy))
tile.save(FAV_OUT)
print('wrote %s (%dx%d, tile=%r)' % (FAV_OUT, S, S, tile_color))
