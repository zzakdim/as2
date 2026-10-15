const test = require('node:test');
const assert = require('node:assert');
const Core = require('../www/js/core.js');
const Powers = require('../www/js/powers.js');
const Pups = require('../www/js/pups.js');

function fullGame(seed) {
  const g = Core.createGame(seed);
  g.board.fill(0); g.treats.fill(0);
  for (let i = 0; i < 64; i++) g.board[i] = 1 + (i % 7);
  return g;
}
const count = (g) => g.board.filter(Boolean).length;

test('every pup has its own power, and every power exists', () => {
  const used = Pups.ROSTER.map((p) => p.power);
  assert.strictEqual(new Set(used).size, Pups.ROSTER.length, 'powers should be unique per pup');
  for (const id of used) assert.ok(Powers.POWERS[id], id);
});

test('power strength matches rarity, and reserved powers stay off the roster', () => {
  const TIER = { common: 1, rare: 2, epic: 3, legendary: 4 };
  for (const p of Pups.ROSTER) {
    const pw = Powers.POWERS[p.power];
    assert.strictEqual(pw.tier, TIER[p.rarity], `${p.name} (${p.rarity}) has ${pw.name} (tier ${pw.tier})`);
    assert.ok(!pw.reserved, `${p.name} uses reserved ${pw.name}`);
  }
  const reserved = Object.keys(Powers.POWERS).filter((id) => Powers.POWERS[id].reserved);
  assert.deepStrictEqual(reserved.sort(), ['avalanche', 'dropthebeat', 'herd', 'hopscotch', 'trim']);
});

test('piece-swap powers hand you a guaranteed shape', () => {
  const g = fullGame(11);
  g.board.fill(0);
  g.tray = [Core.makePiece(g, Core.SHAPE_BY_ID.o3), Core.makePiece(g, Core.SHAPE_BY_ID.dot), Core.makePiece(g, Core.SHAPE_BY_ID.dot)];
  const res = Powers.use('goodsit', g);
  assert.strictEqual(res.swapped, 0, 'swaps the biggest piece');
  assert.strictEqual(g.tray[0].shapeId, 'o2');
  Powers.use('stick', g);
  assert.ok(g.tray.some((p) => p.shapeId === 'i4h' || p.shapeId === 'i4v'));
  // A piece that can't fit is swapped first.
  g.board.fill(1); g.board[0] = 0; g.board[1] = 0; g.board[8] = 0; g.board[9] = 0;
  g.tray = [Core.makePiece(g, Core.SHAPE_BY_ID.dot), Core.makePiece(g, Core.SHAPE_BY_ID.i5h), Core.makePiece(g, Core.SHAPE_BY_ID.dot)];
  assert.strictEqual(Powers.use('goodsit', g).swapped, 1);
});

test('charges grow by one per level and copies needed grow too', () => {
  const pup = Pups.BY_ID.mochi;
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((l) => Pups.chargesFor(pup, l)), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(Pups.copiesToNext), [1, 2, 3, 4, 0]);
});

test('area powers clear the expected number of blocks on a full board', () => {
  const expect = { nibble: 1, scratch: 4, shakeoff: 4, dig: 9, cannonball: 25, tailwag: 8, pounce: 8, howl: 8, zigzag: 16, zoomies: 15, bassdrop: 16, trim: 28, hopscotch: 32, dropthebeat: 28, spotted: 8, bigbang: 64 };
  for (const [id, n] of Object.entries(expect)) {
    const g = fullGame(1);
    const res = Powers.use(id, g, 3, 3);
    assert.strictEqual(res.cleared.length, n, id);
    assert.strictEqual(count(g), 64 - n, id);
  }
});

test('sniff clears exactly one color', () => {
  const g = fullGame(2);
  const color = g.board[0];
  const before = g.board.filter((v) => v === color).length;
  const res = Powers.use('sniff', g, 0, 0);
  assert.strictEqual(res.cleared.length, before);
  assert.ok(!g.board.includes(color));
  g.board[0] = 0;
  assert.ok(!Powers.validTarget('sniff', g, 0, 0), 'empty cell is not a valid sniff target');
});

