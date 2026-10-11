"""Generate the app icons: a white spade on the accent green."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
for size in (192, 512):
    img = Image.new("RGB", (size, size), "#1d6a49")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("C:/Windows/Fonts/seguisym.ttf", int(size * 0.62))
    draw.text((size / 2, size / 2), "\u2660", font=font, fill="#ffffff", anchor="mm")
    img.save(OUT / f"icon-{size}.png")
print("icons written")
