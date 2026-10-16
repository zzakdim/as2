// Background scenes: one soft, dark illustration per place, drawn as SVG and handed to CSS as
// custom properties (--scene-yard, --scene-w1 … --scene-w5). Low contrast on purpose: they sit
// behind the board and the buttons. Each scene is 390×844 and anchors to the bottom of the screen.
(function (root) {
  'use strict';

  const W = 390, H = 844;
  // Deterministic scatter, so the stars don't jump between launches.
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  // Every scene shares these: a hand-drawn wobble on edges, blur that grows with distance,
  // a faint paper grain and a soft vignette, so the shapes read as painted, not cut out.
  const COMMON = `
    <filter id="far" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="mid" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="8"/><feDisplacementMap in="SourceGraphic" scale="6"/><feGaussianBlur stdDeviation="1.3"/></filter>
    <filter id="near" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="4"/><feGaussianBlur stdDeviation=".7"/></filter>
    <filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#05030f" stop-opacity="0"/><stop offset="1" stop-color="#05030f" stop-opacity=".55"/></radialGradient>`;
  const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><defs>${COMMON}${defs}</defs>${body}<rect width="${W}" height="${H}" filter="url(#grain)"/><rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
  const L = (depth, content) => `<g filter="url(#${depth})">${content}</g>`;
  // A rolling hill line across the screen, smooth with small irregular bumps.
  function hill(seed, y, amp, freq) {
    const r = rng(seed);
    const pts = [];
    for (let x = -30; x <= W + 30; x += 26) pts.push([x, y + Math.sin(x * freq + seed) * amp + (r() - 0.5) * amp * 0.5]);
    let d = `M${pts[0][0]} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0]} ${pts[i][1].toFixed(1)} ${mx} ${my.toFixed(1)}`;
    }
    return `${d} L${W + 30} ${H + 10} L-30 ${H + 10} Z`;
  }
  // A hill fill: a lit rim at the top fading into its body and darker toward the bottom.
  const hillGrad = (id, rim, base, deep) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rim}"/><stop offset=".06" stop-color="${base}"/><stop offset="1" stop-color="${deep}"/></linearGradient>`;
  const moon = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="${c}" opacity=".06" filter="url(#haze)"/><circle cx="${x}" cy="${y}" r="${r * 2}" fill="${c}" opacity=".1" filter="url(#haze)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".8" filter="url(#near)"/>`;
  const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const glow = (id, c, a) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  function stars(seed, n, maxY, color, alpha) {
    const r = rng(seed);
    let out = '';
    for (let i = 0; i < n; i++) {
      const x = (r() * W).toFixed(1), y = (r() * maxY).toFixed(1), s = (0.6 + r() * 1.3).toFixed(2);
      out += `<circle cx="${x}" cy="${y}" r="${s}" fill="${color}" opacity="${(alpha * (0.4 + r() * 0.6)).toFixed(2)}"/>`;
    }
    return out;
  }
  function sparkle(x, y, s, color, a) {
    return `<path d="M${x} ${y - s} Q${x + s * 0.15} ${y - s * 0.15} ${x + s} ${y} Q${x + s * 0.15} ${y + s * 0.15} ${x} ${y + s} Q${x - s * 0.15} ${y + s * 0.15} ${x - s} ${y} Q${x - s * 0.15} ${y - s * 0.15} ${x} ${y - s} Z" fill="${color}" opacity="${a}"/>`;
  }
  const pine = (x, y, h, c) => `<path d="M${x} ${y - h} L${x + h * 0.32} ${y - h * 0.45} L${x + h * 0.18} ${y - h * 0.45} L${x + h * 0.4} ${y} L${x - h * 0.4} ${y} L${x - h * 0.18} ${y - h * 0.45} L${x - h * 0.32} ${y - h * 0.45} Z" fill="${c}"/>`;
  const blobTree = (x, y, h, c) => `<rect x="${x - h * 0.05}" y="${y - h * 0.5}" width="${h * 0.1}" height="${h * 0.5}" fill="${c}"/><circle cx="${x}" cy="${y - h * 0.62}" r="${h * 0.3}" fill="${c}"/><circle cx="${x - h * 0.22}" cy="${y - h * 0.5}" r="${h * 0.2}" fill="${c}"/><circle cx="${x + h * 0.22}" cy="${y - h * 0.48}" r="${h * 0.22}" fill="${c}"/>`;
  function fence(y, c, gap) {
    let out = `<rect x="0" y="${y + 14}" width="${W}" height="5" fill="${c}"/><rect x="0" y="${y + 34}" width="${W}" height="5" fill="${c}"/>`;
    for (let x = 4; x < W; x += gap) out += `<path d="M${x} ${y + 52} V${y + 6} L${x + 6} ${y} L${x + 12} ${y + 6} V${y + 52} Z" fill="${c}"/>`;
    return out;
  }


  // A palm in silhouette: a tapered, leaning trunk with ring marks, a crown of drooping fronds made
  // of many small leaflets, and a couple of coconuts. (x, y) is the base; lean > 0 leans right.
  function palm(x, y, h, lean, dark, rim) {
    const P = (t) => { // point and tangent along the trunk curve (quadratic)
      const c = [x - lean * 0.35, y - h * 0.55], e = [x + lean, y - h];
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * c[0] + t * t * e[0];
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * c[1] + t * t * e[1];
      const dx = 2 * (1 - t) * (c[0] - x) + 2 * t * (e[0] - c[0]), dy = 2 * (1 - t) * (c[1] - y) + 2 * t * (e[1] - c[1]);
      const len = Math.hypot(dx, dy);
      return { px, py, nx: -dy / len, ny: dx / len };
    };
    const left = [], right = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, { px, py, nx, ny } = P(t), w = 8 - t * 4.2;
      left.push(`${(px + nx * w).toFixed(1)} ${(py + ny * w).toFixed(1)}`);
      right.unshift(`${(px - nx * w).toFixed(1)} ${(py - ny * w).toFixed(1)}`);
    }
    let out = `<path d="M${left.join(' L')} L${right.join(' L')} Z" fill="${dark}"/>`;
    for (let i = 1; i < 14; i++) { // trunk rings
      const t = i / 14, { px, py, nx, ny } = P(t), w = 8 - t * 4.2;
      out += `<path d="M${(px + nx * w).toFixed(1)} ${(py + ny * w).toFixed(1)} Q${(px + 1.5).toFixed(1)} ${(py + 2.5).toFixed(1)} ${(px - nx * w).toFixed(1)} ${(py - ny * w).toFixed(1)}" stroke="${rim}" stroke-opacity=".08" stroke-width="1" fill="none"/>`;
    }
    out += `<path d="M${left.slice(6).join(' L')}" stroke="${rim}" stroke-opacity=".1" stroke-width="1.2" fill="none"/>`;
    const top = P(1);
    const tx = top.px, ty = top.py;
    // Fronds: angle (deg from up, clockwise), length, droop.
    const fronds = [[-104, 80, 46], [-70, 88, 40], [-34, 62, 22], [8, 58, 18], [44, 90, 40], [84, 84, 50], [128, 56, 30], [-140, 54, 30]];
    for (const [a, len, droop] of fronds) {
      const rad = (a * Math.PI) / 180;
      const ex = tx + Math.sin(rad) * len, ey = ty - Math.cos(rad) * len * 0.55 + droop;
      const cx = tx + Math.sin(rad) * len * 0.55, cy = ty - Math.cos(rad) * len * 0.6 - 10;
      // Spine, then leaflets hanging off it.
      out += `<path d="M${tx} ${ty} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      for (let k = 1; k <= 11; k++) {
        const t = k / 12;
        const sx = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex;
        const sy = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey;
        const leafLen = 20 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 4;
        const out1 = Math.sin(rad) >= 0 ? 1 : -1; // leaflets sweep outward and hang down
        for (const dir of [-0.6, 1]) {
          const lx = sx + dir * out1 * leafLen * 0.45, ly = sy + leafLen;
          out += `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${(sx + dir * out1 * leafLen * 0.5).toFixed(1)} ${(sy + leafLen * 0.25).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)}" stroke="${dark}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
        }
      }
      out += `<path d="M${tx} ${ty} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${rim}" stroke-opacity=".1" stroke-width="1" fill="none"/>`;
    }
    out += `<circle cx="${tx - 4}" cy="${ty + 6}" r="4.5" fill="${dark}"/><circle cx="${tx + 4}" cy="${ty + 7}" r="4" fill="${dark}"/><circle cx="${tx}" cy="${ty + 10}" r="3.6" fill="${dark}"/>`;
    return out;
  }

  // Menus: the night backyard.
  const yard = svg(
    sky('s', [[0, '#120f33'], [0.55, '#272068'], [1, '#3a2f80']]) + glow('g', '#fff3c4', 0.2) +
    hillGrad('h1', '#36407a', '#262d63', '#1f2655') + hillGrad('h2', '#3c8a5c', '#225e3e', '#1a4a31') + hillGrad('h3', '#47a06a', '#2a7049', '#205a3a'),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>
     ${L('far', stars(7, 60, 520, '#ffffff', 0.7))}${stars(8, 24, 480, '#ffffff', 0.9)}
     ${sparkle(64, 130, 6, '#fff6c2', 0.45)}${sparkle(320, 220, 5, '#fff6c2', 0.35)}
     ${L('far', `<g fill="#6a5fc0" opacity=".12"><ellipse cx="300" cy="300" rx="80" ry="22"/><ellipse cx="320" cy="288" rx="44" ry="20"/><ellipse cx="90" cy="380" rx="60" ry="16"/><ellipse cx="104" cy="370" rx="30" ry="14"/></g>`)}
     ${L('far', `<path d="${hill(3, 620, 18, 0.012)}" fill="url(#h1)"/>${blobTree(52, 630, 120, '#1d2350')}${blobTree(345, 612, 150, '#1d2350')}${pine(296, 622, 90, '#1b214a')}`)}
     ${L('mid', fence(662, '#232a5e', 26))}
     ${L('mid', `<path d="${hill(5, 712, 14, 0.016)}" fill="url(#h2)"/>`)}
     ${L('near', `<path d="${hill(9, 768, 10, 0.02)}" fill="url(#h3)"/>`)}
     ${[[40, 735], [130, 748], [210, 730], [330, 742], [280, 790]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="url(#g)"/><circle cx="${x}" cy="${y}" r="1.8" fill="#fff3a0" opacity=".6"/>`).join('')}`);

  const rw = rng(3);
  const winStars = Array.from({ length: 12 }, () => `<circle cx="${(4 + rw() * 92).toFixed(1)}" cy="${(4 + rw() * 132).toFixed(1)}" r="${(0.6 + rw()).toFixed(2)}" fill="#fff" opacity="${(0.3 + rw() * 0.5).toFixed(2)}"/>`).join('');

  // World 1: the living room at night. Wallpaper, a moonlit window, a lamp, wood floor and a rug.
  const w1 = svg(
    sky('s', [[0, '#2a1d44'], [0.7, '#241939'], [1, '#1f1636']]) + glow('lamp', '#ffd38a', 0.26) + glow('win', '#bcd3ff', 0.16) +
    sky('floor', [[0, '#42283a'], [1, '#2e1c29']]) +
    `<pattern id="wp" width="40" height="40" patternUnits="userSpaceOnUse"><rect x="0" width="2" height="40" fill="#fff" opacity=".035"/><path d="M20 10 l5 10 -5 10 -5 -10 Z" fill="#fff" opacity=".04"/></pattern>`,
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${L('far', `<rect width="${W}" height="640" fill="url(#wp)"/>`)}
     <ellipse cx="300" cy="230" rx="170" ry="160" fill="url(#win)"/>
     ${L('mid', `<g transform="translate(250 150)"><rect x="-6" y="-6" width="112" height="152" rx="8" fill="#3a2a58"/><rect width="100" height="140" rx="4" fill="#1d2654"/>${winStars}<circle cx="70" cy="34" r="12" fill="#fff3c4" opacity=".7"/><rect x="48" width="4" height="140" fill="#3a2a58"/><rect y="68" width="100" height="4" fill="#3a2a58"/><path d="M-16 -12 Q12 60 -4 152 H-20 V-12 Z" fill="#5a2d4f" opacity=".75"/><path d="M116 -12 Q88 60 104 152 H120 V-12 Z" fill="#5a2d4f" opacity=".75"/></g>`)}
     ${L('mid', `<rect x="40" y="200" width="70" height="56" rx="4" fill="#3a2a58"/><rect x="46" y="206" width="58" height="44" rx="2" fill="#2c3a5e"/><path d="M50 246 L66 228 L78 240 L88 230 L100 246 Z" fill="#3d5a52" opacity=".8"/>`)}
     <ellipse cx="70" cy="450" rx="140" ry="150" fill="url(#lamp)"/>
     ${L('mid', `<g transform="translate(70 604)"><path d="M-26 -194 Q0 -200 26 -194 L18 -152 Q0 -148 -18 -152 Z" fill="#d79a5e" opacity=".75"/><rect x="-2" y="-152" width="4" height="146" fill="#3a2a55"/><ellipse cx="0" cy="-4" rx="18" ry="5" fill="#3a2a55"/></g>`)}
     ${L('mid', `<path d="M0 600 Q195 594 390 600 V614 H0 Z" fill="#3a2a55"/>`)}
     ${L('near', `<path d="M-10 612 Q195 606 400 612 V854 H-10 Z" fill="url(#floor)"/>
       ${Array.from({ length: 9 }, (_, i) => `<path d="M-10 ${632 + i * 26} Q195 ${628 + i * 26} 400 ${632 + i * 26}" stroke="#000" stroke-opacity=".16" stroke-width="1.5" fill="none"/>`).join('')}
       ${Array.from({ length: 18 }, (_, i) => `<rect x="${(i * 61) % W}" y="${612 + Math.floor(i / 2) * 26}" width="1.5" height="26" fill="#000" opacity=".12"/>`).join('')}
       <ellipse cx="200" cy="742" rx="172" ry="50" fill="#5a2d4f" opacity=".55"/><ellipse cx="200" cy="742" rx="140" ry="37" fill="none" stroke="#e86f8f" stroke-opacity=".16" stroke-width="3"/>`)}`);

  // World 2: the dog park at night. A tree line, a lamp post, rolling grass and a path.
  const w2 = svg(
    sky('s', [[0, '#14243a'], [0.55, '#1b3a3a'], [1, '#183326']]) + glow('lamp', '#ffe7a0', 0.24) +
    hillGrad('h1', '#25463f', '#172f2b', '#13282a') + hillGrad('h2', '#2f6a4a', '#1c4330', '#183a2a') + hillGrad('h3', '#3a8058', '#22513a', '#1c4430'),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${L('far', stars(11, 50, 380, '#fff', 0.6))}
     ${moon(80, 120, 22, '#f4ecd0')}
     ${L('far', `<path d="${hill(2, 462, 14, 0.02)}" fill="url(#h1)"/>${[20, 70, 120, 180, 240, 300, 360].map((x, i) => blobTree(x, 470 + (i % 2) * 6, 70 + (i % 3) * 18, '#122624')).join('')}`)}
     ${L('mid', `<path d="${hill(6, 545, 14, 0.015)}" fill="url(#h2)"/>`)}
     <ellipse cx="320" cy="410" rx="100" ry="120" fill="url(#lamp)"/>
     ${L('mid', `<g transform="translate(320 560)"><rect x="-3" y="-160" width="6" height="160" fill="#22302e"/><rect x="-12" y="-176" width="24" height="18" rx="4" fill="#2c3a36"/><rect x="-8" y="-172" width="16" height="10" rx="2" fill="#ffe7a0" opacity=".7"/></g>`)}
     ${L('near', `<path d="${hill(4, 640, 12, 0.018)}" fill="url(#h3)"/>
       <path d="M150 854 Q170 760 230 700 Q260 670 300 660 L320 664 Q280 690 262 720 Q220 780 236 854 Z" fill="#4a4636" opacity=".45"/>
       <g fill="#4a9a68" opacity=".4">${[[30, 700], [90, 760], [330, 720], [370, 800], [60, 820], [120, 690]].map(([x, y]) => `<path d="M${x} ${y} l3 -10 3 10 3 -8 2 8 Z"/>`).join('')}</g>
       <g transform="translate(40 652)" opacity=".7"><rect x="0" y="0" width="70" height="7" rx="2" fill="#4a3a2a"/><rect x="6" y="7" width="5" height="20" fill="#3a2d22"/><rect x="59" y="7" width="5" height="20" fill="#3a2d22"/></g>`)}`);

  // World 3: the beach at dusk. Moon over the sea with its reflection, waves, sand and a palm.
  const w3 = svg(
    sky('s', [[0, '#1b2350'], [0.42, '#3a3a6a'], [0.52, '#5a4a6e']]) + sky('sea', [[0, '#264a6e'], [0.15, '#1d3f63'], [1, '#14304d']]) + hillGrad('sand', '#7a6656', '#594844', '#423634'),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${L('far', stars(5, 40, 330, '#fff', 0.6))}
     ${moon(250, 250, 32, '#ffe9c2')}
     ${L('mid', `<rect x="-10" y="420" width="${W + 20}" height="270" fill="url(#sea)"/>
       ${Array.from({ length: 6 }, (_, i) => `<path d="M-10 ${470 + i * 36} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#fff" stroke-opacity=".05" stroke-width="2" fill="none"/>`).join('')}`)}
     <g filter="url(#haze)" opacity=".9">${Array.from({ length: 10 }, (_, i) => `<ellipse cx="${250 + (i % 3) * 6 - 6}" cy="${432 + i * 22}" rx="${30 - i * 2}" ry="2" fill="#ffe9c2" opacity="${(0.4 - i * 0.03).toFixed(2)}"/>`).join('')}</g>
     ${L('mid', `<path d="${hill(12, 640, 6, 0.02)}" fill="#cfe3f0" opacity=".12"/>`)}
     ${L('near', `<path d="${hill(14, 656, 7, 0.018)}" fill="url(#sand)"/>
       ${palm(48, 712, 200, 26, '#26223a', '#ffe9c2')}
       ${[[300, 740], [200, 790], [350, 810]].map(([x, y]) => `<path d="M${x} ${y} l3 -4 3 4 -3 4 Z" fill="#ffd0a0" opacity=".25"/>`).join('')}`)}`);

  // World 4: snowy hill at night. Layered snow hills, pines, and a quiet snowfall.
  const w4 = svg(
    sky('s', [[0, '#121c3a'], [0.6, '#22325e'], [1, '#2a3d6a']]) +
    hillGrad('h1', '#4a5f8e', '#2c3d66', '#283a60') + hillGrad('h2', '#5a6f9e', '#33456f', '#2c3d66') + hillGrad('h3', '#a9bbd8', '#6a7fa8', '#4f6390'),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${L('far', stars(13, 40, 360, '#fff', 0.6))}
     ${moon(310, 130, 26, '#f2f6ff')}
     ${L('far', `<path d="${hill(21, 450, 26, 0.012)}" fill="url(#h1)"/>${[[40, 470, 60], [80, 458, 76], [250, 452, 64], [340, 430, 84], [370, 440, 60]].map(([x, y, h]) => pine(x, y, h, '#22305a')).join('')}`)}
     ${L('mid', `<path d="${hill(23, 556, 20, 0.014)}" fill="url(#h2)"/>${[[150, 560, 70], [190, 566, 56], [300, 548, 90]].map(([x, y, h]) => pine(x, y, h, '#283868')).join('')}`)}
     ${L('near', `<path d="${hill(25, 676, 14, 0.016)}" fill="url(#h3)" opacity=".42"/>`)}
     ${L('mid', stars(21, 60, 840, '#ffffff', 0.4))}`);

  // World 5: the autumn backyard at dusk. A big tree, a fence, and leaves on the ground and in the air.
  const leaf = (x, y, s, rot, c, a) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 -8 l2 4 4 -1 -2 3 3 2 -4 1 1 4 -4 -2 -4 2 1 -4 -4 -1 3 -2 -2 -3 4 1 Z" fill="${c}" opacity="${a}"/>`;
  const r5 = rng(9);
  const w5 = svg(
    sky('s', [[0, '#2a1830'], [0.5, '#4a2632'], [1, '#3a2018']]) + glow('sun', '#ffb36b', 0.26) +
    hillGrad('h1', '#4a2c28', '#33201f', '#2c1c1b') + hillGrad('h2', '#5a3420', '#3e2418', '#331d14'),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${L('far', stars(17, 24, 260, '#fff', 0.45))}
     <circle cx="120" cy="380" r="170" fill="url(#sun)"/>
     ${L('far', `<path d="${hill(31, 508, 14, 0.014)}" fill="url(#h1)"/>`)}
     ${L('mid', `<g transform="translate(300 560)"><path d="M-10 0 Q-6 -120 -30 -200 M-8 -100 Q30 -150 70 -170 M-14 -150 Q-60 -190 -90 -200" stroke="#2a1614" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="-30" cy="-230" r="70" fill="#5a2a1e" opacity=".85"/><circle cx="40" cy="-200" r="60" fill="#6a321e" opacity=".8"/><circle cx="-90" cy="-200" r="50" fill="#5a2a1e" opacity=".8"/><circle cx="10" cy="-260" r="40" fill="#7a3a20" opacity=".6"/></g>${fence(540, '#2c1a17', 28)}`)}
     ${L('near', `<path d="${hill(33, 616, 8, 0.02)}" fill="url(#h2)"/>
       ${Array.from({ length: 26 }, () => leaf((r5() * W).toFixed(0), (640 + r5() * 200).toFixed(0), (0.8 + r5()).toFixed(2), (r5() * 360).toFixed(0), ['#c9702a', '#a8452a', '#d9a03a'][Math.floor(r5() * 3)], (0.25 + r5() * 0.25).toFixed(2))).join('')}`)}
     ${L('mid', Array.from({ length: 10 }, () => leaf((r5() * W).toFixed(0), (60 + r5() * 480).toFixed(0), (0.7 + r5() * 0.6).toFixed(2), (r5() * 360).toFixed(0), '#e8743a', (0.15 + r5() * 0.15).toFixed(2))).join(''))}`);

  const SCENES = { yard, w1, w2, w3, w4, w5 };
  const toUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  function install(doc) {
    const st = (doc || root.document).documentElement.style;
    Object.entries(SCENES).forEach(([k, s]) => st.setProperty(`--scene-${k}`, toUrl(s)));
  }

  root.PB = root.PB || {};
  root.PB.Backdrops = { SCENES, install };
  if (root.document) install(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : this);
