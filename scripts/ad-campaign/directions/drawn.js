'use strict';
/**
 * Direction 2 — "Drawn".
 *
 * Keeps the skeleton of Quiet Signal (index label above, hairline + wordmark +
 * CTA below, generous margins, one accent) and swaps the abstract mark for a
 * drawn one. The warm ground comes from the reference: a two-tone card, ink
 * line illustration, copy set quietly underneath.
 *
 * The tint is NOT invented — #EEF0FF is Primary Light from DESIGN_SYSTEM.md,
 * already used for chip and tag backgrounds in the product. The reference's
 * cream/yellow pairing maps onto tokens Turnos already owns.
 */

const L = require('../lib.js');
const { line } = require('../icons.js');
const { C, MONO, r } = L;

const HEAD = 'Outfit-Bold';
const BOOK = 'Outfit-Regular';

const GROUNDS = {
  paper: { bg: '#FAFDFF', ink: '#14141F', art: '#6A79FF' },
  tint:  { bg: '#EEF0FF', ink: '#14141F', art: '#6A79FF' },  // brand Primary Light
  ink:   { bg: '#14141F', ink: '#FAFDFF', art: '#6A79FF' },
};

function assertFits(label, width, maxWidth) {
  if (width > maxWidth) {
    throw new Error(`OVERFLOW ${label}: ${Math.round(width)}px > ${Math.round(maxWidth)}px`);
  }
}

/** Index label, hairline, wordmark and CTA — unchanged from Direction 1. */
function frame({ W, H, M, kicker, logo, cta, g }) {
  const footY = H - M - 46;
  const labelSize = W * 0.0155;
  const parts = [];

  parts.push(L.text(MONO, kicker, { x: M, y: M + 14, size: labelSize, tracking: W * 0.0028, fill: g.ink, opacity: 0.55 }));
  parts.push(L.rule(M, footY - 46, W - M, footY - 46, { stroke: g.ink, opacity: 0.14 }));

  const lw = W * 0.175;
  const lh = (logo.height / logo.width) * lw;
  parts.push(`<image x="${r(M)}" y="${r(footY - lh / 2 + 4)}" width="${r(lw)}" height="${r(lh)}" xlink:href="${logo.uri}"/>`);

  const ctaSize = W * 0.0175;
  const ctaW = L.measure(HEAD, cta, ctaSize, W * 0.0012);
  const padX = W * 0.026;
  const padY = W * 0.016;
  const bx = W - M - (ctaW + padX * 2);
  const bh = ctaSize + padY * 2;
  const by = footY - bh / 2 - ctaSize * 0.12;

  parts.push(`<rect x="${r(bx)}" y="${r(by)}" width="${r(ctaW + padX * 2)}" height="${r(bh)}" rx="${r(bh / 2)}" fill="${C.accent}"/>`);
  parts.push(L.text(HEAD, cta, { x: bx + padX, y: by + padY + ctaSize * 0.78, size: ctaSize, tracking: W * 0.0012, fill: '#FFFFFF' }));

  return { svg: parts.join('\n'), footTop: footY - 46, bandTop: M + 14 + labelSize * 1.9 };
}

/**
 * One composition: drawn mark, headline, supporting line.
 * Vertical space is distributed across the real band so 9:16 does not pool
 * empty space at the foot — the failure the first pass had to fix.
 */
