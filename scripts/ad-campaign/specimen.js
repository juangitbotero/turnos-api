const L = require('./lib.js');
const { line, signal } = require('./icons.js');

const lineNames = Object.keys(line);
const sigNames = Object.keys(signal);
const cell = 150, gap = 22, cols = 6, M = 50;
const rowsL = Math.ceil(lineNames.length / cols);
const rowsS = Math.ceil(sigNames.length / cols);
const W = M * 2 + cols * cell + (cols - 1) * gap;
const topL = 130;
const topS = topL + rowsL * (cell + 46) + 70;
const H = topS + rowsS * (cell + 46) + M;

function tile(name, body, x, y, dark) {
  return `
    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="14" fill="${dark ? '#14141F' : '#F2F4F8'}"/>
    <g transform="translate(${x + cell * 0.16} ${y + cell * 0.16}) scale(${(cell * 0.68) / 100})">${body}</g>
    ${L.text(L.MONO, name, { x: x, y: y + cell + 26, size: 13, tracking: 0.9, fill: '#14141F', opacity: 0.62 })}`;
}

const tiles = [];
lineNames.forEach((n, i) => {
  const x = M + (i % cols) * (cell + gap);
  const y = topL + Math.floor(i / cols) * (cell + 46);
  tiles.push(tile(n, line[n]('#6A79FF', 5), x, y, false));
});
sigNames.forEach((n, i) => {
  const x = M + (i % cols) * (cell + gap);
  const y = topS + Math.floor(i / cols) * (cell + 46);
  const body = n === 'field' ? signal.field('#FAFDFF', 5) : signal[n]('#6A79FF', '#FAFDFF', 5);
  tiles.push(tile(n, body, x, y, true));
});

const svg = `
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${L.text('Outfit-Bold', 'Turnos graphics library', { x: M, y: 60, size: 32, tracking: -0.4, fill: '#14141F' })}
  ${L.text(L.MONO, 'LINE FAMILY — DRAWN, MONOLINE', { x: M, y: 100, size: 13, tracking: 1.4, fill: '#14141F', opacity: 0.5 })}
  ${L.text(L.MONO, 'SIGNAL FAMILY — ABSTRACT MARKS', { x: M, y: topS - 30, size: 13, tracking: 1.4, fill: '#14141F', opacity: 0.5 })}
  ${tiles.join('\n')}`;

L.render(svg, 'graphics-specimen.png', W, H).then(p => console.log('wrote', p, W + 'x' + H));
