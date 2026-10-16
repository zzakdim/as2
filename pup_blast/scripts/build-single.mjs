// Inlines www/ into one HTML fragment (dist/pup-blast.html) for sharing as a web preview.
// The iOS app uses www/ as-is through Capacitor; this is only for playtests.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
let html = readFileSync(join(www, 'index.html'), 'utf8');

// Bundled fonts become data URIs so the single file stays self-contained.
const inlineFonts = (css) => css.replace(/url\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(join(www, 'fonts', f)).toString('base64')})`);
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${inlineFonts(readFileSync(join(www, p), 'utf8'))}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${readFileSync(join(www, p), 'utf8').replace(/<\/script/g, '<\\/script')}</script>`);
// Keep head and body contents only; the preview host supplies the document skeleton.
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/g, '')
  .replace(/<\/?head>\s*/g, '')
  .replace(/<\/?body>\s*/g, '')
  .replace(/<meta charset="utf-8">\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'pup-blast.html'), html);
console.log(`dist/pup-blast.html ${(html.length / 1024).toFixed(1)} KB`);
