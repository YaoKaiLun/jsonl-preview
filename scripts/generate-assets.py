"""Regenerate the committed PNG icons and Chrome Web Store promo tile (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def mark(draw, size, inset=0):
    scale = size / 128
    x0, y0, x1, y1 = [round(v * scale) for v in (16 + inset, 16 + inset, 112 - inset, 112 - inset)]
    draw.rounded_rectangle((x0, y0, x1, y1), radius=round(22 * scale), fill="#2565dc")
    pen = max(2, round(6 * scale))
    for y, length in [(42, 54), (62, 38), (82, 48)]:
        yy = round(y * scale)
        draw.rounded_rectangle((round(35 * scale), yy, round((35 + length) * scale), yy + pen), radius=pen // 2, fill="white")
        draw.ellipse((round(24 * scale), yy, round(24 * scale) + pen, yy + pen), fill="#a9d2ff")


icon_dir = ROOT / "icons"
icon_dir.mkdir(exist_ok=True)
for size in (16, 48, 128):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark(ImageDraw.Draw(image), size)
    image.save(icon_dir / f"icon{size}.png")

promo_dir = ROOT / "store"
promo_dir.mkdir(exist_ok=True)
promo = Image.new("RGB", (440, 280), "#173b73")
draw = ImageDraw.Draw(promo)
draw.rounded_rectangle((16, 16, 424, 264), radius=28, fill="#214e96")
draw.rounded_rectangle((35, 50, 405, 230), radius=18, fill="#f7faff")
draw.rounded_rectangle((57, 73, 130, 146), radius=17, fill="#2565dc")
for y, length in [(92, 42), (108, 30), (124, 38)]:
    draw.rounded_rectangle((77, y, 77 + length, y + 4), radius=2, fill="white")
draw.text((150, 82), "JSONL", font=font(35), fill="#1f344f")
draw.text((60, 171), "JSONL  PREVIEW", font=font(21), fill="#446d9c")
draw.rounded_rectangle((58, 207, 191, 213), radius=3, fill="#7ca8e8")
draw.rounded_rectangle((202, 207, 372, 213), radius=3, fill="#b9cfec")
promo.save(promo_dir / "promo-440x280.png")

# A larger store mark that echoes the extension toolbar icon and the `{ }` brand.
# Render at 4x before downsampling so the curves and line ends stay sharp.
scale = 4
store_icon = Image.new("RGBA", (128 * scale, 128 * scale), (0, 0, 0, 0))
draw = ImageDraw.Draw(store_icon)
draw.rounded_rectangle((8 * scale, 8 * scale, 120 * scale, 120 * scale), radius=28 * scale, fill="#2565dc")
draw.rounded_rectangle((13 * scale, 13 * scale, 115 * scale, 115 * scale), radius=24 * scale, outline="#78aaff", width=2 * scale)

def brace(points):
    draw.line([(x * scale, y * scale) for x, y in points], fill="white", width=7 * scale, joint="curve")
    radius = 3.5 * scale
    for x, y in (points[0], points[-1]):
        draw.ellipse(((x * scale - radius), (y * scale - radius), (x * scale + radius), (y * scale + radius)), fill="white")

left = [(49, 33), (42, 33), (38, 39), (38, 53), (32, 64), (38, 75), (38, 89), (42, 95), (49, 95)]
brace(left)
brace([(128 - x, y) for x, y in left])
for y, width in ((48, 27), (64, 20), (80, 27)):
    draw.rounded_rectangle((54 * scale, (y - 3) * scale, (54 + width) * scale, (y + 3) * scale), radius=3 * scale, fill="#c4e9ff")
store_icon.resize((128, 128), Image.Resampling.LANCZOS).save(promo_dir / "icon-128.png")
