// The Pup-a-Matic pull sequence: crank, capsule drop, rarity build-up, crack, burst, reveal.
// Pure presentation. main.js passes in what it needs through `ctx`.
(function (root) {
  'use strict';

  const ORDER = ['common', 'rare', 'epic', 'legendary'];
  const COLORS = { common: '#7fd99e', rare: '#5ab8ff', epic: '#b77cff', legendary: '#ffcc33' };
  const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const rank = (r) => ORDER.indexOf(r);

  const PAW = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="15.5" rx="5.2" ry="4.4"/><circle cx="5.5" cy="9.5" r="2.4"/><circle cx="9.6" cy="5.6" r="2.4"/><circle cx="14.4" cy="5.6" r="2.4"/><circle cx="18.5" cy="9.5" r="2.4"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1 C13 9 15 11 23 12 C15 13 13 15 12 23 C11 15 9 13 1 12 C9 11 11 9 12 1 Z"/></svg>';

  // Flying paws, stars and confetti from the center of `host`.
  function burst(host, color, count, spread) {
    if (reduced()) return;
    const box = document.createElement('div');
    box.className = 'particles';
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      const kind = i % 3;
      p.className = 'pt ' + ['paw', 'star', 'bit'][kind];
      if (kind < 2) p.innerHTML = kind === 0 ? PAW : STAR;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const d = (spread || 140) * (0.55 + Math.random() * 0.6);
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
      p.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg');
      p.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2));
      p.style.color = i % 4 === 0 ? '#ffffff' : color;
      p.style.animationDelay = Math.random() * 80 + 'ms';
      box.appendChild(p);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 1500);
  }

  function flash(color) {
    if (reduced()) return;
    const f = document.createElement('div');
    f.className = 'screen-flash';
    f.style.setProperty('--fc', color);
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  const capsuleHtml = (extra) => `
    <div class="cap ${extra || ''}" style="--cc:#dcd8ee">
      <div class="cap-top"><i class="cap-shine"></i></div>
      <div class="cap-band"></div>
      <div class="cap-bottom"></div>
      <svg class="cracks" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 50 L38 30 L42 18 M50 50 L66 34 L74 30 M50 50 L30 56 L18 52 M50 50 L64 66 L70 80"/></svg>
    </div>`;

  // --- Phase 1: the machine on the gacha screen cranks and drops a capsule.
  async function crank(machine, ctx) {
    if (!machine || reduced()) return;
    machine.classList.remove('cranking', 'dropping');
    void machine.getBoundingClientRect();
    machine.classList.add('cranking');
    for (let i = 0; i < 8; i++) {
      ctx.sfx.tick();
      if (i % 2 === 0) ctx.haptic('LIGHT');
      await wait(95);
    }
    machine.classList.add('dropping');
    await wait(280);
    ctx.sfx.thunk(); ctx.haptic('MEDIUM');
    await wait(260);
    machine.classList.remove('cranking', 'dropping');
  }

  // --- Phase 2: one capsule. Tap to build up through the rarities, then it bursts.
  function single(sheet, result, ctx) {
    return new Promise((resolve) => {
      sheet.innerHTML = `
        <div class="pull-stage">
          <div class="halo"></div>
          ${capsuleHtml('enter')}
          <p class="tap-hint">Tap to open</p>
        </div>`;
      const stage = sheet.querySelector('.pull-stage');
      const cap = stage.querySelector('.cap');
      const halo = stage.querySelector('.halo');
      let started = false;
      let fast = false;
      const target = rank(result.rarity);

      const go = async () => {
        if (started) { fast = true; return; }
        started = true;
        stage.querySelector('.tap-hint').classList.add('gone');
        cap.classList.remove('enter', 'idle');
        for (let step = 0; step <= target; step++) {
          const r = ORDER[step];
          cap.style.setProperty('--cc', COLORS[r]);
          halo.style.setProperty('--cc', COLORS[r]);
          restart(cap, 'jolt');
          restart(halo, 'ping');
          ctx.sfx.upgrade(step); ctx.haptic(step >= 2 ? 'HEAVY' : 'MEDIUM');
          if (step >= 2 && !fast) burst(stage, COLORS[r], 6 + step * 2, 70);
          await wait(fast ? 70 : 430 + step * 60);
        }
        if (target >= 2 && !fast) {
          cap.classList.add('charge');
          ctx.sfx.rattle();
          await wait(target === 3 ? 900 : 560);
        }
        cap.classList.add('cracking');
        ctx.sfx.tick(); ctx.haptic('MEDIUM');
        await wait(fast ? 80 : 280);
        cap.classList.add('open');
        ctx.sfx.pop(); ctx.haptic('HEAVY');
        flash(COLORS[result.rarity]);
        burst(stage, COLORS[result.rarity], 18 + target * 10, 150 + target * 30);
        await wait(fast ? 120 : 340);
        resolve();
      };
      stage.addEventListener('click', go);
      setTimeout(() => cap.classList.add('idle'), 520);
      setTimeout(() => { if (!started) go(); }, 4200);
    });
  }

  // --- Phase 3: the result card, staged so each beat lands on its own.
  function showResult(sheet, result, ctx) {
    const p = result.pup;
    const pw = ctx.power(p);
    const r = result.rarity;
    const n = ctx.stars(r);
    let progress;
    if (result.isNew) {
      progress = `<div class="stamp">NEW!</div>`;
    } else {
      const o = ctx.owned(p);
      const pips = Array.from({ length: ctx.maxLevel }, (_, k) => `<i class="${k < o.level ? 'on' : ''}${result.leveledUp && k === o.level - 1 ? ' fresh' : ''}"></i>`).join('');
      const need = ctx.copiesToNext(p, result.leveledUp ? o.level - 1 : o.level);
      const line = result.leveledUp
        ? `Level ${o.level}! ${pw.name} ×${ctx.charges(p, o.level)} per run`
        : o.level >= ctx.maxLevel ? 'Max level' : `${o.dupes}/${need} copies to level ${o.level + 1}`;
      // The copy bar fills from where it was to where it is now; a level-up fills it all the way.
      const from = result.leveledUp ? (need - 1) / need : Math.max(0, o.dupes - 1) / (need || 1);
      const to = result.leveledUp || o.level >= ctx.maxLevel ? 1 : o.dupes / need;
      const bar = `<span class="copybar"><i style="--from:${from.toFixed(3)};--to:${to.toFixed(3)}"></i></span>`;
      progress = `<div class="lvl${result.leveledUp ? ' up' : ''}"><span class="pips">${pips}</span>${bar}<b>${line}</b><small>+${result.refund} bones</small></div>`;
    }
    sheet.innerHTML = `
      <div class="result r-${r}">
        <div class="rays"></div>
        <div class="pup-pop">${ctx.renderPup(p)}</div>
        <div class="banner">
          <span class="rarity-chip">${ctx.rarityLabel(r)}</span>
          <h3>${p.name}</h3>
          <p class="breed">${p.breed}</p>
          <p class="res-stars">${'<span>★</span>'.repeat(n)}</p>
        </div>
        ${progress}
        <p class="res-power"><b>${pw.name}</b> ${pw.desc}</p>
        <div class="stack res-actions">${ctx.actions(result)}</div>
      </div>`;
    ctx.sfx.fanfare(rank(r));
    const stars = sheet.querySelectorAll('.res-stars span');
    stars.forEach((s, i) => setTimeout(() => { s.classList.add('in'); ctx.sfx.ding(i); ctx.haptic('LIGHT'); }, reduced() ? 0 : 520 + i * 150));
    const after = reduced() ? 0 : 560 + n * 150;
    setTimeout(() => {
      const st = sheet.querySelector('.stamp, .lvl');
      if (st) { st.classList.add('in'); ctx.sfx.stamp(); ctx.haptic('MEDIUM'); }
      if (result.leveledUp) setTimeout(() => ctx.sfx.upgrade(3), 200);
    }, after);
    setTimeout(() => sheet.querySelector('.result').classList.add('ready'), after + 250);
  }

  // --- Ten capsules: they drop in, then open one by one (tap one, or open all).
  function multi(sheet, results, ctx, kind) {
    const digging = kind === 'dig';
    return new Promise((resolve) => {
      sheet.innerHTML = `
        <p class="eyebrow">${digging ? 'Ten dig spots' : 'Ten pulls'}</p>
        <div class="multi-caps${digging ? ' yard-grid' : ''}">${results.map((_, i) => `<button type="button" class="slot-cap" data-i="${i}" style="animation-delay:${i * 70}ms">${digging ? moundMini() : capsuleHtml('mini')}</button>`).join('')}</div>
        <div class="stack"><button type="button" class="btn" data-act="openall">${digging ? 'Dig them all' : 'Open all'}</button></div>`;
      results.forEach((_, i) => setTimeout(() => { ctx.sfx.tick(); if (i % 3 === 0) ctx.haptic('LIGHT'); }, i * 70 + 200));
      const opened = new Set();
      let busy = false;
      const bestRank = Math.max(...results.map((x) => rank(x.rarity)));

      const openOne = async (i) => {
        if (opened.has(i)) return;
        opened.add(i);
        const res = results[i];
        const slot = sheet.querySelector(`.slot-cap[data-i="${i}"]`);
        const rk = rank(res.rarity);
        if (digging) {
          slot.style.setProperty('--cc', COLORS[res.rarity]);
          slot.classList.add('dug');
          ctx.sfx.dig(); ctx.haptic('LIGHT');
          dirtSpray(slot, 8, 40, '62%');
          await wait(rk >= 2 ? 420 : 220);
          ctx.sfx.upgrade(rk);
          ctx.sfx.pop(); ctx.haptic(rk >= 2 ? 'HEAVY' : 'LIGHT');
          burst(slot, COLORS[res.rarity], 6 + rk * 5, 50 + rk * 20);
          if (rk >= 2) flash(COLORS[res.rarity]);
          slot.insertAdjacentHTML('beforeend', ctx.miniCard(res));
          slot.classList.add('done');
          if (opened.size === results.length) finish();
          return;
        }
        const cap = slot.querySelector('.cap');
        cap.style.setProperty('--cc', COLORS[res.rarity]);
        restart(cap, 'jolt');
        ctx.sfx.upgrade(rk);
        await wait(rk >= 2 ? 300 : 120);
        cap.classList.add('open');
        ctx.sfx.pop(); ctx.haptic(rk >= 2 ? 'HEAVY' : 'LIGHT');
        burst(slot, COLORS[res.rarity], 6 + rk * 5, 50 + rk * 20);
        if (rk >= 2) flash(COLORS[res.rarity]);
        slot.insertAdjacentHTML('beforeend', ctx.miniCard(res));
        slot.classList.add('done');
        if (opened.size === results.length) finish();
      };

      const finish = () => {
        const best = sheet.querySelectorAll('.slot-cap')[results.findIndex((x) => rank(x.rarity) === bestRank)];
        if (best) best.classList.add('best');
        ctx.sfx.fanfare(bestRank);
        const actions = sheet.querySelector('.stack');
        actions.innerHTML = ctx.multiActions();
        resolve();
      };

      sheet.onclick = async (e) => {
        const slot = e.target.closest('.slot-cap');
        if (slot) { openOne(Number(slot.dataset.i)); return; }
        if (e.target.closest('[data-act="openall"]') && !busy) {
          busy = true;
          e.target.closest('[data-act="openall"]').disabled = true;
          for (let i = 0; i < results.length; i++) {
            if (opened.has(i)) continue;
            await openOne(i);
            await wait(rank(results[i].rarity) >= 2 ? 360 : 150);
          }
        }
      };
    });
  }

  // ================================================================ dig
  // A backyard mound. Each tap digs deeper; a glow rises through the dirt in the rarity colors;
  // on the last dig the pup's silhouette (ears first) peeks out, wiggles, and bursts free.

  const DIRT = ['#8a5a36', '#a8714a', '#6b4329', '#5a3720'];

  function dirtSpray(host, count, spread, top) {
    if (reduced()) return;
    const box = document.createElement('div');
    box.className = 'particles dirt';
    if (top) box.style.top = top;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'pt clump';
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const d = (spread || 90) * (0.5 + Math.random() * 0.7);
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.setProperty('--r', (Math.random() * 360) + 'deg');
      p.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2));
      p.style.background = i % 7 === 0 ? '#6cc47a' : DIRT[i % DIRT.length];
      box.appendChild(p);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 1300);
  }

  const PAW_PATH = '<ellipse cx="0" cy="6" rx="9" ry="7.5"/><circle cx="-10" cy="-5" r="4"/><circle cx="-3.6" cy="-11" r="4"/><circle cx="3.6" cy="-11" r="4"/><circle cx="10" cy="-5" r="4"/>';

  // The yard scene. `peek` is the pup's SVG (drawn as a silhouette until it bursts out).
  let yardCount = 0;
  function yardSvg(peek) {
    const u = 'y' + (++yardCount);
    const tufts = [[40, 150], [62, 196], [236, 196], [262, 152], [118, 206], [190, 207]]
      .map(([x, y]) => `<path d="M${x} ${y} l3 -9 l3 9 l3 -7 l2 7" stroke="#3f9a55" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const flowers = [[52, 172, '#ff8fab'], [250, 176, '#ffd04a'], [84, 204, '#ffffff']]
      .map(([x, y, c]) => `<g transform="translate(${x} ${y})"><circle r="3" cx="-3" fill="${c}"/><circle r="3" cx="3" fill="${c}"/><circle r="3" cy="-3" fill="${c}"/><circle r="3" cy="3" fill="${c}"/><circle r="2" fill="#ffb347"/></g>`).join('');
    return `<svg class="yard" viewBox="0 0 300 240" role="img" aria-label="A dirt mound in the backyard">
      <defs>
        <radialGradient id="dg-glow-${u}"><stop offset="0" style="stop-color:#fff"/><stop offset=".35" style="stop-color:var(--cc)"/><stop offset="1" style="stop-color:var(--cc);stop-opacity:0"/></radialGradient>
        <linearGradient id="dg-col-${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--cc);stop-opacity:.75"/><stop offset="1" style="stop-color:var(--cc);stop-opacity:0"/></linearGradient>
        <clipPath id="dg-clip-${u}"><rect x="0" y="0" width="300" height="163"/></clipPath>
        <filter id="dg-sil-${u}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .1  0 0 0 0 .06  0 0 0 0 .14  0 0 0 1 0"/></filter>
      </defs>
      <ellipse cx="150" cy="176" rx="146" ry="60" fill="#3f9a55"/>
      <ellipse cx="150" cy="170" rx="140" ry="54" fill="#5fbf72"/>
      <ellipse cx="120" cy="150" rx="70" ry="16" fill="#79d08a" opacity=".55"/>
      ${tufts}${flowers}
      <g class="pile pile-l"><path d="M44 172 C48 150 82 148 88 172 Z" fill="#8a5a36"/><circle cx="58" cy="164" r="3" fill="#6b4329"/><circle cx="74" cy="160" r="2.4" fill="#a8714a"/></g>
      <g class="pile pile-r"><path d="M212 172 C218 150 252 148 256 172 Z" fill="#8a5a36"/><circle cx="228" cy="162" r="2.6" fill="#a8714a"/><circle cx="244" cy="166" r="3" fill="#6b4329"/></g>
      <g class="holeg"><ellipse cx="150" cy="163" rx="72" ry="25" fill="#2b1a10"/><ellipse cx="150" cy="166" rx="58" ry="17" fill="#1c1009"/></g>
      <ellipse class="glow" cx="150" cy="163" rx="70" ry="26" fill="url(#dg-glow-${u})"/>
      <path class="column" d="M100 163 L118 20 L182 20 L200 163 Z" fill="url(#dg-col-${u})"/>
      <g class="beams">${[-50, -25, 0, 25, 50].map((a) => `<rect x="146" y="-30" width="8" height="195" rx="4" fill="var(--cc)" opacity=".55" transform="rotate(${a} 150 163)"/>`).join('')}</g>
      <g clip-path="url(#dg-clip-${u})"><g class="peek"><g filter="url(#dg-sil-${u})">${peek ? `<svg x="95" y="100" width="110" height="110" viewBox="0 0 120 120" overflow="visible">${peek}</svg>` : ''}</g></g></g>
      <g class="holeg"><path d="M78 163 A72 25 0 0 0 222 163" stroke="#a8714a" stroke-width="7" fill="none" stroke-linecap="round"/></g>
      <g class="mound">
        <path d="M92 168 C96 112 204 112 208 168 Z" fill="#8a5a36"/>
        <path d="M104 160 C110 128 190 128 196 160" stroke="#a8714a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>
        <circle cx="128" cy="146" r="4" fill="#6b4329"/><circle cx="170" cy="138" r="3" fill="#6b4329"/><circle cx="152" cy="154" r="3.4" fill="#a8714a"/>
        <path d="M138 130 l24 16 M162 130 l-24 16" stroke="#f3e2c0" stroke-width="5" stroke-linecap="round"/>
      </g>
      ${peek ? '' : `<g class="sign"><rect x="244" y="118" width="7" height="58" rx="3" fill="#9a6232"/><rect x="222" y="96" width="52" height="34" rx="8" fill="#d79a5e" stroke="#8a5528" stroke-width="2.5"/><g transform="translate(248 114) scale(.7)" fill="#8a5528">${PAW_PATH}</g></g>
      <g transform="translate(64 196) rotate(-18)"><path d="M-14 -3 h28 a5 5 0 1 1 3 7 a5 5 0 1 1 -3 7 h-28 a5 5 0 1 1 -3 -7 a5 5 0 1 1 3 -7 z" fill="#fff4e2" stroke="#c9a77c" stroke-width="1.6"/></g>`}
      <g class="swipe"><g fill="#f3d9b8" stroke="#6b4329" stroke-width="2">${PAW_PATH}</g></g>
    </svg>`;
  }

  function dig(sheet, result, ctx) {
    return new Promise((resolve) => {
      const target = rank(result.rarity);
      const total = 3 + target; // commons take 3 digs, legendaries 6
      sheet.innerHTML = `
        <div class="pull-stage dig-stage" style="--cc:#ffffff;--h:.05;--m:1;--p:0;--g:0">
          <div class="halo"></div>
          ${yardSvg(ctx.renderPup(result.pup, { plain: true }))}
          <p class="tap-hint">Tap to dig!</p>
        </div>`;
      const stage = sheet.querySelector('.dig-stage');
      const yard = stage.querySelector('.yard');
      const halo = stage.querySelector('.halo');
      const hint = stage.querySelector('.tap-hint');
      let digs = 0;
      let done = false;
      let idle = null;

      const set = (k, v) => stage.style.setProperty(k, v);
      const armIdle = () => { clearTimeout(idle); idle = setTimeout(() => { if (!done) dig1(); }, 7000); };

      const dig1 = async () => {
        if (done) return;
        digs++;
        armIdle();
        const swipe = yard.querySelector('.swipe');
        swipe.classList.remove('l', 'r');
        void swipe.getBoundingClientRect();
        swipe.classList.add(digs % 2 ? 'l' : 'r');
        restart(yard, 'thud');
        ctx.sfx.dig(); ctx.haptic('MEDIUM');
        dirtSpray(stage, 12, 110);
        const f = digs / total;
        set('--h', (0.25 + f * 0.75).toFixed(2));
        set('--m', Math.max(0, 1 - f * 1.6).toFixed(2));
        set('--p', Math.min(1, f * 1.2).toFixed(2));
        if (digs >= 2 && digs < total) {
          const step = Math.min(digs - 2, target);
          set('--cc', COLORS[ORDER[step]]);
          halo.style.setProperty('--cc', COLORS[ORDER[step]]);
          set('--g', (0.55 + step * 0.15).toFixed(2));
          restart(halo, 'ping');
          setTimeout(() => ctx.sfx.upgrade(step), 90);
          if (step >= 2) burst(stage, COLORS[ORDER[step]], 6 + step * 2, 80);
        }
        hint.textContent = digs < total - 1 ? 'Keep digging!' : 'One more!';
        if (digs < total) return;

        // Last dig: ears first.
        done = true;
        clearTimeout(idle);
        hint.classList.add('gone');
        set('--cc', COLORS[result.rarity]);
        set('--g', 1);
        yard.classList.add('peeking');
        ctx.sfx.sniff();
        await wait(450);
        yard.classList.add('wiggle');
        ctx.haptic('LIGHT');
        if (target >= 2) { yard.classList.add('beaming'); ctx.sfx.rattle(); }
        await wait(target === 3 ? 1100 : target === 2 ? 800 : 550);
        yard.classList.add('burst');
        ctx.sfx.pop(); ctx.haptic('HEAVY');
        flash(COLORS[result.rarity]);
        burst(stage, COLORS[result.rarity], 18 + target * 10, 150 + target * 30);
        dirtSpray(stage, 16, 150);
        await wait(320);
        resolve();
      };

      stage.addEventListener('click', dig1);
      armIdle();
    });
  }

  function moundMini() {
    return `<svg class="mini-yard" viewBox="0 0 60 50" aria-hidden="true">
      <ellipse cx="30" cy="36" rx="28" ry="11" fill="#5fbf72"/>
      <ellipse class="mini-glow" cx="30" cy="34" rx="16" ry="6"/>
      <ellipse class="mini-hole" cx="30" cy="34" rx="12" ry="4.2" fill="#2b1a10"/>
      <path class="mini-mound" d="M14 36 C16 16 44 16 46 36 Z" fill="#8a5a36"/>
      <path class="mini-mound" d="M25 25 l10 6 M35 25 l-10 6" stroke="#f3e2c0" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`;
  }

  root.PB = root.PB || {};
  root.PB.PullFX = { crank, single, dig, showResult, multi, burst, flash, yardSvg, COLORS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
