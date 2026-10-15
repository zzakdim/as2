// Bugs found by the bug hunt. Each test reproduces one, so it can't come back.
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../www/js/core.js');
const Powers = require('../www/js/powers.js');
const State = require('../www/js/state.js');
const Gacha = require('../www/js/gacha.js');
const { idx, SHAPE_BY_ID } = Core;
const E = '........';
const piece = (g, id) => Core.makePiece(g, SHAPE_BY_ID[id]);

test('helpful shapes are found (bare shapes have no color)', () => {
  const g = Core.createGame(1);
  for (let c = 0; c < 6; c++) g.board[idx(0, c)] = 1;
  assert.ok(Core.previewClears(g.board, SHAPE_BY_ID.i2h, 0, 6).rows.includes(0));
  assert.ok(Core.findHelpfulShape(g));
  Powers.use('clairvoyance', g);
  assert.ok(g.tray.some((p) => p.shapeId !== 'dot'), 'Crystal Ball deals real pieces');
});

test('lines a gust completes are scored and break crates', () => {
  // Column 7 is full except row 7; the gust pushes row 7's last block into it.
  const g = Core.createGame(3, { start: ['.......#', '.......#', '.......#', '.......#', '.......#', '.......#', '.......#', '......#.'], blower: { every: 3 } });
  g.blower.row = 7; g.blower.dir = 1;
  g.placements = 2; // the next placement is the gust
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  const before = g.score;
  const res = Core.placePiece(g, 0, 3, 3);
  assert.ok(res.hazard.settle && res.hazard.settle.lines === 1);
  assert.strictEqual(g.score - before, res.points, 'every point reported is banked');
  assert.ok(res.points > 1);
});

test('a line finished by a squirrel hop clears right away', () => {
  const g = Core.createGame(5, { start: ['S.......', E, E, E, E, E, E, E], squirrels: { every: 3 } });
  for (let c = 1; c < 8; c++) g.board[idx(7, c)] = 1; // row 7 needs only (7,0)
  g.squirrels[0].target = idx(7, 0);
  g.placements = 2;
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  const res = Core.placePiece(g, 0, 3, 3);
  assert.ok(res.hazard.settle && res.hazard.settle.lines >= 1);
  assert.deepStrictEqual(Core.fullLines(g.board), { rows: [], cols: [] });
});

test('Do-Over cannot undo a revive or a freed crate', () => {
  const g = Core.createGame(2);
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  Core.placePiece(g, 0, 0, 0);
  Core.revive(g);
  assert.strictEqual(g.history, null);
  const c = Core.createGame(2, { start: [E, E, E, '...CC...', '...CC...', E, E, E] });
  c.crate.hp = 1;
  for (let k = 0; k < 8; k++) if (!c.board[idx(3, k)]) c.board[idx(3, k)] = 1;
  c.board[idx(3, 0)] = 0;
  c.tray = [piece(c, 'dot'), piece(c, 'dot'), piece(c, 'dot')];
  const res = Core.placePiece(c, 0, 3, 0);
  assert.ok(res.crateFreed);
  assert.ok(!Powers.canUse('doover', c));
});

test('the tennis-ball bonus counts cells actually cleared, not empty ones', () => {
  const g = Core.createGame(1);
  for (let c = 0; c < 7; c++) g.board[idx(0, c)] = 1;
  g.specials[idx(0, 0)] = Core.SPECIAL.BALL; // the ball's own row is the completed row: no extra cells
  g.board[idx(5, 5)] = 1; // keep the board from clearing (no board-clear bonus)
  g.tray = [piece(g, 'dot'), piece(g, 'dot'), piece(g, 'dot')];
  const res = Core.placePiece(g, 0, 0, 7);
  assert.strictEqual(res.points, 1 + Core.lineScore(1));
});

test('powers do not count the gift crate as something to clear', () => {
  const g = Core.createGame(1, { start: [E, E, E, '...CC...', '...CC...', E, E, E] });
  assert.ok(!Powers.canUse('bigbang', g));
  assert.ok(!Powers.validTarget('nibble', g, 3, 3));
  const h = Core.createGame(1, { start: ['#.......', E, E, E, E, E, E, E] });
  assert.ok(!Powers.canUse('bassdrop', h), 'nothing in the middle 4x4');
});

test('Avalanche keeps ice armor, helpers and squirrels with their cells', () => {
  const g = Core.createGame(1, { start: ['i.......', 'S.......', E, E, E, E, E, '.#......'], squirrels: { every: 3 } });
  g.specials[idx(7, 1)] = Core.SPECIAL.GOLDEN;
  Powers.use('avalanche', g);
  assert.strictEqual(g.board[idx(1, 0)], Core.SQUIRREL_COLOR, 'squirrel stays put');
  assert.strictEqual(g.squirrels[0].at, idx(1, 0));
  const ice = g.board.findIndex((v) => v === Core.ICE_COLOR);
  assert.ok(ice >= 0 && g.armor[ice] === 1);
  assert.strictEqual(g.armor.filter(Boolean).length, 1);
  assert.strictEqual(g.specials[idx(7, 1)], Core.SPECIAL.GOLDEN);
});

test('one bad pup record no longer wipes the save', () => {
  const s = State.normalize({ bones: 5000, best: 12000, pups: { mochi: 2, biscuit: null, pudding: { level: 3 } }, levels: { 'w1-01': { stars: 3, best: 900 }, junk: 5 } });
  assert.strictEqual(s.bones, 5000);
  assert.strictEqual(s.best, 12000);
  assert.deepStrictEqual(s.pups.pudding, { level: 3, dupes: 0 });
  assert.ok(s.pups.mochi && !s.pups.biscuit);
  assert.strictEqual(s.levels['w1-01'].stars, 3);
  assert.ok(!('junk' in s.levels));
  // A record without dupes can still level up.
  const r = Gacha.grant(s, require('../www/js/pups.js').BY_ID.pudding);
  assert.strictEqual(s.pups.pudding.dupes, 1, JSON.stringify(r));
  assert.deepStrictEqual(State.normalize({ endless: { milestones: null } }).endless.milestones, []);
});

test('an unreadable save is backed up before starting over', () => {
  const store = { data: { [State.KEY]: '{oops' }, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  const s = State.load(store);
  assert.strictEqual(s.bones, State.STARTING_BONES);
  assert.strictEqual(store.data[State.KEY + '.bak'], '{oops');
});

test('the daily streak survives the 23-hour DST day', () => {
  // Any clock: yesterday's date is one calendar day back, whatever the hour count.
  const s = State.freshState();
  const now = new Date(2026, 2, 9, 0, 30).getTime();
  const y = new Date(2026, 2, 8, 12).getTime();
  s.daily.date = State.dayKey(y); s.daily.streak = 4;
  State.rollDaily(s, now);
  assert.strictEqual(s.daily.streak, 5);
});
