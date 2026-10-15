// Board rules for Pup Blast: an 8x8 block-placement puzzle.
// Pure logic, no DOM. Loaded as a browser global (PB.Core) or via require() in tests.
(function (root) {
  'use strict';

  const SIZE = 8;
  const COLORS = 7;
  const TREAT_CHANCE = 0.18;
  const BONES_PER_TREAT = 5;
  const BONES_SCORE_DIVISOR = 25; // bones per run = score / 25 + treats. Tuned for a free player with no ads.
  const COMBO_GRACE_MOVES = 3;
  const BOARD_CLEAR_BONUS = 300;

  // Special cells. Helpers ride on dealt pieces; the crate is placed by a level's starting pattern.
  const SPECIAL = { NONE: 0, GOLDEN: 1, BALL: 2, CRATE: 3 };
  const CRATE_COLOR = 8; // board value for crate cells (they count as filled)
  const CRATE_HP = 2; // line clears through the crate needed to free the pup
  // Fixed cells from World 2 on. Both count as filled, so lines complete around them, but they never
  // clear and nothing can be placed there. A post sits on the board; a hole is off the board's shape.
  const POST_COLOR = 9;
  const HOLE_COLOR = 10;

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

  // opts.start: 8 strings of 8 chars ('.' empty, '#' block, 'b' block with a bone, 'C' crate cell,
  //             'P' fence post, 'x' off the board)
  // opts.helpers: { golden, ball } chance per dealt piece of carrying that helper
  function createGame(seed, opts) {
    const o = opts || {};
    const game = {
      board: new Array(SIZE * SIZE).fill(0),
      treats: new Array(SIZE * SIZE).fill(0),
      specials: new Array(SIZE * SIZE).fill(0),
      crate: null,
      helpers: o.helpers || null,
      tray: [null, null, null],
      score: 0,
      combo: 0,
      movesSinceClear: 0,
      placements: 0,
      linesCleared: 0,
      treatsCollected: 0,
      scoreMult: 1, multMoves: 0,
      history: null,
      rng: mulberry32(seed == null ? (Date.now() & 0xffffffff) : seed),
    };
    if (o.start) loadPattern(game, o.start);
    // On boards with posts or holes, only deal shapes that fit the board's shape somewhere.
    if (game.board.some(fixedValue)) {
      const shapeOnly = game.board.map((v) => (fixedValue(v) ? v : 0));
      game.pool = SHAPES.filter((s) => fitsAnywhere(shapeOnly, s));
    }
    dealTray(game);
    return game;
  }

  function loadPattern(game, rows) {
    const crateCells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      const i = idx(r, c);
      if (ch === '#' || ch === 'b') game.board[i] = 1 + ((r * 3 + c * 5) % COLORS);
      if (ch === 'b') game.treats[i] = 1;
      if (ch === 'C') { game.board[i] = CRATE_COLOR; game.specials[i] = SPECIAL.CRATE; crateCells.push(i); }
      if (ch === 'P' || ch === 'x') game.board[i] = ch === 'P' ? POST_COLOR : HOLE_COLOR;
    }));
    if (crateCells.length) game.crate = { cells: crateCells, hp: CRATE_HP, freed: false };
  }

  function makePiece(game, shape) {
    const color = 1 + Math.floor(game.rng() * COLORS);
    const treat = game.rng() < TREAT_CHANCE ? Math.floor(game.rng() * shape.cells.length) : -1;
    let special = null;
    const h = game.helpers;
    if (h) {
      const roll = game.rng();
      const type = roll < (h.golden || 0) ? SPECIAL.GOLDEN : roll < (h.golden || 0) + (h.ball || 0) ? SPECIAL.BALL : 0;
      if (type) {
        let k = Math.floor(game.rng() * shape.cells.length);
        if (k === treat) k = (k + 1) % shape.cells.length;
        if (k !== treat) special = { k, type };
      }
    }
    return { shapeId: shape.id, cells: shape.cells, w: shape.w, h: shape.h, color, treat, special };
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

  const fixedValue = (v) => v === POST_COLOR || v === HOLE_COLOR;

  // A line is full when every cell is filled and at least one of them is a real block
  // (a column that is all holes is not a line).
  function fullLines(board) {
    const rows = [], cols = [];
    const full = (at) => {
      let real = false;
      for (let k = 0; k < SIZE; k++) { const v = board[at(k)]; if (!v) return false; if (!fixedValue(v)) real = true; }
      return real;
    };
    for (let r = 0; r < SIZE; r++) if (full((k) => idx(r, k))) rows.push(r);
    for (let c = 0; c < SIZE; c++) if (full((k) => idx(k, c))) cols.push(c);
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

  // Powers never clear crate cells; only line clears can break a crate (allowCrate).
  function clearCells(game, indices, allowCrate) {
    const cleared = [];
    let treats = 0;
    const sp = game.specials || [];
    for (const i of indices) {
      if (!game.board[i] || isFixed(game, i)) continue;
      if (sp[i] === SPECIAL.CRATE && !allowCrate) continue;
      cleared.push({ i, color: game.board[i], treat: game.treats[i], special: sp[i] || 0 });
      if (game.treats[i]) treats++;
      game.board[i] = 0;
      game.treats[i] = 0;
      if (game.specials) game.specials[i] = 0;
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

  // One-step history for the Do-Over power.
  function snapshot(game) {
    return {
      board: game.board.slice(), treats: game.treats.slice(), specials: game.specials.slice(),
      crate: game.crate ? Object.assign({}, game.crate, { cells: game.crate.cells.slice() }) : null,
      tray: game.tray.map((p) => (p ? Object.assign({}, p) : null)),
      score: game.score, combo: game.combo, movesSinceClear: game.movesSinceClear,
      placements: game.placements, linesCleared: game.linesCleared, treatsCollected: game.treatsCollected,
    };
  }
  function restore(game, snap) {
    Object.assign(game, snap, { board: snap.board.slice(), treats: snap.treats.slice(), specials: snap.specials.slice() });
    game.history = null;
  }

  // Clears any full rows/columns (after a power reshapes the board) and scores them.
  function settleLines(game) {
    const { rows, cols } = fullLines(game.board);
    const lines = rows.length + cols.length;
    const res = clearCells(game, lineIndices(rows, cols));
    if (lines) { game.linesCleared += lines; game.score += lineScore(lines); }
    return Object.assign(res, { lines });
  }

  function isFixed(game, i) { return fixedValue(game.board[i]); }
  // A cell holding a block that can be cleared (not empty, not a post or hole).
  function isBlock(game, i) { return !!game.board[i] && !isFixed(game, i); }
  function isEmpty(game) { return game.board.every((v, i) => v === 0 || isFixed(game, i)); }

  function placePiece(game, trayIndex, r, c) {
    const piece = game.tray[trayIndex];
    if (!piece || !canPlace(game.board, piece, r, c)) return { ok: false };
    game.history = snapshot(game);

    piece.cells.forEach(([dr, dc], k) => {
      const i = idx(r + dr, c + dc);
      game.board[i] = piece.color;
      game.treats[i] = k === piece.treat ? 1 : 0;
      game.specials[i] = piece.special && piece.special.k === k ? piece.special.type : 0;
    });
    game.tray[trayIndex] = null;
    game.placements++;

    const { rows, cols } = fullLines(game.board);
    const lines = rows.length + cols.length;
    const set = lineIndices(rows, cols);
    const lineCells = set.size;

    // Tennis balls caught in a clear also clear their whole row (and can chain).
    const ballRows = [];
    for (let changed = true; changed;) {
      changed = false;
      for (const i of set) {
        const br = Math.floor(i / SIZE);
        if (game.specials[i] === SPECIAL.BALL && !ballRows.includes(br)) {
          ballRows.push(br);
          for (let k = 0; k < SIZE; k++) set.add(idx(br, k));
          changed = true;
        }
      }
    }
    const golden = [...set].some((i) => game.specials[i] === SPECIAL.GOLDEN && game.board[i]);

    // The crate takes CRATE_HP clears; until then its cells stay put.
    let crateHit = false, crateFreed = false;
    const cr = game.crate;
    if (cr && !cr.freed && cr.cells.some((i) => set.has(i))) {
      crateHit = true;
      cr.hp--;
      if (cr.hp > 0) cr.cells.forEach((i) => set.delete(i));
      else { cr.freed = true; crateFreed = true; cr.cells.forEach((i) => set.add(i)); } // the whole crate breaks open
    }
    const { cleared, treats } = clearCells(game, set, true);

    let points = piece.cells.length;
    let boardClear = false;
    if (lines > 0) {
      game.combo++;
      game.movesSinceClear = 0;
      game.linesCleared += lines;
      points += lineScore(lines) * game.combo * (golden ? 2 : 1) + Math.max(0, set.size - lineCells);
      if (isEmpty(game)) { boardClear = true; points += BOARD_CLEAR_BONUS; }
    } else {
      game.movesSinceClear++;
      if (game.movesSinceClear >= COMBO_GRACE_MOVES) game.combo = 0;
    }
    if (game.multMoves > 0) { points *= game.scoreMult; game.multMoves--; }
    game.score += points;

    let dealt = false;
    if (game.tray.every((p) => p === null)) { dealTray(game); dealt = true; }

    return {
      ok: true, rows, cols, lines, cleared, treats, points, boardClear, dealt, golden, ballRows, crateHit, crateFreed,
      combo: game.combo, gameOver: isGameOver(game),
    };
  }

  function isGameOver(game) {
    return !game.tray.some((p) => p && fitsAnywhere(game.board, p));
  }

  // Finds a shape that completes at least one line somewhere. Dealt now and then so
  // the player regularly gets a satisfying clear.
  function findHelpfulShape(game) {
    const pool = (game.pool || SHAPES).slice().sort(() => game.rng() - 0.5);
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
    const small = opts && (opts.small || opts.pool);
    const pool = (opts && opts.pool) || (small ? SMALL_SHAPES : game.pool || SHAPES);
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

  function bonesForRun(game) {
    return Math.floor(game.score / BONES_SCORE_DIVISOR) + game.treatsCollected * BONES_PER_TREAT;
  }

  const Core = {
    SIZE, COLORS, SHAPES, SHAPE_BY_ID, SMALL_SHAPES, BONES_PER_TREAT, SPECIAL, CRATE_COLOR, CRATE_HP, POST_COLOR, HOLE_COLOR,
    isFixed, isBlock,
    mulberry32, idx, createGame, loadPattern, makePiece, canPlace, fitsAnywhere, fullLines, previewClears,
    placePiece, isGameOver, dealTray, findHelpfulShape, lineScore, lineIndices, clearCells,
    settleLines, snapshot, restore, revive, bonesForRun,
  };

  root.PB = root.PB || {};
  root.PB.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
