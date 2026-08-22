'use strict';
/**
 * Quiet Signal — Turnos waiting-list campaign.
 *
 * Wordmark comes from the real logo asset (ITC Bauhaus); headline type is
 * Outfit, a geometric monoline that harmonises with it without impersonating it.
 *
 * Type is sized off the WIDTH (legibility is a function of measure, not of how
 * tall the canvas happens to be) while vertical rhythm is distributed across the
 * ACTUAL band between the index label and the footer rule. Deriving both from
 * the square and stretching left a 500px void at the foot of every 9:16.
 */

const L = require('../lib.js');
const { C, MONO, r } = L;

const HEAD = 'Outfit-Bold';
const BOOK = 'Outfit-Regular';

/** Guard: nothing may cross the safe margin. Fails loudly rather than clipping. */
function assertFits(label, width, maxWidth) {
  if (width > maxWidth) {
    throw new Error(`OVERFLOW ${label}: ${Math.round(width)}px > ${Math.round(maxWidth)}px`);
  }
}

/**
 * Shared furniture: index label top-left, hairline + wordmark + CTA at the foot.
 * Returns the vertical band that concept content may occupy.
 */
function frame({ W, H, M, label, logo, cta, dark }) {
  const ink = dark ? C.paper : C.ink;
  const footY = H - M - 46;
  const labelSize = W * 0.0155;

  const parts = [];
  parts.push(L.text(MONO, label, { x: M, y: M + 14, size: labelSize, tracking: W * 0.0028, fill: ink, opacity: 0.55 }));
  parts.push(L.rule(M, footY - 46, W - M, footY - 46, { stroke: ink, opacity: 0.14 }));

  const lw = W * 0.175;
  const lh = (logo.height / logo.width) * lw;
  parts.push(`<image x="${r(M)}" y="${r(footY - lh / 2 + 4)}" width="${r(lw)}" height="${r(lh)}" xlink:href="${logo.uri}"/>`);

  const ctaSize = W * 0.0175;
  const ctaW = L.measure(HEAD, cta, ctaSize, W * 0.0012);
  const padX = W * 0.026;
  const padY = W * 0.016;
  const bx = W - M - (ctaW + padX * 2);
  const by = footY - (ctaSize + padY * 2) / 2 - ctaSize * 0.12;
  const bh = ctaSize + padY * 2;

  parts.push(`<rect x="${r(bx)}" y="${r(by)}" width="${r(ctaW + padX * 2)}" height="${r(bh)}" rx="${r(bh / 2)}" fill="${C.accent}"/>`);
  parts.push(L.text(HEAD, cta, { x: bx + padX, y: by + padY + ctaSize * 0.78, size: ctaSize, tracking: W * 0.0012, fill: '#FFFFFF' }));

  return {
    svg: parts.join('\n'),
    footTop: footY - 46,          // content must stay above this
    bandTop: M + 14 + labelSize * 1.9, // …and below this
  };
}

// ------------------------------------------------------------------ concepts

/**
 * A — The hook. A field of marks (the city), one of them lit: the shift nobody
 * told you about. The accent is rationed to that single dot and the CTA.
 */
function conceptA({ W, H, logo }) {
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, label: 'LISBON · BETA', logo, cta: 'Get early access', dark: true });

  const copy = 'There are cafés on your street that need someone this week.';
  const tail = 'Nobody’s told you.';
  const size = W * (tall ? 0.072 : 0.0665);
  const lead = size * 1.16;

  const blk = L.block(HEAD, copy, { x: M, y: 0, size, leading: lead, maxWidth: W - M * 2, fill: C.paper, tracking: -size * 0.012 });
  assertFits('A tail', L.measure(HEAD, tail, size, -size * 0.012), W - M * 2);

  const startY = f.footTop - blk.height - lead * 1.5 - H * (tall ? 0.055 : 0.075);
  // The lit mark sits in the open field above the type, on the optical third.
  const focus = { x: W * 0.72, y: f.bandTop + (startY - size - f.bandTop) * 0.42, reach: tall ? 0.34 : 0.5, peak: 0.42 };

  return `
    <rect width="${W}" height="${H}" fill="${C.ink}"/>
    <g>${L.dotField({ x: 0, y: 0, w: W, h: startY - size * 1.1, step: W * 0.031, focus, seed: 19, base: 0.075, fill: C.paper, maxR: W * 0.0024 })}</g>
    <circle cx="${r(focus.x)}" cy="${r(focus.y)}" r="${r(W * 0.0125)}" fill="${C.accent}"/>
    <circle cx="${r(focus.x)}" cy="${r(focus.y)}" r="${r(W * 0.031)}" fill="none" stroke="${C.accent}" stroke-opacity="0.42" stroke-width="${r(W * 0.0016)}"/>
    <circle cx="${r(focus.x)}" cy="${r(focus.y)}" r="${r(W * 0.055)}" fill="none" stroke="${C.accent}" stroke-opacity="0.18" stroke-width="${r(W * 0.0013)}"/>
    ${L.block(HEAD, copy, { x: M, y: startY, size, leading: lead, maxWidth: W - M * 2, fill: C.paper, tracking: -size * 0.012 }).svg}
    ${L.text(HEAD, tail, { x: M, y: startY + blk.height + lead * 1.5, size, tracking: -size * 0.012, fill: C.accent })}
    ${f.svg}
  `;
}

