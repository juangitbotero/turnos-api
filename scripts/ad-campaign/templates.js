'use strict';
/**
 * Canva-editable templates.
 *
 *   node templates.js
 *
 * Emits two .pptx files. Canva converts PowerPoint into a fully editable
 * design — live text boxes, movable shapes — which is why this is PPTX and not
 * PDF or SVG:
 *
 *   PDF  the main generator outlines every glyph (that is what fixed the
 *        opentype NaN bug), so text would arrive as un-editable vector shapes
 *   SVG  Canva takes SVG as an *element*, not as an editable layout
 *
 * Geometry is ported from the real compositions using the same fractions, so a
 * template and its rendered counterpart line up rather than merely resembling
 * one another.
 */

const path = require('path');
const fs = require('fs');
const L = require('./lib.js');
const Pptx = require('pptxgenjs');

const OUT = path.join(L.REPO, 'docs', 'brand', 'ad-campaign', 'templates');

// 1080px canvas at 96 DPI = 11.25in. Everything below is authored in the same
// 1080-wide pixel space as the generator, then converted once.
const PXW = 1080;
const IN = (px) => px / 96;
const PT = (px) => px * 0.75;          // px → points, for type sizes

const FORMATS = [
  { key: 'square', w: 1080, h: 1080, label: 'FEED 1:1' },
  { key: 'story', w: 1080, h: 1920, label: 'STORY 9:16' },
];

const GROUNDS = {
  ink:   { bg: '14141F', fg: 'FAFDFF' },
  paper: { bg: 'FAFDFF', fg: '14141F' },
  tint:  { bg: 'EEF0FF', fg: '14141F' },
};
const ACCENT = '6A79FF';

/** Blend fg over bg at `a` opacity — PPTX has no per-run text alpha. */
function blend(bgHex, fgHex, a) {
  const p = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [br, bg_, bb] = p(bgHex);
  const [fr, fg_, fb] = p(fgHex);
  const c = (b, f) => Math.round(b + (f - b) * a).toString(16).padStart(2, '0');
  return (c(br, fr) + c(bg_, fg_) + c(bb, fb)).toUpperCase();
}

/**
 * Footer: hairline, wordmark, CTA pill. Identical geometry to the generator's
 * frame() so a template swapped for a render does not shift.
 */
function footer(slide, { W, H, M, g, logo }) {
  const footY = H - M - 46;
  const ruleY = footY - 46;

  slide.addShape('line', {
    x: IN(M), y: IN(ruleY), w: IN(W - M * 2), h: 0,
    line: { color: blend(g.bg, g.fg, 0.14), width: 1 },
  });

  const lw = W * 0.175;
  const lh = (logo.height / logo.width) * lw;
  slide.addImage({ data: logo.uri, x: IN(M), y: IN(footY - lh / 2 + 4), w: IN(lw), h: IN(lh) });

  const ctaSize = W * 0.0175;
  const padX = W * 0.026;
  const padY = W * 0.016;
  const bh = ctaSize + padY * 2;
  const bw = W * 0.235;
  slide.addShape('roundRect', {
    x: IN(W - M - bw), y: IN(footY - bh / 2), w: IN(bw), h: IN(bh),
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 }, rectRadius: IN(bh / 2),
  });
  slide.addText('Get early access', {
    x: IN(W - M - bw), y: IN(footY - bh / 2), w: IN(bw), h: IN(bh),
    fontFace: 'Outfit', bold: true, fontSize: PT(ctaSize), color: 'FFFFFF',
    align: 'center', valign: 'middle', margin: 0,
  });
}

/** Dashed placeholder box with an instruction inside it. */
function placeholder(slide, { x, y, w, h, g, text }) {
  slide.addShape('rect', {
    x: IN(x), y: IN(y), w: IN(w), h: IN(h),
    fill: { color: g.bg }, line: { color: blend(g.bg, ACCENT, 0.55), width: 1.25, dashType: 'dash' },
  });
  slide.addText(text, {
    x: IN(x), y: IN(y), w: IN(w), h: IN(h),
    fontFace: 'Geist Mono', fontSize: PT(W_SAFE * 0.016), color: blend(g.bg, g.fg, 0.45),
    align: 'center', valign: 'middle', margin: 0, charSpacing: 1,
  });
}
let W_SAFE = PXW;   // set per-slide so placeholder() can size its caption

