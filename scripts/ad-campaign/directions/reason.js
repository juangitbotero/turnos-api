'use strict';
/**
 * Direction 4 — "Whatever your reason".
 *
 * The job never changes; the person does. Every card pairs the reason someone
 * keeps a flexible week (the swell, the exams, the canvas) with the one shift
 * they all end up taking — the bar. The reason is drawn in the ground's ink,
 * the shift in the accent: the reason is theirs, the shift is Turnos.
 *
 * Same bones as Direction 2 (index label, centred group, hairline, wordmark,
 * CTA — `frame()` is shared), three ways of filling the mark slot:
 *
 *   pair      one reason → the shift, joined by a dashed connector
 *   converge  a row of reasons whose lines all run into one shift
 *   list      reasons stacked as quiet rows, then the headline
 *
 * Audience rule: every persona must be someone who LIVES in Portugal. A
 * visitor cannot reach the 80-point activation gate (no NIF/IBAN) and cannot
 * hold an MCD contract — see META_CAMPAIGN_PLAN.md §0. So "the newcomer"
 * moved here; nobody in this set is on holiday.
 */

const L = require('../lib.js');
const { line } = require('../icons.js');
const { frame, assertFits, GROUNDS } = require('./drawn.js');
const { C, MONO, r } = L;

const HEAD = 'Outfit-Bold';
const BOOK = 'Outfit-Regular';
const CTA = 'Get early access';
const SERIES = 'WHATEVER YOUR REASON';
const SHIFT_ICON = 'cocktail';   // the constant: every reason ends at the bar

/** Headline + supporting line measured once, drawn at a y chosen later. */
function copy({ W, M, tall, spec, g, headScale = 1 }) {
  const headSize = W * (tall ? 0.070 : 0.064) * headScale;
  const headLead = headSize * 1.15;
  const subSize = W * (tall ? 0.031 : 0.028);
  const subW = W * (tall ? 0.88 : 0.80);
  // Measured with the SAME tracking it is drawn with. Without it the measure
  // wraps a line earlier than the draw does, and the supporting line is
  // pushed down by a phantom extra headline row.
  const head = L.block(HEAD, spec.headline, { x: 0, y: 0, size: headSize, leading: headLead, maxWidth: W - M * 2, tracking: -headSize * 0.012 });
  const sub = L.block(BOOK, spec.sub, { x: 0, y: 0, size: subSize, leading: subSize * 1.5, maxWidth: subW });
  const height = headSize + head.height + headLead * 0.95 + sub.height + subSize;
  const draw = (top) => `
    ${L.block(HEAD, spec.headline, {
      x: M, y: top + headSize, size: headSize, leading: headLead, maxWidth: W - M * 2, fill: g.ink, tracking: -headSize * 0.012,
    }).svg}
    ${L.block(BOOK, spec.sub, {
      x: M, y: top + headSize + head.height + headLead * 0.95, size: subSize, leading: subSize * 1.5,
      maxWidth: subW, fill: g.ink, opacity: 0.68,
    }).svg}`;
  return { height, draw };
}

function icon(name, x, y, size, stroke, W) {
  const sw = 100 / size * (W * 0.0055);   // constant optical weight at any size
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${r(size / 100)})">${line[name](stroke, sw)}</g>`;
}

// ------------------------------------------------------------------ layouts

