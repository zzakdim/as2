// The pup roster and the portrait renderer.
// Pups are built from breed data (ears, muzzle, markings, tail) so one renderer draws every breed,
// in two styles: 'bean' (full-body sitting pup, wobbly colored line) and 'sticker' (head, ink outline, white border).
(function (root) {
  'use strict';

  const RARITY = {
    common: { label: 'Common', stars: 1, refund: 10, color: '#9fdcb4' },
    rare: { label: 'Rare', stars: 2, refund: 25, color: '#62bdff' },
    epic: { label: 'Epic', stars: 3, refund: 60, color: '#c38cff' },
    legendary: { label: 'Legendary', stars: 4, refund: 150, color: '#ffd04a' },
  };

  // ---------------------------------------------------------------- breeds
  // ears: prick | big | huge | bat | tiny | tipped (stand up)   flop | drop | fold | poodle | hair (hang over the head)
  // muzzle: long | short | flat        tail: curl | plume | thin | otter | wag | nub | pompom
  const BREEDS = {
    shiba: { name: 'Shiba Inu', fur: '#e1863a', light: '#fff4e2', ears: 'prick', muzzle: 'long', tail: 'curl', marks: ['urajiro', 'brows'], eyes: 'almond', mouth: 'grin' },
    corgi: { name: 'Corgi', fur: '#ee9d4c', light: '#fffaf2', ears: 'big', muzzle: 'long', tail: 'nub', body: 'long', marks: ['blaze', 'chest'], eyes: 'dot', mouth: 'pant' },
    beagle: { name: 'Beagle', fur: '#c97f3c', dark: '#3b3036', light: '#ffffff', ears: 'flop', earColor: '#9a5a26', muzzle: 'long', tail: 'wag', marks: ['blaze', 'saddle', 'chest'], eyes: 'puppy', mouth: 'grin' },
    dachshund: { name: 'Dachshund', fur: '#8d4b28', light: '#c08455', ears: 'flop', earColor: '#6e3519', muzzle: 'long', tail: 'thin', body: 'long', eyes: 'sleepy', mouth: 'small' },
    pug: { name: 'Pug', fur: '#e7c896', dark: '#3a2e2e', light: '#f3e2c4', ears: 'fold', muzzle: 'flat', tail: 'curl', marks: ['wrinkles'], eyes: 'bug', mouth: 'pug' },
    lab: { name: 'Black Labrador', fur: '#34303b', light: '#6b6576', ears: 'drop', muzzle: 'long', tail: 'otter', eyes: 'puppy', mouth: 'pant' },
    chihuahua: { name: 'Chihuahua', fur: '#e2b67c', light: '#f7e4c6', ears: 'huge', muzzle: 'short', tail: 'thin', size: 0.84, eyes: 'sparkle', mouth: 'small' },
    pomeranian: { name: 'Pomeranian', fur: '#f2a24a', light: '#ffd9a3', ears: 'tiny', muzzle: 'short', tail: 'plume', size: 0.86, mane: true, eyes: 'sparkle', mouth: 'pant' },
    frenchie: { name: 'French Bulldog', fur: '#9b98aa', dark: '#5f5c6e', light: '#dcdae6', ears: 'bat', muzzle: 'flat', tail: 'nub', marks: ['blaze', 'chest'], eyes: 'dot', mouth: 'pug' },
    golden: { name: 'Golden Retriever', fur: '#e2a64c', light: '#f5d08c', ears: 'drop', muzzle: 'long', tail: 'plume', marks: ['chest'], eyes: 'happy', mouth: 'pant' },
    dalmatian: { name: 'Dalmatian', fur: '#fbfaf7', dark: '#2f2a36', light: '#ffffff', ears: 'drop', earColor: '#2f2a36', muzzle: 'long', tail: 'thin', marks: ['spots'], eyes: 'dot', mouth: 'grin' },
    husky: { name: 'Husky', fur: '#6d7790', light: '#ffffff', ears: 'prick', muzzle: 'long', tail: 'plume', marks: ['huskymask'], eye: '#3aa6f0', eyes: 'husky', mouth: 'pant', ruff: true },
    samoyed: { name: 'Samoyed', fur: '#ffffff', light: '#f3eff8', ears: 'prick', muzzle: 'long', tail: 'plume', mane: true, eyes: 'happy', mouth: 'pant' },
    collie: { name: 'Border Collie', fur: '#2c2832', light: '#ffffff', ears: 'drop', muzzle: 'long', tail: 'low', marks: ['blaze', 'collar', 'chest'], eyes: 'dot', mouth: 'grin', brows: true },
    poodle: { name: 'Poodle', fur: '#7d4b33', light: '#946049', ears: 'poodle', muzzle: 'long', tail: 'pompom', marks: ['curls'], eyes: 'sparkle', mouth: 'grin' },
    bernese: { name: 'Bernese', fur: '#2a2630', rust: '#c46a2f', light: '#ffffff', ears: 'drop', muzzle: 'long', tail: 'plume', size: 1.06, marks: ['blaze', 'tricolor', 'chest'], eyes: 'puppy', mouth: 'pant' },
    shihtzu: { name: 'Shih Tzu', fur: '#f4e6d2', dark: '#b07c4c', light: '#fffaf3', ears: 'hair', earColor: '#b07c4c', muzzle: 'short', tail: 'plume', marks: ['topknot'], eyes: 'sparkle', mouth: 'small' },
  };

  // ---------------------------------------------------------------- roster
  // Commons and rares are distinct breeds. Epics and legendaries are dressed-up versions of those breeds.
  const P = (id, name, breed, rarity, power, extra) => ({ id, name, breed, rarity, power, look: Object.assign({}, BREEDS[breed], extra), breedName: BREEDS[breed].name });
  const ROSTER = [
    P('mochi', 'Mochi', 'shiba', 'common', 'fetch'),
    P('biscuit', 'Biscuit', 'corgi', 'common', 'dig'),
    P('pudding', 'Pudding', 'beagle', 'common', 'sniff'),
    P('noodle', 'Noodle', 'dachshund', 'common', 'spin'),
    P('peanut', 'Peanut', 'pug', 'common', 'nap'),
    P('waffles', 'Waffles', 'lab', 'common', 'tailwag'),
    P('pickles', 'Pickles', 'chihuahua', 'common', 'pounce'),
    P('toffee', 'Toffee', 'pomeranian', 'common', 'yap'),
    P('bean', 'Bean', 'frenchie', 'common', 'zigzag'),
    P('muffin', 'Muffin', 'golden', 'common', 'treattoss'),

    P('sprout', 'Sprout', 'dalmatian', 'rare', 'spotted', { acc: 'bandana' }),
    P('clover', 'Clover', 'husky', 'rare', 'zoomies', { acc: 'bandana' }),
    P('marshmallow', 'Marshmallow', 'samoyed', 'rare', 'cuddle', { acc: 'bandana' }),
    P('domino', 'Domino', 'collie', 'rare', 'herd', { acc: 'bandana' }),
    P('cocoa', 'Cocoa', 'poodle', 'rare', 'trim', { acc: 'bandana' }),
    P('ziggy', 'Ziggy', 'bernese', 'rare', 'avalanche', { acc: 'bandana' }),
    P('scoop', 'Scoop', 'shihtzu', 'rare', 'pampered', { acc: 'bandana' }),

    P('disco', 'Disco', 'pug', 'epic', 'hopscotch', { acc: 'shades', mouth: 'pant' }),
    P('captain', 'Captain Biscuit', 'corgi', 'epic', 'cannonball', { acc: 'captain', eyes: 'wink', mouth: 'grin' }),
    P('duchess', 'Duchess', 'pomeranian', 'epic', 'doover', { acc: 'tiara', fur: '#fff3f7', light: '#ffffff', eyes: 'lashes', mouth: 'small' }),
    P('merlin', 'Merlin', 'shiba', 'epic', 'clairvoyance', { acc: 'wizard' }),
    P('dj', 'DJ Woofles', 'husky', 'epic', 'dropthebeat', { acc: 'headphones', eyes: 'happy' }),

    P('sunny', 'Sunny', 'golden', 'legendary', 'guardian', { acc: 'crown', fur: '#f2b443', light: '#ffe08f', aura: true }),
    P('cosmo', 'Cosmo', 'samoyed', 'legendary', 'bigbang', { acc: 'halo', fur: '#efeaff', light: '#ffffff', aura: true, stars: true, eyes: 'sparkle' }),
  ];
  ROSTER.forEach((p) => { p.breed = p.breedName; delete p.breedName; });
  const BY_ID = Object.fromEntries(ROSTER.map((p) => [p.id, p]));

  const STARTER_ID = 'mochi';

  // Copies raise a pup's level, and each level is one more power charge per run.
  // Going from level L to L+1 takes L more copies, so max level takes 1+1+2+3+4 = 11 copies.
  const MAX_LEVEL = 5;

  function chargesFor(pup, level) {
    return Math.max(1, Math.min(level || 1, MAX_LEVEL));
  }
  function copiesToNext(level) {
    return level >= MAX_LEVEL ? 0 : level;
  }

  // ---------------------------------------------------------------- drawing helpers
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 200;
  }
  const MIRROR = 'transform="translate(120 0) scale(-1 1)"';
  const both = (left) => left + `<g ${MIRROR}>${left}</g>`;

  // Ears that stand up sit behind the head; hanging ears are drawn over its sides.
  const UP_EARS = { prick: 1, big: 1, huge: 1, bat: 1, tiny: 1, tipped: 1 };

  function earsSvg(l, L, inner) {
    const c = l.earColor || l.fur;
    const pink = '#f6b6c4';
    switch (l.ears) {
      case 'prick': return both(`<path d="M27 42 C22 31 22 17 27 9 C30 5 35 5 39 9 C46 15 52 21 55 28 Z" fill="${c}" ${L}/><path d="M31 33 C28 26 28 18 31 13 C33 11 36 12 39 15 C43 19 46 23 47 26 L43 25 L44 29 L40 28 L39 32 L35 30 Z" fill="${inner}"/>`);
      case 'big': return both(`<path d="M30 38 C19 26 16 10 21 0 C34 4 46 15 51 26 Z" fill="${c}" ${L}/><path d="M32 30 C25 22 23 12 25 7 C33 10 40 17 44 25 Z" fill="${pink}"/>`);
      case 'huge': return both(`<path d="M32 40 C16 36 4 20 6 7 C21 8 40 17 50 29 Z" fill="${c}" ${L}/><path d="M33 33 C21 29 13 20 12 13 C23 14 36 20 43 28 Z" fill="${pink}"/>`);
      case 'bat': return both(`<path d="M34 32 C23 25 21 6 31 3 C42 0 51 12 51 25 Z" fill="${c}" ${L}/><path d="M36 26 C29 21 28 10 33 8 C40 7 46 15 46 23 Z" fill="${pink}"/>`);
      case 'tiny': return both(`<path d="M36 26 C34 19 35 12 38 8 C44 11 49 16 51 22 Z" fill="${c}" ${L}/><path d="M39 22 C38 18 38 15 40 12 C43 14 46 17 47 20 Z" fill="${pink}"/>`);
      case 'tipped': return both(`<path d="M32 34 C30 24 32 15 36 10 C44 12 51 19 53 26 Z" fill="${c}" ${L}/><path d="M36 10 C40 12 45 14 47 18 C42 20 38 17 36 10 Z" fill="${l.light}"/>`);
      case 'flop': return both(`<path d="M39 21 C25 19 16 37 17 57 C18 72 32 76 35 63 C38 51 40 37 43 25 Z" fill="${c}" ${L}/>`);
      case 'drop': return both(`<path d="M37 21 C26 21 21 33 22 46 C23 56 33 58 38 49 C42 41 43 31 41 24 Z" fill="${c}" ${L}/>`);
      case 'fold': return both(`<path d="M28 30 C26 20 34 15 43 20 L47 29 C40 34 33 35 28 30 Z" fill="${l.dark || c}" ${L}/>`);
      case 'poodle': return both(`<circle cx="27" cy="42" r="9" fill="${c}" ${L}/><circle cx="25" cy="54" r="8.5" fill="${c}" ${L}/><circle cx="29" cy="64" r="7" fill="${c}" ${L}/><circle cx="27" cy="42" r="8" fill="${c}"/><circle cx="25" cy="54" r="7.5" fill="${c}"/><circle cx="29" cy="64" r="6" fill="${c}"/>`);
      case 'hair': return both(`<path d="M37 23 C23 25 17 45 19 65 C21 75 31 76 34 67 C36 53 40 38 43 28 Z" fill="${c}" ${L}/><path d="M27 44 C26 52 26 60 28 66 M33 36 C31 46 31 56 32 64" stroke="${shade(c, -0.2)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
      default: return '';
    }
  }

  function maneSvg(l, L) {
    if (!l.mane) return '';
    const pts = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      pts.push([60 + Math.cos(a) * 33, 46 + Math.sin(a) * 28]);
    }
    return pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${l.fur}" ${L}/>`).join('') +
      pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${l.fur}"/>`).join('');
  }

  const HEAD = 'M60 17 C81 17 92 29 92 45 C92 61 80 71 60 71 C40 71 28 61 28 45 C28 29 39 17 60 17 Z';

  // Head markings, drawn without outlines on top of the head shape.
  function headMarks(l) {
    const m = l.marks || [];
    let s = '';
    if (m.includes('huskymask')) s += `<path d="M60 31 C51 35 45 40 33 46 C31 61 44 70 60 70 C76 70 89 61 87 46 C75 40 69 35 60 31 Z" fill="${l.light}"/><ellipse cx="46" cy="34" rx="4" ry="2.4" fill="${l.light}"/><ellipse cx="74" cy="34" rx="4" ry="2.4" fill="${l.light}"/>`;
    if (m.includes('blaze')) s += `<path d="M60 20 C56 28 54 38 52 50 L68 50 C66 38 64 28 60 20 Z" fill="${l.light}"/>`;
    if (m.includes('urajiro')) s += `<path d="M33 52 C37 46 49 46 60 50 C71 46 83 46 87 52 C88 62 77 70 60 70 C43 70 32 62 33 52 Z" fill="${l.light}"/>`;
    if (m.includes('brows')) s += `<ellipse cx="46" cy="34.5" rx="3.6" ry="2.3" fill="${l.light}"/><ellipse cx="74" cy="34.5" rx="3.6" ry="2.3" fill="${l.light}"/>`;
    if (m.includes('tricolor')) s += `<ellipse cx="46" cy="35" rx="3.4" ry="2.2" fill="${l.rust}"/><ellipse cx="74" cy="35" rx="3.4" ry="2.2" fill="${l.rust}"/><ellipse cx="42" cy="58" rx="7" ry="6" fill="${l.rust}"/><ellipse cx="78" cy="58" rx="7" ry="6" fill="${l.rust}"/>`;
    if (m.includes('spots')) s += `<circle cx="38" cy="34" r="3.2" fill="${l.dark}"/><circle cx="70" cy="25" r="2.6" fill="${l.dark}"/><circle cx="84" cy="50" r="2.4" fill="${l.dark}"/><circle cx="52" cy="24" r="1.8" fill="${l.dark}"/>`;
    if (m.includes('wrinkles')) s += `<path d="M50 30 q10 -5 20 0 M52 35 q8 -3 16 0" stroke="${shade(l.fur, -0.3)}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    if (m.includes('curls') || l.ears === 'poodle') s += '';
    return s;
  }

  function topknotSvg(l, L) {
    if (l.ears === 'poodle') {
      return `<circle cx="48" cy="20" r="8" fill="${l.fur}" ${L}/><circle cx="60" cy="15" r="9" fill="${l.fur}" ${L}/><circle cx="72" cy="20" r="8" fill="${l.fur}" ${L}/>` +
        `<circle cx="48" cy="20" r="7" fill="${l.fur}"/><circle cx="60" cy="15" r="8" fill="${l.fur}"/><circle cx="72" cy="20" r="7" fill="${l.fur}"/>`;
    }
    if ((l.marks || []).includes('topknot')) {
      return `<path d="M54 22 C52 12 58 8 60 8 C62 8 68 12 66 22 Z" fill="${l.fur}" ${L}/>` +
        `<g transform="translate(60 11)"><path d="M0 0 L-9 -5 L-9 5 Z M0 0 L9 -5 L9 5 Z" fill="#ff6f9a" stroke="#c23d68" stroke-width="1.2" stroke-linejoin="round"/><circle r="2.6" fill="#ff4f8b"/></g>`;
    }
    return '';
  }

  // Eye styles give each pup its own personality.
  function eyesSvg(l, ink) {
    if (l.acc === 'shades') return '';
    const style = l.eyes || 'dot';
    const pair = (fn) => fn(45, 1) + fn(75, -1);
    const shine = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
    const lid = (x) => `<path d="M${x - 6} 42.5 Q${x} 38 ${x + 6} 42.5" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    switch (style) {
      case 'happy': return pair((x) => `<path d="M${x - 5} 45.5 Q${x} 38.5 ${x + 5} 45.5" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
      case 'wink': return `<ellipse cx="45" cy="44" rx="3.6" ry="4.3" fill="${ink}"/>${shine(46.4, 42.3, 1.3)}` +
        `<path d="M70 44.5 Q75 40 80 44.5" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
      case 'almond': return pair((x, d) => `<ellipse cx="${x}" cy="44" rx="4.4" ry="3.3" transform="rotate(${-14 * d} ${x} 44)" fill="${ink}"/>${shine(x + 1.4, 42.8, 1.2)}`);
      case 'puppy': return pair((x) => `<ellipse cx="${x}" cy="44" rx="4.6" ry="5.2" fill="${ink}"/>${shine(x + 1.6, 41.8, 1.8)}${shine(x - 1.6, 46.2, 0.9)}`);
      case 'sparkle': return pair((x) => `<ellipse cx="${x}" cy="44" rx="5" ry="5.6" fill="${ink}"/><ellipse cx="${x}" cy="45.5" rx="3.4" ry="3" fill="#5a3f6e" opacity=".55"/>${shine(x + 1.7, 41.6, 2)}${shine(x - 1.8, 46.6, 1)}${shine(x + 2.2, 46, 0.6)}`);
      case 'lashes': return pair((x, d) => `<ellipse cx="${x}" cy="44" rx="4.6" ry="5.2" fill="${ink}"/>${shine(x + 1.6, 41.8, 1.8)}${shine(x - 1.6, 46.2, 0.8)}` +
        `<path d="M${x - 4.5 * d} 40.5 l${-3 * d} -2.4 M${x - 3 * d} 39.2 l${-1.8 * d} -3" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`);
      case 'sleepy': return pair((x) => `<path d="M${x - 4.5} 43.5 Q${x} 49 ${x + 4.5} 43.5 Z" fill="${ink}"/><path d="M${x - 5} 43.5 H${x + 5}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>${shine(x + 1.4, 45.2, 0.9)}`);
      case 'bug': return pair((x) => `<circle cx="${x}" cy="44" r="5.6" fill="#ffffff" stroke="${ink}" stroke-width="1.2"/><circle cx="${x}" cy="44.6" r="4.3" fill="${ink}"/>${shine(x + 1.5, 42.6, 1.5)}`);
      case 'husky': return pair((x) => `<ellipse cx="${x}" cy="44" rx="4.3" ry="4.7" fill="${l.eye}" stroke="${ink}" stroke-width="1.6"/><circle cx="${x}" cy="44.4" r="2" fill="${ink}"/>${shine(x + 1.4, 42.6, 1.2)}`);
      default: return pair((x) => `<ellipse cx="${x}" cy="44" rx="3.6" ry="4.3" fill="${ink}"/>${shine(x + 1.4, 42.3, 1.3)}`);
    }
  }

  // Dog mouths: an open pant with a tongue, a wide grin, a small smile, or a pug's mouth.
  function mouthSvg(l, ink, my) {
    const style = l.mouth || 'grin';
    const pink = '#ff7f9e', pinkLine = shade(pink, -0.35);
    const philtrum = `<path d="M60 ${my - 1.5} v3" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    switch (style) {
      case 'pant':
        return philtrum + `<path d="M50 ${my + 1.5} Q60 ${my + 4} 70 ${my + 1.5} Q68 ${my + 11} 60 ${my + 11} Q52 ${my + 11} 50 ${my + 1.5} Z" fill="#5a2333" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>` +
          `<path d="M54.5 ${my + 6} C54.5 ${my + 16} 65.5 ${my + 16} 65.5 ${my + 6} Q60 ${my + 4} 54.5 ${my + 6} Z" fill="${pink}" stroke="${pinkLine}" stroke-width="1.2"/>` +
          `<path d="M60 ${my + 6.5} v5" stroke="${pinkLine}" stroke-width="1.1" stroke-linecap="round"/>`;
      case 'small':
        return philtrum + `<path d="M55 ${my + 2} Q60 ${my + 6} 65 ${my + 2}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 'pug': {
        const c = shade(l.dark || '#555555', 0.5);
        return `<path d="M60 ${my - 1.5} v2.5 M51 ${my + 3} Q60 ${my + 6} 69 ${my + 3}" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
          `<path d="M57 ${my + 4.6} q3 6 6 0 z" fill="${pink}" stroke="${pinkLine}" stroke-width="1"/>`;
      }
      default: // grin: a wide smile with little jowl hooks at the corners
        return philtrum + `<path d="M51 ${my + 1.5} Q60 ${my + 9} 69 ${my + 1.5}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
          `<path d="M51 ${my + 1.5} q-1.2 -0.2 -1.8 -1.6 M69 ${my + 1.5} q1.2 -0.2 1.8 -1.6" stroke="${ink}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    }
  }

  function faceSvg(l, ink) {
    let muzzle, noseY, nose;
    if (l.muzzle === 'flat') {
      const mask = l.dark || shade(l.fur, -0.4);
      muzzle = `<path d="M43 56 C43 47 77 47 77 56 C77 66 70 70 60 70 C50 70 43 66 43 56 Z" fill="${mask}"/>` +
        `<ellipse cx="45" cy="45" rx="7.5" ry="6.5" fill="${mask}" opacity=".45"/><ellipse cx="75" cy="45" rx="7.5" ry="6.5" fill="${mask}" opacity=".45"/>`;
      noseY = 52; nose = `<ellipse cx="60" cy="${noseY}" rx="6.4" ry="4.2" fill="#15101a"/>`;
    } else if (l.muzzle === 'short') {
      muzzle = `<ellipse cx="60" cy="58" rx="12.5" ry="9.5" fill="${l.light}"/>`;
      noseY = 53; nose = `<ellipse cx="60" cy="${noseY}" rx="5" ry="3.6" fill="#1d1622"/>`;
    } else {
      // Long snout: wide, sits low, carries a big nose. The nose and open mouth are what read as "dog".
      const edge = isLight(l.fur) ? `stroke="${shade(l.light, -0.12)}" stroke-width="1.4"` : '';
      muzzle = `<path d="M44 57 C44 47 76 47 76 57 C76 66 69 71 60 71 C51 71 44 66 44 57 Z" fill="${l.light}" ${edge}/>`;
      noseY = 52;
      nose = `<path d="M52.5 ${noseY - 2} C52.5 ${noseY - 5.5} 67.5 ${noseY - 5.5} 67.5 ${noseY - 2} C67.5 ${noseY + 2.5} 62.5 ${noseY + 4.5} 60 ${noseY + 4.5} C57.5 ${noseY + 4.5} 52.5 ${noseY + 2.5} 52.5 ${noseY - 2} Z" fill="#1d1622"/>`;
    }
    const shine = `<ellipse cx="57.6" cy="${noseY - 1.8}" rx="2.2" ry="1.2" fill="#fff" opacity=".55"/>`;
    const blush = `<ellipse cx="35" cy="53" rx="4.4" ry="2.6" fill="#ff8fab" opacity=".45"/><ellipse cx="85" cy="53" rx="4.4" ry="2.6" fill="#ff8fab" opacity=".45"/>`;
    const brows = l.brows ? `<path d="M41 37.5 q4 -2.6 8 -0.6 M71 36.9 q4 -2 8 0.6" stroke="${isLight(l.fur) ? '#6a6582' : shade(l.fur, 0.55)}" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
    return muzzle + eyesSvg(l, ink) + brows + blush + mouthSvg(l, ink, noseY + 5) + nose + shine;
  }

  function accSvg(l, rarityColor) {
    switch (l.acc) {
      case 'shades': return `<g><rect x="33" y="38" width="22" height="13" rx="5" fill="#1d1a2b"/><rect x="65" y="38" width="22" height="13" rx="5" fill="#1d1a2b"/><path d="M55 42 h10" stroke="#1d1a2b" stroke-width="3"/><path d="M33 41 L28 38 M87 41 L92 38" stroke="#1d1a2b" stroke-width="2.4" stroke-linecap="round"/><rect x="36" y="40.5" width="7" height="3" rx="1.5" fill="#ff8fd1" opacity=".85"/><rect x="68" y="40.5" width="7" height="3" rx="1.5" fill="#62bdff" opacity=".85"/></g>`;
      case 'captain': return `<g stroke="#1d1a2b" stroke-width="1.6" stroke-linejoin="round"><path d="M36 26 C38 8 82 8 84 26 Z" fill="#ffffff"/><path d="M32 24 h56 v6 q-28 6 -56 0 Z" fill="#24345f"/><path d="M40 30 q20 8 40 0 v3 q-20 8 -40 0 Z" fill="#1d1a2b"/></g><circle cx="60" cy="18" r="4.2" fill="#ffd04a" stroke="#c99a12" stroke-width="1.2"/>`;
      case 'tiara': return `<g stroke="#c99a12" stroke-width="1.4" stroke-linejoin="round"><path d="M40 26 L44 12 L51 21 L60 6 L69 21 L76 12 L80 26 Z" fill="#ffd04a"/></g><circle cx="60" cy="16" r="2.8" fill="#ff7aa8"/><circle cx="46" cy="18" r="1.8" fill="#62bdff"/><circle cx="74" cy="18" r="1.8" fill="#62bdff"/>`;
      case 'wizard': return `<g stroke="#2a1f7a" stroke-width="1.6" stroke-linejoin="round"><path d="M38 24 L66 -6 L82 24 Z" fill="#5b4bd6"/><ellipse cx="60" cy="24" rx="30" ry="6" fill="#4637b8"/></g><path d="M63 6 l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.2 3.2-.4z" fill="#ffd04a"/><circle cx="54" cy="16" r="1.6" fill="#ffd04a"/>`;
      case 'headphones': return `<g stroke="#8a2140" stroke-width="1.4"><path d="M27 48 C25 10 95 10 93 48" stroke="#ff5f7e" stroke-width="6" fill="none"/><rect x="19" y="40" width="13" height="20" rx="6" fill="#ff5f7e"/><rect x="88" y="40" width="13" height="20" rx="6" fill="#ff5f7e"/></g>`;
      case 'crown': return `<g stroke="#c58a0a" stroke-width="1.6" stroke-linejoin="round"><path d="M40 26 L42 8 L51 18 L60 3 L69 18 L78 8 L80 26 Z" fill="#ffd04a"/><path d="M40 26 h40 v5 h-40 Z" fill="#f2b42a"/></g><circle cx="60" cy="16" r="3" fill="#ff5f7e"/><circle cx="48" cy="21" r="1.8" fill="#62bdff"/><circle cx="72" cy="21" r="1.8" fill="#62bdff"/>`;
      case 'halo': return `<ellipse cx="60" cy="8" rx="20" ry="5" fill="none" stroke="#ffe680" stroke-width="4"/>`;
      default: return '';
    }
  }

  function bandanaSvg(l, color) {
    if (l.acc !== 'bandana') return '';
    return `<path d="M40 66 L80 66 L60 86 Z" fill="${color}" stroke="${shade(color, -0.35)}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<circle cx="52" cy="72" r="1.4" fill="#fff" opacity=".8"/><circle cx="66" cy="74" r="1.4" fill="#fff" opacity=".8"/><circle cx="60" cy="80" r="1.4" fill="#fff" opacity=".8"/>`;
  }

  function tailSvg(l, line) {
    const fur = l.fur;
    const stroke = (d, w) => `<path d="${d}" fill="none" stroke="${line}" stroke-width="${w + 3.4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fur}" stroke-width="${w}" stroke-linecap="round"/>`;
    switch (l.tail) {
      case 'curl': return stroke('M86 92 C104 92 108 72 97 70 C89 69 89 80 97 80', 7);
      case 'plume': return stroke('M86 96 C104 96 110 78 104 66', 11);
      case 'thin': return stroke('M86 100 C100 100 107 88 105 74', 4);
      case 'otter': return stroke('M86 100 C100 100 106 92 106 80', 8);
      case 'low': return stroke('M86 101 C98 104 107 100 110 92', 9);
      case 'wag': return stroke('M86 98 C98 96 104 84 103 72', 5) + `<circle cx="103" cy="71" r="4" fill="#ffffff" stroke="${line}" stroke-width="1.7"/>`;
      case 'pompom': return stroke('M86 98 C98 96 102 86 102 78', 4) + `<circle cx="102" cy="72" r="7.5" fill="${fur}" stroke="${line}" stroke-width="1.7"/>`;
      default: return `<circle cx="88" cy="99" r="4.5" fill="${fur}" stroke="${line}" stroke-width="1.7"/>`;
    }
  }

  function bodyMarks(l) {
    const m = l.marks || [];
    let s = '';
    if (m.includes('saddle')) s += `<path d="M33 88 C33 74 45 67 60 67 C75 67 87 74 87 88 C76 81 44 81 33 88 Z" fill="${l.dark}"/>`;
    if (m.includes('chest') || m.includes('urajiro') || l.marks == null || m.includes('huskymask')) s += `<path d="M47 104 C45 88 51 77 60 77 C69 77 75 88 73 104 Z" fill="${l.light}"/>`;
    if (m.includes('collar')) s += `<path d="M35 76 C44 82 76 82 85 76 C84 69 75 65 60 65 C45 65 36 69 35 76 Z" fill="${l.light}"/>`;
    if (m.includes('tricolor')) s += `<ellipse cx="45" cy="104" rx="7" ry="3" fill="${l.rust}"/><ellipse cx="75" cy="104" rx="7" ry="3" fill="${l.rust}"/>`;
    if (m.includes('spots')) s += `<circle cx="42" cy="90" r="3.4" fill="${l.dark}"/><circle cx="80" cy="84" r="2.6" fill="${l.dark}"/><circle cx="74" cy="98" r="3.6" fill="${l.dark}"/><circle cx="38" cy="78" r="2" fill="${l.dark}"/>`;
    if (m.includes('curls')) s += `<path d="M40 84 q3 -4 6 0 M70 80 q3 -4 6 0 M44 96 q3 -4 6 0 M72 94 q3 -4 6 0" stroke="${shade(l.fur, 0.25)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    return s;
  }

  function sparkles(color) {
    const star = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6 C1 -1 1 -1 6 0 C1 1 1 1 0 6 C-1 1 -1 1 -6 0 C-1 -1 -1 -1 0 -6 Z" fill="${color}"/>`;
    return star(16, 26, 1) + star(104, 40, 0.8) + star(20, 86, 0.6) + star(100, 98, 0.7);
  }

  // ---------------------------------------------------------------- render
  // opts.style: 'bean' (default) | 'sticker'; opts.silhouette draws an unknown pup.
  function renderPup(pup, opts) {
    const o = opts || {};
    const style = o.style || (root.PB && root.PB.artStyle) || 'bean';
    const l = pup.look;
    const rc = RARITY[pup.rarity].color;
    const line = isLight(l.fur) ? '#6a6582' : shade(l.fur, -0.5);
    const ink = '#1d1622';
    const inner = l.light && l.light !== l.fur ? l.light : shade(l.fur, 0.45);
    const label = o.silhouette ? 'Unknown pup' : `${pup.name} the ${pup.breed}`;
    const silo = o.silhouette ? ' style="filter:brightness(0) opacity(.35)"' : '';
    const up = UP_EARS[l.ears];
    const aura = l.aura && !o.plain ? `<circle cx="60" cy="58" r="54" fill="${rc}" opacity=".22"/><circle cx="60" cy="58" r="40" fill="${rc}" opacity=".18"/>` : '';
    const twinkle = !o.plain && (l.stars || l.aura) ? sparkles(l.stars ? '#fff6c2' : rc) : '';

    if (style === 'sticker') {
      // Outlined layers go in one group, drawn twice: a fat white border, then the ink line.
      const silhouette = (up ? earsSvg(l, '', inner) : '') + maneSvg(l, '') + topknotSvg(l, '') + `<path d="${HEAD}" fill="${l.fur}"/>` + (up ? '' : earsSvg(l, '', inner));
      const id = `pbs-${pup.id}`;
      return `<svg viewBox="0 0 120 120" overflow="visible" role="img" aria-label="${label}"${silo}>
        <defs><g id="${id}">${silhouette}</g></defs>${aura}
        <g transform="translate(60 66) scale(1.3) translate(-60 -46) rotate(${(pup.id.length % 3) - 1} 60 46)">
          <use href="#${id}" stroke="#000" stroke-opacity=".22" stroke-width="11" stroke-linejoin="round" transform="translate(1.5 3)"/>
          <use href="#${id}" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/>
          <use href="#${id}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/>
          <path d="${HEAD}" fill="${l.fur}"/>${up ? '' : earsSvg(l, `stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"`, inner)}
          ${headMarks(l)}${faceSvg(l, ink)}${accSvg(l, rc)}
        </g>${twinkle}</svg>`;
    }

    const L = `stroke="${line}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
    const size = l.size || 1;
    const bodyT = l.body === 'long' ? `translate(60 106) scale(${1.16 * size} ${0.9 * size}) translate(-60 -106)` : `translate(60 106) scale(${size}) translate(-60 -106)`;
    const headT = `translate(0 ${(1 - size) * 30 + (l.body === 'long' ? 6 : 0)})`;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${label}"${silo}>
      <defs><filter id="pb-wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></defs>
      ${aura}<ellipse cx="60" cy="111" rx="33" ry="5" fill="#000" opacity=".22"/>
      <g filter="url(#pb-wob)">
        <g transform="${bodyT}">
          ${tailSvg(l, line)}
          <path d="M31 106 C25 80 37 63 60 63 C83 63 95 80 89 106 Q60 113 31 106 Z" fill="${l.fur}" ${L}/>
          ${bodyMarks(l)}
          <ellipse cx="45" cy="106" rx="8.5" ry="5.2" fill="${l.fur}" ${L}/><ellipse cx="75" cy="106" rx="8.5" ry="5.2" fill="${l.fur}" ${L}/>
          <path d="M42.5 105 v3 M47.5 105 v3 M72.5 105 v3 M77.5 105 v3" stroke="${line}" stroke-width="1.3" stroke-linecap="round"/>
        </g>
        <g transform="${headT}">
          ${l.ruff ? `<path d="M34 64 L38 74 L44 68 L48 78 L54 70 L60 80 L66 70 L72 78 L76 68 L82 74 L86 64 Z" fill="${l.light}" ${L}/>` : ''}
          ${bandanaSvg(l, rc)}
          ${up ? earsSvg(l, L, inner) : ''}${maneSvg(l, L)}${topknotSvg(l, L)}
          <path d="${HEAD}" fill="${l.fur}" ${L}/>
          ${headMarks(l)}${up ? '' : earsSvg(l, L, inner)}
          ${faceSvg(l, ink)}${accSvg(l, rc)}
        </g>
      </g>${twinkle}</svg>`;
  }

  const Pups = { RARITY, BREEDS, ROSTER, BY_ID, STARTER_ID, MAX_LEVEL, chargesFor, copiesToNext, renderPup };

  root.PB = root.PB || {};
  root.PB.Pups = Pups;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pups;
})(typeof globalThis !== 'undefined' ? globalThis : this);
