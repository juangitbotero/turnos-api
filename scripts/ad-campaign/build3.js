'use strict';
/**
 * Direction 3 — "In Hand". Builds every spec in both formats.
 *
 *   node build3.js          all
 *   node build3.js P        ids beginning with P
 */

const path = require('path');
const L = require('./lib.js');
const D = require('./directions/in-hand.js');
const { SPECS } = require('./directions/in-hand-specs.js');
const { r } = L;

const OUT = path.join(L.REPO, 'docs', 'brand', 'ad-campaign', '03-in-hand');
const SIZES = [{ w: 1080, h: 1080 }, { w: 1080, h: 1920 }];

/** Phone beside the copy, with one magnified detail tied back to its source. */
async function layoutCallout({ W, H, spec, logo, g, tall }) {
  const M = W * 0.082;
  const f = D.frame({ W, H, M, kicker: spec.kicker, logo, cta: 'Get early access', g });
  const img = await D.shot(spec.shot);
  const sw = W * 0.0055;
  const stroke = g.ink;

  const size = W * (tall ? 0.062 : 0.056);
  const subSize = W * (tall ? 0.028 : 0.025);

  let ph, headBox, cardAt, detW;
  if (tall) {
    // Vertical stack: copy on top, device below, detail overlapping its left.
    const head = L.block(D.HEAD, spec.headline, { x: M, y: 0, size, leading: size * 1.15, maxWidth: W * 0.84, fill: g.ink, tracking: -size * 0.012 });
    const headY = f.bandTop + W * 0.085;
    const subY = headY + head.height + size * 1.25;
    const phTop = subY + (spec.sub ? subSize * 2.6 : size * 0.6);
    ph = D.phone({ id: spec.id, x: W * 0.36, y: phTop, h: f.footTop - phTop - W * 0.03, img, stroke, sw });
    headBox = { headY, subY };
    detW = Math.round(W * 0.40);
    cardAt = { x: M * 0.55, y: phTop + (f.footTop - phTop) * 0.46 };
  } else {
    const phTop = f.bandTop + W * 0.02;
    ph = D.phone({ id: spec.id, x: W * 0.605, y: phTop, h: (f.footTop - phTop) * 0.99, img, stroke, sw });
    const head = L.block(D.HEAD, spec.headline, { x: M, y: 0, size, leading: size * 1.15, maxWidth: W * 0.47, fill: g.ink, tracking: -size * 0.012 });
    const headY = f.bandTop + W * 0.075;
    headBox = { headY, subY: headY + head.height + size * 1.15 };
    detW = Math.round(W * 0.44);
    cardAt = { x: M, y: H * 0.545 };
  }

  const det = await D.crop(spec.shot, spec.crop, detW);
  const co = D.callout({ det, at: cardAt, srcRect: spec.crop, screen: ph.screen, accent: L.C.accent, sw: sw * 2.4, ground: g });

  return `
    <rect width="${W}" height="${H}" fill="${g.bg}"/>
    ${ph.svg}
    ${L.block(D.HEAD, spec.headline, { x: M, y: headBox.headY, size, leading: size * 1.15, maxWidth: W * (tall ? 0.84 : 0.47), fill: g.ink, tracking: -size * 0.012 }).svg}
    ${spec.sub ? L.block(D.BOOK, spec.sub, { x: M, y: headBox.subY, size: subSize, leading: subSize * 1.5, maxWidth: W * (tall ? 0.80 : 0.44), fill: g.ink, opacity: 0.68 }).svg : ''}
    ${co}
    ${f.svg}`;
}

