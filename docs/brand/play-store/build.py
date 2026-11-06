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
    # Matched to the 2026-11-04 captures: feed, shift detail, profile,
    # My shifts, earnings.
    '01': {'pt': 'Turnos perto de ti,\ncom o valor à vista', 'en': 'Shifts near you,\npay shown upfront'},
    '02': {'pt': 'Vê o local, o horário\ne o valor antes de te candidatares', 'en': 'See the place, the hours\nand the pay before you apply'},
    '03': {'pt': 'Tu decides quando trabalhas.\nDesliga quando estás ocupado', 'en': 'You decide when you work.\nSwitch it off when busy'},
    '04': {'pt': 'Todos os teus turnos,\nnum só lugar', 'en': 'All your shifts,\nin one place'},
    # "money", never "cash": cash payment was retired 2026-07-29 (listing.md).
    '05': {'pt': 'Transforma o teu tempo em dinheiro.\nAcompanha cada euro', 'en': 'Turn your time into money.\nTrack every euro'},
    '06': {'pt': 'Um scan à entrada\ne estás de turno', 'en': 'One scan at the door\nand you are on shift'},
}

# Which caption languages to render. Since 2026-11-06 the raw captures are the
# English app, used for both store languages — so only the EN set is built.
LANGS = ['en']


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


# App Store product-page header (custom header, 2026). Both sizes Apple accepts.
HEADER_SIZES = [(5244, 2950), (3840, 1646)]
HEADER_TAGLINE = {'pt': 'Turnos perto de ti. Candidata-te num toque.',
                  'en': 'Shifts near you. Apply in one tap.'}


def smooth_gradient(w: int, h: int) -> Image.Image:
    """Same brand gradient as gradient(), vectorised for very large canvases,
    with a soft light bloom behind the centre so the flat colour gets depth."""
    import numpy as np
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    t = xs * 0.6 + ys * 0.4
    a, b = np.array(BLUE, float), np.array(VIOLET, float)
    rgb = a + (b - a) * t[..., None]
    # Elliptical bloom, slightly above centre; ~12% lift at its core.
    d = ((xs - 0.5) / 0.55) ** 2 + ((ys - 0.44) / 0.6) ** 2
    rgb = rgb + (255 - rgb) * (0.12 * np.exp(-d * 2.2))[..., None]
    # Gentle darkening at the bottom edge, where the store draws its own UI.
    rgb = rgb * (1 - 0.10 * ys[..., None] ** 3)
    return Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'), 'RGB')


def build_headers():
    for W, H in HEADER_SIZES:
        for lang, line in HEADER_TAGLINE.items():
            img = smooth_gradient(W, H).convert('RGBA')
            # Logo at most native size (1200 px wide) — never upscaled.
            lg = logo(min(1200, int(W * 0.26)))
            f = ImageFont.truetype('C:/Windows/Fonts/segoeuisl.ttf', int(lg.width * 0.072))
            gap = int(lg.height * 0.55)
            block = lg.height + gap + f.size
            top = int(H * 0.46 - block / 2)
            img.alpha_composite(lg, ((W - lg.width) // 2, top))
            d = ImageDraw.Draw(img)
            text_block(d, line, f, W / 2, top + lg.height + gap, (255, 255, 255, 225))
            name = f'app-store-header-{W}x{H}-{lang}.png'
            img.convert('RGB').save(OUT / name, optimize=True)
            print('wrote', name)


# Screenshot targets: (width, height, filename prefix). Apple wants an iPhone
# 6.3" size (1206x2622 — also accepted for 6.1").
SCREENSHOT_TARGETS = [
    (1080, 1920, 'screenshot'),                    # Google Play
    (1206, 2622, 'apple-screenshot-1206x2622'),    # App Store iPhone 6.3"
]
# The raw captures come from an iPhone (TestFlight). Its status bar (clock,
# Dynamic Island) is cropped off for both stores, so neither store's images
# show the other platform's UI. The clock and icons end ~5% down on a
# 1179x2556 capture; 0.07 clipped the My Shifts title, so 0.058.
STATUS_BAR_CROP = 0.058


def build_screenshots():
    raws = sorted(p for p in RAW.glob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg'))
    for raw in raws:
        num = raw.stem[:2]
        if num not in CAPTIONS:
            print(f'skip {raw.name}: no caption for "{num}"')
            continue
        original = Image.open(raw).convert('RGB')
        cropped = original.crop((0, round(original.height * STATUS_BAR_CROP), original.width, original.height))
        for W, H, prefix in SCREENSHOT_TARGETS:
            s = W / 1080  # everything below was designed at 1080 wide
            r = round(44 * s)
            for lang in LANGS:
                caption = CAPTIONS[num][lang]
                img = gradient(W, H).convert('RGBA')
                d = ImageDraw.Draw(img)
                f = ImageFont.truetype(FONT_BOLD, round(62 * s))
                bottom = text_block(d, caption, f, W / 2, round(110 * s), (255, 255, 255, 255), spacing=round(14 * s))
                top = int(bottom + 70 * s)
                # Play (16:9) shows the top of the screen, cut at the bottom edge.
                # A taller canvas fits the whole screen: grow the phone until it
                # reaches a bottom margin instead of leaving an empty band.
                sw = round(800 * s)
                fit_w = int((H - top - 110 * s) * cropped.width / cropped.height)
                if fit_w > sw:
                    sw = min(fit_w, round(W * 0.86))
                shot = cropped.resize((sw, round(cropped.height * sw / cropped.width)), Image.LANCZOS)
                visible = shot.crop((0, 0, sw, min(shot.height, H - top + round(60 * s))))
                phone = rounded(visible, r)
                pad = round(40 * s)
                shadow = Image.new('RGBA', (phone.width + 2 * pad, phone.height + 2 * pad), (0, 0, 0, 0))
                ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + round(10 * s), pad + phone.width, pad + round(10 * s) + phone.height), r, fill=(30, 20, 90, 110))
                shadow = shadow.filter(ImageFilter.GaussianBlur(round(24 * s)))
                x = (W - phone.width) // 2
                img.alpha_composite(shadow, (x - pad, top - pad))
                img.alpha_composite(phone, (x, top))
                name = f'{prefix}-{num}-{lang}.png'
                img.convert('RGB').save(OUT / name, optimize=True)
                print('wrote', name)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    RAW.mkdir(exist_ok=True)
    build_icon()
    build_feature_graphic()
    build_headers()
    build_screenshots()
    print('done →', OUT)
