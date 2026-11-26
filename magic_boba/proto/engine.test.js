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
t('orders: a customer takes the matching jar and it leaves the shelf', () => {
  const s = B.initState({ cups: ['TTT', 'MT', ''], cap: 4, mode: 'orders', orders: ['TTTT', 'MMMM'], slots: 1 });
  const n = B.applyMove(s, [1, 0]); // pour the T onto TTT -> TTTT -> served
  assert.deepStrictEqual(n.cups, ['M', '']);
  assert.deepStrictEqual(n.open.map((o) => o.i), [1]);
});
t('orders: no pouring into customers any more', () => {
  const s = B.initState({ cups: ['TT', 'TT'], cap: 4, mode: 'orders', orders: ['TTTT'], slots: 1 });
  assert.ok(B.legalMoves(s).every(([, b]) => typeof b === 'number'));
});
t('orders: a newly arrived customer takes a ready jar at once', () => {
  const s = B.initState({ cups: ['TTT', 'T', 'MMMM'], cap: 4, mode: 'orders', orders: ['TTTT', 'MMMM'], slots: 1 });
  const n = B.applyMove(s, [1, 0]);
  assert.deepStrictEqual(n.cups, ['']);
  assert.ok(B.isWon(n));
});
t('orders: layered recipe must match exactly', () => {
  const s = B.initState({ cups: ['P', 'TTT', ''], cap: 4, mode: 'orders', orders: ['PTTT'], slots: 1 });
  const n = B.applyMove(s, [0, 1]); // pearls sink under the taro -> PTTT
  assert.ok(B.isWon(n));
});
t('odd jars: half and single jars must end empty', () => {
  assert.ok(!B.isWon({ cups: ['TTTT', 'MM', 'MM'], caps: [4, 2, 2], cap: 4, mode: 'sort' }));
  assert.ok(B.isWon({ cups: ['TTTT', 'MMMM', '', ''], caps: [4, 4, 2, 1], cap: 4, mode: 'sort' }));
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