function card({ W, H, logo, spec }) {
  const g = GROUNDS[spec.ground];
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, kicker: spec.kicker, logo, cta: 'Get early access', g });

  const headSize = W * (tall ? 0.070 : 0.064);
  const headLead = headSize * 1.15;
  const subSize = W * (tall ? 0.031 : 0.028);

  const head = L.block(HEAD, spec.headline, {
    x: M, y: 0, size: headSize, leading: headLead, maxWidth: W - M * 2, fill: g.ink, tracking: -headSize * 0.012,
  });
  const sub = L.block(BOOK, spec.sub, {
    x: M, y: 0, size: subSize, leading: subSize * 1.5, maxWidth: W * (tall ? 0.88 : 0.80), fill: g.ink,
  });

  // The drawing is a mark, not a hero: sized down and hung directly above the
  // headline so the two read as one group on a single left axis with the
  // kicker and the wordmark.
  //
  // Then the WHOLE group — art, headline, supporting line — is centred in the
  // band between the kicker and the footer rule. Anchoring it to the footer
  // instead pushed every pixel of slack to the top and left the composition
  // hanging; letting the art fill the upper band stranded the type at the
  // bottom. Balanced space above and below is the only version that reads as
  // a decision rather than as leftovers.
  const textH = head.height + headLead * 0.95 + sub.height + subSize;
  const artBox = W * (tall ? 0.30 : 0.26);
  const artGap = W * 0.075;
  const groupH = artBox + artGap + headSize + textH;

  const top = f.bandTop + (f.footTop - f.bandTop - groupH) / 2;
  const artX = M;
  const artY = top;
  const headY = top + artBox + artGap + headSize;
  const sw = 100 / artBox * (W * 0.0055);   // constant optical weight at any size

  assertFits('drawn kicker', L.measure(MONO, spec.kicker, W * 0.0155, W * 0.0028), W - M * 2);

  return `
    <rect width="${W}" height="${H}" fill="${g.bg}"/>
    <g transform="translate(${r(artX)} ${r(artY)}) scale(${r(artBox / 100)})">
      ${line[spec.icon](g.art, sw)}
    </g>
    ${L.block(HEAD, spec.headline, {
      x: M, y: headY, size: headSize, leading: headLead, maxWidth: W - M * 2, fill: g.ink, tracking: -headSize * 0.012,
    }).svg}
    ${L.block(BOOK, spec.sub, {
      x: M, y: headY + head.height + headLead * 0.95, size: subSize, leading: subSize * 1.5,
      maxWidth: W * (tall ? 0.88 : 0.80), fill: g.ink, opacity: 0.68,
    }).svg}
    ${f.svg}
  `;
}

/**
 * Ten variants. Every claim is checked against what the code actually does —
 * no payment-speed promises (retired in the 2026-07 pivot), no "we process
 * your wages" language, no invented statistics.
 */
const SPECS = [
  {
    id: 'F-cafe-two-streets', ground: 'tint', icon: 'cup', kicker: 'TONIGHT · LISBON',
    headline: 'The café two streets away is short tonight.',
    sub: 'See the place, the hours and the pay before you apply.',
  },
  {
    id: 'G-we-take-nothing', ground: 'paper', icon: 'coin', kicker: 'WHAT IT COSTS YOU',
    headline: 'We take nothing from your pay.',
    sub: 'No signup fee, no commission, no cut per shift. The company pays you directly.',
  },
  {
    id: 'H-know-before-yes', ground: 'ink', icon: 'clock', kicker: 'NO SURPRISES',
    headline: 'Know the pay before you say yes.',
    sub: 'Gross hourly rate on every shift card. Always, by law and by design.',
  },
  {
    id: 'I-thursday-not-friday', ground: 'tint', icon: 'calendar', kicker: 'YOUR WEEK',
    headline: 'Work Thursday. Skip Friday.',
    sub: 'Take the shifts that fit around your life. Nobody asks you why.',
  },
  {
    id: 'J-one-scan', ground: 'paper', icon: 'qr', kicker: 'ARRIVING',
    headline: 'One scan and you’re on shift.',
    sub: 'No paperwork at the door. The shift closes itself when it ends.',
  },
  {
    id: 'K-your-street', ground: 'ink', icon: 'pin', kicker: 'NEAR YOU',
    headline: 'Shifts on your street, not across town.',
    sub: 'Sorted by how far you would actually have to walk.',
  },
  {
    id: 'L-get-asked-back', ground: 'tint', icon: 'star', kicker: 'REPUTATION',
    headline: 'Do it well. Get asked back.',
    sub: 'Every good shift builds a profile the next company can see.',
  },
  {
    id: 'M-work-you-know', ground: 'paper', icon: 'tray', kicker: 'THE TRADE',
    headline: 'Bar, kitchen, floor, events.',
    sub: 'Eight sectors of work you already know how to do.',
  },
  {
    id: 'N-no-middleman', ground: 'ink', icon: 'apron', kicker: 'NO AGENCY',
    headline: 'Nobody standing between you and the work.',
    sub: 'The company hires you and pays you. Turnos is not an agency.',
  },
  {
    id: 'O-in-your-pocket', ground: 'tint', icon: 'phone', kicker: 'LAUNCHING SOON',
    headline: 'Find it, take it, show up.',
    sub: 'The whole thing lives in your pocket. Free for workers, always.',
  },
];

module.exports = { card, SPECS, GROUNDS };
