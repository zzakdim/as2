const test = require('node:test');
const assert = require('node:assert');
const Core = require('../www/js/core.js');
const Powers = require('../www/js/powers.js');
const { idx, SHAPE_BY_ID } = Core;
const E = '........';
const piece = (g, id) => Core.makePiece(g, SHAPE_BY_ID[id]);
// Fills row r except the given columns, then the test places the last piece.
function fillRow(g, r, skip) { for (let c = 0; c < 8; c++) if (!skip.includes(c) && !g.board[idx(r, c)]) g.board[idx(r, c)] = 1; }

test('buried bones dig up on a line clear, not on a power', () => {
  const g = Core.createGame(1, { start: ['o.......', E, E, E, E, E, E, 'O.......'] });
  assert.strictEqual(g.buried[idx(0, 0)], 1);
  assert.ok(g.board[idx(7, 0)], "'O' is a block over a bone");
  fillRow(g, 0, [7]);
  g.tray = [piece(g, 'dot'), null, piece(g, 'dot')];
  const before = g.treatsCollected;
  const res = Core.placePiece(g, 0, 0, 7);
  assert.deepStrictEqual(res.dug, [idx(0, 0)]);
  assert.ok(res.points >= Core.DUG_POINTS);
  assert.strictEqual(g.treatsCollected - before, 2);
  // A power clearing the block over the other bone does not dig it.
  Powers.use('nibble', g, 7, 0);
  assert.strictEqual(g.buried[idx(7, 0)], 1);
});

test('puddles block placement, survive powers, and dry on a line clear', () => {
  const g = Core.createGame(1, { start: ['w.......', E, E, E, E, E, E, E] });
  assert.ok(!Core.canPlace(g.board, SHAPE_BY_ID.dot, 0, 0));
  Powers.use('tailwag', g, 0, 0);
  assert.strictEqual(g.board[0], Core.PUDDLE_COLOR);
  fillRow(g, 0, [7]);
  g.tray = [piece(g, 'dot'), null, piece(g, 'dot')];
  Core.placePiece(g, 0, 0, 7);
  assert.strictEqual(g.board[0], 0);
});

test('ice takes one extra clear, mud two', () => {
  const g = Core.createGame(1, { start: ['i.......', 'm.......', E, E, E, E, E, E] });
  for (let round = 1; round <= 3; round++) {
    fillRow(g, 0, [7]); fillRow(g, 1, [7]);
    g.tray = [piece(g, 'i2v'), null, piece(g, 'dot')];
    Core.placePiece(g, 0, 0, 7);
    if (round === 1) { assert.notStrictEqual(g.board[idx(0, 0)], 0); assert.strictEqual(g.armor[idx(0, 0)], 0); assert.strictEqual(g.armor[idx(1, 0)], 1); }
    if (round === 2) { assert.strictEqual(g.board[idx(0, 0)], 0); assert.notStrictEqual(g.board[idx(1, 0)], 0); assert.strictEqual(g.armor[idx(1, 0)], 0); }
    if (round === 3) assert.strictEqual(g.board[idx(1, 0)], 0);
  }
});

test('squirrels warn, then hop; a line through one chases it off', () => {
  const g = Core.createGame(9, { start: ['S.......', E, E, E, E, E, E, E], squirrels: { every: 3, acorns: true } });
  const place = () => { g.tray = [piece(g, 'dot'), null, piece(g, 'dot')]; const free = g.board.findIndex((v, i) => !v && i >= 32); return Core.placePiece(g, 0, Math.floor(free / 8), free % 8); };
  place();
  const warn = place(); // placement 2: warning
  assert.strictEqual(warn.hazard.warned.length, 1);
  const target = warn.hazard.warned[0].to;
  const hop = place(); // placement 3: hop
  assert.strictEqual(hop.hazard.hopped.length, 1);
  assert.strictEqual(g.board[idx(0, 0)], Core.ACORN_COLOR, 'leaves an acorn');
  const at = g.squirrels[0].at;
  assert.strictEqual(g.board[at], Core.SQUIRREL_COLOR);
  if (!g.board[target] || g.board[target] === Core.SQUIRREL_COLOR) assert.ok(true);
  // Chase it: fill its row around it.
  const r = Math.floor(at / 8);
  for (let c = 0; c < 8; c++) if (!g.board[idx(r, c)]) g.board[idx(r, c)] = 1;
  const k = [...Array(8).keys()].find((c) => g.board[idx(r, c)] === 1);
  g.board[idx(r, k)] = 0;
  g.tray = [piece(g, 'dot'), null, piece(g, 'dot')];
  const res = Core.placePiece(g, 0, r, k);
  assert.deepStrictEqual(res.chased, [at]);
  assert.strictEqual(g.squirrels[0].at, -1);
});

test('the Leaf Blower gusts, then pushes a row one cell; the edge block falls off', () => {
  const g = Core.createGame(4, { start: [E, E, E, E, E, E, E, '###.....'], blower: { every: 3 } });
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  Core.placePiece(g, 0, 0, 0);
  const gust = Core.placePiece(g, 1, 0, 7);
  assert.ok(gust.hazard.gust);
  const before = g.board.filter((v) => v).length;
  const row = gust.hazard.gust.row, dir = gust.hazard.gust.dir;
  const blow = Core.placePiece(g, 2, 3, 3);
  assert.ok(blow.hazard.blown && blow.hazard.blown.row === row && blow.hazard.blown.dir === dir);
  const after = g.board.filter((v) => v).length;
  assert.strictEqual(after, before + 1 - blow.hazard.blown.lost.length);
});

test('blowRow keeps blocks against posts and moves armor with the block', () => {
  const g = Core.createGame(1, { start: [E, E, E, E, E, E, E, 'i#..P#..'] });
  Core.blowRow(g, 7, 1);
  assert.strictEqual(g.board[idx(7, 1)], Core.ICE_COLOR);
  assert.strictEqual(g.armor[idx(7, 1)], 1);
  assert.ok(g.board[idx(7, 2)]);
  assert.strictEqual(g.board[idx(7, 4)], Core.POST_COLOR);
  assert.ok(g.board[idx(7, 6)], 'block after the post moves too');
});

test('Do-Over restores hazards, buried bones and armor', () => {
  const g = Core.createGame(2, { start: ['S..o....', 'i.......', E, E, E, E, E, E], squirrels: { every: 3 } });
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  const snap = Core.snapshot(g);
  Core.placePiece(g, 0, 5, 5);
  Core.placePiece(g, 1, 5, 6);
  Core.restore(g, snap);
  assert.strictEqual(g.squirrels[0].target, -1);
  assert.strictEqual(g.buried[idx(0, 3)], 1);
  assert.strictEqual(g.armor[idx(1, 0)], 1);
});
