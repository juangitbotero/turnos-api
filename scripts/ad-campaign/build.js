'use strict';
/**
 * Turnos ad-campaign build.
 *
 *   node build.js                 everything
 *   node build.js quiet-signal    one direction
 *   node build.js drawn F         one direction, ids starting with "F"
 *   node build.js graphics        just the motif library (PNG + SVG)
 *
 * Output goes to docs/brand/ad-campaign/. Rebuilding is always safe: every
 * asset is derived from the spec arrays in directions/, so a copy change is an
 * edit plus a re-run, never a re-edit of a PNG.
 */

const path = require('path');
const fs = require('fs');
const L = require('./lib.js');
const quiet = require('./directions/quiet-signal.js');
const drawn = require('./directions/drawn.js');

const OUT = path.join(L.REPO, 'docs', 'brand', 'ad-campaign');
const SIZES = [{ w: 1080, h: 1080 }, { w: 1080, h: 1920 }];

const QUIET = [
  ['A-nobody-told-you', quiet.conceptA, 'dark'],
  ['B-free-always', quiet.conceptB, 'light'],
  ['C-passed-around', quiet.conceptC, 'dark'],
  ['D-one-shift', quiet.conceptD, 'light'],
  ['E-lisbon', quiet.conceptE, 'dark'],
];

async function buildQuiet(logos, filter) {
  const dir = path.join(OUT, '01-quiet-signal');
  let n = 0;
  for (const [id, fn, ground] of QUIET) {
    if (filter && !id.startsWith(filter)) continue;
    for (const s of SIZES) {
      const logo = ground === 'dark' ? logos.light : logos.dark;
      await L.render(fn({ W: s.w, H: s.h, logo }), path.join(dir, `${id}_${s.w}x${s.h}.png`), s.w, s.h);
      n++;
    }
  }
  return n;
}

async function buildDrawn(logos, filter) {
  const dir = path.join(OUT, '02-drawn');
  let n = 0;
  for (const spec of drawn.SPECS) {
    if (filter && !spec.id.startsWith(filter)) continue;
    const logo = spec.ground === 'ink' ? logos.light : logos.dark;
    for (const s of SIZES) {
      await L.render(drawn.card({ W: s.w, H: s.h, logo, spec }), path.join(dir, `${spec.id}_${s.w}x${s.h}.png`), s.w, s.h);
      n++;
    }
  }
  return n;
}

(async () => {
  const [which, filter] = process.argv.slice(2);
  const logos = {
    light: await L.logoDataURI(L.C.paper, 700),   // wordmark for dark grounds
    dark: await L.logoDataURI(L.C.ink, 700),      // wordmark for light grounds
  };

  let total = 0;
  if (!which || which === 'quiet-signal') total += await buildQuiet(logos, filter);
  if (!which || which === 'drawn') total += await buildDrawn(logos, filter);
  if (total) console.log(`${total} composition(s) written to ${path.relative(L.REPO, OUT)}`);

  // Direction 3 reads screenshots off disk and crops them, so it is its own
  // async entry point rather than a spec array.
  if (!which || which === 'in-hand') {
    const { spawnSync } = require('child_process');
    const args = ['build3.js'];
    if (filter) args.push(filter);
    const res = spawnSync(process.execPath, args, { cwd: __dirname, encoding: 'utf8' });
    process.stdout.write(res.stdout || '');
    if (res.status !== 0) process.stdout.write(res.stderr || '');
  }

  if (!which || which === 'graphics') {
    require('./export.js');   // writes its own summary
  }
})();