/**
 * B — Restraint as the whole argument. One word at scale, the qualifier
 * whispered beneath it. Free is the strongest thing the product can say.
 */
function conceptB({ W, H, logo }) {
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, label: 'FOR WORKERS · ALWAYS', logo, cta: 'Get early access', dark: false });

  const word = 'Free.';
  const big = W * (tall ? 0.325 : 0.30);
  const wordW = L.measure(HEAD, word, big, -big * 0.028);
  assertFits('B word', wordW, W - M * 2);

  const subSize = W * (tall ? 0.036 : 0.0325);
  const subCopy = 'No signup fee. No commission. No cut of your pay — not now, not later.';
  const sub = L.block(BOOK, subCopy, { x: M, y: 0, size: subSize, leading: subSize * 1.42, maxWidth: W * (tall ? 0.80 : 0.66), fill: C.ink });

  // Centre the whole group optically in the band, rather than hanging it from
  // the top and letting the remainder pool at the bottom.
  const groupH = big * 0.72 + big * 0.40 + sub.height + subSize;
  const wordY = f.bandTop + (f.footTop - f.bandTop - groupH) / 2 + big * 0.72;

  return `
    <rect width="${W}" height="${H}" fill="${C.paper}"/>
    <g>${L.dotField({ x: 0, y: H * 0.02, w: W, h: H * 0.92, step: W * 0.0345, seed: 41, base: 0.055, fill: C.ink, jitter: 0.1 })}</g>
    ${L.text(HEAD, word, { x: M, y: wordY, size: big, tracking: -big * 0.028, fill: C.ink })}
    <rect x="${r(M)}" y="${r(wordY + big * 0.16)}" width="${r(wordW)}" height="${r(W * 0.0075)}" fill="${C.accent}"/>
    ${L.block(BOOK, subCopy, {
      x: M, y: wordY + big * 0.40 + subSize, size: subSize, leading: subSize * 1.42,
      maxWidth: W * (tall ? 0.80 : 0.66), fill: C.ink, opacity: 0.72,
    }).svg}
    ${f.svg}
  `;
}

/**
 * C — The noise you already live with, against the thing that replaces it.
 * Accumulated fragments decay upward; one clean bar holds its shape.
 */
function conceptC({ W, H, logo }) {
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, label: 'NO MORE CHAT GROUPS', logo, cta: 'Get early access', dark: true });
  const rand = L.rng(97);

  const copy = 'The shift, the hours and the pay — before it gets passed around.';
  const size = W * (tall ? 0.067 : 0.062);
  const lead = size * 1.17;
  const blk = L.block(HEAD, copy, { x: M, y: 0, size, leading: lead, maxWidth: W - M * 2, fill: C.paper, tracking: -size * 0.012 });
  const startY = f.footTop - blk.height - H * (tall ? 0.05 : 0.075);

  const barH = W * 0.0175;
  const cleanY = startY - size * 1.15 - W * 0.075;
  const zoneTop = f.bandTop + W * 0.045;      // clear of the index label
  const zoneH = cleanY - zoneTop - W * 0.075;

  const rows = tall ? 24 : 15;
  const bars = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const o = 0.05 + L.easeInOut(t) * 0.30;
    const n = 2 + Math.floor(rand() * 3);
    let x = M + rand() * W * 0.05;
    for (let k = 0; k < n && x < W - M; k++) {
      const bw = W * (0.07 + rand() * 0.20);
      if (x + bw > W - M) break;
      bars.push(`<rect x="${r(x)}" y="${r(zoneTop + t * zoneH)}" width="${r(bw)}" height="${r(barH)}" rx="${r(barH / 2)}" fill="${C.paper}" opacity="${r(o)}"/>`);
      x += bw + W * 0.018;
    }
  }

  return `
    <rect width="${W}" height="${H}" fill="${C.ink}"/>
    ${bars.join('')}
    <rect x="${r(M)}" y="${r(cleanY)}" width="${r(W - M * 2)}" height="${r(barH)}" rx="${r(barH / 2)}" fill="${C.accent}"/>
    ${L.block(HEAD, copy, { x: M, y: startY, size, leading: lead, maxWidth: W - M * 2, fill: C.paper, tracking: -size * 0.012 }).svg}
    ${f.svg}
  `;
}

