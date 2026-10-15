// Buddy powers. Every pup has exactly one, and each copy you own adds a charge per run.
// Each power: { name, desc, target, apply(game, r, c) -> { cleared, lines } }.
// target: null (instant), 'cell' (tap anywhere), 'block' (tap a filled block), 'row', 'col'.
(function (root) {
  'use strict';

  const Core = root.PB && root.PB.Core ? root.PB.Core : require('./core.js');
  const { SIZE, idx } = Core;
  const N = SIZE;

  const none = () => ({ cleared: [], lines: 0 });
  const clear = (game, indices) => Object.assign(Core.clearCells(game, indices), { lines: 0 });
  const filled = (game) => game.board.some((v, i) => Core.isBlock(game, i));
  const blocks = (game) => all((r, c) => Core.isBlock(game, idx(r, c)));
  // For powers with a fixed area: usable only when that area holds something they can clear.
  const hasIn = (area) => (game) => area().some((i) => Core.isBlock(game, i) || game.board[i] === Core.SQUIRREL_COLOR);
  const all = (fn) => { const out = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fn(r, c)) out.push(idx(r, c)); return out; };

  function square(r, c, radius) {
    return all((rr, cc) => Math.abs(rr - r) <= radius && Math.abs(cc - c) <= radius);
  }
  function fill(game, isRow, k) {
    let n = 0;
    for (let j = 0; j < N; j++) if (Core.isBlock(game, isRow ? idx(k, j) : idx(j, k))) n++;
    return n;
  }
  function fullest(game, isRow, count) {
    return [...Array(N).keys()]
      .map((k) => ({ k, n: fill(game, isRow, k) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, count)
      .map((x) => x.k);
  }
  function shuffle(game, list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(game.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Moves blocks along each line toward one side, keeping their order. Then clears full lines.
  // Posts, holes, puddles, squirrels and the crate stay put; blocks (with their treats, helpers and
  // ice/mud armor) slide into the free slots around them.
  const staysPut = (game, i) => Core.isFixed(game, i) || [Core.PUDDLE_COLOR, Core.SQUIRREL_COLOR, Core.CRATE_COLOR].includes(game.board[i]);
  function compact(game, vertical) {
    for (let a = 0; a < N; a++) {
      const cells = [], slots = [];
      for (let b = 0; b < N; b++) {
        const i = vertical ? idx(N - 1 - b, a) : idx(a, b);
        if (staysPut(game, i)) continue;
        slots.push(i);
        if (game.board[i]) cells.push([game.board[i], game.treats[i], game.specials[i], game.armor[i]]);
        game.board[i] = 0; game.treats[i] = 0; game.specials[i] = 0; game.armor[i] = 0;
      }
      cells.forEach(([color, treat, special, armor], b) => {
        const i = slots[b];
        game.board[i] = color; game.treats[i] = treat; game.specials[i] = special; game.armor[i] = armor;
      });
    }
    return Core.settleLines(game);
  }

  function rotate(piece) {
    const cells = piece.cells.map(([r, c]) => [c, piece.h - 1 - r]);
    return Object.assign({}, piece, { cells, w: piece.h, h: piece.w });
  }

  // Swaps one tray piece for `shape`: the first piece that can't be placed, else the biggest one.
  function swapPiece(g, shapeIds) {
    const live = g.tray.map((p, i) => [p, i]).filter(([p]) => p);
    if (!live.length) return none();
    const stuck = live.find(([p]) => !Core.fitsAnywhere(g.board, p));
    const [, i] = stuck || live.reduce((a, b) => (b[0].cells.length > a[0].cells.length ? b : a));
    const shapes = shapeIds.map((id) => Core.SHAPE_BY_ID[id]);
    const fits = shapes.filter((sh) => Core.fitsAnywhere(g.board, sh));
    const pick = (fits.length ? fits : shapes)[Math.floor(g.rng() * (fits.length || shapes.length))];
    g.tray[i] = Core.makePiece(g, pick);
    return Object.assign(none(), { swapped: i });
  }

  // tier: 1 common, 2 rare, 3 epic, 4 legendary. Pups only get powers of their own tier.
  // Tier 1 = piece tools and tiny clears, 2 = one line or area, 3 = big or clever, 4 = game-changing.
  const POWERS = {
    // ---- tier 1: common
    fetch: { tier: 1, name: 'Fetch', desc: 'Swap your three pieces for new ones', apply: (g) => { Core.dealTray(g); return none(); } },
    spin: {
      tier: 1, name: 'Spin', desc: 'Rotate all your pieces a quarter turn',
      can: (g) => g.tray.some(Boolean),
      apply: (g) => { g.tray = g.tray.map((p) => (p ? rotate(p) : null)); return none(); },
    },
    goodsit: { tier: 1, name: 'Good Sit', desc: 'Swap your worst piece for a 2×2 square', can: (g) => g.tray.some(Boolean), apply: (g) => swapPiece(g, ['o2']) },
    stick: { tier: 1, name: 'Stick!', desc: 'Swap your worst piece for a 4-long stick', can: (g) => g.tray.some(Boolean), apply: (g) => swapPiece(g, ['i4h', 'i4v']) },
    nap: { tier: 1, name: 'Nap Time', desc: 'Swap in three small pieces', apply: (g) => { Core.dealTray(g, { small: true }); return none(); } },
    pampered: {
      tier: 1, name: 'Pampered', desc: 'Turn your pieces into single blocks',
      apply: (g) => { g.tray = g.tray.map(() => Core.makePiece(g, Core.SHAPE_BY_ID.dot)); return none(); },
    },
    scratch: { tier: 1, name: 'Scratch', desc: 'Clear a 2×2 patch you tap', target: 'cell', can: filled, apply: (g, r, c) => clear(g, all((rr, cc) => rr >= Math.min(r, N - 2) && rr < Math.min(r, N - 2) + 2 && cc >= Math.min(c, N - 2) && cc < Math.min(c, N - 2) + 2)) },
    nibble: { tier: 1, name: 'Nibble', desc: 'Clear one block you tap', target: 'block', can: filled, apply: (g, r, c) => clear(g, [idx(r, c)]) },
    shakeoff: { tier: 1, name: 'Shake Off', desc: 'Clear 4 random blocks', can: filled, apply: (g) => clear(g, shuffle(g, blocks(g)).slice(0, 4)) },
    treattoss: {
      tier: 1, name: 'Treat Toss', desc: 'Hide 4 bone treats in your blocks',
      can: (g) => g.board.some((v, i) => Core.isBlock(g, i) && !g.treats[i] && g.specials[i] !== Core.SPECIAL.CRATE),
      apply: (g) => {
        const spots = shuffle(g, blocks(g).filter((i) => !g.treats[i] && g.specials[i] !== Core.SPECIAL.CRATE)).slice(0, 4);
        spots.forEach((i) => { g.treats[i] = 1; });
        return Object.assign(none(), { treated: spots });
      },
    },
    // ---- tier 2: rare
    dig: { tier: 2, name: 'Dig', desc: 'Clear a 3×3 patch you tap', target: 'cell', can: filled, apply: (g, r, c) => clear(g, square(r, c, 1)) },
    tailwag: { tier: 2, name: 'Tail Wag', desc: 'Clear a whole row you tap', target: 'row', can: filled, apply: (g, r) => clear(g, Core.lineIndices([r], [])) },
    pounce: { tier: 2, name: 'Pounce', desc: 'Clear a whole column you tap', target: 'col', can: filled, apply: (g, r, c) => clear(g, Core.lineIndices([], [c])) },
    howl: { tier: 2, name: 'Howl', desc: 'Clear the fullest row', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 1), [])) },
    spotted: { tier: 2, name: 'Spotted', desc: 'Clear 8 random blocks', can: filled, apply: (g) => clear(g, shuffle(g, blocks(g)).slice(0, 8)) },
    zigzag: { tier: 2, name: 'Zigzag', desc: 'Clear both diagonals', can: hasIn(() => all((r, c) => r === c || r + c === N - 1)), apply: (g) => clear(g, all((r, c) => r === c || r + c === N - 1)) },
    sniff: {
      tier: 2, name: 'Sniff Out', desc: 'Tap a block to clear every block of its color', target: 'block', can: filled,
      apply: (g, r, c) => { const color = g.board[idx(r, c)]; return clear(g, all((rr, cc) => g.board[idx(rr, cc)] === color)); },
    },
    // ---- tier 3: epic
    zoomies: { tier: 3, name: 'Zoomies', desc: 'Clear the fullest row and column', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 1), fullest(g, false, 1))) },
    cannonball: { tier: 3, name: 'Cannonball', desc: 'Clear a 5×5 area you tap', target: 'cell', can: filled, apply: (g, r, c) => clear(g, square(r, c, 2)) },
    doover: {
      tier: 3, name: 'Do-Over', desc: 'Undo your last move',
      can: (g) => !!g.history,
      apply: (g) => { Core.restore(g, g.history); return none(); },
    },
    clairvoyance: {
      tier: 3, name: 'Crystal Ball', desc: 'Get three pieces that each complete a line',
      apply: (g) => {
        g.tray = [0, 1, 2].map(() => Core.makePiece(g, Core.findHelpfulShape(g) || Core.SHAPE_BY_ID.dot));
        return none();
      },
    },
    bassdrop: { tier: 3, name: 'Bass Drop', desc: 'Clear the middle 4×4', can: hasIn(() => all((r, c) => r >= 2 && r < 6 && c >= 2 && c < 6)), apply: (g) => clear(g, all((r, c) => r >= 2 && r < 6 && c >= 2 && c < 6)) },
    // ---- tier 4: legendary
    guardian: { tier: 4, name: 'Guardian', desc: 'Saves your run when you get stuck', passive: true, apply: (g) => Core.revive(g) },
    bigbang: { tier: 4, name: 'Big Bang', desc: 'Clear the entire board', can: filled, apply: (g) => clear(g, all(() => true)) },

    // ---- reserved for future pups (DLC / events). Built and tested, not on anyone yet.
    avalanche: { tier: 4, reserved: true, name: 'Avalanche', desc: 'Drop every block to the bottom, then clear full lines', can: filled, apply: (g) => compact(g, true) },
    herd: { tier: 4, reserved: true, name: 'Herd', desc: 'Push every block to the left, then clear full lines', can: filled, apply: (g) => compact(g, false) },
    hopscotch: { tier: 4, reserved: true, name: 'Hopscotch', desc: 'Clear every other square, like a checkerboard', can: hasIn(() => all((r, c) => (r + c) % 2 === 0)), apply: (g) => clear(g, all((r, c) => (r + c) % 2 === 0)) },
    trim: { tier: 3, reserved: true, name: 'Trim', desc: 'Clear the outer edge of the board', can: hasIn(() => all((r, c) => r === 0 || c === 0 || r === N - 1 || c === N - 1)), apply: (g) => clear(g, all((r, c) => r === 0 || c === 0 || r === N - 1 || c === N - 1)) },
    dropthebeat: { tier: 3, reserved: true, name: 'Drop the Beat', desc: 'Clear the two fullest rows and columns', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 2), fullest(g, false, 2))) },
  };

  function canUse(id, game) {
    const p = POWERS[id];
    return !p.passive && (!p.can || p.can(game));
  }

  // Validates a tap for targeted powers. Returns false if the tap can't be used.
  function validTarget(id, game, r, c) {
    if (POWERS[id].target === 'block') return Core.isBlock(game, idx(r, c));
    return true;
  }

  function use(id, game, r, c) {
    const res = POWERS[id].apply(game, r, c);
    if (id !== 'doover') game.history = null; // powers can't be undone
    return res;
  }

  // Cells a targeted power would clear at (r, c), worked out on a throwaway copy of the game.
  function previewCells(id, game, r, c) {
    const copy = Object.assign({}, game, {
      board: game.board.slice(), treats: game.treats.slice(), specials: game.specials.slice(), tray: game.tray.slice(),
      buried: game.buried.slice(), armor: game.armor.slice(), squirrels: game.squirrels.map((q) => Object.assign({}, q)),
    });
    POWERS[id].apply(copy, r, c);
    const out = [];
    // Cleared cells, plus ice and mud that would lose armor.
    for (let i = 0; i < game.board.length; i++) if ((game.board[i] && !copy.board[i]) || copy.armor[i] < game.armor[i]) out.push(i);
    return out;
  }

  const Powers = { POWERS, canUse, validTarget, use, rotate, previewCells };

  root.PB = root.PB || {};
  root.PB.Powers = Powers;
  if (typeof module !== 'undefined' && module.exports) module.exports = Powers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