/** The shared skeleton every direction inherits. */
function skeleton(slide, { W, H, M, g, logo, kicker, headline, sub, tall }) {
  const labelSize = W * 0.0155;
  slide.addText(kicker, {
    x: IN(M), y: IN(M - labelSize * 0.4), w: IN(W - M * 2), h: IN(labelSize * 2),
    fontFace: 'Geist Mono', fontSize: PT(labelSize), color: blend(g.bg, g.fg, 0.55),
    charSpacing: PT(W * 0.0028), margin: 0, valign: 'middle',
  });

  const headSize = W * (tall ? 0.070 : 0.064);
  const subSize = W * (tall ? 0.031 : 0.028);
  const footTop = H - M - 46 - 46;

  const subH = subSize * 3.2;
  const headH = headSize * 3.6;
  const subY = footTop - H * (tall ? 0.055 : 0.075) - subH;
  const headY = subY - headH * 0.62;

  slide.addText(headline, {
    x: IN(M), y: IN(headY), w: IN(W - M * 2), h: IN(headH),
    fontFace: 'Outfit', bold: true, fontSize: PT(headSize), color: g.fg,
    lineSpacingMultiple: 1.06, margin: 0, valign: 'bottom',
  });
  slide.addText(sub, {
    x: IN(M), y: IN(subY), w: IN(W * (tall ? 0.88 : 0.80)), h: IN(subH),
    fontFace: 'Outfit', fontSize: PT(subSize), color: blend(g.bg, g.fg, 0.68),
    lineSpacingMultiple: 1.3, margin: 0, valign: 'top',
  });

  footer(slide, { W, H, M, g, logo });
  return { headY, footTop, labelSize };
}

// ------------------------------------------------------------------ builders

function slideQuiet(slide, ctx) {
  const { W, H, M, g } = ctx;
  const s = skeleton(slide, { ...ctx, kicker: 'LISBON · BETA', headline: 'Your headline goes here, two or three lines.', sub: 'One supporting line, quieter than the headline.' });
  const box = W * (ctx.tall ? 0.34 : 0.30);
  placeholder(slide, {
    x: W - M - box, y: s.labelSize + M + H * (ctx.tall ? 0.10 : 0.06), w: box, h: box, g,
    text: 'SIGNAL MARK\ndot · radar · field\n(PNG on-dark/on-light)',
  });
}

function slideDrawn(slide, ctx) {
  const { W, H, M, g } = ctx;
  const s = skeleton(slide, { ...ctx, kicker: 'YOUR KICKER HERE', headline: 'Your headline goes here.', sub: 'One supporting line, quieter than the headline.' });
  const box = W * (ctx.tall ? 0.30 : 0.26);
  placeholder(slide, {
    x: M, y: s.headY - W * 0.075 - box, w: box, h: box, g,
    text: 'LINE ICON\ncup · pin · coin · star …\n(SVG preferred)',
  });
}

function slideInHand(slide, ctx) {
  const { W, H, M, g, tall } = ctx;
  const s = skeleton(slide, { ...ctx, kicker: 'THE APP', headline: 'Your headline goes here.', sub: 'One supporting line, quieter than the headline.' });

  const phH = (s.footTop - (M + H * 0.03)) * (tall ? 0.52 : 0.98);
  const phW = phH * (9 / 19.5);
  const phX = tall ? W * 0.34 : W * 0.605;
  const phY = M + H * 0.03;

  slide.addShape('roundRect', {
    x: IN(phX), y: IN(phY), w: IN(phW), h: IN(phH),
    fill: { color: g.bg }, line: { color: g.fg, width: 1.5 }, rectRadius: IN(phW * 0.115),
  });
  slide.addText('DROP\nSCREENSHOT\nHERE\n\n(send to back,\nkeep this frame\non top)', {
    x: IN(phX), y: IN(phY), w: IN(phW), h: IN(phH),
    fontFace: 'Geist Mono', fontSize: PT(W * 0.015), color: blend(g.bg, g.fg, 0.42),
    align: 'center', valign: 'middle', margin: 0, charSpacing: 0.8,
  });

  const coW = W * (tall ? 0.44 : 0.42);
  const coH = coW * 0.30;
  const coX = tall ? M * 0.7 : M;
  const coY = tall ? phY + phH * 0.62 : s.headY - coH - W * 0.06;
  slide.addShape('roundRect', {
    x: IN(coX), y: IN(coY), w: IN(coW), h: IN(coH),
    fill: { color: 'FFFFFF' }, line: { color: ACCENT, width: 1.5 }, rectRadius: IN(W * 0.018),
  });
  slide.addText('MAGNIFIED DETAIL\ncrop of the screenshot', {
    x: IN(coX), y: IN(coY), w: IN(coW), h: IN(coH),
    fontFace: 'Geist Mono', fontSize: PT(W * 0.015), color: '8A8FA8',
    align: 'center', valign: 'middle', margin: 0,
  });
  slide.addShape('line', {
    x: IN(coX + coW), y: IN(coY + coH / 2), w: IN(phX - coX - coW), h: IN(phY + phH * 0.35 - coY - coH / 2),
    line: { color: ACCENT, width: 1.25, dashType: 'dash' },
  });
}

