// Buddy power animations. Pure presentation: the board has already changed when these run. Cleared
// cells are re-shown and popped on a schedule, with overlays drawn on top, so play never waits.
// Five families by what the power does (area, line, scatter, tray, big), dressed up by rarity:
//   common: the family's motion + the buddy hops
//   rare:   + particles in the pup's color
//   epic:   + the board shakes and flashes
//   legendary: + a short cutscene (dim, buddy banner) before the blast; shorter on repeat uses
// A pup at max level also leaps across the screen first.
(function (root) {
  'use strict';

  const FAMILY = {
    nibble: 'area', scratch: 'area', dig: 'area', cannonball: 'area', bassdrop: 'area', trim: 'area',
    tailwag: 'line', pounce: 'line', howl: 'line', zoomies: 'line', zigzag: 'line', dropthebeat: 'line',
    shakeoff: 'scatter', spotted: 'scatter', sniff: 'scatter', hopscotch: 'scatter', treattoss: 'scatter',
    fetch: 'tray', spin: 'tray', goodsit: 'tray', stick: 'tray', nap: 'tray', pampered: 'tray', clairvoyance: 'tray',
    bigbang: 'big', doover: 'big', guardian: 'big', avalanche: 'big', herd: 'big',
  };
  const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAW = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15.5" rx="5.2" ry="4.4"/><circle cx="5.5" cy="9.5" r="2.4"/><circle cx="9.6" cy="5.6" r="2.4"/><circle cx="14.4" cy="5.6" r="2.4"/><circle cx="18.5" cy="9.5" r="2.4"/></svg>';

  function restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function after(ms, fn) { return setTimeout(fn, ms); }

  // Where cell i sits inside the fx layer, in px.
  function cellBox(ctx, i) {
    const fx = ctx.fx.getBoundingClientRect();
    const b = ctx.cells[i].getBoundingClientRect();
    return { x: b.left - fx.left + b.width / 2, y: b.top - fx.top + b.height / 2, w: b.width };
  }
  function addFx(ctx, cls, style, html) {
    const el = document.createElement('div');
    el.className = 'pfx ' + cls;
    Object.assign(el.style, style || {});
    if (html) el.innerHTML = html;
    ctx.fx.appendChild(el);
    return el;
  }
  function burstAt(ctx, x, y, count, spread) {
    if (!ctx.burst) return;
    const host = addFx(ctx, 'pfx-point', { left: x + 'px', top: y + 'px' });
    ctx.burst(host, ctx.color, count, spread);
    after(1500, () => host.remove());
  }

  // ---- per-family schedules: index → delay (ms) after the lead-in, plus their overlays
  function areaFx(ctx, cleared, lead) {
    const N = ctx.size;
    let or = ctx.r, oc = ctx.c;
    if (or == null) { // no tap (Bass Drop, Trim): the middle of what cleared
      or = cleared.reduce((a, x) => a + Math.floor(x.i / N), 0) / cleared.length;
      oc = cleared.reduce((a, x) => a + (x.i % N), 0) / cleared.length;
    }
    const delays = {};
    let reach = 0;
    for (const { i } of cleared) {
      const d = Math.max(Math.abs(Math.floor(i / N) - or), Math.abs((i % N) - oc));
      delays[i] = Math.round(d * 70);
      reach = Math.max(reach, d);
    }
    after(lead, () => {
      const cx = ctx.cells[0] && cellBox(ctx, Math.round(or) * N + Math.round(oc));
      if (!cx) return;
      const ring = addFx(ctx, 'pfx-ring', { left: cx.x + 'px', top: cx.y + 'px', '--size': (reach * 2 + 1.6) * cx.w + 'px', '--c': ctx.color });
      after(700, () => ring.remove());
      if (ctx.rank >= 1) burstAt(ctx, cx.x, cx.y, 10 + ctx.rank * 6, 50 + reach * cx.w);
    });
    return delays;
  }

  function lineFx(ctx, cleared, lead) {
    const N = ctx.size;
    const rows = new Array(N).fill(0), cols = new Array(N).fill(0);
    for (const { i } of cleared) { rows[Math.floor(i / N)]++; cols[i % N]++; }
    const diag = ctx.id === 'zigzag';
    // Sweep from the tapped cell, or from the busiest row/column crossing, outward.
    const or = ctx.r != null ? ctx.r : rows.indexOf(Math.max(...rows));
    const oc = ctx.c != null ? ctx.c : (ctx.id === 'howl' || ctx.id === 'tailwag') ? 0 : cols.indexOf(Math.max(...cols));
    const delays = {};
    for (const { i } of cleared) {
      const r = Math.floor(i / N), c = i % N;
      delays[i] = diag ? r * 55 : (Math.abs(r - or) + Math.abs(c - oc)) * 40;
    }
    // Streaks along each line that cleared.
    const lines = [];
    if (diag) lines.push(['d', 0], ['d', 1]);
    else {
      const full = (n) => n >= Math.max(2, Math.ceil(N / 3));
      if (ctx.id === 'tailwag' || ctx.id === 'howl') lines.push(['r', or]);
      else if (ctx.id === 'pounce') lines.push(['c', oc]);
      else {
        rows.forEach((n, k) => { if (full(n)) lines.push(['r', k]); });
        cols.forEach((n, k) => { if (full(n)) lines.push(['c', k]); });
      }
    }
    after(lead, () => {
      for (const [t, k] of lines) {
        const a = t === 'r' ? cellBox(ctx, k * N) : t === 'c' ? cellBox(ctx, k) : cellBox(ctx, k ? N - 1 : 0);
        const b = t === 'r' ? cellBox(ctx, k * N + N - 1) : t === 'c' ? cellBox(ctx, (N - 1) * N + k) : cellBox(ctx, k ? (N - 1) * N : N * N - 1);
        const len = Math.hypot(b.x - a.x, b.y - a.y) + a.w;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const from = t === 'r' && ctx.c != null ? (ctx.c / (N - 1)) : 0; // a tapped row sweeps out from the tap
        const s = addFx(ctx, 'pfx-streak', { left: (a.x + b.x) / 2 + 'px', top: (a.y + b.y) / 2 + 'px', width: len + 'px', height: a.w * 0.7 + 'px', '--a': ang + 'rad', '--c': ctx.color, '--o': (from * 100) + '%' });
        after(650, () => s.remove());
        if (ctx.rank >= 1) burstAt(ctx, b.x, b.y, 6 + ctx.rank * 4, 60);
      }
    });
    return delays;
  }

  function scatterFx(ctx, cleared, lead) {
    const delays = {};
    const step = cleared.length > 8 ? 45 : 85;
    cleared.forEach(({ i }, k) => {
      delays[i] = k * step;
      after(lead + k * step, () => {
        const p = cellBox(ctx, i);
        const paw = addFx(ctx, 'pfx-paw', { left: p.x + 'px', top: p.y + 'px', width: p.w * 0.8 + 'px', '--c': ctx.color, '--r': (k % 2 ? 18 : -18) + 'deg' }, PAW);
        after(600, () => paw.remove());
        if (ctx.rank >= 1 && k % 3 === 0) burstAt(ctx, p.x, p.y, 4 + ctx.rank * 2, 30);
      });
    });
    return delays;
  }

  function bigFx(ctx, cleared, lead) {
    if (ctx.id === 'doover') { after(lead, () => restart(ctx.wrap, 'pfx-rewind')); return {}; }
    if (ctx.id === 'guardian') { after(lead, () => restart(ctx.wrap, 'pfx-shield')); return {}; }
    // Big Bang (and the reserved board-wide ones): a blast from the middle out.
    return areaFx(Object.assign({}, ctx, { r: (ctx.size - 1) / 2, c: (ctx.size - 1) / 2 }), cleared, lead);
  }

  function trayFx(ctx, lead) {
    after(lead, () => restart(ctx.tray, 'pfx-deal'));
  }

  // ---- the extras
  function cutscene(ctx, ms) {
    const el = document.createElement('div');
    el.className = 'pfx-cut';
    el.style.setProperty('--c', ctx.color);
    el.style.setProperty('--ms', ms + 'ms');
    el.innerHTML = `<div class="pfx-cut-band"><div class="pfx-cut-pup">${ctx.pupSvg}</div><b>${ctx.powerName}!</b></div>`;
    document.body.appendChild(el);
    after(ms + 250, () => el.remove());
  }

  function leap(ctx) {
    const el = document.createElement('div');
    el.className = 'pfx-leap';
    el.style.setProperty('--c', ctx.color);
    el.innerHTML = `<div class="pfx-leap-y"><div class="pfx-leap-pup">${ctx.pupSvg}</div></div>`;
    document.body.appendChild(el);
    after(1000, () => el.remove());
  }

  // ctx: { id, rarity, color, pupSvg, powerName, maxed, firstUse, r, c, size,
  //        cells, fx, wrap, tray, buddy, burst, flash, sfx, haptic }
  // cleared: [{ i, ... }] from the power. Returns { delays, lead, done } for popping the cells.
  function play(ctx, cleared) {
    const fam = FAMILY[ctx.id] || 'area';
    ctx.rank = RANK[ctx.rarity] || 0;
    restart(ctx.buddy, 'pfx-hop');
    if (reduced()) { if (fam === 'tray') trayFx(ctx, 0); return { delays: {}, lead: 0, done: 0 }; }

    let lead = 0;
    if (ctx.rank >= 3) {
      const ms = ctx.firstUse ? 820 : 380;
      cutscene(ctx, ms);
      lead = ms;
      if (ctx.sfx && ctx.sfx.rattle) ctx.sfx.rattle();
    }
    // Max level: the buddy leaps across first (after the cutscene, so it's never on screen twice).
    if (ctx.maxed) { after(Math.max(0, lead - 150), () => leap(ctx)); lead += 380; }
    let delays = {};
    if (fam === 'area') delays = areaFx(ctx, cleared, lead);
    else if (fam === 'line') delays = lineFx(ctx, cleared, lead);
    else if (fam === 'scatter') delays = scatterFx(ctx, cleared, lead);
    else if (fam === 'big') delays = bigFx(ctx, cleared, lead);
    else trayFx(ctx, lead);

    if (ctx.rank >= 2) {
      after(lead + 60, () => {
        restart(ctx.wrap, 'pfx-shake');
        if (ctx.haptic) ctx.haptic('HEAVY');
        const f = addFx(ctx, 'pfx-flash', { '--c': ctx.color });
        after(450, () => f.remove());
      });
    }
    const last = Object.values(delays).reduce((a, b) => Math.max(a, b), 0);
    return { delays, lead, done: lead + last };
  }

  root.PB = root.PB || {};
  root.PB.PowerFX = { play, FAMILY };
})(typeof globalThis !== 'undefined' ? globalThis : this);
