// Magic Boba — rules engine + solver. Works in Node and the browser.
//
// A cup is a string of ingredient codes, bottom -> top, e.g. "PTT" = pearls under two taro.
// Codes: see FLAVORS. 'P' (tapioca pearls) is solid: it always sinks below liquid.
//
// Modes
//  - "sort":   win when every non-empty cup is full of a single ingredient.
//  - "orders": customers queue at the counter. Up to `slots` order cups are open at a time;
//              you may pour into an order cup only the ingredient its recipe needs next.
//              A finished order leaves and the next customer steps up. Win = all served.
(function (root) {
  const FLAVORS = {
    T: { name: 'Taro', color: '#a689e0' },
    M: { name: 'Matcha', color: '#7cc46a' },
    G: { name: 'Mango', color: '#f7b733' },
    S: { name: 'Strawberry', color: '#f47fa4' },
    B: { name: 'Blueberry', color: '#5b8def' },
    R: { name: 'Brown Sugar', color: '#a8693b' },
    L: { name: 'Lychee', color: '#efe6cf' },
    K: { name: 'Black Tea', color: '#5a3b2e' },
    W: { name: 'Moon Milk', color: '#f8f8ff' },
    P: { name: 'Pearls', color: '#2b1d1d', solid: true },
  };

  const isPearl = (c) => c === 'P';

  // Length of the run of identical ingredients on top of a cup.
  function topRun(cup) {
    if (!cup.length) return 0;
    const t = cup[cup.length - 1];
    let n = 0;
    for (let i = cup.length - 1; i >= 0 && cup[i] === t; i--) n++;
    return n;
  }

  // Insert `n` of ingredient `t` into a play cup, applying sink rules.
  function addToCup(cup, t, n) {
    const add = t.repeat(n);
    if (!isPearl(t)) return cup + add;
    let k = 0; // pearls sink beneath all liquid, on top of existing pearls
    while (k < cup.length && isPearl(cup[k])) k++;
    return cup.slice(0, k) + add + cup.slice(k);
  }

  // Can ingredient t be poured onto this play cup at all?
  function accepts(cup, t, cap) {
    if (cup.length >= cap) return false;
    if (!cup.length) return true;
    if (isPearl(t)) return true; // pearls sink through anything
    const top = cup[cup.length - 1];
    return top === t || isPearl(top); // liquid sits on same liquid or on a pearl bed
  }

  // ---- State ---------------------------------------------------------------
  // { cups: string[], caps: int[] (per-cup size), cap (standard cup size), mode,
  //   orders?: string[], slots?, next?: int, open?: [{i, filled}] }

  const capOf = (s, i) => s.caps[i];

  function initState(level) {
    const s = { cups: level.cups.slice(), cap: level.cap || 4, mode: level.mode || 'sort' };
    s.caps = level.caps ? level.caps.slice() : s.cups.map(() => s.cap);
    if (s.mode === 'orders') {
      s.orders = level.orders.slice();
      s.slots = level.slots || 2;
      s.open = [];
      s.next = 0;
      refillSlots(s);
    }
    return s;
  }

  function refillSlots(s) {
    while (s.open.length < s.slots && s.next < s.orders.length) s.open.push({ i: s.next++, filled: 0 });
  }

  function clone(s) {
    const c = { ...s, cups: s.cups.slice(), caps: s.caps.slice() };
    if (s.open) c.open = s.open.map((o) => ({ ...o }));
    return c;
  }

  // Targets: number = play cup index; 'o0','o1'... = open order slot index.
  function legalMoves(s) {
    const moves = [];
    for (let i = 0; i < s.cups.length; i++) {
      const src = s.cups[i];
      if (!src.length) continue;
      const t = src[src.length - 1];
      const run = topRun(src);
      const uniform = run === src.length;
      if (s.mode === 'sort' && uniform && src.length === s.cap) continue; // finished cup
      for (let j = 0; j < s.cups.length; j++) {
        if (i === j) continue;
        const dst = s.cups[j];
        if (!accepts(dst, t, capOf(s, j))) continue;
        if (uniform && !dst.length) continue; // pointless: moving a pure cup into an empty one
        moves.push([i, j]);
      }
      if (s.mode === 'orders') {
        s.open.forEach((o, k) => {
          const recipe = s.orders[o.i];
          if (recipe[o.filled] === t) moves.push([i, 'o' + k]);
        });
      }
    }
    return moves;
  }

  // Returns new state (does not mutate). Also returns how many units moved.
  function applyMove(s, [i, j]) {
    const n = clone(s);
    const src = n.cups[i];
    const t = src[src.length - 1];
    const run = topRun(src);
    let amount;
    if (typeof j === 'number') {
      amount = Math.min(run, capOf(n, j) - n.cups[j].length);
      n.cups[j] = addToCup(n.cups[j], t, amount);
    } else {
      const k = +j.slice(1);
      const o = n.open[k];
      const recipe = n.orders[o.i];
      let need = 0;
      while (recipe[o.filled + need] === t) need++;
      amount = Math.min(run, need);
      o.filled += amount;
      if (o.filled === recipe.length) {
        n.open.splice(k, 1);
        refillSlots(n);
      }
    }
    n.cups[i] = src.slice(0, src.length - amount);
    n.lastAmount = amount;
    return n;
  }

  // Sort win: every non-empty cup holds exactly one standard cup's worth (s.cap) of a single
  // ingredient. Bonus vials smaller than s.cap must therefore end up empty.
  function isWon(s) {
    if (s.mode === 'orders') return s.open.length === 0 && s.next === s.orders.length;
    return s.cups.every((c) => !c.length || (c.length === s.cap && topRun(c) === c.length));
  }

  function key(s) {
    let k = s.cups.map((c, i) => s.caps[i] + ':' + c).sort().join('|');
    if (s.mode === 'orders') k += '#' + s.next + ':' + s.open.map((o) => o.i + '.' + o.filled).join(',');
    return k;
  }

  // Breadth-first search -> optimal move count. Also reports how "trappy" the level is.
  // Pass `startState` to solve from a mid-game position (used for in-game hints).
  function solve(level, maxStates = 400000, startState) {
    const start = startState ? clone(startState) : initState(level);
    if (isWon(start)) return { solvable: true, optimal: 0, path: [], states: 1 };
    const seen = new Map([[key(start), null]]);
    let frontier = [start];
    const parents = new Map();
    let depth = 0;
    let states = 1;
    let branchSum = 0;
    let expanded = 0;
    while (frontier.length) {
      depth++;
      const nextF = [];
      for (const s of frontier) {
        const moves = legalMoves(s);
        branchSum += moves.length;
        expanded++;
        for (const m of moves) {
          const n = applyMove(s, m);
          const k = key(n);
          if (seen.has(k)) continue;
          seen.set(k, true);
          parents.set(n, [s, m]);
          states++;
          if (isWon(n)) {
            const path = [];
            let cur = n;
            while (parents.has(cur)) {
              const [p, mv] = parents.get(cur);
              path.unshift(mv);
              cur = p;
            }
            return { solvable: true, optimal: depth, path, states, branching: +(branchSum / expanded).toFixed(2) };
          }
          if (states > maxStates) return { solvable: null, states, reason: 'state cap' };
          nextF.push(n);
        }
      }
      frontier = nextF;
    }
    return { solvable: false, states };
  }

  // Monte-Carlo "trap" estimate: % of random-ish playthroughs that get stuck (no legal moves
  // or only revisiting states) before winning. Higher = more punishing level.
  function trapRate(level, runs = 200, rng = Math.random) {
    let stuck = 0;
    for (let r = 0; r < runs; r++) {
      let s = initState(level);
      const seen = new Set([key(s)]);
      let ok = false;
      for (let step = 0; step < 200; step++) {
        if (isWon(s)) { ok = true; break; }
        const opts = legalMoves(s).map((m) => applyMove(s, m)).filter((n) => !seen.has(key(n)));
        if (!opts.length) break;
        s = opts[Math.floor(rng() * opts.length)];
        seen.add(key(s));
      }
      if (!ok) stuck++;
    }
    return Math.round((100 * stuck) / runs);
  }

  // Bonus vial (e.g. reward for watching an ad): an extra empty cup of the given size.
  function addVial(s, size) {
    const n = clone(s);
    n.cups.push('');
    n.caps.push(size);
    return n;
  }

  const api = { FLAVORS, addVial, topRun, addToCup, accepts, initState, legalMoves, applyMove, isWon, key, solve, trapRate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Boba = api;
})(typeof window !== 'undefined' ? window : globalThis);