/** One reason, a dashed connector, the shift. Labels under each mark. */
function pair({ W, M, tall, spec, g }) {
  const s = W * (tall ? 0.28 : 0.20);
  const labelSize = W * 0.0145;
  const labelGap = W * 0.03;
  const artGap = W * 0.075;
  const artH = s + labelGap + labelSize;
  const text = copy({ W, M, tall, spec, g });

  assertFits('reason label', L.measure(MONO, spec.reasonLabel, labelSize, W * 0.0026), (W - M * 2) / 2 - W * 0.02);

  return {
    height: artH + artGap + text.height,
    draw: (top) => {
      const cy = top + s / 2;
      const x1 = M + s + W * 0.04;
      const x2 = W - M - s - W * 0.04;
      const ah = W * 0.011;
      const ly = top + s + labelGap + labelSize * 0.8;
      return `
        ${icon(spec.icon, M, top, s, g.ink, W)}
        <line x1="${r(x1)}" y1="${r(cy)}" x2="${r(x2)}" y2="${r(cy)}" stroke="${g.ink}" stroke-opacity="0.32"
              stroke-width="${r(W * 0.0028)}" stroke-dasharray="${r(W * 0.006)} ${r(W * 0.012)}" stroke-linecap="round"/>
        <path d="M${r(x2 - ah)} ${r(cy - ah)} L${r(x2)} ${r(cy)} L${r(x2 - ah)} ${r(cy + ah)}" fill="none"
              stroke="${g.ink}" stroke-opacity="0.45" stroke-width="${r(W * 0.0028)}" stroke-linecap="round" stroke-linejoin="round"/>
        ${icon(SHIFT_ICON, W - M - s, top, s, C.accent, W)}
        ${L.text(MONO, spec.reasonLabel, { x: M, y: ly, size: labelSize, tracking: W * 0.0026, fill: g.ink, opacity: 0.55 })}
        ${L.text(MONO, spec.shiftLabel || 'THE SHIFT', { x: W - M, y: ly, size: labelSize, tracking: W * 0.0026, fill: g.ink, opacity: 0.55, anchor: 'end' })}
        ${text.draw(top + artH + artGap)}`;
    },
  };
}

/** A row of reasons; a line from each runs down into the single shift. */
function converge({ W, M, tall, spec, g }) {
  const n = spec.icons.length;
  const gap = W * 0.035;
  const s = Math.min((W - M * 2 - gap * (n - 1)) / n, W * 0.13);
  const rowW = s * n + gap * (n - 1);
  const curveH = W * (tall ? 0.26 : 0.12);
  const shift = W * (tall ? 0.26 : 0.17);
  const artGap = W * 0.07;
  const artH = s + curveH + shift;
  const text = copy({ W, M, tall, spec, g });

  return {
    height: artH + artGap + text.height,
    draw: (top) => {
      const x0 = (W - rowW) / 2;
      const cx = W / 2;
      const yA = top + s + W * 0.018;
      const yB = top + s + curveH - W * 0.012;
      const mid = (yA + yB) / 2;
      const parts = [];
      spec.icons.forEach((name, i) => {
        const x = x0 + i * (s + gap);
        parts.push(icon(name, x, top, s, g.ink, W));
        const ix = x + s / 2;
        parts.push(`<path d="M${r(ix)} ${r(yA)} C${r(ix)} ${r(mid)} ${r(cx)} ${r(mid)} ${r(cx)} ${r(yB)}" fill="none"
          stroke="${g.ink}" stroke-opacity="0.26" stroke-width="${r(W * 0.0026)}" stroke-linecap="round"/>`);
      });
      parts.push(icon(SHIFT_ICON, cx - shift / 2, top + s + curveH, shift, C.accent, W));
      parts.push(text.draw(top + artH + artGap));
      return parts.join('\n');
    },
  };
}

