'use strict';
/**
 * Turnos campaign graphics.
 *
 * Every motif is authored in a normalised 100×100 box and drawn with STROKES,
 * not fills, so one definition scales from a 40px chip to a 900px hero without
 * redrawing. Colour and weight are parameters, never baked in.
 *
 * Two families:
 *   · line/*   hand-drawn monoline illustration — the trade, the shift, the city
 *   · signal/* the abstract marks from Direction 1 (the lit dot, the field)
 *
 * The drawn family carries a deliberate small irregularity: control points sit
 * a fraction off true, so arcs breathe the way a marker does. Perfectly
 * circular curves read as clip-art; these should read as drawn by a person who
 * knew exactly where the line was going.
 */

const { r } = require('./lib.js');

/** Stroke defaults shared by the drawn family. */
function S(stroke, sw, extra = '') {
  return `fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}`;
}

// ---------------------------------------------------------------- line family

const line = {
  /** Coffee cup on a saucer, two ribbons of steam. The café on your street. */
  cup: (c, sw) => `
    <path d="M22 44 L22 62 Q22 76 36 76 L54 76 Q68 76 68 62 L68 44 Z" ${S(c, sw)}/>
    <path d="M68 49 L76 49 Q86 49 86 57 Q86 65 76 65 L68 65" ${S(c, sw)}/>
    <path d="M16 82 L80 82" ${S(c, sw)}/>
    <path d="M36 32 Q31 26 36 20 Q41 14 36 9" ${S(c, sw * 0.86)}/>
    <path d="M52 32 Q47 26 52 20 Q57 14 52 9" ${S(c, sw * 0.86)}/>`,

  /** Martini glass. The bar at 6pm. */
  cocktail: (c, sw) => `
    <path d="M18 24 L50 60 L82 24 Z" ${S(c, sw)}/>
    <path d="M50 60 L50 82" ${S(c, sw)}/>
    <path d="M34 84 L66 84" ${S(c, sw)}/>
    <path d="M62 20 Q70 12 78 15" ${S(c, sw * 0.8)}/>
    <circle cx="78" cy="14" r="${r(sw * 1.5)}" fill="${c}"/>`,

  /** Cloche over a plate. The restaurant service. */
  cloche: (c, sw) => `
    <path d="M18 66 Q18 34 50 34 Q82 34 82 66" ${S(c, sw)}/>
    <path d="M12 66 L88 66" ${S(c, sw)}/>
    <path d="M28 78 L72 78" ${S(c, sw)}/>
    <path d="M50 34 L50 26" ${S(c, sw)}/>
    <circle cx="50" cy="22" r="${r(sw * 1.6)}" ${S(c, sw * 0.9)}/>`,

  /** Chef's hat. The kitchen. */
  chefHat: (c, sw) => `
    <path d="M30 56 Q16 54 16 40 Q16 27 30 27 Q32 15 50 15 Q68 15 70 27 Q84 27 84 40 Q84 54 70 56" ${S(c, sw)}/>
    <path d="M30 56 L30 80 Q30 84 34 84 L66 84 Q70 84 70 80 L70 56" ${S(c, sw)}/>
    <path d="M30 66 L70 66" ${S(c, sw * 0.85)}/>`,

  /**
   * Round tray carrying a bottle and a glass. Drawn large and simple: the first
   * version used thin trapezoids for the glassware and read as a blob at any
   * size below about 120px.
   */
  tray: (c, sw) => `
    <ellipse cx="50" cy="74" rx="40" ry="10" ${S(c, sw)}/>
    <path d="M40 30 L40 40 Q34 46 34 54 L34 68 Q34 71 37 71 L49 71 Q52 71 52 68 L52 54 Q52 46 46 40 L46 30 Z" ${S(c, sw * 0.95)}/>
    <path d="M60 44 L78 44 L74 71 L64 71 Z" ${S(c, sw * 0.95)}/>
    <path d="M38 24 L48 24" ${S(c, sw * 0.9)}/>`,

  /** Map pin. Near you. */
  pin: (c, sw) => `
    <path d="M50 88 Q22 58 22 40 Q22 14 50 14 Q78 14 78 40 Q78 58 50 88 Z" ${S(c, sw)}/>
    <circle cx="50" cy="39" r="12" ${S(c, sw)}/>`,

  /** Clock. The hours, known up front. */
  clock: (c, sw) => `
    <circle cx="50" cy="50" r="36" ${S(c, sw)}/>
    <path d="M50 26 L50 50 L67 60" ${S(c, sw)}/>
    <path d="M50 10 L50 15 M90 50 L85 50 M50 90 L50 85 M10 50 L15 50" ${S(c, sw * 0.8)}/>`,

  /** QR mark. One scan and you're in. */
  qr: (c, sw) => `
    <rect x="14" y="14" width="26" height="26" rx="5" ${S(c, sw)}/>
    <rect x="60" y="14" width="26" height="26" rx="5" ${S(c, sw)}/>
    <rect x="14" y="60" width="26" height="26" rx="5" ${S(c, sw)}/>
    <path d="M60 60 L60 74 M74 60 L86 60 M60 86 L74 86 M86 72 L86 86" ${S(c, sw)}/>
    <circle cx="27" cy="27" r="${r(sw * 1.7)}" fill="${c}"/>
    <circle cx="73" cy="27" r="${r(sw * 1.7)}" fill="${c}"/>
    <circle cx="27" cy="73" r="${r(sw * 1.7)}" fill="${c}"/>`,

  /** Calendar with one day marked. Your schedule, your call. */
  calendar: (c, sw) => `
    <rect x="14" y="22" width="72" height="64" rx="8" ${S(c, sw)}/>
    <path d="M14 42 L86 42" ${S(c, sw)}/>
    <path d="M32 14 L32 30 M68 14 L68 30" ${S(c, sw)}/>
    <circle cx="50" cy="62" r="10" fill="${c}"/>
    <path d="M26 62 L30 62 M70 62 L74 62 M26 76 L34 76 M46 76 L54 76 M66 76 L74 76" ${S(c, sw * 0.8)}/>`,

  /** Euro coin. Full gross, straight from the company. */
  coin: (c, sw) => `
    <circle cx="50" cy="50" r="36" ${S(c, sw)}/>
    <path d="M64 36 Q52 28 44 38 Q38 46 38 50 Q38 54 44 62 Q52 72 64 64" ${S(c, sw)}/>
    <path d="M30 45 L54 45 M30 55 L54 55" ${S(c, sw * 0.85)}/>`,

  /** Apron. Turning up for the trade. */
  apron: (c, sw) => `
    <path d="M36 16 Q36 30 50 30 Q64 30 64 16" ${S(c, sw)}/>
    <path d="M36 16 L26 22 Q18 26 18 38 L18 76 Q18 86 28 86 L72 86 Q82 86 82 76 L82 38 Q82 26 74 22 L64 16" ${S(c, sw)}/>
    <path d="M28 58 L72 58" ${S(c, sw * 0.85)}/>
    <path d="M18 40 L6 44 M82 40 L94 44" ${S(c, sw * 0.85)}/>`,

  /**
   * Phone showing a shift card. The product itself.
   * (This slot first held a service bell, which drew as the same dome-and-line
   * as `cloche` — two motifs that render identically are one motif.)
   */
  phone: (c, sw) => `
    <rect x="26" y="8" width="48" height="84" rx="9" ${S(c, sw)}/>
    <path d="M43 15 L57 15" ${S(c, sw * 0.85)}/>
    <rect x="34" y="28" width="32" height="24" rx="4" ${S(c, sw * 0.85)}/>
    <path d="M39 37 L55 37 M39 44 L49 44" ${S(c, sw * 0.7)}/>
    <path d="M34 62 L58 62 M34 71 L52 71" ${S(c, sw * 0.7)}/>
    <circle cx="62" cy="78" r="${r(sw * 1.5)}" fill="${c}"/>`,

  /** Star. Reputation — the thing that gets you picked next time. */
  star: (c, sw) => `
    <path d="M50 12 L62 39 L91 42 L69 61 L76 89 L50 74 L24 89 L31 61 L9 42 L38 39 Z" ${S(c, sw)}/>`,

  // ---- the reasons (Direction 4) — who the worker is when not on shift ----

  /**
   * Surfboard, tilted, over a swell. Training in the water every morning.
   * Wide, parallel rails and a full-length stringer. Two earlier versions read
   * as a leaf and then a quill — a tapered tail, or fins drawn as short
   * strokes, both look like a stem at small sizes.
   */
  surfboard: (c, sw) => `
    <g transform="rotate(20 50 44)">
      <path d="M50 4 Q69 10 69 40 L69 70 Q69 84 50 86 Q31 84 31 70 L31 40 Q31 10 50 4 Z" ${S(c, sw)}/>
      <path d="M50 10 L50 80" ${S(c, sw * 0.6)}/>
    </g>
    <path d="M6 92 Q17 84 28 92 Q39 100 50 92 Q61 84 72 92" ${S(c, sw * 0.85)}/>`,

  /** Open book. Exams, a degree, the week that belongs to studying. */
  book: (c, sw) => `
    <path d="M50 28 Q34 18 12 22 L12 78 Q34 74 50 84 Q66 74 88 78 L88 22 Q66 18 50 28 Z" ${S(c, sw)}/>
    <path d="M50 28 L50 84" ${S(c, sw)}/>
    <path d="M22 38 Q32 36 40 40 M22 50 Q32 48 40 52 M60 40 Q68 36 78 38 M60 52 Q68 48 78 50" ${S(c, sw * 0.7)}/>`,

  /** Painter's palette. The art the shifts are paying for. */
  palette: (c, sw) => `
    <path d="M50 14 Q86 14 88 46 Q90 66 72 66 Q62 66 64 76 Q66 88 50 88 Q14 88 12 52 Q12 14 50 14 Z" ${S(c, sw)}/>
    <circle cx="30" cy="42" r="${r(sw * 1.5)}" fill="${c}"/>
    <circle cx="46" cy="28" r="${r(sw * 1.5)}" fill="${c}"/>
    <circle cx="66" cy="32" r="${r(sw * 1.5)}" fill="${c}"/>
    <circle cx="36" cy="66" r="7" ${S(c, sw * 0.85)}/>`,

  /** Two beamed notes. The gig on Saturday. */
  note: (c, sw) => `
    <path d="M36 74 L36 24 L78 14 L78 64" ${S(c, sw)}/>
    <path d="M36 36 L78 26" ${S(c, sw)}/>
    <ellipse cx="27" cy="75" rx="10" ry="7" transform="rotate(-18 27 75)" fill="${c}"/>
    <ellipse cx="69" cy="65" rx="10" ry="7" transform="rotate(-18 69 65)" fill="${c}"/>`,

  /** Dumbbell. Training for something that comes first. */
  dumbbell: (c, sw) => `
    <path d="M30 50 L70 50" ${S(c, sw)}/>
    <rect x="12" y="32" width="10" height="36" rx="3" ${S(c, sw)}/>
    <rect x="22" y="38" width="8" height="24" rx="2" ${S(c, sw)}/>
    <rect x="78" y="32" width="10" height="36" rx="3" ${S(c, sw)}/>
    <rect x="70" y="38" width="8" height="24" rx="2" ${S(c, sw)}/>`,

  /** Sun over the water. Moved to Lisbon for the light. */
  sun: (c, sw) => `
    <circle cx="50" cy="42" r="15" ${S(c, sw)}/>
    <path d="M50 12 L50 19 M50 65 L50 72 M20 42 L27 42 M73 42 L80 42 M29 21 L34 26 M66 58 L71 63 M71 21 L66 26 M34 58 L29 63" ${S(c, sw * 0.85)}/>
    <path d="M10 84 Q20 78 30 84 Q40 90 50 84 Q60 78 70 84 Q80 90 90 84" ${S(c, sw)}/>`,

  /** Laptop. The remote job that closes at five. */
  laptop: (c, sw) => `
    <rect x="20" y="22" width="60" height="42" rx="5" ${S(c, sw)}/>
    <path d="M10 72 L90 72 L84 80 L16 80 Z" ${S(c, sw)}/>
    <path d="M44 76 L56 76" ${S(c, sw * 0.7)}/>`,

  /** Camera. Shoots on weekdays. */
  camera: (c, sw) => `
    <rect x="12" y="32" width="76" height="50" rx="8" ${S(c, sw)}/>
    <path d="M34 32 L40 22 L60 22 L66 32" ${S(c, sw)}/>
    <circle cx="50" cy="57" r="15" ${S(c, sw)}/>
    <circle cx="50" cy="57" r="6" ${S(c, sw * 0.8)}/>
    <circle cx="76" cy="42" r="${r(sw * 1.3)}" fill="${c}"/>`,

  /** School backpack. The school run at three. */
  backpack: (c, sw) => `
    <path d="M42 22 Q42 12 50 12 Q58 12 58 22" ${S(c, sw)}/>
    <path d="M24 40 Q24 22 50 22 Q76 22 76 40 L76 82 Q76 88 70 88 L30 88 Q24 88 24 82 Z" ${S(c, sw)}/>
    <rect x="34" y="56" width="32" height="22" rx="4" ${S(c, sw * 0.9)}/>
    <path d="M34 64 L66 64" ${S(c, sw * 0.8)}/>`,

  /** Light bulb. Building something of your own. */
  bulb: (c, sw) => `
    <path d="M36 60 Q22 50 22 36 Q22 12 50 12 Q78 12 78 36 Q78 50 64 60 L64 68 L36 68 Z" ${S(c, sw)}/>
    <path d="M38 77 L62 77 M42 86 L58 86" ${S(c, sw)}/>
    <path d="M43 52 L50 38 L57 52" ${S(c, sw * 0.75)}/>`,

  /** Plane, climbing. The trip in August. */
  plane: (c, sw) => `
    <g transform="rotate(45 50 50)">
      <path d="M50 8 Q56 8 56 20 L56 40 L88 58 L88 66 L56 56 L56 76 L66 84 L66 90 L50 86 L34 90 L34 84 L44 76 L44 56 L12 66 L12 58 L44 40 L44 20 Q44 8 50 8 Z" ${S(c, sw)}/>
    </g>`,

  /** Sofa. Just a free Saturday — reason enough. */
  sofa: (c, sw) => `
    <path d="M20 48 L20 38 Q20 28 30 28 L70 28 Q80 28 80 38 L80 48" ${S(c, sw)}/>
    <path d="M12 54 Q12 46 19 46 Q26 46 26 54 L26 60 L74 60 L74 54 Q74 46 81 46 Q88 46 88 54 L88 74 L12 74 Z" ${S(c, sw)}/>
    <path d="M20 74 L20 82 M80 74 L80 82" ${S(c, sw)}/>`,

  /** Reading glasses. Retired from the job, not from people. */
  glasses: (c, sw) => `
    <circle cx="30" cy="56" r="14" ${S(c, sw)}/>
    <circle cx="70" cy="56" r="14" ${S(c, sw)}/>
    <path d="M44 54 Q50 47 56 54" ${S(c, sw)}/>
    <path d="M16 52 L8 38 M84 52 L92 38" ${S(c, sw)}/>`,
};

