const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../www/js/i18n.js');

const catalog = require('../i18n/catalog.json');
// Names stay as they are in every language.
global.window = global;
require('../www/js/pups.js');
const NAMES = new Set(window.PB.Pups.ROSTER.map((p) => p.name));
const needed = catalog.filter((k) => !NAMES.has(k));

const LANG_DIR = path.join(__dirname, '../www/js/lang');
for (const f of fs.readdirSync(LANG_DIR)) require(path.join(LANG_DIR, f));
const holes = (s) => (s.match(/\{\d+\}/g) || []).sort();

test('the matcher: exact keys, patterns, nested keys, whitespace and misses', () => {
  I18N.add('xx', { Close: 'Fermer', 'Level {0} · {1}': 'Niveau {0} · {1}', 'Rug Stripes': 'Tapis rayé', 'Find {0} {1} more {2}': '{0} : encore {1} {2}', times: 'fois', '· Lv {0}{1}': '· Niv {0}{1}' });
  I18N.LANGS.xx = 'Test';
  I18N.start('xx');
  assert.strictEqual(I18N.t('Close'), 'Fermer');
  assert.strictEqual(I18N.t('  Close '), '  Fermer ');
  assert.strictEqual(I18N.t('Level 11 · Rug Stripes'), 'Niveau 11 · Tapis rayé');
  assert.strictEqual(I18N.t('Find Mochi 5 more times'), 'Mochi : encore 5 fois');
  assert.strictEqual(I18N.t('· Lv 3'), '· Niv 3'); // an empty placeholder still matches
  assert.strictEqual(I18N.t('1,234'), '1,234');
  assert.strictEqual(I18N.t('Something new'), 'Something new');
  I18N.start('en');
  assert.strictEqual(I18N.t('Close'), 'Close');
});

test('the phone language picks the game language; a saved choice wins', () => {
  assert.strictEqual(I18N.detect('auto', ['es-MX', 'en-US']), 'es');
  assert.strictEqual(I18N.detect('auto', ['pt-BR']), 'pt');
  assert.strictEqual(I18N.detect('auto', ['zh-Hans-CN', 'ja-JP']), 'ja');
  assert.strictEqual(I18N.detect('auto', ['nl-NL']), 'en');
  assert.strictEqual(I18N.detect('de', ['es-MX']), 'de');
  assert.strictEqual(I18N.detect(undefined, ['ko-KR']), 'ko');
});

for (const code of Object.keys(I18N.LANGS).filter((c) => c !== 'en' && c !== 'xx')) {
  test(`${code}: every string is translated, with the same placeholders`, () => {
    const table = I18N.tables[code] || {};
    const missing = needed.filter((k) => !table[k]);
    assert.deepStrictEqual(missing, [], `${missing.length} untranslated`);
    const unknown = Object.keys(table).filter((k) => !catalog.includes(k));
    assert.deepStrictEqual(unknown, [], 'keys that the game never shows (stale or misspelled)');
    for (const [k, v] of Object.entries(table)) {
      // A translation may drop a placeholder (Japanese needs no plural word) but never invent one.
      for (const h of holes(v)) assert.ok(holes(k).includes(h), `${code} "${k}" → "${v}" uses ${h}`);
    }
  });
}
