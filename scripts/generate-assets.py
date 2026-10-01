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
