const test = require('node:test');
const assert = require('node:assert');
const Core = require('../www/js/core.js');
const Levels = require('../www/js/levels.js');
const Pups = require('../www/js/pups.js');

const W1 = Levels.WORLDS[0];

test('World 1 is the Living Room with 40 levels', () => {
  assert.strictEqual(W1.name, 'Living Room');
  assert.strictEqual(W1.levels.length, 40);
  assert.strictEqual(new Set(W1.levels.map((l) => l.id)).size, 40);
});

test('every starting pattern is a valid 8x8 with no full line and a playable first tray', () => {
  for (const l of W1.levels) {
    assert.strictEqual(l.start.length, 8, l.id);
    for (const row of l.start) assert.match(row, /^[.#bC]{8}$/, `${l.id} row "${row}"`);
    const g = Core.createGame(1, { start: l.start, helpers: l.helpers });
    const { rows, cols } = Core.fullLines(g.board);
    assert.strictEqual(rows.length + cols.length, 0, `${l.id} starts with a full line`);
    assert.ok(!Core.isGameOver(g), `${l.id} has no legal first move`);
  }
});

test('crates appear exactly on gift levels, as a 2x2, and gifts are real pups', () => {
  for (const l of W1.levels) {
    const crate = l.start.join('').split('').filter((ch) => ch === 'C').length;
    assert.strictEqual(crate, l.gift ? 4 : 0, l.id);
    if (l.gift) assert.ok(Pups.BY_ID[l.gift], l.gift);
  }
  assert.strictEqual(W1.levels[19].gift, 'sprout');
  assert.strictEqual(W1.levels[39].gift, 'captain');
});

test('a dig every 5th level; bones everywhere else', () => {
  for (const l of W1.levels) assert.strictEqual(l.reward.type, l.n % 5 === 0 ? 'dig' : 'bones', l.id);
});

test('star thresholds rise and match the bands', () => {
  for (const l of W1.levels) {
    const [a, b, c] = Levels.starsFor(l);
    assert.ok(a < b && b < c, l.id);
  }
  // Every level is bot-tuned, and the 3-star bar gets far steeper relative to passing late in the world.
  const Tuning = require('../www/js/tuning.js');
  for (const l of W1.levels) assert.ok(Tuning[l.id], `${l.id} is tuned`);
  const ratio = (l) => Levels.starsFor(l)[2] / Levels.starsFor(l)[0];
  const avg = (ls) => ls.reduce((a, l) => a + ratio(l), 0) / ls.length;
  assert.ok(avg(W1.levels.slice(30)) > 2 * avg(W1.levels.slice(0, 10)), 'late 3 stars should be much harder');
  const [t1, t2, t3] = Levels.starsFor(W1.levels[0]);
  assert.strictEqual(Levels.starsForScore(W1.levels[0], t1 - 1), 0);
  assert.strictEqual(Levels.starsForScore(W1.levels[0], t2), 2);
  assert.strictEqual(Levels.starsForScore(W1.levels[0], t3 + 1), 3);
});

test('the crate needs two line clears; powers cannot break it', () => {
  const l = W1.levels[19];
  const g = Core.createGame(3, { start: [ '........', '........', '...CC...', '...CC...', '........', '........', '........', '........'] });
  // Row 2 is the crate's top row: fill the other 6 cells of row 2 with a piece we place last.
  const fillRow = (r) => { for (let c = 0; c < 8; c++) if (!g.board[Core.idx(r, c)]) g.board[Core.idx(r, c)] = 1; };
  fillRow(2); g.board[Core.idx(2, 7)] = 0;
  g.tray = [Object.assign(Core.makePiece(g, Core.SHAPE_BY_ID.dot), { special: null }), null, null];
  let res = Core.placePiece(g, 0, 2, 7);
  assert.ok(res.crateHit && !res.crateFreed);
  assert.ok(g.crate.cells.every((i) => g.board[i] === Core.CRATE_COLOR), 'crate survives the first clear');
  // Powers skip crate cells.
  Core.clearCells(g, g.crate.cells);
  assert.ok(g.crate.cells.every((i) => g.board[i] === Core.CRATE_COLOR));
  fillRow(3); g.board[Core.idx(3, 0)] = 0;
  g.tray = [Object.assign(Core.makePiece(g, Core.SHAPE_BY_ID.dot), { special: null }), null, null];
  res = Core.placePiece(g, 0, 3, 0);
  assert.ok(res.crateFreed);
  assert.ok(g.crate.cells.every((i) => g.board[i] === 0));
  assert.ok(l);
});

test('a golden bone doubles a clear; a tennis ball clears its row too', () => {
  const g = Core.createGame(4);
  g.board.fill(0); g.treats.fill(0);
  for (let c = 0; c < 7; c++) g.board[Core.idx(7, c)] = 1;
  g.board[Core.idx(0, 0)] = 1; // keep the board from emptying (no clean-board bonus)
  g.tray = [Object.assign(Core.makePiece(g, Core.SHAPE_BY_ID.dot), { treat: -1, special: { k: 0, type: Core.SPECIAL.GOLDEN } }), null, null];
  const res = Core.placePiece(g, 0, 7, 7);
  assert.ok(res.golden);
  assert.strictEqual(res.points, 1 + 10 * 2);

  const h = Core.createGame(5);
  h.board.fill(0); h.treats.fill(0);
  for (let r = 0; r < 7; r++) h.board[Core.idx(r, 0)] = 1; // column 0, missing row 7
  h.specials[Core.idx(3, 0)] = Core.SPECIAL.BALL;
  for (let c = 2; c < 6; c++) h.board[Core.idx(3, c)] = 2; // some blocks on the ball's row
  h.tray = [Object.assign(Core.makePiece(h, Core.SHAPE_BY_ID.dot), { treat: -1, special: null }), null, null];
  const r2 = Core.placePiece(h, 0, 7, 0);
  assert.deepStrictEqual(r2.ballRows, [3]);
  for (let c = 0; c < 8; c++) assert.strictEqual(h.board[Core.idx(3, c)], 0);
});
