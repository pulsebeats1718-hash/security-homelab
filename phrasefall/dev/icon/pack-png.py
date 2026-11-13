#!/usr/bin/env python3
"""Turns an icon with rounded, see-through corners into a much smaller 8-bit PNG, keeping the
corners smooth.

    python3 pack-png.py <opaque-8bit.png> <alpha-source.png> <out.png>

<opaque-8bit.png> is the picture already reduced to at most 239 colours (ImageMagick dithers far
better than Pillow does). <alpha-source.png> supplies the transparency. Fully transparent pixels
share one palette entry; the anti-aliased corner pixels get up to 16 entries of their own
(4 corners x 4 opacity levels), each with its own colour and opacity. Needs Pillow.
"""
import sys

from PIL import Image


def pixels(im):
    # Pillow 12 replaced getdata() with get_flattened_data()
    return list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())


src, alpha_src, out = sys.argv[1:4]
pic = Image.open(src)
if pic.mode != 'P':
    sys.exit(f'{src}: expected an 8-bit palette image')
w, h = pic.size
idx = pixels(pic)
used = max(idx) + 1
if used > 239:
    sys.exit(f'{src}: {used} colours, at most 239 leave room for the corners')
rgb = pixels(pic.convert('RGB'))
alpha = pixels(Image.open(alpha_src).convert('RGBA').getchannel('A'))
palette = (pic.getpalette() or [])[: 3 * used]
palette += [0] * (3 * used - len(palette))

LEVELS = 4
groups = {}  # (corner, level) -> [r, g, b, count]
for i, a in enumerate(alpha):
    if 0 < a < 255:
        x, y = i % w, i // w
        key = ((x >= w // 2) + 2 * (y >= h // 2), min(LEVELS - 1, a * LEVELS // 255))
        g = groups.setdefault(key, [0, 0, 0, 0])
        r, gg, b = rgb[i]
        g[0] += r
        g[1] += gg
        g[2] += b
        g[3] += 1

keys = sorted(groups)
entry = {k: used + n for n, k in enumerate(keys)}
clear = used + len(keys)
trans = [255] * used
for k in keys:
    r, g, b, c = groups[k]
    palette += [round(r / c), round(g / c), round(b / c)]
    trans.append(round((k[1] + 0.5) * 255 / LEVELS))
palette += [0, 0, 0]
trans.append(0)

data = []
for i, a in enumerate(alpha):
    if a == 0:
        data.append(clear)
    elif a == 255:
        data.append(idx[i])
    else:
        x, y = i % w, i // w
        data.append(entry[((x >= w // 2) + 2 * (y >= h // 2), min(LEVELS - 1, a * LEVELS // 255))])

img = Image.new('P', (w, h))
img.putpalette(palette)
img.putdata(data)
img.save(out, optimize=True, transparency=bytes(trans))
