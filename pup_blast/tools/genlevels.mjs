// Generates starting boards for Worlds 3-5 and writes them into www/js/levels.js between the
// "<gen wN>" markers. Run once, then edit levels by hand like any other data:
//   node tools/genlevels.mjs [w3 w4 w5]
// Each level's board comes from a seeded, mostly mirror-symmetric scatter whose density ramps over
// the world. A board is kept only if it passes the same rules as the hand-made worlds (no full
// line at the start, every line 0 or 4+ open cells, a legal first move) and the starter bot neither
// dies at once nor plays forever on it. Otherwise the next seed is tried.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { play } from './botlib.mjs';
const require = createRequire(import.meta.url);
const Core = require('../www/js/core.js');

const E = '........';
const SHAPES = {
  ROUND: ['xx....xx', 'x......x', E, E, E, E, 'x......x', 'xx....xx'],
  PLUS: ['xx....xx', 'xx....xx', E, E, E, E, 'xx....xx', 'xx....xx'],
  BONE: ['..xxxx..', E, E, 'x......x', 'x......x', E, E, '..xxxx..'],
  HEART: ['x..xx..x', E, E, E, E, 'x......x', 'xx....xx', 'xx....xx'],
  DONUT: ['xx....xx', 'x......x', '...xx...', '..xxxx..', '..xxxx..', '...xx...', 'x......x', 'xx....xx'],
  CLOVER: ['...xx...', E, E, 'x......x', 'x......x', E, E, '...xx...'],
  SEVEN: ['.......x', '.......x', '.......x', '.......x', '.......x', '.......x', '.......x', 'xxxxxxxx'],
  SIX: ['xxxxxxxx', 'x......x', 'x......x', 'x......x', 'x......x', 'x......x', 'x......x', 'xxxxxxxx'],
};

// [name, reward ('dig' or bones), extra]
const NAMES = {
  w3: ['Low Tide', 'Sandcastle', 'Shell Hunt', 'Seagulls', 'Sand Dig', 'Tide Pools', 'Boardwalk', 'Beach Towel', 'Sun Hat', 'Lighthouse',
    'Driftwood', 'Crab Walk', "Surf's Up", 'Beach Ball', 'Sea Glass', 'Pier', 'Kelp Bed', 'Sunscreen', 'Splash Zone', 'Message in a Bottle',
    'Tide Turns', 'Starfish', 'Lifeguard Tower', 'Sandbar', 'Shipwreck', 'Sand Dollar', 'Coral Cove', 'Rip Current', 'Sea Breeze', 'Treasure Map',
    'Moon Tide', 'Jellyfish', 'Dune Grass', 'Bonfire', 'Deep Dig', 'High Tide', 'Sea Cave', 'Storm Surge', 'Sunset Pier', 'Big Dig-Up'],
  w4: ['First Snow', 'Icicles', 'Snowball', 'Frozen Pond', 'Sled Run', 'Mud Season', 'Snow Boots', 'Mittens', 'Hot Cocoa', 'Snow Fort',
    'Little Hill', 'Slush', 'Ski Lift', 'Snow Angel', 'Igloo', 'Frostbite', 'Pine Trees', 'Thin Ice', 'Blizzard', 'Snowed In',
    'Sled Dogs', 'Ice Rink', 'Snowdrift', 'Avalanche Zone', 'Mountain Hut', 'Tiny Peak', 'Frozen Creek', 'Muddy Trail', 'Whiteout', 'Summit',
    'Northern Lights', 'Ice Cave', 'Cold Snap', 'Glacier', 'Yeti Tracks', 'Deep Freeze', 'Polar Night', 'Permafrost', 'Ice Storm', 'Frozen Fortress'],
  w5: ['Falling Leaves', 'Squirrel Spotted', 'Bird Feeder', 'Garden Gnome', 'Leaf Pile', 'Pumpkin Patch', 'Tree Swing', 'Sandbox', 'Hammock', 'Back Porch',
    'Acorn Drop', 'Rake Lines', 'Apple Tree', 'Garden Hose', 'Treehouse', 'Compost Heap', 'Fence Run', 'Scarecrow', 'Windy Day', 'First Gust',
    'Two Squirrels', 'Frosty Morning', 'Wheelbarrow', 'Hay Bales', 'Harvest', 'Mud Kitchen', 'Bird Bath', 'Woodpile', 'Lantern Night', 'Cider Press',
    "They're Back", 'Squirrel Gang', 'Chipmunk Run', 'Gutter Leaves', 'Nut Heist', 'Cold Front', 'Storm Clouds', 'Last Leaves', 'Calm Before', 'The Leaf Blower'],
};
const GIFTS = { w3: ['cocoa', 'duchess'], w4: ['clover', 'merlin'], w5: ['ziggy', 'dj'] };
const BONES = { w3: [70, 85, 100, 115], w4: [85, 100, 115, 130], w5: [100, 115, 130, 145] };
const NOTES = {
  w3: { 1: 'Buried bones', 6: 'Puddles', 11: 'Shaped boards' },
  w4: { 1: 'Ice', 6: 'Mud', 11: 'Small boards' },
  w5: { 1: 'Squirrels', 11: 'Acorns', 20: 'Leaf Blower', 31: 'Squirrels come back' },
};

