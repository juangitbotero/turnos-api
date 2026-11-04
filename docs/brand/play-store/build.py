"""Google Play store graphics for Turnos.

    python docs/brand/play-store/build.py

Writes to docs/brand/play-store/out/:
  icon-512.png              app icon (from apps/mobile/assets/icon.png)
  feature-graphic.png       1024x500
  screenshot-NN-<lang>.png  1080x1920 (9:16) framed screenshots with a caption

Screenshots: drop raw phone screenshots (portrait PNG/JPG, any size) into
docs/brand/play-store/raw/ named 01.png, 02.png … and set their captions in
CAPTIONS below. Raw files must come from the current app with real-looking
data — never rows prefixed "Demo ·" (seeder data) or retired claims (see
docs/brand/COPY_BANK.md).

Text uses Segoe UI (Windows). The brand display face is ITC Bauhaus, which is
licensed per seat and not installed here — the logo image carries the brand;
never substitute "Bauhaus 93" (DESIGN_SYSTEM.md).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
RAW, OUT = HERE / 'raw', HERE / 'out'
LOGO = ROOT / 'apps/mobile/assets/logo-white@3x.png'
ICON = ROOT / 'apps/mobile/assets/icon.png'
FONT_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
FONT_REG = 'C:/Windows/Fonts/segoeui.ttf'

BLUE, VIOLET = (0x6a, 0x79, 0xff), (0x9b, 0x6d, 0xff)

# Captions per screenshot number, PT (default listing) and EN. Lines from the
# copy bank, each backed by what the app does.
CAPTIONS = {
    '01': {'pt': 'Turnos perto de ti,\ncom o valor à vista', 'en': 'Shifts near you,\npay shown upfront'},
    '02': {'pt': 'Vê o local, o horário\ne o valor antes de te candidatares', 'en': 'See the place, the hours\nand the pay before you apply'},
    '03': {'pt': 'Recebes o valor bruto,\npago pela empresa', 'en': 'You receive the full gross,\npaid by the company'},
    '04': {'pt': 'Um scan à entrada\ne estás de turno', 'en': 'One scan at the door\nand you are on shift'},
    '05': {'pt': 'Trabalha quando quiseres.\nDesliga quando estás ocupado', 'en': 'Work when you want.\nSwitch it off when busy'},
    '06': {'pt': 'Grátis para trabalhadores.\nSem comissões', 'en': 'Free for workers.\nNo commission'},
}


def gradient(w: int, h: int) -> Image.Image:
    """Brand diagonal gradient, blue → violet (the dashboard's primary button)."""
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.6 + y / h * 0.4)
            px[x, y] = tuple(int(BLUE[i] + (VIOLET[i] - BLUE[i]) * t) for i in range(3))
    return img


def logo(width: int) -> Image.Image:
    im = Image.open(LOGO).convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def rounded(im: Image.Image, r: int) -> Image.Image:
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *im.size), r, fill=255)
    out = im.convert('RGBA')
    out.putalpha(mask)
    return out


def text_block(draw, text, font, cx, top, fill, spacing=12):
    y = top
    for line in text.split('\n'):
        w = draw.textlength(line, font=font)
        draw.text((cx - w / 2, y), line, font=font, fill=fill)
        y += font.size + spacing
    return y


def build_icon():
    Image.open(ICON).convert('RGB').resize((512, 512), Image.LANCZOS).save(OUT / 'icon-512.png', optimize=True)


def build_feature_graphic():
    W, H = 1024, 500
    img = gradient(W, H).convert('RGBA')
    lg = logo(460)
    img.alpha_composite(lg, ((W - lg.width) // 2, 150))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_REG, 38)
    # Generic on purpose — no city: the listing should not need editing as Turnos expands.
    text_block(d, 'Short Shift Marketplace for Physical Businesses', f, W / 2, 150 + lg.height + 40, (255, 255, 255, 235))
    img.convert('RGB').save(OUT / 'feature-graphic.png', optimize=True)


def build_screenshots():
    W, H = 1080, 1920
    raws = sorted(p for p in RAW.glob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg'))
    for raw in raws:
        num = raw.stem[:2]
        if num not in CAPTIONS:
            print(f'skip {raw.name}: no caption for "{num}"')
            continue
        shot = Image.open(raw).convert('RGB')
        sw = 800
        shot = shot.resize((sw, round(shot.height * sw / shot.width)), Image.LANCZOS)
        for lang, caption in CAPTIONS[num].items():
            img = gradient(W, H).convert('RGBA')
            d = ImageDraw.Draw(img)
            f = ImageFont.truetype(FONT_BOLD, 62)
            bottom = text_block(d, caption, f, W / 2, 110, (255, 255, 255, 255), spacing=14)
            top = int(bottom + 70)
            visible = shot.crop((0, 0, sw, min(shot.height, H - top + 60)))
            phone = rounded(visible, 44)
            shadow = Image.new('RGBA', (phone.width + 80, phone.height + 80), (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rounded_rectangle((40, 50, 40 + phone.width, 50 + phone.height), 44, fill=(30, 20, 90, 110))
            shadow = shadow.filter(ImageFilter.GaussianBlur(24))
            x = (W - phone.width) // 2
            img.alpha_composite(shadow, (x - 40, top - 40))
            img.alpha_composite(phone, (x, top))
            img.convert('RGB').save(OUT / f'screenshot-{num}-{lang}.png', optimize=True)
            print('wrote', f'screenshot-{num}-{lang}.png')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)
    build_icon()
    build_feature_graphic()
    build_screenshots()
    print('done →', OUT)
