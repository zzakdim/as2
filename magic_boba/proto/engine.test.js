// Run: node magic_boba/proto/engine.test.js
const assert = require('assert');
const B = require('./engine');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ✓', name); };
const lvl = (cups, extra = {}) => ({ cups, cap: 4, mode: 'sort', ...extra });
const move = (cups, m) => B.applyMove(B.initState(lvl(cups)), m).cups;

t('liquid pours onto same liquid', () => assert.deepStrictEqual(move(['TT', 'T'], [0, 1]), ['', 'TTT']));
t('liquid refused on different liquid', () => assert.ok(!B.legalMoves(B.initState(lvl(['T', 'M']))).some(([a, b]) => a === 0 && b === 1)));
t('pearls sink under liquid', () => assert.deepStrictEqual(move(['P', 'MM'], [0, 1]), ['', 'PMM']));
t('soda floats onto anything', () => assert.deepStrictEqual(move(['F', 'TM'], [0, 1]), ['', 'TMF']));
t('liquid slides under soda onto matching liquid', () => assert.deepStrictEqual(move(['M', 'TMF'], [0, 1]), ['', 'TMMF']));
t('liquid refused when the layer under the soda differs', () =>
  assert.ok(!B.legalMoves(B.initState(lvl(['T', 'MF']))).some(([a, b]) => a === 0 && b === 1)));
t('liquid onto soda-only cup goes to the bottom', () => assert.deepStrictEqual(move(['T', 'FF'], [0, 1]), ['', 'TFF']));
t('pearls sink below liquid and soda', () => assert.deepStrictEqual(move(['P', 'TF'], [0, 1]), ['', 'PTF']));
t('pour amount limited by space', () => assert.deepStrictEqual(move(['TTT', 'TT'], [0, 1]), ['T', 'TTTT']));
t('landIndex: liquid under soda', () => assert.strictEqual(B.landIndex('PTF', 'T'), 2));
t('small vial leftovers do not win', () => assert.ok(!B.isWon({ cups: ['TTTT', 'MM', 'MM'], caps: [4, 4, 2], cap: 4, mode: 'sort' })));
t('orders: only next recipe ingredient accepted', () => {
  const s = B.initState({ cups: ['TP', 'T'], cap: 4, mode: 'orders', orders: ['PTT'], slots: 1 });
  assert.ok(!B.legalMoves(s).some(([a, b]) => b === 'o0' && a === 1)); // taro before pearls: refused
});
t('solver solves a soda level', () => {
  const r = B.solve(lvl(['TTFF', 'MTFF', 'MMT', 'M']));
  assert.ok(r.solvable);
});
const L = require('./levels.json');
t(`all ${L.length} shipped solutions replay to a win`, () => {
  for (const l of L) { let s = B.initState(l); for (const m of l.solution) s = B.applyMove(s, m); assert.ok(B.isWon(s), l.id); }
});
console.log(`${n} tests passed`);