// What each level holds: base shape and how many of each cell to scatter.
function recipe(world, n) {
  const t = (n - 1) / 39;
  const ramp = (a, b) => Math.round(a + (b - a) * t);
  const r = { shape: null, blocks: ramp(4, 13), buried: 0, buriedUnder: 0, puddles: 0, ice: 0, mud: 0, squirrels: 0 };
  if (world === 'w3') {
    r.buried = n <= 5 ? 2 + n : ramp(4, 8);
    r.buriedUnder = n > 10 ? Math.round(r.buried * 0.3) : 0;
    r.puddles = n < 6 ? 0 : ramp(2, 7);
    const shapes = ['ROUND', 'PLUS', 'BONE', 'HEART', 'DONUT', 'CLOVER'];
    if (n >= 11 && n % 3 === 2) r.shape = shapes[(n / 3 | 0) % shapes.length];
    if (n === 40) Object.assign(r, { buried: 12, buriedUnder: 4, puddles: 6, shape: null });
  }
  if (world === 'w4') {
    r.ice = n <= 5 ? 1 + n : ramp(3, 9);
    r.mud = n < 6 ? 0 : ramp(1, 6);
    r.blocks = ramp(2, 8);
    if (n >= 11 && n % 3 === 2) r.shape = 'SEVEN';
    if (n >= 26 && n % 3 === 0) { r.shape = 'SIX'; r.ice = Math.round(r.ice * 0.6); r.mud = Math.round(r.mud * 0.6); r.blocks = Math.round(r.blocks * 0.5); }
    if (n >= 21) { r.buried = ramp(1, 4); r.buriedUnder = 1; }
    if (n === 40) Object.assign(r, { shape: null, mud: 10, ice: 6, blocks: 2 });
  }
  if (world === 'w5') {
    r.squirrels = n <= 20 || n === 40 ? 1 : 2;
    if (n >= 21) r.ice = ramp(1, 5);
    r.blocks = ramp(4, 12);
  }
  return r;
}

function rules(world, n) {
  if (world !== 'w5') return {};
  const out = { squirrels: { every: 3, acorns: n >= 11, returns: n >= 31 ? 6 : 0 } };
  if (n === 20) out.blower = { every: 4 };
  if (n === 40) out.blower = { every: 3 };
  return out;
}

function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

function build(world, n, attempt) {
  const rng = Core.mulberry32(hash(`${world}-${n}-${attempt}`));
  const rec = recipe(world, n);
  const g = (rec.shape ? SHAPES[rec.shape] : Array(8).fill(E)).map((row) => [...row]);
  const gift = n === 20 || n === 40;
  if (gift) {
    const o = rec.shape === 'SIX' ? 3 : rec.shape === 'SEVEN' ? 2 : 3;
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) g[o + dr][o + dc] = 'C';
  }
  const free = () => { const out = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g[r][c] === '.') out.push([r, c]); return out; };
  // Puts `count` of `ch`, mostly in mirrored pairs. `near` grows little clusters for blocks.
  const scatter = (ch, count, opts = {}) => {
    let left = count;
    for (let tries = 0; left > 0 && tries < 200; tries++) {
      const cells = free().filter(([r]) => !opts.rows || opts.rows.includes(r));
      if (!cells.length) return;
      let [r, c] = cells[Math.floor(rng() * cells.length)];
      const put = (rr, cc) => { if (left > 0 && g[rr] && g[rr][cc] === '.') { g[rr][cc] = ch; left--; } };
      put(r, c);
      if (rng() < 0.7) put(r, 7 - c);
      if (opts.near && rng() < 0.5) { const [dr, dc] = [[0, 1], [1, 0], [0, -1], [-1, 0]][Math.floor(rng() * 4)]; put(r + dr, c + dc); if (rng() < 0.7) put(r + dr, 7 - (c + dc)); }
    }
  };
  const low = [3, 4, 5, 6, 7];
  scatter('o', rec.buried - rec.buriedUnder);
  scatter('O', rec.buriedUnder, { rows: low });
  scatter('w', rec.puddles);
  scatter('m', rec.mud, n === 40 && world === 'w4' ? {} : { rows: low, near: true });
  scatter('i', rec.ice, { near: true });
  scatter('#', rec.blocks, { rows: low, near: true });
  scatter('S', rec.squirrels, { rows: [0, 1, 2, 3] });
  if (world === 'w4' && n === 40) { // Frozen Fortress: mud walls hug the crate
    for (const [r, c] of [[2, 3], [2, 4], [5, 3], [5, 4], [3, 2], [4, 2], [3, 5], [4, 5]]) if (g[r][c] === '.' || g[r][c] === 'i') g[r][c] = 'm';
  }
  return g.map((row) => row.join(''));
}

