#!/usr/bin/env node
// Generates the Magic Boba campaign (3 worlds × 10 levels).
// For each level spec: deal many random seeds, solve each one, keep the seed whose
// optimal solution length is closest to the spec's target. Every shipped level is
// proven solvable by the BFS solver.
//
// Usage: node generate.js            -> regenerates every level, writes levels.json + levels.js
//        node generate.js 1-5 C-4   -> regenerates only those levels, keeps the rest
const fs = require('fs');
const path = require('path');
const Boba = require('./engine');

function rng(seed) {
  // mulberry32
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pearls always rest at the bottom of a cup, sparkle soda always floats on top.
const settle = (cup) => cup.replace(/[^P]/g, '') + cup.replace(/[PF]/g, '') + cup.replace(/[^F]/g, '');

function deal(tokens, cupCount, cap, r, fillEvenly) {
  const bag = shuffle(tokens.slice(), r);
  const cups = Array.from({ length: cupCount }, () => '');
  if (fillEvenly) {
    bag.forEach((t, i) => (cups[Math.floor(i / cap)] += t));
  } else {
    for (const t of bag) {
      const open = cups.map((c, i) => i).filter((i) => cups[i].length < cap);
      cups[open[Math.floor(r() * open.length)]] += t;
    }
  }
  return cups.map(settle);
}

function buildSort(spec, r) {
  const tokens = [];
  for (const c of spec.colors) tokens.push(...c.repeat(spec.cap || 4));
  const filled = spec.colors.length;
  const cups = deal(tokens, filled, spec.cap || 4, r, true);
  for (let i = 0; i < spec.empty; i++) cups.push('');
  // Reject deals where a cup is already finished.
  if (cups.some((c) => c.length === (spec.cap || 4) && Boba.topRun(c) === c.length)) return null;
  return { mode: 'sort', cap: spec.cap || 4, cups };
}

function buildOrders(spec, r) {
  const cap = spec.cap || 4;
  const tokens = spec.orders.join('').split('');
  const cupCount = Math.ceil(tokens.length / cap) + (spec.extraCups || 0);
  const cups = deal(tokens, cupCount, cap, r, false);
  for (let i = 0; i < (spec.empty || 0); i++) cups.push('');
  // Reject deals that hand out a finished order for free.
  if (cups.some((c) => spec.orders.includes(c))) return null;
  return { mode: 'orders', cap, cups, orders: spec.orders.slice(), slots: spec.slots || 2 };
}

// Difficulty tiers: max % of casual-player runs (engine.casualStuckRate) allowed to get stuck
// with NO bonus vials. Ads should rescue frustration, never be required.
const STUCK_CAP = { easy: 5, normal: 25, hard: 50 };

const S = (id, title, note, colors, empty, target, extra = {}) => ({ id, title, note, kind: 'sort', colors, empty, target, ...extra });
const O = (id, title, note, orders, target, extra = {}) => ({ id, title, note, kind: 'orders', orders, slots: 2, empty: 0, extraCups: 1, target, ...extra });
const W1 = { world: 'Cozy Corner' }, W2 = { world: 'Pearl Grotto' }, W3 = { world: 'Fizz Falls' };
const easy = { tier: 'easy' }, hard = { tier: 'hard' };

// `tutorial` keys drive the in-game coach marks (see play.html).
const PACK = [
  // ---- World 1 · Cozy Corner — learn to pour ------------------------------------------
  S('1-1', 'First Pour', 'Tap a cup, then tap where to pour.', ['T', 'M', 'G'], 2, 5, { ...W1, ...easy, tutorial: 'basics' }),
  S('1-2', 'Warm Up', 'Same flavour on same flavour.', ['T', 'M', 'G'], 2, 7, { ...W1, ...easy }),
  S('1-3', 'Morning Rush', 'Four flavours now.', ['T', 'M', 'G', 'S'], 2, 9, { ...W1 }),
  S('1-4', 'Tidy Shelf', 'Keep an empty cup for later.', ['T', 'M', 'G', 'S'], 2, 11, { ...W1 }),
  O('1-5', 'First Customers', 'Customers want full cups. Pour what their cup needs next.', ['TTTT', 'MMMM', 'GGGG'], 6, { ...W1, ...easy, extraCups: 0, tutorial: 'counter' }),
  S('1-6', 'Five Teas', 'Five flavours.', ['T', 'M', 'G', 'S', 'B'], 2, 12, { ...W1 }),
  S('1-7', 'Rainbow Row', 'Plan two pours ahead.', ['T', 'M', 'G', 'S', 'B'], 2, 14, { ...W1 }),
  O('1-8', 'Busy Counter', 'Four regulars at once.', ['TTTT', 'MMMM', 'GGGG', 'SSSS'], 8, { ...W1 }),
  S('1-9', 'Full Menu', 'Six flavours. Take your time.', ['T', 'M', 'G', 'S', 'B', 'R'], 2, 15, { ...W1 }),
  S('1-10', 'One Spare Cup', 'Boss level: only one empty cup.', ['T', 'M', 'G', 'S'], 1, 12, { ...W1, ...hard, tutorial: 'vial' }),
  // ---- World 2 · Pearl Grotto — pearls sink ---------------------------------------------
  S('2-1', 'Sinking Feeling', 'Pearls sink under any drink.', ['P', 'T', 'M'], 2, 6, { ...W2, ...easy, tutorial: 'pearls' }),
  S('2-2', 'Bubble Bed', 'Pearls can pour into any cup.', ['P', 'T', 'M', 'G'], 2, 8, { ...W2 }),
  S('2-3', 'Pearl Diver', 'Dig the pearls out from below.', ['P', 'T', 'M', 'G', 'S'], 2, 11, { ...W2 }),
  O('2-4', 'Pearl Milk Tea', 'Pearls go in first.', ['PTTT', 'PMMM', 'GGGG'], 8, { ...W2 }),
  S('2-5', 'Double Pearls', 'Two cups of pearls hide everywhere.', ['P', 'P', 'T', 'M', 'G'], 2, 11, { ...W2 }),
  S('2-6', 'Grotto Glow', 'Six ingredients.', ['P', 'T', 'M', 'G', 'S', 'B'], 2, 13, { ...W2 }),
  O('2-7', 'Tapioca Time', 'A queue of pearl lovers.', ['PTTT', 'PMMM', 'GGGG', 'PSSS'], 9, { ...W2 }),
  S('2-8', 'Deep Pearls', 'Lots of buried pearls.', ['P', 'P', 'T', 'M', 'G', 'S'], 2, 13, { ...W2 }),
  O('2-9', 'Moon Milk Tea', 'Layered drinks: black tea under moon milk.', ['KKWW', 'PKKK', 'WWWW', 'PKWW'], 11, { ...W2 }),
  S('2-10', 'Pearl Boss', 'Boss level: one empty cup.', ['P', 'T', 'M', 'G'], 1, 12, { ...W2, ...hard }),
  // ---- World 3 · Fizz Falls — soda floats ----------------------------------------------
  S('3-1', 'Fizzy Hello', 'Sparkle soda floats to the top.', ['F', 'T', 'M'], 2, 6, { ...W3, ...easy, tutorial: 'soda' }),
  S('3-2', 'Float On', 'Drinks slide under the soda.', ['F', 'T', 'M', 'G'], 2, 8, { ...W3 }),
  S('3-3', 'Sink & Float', 'Pearls sink, soda floats.', ['F', 'P', 'T', 'M'], 2, 9, { ...W3 }),
  O('3-4', 'Soda Toppers', 'Soda goes on last.', ['TTTF', 'MMFF', 'GGGG'], 7, { ...W3 }),
  S('3-5', 'Fizz Falls', 'Five ingredients.', ['F', 'T', 'M', 'G', 'S'], 2, 11, { ...W3 }),
  S('3-6', 'Bubble Trouble', 'Both kinds of magic.', ['F', 'P', 'T', 'M', 'G'], 2, 11, { ...W3 }),
  O('3-7', 'Party Order', 'Pearls, tea and fizz.', ['PTTF', 'PMMF', 'SSSS', 'GGGF'], 10, { ...W3, extraCups: 2 }),
  S('3-8', 'Double Fizz', 'Two cups of soda.', ['F', 'F', 'T', 'M', 'G'], 2, 11, { ...W3, tries: 60 }),
  S('3-9', 'Grand Brew', 'Pearls, soda and three teas.', ['F', 'P', 'T', 'M', 'S'], 2, 12, { ...W3, tries: 60 }),
  O('3-10', 'Grand Opening', 'Finale: the whole town is here.', ['PTTF', 'MMMF', 'PGGF', 'SSSS'], 12, { ...W3, ...hard, tries: 25 }),
];

function generate(spec) {
  let best = null;
  const tier = spec.tier || 'normal';
  const cap = STUCK_CAP[tier];
  for (let seed = 1; seed <= (spec.tries || 120); seed++) {
    const r = rng(seed * 7919 + spec.id.charCodeAt(0) * 31 + spec.id.charCodeAt(2));
    const lvl = spec.kind === 'sort' ? buildSort(spec, r) : buildOrders(spec, r);
    if (!lvl) continue;
    const casual = Boba.casualStuckRate(lvl, 150, rng(seed));
    if (casual > cap) continue; // too punishing without an ad
    const sol = Boba.solve(lvl, 600000);
    if (!sol.solvable || sol.optimal < 3) continue;
    const score = Math.abs(sol.optimal - spec.target);
    if (!best || score < best.score) best = { score, seed, lvl, sol };
    if (score === 0) break;
  }
  if (!best) throw new Error(`No deal for ${spec.id} under the ${tier} stuck cap (${cap}%)`);
  const trap = Boba.trapRate(best.lvl, 300, rng(best.seed));
  const casual = Boba.casualStuckRate(best.lvl, 400, rng(best.seed + 1));
  const { kind, colors, empty, extraCups, tries, target, ...meta } = spec;
  return {
    ...meta,
    tier,
    ...best.lvl,
    stats: { optimal: best.sol.optimal, target, branching: best.sol.branching, statesSearched: best.sol.states, casualStuckPct: casual, randomPlayStuckPct: trap, seed: best.seed },
    solution: best.sol.path,
  };
}

const only = process.argv.slice(2);
const previous = only.length ? require('./levels.json') : [];
// Cache finished levels by their spec so reruns only redo what changed (levels.cache.json, not shipped).
const cacheFile = path.join(__dirname, 'levels.cache.json');
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
const levels = PACK.map((spec) => {
  const sig = JSON.stringify(spec);
  if (!only.length && cache[spec.id] && cache[spec.id].sig === sig) { console.log(`${spec.id.padEnd(4)} (cached)`); return cache[spec.id].level; }
  if (only.length && !only.includes(spec.id)) return previous.find((l) => l.id === spec.id);
  const t0 = Date.now();
  const lvl = generate(spec);
  cache[spec.id] = { sig, level: lvl };
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  const s = lvl.stats;
  console.log(`${lvl.id.padEnd(4)} ${lvl.title.padEnd(16)} optimal=${String(s.optimal).padStart(2)} (target ${s.target})  branching=${s.branching}  casual stuck=${s.casualStuckPct}% (cap ${STUCK_CAP[lvl.tier]}%)  random stuck=${s.randomPlayStuckPct}%  [${Date.now() - t0}ms]`);
  return lvl;
});

const out = path.join(__dirname, 'levels');
fs.writeFileSync(out + '.json', JSON.stringify(levels, null, 2) + '\n');
fs.writeFileSync(out + '.js', '// Generated by generate.js — do not edit.\nwindow.LEVELS = ' + JSON.stringify(levels) + ';\n');
console.log(`\nWrote ${levels.length} levels to levels.json / levels.js`);