test('avalanche drops blocks and clears the lines it completes', () => {
  const g = Core.createGame(3);
  g.board.fill(0); g.treats.fill(0);
  // one block per column, scattered in height: they should land on the bottom row and clear it
  for (let c = 0; c < 8; c++) g.board[Core.idx(c % 5, c)] = 2;
  g.board[Core.idx(0, 0)] = 3; g.board[Core.idx(2, 0)] = 0; // column 0 has its block at row 0
  const res = Powers.use('avalanche', g);
  assert.strictEqual(res.lines, 1);
  assert.strictEqual(count(g), 0);
});

test('herd slides blocks left', () => {
  const g = Core.createGame(4);
  g.board.fill(0); g.treats.fill(0);
  g.board[Core.idx(0, 5)] = 4; g.treats[Core.idx(0, 5)] = 1;
  Powers.use('herd', g);
  assert.strictEqual(g.board[Core.idx(0, 0)], 4);
  assert.strictEqual(g.treats[Core.idx(0, 0)], 1);
  assert.strictEqual(g.board[Core.idx(0, 5)], 0);
});

test('spin rotates pieces a quarter turn', () => {
  const s = Core.SHAPE_BY_ID.i3h;
  const p = { cells: s.cells, w: s.w, h: s.h, color: 1, treat: -1 };
  const r = Powers.rotate(p);
  assert.strictEqual(r.w, 1); assert.strictEqual(r.h, 3);
  assert.deepStrictEqual(r.cells.map(String).sort(), ['0,0', '1,0', '2,0']);
});

test('do-over undoes the last placement and only once', () => {
  const g = Core.createGame(5);
  g.board.fill(0); g.treats.fill(0);
  const snapTray = g.tray.map((p) => p && p.shapeId);
  assert.ok(!Powers.canUse('doover', g));
  let placed = false;
  for (let r = 0; r < 8 && !placed; r++) for (let c = 0; c < 8 && !placed; c++) placed = Core.placePiece(g, 0, r, c).ok;
  assert.ok(Powers.canUse('doover', g));
  Powers.use('doover', g);
  assert.strictEqual(count(g), 0);
  assert.strictEqual(g.score, 0);
  assert.deepStrictEqual(g.tray.map((p) => p && p.shapeId), snapTray);
  assert.ok(!Powers.canUse('doover', g));
});

test('tray powers replace the tray as described', () => {
  const g = fullGame(6);
  g.board.fill(0);
  Powers.use('pampered', g);
  assert.ok(g.tray.every((p) => p.cells.length === 1));
  Powers.use('nap', g);
  assert.ok(g.tray.every((p) => p.cells.length <= 3));
  for (let c = 0; c < 7; c++) g.board[c] = 1; // row 0 needs one block
  Powers.use('clairvoyance', g);
  for (const p of g.tray) {
    let clears = false;
    for (let r = 0; r < 8 && !clears; r++) for (let c = 0; c < 8 && !clears; c++) {
      const pc = Core.previewClears(g.board, p, r, c);
      clears = !!pc && pc.rows.length + pc.cols.length > 0;
    }
    assert.ok(clears, 'each crystal ball piece completes a line');
  }
});

test('treat toss hides treats in filled blocks', () => {
  const g = fullGame(7);
  const res = Powers.use('treattoss', g);
  assert.strictEqual(res.treated.length, 4);
  assert.strictEqual(g.treats.filter(Boolean).length, 4);
});

test('previewCells matches what the power then clears, without changing the game', () => {
  const g = fullGame(8);
  const preview = Powers.previewCells('cannonball', g, 4, 4);
  assert.strictEqual(count(g), 64);
  const res = Powers.use('cannonball', g, 4, 4);
  assert.deepStrictEqual(preview.sort((a, b) => a - b), res.cleared.map((x) => x.i).sort((a, b) => a - b));
});

test('board-clearing powers are unavailable on an empty board', () => {
  const g = Core.createGame(9);
  g.board.fill(0);
  for (const id of ['dig', 'bigbang', 'avalanche', 'sniff', 'scratch', 'nibble', 'shakeoff']) assert.ok(!Powers.canUse(id, g), id);
  for (const id of ['fetch', 'nap', 'pampered', 'spin', 'goodsit', 'stick']) assert.ok(Powers.canUse(id, g), id);
  assert.ok(!Powers.canUse('guardian', g), 'guardian is passive');
});
