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
  const filled = (game) => game.board.some(Boolean);
  const all = (fn) => { const out = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fn(r, c)) out.push(idx(r, c)); return out; };

  function square(r, c, radius) {
    return all((rr, cc) => Math.abs(rr - r) <= radius && Math.abs(cc - c) <= radius);
  }
  function fill(game, isRow, k) {
    let n = 0;
    for (let j = 0; j < N; j++) if (game.board[isRow ? idx(k, j) : idx(j, k)]) n++;
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
  function compact(game, vertical) {
    for (let a = 0; a < N; a++) {
      const cells = [];
      for (let b = 0; b < N; b++) {
        const i = vertical ? idx(N - 1 - b, a) : idx(a, b);
        if (game.board[i]) cells.push([game.board[i], game.treats[i]]);
        game.board[i] = 0; game.treats[i] = 0;
      }
      cells.forEach(([color, treat], b) => {
        const i = vertical ? idx(N - 1 - b, a) : idx(a, b);
        game.board[i] = color; game.treats[i] = treat;
      });
    }
    return Core.settleLines(game);
  }

  function rotate(piece) {
    const cells = piece.cells.map(([r, c]) => [c, piece.h - 1 - r]);
    return Object.assign({}, piece, { cells, w: piece.h, h: piece.w });
  }

  const POWERS = {
    // ---- common
    fetch: { name: 'Fetch', desc: 'Swap your three pieces for new ones', apply: (g) => { Core.dealTray(g); return none(); } },
    dig: { name: 'Dig', desc: 'Clear a 3×3 patch you tap', target: 'cell', can: filled, apply: (g, r, c) => clear(g, square(r, c, 1)) },
    tailwag: { name: 'Tail Wag', desc: 'Clear a whole row you tap', target: 'row', can: filled, apply: (g, r) => clear(g, Core.lineIndices([r], [])) },
    pounce: { name: 'Pounce', desc: 'Clear a whole column you tap', target: 'col', can: filled, apply: (g, r, c) => clear(g, Core.lineIndices([], [c])) },
    nap: { name: 'Nap Time', desc: 'Swap in three small pieces', apply: (g) => { Core.dealTray(g, { small: true }); return none(); } },
    spin: {
      name: 'Spin', desc: 'Rotate all your pieces a quarter turn',
      can: (g) => g.tray.some(Boolean),
      apply: (g) => { g.tray = g.tray.map((p) => (p ? rotate(p) : null)); return none(); },
    },
    zigzag: { name: 'Zigzag', desc: 'Clear both diagonals', can: filled, apply: (g) => clear(g, all((r, c) => r === c || r + c === N - 1)) },
    treattoss: {
      name: 'Treat Toss', desc: 'Hide 4 bone treats in your blocks',
      can: (g) => g.board.some((v, i) => v && !g.treats[i]),
      apply: (g) => {
        const spots = shuffle(g, all((r, c) => g.board[idx(r, c)] && !g.treats[idx(r, c)])).slice(0, 4);
        spots.forEach((i) => { g.treats[i] = 1; });
        return Object.assign(none(), { treated: spots });
      },
    },
    yap: { name: 'Yap Yap', desc: 'Clear the two fullest rows', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 2), [])) },
    sniff: {
      name: 'Sniff Out', desc: 'Tap a block to clear every block of its color', target: 'block', can: filled,
      apply: (g, r, c) => { const color = g.board[idx(r, c)]; return clear(g, all((rr, cc) => g.board[idx(rr, cc)] === color)); },
    },
    // ---- rare
    spotted: { name: 'Spotted', desc: 'Clear 12 random blocks', can: filled, apply: (g) => clear(g, shuffle(g, all((r, c) => g.board[idx(r, c)])).slice(0, 12)) },
    zoomies: { name: 'Zoomies', desc: 'Clear the fullest row and column', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 1), fullest(g, false, 1))) },
    cuddle: { name: 'Cuddle Pile', desc: 'Clear the middle 4×4', can: filled, apply: (g) => clear(g, all((r, c) => r >= 2 && r < 6 && c >= 2 && c < 6)) },
    avalanche: { name: 'Avalanche', desc: 'Drop every block to the bottom, then clear full lines', can: filled, apply: (g) => compact(g, true) },
    herd: { name: 'Herd', desc: 'Push every block to the left, then clear full lines', can: filled, apply: (g) => compact(g, false) },
    trim: { name: 'Trim', desc: 'Clear the outer edge of the board', can: filled, apply: (g) => clear(g, all((r, c) => r === 0 || c === 0 || r === N - 1 || c === N - 1)) },
    pampered: {
      name: 'Pampered', desc: 'Turn your pieces into single blocks',
      apply: (g) => { g.tray = g.tray.map(() => Core.makePiece(g, Core.SHAPE_BY_ID.dot)); return none(); },
    },
    // ---- epic
    hopscotch: { name: 'Hopscotch', desc: 'Clear every other square, like a checkerboard', can: filled, apply: (g) => clear(g, all((r, c) => (r + c) % 2 === 0)) },
    cannonball: { name: 'Cannonball', desc: 'Clear a 5×5 area you tap', target: 'cell', can: filled, apply: (g, r, c) => clear(g, square(r, c, 2)) },
    doover: {
      name: 'Do-Over', desc: 'Undo your last move',
      can: (g) => !!g.history,
      apply: (g) => { Core.restore(g, g.history); return none(); },
    },
    clairvoyance: {
      name: 'Crystal Ball', desc: 'Get three pieces that each complete a line',
      apply: (g) => {
        g.tray = [0, 1, 2].map(() => Core.makePiece(g, Core.findHelpfulShape(g) || Core.SHAPE_BY_ID.dot));
        return none();
      },
    },
    dropthebeat: { name: 'Drop the Beat', desc: 'Clear the two fullest rows and columns', can: filled, apply: (g) => clear(g, Core.lineIndices(fullest(g, true, 2), fullest(g, false, 2))) },
    // ---- legendary
    guardian: { name: 'Guardian', desc: 'Saves your run when you get stuck', passive: true, apply: (g) => Core.revive(g) },
    bigbang: { name: 'Big Bang', desc: 'Clear the entire board', can: filled, apply: (g) => clear(g, all(() => true)) },
  };

  function canUse(id, game) {
    const p = POWERS[id];
    return !p.passive && (!p.can || p.can(game));
  }

  // Validates a tap for targeted powers. Returns false if the tap can't be used.
  function validTarget(id, game, r, c) {
    if (POWERS[id].target === 'block') return !!game.board[idx(r, c)];
    return true;
  }

  function use(id, game, r, c) {
    const res = POWERS[id].apply(game, r, c);
    if (id !== 'doover') game.history = null; // powers can't be undone
    return res;
  }

  // Cells a targeted power would clear at (r, c), worked out on a throwaway copy of the game.
  function previewCells(id, game, r, c) {
    const copy = Object.assign({}, game, { board: game.board.slice(), treats: game.treats.slice(), tray: game.tray.slice() });
    POWERS[id].apply(copy, r, c);
    const out = [];
    for (let i = 0; i < game.board.length; i++) if (game.board[i] && !copy.board[i]) out.push(i);
    return out;
  }

  const Powers = { POWERS, canUse, validTarget, use, rotate, previewCells };

  root.PB = root.PB || {};
  root.PB.Powers = Powers;
  if (typeof module !== 'undefined' && module.exports) module.exports = Powers;
})(typeof globalThis !== 'undefined' ? globalThis : this);
