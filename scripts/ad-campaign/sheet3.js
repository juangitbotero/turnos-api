const L = require('./lib.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const dir = path.join(L.REPO, 'docs/brand/ad-campaign/03-in-hand');

(async () => {
  const files = fs.readdirSync(dir).filter(f => f.includes('1080x1080')).sort();
  const cell = 300, gap = 26, cols = 4, M = 52, top = 128;
  const rows = Math.ceil(files.length / cols);
  const W = M * 2 + cols * cell + (cols - 1) * gap;
  const H = top + rows * (cell + 56) + gap * (rows - 1) + M;
  const tiles = [];
  for (let i = 0; i < files.length; i++) {
    const cx = M + (i % cols) * (cell + gap);
    const cy = top + Math.floor(i / cols) * (cell + 56 + gap);
    const buf = await sharp(path.join(dir, files[i])).resize(cell, cell).png().toBuffer();
    tiles.push(`<rect x="${cx - 1}" y="${cy - 1}" width="${cell + 2}" height="${cell + 2}" fill="#E6E8EF"/>`);
    tiles.push(`<image x="${cx}" y="${cy}" width="${cell}" height="${cell}" xlink:href="data:image/png;base64,${buf.toString('base64')}"/>`);
    tiles.push(L.text('GeistMono-Regular', files[i].split('_')[0].toUpperCase(), { x: cx, y: cy + cell + 26, size: 12, tracking: 1, fill: '#14141F', opacity: 0.62 }));
  }
  const svg = `<rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${L.text('Outfit-Bold', 'Turnos — in hand', { x: M, y: 62, size: 34, tracking: -0.5, fill: '#14141F' })}
    ${L.text('GeistMono-Regular', 'DIRECTION 3  ·  12 VARIANTS  ·  REAL APP UI WITH DETAIL CALLOUTS', { x: M, y: 94, size: 14, tracking: 1.4, fill: '#14141F', opacity: 0.5 })}
    ${tiles.join('\n')}`;
  await L.render(svg, path.join(dir, '_contact-sheet.png'), W, H);
  console.log('wrote contact sheet', W + 'x' + H);
})();
