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
      const line = result.leveledUp
        ? `Level ${o.level}! ${pw.name} ×${ctx.charges(p, o.level)} per run`
        : o.level >= ctx.maxLevel ? 'Max level' : `${o.dupes}/${ctx.copiesToNext(o.level)} copies to level ${o.level + 1}`;
      progress = `<div class="lvl${result.leveledUp ? ' up' : ''}"><span class="pips">${pips}</span><b>${line}</b><small>+${result.refund} bones</small></div>`;
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
  function multi(sheet, results, ctx) {
    return new Promise((resolve) => {
      sheet.innerHTML = `
        <p class="eyebrow">Ten pulls</p>
        <div class="multi-caps">${results.map((_, i) => `<button type="button" class="slot-cap" data-i="${i}" style="animation-delay:${i * 70}ms">${capsuleHtml('mini')}</button>`).join('')}</div>
        <div class="stack"><button type="button" class="btn" data-act="openall">Open all</button></div>`;
      results.forEach((_, i) => setTimeout(() => { ctx.sfx.tick(); if (i % 3 === 0) ctx.haptic('LIGHT'); }, i * 70 + 200));
      const opened = new Set();
      let busy = false;
      const bestRank = Math.max(...results.map((x) => rank(x.rarity)));

      const openOne = async (i) => {
        if (opened.has(i)) return;
        opened.add(i);
        const res = results[i];
        const slot = sheet.querySelector(`.slot-cap[data-i="${i}"]`);
        const cap = slot.querySelector('.cap');
        const rk = rank(res.rarity);
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

  root.PB = root.PB || {};
  root.PB.PullFX = { crank, single, showResult, multi, burst, flash, COLORS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
