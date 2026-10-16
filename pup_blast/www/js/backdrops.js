// Background scenes: one soft, dark illustration per place, drawn as SVG and handed to CSS as
// custom properties (--scene-yard, --scene-w1 … --scene-w5). Low contrast on purpose: they sit
// behind the board and the buttons. Each scene is 390×844 and anchors to the bottom of the screen.
(function (root) {
  'use strict';

  const W = 390, H = 844;
  // Deterministic scatter, so the stars don't jump between launches.
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><defs>${defs}</defs>${body}</svg>`;
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

  // Menus: the night backyard.
  const yard = svg(
    sky('s', [[0, '#141036'], [0.6, '#2a2370'], [1, '#3a2f80']]) + glow('g', '#fff3c4', 0.18),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(7, 70, 520, '#ffffff', 0.8)}
     ${sparkle(64, 130, 6, '#fff6c2', 0.5)}${sparkle(320, 220, 5, '#fff6c2', 0.4)}${sparkle(250, 70, 4, '#ffffff', 0.4)}
     <g fill="#5a4fae" opacity=".1"><circle cx="270" cy="300" r="34"/><circle cx="305" cy="288" r="44"/><circle cx="345" cy="302" r="30"/><rect x="250" y="300" width="120" height="30" rx="15"/></g>
     <g fill="#5a4fae" opacity=".07"><circle cx="60" cy="380" r="24"/><circle cx="90" cy="370" r="32"/><circle cx="122" cy="384" r="22"/><rect x="44" y="384" width="96" height="22" rx="11"/></g>
     <path d="M0 640 Q90 590 190 625 T390 600 V844 H0 Z" fill="#232a5e"/>
     ${blobTree(52, 640, 120, '#1e2552')}${blobTree(345, 615, 150, '#1e2552')}${pine(300, 625, 90, '#1c234d')}
     ${fence(660, '#202457', 26)}
     <path d="M0 720 Q120 680 240 712 T390 700 V844 H0 Z" fill="#1d5a3a"/>
     <path d="M0 770 Q150 740 270 768 T390 760 V844 H0 Z" fill="#247049"/>
     ${[[40, 735], [130, 748], [210, 730], [330, 742]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff3a0" opacity=".55"/><circle cx="${x}" cy="${y}" r="7" fill="url(#g)"/>`).join('')}`);

  const rw = rng(3);
  const winStars = Array.from({ length: 12 }, () => `<circle cx="${(4 + rw() * 92).toFixed(1)}" cy="${(4 + rw() * 132).toFixed(1)}" r="${(0.6 + rw()).toFixed(2)}" fill="#fff" opacity="${(0.3 + rw() * 0.5).toFixed(2)}"/>`).join('');

  // World 1: the living room at night. Wallpaper, a moonlit window, a lamp, wood floor and a rug.
  const w1 = svg(
    sky('s', [[0, '#2a1d44'], [1, '#1f1636']]) + glow('lamp', '#ffd38a', 0.22) + glow('win', '#bcd3ff', 0.16) +
    `<pattern id="wp" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="none"/><rect x="0" width="2" height="40" fill="#fff" opacity=".03"/><path d="M20 10 l5 10 -5 10 -5 -10 Z" fill="#fff" opacity=".035"/></pattern>`,
    `<rect width="${W}" height="${H}" fill="url(#s)"/><rect width="${W}" height="640" fill="url(#wp)"/>
     <rect x="0" y="600" width="${W}" height="12" fill="#3a2a55"/>
     <g transform="translate(250 150)"><rect x="-6" y="-6" width="112" height="152" rx="8" fill="#3a2a58"/><rect width="100" height="140" rx="4" fill="#1a2350"/>${winStars}<circle cx="70" cy="34" r="13" fill="#fff3c4" opacity=".75"/><rect x="48" width="4" height="140" fill="#3a2a58"/><rect y="68" width="100" height="4" fill="#3a2a58"/><path d="M-14 -10 Q10 60 -4 150 H-18 V-10 Z" fill="#5a2d4f" opacity=".7"/><path d="M114 -10 Q90 60 104 150 H118 V-10 Z" fill="#5a2d4f" opacity=".7"/></g>
     <ellipse cx="300" cy="240" rx="150" ry="140" fill="url(#win)"/>
     <rect x="40" y="200" width="70" height="56" rx="4" fill="#3a2a58"/><rect x="46" y="206" width="58" height="44" rx="2" fill="#2c3a5e"/><path d="M50 246 L66 228 L78 240 L88 230 L100 246 Z" fill="#3d5a52" opacity=".8"/>
     <g transform="translate(70 600)"><ellipse cx="0" cy="-150" rx="110" ry="110" fill="url(#lamp)"/><path d="M-26 -190 H26 L18 -150 H-18 Z" fill="#c98a52" opacity=".7"/><rect x="-2" y="-150" width="4" height="146" fill="#3a2a55"/><ellipse cx="0" cy="-4" rx="18" ry="5" fill="#3a2a55"/></g>
     <rect x="0" y="612" width="${W}" height="${H - 612}" fill="#3a2433"/>
     ${Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${630 + i * 26}" width="${W}" height="1.5" fill="#000" opacity=".18"/>`).join('')}
     ${Array.from({ length: 18 }, (_, i) => `<rect x="${(i * 61) % W}" y="${612 + Math.floor(i / 2) * 26}" width="1.5" height="26" fill="#000" opacity=".15"/>`).join('')}
     <ellipse cx="200" cy="740" rx="170" ry="48" fill="#5a2d4f" opacity=".55"/><ellipse cx="200" cy="740" rx="140" ry="36" fill="none" stroke="#e86f8f" stroke-opacity=".18" stroke-width="3"/>`);

  // World 2: the dog park at night. A tree line, a lamp post, rolling grass and a path.
  const w2 = svg(
    sky('s', [[0, '#14243a'], [0.55, '#1b3a3a'], [1, '#183326']]) + glow('lamp', '#ffe7a0', 0.22) + glow('mg', '#f4ecd0', 0.16),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(11, 50, 380, '#fff', 0.6)}
     <circle cx="80" cy="120" r="70" fill="url(#mg)"/><circle cx="80" cy="120" r="22" fill="#f4ecd0" opacity=".55"/>
     <path d="M0 470 Q60 430 120 455 T240 445 T390 455 V844 H0 Z" fill="#162e2a"/>
     ${[20, 70, 120, 180, 240, 300, 360].map((x, i) => blobTree(x, 470 + (i % 2) * 6, 70 + (i % 3) * 18, '#13282a')).join('')}
     <path d="M0 560 Q110 520 220 548 T390 535 V844 H0 Z" fill="#1a3f2c"/>
     <g transform="translate(320 560)"><ellipse cx="0" cy="-150" rx="90" ry="110" fill="url(#lamp)"/><rect x="-3" y="-160" width="6" height="160" fill="#22302e"/><rect x="-12" y="-176" width="24" height="18" rx="4" fill="#2c3a36"/><rect x="-8" y="-172" width="16" height="10" rx="2" fill="#ffe7a0" opacity=".6"/></g>
     <path d="M0 650 Q120 615 250 640 T390 630 V844 H0 Z" fill="#1f4a32"/>
     <path d="M150 844 Q170 760 230 700 Q260 670 300 660 L320 664 Q280 690 262 720 Q220 780 230 844 Z" fill="#3a3a2e" opacity=".55"/>
     <g fill="#2d6a46" opacity=".55">${[[30, 700], [90, 760], [330, 720], [370, 800], [60, 820]].map(([x, y]) => `<path d="M${x} ${y} l3 -10 3 10 3 -8 2 8 Z"/>`).join('')}</g>
     <g transform="translate(40 640)" opacity=".7"><rect x="0" y="0" width="70" height="7" rx="2" fill="#4a3a2a"/><rect x="6" y="7" width="5" height="20" fill="#3a2d22"/><rect x="59" y="7" width="5" height="20" fill="#3a2d22"/></g>`);

  // World 3: the beach at dusk. Moon over the sea with its reflection, waves, sand and a palm.
  const w3 = svg(
    sky('s', [[0, '#1b2350'], [0.45, '#3a3a6a'], [0.6, '#5a4a6e']]) + glow('mg', '#ffe9c2', 0.18) + sky('sea', [[0, '#1d3f63'], [1, '#14304d']]) + sky('sand', [[0, '#5b4b48'], [1, '#433836']]),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(5, 40, 330, '#fff', 0.6)}
     <circle cx="250" cy="250" r="110" fill="url(#mg)"/><circle cx="250" cy="250" r="34" fill="#ffe9c2" opacity=".75"/>
     <rect x="0" y="420" width="${W}" height="260" fill="url(#sea)"/>
     ${Array.from({ length: 10 }, (_, i) => `<rect x="${250 - 36 + (i % 3) * 8 - i * 1.5}" y="${430 + i * 22}" width="${60 - i * 4}" height="3" rx="1.5" fill="#ffe9c2" opacity="${(0.35 - i * 0.03).toFixed(2)}"/>`).join('')}
     ${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${470 + i * 36} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#fff" stroke-opacity=".05" stroke-width="2" fill="none"/>`).join('')}
     <path d="M0 640 Q100 625 200 640 T390 632 V844 H0 Z" fill="#cfe3f0" opacity=".12"/>
     <path d="M0 655 Q110 640 220 655 T390 648 V844 H0 Z" fill="url(#sand)"/>
     <g transform="translate(40 700)"><path d="M0 0 Q-8 -90 14 -170" stroke="#2e2638" stroke-width="9" fill="none" stroke-linecap="round"/><g fill="#2a2a3a"><path d="M14 -170 Q50 -190 80 -160 Q48 -172 14 -168 Z"/><path d="M14 -170 Q-20 -200 -50 -170 Q-18 -178 14 -168 Z"/><path d="M14 -170 Q40 -150 54 -110 Q34 -150 14 -166 Z"/><path d="M14 -170 Q-10 -140 -20 -110 Q-4 -150 14 -166 Z"/><path d="M14 -170 Q20 -210 4 -230 Q24 -206 16 -170 Z"/></g></g>
     ${[[300, 740], [200, 790], [350, 810]].map(([x, y]) => `<path d="M${x} ${y} l3 -4 3 4 -3 4 Z" fill="#ffd0a0" opacity=".25"/>`).join('')}`);

  // World 4: snowy hill at night. Layered snow hills, pines, and a quiet snowfall.
  const w4 = svg(
    sky('s', [[0, '#121c3a'], [0.6, '#22325e'], [1, '#2a3d6a']]) + glow('mg', '#f2f6ff', 0.16),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(13, 40, 360, '#fff', 0.6)}
     <circle cx="310" cy="130" r="80" fill="url(#mg)"/><circle cx="310" cy="130" r="26" fill="#f2f6ff" opacity=".6"/>
     <path d="M0 480 Q90 400 180 450 T390 420 V844 H0 Z" fill="#2c3d66"/>
     ${[[40, 470, 60], [80, 458, 76], [250, 452, 64], [340, 430, 84], [370, 440, 60]].map(([x, y, h]) => pine(x, y, h, '#22305a')).join('')}
     <path d="M0 580 Q120 520 240 560 T390 540 V844 H0 Z" fill="#33456f"/>
     ${[[150, 560, 70], [190, 566, 56], [300, 548, 90]].map(([x, y, h]) => pine(x, y, h, '#2a3a66')).join('')}
     <path d="M0 680 Q130 630 260 668 T390 655 V844 H0 Z" fill="#c9d7ee" opacity=".14"/>
     <path d="M0 720 Q150 690 280 712 T390 705 V844 H0 Z" fill="#dfe8f6" opacity=".12"/>
     ${stars(21, 60, 840, '#ffffff', 0.35)}`);

  // World 5: the autumn backyard at dusk. A big tree, a fence, and leaves on the ground and in the air.
  const leaf = (x, y, s, rot, c, a) => `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 -8 l2 4 4 -1 -2 3 3 2 -4 1 1 4 -4 -2 -4 2 1 -4 -4 -1 3 -2 -2 -3 4 1 Z" fill="${c}" opacity="${a}"/>`;
  const r5 = rng(9);
  const w5 = svg(
    sky('s', [[0, '#2a1830'], [0.5, '#4a2632'], [1, '#3a2018']]) + glow('sun', '#ffb36b', 0.22),
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(17, 24, 260, '#fff', 0.45)}
     <circle cx="120" cy="380" r="140" fill="url(#sun)"/>
     <path d="M0 520 Q100 490 200 510 T390 500 V844 H0 Z" fill="#33201f"/>
     <g transform="translate(300 560)"><path d="M-10 0 Q-6 -120 -30 -200 M-8 -100 Q30 -150 70 -170 M-14 -150 Q-60 -190 -90 -200" stroke="#2a1614" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="-30" cy="-230" r="70" fill="#5a2a1e" opacity=".85"/><circle cx="40" cy="-200" r="60" fill="#6a321e" opacity=".8"/><circle cx="-90" cy="-200" r="50" fill="#5a2a1e" opacity=".8"/></g>
     ${fence(540, '#2c1a17', 28)}
     <path d="M0 620 Q120 600 240 618 T390 610 V844 H0 Z" fill="#3e2418"/>
     ${Array.from({ length: 26 }, () => leaf((r5() * W).toFixed(0), (640 + r5() * 200).toFixed(0), (0.8 + r5()).toFixed(2), (r5() * 360).toFixed(0), ['#c9702a', '#a8452a', '#d9a03a'][Math.floor(r5() * 3)], (0.25 + r5() * 0.25).toFixed(2))).join('')}
     ${Array.from({ length: 10 }, () => leaf((r5() * W).toFixed(0), (60 + r5() * 480).toFixed(0), (0.7 + r5() * 0.6).toFixed(2), (r5() * 360).toFixed(0), '#e8743a', (0.15 + r5() * 0.15).toFixed(2))).join('')}`);

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