/**
 * D — The specimen sheet. Treats a shift as an observed phenomenon: three
 * measured facts, set as data, with the reverence usually given to instruments.
 */
function conceptD({ W, H, logo }) {
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, label: 'ONE SHIFT · FULLY VISIBLE', logo, cta: 'Get early access', dark: false });

  const data = [
    ['THE PLACE', 'A café, 8 min away'],
    ['THE HOURS', 'Sat 09:00 — 15:00'],
    ['THE PAY', 'Known before you apply'],
  ];

  const kSize = W * 0.0165;
  const vSize = W * (tall ? 0.058 : 0.052);
  const rowH = kSize + vSize * 1.02;

  // Distribute so the LAST row lands just above the footer — the previous
  // version divided the band by 3 and left the final third empty.
  const top = f.bandTop + W * (tall ? 0.10 : 0.055);
  // Reserve real space under the last row. Without it the final value sits ~40px
  // off the footer rule while the gaps between rows run to 600px — the rhythm
  // reads as an accident rather than a decision.
  const gap = (f.footTop - W * (tall ? 0.13 : 0.07) - top - rowH) / (data.length - 1);

  const rows = data.map(([k, v], i) => {
    const y = top + i * gap;
    assertFits('D value ' + i, L.measure(HEAD, v, vSize, -vSize * 0.012), W - M * 2);
    return `
      ${L.rule(M, y - kSize * 2.4, W - M, y - kSize * 2.4, { stroke: C.ink, opacity: 0.13 })}
      ${L.text(MONO, k, { x: M, y, size: kSize, tracking: W * 0.0028, fill: C.ink, opacity: 0.5 })}
      ${L.text(HEAD, v, { x: M, y: y + vSize * 1.02, size: vSize, tracking: -vSize * 0.012, fill: C.ink })}
      <circle cx="${r(W - M - W * 0.008)}" cy="${r(y - kSize * 0.32)}" r="${r(W * 0.008)}" fill="${i === 2 ? C.accent : C.ink}" opacity="${i === 2 ? 1 : 0.16}"/>`;
  });

  return `
    <rect width="${W}" height="${H}" fill="${C.paper}"/>
    ${rows.join('')}
    ${f.svg}
  `;
}

/**
 * E — The city as instrument reading. A dense measured field, Lisbon implied
 * rather than drawn, resolving to a single live point.
 */
function conceptE({ W, H, logo }) {
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, label: 'LISBON · LAUNCHING SOON', logo, cta: 'Get early access', dark: true });

  const copy = 'Shifts near you. Starting in Lisbon.';
  const size = W * (tall ? 0.063 : 0.058);
  const blk = L.block(HEAD, copy, { x: W / 2, y: 0, size, leading: size * 1.16, maxWidth: W * 0.80, fill: C.paper, anchor: 'middle', tracking: -size * 0.012 });
  const startY = f.footTop - blk.height - H * (tall ? 0.05 : 0.072);

  // Keep the field clear of the type — a stray point behind a letter reads as
  // dirt on the lens, not as data.
  const textTop = startY - size * 1.15;
  const cx = W * 0.5;
  const cy = f.bandTop + (textTop - f.bandTop) * 0.47;
  const reach = Math.min(W * 0.40, (textTop - f.bandTop) * 0.52);

  const rings = [];
  for (let i = 1; i <= 7; i++) {
    rings.push(`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r((reach / 7) * i)}" fill="none" stroke="${C.paper}" stroke-opacity="${r(0.20 - i * 0.021)}" stroke-width="${r(W * 0.0012)}"/>`);
  }

  const rand = L.rng(233);
  const pts = [];
  for (let i = 0; i < 52; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * reach;
    const px = cx + Math.cos(a) * d;
    const py = cy + Math.sin(a) * d;
    if (py > textTop - size * 0.4 || py < f.bandTop) continue;
    const o = 0.22 + (1 - d / reach) * 0.5;
    pts.push(`<circle cx="${r(px)}" cy="${r(py)}" r="${r(W * 0.0035)}" fill="${C.paper}" opacity="${r(o)}"/>`);
  }

  return `
    <rect width="${W}" height="${H}" fill="${C.ink}"/>
    ${rings.join('')}
    ${pts.join('')}
    <circle cx="${r(cx)}" cy="${r(cy)}" r="${r(W * 0.0135)}" fill="${C.accent}"/>
    ${L.block(HEAD, copy, { x: W / 2, y: startY, size, leading: size * 1.16, maxWidth: W * 0.80, fill: C.paper, anchor: 'middle', tracking: -size * 0.012 }).svg}
    ${f.svg}
  `;
}

module.exports = { conceptA, conceptB, conceptC, conceptD, conceptE, HEAD, BOOK };
