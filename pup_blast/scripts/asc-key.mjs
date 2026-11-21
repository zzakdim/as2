// Puts the App Store Connect API key's contents into fastlane/asc_api_key.json, the shape fastlane expects
// ({ key_id, issuer_id, key, in_house }). Run from pup_blast/ after downloading the .p8 into fastlane/:
//   node scripts/asc-key.mjs <ISSUER_ID>
// The Key ID comes from the .p8 file name (AuthKey_<KEYID>.p8). Both files are gitignored.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const p8 = readdirSync('fastlane').filter((f) => /^AuthKey_[A-Z0-9]+\.p8$/.test(f));
if (p8.length !== 1) {
  console.error(p8.length ? `More than one key in fastlane/: ${p8.join(', ')}. Keep only the one you want.` : 'No AuthKey_XXXX.p8 in fastlane/. Move the downloaded key there first.');
  process.exit(1);
}
const keyId = p8[0].slice('AuthKey_'.length, -'.p8'.length);
let issuer = process.argv[2];
if (!issuer && existsSync('fastlane/asc_api_key.json')) {
  try { issuer = JSON.parse(readFileSync('fastlane/asc_api_key.json', 'utf8')).issuer_id; } catch (e) { /* rebuilt below */ }
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issuer || '') || /^0{8}-/.test(issuer)) {
  console.error('Give your Issuer ID (App Store Connect → Users and Access → Integrations, above the key list):\n  node scripts/asc-key.mjs 69a6de7e-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  process.exit(1);
}
const key = readFileSync(`fastlane/${p8[0]}`, 'utf8').trim();
if (!key.includes('BEGIN PRIVATE KEY')) { console.error(`fastlane/${p8[0]} doesn't look like an App Store Connect key.`); process.exit(1); }
writeFileSync('fastlane/asc_api_key.json', JSON.stringify({ key_id: keyId, issuer_id: issuer, key, in_house: false }, null, 2) + '\n');
console.log(`fastlane/asc_api_key.json ready (key ${keyId}). Now: fastlane deliver`);