// -------------------------------------------------------------- signal family

const signal = {
  /**
   * The lit mark: one accent dot, two rings, and the field of smaller pale
   * points around it. This is the graphic from concept A.
   */
  dot: (accent, pale, sw) => {
    const pts = [
      [26, 22], [50, 14], [74, 24], [86, 46], [80, 72], [58, 86],
      [32, 82], [16, 62], [20, 38], [66, 66], [36, 62], [64, 34],
    ];
    return `
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r(sw * 0.9)}" fill="${pale}" opacity="${r(0.28 + ((x + y) % 7) * 0.055)}"/>`).join('')}
      <circle cx="50" cy="50" r="24" ${S(accent, sw * 0.55, 'stroke-opacity="0.20"')}/>
      <circle cx="50" cy="50" r="14" ${S(accent, sw * 0.7, 'stroke-opacity="0.45"')}/>
      <circle cx="50" cy="50" r="${r(sw * 2.6)}" fill="${accent}"/>`;
  },

  /** Concentric proximity rings with scattered readings. Concept E. */
  radar: (accent, pale, sw) => {
    const pts = [[30, 34], [68, 30], [78, 56], [56, 76], [28, 66], [44, 22], [84, 42], [22, 50], [62, 58], [40, 80]];
    return `
      ${[10, 18, 26, 34, 42].map((rad, i) => `<circle cx="50" cy="50" r="${rad}" ${S(pale, sw * 0.5, `stroke-opacity="${r(0.34 - i * 0.055)}"`)}/>`).join('')}
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r(sw * 0.8)}" fill="${pale}" opacity="0.62"/>`).join('')}
      <circle cx="50" cy="50" r="${r(sw * 2.4)}" fill="${accent}"/>`;
  },

  /** Graded field of marks — the city, unevenly lit. */
  field: (pale, sw) => {
    const out = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const x = 8 + i * 10.5;
        const y = 8 + j * 10.5;
        const d = Math.hypot(x - 62, y - 32) / 70;
        const o = Math.max(0.09, 0.85 - d * 1.5);
        out.push(`<circle cx="${x}" cy="${y}" r="${r(sw * (0.55 + o * 0.5))}" fill="${pale}" opacity="${r(o)}"/>`);
      }
    }
    return out.join('');
  },

  /** The noise you already live with, and the one clean line. Concept C. */
  noise: (accent, pale, sw) => {
    const rows = [[10, 34], [16, 52], [12, 40], [22, 60], [14, 46], [24, 38]];
    const bars = rows.map(([x, w], i) =>
      `<rect x="${x}" y="${14 + i * 9}" width="${w}" height="${r(sw * 1.5)}" rx="${r(sw * 0.75)}" fill="${pale}" opacity="${r(0.18 + i * 0.09)}"/>` +
      `<rect x="${x + w + 6}" y="${14 + i * 9}" width="${r(w * 0.6)}" height="${r(sw * 1.5)}" rx="${r(sw * 0.75)}" fill="${pale}" opacity="${r(0.14 + i * 0.07)}"/>`
    );
    return `${bars.join('')}<rect x="10" y="78" width="80" height="${r(sw * 1.9)}" rx="${r(sw)}" fill="${accent}"/>`;
  },
};

module.exports = { line, signal, S };
