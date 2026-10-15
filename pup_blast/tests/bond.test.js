const test = require('node:test');
const assert = require('node:assert');
const Pups = require('../www/js/pups.js');
const Core = require('../www/js/core.js');

test('bond levels: 1 to 10, +3% score per level above 1', () => {
  assert.strictEqual(Pups.bondLevel(0), 1);
  assert.strictEqual(Pups.bondLevel(undefined), 1);
  assert.strictEqual(Pups.bondLevel(99), 1);
  assert.strictEqual(Pups.bondLevel(100), 2);
  assert.strictEqual(Pups.bondLevel(4500), 10);
  assert.strictEqual(Pups.bondLevel(1e9), 10);
  assert.strictEqual(Pups.bondBonus(1), 0);
  assert.ok(Math.abs(Pups.bondBonus(10) - 0.27) < 1e-9);
  for (let k = 1; k < Pups.BOND.XP.length; k++) assert.ok(Pups.BOND.XP[k] > Pups.BOND.XP[k - 1]);
});

test('runs and feeding add bond XP, capped at max', () => {
  const rec = { level: 1, dupes: 0 };
  assert.strictEqual(Pups.bondXpForRun(1000), 50);
  assert.deepStrictEqual(Pups.addBond(rec, 120), { from: 1, to: 2 });
  assert.strictEqual(Pups.bondToNext(rec.bond), 180);
  Pups.addBond(rec, 1e6);
  assert.strictEqual(rec.bond, 4500);
  assert.strictEqual(Pups.bondToNext(rec.bond), 0);
});

test('the score bonus scales every point, and no bond scores exactly as before', () => {
  const play = (bonus) => {
    const g = Core.createGame(42, { scoreBonus: bonus });
    for (let n = 0; n < 40 && !Core.isGameOver(g); n++) {
      let done = false;
      for (let t = 0; t < 3 && !done; t++) {
        const p = g.tray[t];
        if (!p) continue;
        for (let r = 0; r < 8 && !done; r++) for (let c = 0; c < 8 && !done; c++) if (Core.canPlace(g.board, p, r, c)) { Core.placePiece(g, t, r, c); done = true; }
      }
    }
    return g.score;
  };
  const base = play(0), boosted = play(0.27);
  assert.ok(base > 0);
  assert.strictEqual(play(undefined), base);
  assert.ok(boosted >= Math.floor(base * 1.25) && boosted <= Math.ceil(base * 1.29), `${base} -> ${boosted}`);
});
