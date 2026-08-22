const L = require('./lib.js');
const { line, signal } = require('./icons.js');
const fs = require('fs');
const path = require('path');

const OUT = require('path').join(require('./lib.js').REPO, 'docs', 'brand', 'ad-campaign', 'graphics');
const PX = 512;      // raster size; SVG is resolution-independent
const PAD = 6;       // breathing room inside the box, in the 100-unit space

// Line family: one hue each, transparent ground.
const LINE_WAYS = {
  blue:  '#6A79FF',
  ink:   '#14141F',
  white: '#FAFDFF',
};
// Signal family needs two tones — the lit mark and the field around it.
const SIGNAL_WAYS = {
  'on-dark':  { accent: '#6A79FF', pale: '#FAFDFF' },
  'on-light': { accent: '#6A79FF', pale: '#14141F' },
};

function doc(body) {
  // viewBox is the authored 100-unit space, padded so round caps never clip.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${100 + PAD * 2} ${100 + PAD * 2}" width="${PX}" height="${PX}">${body}</svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;

  for (const [name, fn] of Object.entries(line)) {
    for (const [way, hex] of Object.entries(LINE_WAYS)) {
      const body = fn(hex, 5);
      const base = path.join(OUT, `${name}_${way}`);
      fs.writeFileSync(base + '.svg', doc(body));
      await L.render(body, base + '.png', PX, PX, { viewBox: `${-PAD} ${-PAD} ${100 + PAD * 2} ${100 + PAD * 2}` });
      n += 2;
    }
  }

  for (const [name, fn] of Object.entries(signal)) {
    for (const [way, { accent, pale }] of Object.entries(SIGNAL_WAYS)) {
      const body = name === 'field' ? fn(pale, 5) : fn(accent, pale, 5);
      const base = path.join(OUT, `${name}_${way}`);
      fs.writeFileSync(base + '.svg', doc(body));
      await L.render(body, base + '.png', PX, PX, { viewBox: `${-PAD} ${-PAD} ${100 + PAD * 2} ${100 + PAD * 2}` });
      n += 2;
    }
  }

  console.log(`wrote ${n} files (${n / 2} PNG + ${n / 2} SVG) to ${OUT}/`);
})();
