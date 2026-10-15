// The pup roster and the procedural portrait renderer.
// Every pup is drawn from a handful of traits, so adding a breed is one line of data.
(function (root) {
  'use strict';

  const RARITY = {
    common: { label: 'Common', stars: 1, bonus: 0.05, refund: 10, color: '#9fdcb4' },
    rare: { label: 'Rare', stars: 2, bonus: 0.12, refund: 25, color: '#62bdff' },
    epic: { label: 'Epic', stars: 3, bonus: 0.25, refund: 60, color: '#c38cff' },
    legendary: { label: 'Legendary', stars: 4, bonus: 0.5, refund: 150, color: '#ffd04a' },
  };

  const POWERS = {
    fetch: { name: 'Fetch', desc: 'Swap your three pieces for fresh ones' },
    dig: { name: 'Dig', desc: 'Tap the board to clear a 3×3 patch' },
    zoomies: { name: 'Zoomies', desc: 'Clears the fullest row and column' },
    guardian: { name: 'Guardian', desc: 'Saves your run once when you get stuck' },
  };

  // fur, ear color, muzzle; ears: floppy|pointy|round|fluffy; pattern: none|patch|mask|spots|blaze|saddle|curly
  const P = (id, name, breed, rarity, power, look) => ({ id, name, breed, rarity, power, look });
  const ROSTER = [
    P('mochi', 'Mochi', 'Shiba Inu', 'common', 'fetch', { fur: '#e8a35c', ear: '#d98a40', muzzle: '#fff3e2', ears: 'pointy', pattern: 'shiba' }),
    P('biscuit', 'Biscuit', 'Corgi', 'common', 'dig', { fur: '#f0a95b', ear: '#e08f3c', muzzle: '#fffaf2', ears: 'corgi', pattern: 'blaze', tongue: true }),
    P('pudding', 'Pudding', 'Beagle', 'common', 'fetch', { fur: '#c98a52', ear: '#7a4a2a', muzzle: '#fffaf2', ears: 'floppy', pattern: 'blaze' }),
    P('noodle', 'Noodle', 'Dachshund', 'common', 'dig', { fur: '#9b5a34', ear: '#7c4426', muzzle: '#b97a4f', ears: 'floppy', pattern: 'none' }),
    P('peanut', 'Peanut', 'Pug', 'common', 'fetch', { fur: '#e9cfa3', ear: '#3d3030', muzzle: '#4a3a38', ears: 'round', pattern: 'mask', tongue: true }),
    P('waffles', 'Waffles', 'Labrador', 'common', 'dig', { fur: '#f2d39a', ear: '#e3bc78', muzzle: '#f8e3bb', ears: 'floppy', pattern: 'none', tongue: true }),
    P('pickles', 'Pickles', 'Chihuahua', 'common', 'fetch', { fur: '#e7c08c', ear: '#d6a467', muzzle: '#f6e2c4', ears: 'pointy', pattern: 'none', bigEyes: true }),
    P('toffee', 'Toffee', 'Pomeranian', 'common', 'dig', { fur: '#f4a64e', ear: '#e58d2e', muzzle: '#fbd29b', ears: 'fluffy', pattern: 'none' }),
    P('bean', 'Bean', 'French Bulldog', 'common', 'fetch', { fur: '#8c8a96', ear: '#75737f', muzzle: '#c9c6d2', ears: 'round', pattern: 'blaze' }),
    P('muffin', 'Muffin', 'Golden Retriever', 'common', 'dig', { fur: '#e6b25f', ear: '#d29a45', muzzle: '#f4d39a', ears: 'floppy', pattern: 'none', tongue: true }),

    P('sprout', 'Sprout', 'Dalmatian', 'rare', 'zoomies', { fur: '#fbfbfb', ear: '#2d2a33', muzzle: '#ffffff', ears: 'floppy', pattern: 'spots' }),
    P('clover', 'Clover', 'Husky', 'rare', 'zoomies', { fur: '#6f7891', ear: '#59617a', muzzle: '#ffffff', ears: 'pointy', pattern: 'mask-light', eye: '#4fb6ff' }),
    P('marshmallow', 'Marshmallow', 'Samoyed', 'rare', 'fetch', { fur: '#ffffff', ear: '#f1ece6', muzzle: '#ffffff', ears: 'fluffy', pattern: 'none', tongue: true }),
    P('domino', 'Domino', 'Border Collie', 'rare', 'dig', { fur: '#2f2c36', ear: '#25222b', muzzle: '#ffffff', ears: 'floppy', pattern: 'blaze-white' }),
    P('cocoa', 'Cocoa', 'Poodle', 'rare', 'zoomies', { fur: '#7a4b35', ear: '#6a3f2c', muzzle: '#8f5c44', ears: 'fluffy', pattern: 'curly' }),
    P('ziggy', 'Ziggy', 'Bernese', 'rare', 'dig', { fur: '#2b2730', ear: '#2b2730', muzzle: '#ffffff', ears: 'floppy', pattern: 'tricolor' }),
    P('scoop', 'Scoop', 'Shih Tzu', 'rare', 'fetch', { fur: '#f3e3cf', ear: '#b58456', muzzle: '#fff8ee', ears: 'fluffy', pattern: 'patch', acc: 'bow' }),

    P('disco', 'Disco', 'Pug', 'epic', 'zoomies', { fur: '#e9cfa3', ear: '#3d3030', muzzle: '#4a3a38', ears: 'round', pattern: 'mask', acc: 'shades', tongue: true }),
    P('captain', 'Captain Biscuit', 'Corgi', 'epic', 'dig', { fur: '#f0a95b', ear: '#e08f3c', muzzle: '#fffaf2', ears: 'corgi', pattern: 'blaze', acc: 'captain' }),
    P('duchess', 'Duchess', 'Pomeranian', 'epic', 'fetch', { fur: '#fff1f6', ear: '#ffd6e6', muzzle: '#ffffff', ears: 'fluffy', pattern: 'none', acc: 'tiara' }),
    P('merlin', 'Merlin', 'Shiba Inu', 'epic', 'zoomies', { fur: '#e8a35c', ear: '#d98a40', muzzle: '#fff3e2', ears: 'pointy', pattern: 'shiba', acc: 'wizard' }),
    P('dj', 'DJ Woofles', 'Husky', 'epic', 'fetch', { fur: '#6f7891', ear: '#59617a', muzzle: '#ffffff', ears: 'pointy', pattern: 'mask-light', eye: '#4fb6ff', acc: 'headphones' }),

    P('sunny', 'Sunny', 'Golden Retriever', 'legendary', 'guardian', { fur: '#ffc94d', ear: '#f2ad2c', muzzle: '#ffe39a', ears: 'floppy', pattern: 'none', acc: 'crown', tongue: true, aura: true }),
    P('cosmo', 'Cosmo', 'Cloud Pup', 'legendary', 'guardian', { fur: '#b7a6ff', ear: '#8f7cf0', muzzle: '#e7e0ff', ears: 'fluffy', pattern: 'stars', acc: 'halo', aura: true }),
  ];
  const BY_ID = Object.fromEntries(ROSTER.map((p) => [p.id, p]));

  const STARTER_ID = 'mochi';
  const MAX_LEVEL = 10;

  function bonusFor(pup, level) {
    return RARITY[pup.rarity].bonus + 0.02 * Math.max(0, (level || 1) - 1);
  }
  function chargesFor(pup, level) {
    if (pup.power === 'guardian') return 1;
    return (level || 1) >= 5 ? 2 : 1;
  }

  function earsSvg(l) {
    const f = l.ear;
    switch (l.ears) {
      case 'pointy':
        return `<path d="M20 44 L24 10 L44 30 Z" fill="${f}"/><path d="M80 44 L76 10 L56 30 Z" fill="${f}"/>` +
          `<path d="M25 36 L27 18 L38 30 Z" fill="#ffc6d3" opacity=".8"/><path d="M75 36 L73 18 L62 30 Z" fill="#ffc6d3" opacity=".8"/>`;
      case 'corgi':
        return `<path d="M16 48 L14 2 L46 30 Z" fill="${f}"/><path d="M84 48 L86 2 L54 30 Z" fill="${f}"/>` +
          `<path d="M22 38 L21 14 L38 30 Z" fill="#ffc6d3" opacity=".8"/><path d="M78 38 L79 14 L62 30 Z" fill="#ffc6d3" opacity=".8"/>`;
      case 'round':
        return `<circle cx="22" cy="32" r="11" fill="${f}"/><circle cx="78" cy="32" r="11" fill="${f}"/>`;
      case 'fluffy':
        return `<circle cx="20" cy="40" r="13" fill="${f}"/><circle cx="16" cy="54" r="10" fill="${f}"/>` +
          `<circle cx="80" cy="40" r="13" fill="${f}"/><circle cx="84" cy="54" r="10" fill="${f}"/>`;
      default: // floppy
        return `<ellipse cx="19" cy="52" rx="11" ry="21" fill="${f}" transform="rotate(18 19 52)"/>` +
          `<ellipse cx="81" cy="52" rx="11" ry="21" fill="${f}" transform="rotate(-18 81 52)"/>`;
    }
  }

  function patternSvg(l) {
    switch (l.pattern) {
      // Shiba: cream cheeks and the little eyebrow dots.
      case 'shiba': return `<ellipse cx="35" cy="68" rx="13" ry="11" fill="${l.muzzle}"/><ellipse cx="65" cy="68" rx="13" ry="11" fill="${l.muzzle}"/><ellipse cx="38" cy="41" rx="3.6" ry="2.4" fill="${l.muzzle}"/><ellipse cx="62" cy="41" rx="3.6" ry="2.4" fill="${l.muzzle}"/>`;
      case 'patch': return `<ellipse cx="62" cy="47" rx="11" ry="10" fill="${l.ear}"/>`;
      case 'mask': return `<ellipse cx="50" cy="66" rx="19" ry="14" fill="${l.muzzle}"/><ellipse cx="38" cy="50" rx="8" ry="7" fill="${l.ear}" opacity=".55"/><ellipse cx="62" cy="50" rx="8" ry="7" fill="${l.ear}" opacity=".55"/>`;
      case 'mask-light': return `<path d="M50 34 C40 40 26 46 26 62 C26 76 38 82 50 82 C62 82 74 76 74 62 C74 46 60 40 50 34 Z" fill="#ffffff"/>`;
      case 'spots': return `<circle cx="31" cy="44" r="4" fill="#2d2a33"/><circle cx="70" cy="40" r="3" fill="#2d2a33"/><circle cx="74" cy="62" r="4.5" fill="#2d2a33"/><circle cx="27" cy="64" r="3" fill="#2d2a33"/><circle cx="55" cy="33" r="2.5" fill="#2d2a33"/>`;
      case 'blaze': return `<path d="M50 30 C46 40 42 52 36 64 L64 64 C58 52 54 40 50 30 Z" fill="${l.muzzle}"/>`;
      case 'blaze-white': return `<path d="M50 28 C45 40 42 52 34 66 L66 66 C58 52 55 40 50 28 Z" fill="#ffffff"/>`;
      case 'tricolor': return `<path d="M50 30 C45 42 42 52 34 66 L66 66 C58 52 55 42 50 30 Z" fill="#ffffff"/><circle cx="37" cy="44" r="3.5" fill="#c9773d"/><circle cx="63" cy="44" r="3.5" fill="#c9773d"/><ellipse cx="32" cy="66" rx="6" ry="5" fill="#c9773d"/><ellipse cx="68" cy="66" rx="6" ry="5" fill="#c9773d"/>`;
      case 'curly': return `<circle cx="38" cy="30" r="8" fill="${l.fur}"/><circle cx="50" cy="26" r="9" fill="${l.fur}"/><circle cx="62" cy="30" r="8" fill="${l.fur}"/>`;
      case 'stars': return `<path d="M30 44 l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#fff6c2"/><path d="M71 40 l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="#fff6c2"/><circle cx="66" cy="66" r="1.6" fill="#fff6c2"/><circle cx="33" cy="62" r="1.3" fill="#fff6c2"/>`;
      default: return '';
    }
  }

  function accSvg(l) {
    switch (l.acc) {
      case 'bow': return `<g transform="translate(70 26) rotate(15)"><path d="M0 0 L-12 -7 L-12 7 Z M0 0 L12 -7 L12 7 Z" fill="#ff7aa8"/><circle r="3.5" fill="#ff4f8b"/></g>`;
      case 'shades': return `<g><rect x="28" y="44" width="19" height="12" rx="5" fill="#1d1a2b"/><rect x="53" y="44" width="19" height="12" rx="5" fill="#1d1a2b"/><rect x="46" y="47" width="8" height="3" fill="#1d1a2b"/><rect x="31" y="46" width="6" height="3" rx="1.5" fill="#ff8fd1" opacity=".8"/><rect x="56" y="46" width="6" height="3" rx="1.5" fill="#62bdff" opacity=".8"/></g>`;
      case 'captain': return `<g><path d="M26 30 C30 14 70 14 74 30 Z" fill="#ffffff"/><rect x="24" y="28" width="52" height="7" rx="3" fill="#24345f"/><circle cx="50" cy="23" r="4" fill="#ffd04a"/></g>`;
      case 'tiara': return `<g><path d="M33 30 L38 18 L44 26 L50 12 L56 26 L62 18 L67 30 Z" fill="#ffd04a"/><circle cx="50" cy="20" r="2.6" fill="#ff7aa8"/><circle cx="38" cy="22" r="1.8" fill="#62bdff"/><circle cx="62" cy="22" r="1.8" fill="#62bdff"/></g>`;
      case 'wizard': return `<g><path d="M30 32 L54 -2 L72 32 Z" fill="#5b4bd6"/><ellipse cx="51" cy="32" rx="26" ry="5" fill="#4637b8"/><circle cx="56" cy="16" r="2" fill="#ffd04a"/><circle cx="47" cy="24" r="1.5" fill="#ffd04a"/></g>`;
      case 'headphones': return `<g><path d="M20 50 C20 14 80 14 80 50" stroke="#ff5f7e" stroke-width="6" fill="none"/><rect x="11" y="44" width="13" height="20" rx="6" fill="#ff5f7e"/><rect x="76" y="44" width="13" height="20" rx="6" fill="#ff5f7e"/></g>`;
      case 'crown': return `<g><path d="M32 30 L34 12 L43 22 L50 8 L57 22 L66 12 L68 30 Z" fill="#ffd04a" stroke="#e8a317" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="22" r="3" fill="#ff5f7e"/></g>`;
      case 'halo': return `<ellipse cx="50" cy="13" rx="20" ry="5" fill="none" stroke="#ffe680" stroke-width="3.5"/>`;
      default: return '';
    }
  }

  // Returns an SVG string for a pup portrait. `opts.silhouette` draws an unknown pup.
  function renderPup(pup, opts) {
    const o = opts || {};
    const l = pup.look;
    const eye = l.eye || '#2a2230';
    const eyeR = l.bigEyes ? 5.6 : 4.4;
    const shades = l.acc === 'shades';
    const eyes = shades ? '' :
      `<circle cx="38" cy="51" r="${eyeR}" fill="${eye}"/><circle cx="62" cy="51" r="${eyeR}" fill="${eye}"/>` +
      `<circle cx="${39.6}" cy="${49.2}" r="1.6" fill="#fff"/><circle cx="${63.6}" cy="${49.2}" r="1.6" fill="#fff"/>`;
    const tongue = l.tongue ? `<path d="M46 71 C46 79 54 79 54 71 Z" fill="#ff7f9e"/>` : '';
    const aura = l.aura ? `<circle cx="50" cy="55" r="46" fill="${RARITY[pup.rarity].color}" opacity=".25"/>` : '';
    const body =
      aura + earsSvg(l) +
      `<ellipse cx="50" cy="56" rx="31" ry="28" fill="${l.fur}"/>` +
      patternSvg(l) +
      `<ellipse cx="50" cy="68" rx="14" ry="10" fill="${l.muzzle}"/>` +
      eyes +
      `<ellipse cx="31" cy="62" rx="5" ry="3" fill="#ff8fab" opacity=".45"/><ellipse cx="69" cy="62" rx="5" ry="3" fill="#ff8fab" opacity=".45"/>` +
      tongue +
      `<ellipse cx="50" cy="63" rx="5.2" ry="3.6" fill="#2a2230"/>` +
      `<path d="M50 66 q-4 5 -8 2 M50 66 q4 5 8 2" stroke="#2a2230" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      accSvg(l);
    const style = o.silhouette ? ' style="filter:brightness(0) opacity(.35)"' : '';
    const label = o.silhouette ? 'Unknown pup' : `${pup.name} the ${pup.breed}`;
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"${style}>${body}</svg>`;
  }

  const Pups = { RARITY, POWERS, ROSTER, BY_ID, STARTER_ID, MAX_LEVEL, bonusFor, chargesFor, renderPup };

  root.PB = root.PB || {};
  root.PB.Pups = Pups;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pups;
})(typeof globalThis !== 'undefined' ? globalThis : this);