const DIRECTIONS = [
  { name: 'Quiet Signal', build: slideQuiet, grounds: ['ink', 'paper'] },
  { name: 'Drawn', build: slideDrawn, grounds: ['tint', 'paper', 'ink'] },
  { name: 'In Hand', build: slideInHand, grounds: ['tint', 'ink'] },
];

/** Opening slide: the rules, so the deck explains itself without this repo. */
function guideSlide(pptx, fmt) {
  const s = pptx.addSlide();
  s.background = { color: 'FAFDFF' };
  const M = fmt.w * 0.082;
  s.addText('Turnos — editable templates', {
    x: IN(M), y: IN(M), w: IN(fmt.w - M * 2), h: IN(fmt.w * 0.07),
    fontFace: 'Outfit', bold: true, fontSize: PT(fmt.w * 0.045), color: '14141F', margin: 0,
  });
  s.addText(
    [
      { text: `${fmt.label}  ·  ${fmt.w}×${fmt.h}px\n\n`, options: { color: '6A79FF', bold: true } },
      { text: 'FONTS — upload these to Canva (Brand Kit) for an exact match.\n' },
      { text: 'All three are SIL OFL, and copies live in scripts/ad-campaign/fonts/.\n' },
      { text: '  Headline    Outfit Bold\n  Supporting  Outfit Regular\n  Kicker      Geist Mono\n\n' },
      { text: 'If you cannot upload fonts, substitute in this order:\n' },
      { text: '  Outfit    → Poppins → Figtree → Montserrat\n  Geist Mono → Roboto Mono → IBM Plex Mono → Space Mono\n\n' },
      { text: 'PALETTE\n', options: { bold: true } },
      { text: '  #14141F ink     #FAFDFF paper   #EEF0FF tint\n  #6A79FF accent  #D9D9D9 grey\n\n' },
      { text: 'RULES THAT MATTER\n', options: { bold: true } },
      { text: '  · ONE accent element per frame — the mark and the CTA. No more.\n' },
      { text: '  · Never re-type the wordmark. It is ITC Bauhaus, licensed.\n    Keep the placed logo image; do not substitute Bauhaus 93.\n' },
      { text: '  · No emoji in campaign work. Use the graphics library.\n' },
      { text: '  · Keep the group centred between kicker and hairline.\n' },
      { text: '  · No claim the product cannot back — see docs/brand/COPY_BANK.md\n    for 24 approved headlines and the rejected ones.\n' },
    ],
    {
      x: IN(M), y: IN(M + fmt.w * 0.10), w: IN(fmt.w - M * 2), h: IN(fmt.h * 0.62),
      fontFace: 'Geist Mono', fontSize: PT(fmt.w * 0.0165), color: '14141F',
      lineSpacingMultiple: 1.25, margin: 0, valign: 'top',
    }
  );
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logos = {
    light: await L.logoDataURI('#FAFDFF', 700),
    dark: await L.logoDataURI('#14141F', 700),
  };

  for (const fmt of FORMATS) {
    const pptx = new Pptx();
    pptx.defineLayout({ name: 'TURNOS', width: IN(fmt.w), height: IN(fmt.h) });
    pptx.layout = 'TURNOS';
    pptx.author = 'Turnos';
    pptx.title = `Turnos templates — ${fmt.label}`;

    W_SAFE = fmt.w;
    guideSlide(pptx, fmt);

    for (const dir of DIRECTIONS) {
      for (const groundKey of dir.grounds) {
        const slide = pptx.addSlide();
        const g = GROUNDS[groundKey];
        slide.background = { color: g.bg };
        dir.build(slide, {
          W: fmt.w, H: fmt.h, M: fmt.w * 0.082, g,
          logo: groundKey === 'ink' ? logos.light : logos.dark,
          tall: fmt.h / fmt.w > 1.4,
        });
      }
    }

    const file = path.join(OUT, `turnos-templates-${fmt.key}-${fmt.w}x${fmt.h}.pptx`);
    await pptx.writeFile({ fileName: file });
    console.log('wrote', path.relative(L.REPO, file));
  }
})();
