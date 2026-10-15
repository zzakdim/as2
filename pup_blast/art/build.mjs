// Builds concepts.html, injecting the game's current pup portraits for comparison.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Pups = require('../www/js/pups.js');
const current = Object.fromEntries(['mochi', 'peanut', 'sprout'].map((id) => [id, Pups.renderPup(Pups.BY_ID[id])]));
const src = readFileSync(new URL('./concepts.src.html', import.meta.url), 'utf8');
writeFileSync(new URL('./concepts.html', import.meta.url), src.replace('/*CURRENT*/{}', JSON.stringify(current)));
console.log('art/concepts.html');