/** The detail alone, at scale. No device — the control IS the image. */
async function layoutHero({ W, H, spec, logo, g, tall }) {
  const M = W * 0.082;
  const f = D.frame({ W, H, M, kicker: spec.kicker, logo, cta: 'Get early access', g });
  const det = await D.crop(spec.shot, spec.crop, Math.round(W * 0.84));
  const sw = W * 0.013;
  const size = W * (tall ? 0.068 : 0.062);

  const head = L.block(D.HEAD, spec.headline, { x: M, y: 0, size, leading: size * 1.15, maxWidth: W * 0.86, fill: g.ink, tracking: -size * 0.012 });
  // Centre detail + headline as one group, or the foot pools empty space.
  const groupH = det.h + W * 0.10 + size + head.height;
  const top = f.bandTop + (f.footTop - f.bandTop - groupH) / 2;

  return `
    <rect width="${W}" height="${H}" fill="${g.bg}"/>
    <rect x="${r(M - sw * 0.5)}" y="${r(top - sw * 0.5)}" width="${r(det.w + sw)}" height="${r(det.h + sw)}"
          rx="${r(sw * 1.6)}" fill="#FFFFFF" stroke="${L.C.accent}" stroke-width="${r(sw * 0.34)}"/>
    <defs><clipPath id="hero-${spec.id}"><rect x="${r(M)}" y="${r(top)}" width="${r(det.w)}" height="${r(det.h)}" rx="${r(sw * 1.2)}"/></clipPath></defs>
    <g clip-path="url(#hero-${spec.id})"><image x="${r(M)}" y="${r(top)}" width="${r(det.w)}" height="${r(det.h)}" xlink:href="${det.uri}"/></g>
    ${L.block(D.HEAD, spec.headline, { x: M, y: top + det.h + W * 0.10 + size, size, leading: size * 1.15, maxWidth: W * 0.86, fill: g.ink, tracking: -size * 0.012 }).svg}
    ${f.svg}`;
}

/** Device running off the frame. The footer sits on a plate so nothing collides. */
async function layoutBleed({ W, H, spec, logo, g, tall }) {
  const M = W * 0.082;
  const f = D.frame({ W, H, M, kicker: spec.kicker, logo, cta: 'Get early access', g });
  const img = await D.shot(spec.shot);
  const sw = W * 0.0055;
  const size = W * (tall ? 0.070 : 0.062);
  const subSize = W * (tall ? 0.030 : 0.026);

  const phTop = tall ? H * 0.40 : H * 0.28;
  const ph = D.phone({ id: spec.id, x: tall ? W * 0.30 : W * 0.55, y: phTop, h: H * 0.95, img, stroke: g.ink, sw });

  const head = L.block(D.HEAD, spec.headline, { x: M, y: 0, size, leading: size * 1.15, maxWidth: W * (tall ? 0.84 : 0.45), fill: g.ink, tracking: -size * 0.012 });
  const headY = tall ? f.bandTop + W * 0.09 : H * 0.30;

  // A bleeding device runs straight through the footer; the plate guarantees
  // the wordmark and CTA always have clean ground under them.
  const plate = `<rect x="0" y="${r(f.footTop - W * 0.025)}" width="${W}" height="${r(H - f.footTop + W * 0.025)}" fill="${g.bg}"/>`;

  return `
    <rect width="${W}" height="${H}" fill="${g.bg}"/>
    ${ph.svg}
    ${plate}
    ${L.block(D.HEAD, spec.headline, { x: M, y: headY, size, leading: size * 1.15, maxWidth: W * (tall ? 0.84 : 0.45), fill: g.ink, tracking: -size * 0.012 }).svg}
    ${spec.sub ? L.block(D.BOOK, spec.sub, { x: M, y: headY + head.height + size * 1.3, size: subSize, leading: subSize * 1.5, maxWidth: W * (tall ? 0.72 : 0.42), fill: g.ink, opacity: 0.68 }).svg : ''}
    ${f.svg}`;
}

const LAYOUTS = { callout: layoutCallout, hero: layoutHero, bleed: layoutBleed };

(async () => {
  const filter = process.argv[2];
  const logos = { light: await L.logoDataURI(L.C.paper, 700), dark: await L.logoDataURI(L.C.ink, 700) };
  let n = 0;

  for (const spec of SPECS) {
    if (filter && !spec.id.startsWith(filter)) continue;
    const g = D.GROUNDS[spec.ground];
    const logo = spec.ground === 'ink' ? logos.light : logos.dark;
    for (const s of SIZES) {
      try {
        const svg = await LAYOUTS[spec.layout]({ W: s.w, H: s.h, spec, logo, g, tall: s.h / s.w > 1.4 });
        await L.render(svg, path.join(OUT, `${spec.id}_${s.w}x${s.h}.png`), s.w, s.h);
        n++;
      } catch (e) {
        console.log('FAIL', spec.id, s.w + 'x' + s.h, '::', e.message);
      }
    }
  }
  console.log(`${n} composition(s) written to docs/brand/ad-campaign/03-in-hand`);
})();
