"""Generate Avocado Money app icons (avocado half on Hass green). Run: python tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

HASS = (63, 91, 31)
SKIN = (27, 35, 18)
RIND = (110, 127, 46)
LIME = (168, 200, 90)
FLESH = (212, 222, 110)
PITH = (233, 239, 192)
SEED = (154, 74, 44)
WALNUT = (90, 58, 36)
CREAM = (245, 242, 227)


def avocado_mask(S, cx, cy, w, h):
    """Pear shape: a big bottom circle blended into a smaller top circle."""
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    rb = w / 2
    by = cy + h / 2 - rb
    d.ellipse([cx - rb, by - rb, cx + rb, by + rb], fill=255)
    rt = w * 0.30
    ty = cy - h / 2 + rt
    d.ellipse([cx - rt, ty - rt, cx + rt, ty + rt], fill=255)
    # bridge between the circles
    steps = 40
    for i in range(steps + 1):
        t = i / steps
        y = ty + (by - ty) * t
        r = rt + (rb - rt) * (t ** 1.6)
        d.ellipse([cx - r, y - r, cx + r, y + r], fill=255)
    return m


def icon(size, safe=1.0):
    s = 4
    S = size * s
    img = Image.new("RGB", (S, S), HASS)
    # soft vignette
    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).ellipse([S * 0.1, S * 0.05, S * 0.9, S * 0.85], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    img.paste(Image.new("RGB", (S, S), (84, 116, 42)), (0, 0), glow)

    k = safe
    cx, cy = S / 2, S / 2 + S * 0.02 * k
    w, h = S * 0.56 * k, S * 0.76 * k
    skin = avocado_mask(S, cx, cy, w, h)
    img.paste(Image.new("RGB", (S, S), SKIN), (0, 0), skin)
    rind = avocado_mask(S, cx, cy + S * 0.004, w * 0.93, h * 0.94)
    img.paste(Image.new("RGB", (S, S), RIND), (0, 0), rind)
    flesh_outer = avocado_mask(S, cx, cy + S * 0.008, w * 0.86, h * 0.88)
    img.paste(Image.new("RGB", (S, S), LIME), (0, 0), flesh_outer)
    flesh = avocado_mask(S, cx, cy + S * 0.012, w * 0.74, h * 0.78)
    img.paste(Image.new("RGB", (S, S), FLESH), (0, 0), flesh)
    inner = avocado_mask(S, cx, cy + S * 0.02, w * 0.6, h * 0.64)
    img.paste(Image.new("RGB", (S, S), PITH), (0, 0), inner.filter(ImageFilter.GaussianBlur(S * 0.02)))
    # seed
    d = ImageDraw.Draw(img)
    r = w * 0.22
    sy = cy + h * 0.14
    d.ellipse([cx - r, sy - r, cx + r, sy + r], fill=SEED)
    hr = r * 0.32
    d.ellipse([cx - r * 0.45 - hr, sy - r * 0.45 - hr, cx - r * 0.45 + hr, sy - r * 0.45 + hr], fill=(190, 110, 72))
    return img.resize((size, size), Image.LANCZOS)


icon(180).save(OUT / "apple-touch-icon.png")
icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
icon(512, safe=0.78).save(OUT / "icon-maskable-512.png")
print("Icons written to", OUT)