function valid(start, extra) {
  const game = Core.createGame(1, Object.assign({ start }, extra));
  const { rows, cols } = Core.fullLines(game.board);
  if (rows.length + cols.length) return false;
  for (let k = 0; k < 8; k++) for (const isRow of [true, false]) {
    let open = 0;
    for (let j = 0; j < 8; j++) if (!Core.isFixed(game, isRow ? Core.idx(k, j) : Core.idx(j, k))) open++;
    if (open && open < 4) return false;
  }
  return !Core.isGameOver(game);
}

// The starter bot must survive a while and not play forever.
function fair(level) {
  const res = Array.from({ length: 16 }, (_, k) => play(level, 'starter', 500 + k * 104729)).sort((a, b) => a.score - b.score);
  const med = res[8];
  return med.moves >= 12 && med.moves <= 450;
}

function worldRows(world) {
  return NAMES[world].map((name, k) => {
    const n = k + 1;
    const decade = Math.floor((n - 1) / 10);
    const reward = n % 5 === 0 ? 'dig' : BONES[world][decade];
    const extra = Object.assign({ helpers: 'HELP_BOTH' }, rules(world, n));
    if (n === 20) extra.gift = GIFTS[world][0];
    if (n === 40) { extra.gift = GIFTS[world][1]; extra.note = 'Finale'; }
    if (NOTES[world][n]) extra.note = NOTES[world][n];
    for (let attempt = 0; attempt < 400; attempt++) {
      const start = build(world, n, attempt);
      const opts = { squirrels: extra.squirrels, blower: extra.blower };
      if (!valid(start, opts)) continue;
      if (!fair({ start, helpers: { golden: 1 / 12, ball: 1 / 14 }, ...opts })) continue;
      return { name, reward, start, extra, attempt };
    }
    throw new Error(`${world}-${n}: no fair board found`);
  });
}

const fmt = (v) => (typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : JSON.stringify(v).replace(/"(\w+)":/g, '$1: ').replace(/,(\w)/g, ', $1'));
function emit(rows) {
  return rows.map(({ name, reward, start, extra }) => {
    const ex = Object.entries(extra).map(([k, v]) => `${k}: ${k === 'helpers' ? v : fmt(v)}`).join(', ');
    return `    [${fmt(name)}, 0, ${fmt(reward)}, [${start.map((r) => (r === E ? 'E' : `'${r}'`)).join(', ')}], { ${ex} }],`;
  }).join('\n');
}

const worlds = process.argv.slice(2).length ? process.argv.slice(2) : ['w3', 'w4', 'w5'];
let src = readFileSync(new URL('../www/js/levels.js', import.meta.url), 'utf8');
for (const w of worlds) {
  const rows = worldRows(w);
  const re = new RegExp(`(// <gen ${w}>)[\\s\\S]*?(\\n\\s*// </gen ${w}>)`);
  if (!re.test(src)) throw new Error(`no <gen ${w}> markers in levels.js`);
  src = src.replace(re, `$1\n${emit(rows)}$2`);
  console.log(`${w}: ${rows.length} levels (seeds tried: ${rows.map((r) => r.attempt).join(' ')})`);
}
writeFileSync(new URL('../www/js/levels.js', import.meta.url), src);
