'use strict';
/**
 * Quiet Signal — render engine.
 *
 * Type is converted to vector outlines with opentype.js before it ever reaches
 * the rasteriser, so output does not depend on a font being installed on the
 * machine. Compositions are authored as SVG and rasterised with sharp.
 */

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const sharp = require('sharp');

// Fonts are vendored into this folder on purpose. They were originally loaded
// from a session-scoped tooling path that does not survive, which would have
// left the generator unable to run a week later. All three families are SIL
// OFL; the licence files sit beside the .ttf as that licence requires.
const FONT_DIR = path.join(__dirname, 'fonts');

/** Monorepo root — this script lives at <root>/scripts/ad-campaign/. */
const REPO = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------- palette
// Monochromatic: one hue (Turnos Blue) over a neutral axis. The accent is
// rationed to a single element per composition — usually the signal itself.
const C = {
  ink: '#14141F',        // near-black ground, sits just under brand Text Primary
  inkDeep: '#0B0B12',    // for vignette depth
  paper: '#FAFDFF',      // brand Turnos White
  grey: '#D9D9D9',       // brand Turnos Grey
  accent: '#6A79FF',     // brand Turnos Blue — the signal
};

// ---------------------------------------------------------------- fonts
const _cache = new Map();
function font(name) {
  if (!_cache.has(name)) {
    // opentype.loadSync is deprecated in 1.3.x and returns undefined — parse the
    // buffer directly. `name` may be a bare family (looked up in FONT_DIR) or an
    // absolute path to a .ttf.
    const file = name.includes(':') || name.includes('/')
      ? name
      : path.join(FONT_DIR, name + '.ttf');
    _cache.set(name, opentype.parse(fs.readFileSync(file).buffer));
  }
  return _cache.get(name);
}

const DISPLAY = 'InstrumentSans-Bold';   // closest sibling to brand Inter
const BOOK = 'InstrumentSans-Regular';
const MONO = 'GeistMono-Regular';        // clinical labels / reference marks

/**
 * Glyph outlines, resolved ONCE per (font, character) at a reference size and
 * memoised. Everything else is a transform.
 *
 * This is not just a speed optimisation, it is the fix for a real defect.
 * opentype.js corrupts its own cached glyph state across repeated getPath()
 * calls and starts returning NaN coordinates — 'g' in Outfit-Bold survives a
 * few hundred calls and then fails even at the origin. Because an SVG parser
 * halts at the first invalid token and still renders everything before it, the
 * symptom is a silently truncated word, never an error: the contact sheet's
 * title came out as "Turnos — wail". Calling getPath exactly once per glyph
 * means the corruption never has a chance to develop.
 */
const REF = 1000;
const _glyphs = new Map();
function glyphOutline(fontName, ch) {
  // Separator is '|' rather than a NUL. A literal NUL byte in the source makes
  // git classify the whole file as binary — no diffs, no blame, no history.
  // `ch` is always a single character and font names never contain '|', so
  // there is no collision to guard against.
  const key = fontName + '|' + ch;
  if (!_glyphs.has(key)) {
    const g = font(fontName).charToGlyph(ch);
    const d = g.getPath(0, 0, REF).toPathData(4);
    if (d.includes('NaN')) {
      throw new Error(`NaN outline for ${JSON.stringify(ch)} in ${fontName}`);
    }
    _glyphs.set(key, d);
  }
  return _glyphs.get(key);
}

/**
 * Lay out a string as glyph outlines with optical tracking and real kerning.
 * Returns path data plus the measured advance so callers can centre precisely.
 */
function layout(fontName, text, size, tracking = 0) {
  const f = font(fontName);
  const scale = size / f.unitsPerEm;

  // Deliberately NOT font.stringToGlyphs(). That runs the OpenType feature
  // engine, which throws on GSUB lookup formats opentype.js does not implement
  // (an em-dash triggers a ccmp lookup in Outfit; Bauhaus 93's ligature table
  // does the same). Mapping characters directly never enters that code path.
  // The cost is ligatures and contextual alternates, which this campaign does
  // not use; kerning is applied explicitly below.
  const glyphs = Array.from(text).map((ch) => f.charToGlyph(ch));
  // Outlines are cached at REF; scale at draw time. NOT r() here — that rounds
  // to 2dp and would turn a 0.034 scale into 0.03, a 12% error in type size.
  const k = Math.round((size / REF) * 1e6) / 1e6;
  let x = 0;
  const parts = [];

  const chars = Array.from(text);
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (i > 0) {
      const k = f.getKerningValue(glyphs[i - 1], g);
      if (Number.isFinite(k)) x += k * scale;
    }

    const d = glyphOutline(fontName, chars[i]);
    if (d) parts.push(`<path d="${d}" transform="translate(${r(x)} 0) scale(${k})"/>`);
    x += g.advanceWidth * scale + tracking;
  }
  if (glyphs.length) x -= tracking; // trailing tracking is not part of the mark

  // `svg` is a run of positioned <path> elements; the caller supplies fill.
  return { svg: parts.join(''), width: x };
}

function measure(fontName, text, size, tracking = 0) {
  return layout(fontName, text, size, tracking).width;
}

/**
 * Emit a positioned run of text as a <path>. `anchor` is start | middle | end.
 */
