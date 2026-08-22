'use strict';
/**
 * Direction 3 — "In Hand".
 *
 * The product itself, with one detail magnified. Same skeleton and palette as
 * the other two directions; the mark becomes a real screen.
 *
 * The device is DRAWN, not photographed — a monoline frame in the same language
 * as the icon library. A photoreal mockup would drag in gradients, reflections
 * and shadow, which is the exact register this system is defined against.
 *
 * Callout crops are expressed as FRACTIONS of the source image, never pixels,
 * so a screenshot re-exported at a different device resolution still lands on
 * the right control.
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const L = require('../lib.js');
const { C, MONO, r } = L;

const HEAD = 'Outfit-Bold';
const BOOK = 'Outfit-Regular';

const SHOTS = path.join(L.REPO, 'docs', 'brand', 'ad-campaign', 'screenshots');

const GROUNDS = {
  paper: { bg: '#FAFDFF', ink: '#14141F' },
  tint:  { bg: '#EEF0FF', ink: '#14141F' },
  ink:   { bg: '#14141F', ink: '#FAFDFF' },
};

/** Load a screenshot once; returns a data URI plus its true pixel size. */
const _shots = new Map();
async function shot(file) {
  if (!_shots.has(file)) {
    const p = path.join(SHOTS, file);
    if (!fs.existsSync(p)) throw new Error(`missing screenshot: ${path.relative(L.REPO, p)}`);
    const buf = await sharp(p).png().toBuffer();
    const m = await sharp(buf).metadata();
    _shots.set(file, { uri: 'data:image/png;base64,' + buf.toString('base64'), w: m.width, h: m.height });
  }
  return _shots.get(file);
}

/**
 * Magnified crop of a region, as its own data URI.
 * `rect` is {x, y, w, h} in 0..1 fractions of the source image.
 */
async function crop(file, rect, outW) {
  const p = path.join(SHOTS, file);
  const m = await sharp(p).metadata();
  const left = Math.max(0, Math.round(rect.x * m.width));
  const top = Math.max(0, Math.round(rect.y * m.height));
  const width = Math.min(m.width - left, Math.round(rect.w * m.width));
  const height = Math.min(m.height - top, Math.round(rect.h * m.height));
  const buf = await sharp(p)
    .extract({ left, top, width, height })
    .resize(outW, null, { kernel: 'lanczos3' })   // upscale sharply, not softly
    .png()
    .toBuffer();
  const om = await sharp(buf).metadata();
  return { uri: 'data:image/png;base64,' + buf.toString('base64'), w: om.width, h: om.height };
}

/**
 * Drawn phone frame holding a screen image.
 * `h` is the outer height; width follows a 9:19.5 device ratio.
 */
function phone({ id, x, y, h, img, stroke, sw }) {
  const w = h * (9 / 19.5);
  const pad = w * 0.028;              // bezel
  const rad = w * 0.115;
  const sx = x + pad;
  const sy = y + pad;
  const sw2 = w - pad * 2;
  const sh = h - pad * 2;
  const srad = rad - pad * 0.6;

  // Cover-fit the screenshot into the screen aperture.
  const scale = Math.max(sw2 / img.w, sh / img.h);
  const iw = img.w * scale;
  const ih = img.h * scale;
  const ix = sx + (sw2 - iw) / 2;
  const iy = sy;                       // anchor to the top — headers matter most

  return {
    w,
    screen: { x: sx, y: sy, w: sw2, h: sh },
    svg: `
      <defs><clipPath id="scr-${id}"><rect x="${r(sx)}" y="${r(sy)}" width="${r(sw2)}" height="${r(sh)}" rx="${r(srad)}"/></clipPath></defs>
      <rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(rad)}" fill="none" stroke="${stroke}" stroke-width="${r(sw)}"/>
      <g clip-path="url(#scr-${id})"><image x="${r(ix)}" y="${r(iy)}" width="${r(iw)}" height="${r(ih)}" xlink:href="${img.uri}"/></g>
      <rect x="${r(x + w * 0.34)}" y="${r(y - sw * 0.5)}" width="${r(w * 0.32)}" height="${r(w * 0.055)}" rx="${r(w * 0.028)}" fill="${stroke}"/>`,
  };
}

/**
 * A magnified detail, hung beside the device and tied back to its source with a
 * ring and a connector. The ring is drawn on the phone at the true location of
 * the crop, so the reader can see where the detail came from.
 */
function callout({ det, at, srcRect, screen, accent, sw, ground }) {
  const cardW = det.w;
  const cardH = det.h;
  const pad = sw * 1.6;

  // True centre of the cropped region, in canvas space.
  const cx = screen.x + (srcRect.x + srcRect.w / 2) * screen.w;
  const cy = screen.y + (srcRect.y + srcRect.h / 2) * screen.h;
  const ringW = srcRect.w * screen.w;
  const ringH = srcRect.h * screen.h;

  // Connector meets the card on whichever side faces the device.
  const cardCx = at.x + cardW / 2;
  const anchorX = cardCx > cx ? at.x : at.x + cardW;
  const anchorY = at.y + cardH / 2;
  const edgeX = cardCx > cx ? cx + ringW / 2 : cx - ringW / 2;

  return `
    <rect x="${r(cx - ringW / 2 - pad * 0.4)}" y="${r(cy - ringH / 2 - pad * 0.4)}"
          width="${r(ringW + pad * 0.8)}" height="${r(ringH + pad * 0.8)}" rx="${r(pad)}"
          fill="none" stroke="${accent}" stroke-width="${r(sw * 0.5)}"/>
    <path d="M${r(edgeX)} ${r(cy)} L${r(anchorX)} ${r(anchorY)}" fill="none"
          stroke="${accent}" stroke-width="${r(sw * 0.4)}" stroke-dasharray="${r(sw * 1.2)} ${r(sw * 1.2)}" stroke-opacity="0.75"/>
    <circle cx="${r(edgeX)}" cy="${r(cy)}" r="${r(sw * 0.7)}" fill="${accent}"/>
    <rect x="${r(at.x - pad * 0.5)}" y="${r(at.y - pad * 0.5)}" width="${r(cardW + pad)}" height="${r(cardH + pad)}"
          rx="${r(pad * 1.4)}" fill="${ground.bg}" stroke="${accent}" stroke-width="${r(sw * 0.5)}"/>
    <defs><clipPath id="co-${r(at.x)}-${r(at.y)}"><rect x="${r(at.x)}" y="${r(at.y)}" width="${r(cardW)}" height="${r(cardH)}" rx="${r(pad)}"/></clipPath></defs>
    <g clip-path="url(#co-${r(at.x)}-${r(at.y)})"><image x="${r(at.x)}" y="${r(at.y)}" width="${r(cardW)}" height="${r(cardH)}" xlink:href="${det.uri}"/></g>`;
}

/** Shared furniture — identical to the other two directions. */
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

module.exports = { shot, crop, phone, callout, frame, GROUNDS, SHOTS, HEAD, BOOK };
