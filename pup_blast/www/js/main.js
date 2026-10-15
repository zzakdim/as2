// UI for Pup Blast: screens, drag-and-drop, the gacha reveal and the ad touchpoints.
(function () {
  'use strict';

  const { Core, Pups, Gacha, State, Ads, Audio } = window.PB;
  const { sfx, haptic } = Audio;
  const $ = (sel) => document.querySelector(sel);

  const BONE_SVG = '<svg class="bone" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.5a2.6 2.6 0 0 0-2.4 3.6A2.6 2.6 0 1 0 8 12.3l3.7 3.7a2.6 2.6 0 1 0 4.2 2.9 2.6 2.6 0 1 0 3-4.2l-3.7-3.7a2.6 2.6 0 1 0-4.3-2.9 2.6 2.6 0 0 0-3.4-3.6z" fill="currentColor"/></svg>';

  function safeStorage() {
    try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; }
  }
  const storage = safeStorage();
  let state = State.load(storage);
  const loginBonus = State.rollDaily(state, Date.now());
  const save = () => State.save(storage, state);
  save();
  Audio.setSound(state.settings.sound);
  Audio.setHaptics(state.settings.haptics);

  const ads = Ads.createProvider(document);
  ads.init().catch(() => {});
  const rng = Core.mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);

  // Lightweight analytics hook. Wire to Firebase/GameAnalytics in the native build.
  function track(event, params) { if (window.PB_TRACK) window.PB_TRACK(event, params || {}); }

  // ---------------------------------------------------------------- screens
  const screens = ['home', 'game', 'gacha', 'kennel'];
  function show(name) {
    screens.forEach((s) => { $('#screen-' + s).hidden = s !== name; });
    if (name === 'home') renderHome();
    if (name === 'gacha') renderGacha();
    if (name === 'kennel') renderKennel();
  }

  function renderBones() {
    document.querySelectorAll('[data-bones]').forEach((el) => { el.textContent = state.bones.toLocaleString(); });
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------------------------------------------------------------- modal
  function openModal(html, opts) {
    const m = $('#modal');
    $('#modal-sheet').innerHTML = html;
    $('#modal-sheet').className = 'sheet' + (opts && opts.cls ? ' ' + opts.cls : '');
    m.hidden = false;
    return $('#modal-sheet');
  }
  function closeModal() { $('#modal').hidden = true; $('#modal-sheet').innerHTML = ''; }

  function stars(rarity) {
    const n = Pups.RARITY[rarity].stars;
    return `<span class="stars r-${rarity}" aria-label="${Pups.RARITY[rarity].label}">${'★'.repeat(n)}</span>`;
  }

  function perkText(pup, level) {
    const pct = Math.round(Pups.bonusFor(pup, level) * 100);
    return `+${pct}% bones · ${Pups.POWERS[pup.power].name}`;
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    renderBones();
    const pup = Pups.BY_ID[state.buddy];
    const lvl = state.pups[pup.id].level;
    $('#home-buddy').innerHTML = Pups.renderPup(pup);
    $('#home-buddy').className = 'buddy-stage r-' + pup.rarity;
    $('#home-buddy-caption').innerHTML = `<b>${pup.name}</b> · Lv ${lvl} ${stars(pup.rarity)}<br><span>${perkText(pup, lvl)}</span>`;
    $('#home-best').textContent = state.best.toLocaleString();
    const owned = Object.keys(state.pups).length;
    $('#kennel-count').textContent = `${owned}/${Pups.ROSTER.length}`;
    const badge = $('#gacha-badge');
    if (state.daily.freePullsLeft > 0) { badge.hidden = false; badge.textContent = `${state.daily.freePullsLeft} free`; }
    else if (state.bones >= Gacha.COST_1) { badge.hidden = false; badge.textContent = 'Pull!'; }
    else badge.hidden = true;
  }

  $('#home-buddy').addEventListener('click', () => {
    Audio.unlock(); sfx.woof(); haptic('LIGHT');
    const el = $('#home-buddy');
    el.classList.remove('boop'); void el.offsetWidth; el.classList.add('boop');
  });
  $('#btn-play').addEventListener('click', () => { Audio.unlock(); startRun(); });
  $('#btn-gacha').addEventListener('click', () => { Audio.unlock(); show('gacha'); });
  $('#btn-kennel').addEventListener('click', () => { Audio.unlock(); show('kennel'); });
  $('#btn-settings').addEventListener('click', openSettings);
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show('home')));

  // ---------------------------------------------------------------- game
  const boardEl = $('#board');
  const cellEls = [];
  for (let i = 0; i < Core.SIZE * Core.SIZE; i++) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.i = i;
    boardEl.appendChild(c);
    cellEls.push(c);
  }

  let run = null;

  function startRun() {
    const pup = Pups.BY_ID[state.buddy];
    const level = state.pups[pup.id].level;
    run = {
      game: Core.createGame((rng() * 4294967296) >>> 0),
      pup, level,
      mult: 1 + Pups.bonusFor(pup, level),
      charges: Pups.chargesFor(pup, level),
      revived: false, doubled: false, over: false, digMode: false,
    };
    show('game');
    renderBoard(); renderTray(); renderBuddyBar(); renderScore();
    track('run_start', { buddy: pup.id });
  }

  function renderBoard() {
    const g = run.game;
    for (let i = 0; i < cellEls.length; i++) {
      const v = g.board[i];
      cellEls[i].className = v ? `cell b c${v}` : 'cell';
      cellEls[i].innerHTML = v && g.treats[i] ? BONE_SVG : '';
    }
  }

  function renderScore() {
    $('#score').textContent = run.game.score.toLocaleString();
    $('#game-best').textContent = Math.max(state.best, run.game.score).toLocaleString();
    $('#run-bones').textContent = Core.bonesForRun(run.game, run.mult).toLocaleString();
  }

  function pieceEl(piece, cellPx, gapPx) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.style.gridTemplateColumns = `repeat(${piece.w}, ${cellPx}px)`;
    el.style.gridTemplateRows = `repeat(${piece.h}, ${cellPx}px)`;
    el.style.gap = gapPx + 'px';
    piece.cells.forEach(([r, c], k) => {
      const b = document.createElement('div');
      b.className = `cell b c${piece.color}`;
      b.style.gridRow = r + 1;
      b.style.gridColumn = c + 1;
      if (k === piece.treat) b.innerHTML = BONE_SVG;
      el.appendChild(b);
    });
    return el;
  }

  function renderTray() {
    const slots = document.querySelectorAll('#tray .slot');
    const slotW = slots[0].getBoundingClientRect().width || 100;
    run.game.tray.forEach((p, i) => {
      const slot = slots[i];
      slot.innerHTML = '';
      slot.classList.remove('dragging');
      if (!p) return;
      const size = Math.min(22, Math.floor((slotW - 12) / 5));
      const el = pieceEl(p, size, 2);
      if (!Core.fitsAnywhere(run.game.board, p)) el.classList.add('no-fit');
      slot.appendChild(el);
    });
  }

  function renderBuddyBar() {
    const { pup, level, charges } = run;
    $('#game-buddy').innerHTML = Pups.renderPup(pup);
    $('#game-buddy-name').textContent = `${pup.name} · Lv ${level}`;
    $('#game-buddy-perk').textContent = `+${Math.round((run.mult - 1) * 100)}% bones`;
    const btn = $('#btn-power');
    const power = Pups.POWERS[pup.power];
    if (pup.power === 'guardian') {
      btn.textContent = charges > 0 ? 'Guardian ready' : 'Guardian used';
      btn.disabled = true;
    } else {
      btn.textContent = run.digMode ? 'Tap the board…' : `${power.name} ×${charges}`;
      btn.disabled = charges <= 0;
    }
    btn.title = power.desc;
    btn.classList.toggle('armed', run.digMode);
    boardEl.classList.toggle('dig-mode', run.digMode);
  }

  // ---- drag and drop
  let drag = null;

  function boardMetrics() {
    const rect = boardEl.getBoundingClientRect();
    const cs = getComputedStyle(boardEl);
    const pad = parseFloat(cs.paddingLeft) || 0;
    const gap = parseFloat(cs.columnGap) || 0;
    const pitch = (rect.width - pad * 2 + gap) / Core.SIZE;
    return { left: rect.left + pad, top: rect.top + pad, pitch, gap, cell: pitch - gap };
  }

  document.querySelectorAll('#tray .slot').forEach((slot, i) => {
    slot.addEventListener('pointerdown', (e) => startDrag(e, i, slot));
  });

  function startDrag(e, i, slot) {
    if (!run || run.over) return;
    const piece = run.game.tray[i];
    if (!piece) return;
    if (run.digMode) { run.digMode = false; renderBuddyBar(); }
    e.preventDefault();
    Audio.unlock(); sfx.pick(); haptic('LIGHT');
    const m = boardMetrics();
    const ghost = pieceEl(piece, m.cell, m.gap);
    ghost.classList.add('ghost');
    document.body.appendChild(ghost);
    slot.classList.add('dragging');
    // Lift the piece above the finger so it stays visible while dragging.
    const lift = Math.max(m.pitch * 1.4, 56);
    drag = { i, piece, slot, ghost, m, lift, target: null, preview: [] };
    moveDrag(e);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', cancelDrag);
  }

  function clearPreview() {
    for (const i of drag.preview) cellEls[i].classList.remove('preview', 'will-clear', 'pc' + drag.piece.color);
    drag.preview = [];
  }

  function moveDrag(e) {
    if (!drag) return;
    const { piece, m, lift, ghost } = drag;
    const gx = e.clientX - (piece.w * m.pitch) / 2;
    const gy = e.clientY - piece.h * m.pitch - lift + m.pitch / 2;
    ghost.style.transform = `translate(${gx}px, ${gy}px)`;
    const c = Math.round((gx - m.left) / m.pitch);
    const r = Math.round((gy - m.top) / m.pitch);
    const prev = drag.target;
    if (prev && prev.r === r && prev.c === c) return;
    clearPreview();
    const clears = Core.previewClears(run.game.board, piece, r, c);
    drag.target = clears ? { r, c } : null;
    if (!clears) return;
    const mark = (i, cls) => { cellEls[i].classList.add(cls, 'pc' + piece.color); drag.preview.push(i); };
    piece.cells.forEach(([dr, dc]) => mark((r + dr) * Core.SIZE + c + dc, 'preview'));
    for (const rr of clears.rows) for (let k = 0; k < Core.SIZE; k++) mark(rr * Core.SIZE + k, 'will-clear');
    for (const cc of clears.cols) for (let k = 0; k < Core.SIZE; k++) mark(k * Core.SIZE + cc, 'will-clear');
  }

  function detachDrag() {
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', cancelDrag);
    clearPreview();
    drag.ghost.remove();
    drag.slot.classList.remove('dragging');
  }

  function cancelDrag() { if (!drag) return; detachDrag(); drag = null; }

  function endDrag() {
    if (!drag) return;
    const { i, target } = drag;
    detachDrag();
    drag = null;
    if (target) place(i, target.r, target.c);
    else sfx.nope();
  }

  // ---- placing and clearing
  const PRAISE = ['Good pup!', 'Pawsome!', 'Woof-tastic!', 'Fur-midable!', 'Howl yeah!'];

  function popCells(cleared) {
    for (const { i, color, treat } of cleared) {
      cellEls[i].className = `cell b c${color} pop`;
      cellEls[i].innerHTML = treat ? BONE_SVG : '';
    }
    setTimeout(() => { if (run) renderBoard(); }, 340);
  }

  function floatText(text, cls, atIndex) {
    const fx = $('#fx');
    const el = document.createElement('div');
    el.className = 'float ' + (cls || '');
    el.textContent = text;
    if (atIndex != null) {
      el.style.left = ((atIndex % Core.SIZE) + 0.5) * 12.5 + '%';
      el.style.top = (Math.floor(atIndex / Core.SIZE) + 0.5) * 12.5 + '%';
    }
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function celebrate(res) {
    sfx.clear(res.lines || 1, res.combo || 0);
    haptic(res.lines >= 2 ? 'HEAVY' : 'MEDIUM');
    const word = res.boardClear ? 'Squeaky clean! +300' : PRAISE[Math.min(res.lines - 1 + Math.floor(res.combo / 3), PRAISE.length - 1)];
    floatText(word, 'praise');
    if (res.combo >= 2) setTimeout(() => floatText(`Combo ×${res.combo}`, 'combo'), 180);
    res.cleared.filter((c) => c.treat).forEach((c, k) => setTimeout(() => floatText(`+${Core.BONES_PER_TREAT}`, 'treat', c.i), k * 60));
    if (res.cleared.some((c) => c.treat)) setTimeout(() => sfx.coin(), 150);
  }

  function place(i, r, c) {
    const res = Core.placePiece(run.game, i, r, c);
    if (!res.ok) return;
    sfx.place(); haptic('LIGHT');
    renderBoard();
    if (res.lines > 0) { popCells(res.cleared); celebrate(res); }
    renderTray(); renderScore();
    if (res.gameOver) handleStuck();
  }

  // ---- buddy powers
  $('#btn-power').addEventListener('click', () => {
    if (!run || run.charges <= 0) return;
    Audio.unlock();
    const power = run.pup.power;
    if (power === 'dig') { run.digMode = !run.digMode; renderBuddyBar(); return; }
    if (power === 'fetch') {
      Core.powerFetch(run.game);
      sfx.woof(); haptic('MEDIUM');
      floatText('Fetch!', 'praise');
    }
    if (power === 'zoomies') {
      const res = Core.powerZoomies(run.game);
      sfx.woof(); haptic('HEAVY');
      popCells(res.cleared);
      floatText('Zoomies!', 'praise');
      res.cleared.filter((x) => x.treat).forEach((x) => floatText(`+${Core.BONES_PER_TREAT}`, 'treat', x.i));
    }
    usedPower();
  });

  boardEl.addEventListener('click', (e) => {
    if (!run || !run.digMode) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const i = Number(cell.dataset.i);
    const res = Core.powerDig(run.game, Math.floor(i / Core.SIZE), i % Core.SIZE);
    run.digMode = false;
    sfx.woof(); haptic('HEAVY');
    popCells(res.cleared);
    floatText('Dig!', 'praise');
    res.cleared.filter((x) => x.treat).forEach((x) => floatText(`+${Core.BONES_PER_TREAT}`, 'treat', x.i));
    usedPower();
  });

  function usedPower() {
    run.charges--;
    run.over = false;
    $('#btn-power').classList.remove('nudge');
    renderTray(); renderScore(); renderBuddyBar();
    track('power_used', { power: run.pup.power });
    if (Core.isGameOver(run.game)) handleStuck();
  }

  function handleStuck() {
    run.over = true;
    if (run.pup.power === 'guardian' && run.charges > 0) {
      run.charges = 0;
      setTimeout(() => {
        Core.revive(run.game);
        run.over = false;
        sfx.woof(); haptic('HEAVY');
        floatText(`${run.pup.name} saved you!`, 'praise');
        renderBoard(); renderTray(); renderBuddyBar();
      }, 500);
      return;
    }
    if (run.charges > 0) {
      // Let the player try their buddy's power before calling the run.
      run.over = false;
      $('#btn-power').classList.add('nudge');
      toast(`No room! Try ${run.pup.name}'s ${Pups.POWERS[run.pup.power].name}`);
      run.stuckWithPower = true;
      return;
    }
    sfx.gameOver(); haptic('HEAVY');
    setTimeout(showGameOver, 650);
  }

  // A run that is stuck but still has a power charge can be ended by the player.
  function giveUpIfStuck() {
    if (run && run.stuckWithPower && Core.isGameOver(run.game)) { run.charges = 0; renderBuddyBar(); handleStuck(); return true; }
    return false;
  }

  function runBones() { return Core.bonesForRun(run.game, run.mult) * (run.doubled ? 2 : 1); }

  function showGameOver() {
    const g = run.game;
    const isBest = g.score > state.best;
    const bones = runBones();
    const sheet = openModal(`
      <p class="eyebrow">${isBest ? 'New best score' : 'Out of room'}</p>
      <p class="go-score">${g.score.toLocaleString()}</p>
      <p class="go-sub">${g.linesCleared} lines · ${g.treatsCollected} treats · ${run.pup.name} +${Math.round((run.mult - 1) * 100)}%</p>
      <p class="go-bones">${BONE_SVG}<span>+${bones.toLocaleString()}</span> bones</p>
      <div class="stack">
        ${run.revived ? '' : '<button type="button" class="btn ad" data-act="revive"><span class="ad-chip">AD</span>Keep playing</button>'}
        ${run.doubled ? '' : `<button type="button" class="btn ad alt" data-act="double"><span class="ad-chip">AD</span>Double to ${(bones * 2).toLocaleString()} bones</button>`}
        <button type="button" class="btn" data-act="again">Collect &amp; play again</button>
        <button type="button" class="btn ghost" data-act="home">Collect &amp; go home</button>
      </div>`, { cls: 'gameover' });
    sheet.onclick = async (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'revive') {
        track('ad_rewarded_request', { placement: 'revive' });
        if (await ads.rewarded()) {
          state.ads.rewardedToday++;
          run.revived = true; run.over = false; run.stuckWithPower = false;
          Core.revive(run.game);
          closeModal();
          renderBoard(); renderTray(); renderScore();
          floatText('Second wind!', 'praise');
          track('ad_rewarded_granted', { placement: 'revive' });
        }
      } else if (a === 'double') {
        track('ad_rewarded_request', { placement: 'double' });
        if (await ads.rewarded()) {
          state.ads.rewardedToday++;
          run.doubled = true;
          sfx.coin();
          track('ad_rewarded_granted', { placement: 'double' });
          showGameOver();
        }
      } else {
        await finishRun(a);
      }
    };
  }

  async function finishRun(next) {
    const g = run.game;
    const bones = runBones();
    state.bones += bones;
    state.best = Math.max(state.best, g.score);
    state.stats.games++;
    state.stats.lines += g.linesCleared;
    state.ads.gamesSinceInterstitial++;
    track('run_end', { score: g.score, bones, revived: run.revived, doubled: run.doubled });
    run = null;
    closeModal();
    save();
    if (Ads.canShowInterstitial(state, Date.now())) {
      Ads.noteInterstitialShown(state, Date.now());
      save();
      track('ad_interstitial', {});
      await ads.interstitial();
    }
    if (next === 'again') startRun(); else show('home');
  }

  $('#btn-quit').addEventListener('click', () => {
    if (!run) { show('home'); return; }
    if (giveUpIfStuck()) return;
    const sheet = openModal(`
      <p class="eyebrow">Leave this run?</p>
      <p class="go-sub">You keep the ${runBones().toLocaleString()} bones earned so far.</p>
      <div class="stack">
        <button type="button" class="btn" data-act="stay">Keep playing</button>
        <button type="button" class="btn ghost" data-act="leave">Leave run</button>
      </div>`);
    sheet.onclick = (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'stay') closeModal(); else finishRun('home');
    };
  });

  // ---------------------------------------------------------------- gacha
  function renderGacha() {
    renderBones();
    const left = state.daily.freePullsLeft;
    const free = $('#btn-pull-free');
    free.disabled = left <= 0;
    free.querySelector('.label').textContent = left > 0 ? `Free pull · ${left} left today` : 'Free pulls are back tomorrow';
    $('#btn-pull-1').disabled = state.bones < Gacha.COST_1;
    $('#btn-pull-10').disabled = state.bones < Gacha.COST_10;
    $('#pity').textContent = `Epic or better guaranteed within ${Gacha.PITY_EPIC - state.pity.sinceEpic} pulls`;
  }

  async function doPull(count, source) {
    if (source === 'bones') {
      const cost = count === 10 ? Gacha.COST_10 : Gacha.COST_1;
      if (state.bones < cost) { toast('Not enough bones. Play a round to earn more.'); return; }
      state.bones -= cost;
    } else {
      if (state.daily.freePullsLeft <= 0) return;
      track('ad_rewarded_request', { placement: 'free_pull' });
      if (!(await ads.rewarded())) return;
      track('ad_rewarded_granted', { placement: 'free_pull' });
      state.daily.freePullsLeft--;
      state.ads.rewardedToday++;
    }
    const results = Gacha.pullMany(state, rng, count);
    save();
    track('gacha_pull', { count, source, best: results.reduce((b, r) => Math.max(b, Gacha.rarityRank(r.rarity)), 0) });
    renderGacha();
    reveal(results);
  }

  $('#btn-pull-1').addEventListener('click', () => { Audio.unlock(); doPull(1, 'bones'); });
  $('#btn-pull-10').addEventListener('click', () => { Audio.unlock(); doPull(10, 'bones'); });
  $('#btn-pull-free').addEventListener('click', () => { Audio.unlock(); doPull(1, 'ad'); });

  function resultCard(r, big) {
    const note = r.isNew ? '<span class="tag new">New!</span>'
      : r.leveledUp ? `<span class="tag up">Lv ${r.level}!</span>`
        : `<span class="tag dupe">+${r.refund} bones</span>`;
    return `<div class="card r-${r.rarity}${big ? ' big' : ''}">
      <div class="card-art">${Pups.renderPup(r.pup)}</div>
      <p class="card-name">${r.pup.name}</p>
      <p class="card-meta">${stars(r.rarity)}</p>${note}</div>`;
  }

  function reveal(results) {
    const best = results.reduce((b, r) => (Gacha.rarityRank(r.rarity) > Gacha.rarityRank(b.rarity) ? r : b), results[0]);
    const sheet = openModal(`
      <div class="capsule-stage">
        <div class="capsule r-${best.rarity}"><div class="cap-top"></div><div class="cap-bottom"></div></div>
        <p class="tap-hint">Tap to open</p>
      </div>`, { cls: 'reveal' });
    sfx.rattle(); haptic('MEDIUM');
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      const rank = Gacha.rarityRank(best.rarity);
      sfx.reveal(rank); haptic(rank >= 2 ? 'HEAVY' : 'MEDIUM');
      if (results.length === 1) {
        const r = results[0];
        const canBuddy = state.buddy !== r.pup.id;
        sheet.innerHTML = `
          <div class="burst r-${r.rarity}"></div>
          ${resultCard(r, true)}
          <p class="reveal-line">${r.pup.breed} · ${Pups.RARITY[r.rarity].label}<br><span>${Pups.POWERS[r.pup.power].name}: ${Pups.POWERS[r.pup.power].desc}</span></p>
          <div class="stack">
            ${canBuddy ? '<button type="button" class="btn" data-act="buddy">Make buddy</button>' : ''}
            <button type="button" class="btn ${canBuddy ? 'ghost' : ''}" data-act="done">Nice!</button>
          </div>`;
        sheet.onclick = (e) => {
          const act = e.target.closest('[data-act]');
          if (!act) return;
          if (act.dataset.act === 'buddy') { state.buddy = r.pup.id; save(); toast(`${r.pup.name} is your buddy now`); }
          closeModal(); renderGacha();
        };
      } else {
        sheet.innerHTML = `
          <div class="burst r-${best.rarity}"></div>
          <div class="multi">${results.map((r, k) => `<div style="animation-delay:${k * 70}ms">${resultCard(r)}</div>`).join('')}</div>
          <div class="stack"><button type="button" class="btn" data-act="done">Done</button></div>`;
        sheet.onclick = (e) => { if (e.target.closest('[data-act]')) { closeModal(); renderGacha(); } };
      }
    };
    sheet.querySelector('.capsule-stage').addEventListener('click', open);
    setTimeout(open, 1600);
  }

  // ---------------------------------------------------------------- kennel
  function renderKennel() {
    renderBones();
    const owned = Object.keys(state.pups).length;
    $('#kennel-progress').textContent = `${owned} of ${Pups.ROSTER.length} pups found`;
    $('#kennel-grid').innerHTML = Pups.ROSTER.map((p) => {
      const o = state.pups[p.id];
      if (!o) {
        return `<button type="button" class="card locked r-${p.rarity}" data-id="${p.id}">
          <div class="card-art">${Pups.renderPup(p, { silhouette: true })}</div>
          <p class="card-name">???</p><p class="card-meta">${stars(p.rarity)}</p></button>`;
      }
      return `<button type="button" class="card r-${p.rarity}${state.buddy === p.id ? ' is-buddy' : ''}" data-id="${p.id}">
        <div class="card-art">${Pups.renderPup(p)}</div>
        <p class="card-name">${p.name}</p><p class="card-meta">${stars(p.rarity)} <span>Lv ${o.level}</span></p></button>`;
    }).join('');
  }

  $('#kennel-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const pup = Pups.BY_ID[card.dataset.id];
    const o = state.pups[pup.id];
    if (!o) {
      openModal(`<p class="eyebrow">${Pups.RARITY[pup.rarity].label} pup</p>
        <div class="detail-art locked">${Pups.renderPup(pup, { silhouette: true })}</div>
        <p class="go-sub">Not found yet. Pull at the Pup-a-Matic to meet this one.</p>
        <div class="stack"><button type="button" class="btn" data-act="gacha">Go to Pup-a-Matic</button><button type="button" class="btn ghost" data-act="close">Close</button></div>`)
        .onclick = (ev) => {
          const a = ev.target.closest('[data-act]');
          if (!a) return;
          closeModal();
          if (a.dataset.act === 'gacha') show('gacha');
        };
      return;
    }
    const isBuddy = state.buddy === pup.id;
    const need = o.level >= Pups.MAX_LEVEL ? 'Max level' : `${o.dupes}/${o.level} copies to Lv ${o.level + 1}`;
    openModal(`<p class="eyebrow">${pup.breed}</p>
      <div class="detail-art r-${pup.rarity}">${Pups.renderPup(pup)}</div>
      <p class="detail-name">${pup.name} ${stars(pup.rarity)}</p>
      <dl class="detail-stats">
        <div><dt>Level</dt><dd>${o.level} <small>${need}</small></dd></div>
        <div><dt>Bone bonus</dt><dd>+${Math.round(Pups.bonusFor(pup, o.level) * 100)}%</dd></div>
        <div><dt>${Pups.POWERS[pup.power].name}</dt><dd><small>${Pups.POWERS[pup.power].desc} · ${Pups.chargesFor(pup, o.level)}× per run</small></dd></div>
      </dl>
      <div class="stack">
        ${isBuddy ? '<p class="go-sub">Your current buddy</p>' : '<button type="button" class="btn" data-act="buddy">Make buddy</button>'}
        <button type="button" class="btn ghost" data-act="close">Close</button>
      </div>`).onclick = (ev) => {
      const a = ev.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'buddy') { state.buddy = pup.id; save(); sfx.woof(); renderKennel(); }
      closeModal();
    };
  });

  // ---------------------------------------------------------------- settings
  function openSettings() {
    const s = state.settings;
    const sheet = openModal(`<p class="eyebrow">Settings</p>
      <div class="settings">
        <label class="switch"><span>Sound</span><input id="set-sound" type="checkbox" ${s.sound ? 'checked' : ''}></label>
        <label class="switch"><span>Vibration</span><input id="set-haptics" type="checkbox" ${s.haptics ? 'checked' : ''}></label>
      </div>
      <div class="stack">
        <button type="button" class="btn alt" data-act="noads">${s.noAds ? 'Ads removed' : 'Remove ads · $2.99'}</button>
        <button type="button" class="btn ghost" data-act="reset">Reset progress</button>
        <button type="button" class="btn ghost" data-act="close">Done</button>
      </div>
      <p class="fine">Pup-a-Matic odds: Common 62%, Rare 27%, Epic 9%, Legendary 2%. Epic or better every ${Gacha.PITY_EPIC} pulls; Legendary every ${Gacha.PITY_LEGENDARY}.</p>`);
    sheet.querySelector('#set-sound').onchange = (e) => { s.sound = e.target.checked; Audio.setSound(s.sound); save(); };
    sheet.querySelector('#set-haptics').onchange = (e) => { s.haptics = e.target.checked; Audio.setHaptics(s.haptics); save(); };
    sheet.onclick = (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'close') closeModal();
      if (act === 'noads') toast('The purchase connects through StoreKit in the iOS build.');
      if (act === 'reset') {
        if (a.dataset.armed) {
          state = State.freshState(); State.rollDaily(state, Date.now()); save(); closeModal(); show('home'); toast('Progress reset');
        } else { a.dataset.armed = '1'; a.textContent = 'Tap again to erase everything'; a.classList.add('danger'); }
      }
    };
  }

  // ---------------------------------------------------------------- boot
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal-sheet').classList.contains('gameover') && !$('#modal-sheet').classList.contains('reveal')) closeModal(); });
  show('home');
  if (loginBonus) setTimeout(() => toast(`Daily treat: +${loginBonus} bones${state.daily.streak > 1 ? ` · ${state.daily.streak}-day streak` : ''}`), 500);
})();
