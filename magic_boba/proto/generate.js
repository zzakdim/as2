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

// Deal tokens at random into cups of the given capacities (odd jars included).
function dealCaps(tokens, caps, r) {
  const cups = caps.map(() => '');
  for (const t of shuffle(tokens.slice(), r)) {
    const open = caps.map((c, i) => i).filter((i) => cups[i].length < caps[i]);
    cups[open[Math.floor(r() * open.length)]] += t;
  }
  return cups.map(settle);
}

// `jars`: extra odd-sized jars (2 = half jar, 1 = single jar) that are dealt into too, so they start
// with drinks in them; they must end up empty, which makes them awkward scratch space.
function buildSort(spec, r) {
  const cap = spec.cap || 4, tokens = [];
  for (const c of spec.colors) tokens.push(...c.repeat(cap));
  let cups, caps;
  if (spec.jars) {
    caps = spec.colors.map(() => cap).concat(spec.jars);
    cups = dealCaps(tokens, caps, r);
  } else {
    cups = deal(tokens, spec.colors.length, cap, r, true);
    caps = cups.map(() => cap);
  }
  for (let i = 0; i < spec.empty; i++) { cups.push(''); caps.push(cap); }
  // Reject deals where a cup is already finished.
  if (cups.some((c, i) => c.length === cap && caps[i] >= cap && Boba.topRun(c) === c.length)) return null;
  return { mode: 'sort', cap, cups, caps };
}

function buildOrders(spec, r) {
  const cap = spec.cap || 4;
  const tokens = spec.orders.join('').split('');
  const caps = Array.from({ length: Math.ceil(tokens.length / cap) }, () => cap).concat(spec.jars || []);
  const cups = dealCaps(tokens, caps, r);
  for (let i = 0; i < (spec.empty || 0); i++) { cups.push(''); caps.push(cap); }
  // Reject deals that hand out a finished order for free.
  if (cups.some((c) => spec.orders.includes(c))) return null;
  return { mode: 'orders', cap, cups, caps, orders: spec.orders.slice(), slots: spec.slots || 2 };
}

// Difficulty tiers: max % of casual-player runs (engine.casualStuckRate) allowed to get stuck
// with NO bonus vials. Ads should rescue frustration, never be required.
const STUCK_CAP = { easy: 5, normal: 25, tough: 40, hard: 50 };
// `minTrap` (per spec) is the floor: the % of random playthroughs that dead-end. Levels with few
// wrong turns feel trivially easy, so later worlds reject deals below their floor.

const S = (id, title, note, colors, empty, target, extra = {}) => ({ id, title, note, kind: 'sort', colors, empty, target, ...extra });
const O = (id, title, note, orders, target, extra = {}) => ({ id, title, note, kind: 'orders', orders, slots: 2, empty: 0, extraCups: 1, target, ...extra });
const W1 = { world: 'Cozy Corner' };
const W2 = { world: 'Pearl Grotto', minTrap: 12 };
const W3 = { world: 'Fizz Falls', tier: 'tough', minTrap: 18 };
const W4 = { world: 'Moonlight Market', tier: 'tough', minTrap: 25 };
const easy = { tier: 'easy', minTrap: 0 }, hard = { tier: 'hard' };