function text(fontName, str, { x, y, size, tracking = 0, fill = C.paper, anchor = 'start', opacity = 1 }) {
  const { svg, width } = layout(fontName, str, size, tracking);
  if (!svg) return '';
  let dx = x;
  if (anchor === 'middle') dx = x - width / 2;
  else if (anchor === 'end') dx = x - width;
  const o = opacity === 1 ? '' : ` opacity="${opacity}"`;
  return `<g transform="translate(${r(dx)} ${r(y)})" fill="${fill}"${o}>${svg}</g>`;
}

/** Greedy wrap on measured advance width. Returns an array of lines. */
function wrap(fontName, str, size, maxWidth, tracking = 0) {
  const words = str.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (line && measure(fontName, trial, size, tracking) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A block of wrapped text; returns svg plus the height it consumed. */
function block(fontName, str, { x, y, size, leading, maxWidth, fill = C.paper, tracking = 0, anchor = 'start', opacity = 1 }) {
  const lines = Array.isArray(str) ? str : wrap(fontName, str, size, maxWidth, tracking);
  const svg = lines
    .map((l, i) => text(fontName, l, { x, y: y + i * leading, size, tracking, fill, anchor, opacity }))
    .join('\n');
  return { svg, height: (lines.length - 1) * leading, lines: lines.length };
}

// ---------------------------------------------------------------- helpers
const r = (n) => Math.round(n * 100) / 100;

/** Deterministic PRNG — same composition every run, no drift between builds. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The recurring motif: a field of small marks whose weight is graded by
 * distance from a focus. The accumulation is the message; one mark is lit.
 */
function dotField({ x, y, w, h, step, focus, seed = 7, base = 0.13, fill = C.paper, jitter = 0.18, maxR = 2.1 }) {
  const rand = rng(seed);
  const cols = Math.floor(w / step);
  const rows = Math.floor(h / step);
  const offX = x + (w - (cols - 1) * step) / 2;
  const offY = y + (h - (rows - 1) * step) / 2;
  const maxD = Math.hypot(w, h) / 2;
  const out = [];

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = offX + i * step + (rand() - 0.5) * step * jitter;
      const py = offY + j * step + (rand() - 0.5) * step * jitter;
      let o = base;
      let rad = 1.5;
      if (focus) {
        const d = Math.hypot(px - focus.x, py - focus.y) / maxD;
        const t = 1 - Math.min(1, d / (focus.reach || 0.55));
        o = base + easeInOut(Math.max(0, t)) * (focus.peak || 0.5);
        rad = 1.35 + easeInOut(Math.max(0, t)) * (maxR - 1.35);
      }
      if (o < 0.035) continue;
      out.push(`<circle cx="${r(px)}" cy="${r(py)}" r="${r(rad)}" fill="${fill}" opacity="${r(o)}"/>`);
    }
  }
  return out.join('');
}

/** Hairline rule — the movement's only structural ornament. */
function rule(x1, y1, x2, y2, { stroke = C.paper, opacity = 0.16, width = 1 } = {}) {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}"/>`;
}

// ---------------------------------------------------------------- logo
/**
 * The wordmark, recoloured to a flat tone by using its own alpha as a mask.
 * Keeps the campaign strictly monochromatic without needing a new asset.
 */
async function logoDataURI(hex, targetWidth) {
  const src = path.join(REPO, 'apps/web-admin/public/logo.png');
  const meta = await sharp(src).metadata();
  const h = Math.round((meta.height / meta.width) * targetWidth);
  const alpha = await sharp(src).resize(targetWidth, h).ensureAlpha().extractChannel('alpha').toBuffer();
  const { r: rr, g: gg, b: bb } = hexToRgb(hex);
  const buf = await sharp({
    create: { width: targetWidth, height: h, channels: 3, background: { r: rr, g: gg, b: bb } },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return { uri: 'data:image/png;base64,' + buf.toString('base64'), width: targetWidth, height: h };
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

// ---------------------------------------------------------------- output
async function render(svg, outPath, w, h, opts = {}) {
  // Motifs are authored in a normalised 100-unit box, so they need their own
  // viewBox rather than the pixel-space default the ad compositions use.
  const viewBox = opts.viewBox || `0 0 ${w} ${h}`;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${viewBox}">${svg}</svg>`;
  // Last line of defence: one NaN silently truncates the path containing it.
  // Scope the check to d="…" attributes — base64 image payloads legitimately
  // contain the letters "NaN" and a naive whole-document scan false-positives.
  const badPath = /\sd="[^"]*NaN/.exec(doc);
  if (badPath) {
    throw new Error(`NaN in path data for ${outPath} — near: ${doc.slice(badPath.index, badPath.index + 90)}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // The composition is authored at exact pixel dimensions, so the SVG must
  // rasterise 1:1. sharp scales SVG input by density/72 — leaving the default
  // 300 here rendered a 1080px canvas at 4500px and took minutes per file.
  // resize() is belt-and-braces in case a caller passes a mismatched viewBox.
  await sharp(Buffer.from(doc), { density: 72 })
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

module.exports = {
  C, DISPLAY, BOOK, MONO,
  text, block, wrap, measure, layout,
  dotField, rule, rng, easeInOut, r,
  logoDataURI, render, REPO,
};