/** Reasons as quiet rows (optionally each with its mark), then the headline. */
function list({ W, M, tall, spec, g }) {
  const withIcons = spec.rows.some((row) => row.icon);
  const rowSize = W * (withIcons ? (tall ? 0.044 : 0.040) : (tall ? 0.058 : 0.052));
  const rowLead = rowSize * (withIcons ? 1.95 : 1.4);
  const is = rowSize * 1.45;
  const textX = M + (withIcons ? is + W * 0.03 : 0);
  const listGap = W * (tall ? 0.09 : 0.06);
  const listH = rowLead * (spec.rows.length - 1) + rowSize;
  const text = copy({ W, M, tall, spec, g, headScale: withIcons ? 1 : 1.12 });

  spec.rows.forEach((row) => assertFits('reason row', L.measure(BOOK, row.text, rowSize), W - M - textX));

  return {
    height: listH + listGap + text.height,
    draw: (top) => {
      const parts = spec.rows.map((row, i) => {
        const base = top + rowSize + i * rowLead;   // text baseline
        // Row marks sit at the same weight and opacity as the text beside them;
        // at full stroke they out-shouted the words.
        const mark = row.icon
          ? `<g opacity="0.55">${icon(row.icon, M, base - rowSize * 0.36 - is / 2, is, g.ink, W * 0.5)}</g>`
          : '';
        return mark + L.text(BOOK, row.text, { x: textX, y: base, size: rowSize, fill: g.ink, opacity: 0.5 });
      });
      parts.push(text.draw(top + listH + listGap));
      return parts.join('\n');
    },
  };
}

const LAYOUTS = { pair, converge, list };

// ------------------------------------------------------------------ card

function card({ W, H, logo, spec }) {
  const g = GROUNDS[spec.ground];
  const M = W * 0.082;
  const tall = H / W > 1.4;
  const f = frame({ W, H, M, kicker: SERIES, logo, cta: CTA, g });

  // Series index on the right of the label row: which reason this is.
  const labelSize = W * 0.0155;
  const idx = L.text(MONO, spec.index, { x: W - M, y: M + 14, size: labelSize, tracking: W * 0.0028, fill: g.ink, opacity: 0.55, anchor: 'end' });
  assertFits('reason index',
    L.measure(MONO, SERIES, labelSize, W * 0.0028) + L.measure(MONO, spec.index, labelSize, W * 0.0028) + W * 0.05,
    W - M * 2);

  // Centre the whole group in the band between label row and footer rule.
  const body = LAYOUTS[spec.layout]({ W, M, tall, spec, g });
  const band = f.footTop - f.bandTop;
  if (body.height > band - W * 0.04) {
    throw new Error(`OVERFLOW ${spec.id} ${W}x${H}: group ${Math.round(body.height)}px in a ${Math.round(band)}px band`);
  }
  const top = f.bandTop + (band - body.height) / 2;

  return `
    <rect width="${W}" height="${H}" fill="${g.bg}"/>
    ${body.draw(top)}
    ${idx}
    ${f.svg}
  `;
}

// ------------------------------------------------------------------ specs
/**
 * Every supporting line is a claim the code backs: availability days
 * (`Worker.isAvailableForWork` + `availableDays`), gross rate on the card,
 * no worker fee (`TURNOS_FEE_FIXED_EUR` is company-side). No payment timing,
 * no statistics, nothing that makes Turnos the one finding you work.
 */