// `tutorial` keys drive the in-game coach marks (see play.html).
// Customer levels: build a jar that matches an order and the customer takes it (the jar leaves).
const PACK = [
  // ---- World 1 · Cozy Corner — learn to pour ------------------------------------------
  S('1-1', 'First Pour', 'Tap a cup, then tap where to pour.', ['T', 'M', 'G'], 2, 5, { ...W1, ...easy, tutorial: 'basics' }),
  S('1-2', 'Warm Up', 'Same flavour on same flavour.', ['T', 'M', 'G'], 2, 7, { ...W1, ...easy }),
  S('1-3', 'Morning Rush', 'Four flavours now.', ['T', 'M', 'G', 'S'], 2, 9, { ...W1 }),
  S('1-4', 'Tidy Shelf', 'Keep an empty cup for later.', ['T', 'M', 'G', 'S'], 2, 11, { ...W1 }),
  O('1-5', 'First Customers', 'Make the drink a customer wants. They take the jar!', ['TTTT', 'MMMM', 'GGGG'], 6, { ...W1, ...easy, empty: 2, tutorial: 'counter' }),
  S('1-6', 'Five Teas', 'Five flavours.', ['T', 'M', 'G', 'S', 'B'], 2, 12, { ...W1 }),
  S('1-7', 'Rainbow Row', 'Plan two pours ahead.', ['T', 'M', 'G', 'S', 'B'], 2, 14, { ...W1 }),
  O('1-8', 'Busy Counter', 'Every jar you serve leaves the shelf.', ['TTTT', 'MMMM', 'GGGG', 'SSSS'], 9, { ...W1, empty: 1 }),
  S('1-9', 'Full Menu', 'Six flavours. Take your time.', ['T', 'M', 'G', 'S', 'B', 'R'], 2, 15, { ...W1 }),
  S('1-10', 'One Spare Cup', 'Boss level: only one empty cup.', ['T', 'M', 'G', 'S'], 1, 12, { ...W1, ...hard, tutorial: 'vial' }),
  // ---- World 2 · Pearl Grotto — pearls sink, small jars appear --------------------------
  S('2-1', 'Sinking Feeling', 'Pearls sink under any drink.', ['P', 'T', 'M'], 2, 6, { ...W2, ...easy, tutorial: 'pearls' }),
  S('2-2', 'Half Jar', 'A half jar holds two. Empty it to finish.', ['P', 'T', 'M', 'G'], 1, 10, { ...W2, jars: [2], tutorial: 'jars' }),
  S('2-3', 'Pearl Diver', 'Dig the pearls out from below.', ['P', 'T', 'M', 'G', 'S'], 2, 12, { ...W2 }),
  O('2-4', 'Pearl Milk Tea', 'Pearls go in first.', ['PTTT', 'PMMM', 'GGGG'], 10, { ...W2, empty: 2 }),
  S('2-5', 'Double Pearls', 'Two cups of pearls hide everywhere.', ['P', 'P', 'T', 'M', 'G'], 1, 13, { ...W2, jars: [2] }),
  S('2-6', 'Grotto Glow', 'Six ingredients.', ['P', 'T', 'M', 'G', 'S', 'B'], 2, 15, { ...W2 }),
  O('2-7', 'Tapioca Time', 'A queue of pearl lovers.', ['PTTT', 'PMMM', 'GGGG', 'PSSS'], 12, { ...W2, empty: 2, jars: [1] }),
  S('2-8', 'Tiny Jars', 'A half jar and a single jar.', ['P', 'T', 'M', 'G'], 1, 13, { ...W2, jars: [2, 1], minTrap: 5, tier: 'tough' }),
  O('2-9', 'Moon Milk Tea', 'Black tea and moon milk, with or without pearls.', ['PKKK', 'WWWW', 'PWWW', 'KKKK'], 13, { ...W2, empty: 2 }),
  S('2-10', 'Pearl Boss', 'Boss level: one empty cup and a single jar.', ['P', 'T', 'M', 'G', 'S'], 1, 16, { ...W2, ...hard, jars: [1] }),
  // ---- World 3 · Fizz Falls — soda floats ----------------------------------------------
  S('3-1', 'Fizzy Hello', 'Sparkle soda floats to the top.', ['F', 'T', 'M'], 2, 6, { ...W3, ...easy, tutorial: 'soda' }),
  S('3-2', 'Float On', 'Drinks slide under the soda.', ['F', 'T', 'M', 'G'], 1, 10, { ...W3, jars: [2], minTrap: 8 }),
  S('3-3', 'Sink & Float', 'Pearls sink, soda floats.', ['F', 'P', 'T', 'M'], 1, 11, { ...W3, jars: [2] }),
  O('3-4', 'Soda Toppers', 'Soda goes on last.', ['TTTF', 'MMFF', 'GGGG'], 9, { ...W3, empty: 1, minTrap: 8 }),
  S('3-5', 'Fizz Falls', 'Five ingredients and a single jar.', ['F', 'T', 'M', 'G', 'S'], 2, 13, { ...W3, jars: [1], minTrap: 4 }),
  S('3-6', 'Bubble Trouble', 'Both kinds of magic.', ['F', 'P', 'T', 'M', 'G'], 1, 13, { ...W3, jars: [2], tries: 60 }),
  O('3-7', 'Party Order', 'Pearls, tea and fizz.', ['PTTF', 'PMMF', 'SSSS', 'GGGF'], 12, { ...W3, empty: 2, tries: 40 }),
  S('3-8', 'Double Fizz', 'Two cups of soda.', ['F', 'F', 'T', 'M', 'G'], 1, 13, { ...W3, jars: [2], tries: 60, minTrap: 10 }),
  S('3-9', 'Grand Brew', 'Pearls, soda and three teas.', ['F', 'P', 'T', 'M', 'S'], 1, 14, { ...W3, jars: [2], tries: 60, minTrap: 5 }),
  O('3-10', 'Grand Opening', 'Boss level: the whole town is here.', ['PTTF', 'MMMF', 'PGGF', 'SSSS'], 14, { ...W3, ...hard, empty: 2, jars: [1], tries: 40, minTrap: 10 }),
  // ---- World 4 · Moonlight Market — everything, tighter ---------------------------------
  S('4-1', 'Night Market', 'Two half jars, one empty cup.', ['T', 'M', 'G', 'S', 'B'], 1, 15, { ...W4, jars: [2, 2] }),
  S('4-2', 'Moon & Fizz', 'Pearls and soda in tight spaces.', ['P', 'F', 'T', 'M'], 1, 13, { ...W4, jars: [2, 1], tries: 60, minTrap: 12 }),
  O('4-3', 'Lantern Line', 'Every jar served is a jar gone.', ['PTTT', 'MMFF', 'SSSS', 'PGGG'], 13, { ...W4, empty: 1, jars: [2], tries: 40, minTrap: 12 }),
  S('4-4', 'Full Moon Menu', 'Six flavours, one spare cup.', ['T', 'M', 'G', 'S', 'B', 'R'], 1, 17, { ...W4, jars: [2] }),
  S('4-5', 'Pearl Market', 'Lots of pearls, tiny jars.', ['P', 'P', 'F', 'T', 'M'], 1, 15, { ...W4, jars: [1, 1], tries: 60 }),
  O('4-6', 'Night Owls', 'Late-night tea orders.', ['KKWW', 'PKKK', 'WWWF', 'TTTT'], 13, { ...W4, empty: 2, jars: [1], tries: 40 }),
  S('4-7', 'Starlit Shelf', 'Pearls, soda and three flavours.', ['P', 'F', 'T', 'M', 'G'], 1, 15, { ...W4, jars: [2], tries: 60, minTrap: 8 }),
  S('4-8', 'Fizz Frenzy', 'Two sodas, pearls and two teas.', ['F', 'F', 'P', 'T', 'M'], 1, 15, { ...W4, jars: [2], tries: 60, minTrap: 12 }),
  O('4-9', 'Midnight Rush', 'Five customers, little room.', ['PTTF', 'PMMF', 'PGGF', 'SSSS', 'BBBB'], 16, { ...W4, empty: 2, tries: 30 }),
  S('4-10', 'Moonlight Boss', 'Final boss: one empty cup, one single jar.', ['P', 'F', 'T', 'M', 'G'], 1, 17, { ...W4, ...hard, jars: [1], tries: 60 }),
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
    if (spec.minTrap && Boba.trapRate(lvl, 150, rng(seed + 99)) < spec.minTrap) continue; // too forgiving for this point in the game
    const sol = Boba.solve(lvl, 600000);
    if (!sol.solvable || sol.optimal < 3) continue;
    const score = Math.abs(sol.optimal - spec.target);
    if (!best || score < best.score) best = { score, seed, lvl, sol };
    if (score === 0) break;
  }
  if (!best) throw new Error(`No deal for ${spec.id} with casual stuck ≤ ${cap}% and random dead-ends ≥ ${spec.minTrap || 0}%`);
  const trap = Boba.trapRate(best.lvl, 300, rng(best.seed));
  const casual = Boba.casualStuckRate(best.lvl, 400, rng(best.seed + 1));
  const { kind, colors, empty, extraCups, tries, target, jars, minTrap, ...meta } = spec;
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
const failed = [];
const levels = PACK.map((spec) => {
  const sig = JSON.stringify(spec);
  if (!only.length && cache[spec.id] && cache[spec.id].sig === sig) { console.log(`${spec.id.padEnd(4)} (cached)`); return cache[spec.id].level; }
  if (only.length && !only.includes(spec.id)) return previous.find((l) => l.id === spec.id);
  const t0 = Date.now();
  let lvl;
  try { lvl = generate(spec); } catch (e) { failed.push(spec.id); console.log(`${spec.id.padEnd(4)} FAILED: ${e.message}`); return null; }
  cache[spec.id] = { sig, level: lvl };
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  const s = lvl.stats;
  console.log(`${lvl.id.padEnd(4)} ${lvl.title.padEnd(16)} optimal=${String(s.optimal).padStart(2)} (target ${s.target})  branching=${s.branching}  casual stuck=${s.casualStuckPct}% (cap ${STUCK_CAP[lvl.tier]}%)  random stuck=${s.randomPlayStuckPct}%  [${Date.now() - t0}ms]`);
  return lvl;
});

if (failed.length) { console.log(`\n${failed.length} level(s) failed: ${failed.join(', ')}. Finished levels are cached; adjust the specs and rerun.`); process.exit(1); }
const out = path.join(__dirname, 'levels');
fs.writeFileSync(out + '.json', JSON.stringify(levels, null, 2) + '\n');
fs.writeFileSync(out + '.js', '// Generated by generate.js — do not edit.\nwindow.LEVELS = ' + JSON.stringify(levels) + ';\n');
console.log(`\nWrote ${levels.length} levels to levels.json / levels.js`);
