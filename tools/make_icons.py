"""Generate Gastos app icons (rising bars + plus on a blue gradient). Run: python tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def gradient(size):
    top, bottom = (58, 150, 240), (24, 84, 176)
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y * 0.65) / size
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img


def icon(size, safe=1.0):
    s = 4  # supersample
    S = size * s
    img = gradient(S)
    d = ImageDraw.Draw(img)
    pad = S * (1 - safe) / 2
    u = (S - 2 * pad) / 100  # 100-unit design grid
    ox, oy = pad, pad
    white = (255, 255, 255)
    # three rising bars
    bars = [(22, 58, 34, 78), (40, 44, 52, 78), (58, 30, 70, 78)]
    for x0, y0, x1, y1 in bars:
        d.rounded_rectangle([ox + x0 * u, oy + y0 * u, ox + x1 * u, oy + y1 * u], radius=3.5 * u, fill=white)
    # plus badge
    cx, cy, r = 74, 30, 13
    d.ellipse([ox + (cx - r) * u, oy + (cy - r) * u, ox + (cx + r) * u, oy + (cy + r) * u], fill=(255, 196, 41))
    w = 2.6
    d.rounded_rectangle([ox + (cx - 6.5) * u, oy + (cy - w) * u, ox + (cx + 6.5) * u, oy + (cy + w) * u], radius=w * u, fill=(24, 84, 176))
    d.rounded_rectangle([ox + (cx - w) * u, oy + (cy - 6.5) * u, ox + (cx + w) * u, oy + (cy + 6.5) * u], radius=w * u, fill=(24, 84, 176))
    # baseline
    d.rounded_rectangle([ox + 16 * u, oy + 82 * u, ox + 84 * u, oy + 85.5 * u], radius=1.75 * u, fill=(255, 255, 255, 200))
    return img.resize((size, size), Image.LANCZOS)


icon(180).save(OUT / "apple-touch-icon.png")
icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
icon(512, safe=0.78).save(OUT / "icon-maskable-512.png")
print("Icons written to", OUT)
