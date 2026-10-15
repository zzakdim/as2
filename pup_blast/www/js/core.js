// Board rules for Pup Blast: an 8x8 block-placement puzzle.
// Pure logic, no DOM. Loaded as a browser global (PB.Core) or via require() in tests.
(function (root) {
  'use strict';

  const SIZE = 8;
  const COLORS = 7;
  const TREAT_CHANCE = 0.18;
  const BONES_PER_TREAT = 5;
  const COMBO_GRACE_MOVES = 3;
  const BOARD_CLEAR_BONUS = 300;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // [id, rows, weight]. Weights tune how often a shape is dealt.
  const SHAPE_DEFS = [
    ['dot', ['#'], 2],
    ['i2h', ['##'], 3], ['i2v', ['#', '#'], 3],
    ['i3h', ['###'], 3], ['i3v', ['#', '#', '#'], 3],
    ['i4h', ['####'], 2], ['i4v', ['#', '#', '#', '#'], 2],
    ['i5h', ['#####'], 1.5], ['i5v', ['#', '#', '#', '#', '#'], 1.5],
    ['o2', ['##', '##'], 4],
    ['o3', ['###', '###', '###'], 1.2],
    ['r23', ['###', '###'], 1.5], ['r32', ['##', '##', '##'], 1.5],
    ['c1', ['#.', '##'], 2], ['c2', ['.#', '##'], 2], ['c3', ['##', '#.'], 2], ['c4', ['##', '.#'], 2],
    ['l1', ['#.', '#.', '##'], 1], ['l2', ['.#', '.#', '##'], 1], ['l3', ['##', '#.', '#.'], 1], ['l4', ['##', '.#', '.#'], 1],
    ['l5', ['###', '#..'], 1], ['l6', ['###', '..#'], 1], ['l7', ['#..', '###'], 1], ['l8', ['..#', '###'], 1],
    ['b1', ['#..', '#..', '###'], 0.8], ['b2', ['..#', '..#', '###'], 0.8], ['b3', ['###', '#..', '#..'], 0.8], ['b4', ['###', '..#', '..#'], 0.8],
    ['t1', ['###', '.#.'], 1.2], ['t2', ['.#.', '###'], 1.2], ['t3', ['#.', '##', '#.'], 1.2], ['t4', ['.#', '##', '.#'], 1.2],
    ['s1', ['.##', '##.'], 1], ['s2', ['##.', '.##'], 1], ['s3', ['#.', '##', '.#'], 1], ['s4', ['.#', '##', '#.'], 1],
  ];

  const SHAPES = SHAPE_DEFS.map(([id, rows, weight]) => {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { id, cells, w: rows[0].length, h: rows.length, weight };
  });
  const SHAPE_BY_ID = Object.fromEntries(SHAPES.map((s) => [s.id, s]));
  const SMALL_SHAPES = SHAPES.filter((s) => s.cells.length <= 3);

  function idx(r, c) { return r * SIZE + c; }

  function createGame(seed) {
    const game = {
      board: new Array(SIZE * SIZE).fill(0),
      treats: new Array(SIZE * SIZE).fill(0),
      tray: [null, null, null],
      score: 0,
      combo: 0,
      movesSinceClear: 0,
      placements: 0,
      linesCleared: 0,
      treatsCollected: 0,
      rng: mulberry32(seed == null ? (Date.now() & 0xffffffff) : seed),
    };
    dealTray(game);
    return game;
  }

  function makePiece(game, shape) {
    const color = 1 + Math.floor(game.rng() * COLORS);
    const treat = game.rng() < TREAT_CHANCE ? Math.floor(game.rng() * shape.cells.length) : -1;
    return { shapeId: shape.id, cells: shape.cells, w: shape.w, h: shape.h, color, treat };
  }

  function weightedShape(rng, pool) {
    let total = 0;
    for (const s of pool) total += s.weight;
    let roll = rng() * total;
    for (const s of pool) { roll -= s.weight; if (roll <= 0) return s; }
    return pool[pool.length - 1];
  }

  function canPlace(board, piece, r, c) {
    for (const [dr, dc] of piece.cells) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return false;
      if (board[idx(rr, cc)]) return false;
    }
    return true;
  }

  function fitsAnywhere(board, piece) {
    for (let r = 0; r <= SIZE - piece.h; r++) {
      for (let c = 0; c <= SIZE - piece.w; c++) if (canPlace(board, piece, r, c)) return true;
    }
    return false;
  }

  function fullLines(board) {
    const rows = [], cols = [];
    for (let r = 0; r < SIZE; r++) {
      let full = true;
      for (let c = 0; c < SIZE; c++) if (!board[idx(r, c)]) { full = false; break; }
      if (full) rows.push(r);
    }
    for (let c = 0; c < SIZE; c++) {
      let full = true;
      for (let r = 0; r < SIZE; r++) if (!board[idx(r, c)]) { full = false; break; }
      if (full) cols.push(c);
    }
    return { rows, cols };
  }

  // Lines that would complete if the piece were dropped at (r, c). Used for the drag preview.
  function previewClears(board, piece, r, c) {
    if (!canPlace(board, piece, r, c)) return null;
    const next = board.slice();
    for (const [dr, dc] of piece.cells) next[idx(r + dr, c + dc)] = piece.color;
    return fullLines(next);
  }

  function lineScore(lines) { return (10 * lines * (lines + 1)) / 2; }

  function clearCells(game, indices) {
    const cleared = [];
    let treats = 0;
    for (const i of indices) {
      if (!game.board[i]) continue;
      cleared.push({ i, color: game.board[i], treat: game.treats[i] });
      if (game.treats[i]) treats++;
      game.board[i] = 0;
      game.treats[i] = 0;
    }
    game.treatsCollected += treats;
    return { cleared, treats };
  }

  function lineIndices(rows, cols) {
    const set = new Set();
    for (const r of rows) for (let c = 0; c < SIZE; c++) set.add(idx(r, c));
    for (const c of cols) for (let r = 0; r < SIZE; r++) set.add(idx(r, c));
    return set;
  }

  function isEmpty(board) { return board.every((v) => v === 0); }

  function placePiece(game, trayIndex, r, c) {
    const piece = game.tray[trayIndex];
    if (!piece || !canPlace(game.board, piece, r, c)) return { ok: false };

    piece.cells.forEach(([dr, dc], k) => {
      const i = idx(r + dr, c + dc);
      game.board[i] = piece.color;
      game.treats[i] = k === piece.treat ? 1 : 0;
    });
    game.tray[trayIndex] = null;
    game.placements++;

    const { rows, cols } = fullLines(game.board);
    const lines = rows.length + cols.length;
    const { cleared, treats } = clearCells(game, lineIndices(rows, cols));

    let points = piece.cells.length;
    let boardClear = false;
    if (lines > 0) {
      game.combo++;
      game.movesSinceClear = 0;
      game.linesCleared += lines;
      points += lineScore(lines) * game.combo;
      if (isEmpty(game.board)) { boardClear = true; points += BOARD_CLEAR_BONUS; }
    } else {
      game.movesSinceClear++;
      if (game.movesSinceClear >= COMBO_GRACE_MOVES) game.combo = 0;
    }
    game.score += points;

    let dealt = false;
    if (game.tray.every((p) => p === null)) { dealTray(game); dealt = true; }

    return {
      ok: true, rows, cols, lines, cleared, treats, points, boardClear, dealt,
      combo: game.combo, gameOver: isGameOver(game),
    };
  }

  function isGameOver(game) {
    return !game.tray.some((p) => p && fitsAnywhere(game.board, p));
  }

  // Finds a shape that completes at least one line somewhere. Dealt now and then so
  // the player regularly gets a satisfying clear.
  function findHelpfulShape(game) {
    const pool = SHAPES.slice().sort(() => game.rng() - 0.5);
    for (const shape of pool) {
      for (let r = 0; r <= SIZE - shape.h; r++) {
        for (let c = 0; c <= SIZE - shape.w; c++) {
          const clears = previewClears(game.board, shape, r, c);
          if (clears && clears.rows.length + clears.cols.length > 0) return shape;
        }
      }
    }
    return null;
  }

  function dealTray(game, opts) {
    const small = opts && opts.small;
    const pool = small ? SMALL_SHAPES : SHAPES;
    let tray = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const shapes = [0, 1, 2].map(() => weightedShape(game.rng, pool));
      if (!small && game.rng() < 0.35) {
        const helpful = findHelpfulShape(game);
        if (helpful) shapes[Math.floor(game.rng() * 3)] = helpful;
      }
      tray = shapes.map((s) => makePiece(game, s));
      if (tray.some((p) => fitsAnywhere(game.board, p))) break;
    }
    // Never deal a dead tray outright: if nothing fit, fall back to a single block.
    if (!tray.some((p) => fitsAnywhere(game.board, p))) tray[0] = makePiece(game, SHAPE_BY_ID.dot);
    game.tray = tray;
    return tray;
  }

  // --- Buddy powers ---------------------------------------------------------

  function powerDig(game, r, c) {
    const indices = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE) indices.push(idx(rr, cc));
      }
    }
    return clearCells(game, indices);
  }

  function powerZoomies(game) {
    let bestRow = 0, bestCol = 0, rowFill = -1, colFill = -1;
    for (let k = 0; k < SIZE; k++) {
      let rf = 0, cf = 0;
      for (let j = 0; j < SIZE; j++) { if (game.board[idx(k, j)]) rf++; if (game.board[idx(j, k)]) cf++; }
      if (rf > rowFill) { rowFill = rf; bestRow = k; }
      if (cf > colFill) { colFill = cf; bestCol = k; }
    }
    return clearCells(game, lineIndices([bestRow], [bestCol]));
  }

  function powerFetch(game) {
    dealTray(game);
    return { tray: game.tray };
  }

  // Revive: clears the middle 4x4 and deals small pieces so the run can go on.
  function revive(game) {
    const indices = [];
    for (let r = 2; r < 6; r++) for (let c = 2; c < 6; c++) indices.push(idx(r, c));
    const res = clearCells(game, indices);
    game.combo = 0;
    game.movesSinceClear = 0;
    dealTray(game, { small: true });
    return res;
  }

  function bonesForRun(game, multiplier) {
    const base = Math.floor(game.score / 20) + game.treatsCollected * BONES_PER_TREAT;
    return Math.round(base * (multiplier || 1));
  }

  const Core = {
    SIZE, COLORS, SHAPES, SHAPE_BY_ID, BONES_PER_TREAT,
    mulberry32, createGame, canPlace, fitsAnywhere, fullLines, previewClears,
    placePiece, isGameOver, dealTray, lineScore,
    powerDig, powerZoomies, powerFetch, revive, bonesForRun,
  };

  root.PB = root.PB || {};
  root.PB.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