const SPECS = [
  {
    id: 'AB-surfer', layout: 'pair', ground: 'tint', icon: 'surfboard', index: '01 · THE SURFER',
    reasonLabel: 'THE SWELL', shiftLabel: 'THE BAR',
    headline: 'Surf at dawn. Bar at night.',
    sub: 'Train when the swell is up. Take a shift when it isn’t.',
  },
  {
    id: 'AC-student', layout: 'pair', ground: 'paper', icon: 'book', index: '02 · THE STUDENT',
    reasonLabel: 'THE DEGREE', shiftLabel: 'THE BAR',
    headline: 'Exams in May. Shifts in between.',
    sub: 'Work the weeks you can. Switch it off the weeks you can’t.',
  },
  {
    id: 'AD-painter', layout: 'pair', ground: 'ink', icon: 'palette', index: '03 · THE PAINTER',
    reasonLabel: 'THE CANVAS', shiftLabel: 'THE BAR',
    headline: 'Paint all week. Pour on Friday.',
    sub: 'Shifts that fund the work without swallowing it.',
  },
  {
    id: 'AE-musician', layout: 'pair', ground: 'tint', icon: 'note', index: '04 · THE MUSICIAN',
    reasonLabel: 'THE GIG', shiftLabel: 'THE BAR',
    headline: 'Gig on Saturday. Shift on Thursday.',
    sub: 'Keep the nights that matter. Fill the ones that don’t.',
  },
  {
    id: 'AF-athlete', layout: 'pair', ground: 'paper', icon: 'dumbbell', index: '05 · THE ATHLETE',
    reasonLabel: 'THE SESSION', shiftLabel: 'THE BAR',
    headline: 'Training comes first. The shift fits around it.',
    sub: 'Pick the hours that leave your sessions untouched.',
  },
  {
    id: 'AG-newcomer', layout: 'pair', ground: 'ink', icon: 'sun', index: '06 · THE NEWCOMER',
    reasonLabel: 'THE LIGHT', shiftLabel: 'THE BAR',
    headline: 'You moved to Lisbon for the sun. Keep it.',
    sub: 'Evening shifts near home, and your days stay yours.',
  },
  {
    id: 'AH-remote', layout: 'pair', ground: 'tint', icon: 'laptop', index: '07 · THE REMOTE WORKER',
    reasonLabel: 'THE DAY JOB', shiftLabel: 'THE BAR',
    headline: 'Laptop shut at five. Apron on at six.',
    sub: 'A second income, on the evenings you choose.',
  },
  {
    id: 'AI-photographer', layout: 'pair', ground: 'paper', icon: 'camera', index: '08 · THE PHOTOGRAPHER',
    reasonLabel: 'THE SHOOT', shiftLabel: 'THE BAR',
    headline: 'Shoot on weekdays. Serve on weekends.',
    sub: 'Short shifts between the jobs you actually want.',
  },
  {
    id: 'AJ-parent', layout: 'pair', ground: 'ink', icon: 'backpack', index: '09 · THE PARENT',
    reasonLabel: 'THE SCHOOL RUN', shiftLabel: 'THE BAR',
    headline: 'School run at three. Shift at seven.',
    sub: 'Pick your days. Companies only find you on the ones you choose.',
  },
  {
    id: 'AK-founder', layout: 'pair', ground: 'tint', icon: 'bulb', index: '10 · THE FOUNDER',
    reasonLabel: 'THE IDEA', shiftLabel: 'THE BAR',
    headline: 'Building something of your own? Fund it a shift at a time.',
    sub: 'Keep your days for the idea, and the full gross for yourself.',
  },
  {
    id: 'AL-saver', layout: 'pair', ground: 'paper', icon: 'plane', index: '11 · THE SAVER',
    reasonLabel: 'THE TRIP', shiftLabel: 'THE BAR',
    headline: 'The trip is in August. The shifts are now.',
    sub: 'Save on your own schedule. We take no cut of your pay.',
  },
  {
    id: 'AM-free-saturday', layout: 'pair', ground: 'ink', icon: 'sofa', index: '12 · THE FREE SATURDAY',
    reasonLabel: 'THE DAY OFF', shiftLabel: 'THE BAR',
    headline: 'A free Saturday is reason enough.',
    sub: 'No big plan needed. Just a shift that fits.',
  },
  {
    id: 'AN-retired', layout: 'pair', ground: 'tint', icon: 'glasses', index: '13 · THE RETIREE',
    reasonLabel: 'THE PEOPLE', shiftLabel: 'THE BAR',
    headline: 'Retired from the job. Not from people.',
    sub: 'A few shifts a month, whenever you feel like it.',
  },
  {
    id: 'AO-same-shift', layout: 'converge', ground: 'paper', index: 'ALL OF THEM',
    icons: ['surfboard', 'book', 'palette', 'note', 'laptop'],
    headline: 'Different lives. Same shift.',
    sub: 'Whatever brings you behind the bar, the pay is on the card before you apply.',
  },
  {
    id: 'AP-one-bar', layout: 'converge', ground: 'ink', index: 'FRIDAY, 20:00',
    icons: ['dumbbell', 'camera', 'sun', 'backpack', 'glasses'],
    headline: 'Five reasons. One bar. Friday at eight.',
    sub: 'Pick the shift, work it, keep the full gross. Free for workers, always.',
  },
  {
    id: 'AQ-whatever', layout: 'list', ground: 'tint', index: 'THE LIST',
    rows: [
      { icon: 'surfboard', text: 'For the swell.' },
      { icon: 'book', text: 'For the exams.' },
      { icon: 'palette', text: 'For the canvas.' },
      { icon: 'note', text: 'For the gig.' },
      { icon: 'plane', text: 'For the trip.' },
    ],
    headline: 'Whatever your reason.',
    sub: 'Short shifts in Lisbon that fit around the thing that matters.',
  },
  {
    id: 'AR-nobody-asks', layout: 'list', ground: 'paper', index: 'NO QUESTIONS',
    rows: [
      { icon: 'dumbbell', text: 'Training for a race.' },
      { icon: 'book', text: 'Finishing a thesis.' },
      { icon: 'note', text: 'Saving for a record.' },
      { icon: 'sun', text: 'New in Lisbon.' },
      { icon: 'sofa', text: 'Just free on Saturday.' },
    ],
    headline: 'Your reason is your business.',
    sub: 'Pick the shifts, keep the full gross, keep the rest of your week.',
  },
  {
    id: 'AS-by-friday', layout: 'list', ground: 'ink', index: 'ONE WEEK',
    rows: [
      { text: 'Surfer by morning.' },
      { text: 'Student by day.' },
      { text: 'Painter by night.' },
    ],
    headline: 'Bartender on Friday.',
    sub: 'Whoever you are the rest of the week.',
  },
];

