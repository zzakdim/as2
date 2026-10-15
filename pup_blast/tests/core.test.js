const test = require('node:test');
const assert = require('node:assert');
const Core = require('../www/js/core.js');

function emptyGame(seed) {
  const g = Core.createGame(seed);
  g.board.fill(0);
  g.treats.fill(0);
  return g;
}
const piece = (id, color = 1, treat = -1) => {
  const s = Core.SHAPE_BY_ID[id];
  return { shapeId: id, cells: s.cells, w: s.w, h: s.h, color, treat };
};

test('every shape parses to at least one cell inside its bounds', () => {
  for (const s of Core.SHAPES) {
    assert.ok(s.cells.length > 0, s.id);
    for (const [r, c] of s.cells) assert.ok(r < s.h && c < s.w, s.id);
  }
});

test('canPlace rejects out of bounds and overlaps', () => {
  const g = emptyGame(1);
  const p = piece('i3h');
  assert.ok(Core.canPlace(g.board, p, 0, 5));
  assert.ok(!Core.canPlace(g.board, p, 0, 6));
  assert.ok(!Core.canPlace(g.board, p, -1, 0));
  g.board[1] = 3;
  assert.ok(!Core.canPlace(g.board, p, 0, 0));
});

test('completing a row and a column clears both and scores the combo', () => {
  const g = emptyGame(2);
  for (let c = 0; c < 7; c++) g.board[c] = 2; // row 0 missing col 7
  for (let r = 1; r < 8; r++) g.board[r * 8 + 7] = 2; // col 7 missing row 0
  g.treats[3] = 1;
  g.tray = [piece('dot', 5), piece('o2'), piece('o2')];
  const res = Core.placePiece(g, 0, 0, 7);
  assert.ok(res.ok);
  assert.deepStrictEqual(res.rows, [0]);
  assert.deepStrictEqual(res.cols, [7]);
  assert.strictEqual(res.cleared.length, 15);
  assert.strictEqual(res.treats, 1);
  assert.ok(res.boardClear, 'board should be empty');
  // 1 cell + lineScore(2)=30 * combo 1 + 300 board clear
  assert.strictEqual(res.points, 1 + 30 + 300);
  assert.strictEqual(g.board.filter(Boolean).length, 0);
});

test('combo survives two non-clearing moves and resets on the third', () => {
  const g = emptyGame(3);
  g.combo = 2;
  g.tray = [piece('dot'), piece('dot'), piece('dot')];
  Core.placePiece(g, 0, 7, 0);
  Core.placePiece(g, 1, 7, 2);
  assert.strictEqual(g.combo, 2);
  Core.placePiece(g, 2, 7, 4);
  assert.strictEqual(g.combo, 0);
});

test('a used-up tray is redealt and always holds a piece that fits', () => {
  const g = emptyGame(4);
  g.tray = [piece('dot'), null, null];
  const res = Core.placePiece(g, 0, 4, 4);
  assert.ok(res.dealt);
  assert.ok(g.tray.every(Boolean));
  for (let seed = 0; seed < 50; seed++) {
    const h = Core.createGame(seed);
    // nearly full checkerboard-ish board
    for (let i = 0; i < 64; i++) h.board[i] = (i * 7) % 5 === 0 ? 0 : 1;
    Core.dealTray(h);
    assert.ok(h.tray.some((p) => Core.fitsAnywhere(h.board, p)), `seed ${seed}`);
  }
});

test('game over is detected when nothing fits', () => {
  const g = emptyGame(5);
  for (let i = 0; i < 64; i++) g.board[i] = (Math.floor(i / 8) + i) % 2 ? 1 : 0; // checkerboard
  g.tray = [piece('o2'), piece('i2h'), piece('i2v')];
  assert.ok(Core.isGameOver(g));
  g.tray[1] = piece('dot');
  assert.ok(!Core.isGameOver(g));
});

test('powers clear what they promise', () => {
  const g = emptyGame(6);
  g.board.fill(1);
  const dig = Core.powerDig(g, 0, 0);
  assert.strictEqual(dig.cleared.length, 4);
  const zoom = Core.powerZoomies(g);
  assert.ok(zoom.cleared.length >= 13);
  const rev = Core.revive(g);
  assert.ok(rev.cleared.length > 0);
  for (let r = 2; r < 6; r++) for (let c = 2; c < 6; c++) assert.strictEqual(g.board[r * 8 + c], 0);
  assert.ok(g.tray.every((p) => p.cells.length <= 3));
});

test('a full random game never places illegally and ends', () => {
  const g = Core.createGame(42);
  let moves = 0;
  while (!Core.isGameOver(g) && moves < 2000) {
    let placed = false;
    for (let t = 0; t < 3 && !placed; t++) {
      const p = g.tray[t];
      if (!p) continue;
      for (let r = 0; r < 8 && !placed; r++) for (let c = 0; c < 8 && !placed; c++) {
        if (Core.canPlace(g.board, p, r, c)) { assert.ok(Core.placePiece(g, t, r, c).ok); placed = true; }
      }
    }
    assert.ok(placed);
    moves++;
  }
  assert.ok(g.score > 0);
});