// ------------------------------------------------------------------ contact sheet

/** Feed-size (4:5) thumbnails of the whole set, on one page. */
async function contactSheet(dir, ids) {
  const sharp = require('sharp');
  const path = require('path');
  const cw = 240, ch = 300, gap = 26, cols = 6, M = 52, top = 128;
  const rows = Math.ceil(ids.length / cols);
  const W = M * 2 + cols * cw + (cols - 1) * gap;
  const H = top + rows * (ch + 56) + gap * (rows - 1) + M;
  const tiles = [];
  for (let i = 0; i < ids.length; i++) {
    const cx = M + (i % cols) * (cw + gap);
    const cy = top + Math.floor(i / cols) * (ch + 56 + gap);
    const buf = await sharp(path.join(dir, `${ids[i]}_1080x1350.png`)).resize(cw, ch).png().toBuffer();
    tiles.push(`<rect x="${cx - 1}" y="${cy - 1}" width="${cw + 2}" height="${ch + 2}" fill="#E6E8EF"/>`);
    tiles.push(`<image x="${cx}" y="${cy}" width="${cw}" height="${ch}" xlink:href="data:image/png;base64,${buf.toString('base64')}"/>`);
    tiles.push(L.text(MONO, ids[i].toUpperCase(), { x: cx, y: cy + ch + 26, size: 12, tracking: 1, fill: '#14141F', opacity: 0.62 }));
  }
  const svg = `<rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${L.text(HEAD, 'Turnos — whatever your reason', { x: M, y: 62, size: 34, tracking: -0.5, fill: '#14141F' })}
    ${L.text(MONO, `DIRECTION 4  ·  ${ids.length} VARIANTS  ·  1080×1350 FEED SHOWN, 1080×1920 STORY ALSO BUILT`, { x: M, y: 94, size: 14, tracking: 1.4, fill: '#14141F', opacity: 0.5 })}
    ${tiles.join('\n')}`;
  await L.render(svg, path.join(dir, '_contact-sheet.png'), W, H);
}

module.exports = { card, SPECS, contactSheet };
