// UI for Pup Blast: screens, drag-and-drop, the gacha reveal and the ad touchpoints.
(function () {
  'use strict';

  const { Core, Pups, Powers, Gacha, State, Ads, Audio, PullFX, Levels, Store, Leaderboards } = window.PB;
  const ECON = Gacha.ECONOMY;
  const { sfx, haptic } = Audio;
  const $ = (sel) => document.querySelector(sel);

  const BONE_SVG = '<svg class="bone" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.5a2.6 2.6 0 0 0-2.4 3.6A2.6 2.6 0 1 0 8 12.3l3.7 3.7a2.6 2.6 0 1 0 4.2 2.9 2.6 2.6 0 1 0 3-4.2l-3.7-3.7a2.6 2.6 0 1 0-4.3-2.9 2.6 2.6 0 0 0-3.4-3.6z" fill="currentColor"/></svg>';

  function safeStorage() {
    try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; }
  }
  const storage = safeStorage();
  const firstBoot = !storage || !storage.getItem(State.KEY);
  let state = State.load(storage);
  const loginBonus = State.rollDaily(state, Date.now());
  const newWeek = State.rollWeekly(state, Date.now());
  const save = () => State.save(storage, state);
  save();
  window.PB.artStyle = state.settings.artStyle || 'bean';
  Audio.setSound(state.settings.sound);
  Audio.setHaptics(state.settings.haptics);

  // Dev mode is a tester tool. Set ALLOW_DEV to false for App Store builds.
  const ALLOW_DEV = true;
  const dev = () => ALLOW_DEV && state.settings.dev;
  // Tester builds start with dev mode on, so a wiped save (new device, cleared browser data) never hides the tools.
  if (ALLOW_DEV && firstBoot) { state.settings.dev = true; save(); }

  const adProvider = Ads.createProvider(document);
  adProvider.init().catch(() => {});
  const ads = {
    interstitial: () => (dev() && state.settings.devSkipAds ? Promise.resolve(true) : adProvider.interstitial()),
    rewarded: () => (dev() && state.settings.devSkipAds ? Promise.resolve(true) : adProvider.rewarded()),
  };
  // Remove Ads purchase. StoreKit is the source of truth in the app; the saved flag covers offline starts.
  const store = Store.createStore(document);
  store.init().then((owned) => {
    if (owned.removeAds !== null && owned.removeAds !== state.settings.noAds) { state.settings.noAds = owned.removeAds; save(); }
  });

  // Leaderboards: Game Center in the app, a local list in the browser.
  const boards = Leaderboards.createLeaderboards(() => state, (rows) => {
    openModal(`<p class="eyebrow">Leaderboards</p>
      <ul class="board-list">${rows.map((r) => `<li><span>${r.name}</span><b>${r.score.toLocaleString()}</b></li>`).join('')}</ul>
      <p class="fine">Your best scores. The iOS build ranks them against everyone through Game Center.</p>
      <div class="stack"><button type="button" class="btn ghost" data-act="close">Close</button></div>`)
      .onclick = (e) => { if (e.target.closest('[data-act]')) closeModal(); };
  });
  // Sign in, then send what the save already holds (scores from before Game Center, or another device).
  boards.init().then((ok) => {
    if (!ok) return;
    if (state.best > 0) boards.submit('endless', state.best);
    if (totalStars() > 0) boards.submit('stars', totalStars());
  });
  const totalStars = () => Object.values(state.levels).reduce((a, r) => a + (r.stars || 0), 0);
  function submitScores(lvl, score) {
    if (lvl) boards.submit('stars', totalStars());
    else { boards.submit('endless', score); boards.submit('weekly', score); }
  }

  const rng = Core.mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);

  // Lightweight analytics hook. Wire to Firebase/GameAnalytics in the native build.
  function track(event, params) { if (window.PB_TRACK) window.PB_TRACK(event, params || {}); }

  // ---------------------------------------------------------------- screens
  const screens = ['home', 'game', 'gacha', 'kennel', 'map'];
  function show(name) {
    screens.forEach((s) => { $('#screen-' + s).hidden = s !== name; });
    if (name === 'home') renderHome();
    if (name === 'gacha') renderGacha();
    if (name === 'kennel') renderKennel();
    if (name === 'map') renderMap();
    tutorialOnShow(name);
  }

  // Two pull styles: dig in the backyard (default) or the gumball machine. Dev mode switches them.
  const digMode = () => (state.settings.pullStyle || 'dig') === 'dig';
  const gachaName = () => (digMode() ? 'Dig Spot' : 'Pup-a-Matic');
  const verb = () => (digMode() ? 'Dig' : 'Pull');
  let machineHtml = null;
  function renderGachaTheme() {
    document.querySelectorAll('[data-gacha-name]').forEach((el) => { el.textContent = gachaName(); });
    document.querySelectorAll('[data-verb]').forEach((el) => { el.textContent = verb(); });
    const machine = $('.machine');
    if (machineHtml === null) machineHtml = machine.innerHTML;
    machine.innerHTML = digMode() ? PullFX.yardSvg(null) : machineHtml;
    machine.classList.toggle('backyard', digMode());
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

  function powerOf(pup) { return Powers.POWERS[pup.power]; }
  function perkText(pup, level) {
    const n = Pups.chargesFor(pup, level);
    return `${powerOf(pup).name} ×${n} · ${powerOf(pup).desc}`;
  }
  // Bond: per-pup, grows with play and bone feeding, +3% score per level above 1.
  const bondOf = (id) => Pups.bondLevel((state.pups[id] || {}).bond);
  const pct = (b) => `+${Math.round(b * 100)}%`;
  function bondText(id) {
    const b = bondOf(id);
    return b > 1 ? `Bond ${b} · ${pct(Pups.bondBonus(b))} score` : 'Bond 1';
  }
  function chargeWord(n, pup) { return pup.power === 'guardian' ? (n === 1 ? 'save' : 'saves') : (n === 1 ? 'charge' : 'charges'); }
  function pips(level) {
    let out = '';
    for (let k = 1; k <= Pups.MAX_LEVEL; k++) out += `<i class="${k <= level ? 'on' : ''}"></i>`;
    return `<span class="pips" aria-label="Level ${level} of ${Pups.MAX_LEVEL}">${out}</span>`;
  }
  function fmtWait(ms) {
    const h = Math.ceil(ms / 3600000);
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    renderBones();
    const pup = Pups.BY_ID[state.buddy];
    const lvl = state.pups[pup.id].level;
    $('#home-buddy').innerHTML = Pups.renderPup(pup);
    $('#home-buddy').className = 'buddy-stage r-' + pup.rarity;
    $('#home-buddy-caption').innerHTML = `<b>${pup.name}</b> · Lv ${lvl} ${stars(pup.rarity)}<br><span>${perkText(pup, lvl)}</span><br><span class="bond-line">♥ ${bondText(pup.id)}</span>`;
    $('#home-best').textContent = state.best.toLocaleString();
    const nextLvl = nextLevel();
    $('#play-sub').textContent = nextLvl ? `${Levels.WORLDS.find((w) => w.id === nextLvl.world).name} ${nextLvl.n} · ${nextLvl.name}` : 'All levels cleared';
    const owned = Object.keys(state.pups).length;
    $('#kennel-count').textContent = `${owned}/${Pups.ROSTER.length}`;
    const badge = $('#gacha-badge');
    if (state.tokens.dig + state.tokens.epic > 0) { badge.hidden = false; badge.textContent = `Free ${verb().toLowerCase()}`; }
    else if (state.weekly.pullsLeft > 0) { badge.hidden = false; badge.textContent = `Weekly ${verb().toLowerCase()}!`; }
    else if (state.daily.freePullsLeft > 0) { badge.hidden = false; badge.textContent = `Free ${verb().toLowerCase()}`; }
    else if (ECON.BONE_PULLS && state.bones >= Gacha.COST_1) { badge.hidden = false; badge.textContent = `${verb()}!`; }
    else badge.hidden = true;
  }

  $('#home-buddy').addEventListener('click', () => {
    Audio.unlock(); sfx.woof(); haptic('LIGHT');
    const el = $('#home-buddy');
    el.classList.remove('boop'); void el.offsetWidth; el.classList.add('boop');
  });
  $('#btn-play').addEventListener('click', () => { Audio.unlock(); const n = nextLevel(); if (n) mapWorld = n.world; show('map'); });
  $('#btn-endless').addEventListener('click', () => { Audio.unlock(); startRun(); });
  $('#btn-gacha').addEventListener('click', () => { Audio.unlock(); show('gacha'); });
  $('#btn-kennel').addEventListener('click', () => { Audio.unlock(); show('kennel'); });
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-boards').addEventListener('click', () => { track('leaderboard_open', {}); boards.show(); });
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

  // opts.level: play a map level; opts.pup: force a buddy (tutorial). No level = Endless.
  function startRun(opts) {
    const o = opts || {};
    const pup = o.pup || Pups.BY_ID[state.buddy];
    const level = o.pup ? 1 : state.pups[pup.id].level;
    const lvl = o.level || null;
    let gameOpts;
    if (lvl) {
      // A level's crate only appears until its pup has been freed once.
      const crate = lvl.gift && !state.gifts[lvl.id];
      gameOpts = { start: crate ? lvl.start : lvl.start.map((row) => row.replace(/C/g, '.')), helpers: lvl.helpers, squirrels: lvl.squirrels, blower: lvl.blower };
    }
    const bond = o.pup ? 1 : bondOf(pup.id);
    gameOpts = Object.assign({}, gameOpts, { scoreBonus: Pups.bondBonus(bond) });
    run = {
      game: Core.createGame((rng() * 4294967296) >>> 0, gameOpts),
      pup, level, lvl, bond,
      charges: Pups.chargesFor(pup, level),
      revived: false, doubled: false, over: false, targeting: false, aim: null,
      starsShown: 0, giftResult: null,
    };
    if (lvl) mapWorld = lvl.world;
    show('game');
    $('#level-bar').hidden = !lvl;
    $('#best-line').hidden = !!lvl;
    $('#squirrel').hidden = !(lvl && lvl.tease === 'squirrel');
    renderBoard(); renderTray(); renderBuddyBar(); renderScore();
    track('run_start', { buddy: pup.id, level: lvl ? lvl.id : 'endless' });
  }

  const GOLD_SVG = '<svg class="bone golden-bone" viewBox="0 0 24 24" aria-label="Golden bone"><path d="M7.5 4.5a2.6 2.6 0 0 0-2.4 3.6A2.6 2.6 0 1 0 8 12.3l3.7 3.7a2.6 2.6 0 1 0 4.2 2.9 2.6 2.6 0 1 0 3-4.2l-3.7-3.7a2.6 2.6 0 1 0-4.3-2.9 2.6 2.6 0 0 0-3.4-3.6z" fill="#ffd04a" stroke="#a87400" stroke-width="1.2"/></svg>';
  const BALL_SVG = '<svg class="ball" viewBox="0 0 24 24" aria-label="Tennis ball"><circle cx="12" cy="12" r="9" fill="#d7f25a" stroke="#7e9a12" stroke-width="1.2"/><path d="M4.5 7.5c4 1.5 4 7.5 0 9M19.5 7.5c-4 1.5-4 7.5 0 9" stroke="#fff" stroke-width="1.6" fill="none"/></svg>';
  function cellArt(g, i) {
    const sp = g.specials[i];
    if (sp === Core.SPECIAL.GOLDEN) return GOLD_SVG;
    if (sp === Core.SPECIAL.BALL) return BALL_SVG;
    return g.treats[i] ? BONE_SVG : '';
  }
  function pieceArt(piece, k) {
    if (piece.special && piece.special.k === k) return piece.special.type === Core.SPECIAL.GOLDEN ? GOLD_SVG : BALL_SVG;
    return k === piece.treat ? BONE_SVG : '';
  }

  const CELL_KIND = {
    [Core.PUDDLE_COLOR]: 'puddle', [Core.SQUIRREL_COLOR]: 'squirrel',
    [Core.ICE_COLOR]: 'b ice', [Core.MUD_COLOR]: 'b mud', [Core.ACORN_COLOR]: 'b acorn',
  };
  const SQUIRREL_SVG = '<svg class="critter" viewBox="0 0 32 32" aria-label="Squirrel"><path d="M21 27c6 0 9-5 8-11-1-5-6-7-8-4 3 0 5 3 4 6-1 4-4 5-6 5z" fill="#c9773a" stroke="#5a3214" stroke-width="1.2"/><ellipse cx="14" cy="21" rx="7" ry="6.5" fill="#d88a47" stroke="#5a3214" stroke-width="1.2"/><circle cx="11" cy="12" r="5.5" fill="#d88a47" stroke="#5a3214" stroke-width="1.2"/><path d="M8 7.5l1-3 2.5 3M12.5 7l2-2.5 1 3.5" fill="#d88a47" stroke="#5a3214" stroke-width="1.1" stroke-linejoin="round"/><circle cx="9.5" cy="11.5" r="1.1" fill="#2a1630"/><circle cx="6.2" cy="13.2" r=".9" fill="#2a1630"/><ellipse cx="13" cy="23" rx="3.4" ry="2.8" fill="#f1c99b"/><ellipse cx="12" cy="18.5" rx="2.2" ry="1.6" fill="#9a5a2a"/></svg>';
  const ACORN_SVG = '<svg class="critter" viewBox="0 0 24 24" aria-label="Acorn"><path d="M6 11c0 6 3 10 6 10s6-4 6-10z" fill="#c98a4a" stroke="#5a3214" stroke-width="1.2"/><path d="M4.5 11c0-3.5 3-5.5 7.5-5.5s7.5 2 7.5 5.5z" fill="#7a4a24" stroke="#3b2414" stroke-width="1.2"/><path d="M12 5.5V3" stroke="#3b2414" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const PUDDLE_SVG = '<svg class="ripple" viewBox="0 0 24 24" aria-label="Puddle"><path d="M5 10c2-1.5 4 1.5 6 0s4-1.5 6 0M7 15c2-1.5 4 1.5 6 0s3-1 4 0" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const BURIED_SVG = '<svg class="buried-bone" viewBox="0 0 24 24" aria-label="Buried bone"><path d="M7.5 4.5a2.6 2.6 0 0 0-2.4 3.6A2.6 2.6 0 1 0 8 12.3l3.7 3.7a2.6 2.6 0 1 0 4.2 2.9 2.6 2.6 0 1 0 3-4.2l-3.7-3.7a2.6 2.6 0 1 0-4.3-2.9 2.6 2.6 0 0 0-3.4-3.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 1.6"/></svg>';
  const CELL_ART = { [Core.SQUIRREL_COLOR]: SQUIRREL_SVG, [Core.ACORN_COLOR]: ACORN_SVG, [Core.PUDDLE_COLOR]: PUDDLE_SVG };
  const POST_SVG = '<svg class="post" viewBox="0 0 24 24" aria-label="Fence post"><rect x="6" y="3" width="12" height="19" rx="3" fill="#b07a45" stroke="#5e3b1c" stroke-width="1.4"/><path d="M6 8h12M6 15h12" stroke="#5e3b1c" stroke-width="1.2" opacity=".55"/><circle cx="12" cy="5.6" r="1.1" fill="#5e3b1c"/></svg>';
  function renderBoard() {
    const g = run.game;
    $('#board').dataset.world = run.lvl ? run.lvl.world : '';
    for (let i = 0; i < cellEls.length; i++) {
      const v = g.board[i];
      if (v === Core.POST_COLOR) { cellEls[i].className = 'cell post'; cellEls[i].innerHTML = POST_SVG; continue; }
      if (v === Core.HOLE_COLOR) { cellEls[i].className = 'cell hole'; cellEls[i].innerHTML = ''; continue; }
      const kind = CELL_KIND[v];
      let cls = kind ? `cell ${kind}` : v === Core.CRATE_COLOR ? 'cell b crate' : v ? `cell b c${v}` : 'cell';
      let art = kind ? (CELL_ART[v] || '') : v && v !== Core.CRATE_COLOR ? cellArt(g, i) : '';
      if (v === Core.MUD_COLOR && g.armor[i] === 1) cls += ' cracked';
      if (g.buried[i]) { cls += v ? ' buried-under' : ' buried'; art += BURIED_SVG; }
      cellEls[i].className = cls;
      cellEls[i].innerHTML = art;
    }
    // Warnings one move ahead: where a squirrel will hop, which row the Leaf Blower will push.
    for (const q of g.squirrels) if (q.at >= 0 && q.target >= 0) { cellEls[q.target].classList.add('sq-target'); cellEls[q.at].classList.add('sq-ready'); }
    const bl = g.blower;
    if (bl && bl.row >= 0) for (let c = 0; c < Core.SIZE; c++) cellEls[bl.row * Core.SIZE + c].classList.add('gust', bl.dir > 0 ? 'gust-r' : 'gust-l');
    $('#blower').hidden = !bl;
    if (bl) { $('#blower').classList.toggle('blowing', bl.row >= 0); $('#blower').style.setProperty('--row', bl.row >= 0 ? bl.row : 3); $('#blower').classList.toggle('from-right', bl.dir < 0); }
    renderCrate();
  }

  // The crate is drawn as one overlay across its 2x2 cells, with the gift pup peeking out.
  function renderCrate() {
    const el = $('#crate');
    const cr = run.game.crate;
    if (!cr || cr.freed || !run.lvl || !run.lvl.gift) { el.hidden = true; return; }
    const wrap = $('.board-wrap').getBoundingClientRect();
    const a = cellEls[cr.cells[0]].getBoundingClientRect(), b = cellEls[cr.cells.at(-1)].getBoundingClientRect();
    Object.assign(el.style, { left: a.left - wrap.left + 'px', top: a.top - wrap.top + 'px', width: b.right - a.left + 'px', height: b.bottom - a.top + 'px' });
    const pup = Pups.BY_ID[run.lvl.gift];
    el.innerHTML = `<div class="crate-pup">${Pups.renderPup(pup, { style: 'sticker', plain: true })}</div>
      <svg class="crate-bars" viewBox="0 0 100 100" aria-label="${pup.name} is stuck in a crate"><rect x="4" y="4" width="92" height="92" rx="10" fill="none" stroke="#8a5528" stroke-width="7"/><path d="M30 6V94M50 6V94M70 6V94" stroke="#8a5528" stroke-width="6"/>${cr.hp < Core.CRATE_HP ? '<path d="M18 20 L34 38 L26 52 L42 70" stroke="#3b2414" stroke-width="3" fill="none"/>' : ''}</svg>`;
    el.hidden = false;
  }

  function renderScore() {
    if (run.lvl) {
      const [t1, t2, t3] = Levels.starsFor(run.lvl);
      const sc = run.game.score;
      $('#lb-name').textContent = `Level ${run.lvl.n} · ${run.lvl.name}`;
      $('#lb-fill').style.width = Math.min(100, (sc / t3) * 100) + '%';
      [[t1, '#lb-s1'], [t2, '#lb-s2'], [t3, '#lb-s3']].forEach(([t, sel]) => {
        const el = $(sel);
        el.style.left = (t / t3) * 100 + '%';
        el.classList.toggle('on', sc >= t);
      });
    }
    $('#score').textContent = run.game.score.toLocaleString();
    $('#game-best').textContent = Math.max(state.best, run.game.score).toLocaleString();
    $('#run-bones').textContent = Core.bonesForRun(run.game).toLocaleString();
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
      b.innerHTML = pieceArt(piece, k);
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
    const power = powerOf(pup);
    $('#game-buddy').innerHTML = Pups.renderPup(pup);
    $('#game-buddy-name').textContent = `${pup.name} · Lv ${level}${run.bond > 1 ? ` · ♥${run.bond} ${pct(Pups.bondBonus(run.bond))}` : ''}`;
    $('#game-buddy-perk').textContent = run.targeting ? targetHint() : power.desc;
    const btn = $('#btn-power');
    if (power.passive) {
      btn.textContent = charges > 0 ? `${power.name} ×${charges}` : `${power.name} used`;
      btn.disabled = true;
    } else {
      btn.textContent = run.targeting ? 'Cancel' : `${power.name} ×${charges}`;
      btn.disabled = charges <= 0 || (!run.targeting && !Powers.canUse(pup.power, run.game));
    }
    btn.classList.toggle('armed', run.targeting);
    boardEl.classList.toggle('dig-mode', run.targeting);
  }

  function targetHint() {
    const t = powerOf(run.pup).target;
    const what = t === 'row' ? 'a row' : t === 'col' ? 'a column' : t === 'block' ? 'a block' : 'a spot';
    return run.aim ? 'Tap again to confirm' : `Tap ${what} on the board`;
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
    if (run.tutLock) { sfx.nope(); coachBump(); return; }
    const piece = run.game.tray[i];
    if (!piece) return;
    if (run.targeting) cancelTargeting();
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
    const want = run.tutTarget;
    if (want && (!target || i !== want.i || target.r !== want.r || target.c !== want.c)) { sfx.nope(); coachBump(); return; }
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
    if (res.lines > 0) { popCells(res.cleared.filter((x) => x.special !== Core.SPECIAL.CRATE)); celebrate(res); }
    if (res.golden) setTimeout(() => floatText('Golden bone ×2!', 'combo'), 260);
    if (res.ballRows && res.ballRows.length) floatText('Fetch!', 'praise');
    if (res.crateHit && !res.crateFreed) { const c = $('#crate'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); sfx.thunk(); haptic('MEDIUM'); floatText('One more!', 'combo'); }
    if (res.crateFreed) freeGift();
    hazardFx(res);
    renderTray(); renderScore(); renderBuddyBar();
    checkStars();
    if (run.tut) { tutorialAfterPlace(res); return; }
    if (res.gameOver) handleStuck();
  }

  // ---- World 3+: bones dug up, squirrels, the Leaf Blower
  function hazardFx(res) {
    const h = res.hazard || {};
    const dug = [...(res.dug || []), ...((h.settle && h.settle.dug) || [])];
    const chased = [...(res.chased || []), ...((h.settle && h.settle.chased) || [])];
    dug.forEach((i, k) => setTimeout(() => { floatText(`Bone! +${Core.DUG_POINTS}`, 'treat', i); sfx.coin(); }, 200 + k * 120));
    chased.forEach((i) => { floatText(`Shoo! +${Core.CHASE_POINTS}`, 'praise', i); sfx.woof(); haptic('MEDIUM'); });
    (res.hits || []).forEach((i) => { cellEls[i].classList.add('chip'); setTimeout(() => cellEls[i] && cellEls[i].classList.remove('chip'), 400); });
    if (h.hopped && h.hopped.length) { h.hopped.forEach((x) => cellEls[x.to].classList.add('hop')); sfx.thunk(); }
    if (h.back && h.back.length) floatText('The squirrel is back!', 'combo');
    if (h.gust) floatText('Gust incoming!', 'combo');
    if (h.blown) {
      sfx.thunk(); haptic('MEDIUM');
      const board = $('#board'); board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake');
      if (h.settle && h.settle.lines) { popCells(h.settle.cleared); floatText('Lucky gust!', 'praise'); }
    }
  }

  // ---- levels: star progress and the crated gift pup
  function checkStars() {
    if (!run || !run.lvl) return;
    const n = Levels.starsForScore(run.lvl, run.game.score);
    while (run.starsShown < n) {
      run.starsShown++;
      const k = run.starsShown;
      setTimeout(() => { floatText(k === 1 ? 'Level clear! Keep going' : `${'★'.repeat(k)}!`, 'combo'); sfx.ding(k + 2); haptic('MEDIUM'); }, 400 + k * 150);
    }
  }

  function freeGift() {
    const pup = Pups.BY_ID[run.lvl.gift];
    state.gifts[run.lvl.id] = true; // counts the moment the crate breaks, even if the run is lost
    run.giftResult = Gacha.grant(state, pup);
    save();
    const wrap = $('.board-wrap');
    PullFX.burst(wrap, Pups.RARITY[pup.rarity].color, 26, 150);
    $('#crate').hidden = true;
    sfx.woof(); haptic('HEAVY');
    floatText(`${pup.name} is free!`, 'praise');
    track('gift_freed', { level: run.lvl.id, pup: pup.id });
  }

  // ---- buddy powers
  function clearAim() {
    if (run && run.aim) for (const i of run.aim.cells) cellEls[i].classList.remove('aim');
    if (run) run.aim = null;
  }
  function cancelTargeting() { clearAim(); run.targeting = false; renderBuddyBar(); }

  function firePower(r, c) {
    const id = run.pup.power;
    const res = Powers.use(id, run.game, r, c);
    sfx.woof(); haptic('HEAVY');
    floatText(`${powerOf(run.pup).name}!`, 'praise');
    if (id === 'doover') renderBoard();
    else if (res.cleared && res.cleared.length) {
      renderBoard();
      popCells(res.cleared);
      res.cleared.filter((x) => x.treat).forEach((x) => floatText(`+${Core.BONES_PER_TREAT}`, 'treat', x.i));
      if (res.lines) setTimeout(() => sfx.clear(res.lines, 0), 120);
    } else renderBoard();
    if (res.treated) res.treated.forEach((i) => { cellEls[i].classList.add('sparkle'); });
    usedPower();
  }

  $('#btn-power').addEventListener('click', () => {
    if (!run || run.charges <= 0) return;
    if (run.tut && state.tutorial.step !== TUT.POWER) { coachBump(); return; }
    Audio.unlock();
    if (run.targeting) { cancelTargeting(); return; }
    const id = run.pup.power;
    if (!Powers.canUse(id, run.game)) return;
    if (Powers.POWERS[id].target) { run.targeting = true; renderBuddyBar(); return; }
    firePower();
  });

  // Targeted powers: the first tap previews what will clear, a second tap on the same target fires.
  boardEl.addEventListener('click', (e) => {
    if (!run || !run.targeting) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const i = Number(cell.dataset.i);
    const r = Math.floor(i / Core.SIZE), c = i % Core.SIZE;
    const id = run.pup.power;
    const t = Powers.POWERS[id].target;
    if (!Powers.validTarget(id, run.game, r, c)) { sfx.nope(); toast('Tap a colored block'); return; }
    const key = t === 'row' ? `r${r}` : t === 'col' ? `c${c}` : `${r},${c}`;
    if (run.aim && run.aim.key === key) {
      clearAim();
      run.targeting = false;
      firePower(r, c);
      return;
    }
    clearAim();
    const cells = Powers.previewCells(id, run.game, r, c);
    cells.forEach((k) => cellEls[k].classList.add('aim'));
    run.aim = { key, cells };
    sfx.pick();
    renderBuddyBar();
  });

  function usedPower() {
    if (!(dev() && state.settings.devInfinite)) run.charges--;
    run.over = false;
    run.stuckWithPower = false;
    $('#btn-power').classList.remove('nudge');
    renderTray(); renderScore(); renderBuddyBar();
    checkStars();
    track('power_used', { power: run.pup.power, level: run.level });
    if (run.tut) { tutorialAfterPower(); return; }
    if (Core.isGameOver(run.game)) handleStuck();
  }

  function handleStuck() {
    run.over = true;
    if (powerOf(run.pup).passive && run.charges > 0) {
      if (!(dev() && state.settings.devInfinite)) run.charges--;
      setTimeout(() => {
        Powers.use(run.pup.power, run.game);
        run.over = false;
        sfx.woof(); haptic('HEAVY');
        floatText(`${run.pup.name} saved you!`, 'praise');
        renderBoard(); renderTray(); renderBuddyBar();
      }, 500);
      return;
    }
    if (run.charges > 0 && Powers.canUse(run.pup.power, run.game)) {
      // Let the player try their buddy's power before calling the run.
      run.over = false;
      $('#btn-power').classList.add('nudge');
      toast(`No room! Try ${run.pup.name}'s ${powerOf(run.pup).name}`);
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

  function runBones() { return Core.bonesForRun(run.game) * (run.doubled ? 2 : 1); }

  function starRow(n) {
    return `<p class="result-stars" aria-label="${n} of 3 stars">${[1, 2, 3].map((k) => `<span class="${k <= n ? 'on' : ''}">★</span>`).join('')}</p>`;
  }

  function showGameOver() {
    const g = run.game;
    const lvl = run.lvl;
    const isBest = !lvl && g.score > state.best;
    const bones = runBones();
    const got = lvl ? Levels.starsForScore(lvl, g.score) : 0;
    const t = lvl ? Levels.starsFor(lvl) : null;
    const nextMilestone = !lvl && MILESTONES.find(([m]) => !state.endless.milestones.includes(m) && g.score < m);
    const head = lvl
      ? `<p class="eyebrow">Level ${lvl.n} · ${got ? 'Cleared' : 'Out of room'}</p>${starRow(got)}
         <p class="go-score">${g.score.toLocaleString()}</p>
         <p class="go-sub">${got ? (got < 3 ? `${(t[got] - g.score).toLocaleString()} more for ${'★'.repeat(got + 1)}` : 'Perfect run!') : `${(t[0] - g.score).toLocaleString()} short of ${t[0].toLocaleString()}`}</p>`
      : `<p class="eyebrow">${isBest ? 'New best score' : 'Out of room'}</p>
         <p class="go-score">${g.score.toLocaleString()}</p>
         <p class="go-sub">${g.linesCleared} lines · ${g.treatsCollected} treats${nextMilestone ? ` · next milestone ${nextMilestone[0].toLocaleString()} (+${nextMilestone[1]} bones)` : ''}</p>`;
    const sheet = openModal(`
      ${head}
      <p class="go-bones">${BONE_SVG}<span>+${bones.toLocaleString()}</span> bones</p>
      <div class="stack">
        ${run.revived ? '' : '<button type="button" class="btn ad" data-act="revive"><span class="ad-chip">AD</span>Keep playing</button>'}
        ${run.doubled ? '' : `<button type="button" class="btn ad alt" data-act="double"><span class="ad-chip">AD</span>Double to ${(bones * 2).toLocaleString()} bones</button>`}
        ${lvl ? '<button type="button" class="btn" data-act="collect">Collect</button>'
    : `<button type="button" class="btn" data-act="again">Collect &amp; play again</button>
        <button type="button" class="btn ghost" data-act="home">Collect &amp; go home</button>`}
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

  // Endless score milestones pay bones the first time they're reached.
  const MILESTONES = [[1000, 25], [2500, 50], [5000, 100], [10000, 200], [20000, 400], [40000, 800]];
  function payMilestones(score) {
    const paid = [];
    for (const [m, b] of MILESTONES) {
      if (score >= m && !state.endless.milestones.includes(m)) { state.endless.milestones.push(m); state.bones += b; paid.push([m, b]); }
    }
    return paid;
  }

  // Saves a finished level run: best score, stars, first-clear reward, and the 3-star world sweep.
  function recordLevel(lvl, score) {
    const got = Levels.starsForScore(lvl, score);
    const prev = state.levels[lvl.id] || { stars: 0, best: 0 };
    const firstClear = got >= 1 && prev.stars === 0;
    state.levels[lvl.id] = { stars: Math.max(prev.stars, got), best: Math.max(prev.best, score) };
    const rewards = [];
    if (firstClear) {
      if (lvl.reward.type === 'dig') { state.tokens.dig++; rewards.push(`A free ${verb().toLowerCase()} at the ${gachaName()}`); }
      else { state.bones += lvl.reward.amount; rewards.push(`+${lvl.reward.amount} bones for clearing it`); }
    }
    if (firstClear) {
      Levels.WORLDS.filter((w) => w.unlockAfter === lvl.id).forEach((w) => rewards.push(`New world open: the ${w.name}!`));
    }
    const world = Levels.WORLDS.find((w) => w.id === lvl.world);
    let sweep = false;
    if (!state.sweeps[world.id] && world.levels.every((l) => (state.levels[l.id] || {}).stars === 3)) {
      state.sweeps[world.id] = true;
      state.tokens.epic++;
      sweep = true;
    }
    return { got, prevStars: prev.stars, newBest: score > prev.best && prev.best > 0, firstClear, rewards, sweep };
  }

  // Gives the buddy bond XP for a run. Returns reward lines for the result sheet.
  function gainBond(pup, score) {
    const rec = state.pups[pup.id];
    const xp = Pups.bondXpForRun(score);
    if (!rec || xp <= 0 || Pups.bondToNext(rec.bond) === 0) return [];
    const { from, to } = Pups.addBond(rec, xp);
    const out = [`+${xp} bond with ${pup.name}`];
    if (to > from) { out.push(`${pup.name} reached Bond ${to}: ${pct(Pups.bondBonus(to))} score`); track('bond_up', { pup: pup.id, bond: to }); }
    return out;
  }

  async function finishRun(next) {
    const g = run.game;
    const lvl = run.lvl;
    const gift = run.giftResult;
    const bones = runBones();
    state.bones += bones;
    if (!lvl) state.best = Math.max(state.best, g.score);
    state.stats.games++;
    state.stats.lines += g.linesCleared;
    state.ads.gamesSinceInterstitial++;
    const summary = lvl ? recordLevel(lvl, g.score) : null;
    const milestones = lvl ? [] : payMilestones(g.score);
    const bondNotes = gainBond(run.pup, g.score);
    submitScores(lvl, g.score);
    if (summary) summary.rewards.push(...bondNotes);
    track('run_end', { score: g.score, bones, revived: run.revived, doubled: run.doubled, level: lvl ? lvl.id : 'endless', stars: summary ? summary.got : null });
    run = null;
    closeModal();
    save();
    if (Ads.canShowInterstitial(state, Date.now())) {
      Ads.noteInterstitialShown(state, Date.now());
      save();
      track('ad_interstitial', {});
      await ads.interstitial();
    }
    if (lvl) { showLevelResult(lvl, g.score, bones, summary, gift); return; }
    const notes = [...milestones.map(([m, b]) => `Milestone ${m.toLocaleString()}! +${b} bones`), ...bondNotes.filter((x) => x.includes('Bond '))];
    notes.forEach((x, k) => setTimeout(() => toast(x), 300 + k * 2700));
    if (next === 'again') startRun(); else show('home');
  }

  function showLevelResult(lvl, score, bones, sum, gift) {
    // A freed gift pup gets its full reveal first.
    if (gift) {
      const sheet = openModal('', { cls: 'reveal' });
      PullFX.showResult(sheet, gift, Object.assign({}, fxCtx, {
        actions: () => '<button type="button" class="btn" data-act="done">Continue</button>',
      }));
      sheet.onclick = (e) => { if (e.target.closest('[data-act]')) showLevelResult(lvl, score, bones, sum, null); };
      return;
    }
    show('map');
    const nxt = Levels.next(lvl);
    const tutorial = !state.tutorial.done && state.tutorial.step === TUT.POSTRUN;
    const lines = [`+${bones.toLocaleString()} bones from the run`, ...sum.rewards];
    if (sum.sweep) lines.push(`Every level at 3 stars! A crown for this world and a free Epic ${verb().toLowerCase()}`);
    const sheet = openModal(`
      <p class="eyebrow">Level ${lvl.n} · ${lvl.name}</p>
      ${starRow(sum.got)}
      <p class="go-score">${score.toLocaleString()}</p>
      <p class="go-sub">${sum.got ? (sum.newBest ? 'New best for this level' : sum.got > sum.prevStars && sum.prevStars ? 'New star record' : 'Level cleared') : 'Not quite. Try again!'}</p>
      <ul class="reward-list">${lines.map((x) => `<li>${x}</li>`).join('')}</ul>
      <div class="stack">
        ${tutorial ? '<button type="button" class="btn" data-act="home">Continue</button>' : `
        ${sum.got && nxt ? '<button type="button" class="btn" data-act="next">Next level</button>' : ''}
        <div class="pull-row"><button type="button" class="btn ${sum.got && nxt ? 'ghost' : ''}" data-act="retry">Retry</button><button type="button" class="btn ghost" data-act="map">Map</button></div>`}
      </div>`, { cls: 'gameover level-result' });
    sheet.querySelectorAll('.result-stars span').forEach((el, k) => {
      el.classList.remove('on');
      if (k < sum.got) setTimeout(() => { el.classList.add('on', 'pop'); sfx.ding(k + 2); haptic('LIGHT'); }, 350 + k * 320);
    });
    sheet.onclick = (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      closeModal();
      if (a.dataset.act === 'next') startRun({ level: nxt });
      else if (a.dataset.act === 'retry') startRun({ level: lvl });
      else if (a.dataset.act === 'home') show('home');
      else renderMap();
    };
  }

  // ---------------------------------------------------------------- map
  let mapWorld = 'w1';
  const cleared = (id) => (state.levels[id] || {}).stars > 0;
  // A world opens when the level named by its unlockAfter is cleared (Dog Park: Living Room 30),
  // so a player stuck late in one world can move on.
  function worldOpen(world) { return dev() || !world.unlockAfter || cleared(world.unlockAfter); }
  function levelUnlocked(world, k) {
    return dev() || (k === 0 ? worldOpen(world) : cleared(world.levels[k - 1].id));
  }
  // The next uncleared level, preferring the world the player was last in.
  function nextLevel() {
    const worlds = Levels.WORLDS.filter((w) => w.levels.length);
    const order = [worlds.find((w) => w.id === mapWorld), ...worlds].filter(Boolean);
    for (const w of order) {
      const k = w.levels.findIndex((l) => !cleared(l.id));
      if (k >= 0 && levelUnlocked(w, k)) return w.levels[k];
    }
    return null;
  }
  const NOTE_HELP = {
    'Fence posts': 'Posts never clear, but lines complete around them',
    'Shaped boards': 'Lines only need the squares that are on the board',
    'Buried bones': 'Clear a line over a dashed bone to dig it up: +50 points and 10 bones',
    Puddles: "Can't build on water. A line cleared through a puddle dries it up",
    Ice: 'Ice takes one extra clear to break',
    Mud: 'Mud takes two extra clears',
    'Small boards': 'Less room: 7×7 and later 6×6 boards',
    Squirrels: 'Every 3 moves a squirrel hops, after a look where it is going. Clear a line through it to chase it off: +100',
    Acorns: 'Hopping squirrels now leave an acorn block behind',
    'Leaf Blower': 'Every few moves the Leaf Blower pushes the marked row one cell sideways. The end block falls off',
    'Squirrels come back': 'A chased squirrel returns after 6 moves',
  };

  function renderMap() {
    const w = Levels.WORLDS.find((x) => x.id === mapWorld);
    $('#map-title').textContent = w.name;
    $('#world-tabs').innerHTML = Levels.WORLDS.map((x, k) => `<button type="button" class="world-tab${x.id === mapWorld ? ' on' : ''}${x.levels.length ? '' : ' soon'}${x.levels.length && !worldOpen(x) ? ' locked' : ''}" data-world="${x.id}">${state.sweeps[x.id] ? '<span class="crown">♛</span>' : ''}${x.levels.length && !worldOpen(x) ? '<span class="lock">🔒</span>' : ''}${k + 1}. ${x.name}</button>`).join('');
    $('#world-tabs .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    const path = $('#map-path');
    if (!w.levels.length) {
      $('#map-stars').textContent = '0';
      path.innerHTML = `<div class="soon-card"><p class="eyebrow">Coming soon</p><p>${w.soon}</p></div>`;
      return;
    }
    const earned = w.levels.reduce((a, l) => a + ((state.levels[l.id] || {}).stars || 0), 0);
    $('#map-stars').textContent = `${earned}/${w.levels.length * 3}`;
    let currentId = null;
    const gate = worldOpen(w) ? '' : (() => {
      const req = Levels.BY_ID[w.unlockAfter];
      const rw = Levels.WORLDS.find((x) => x.id === req.world);
      return `<div class="soon-card gate-card"><p class="eyebrow">Locked</p><p>Clear <b>${rw.name} level ${req.n}</b> to open the ${w.name}.</p></div>`;
    })();
    path.innerHTML = gate + w.levels.map((l, k) => {
      const rec = state.levels[l.id] || { stars: 0 };
      const open = levelUnlocked(w, k);
      if (open && !rec.stars && !currentId) currentId = l.id;
      const badges = (l.reward.type === 'dig' && !rec.stars ? `<i class="lvl-badge dig">${verb()}</i>` : '') + (l.gift && !state.gifts[l.id] ? '<i class="lvl-badge gift">Pup</i>' : '');
      return `<button type="button" class="lvl-node ${k % 2 ? 'right' : 'left'}${open ? '' : ' locked'}${l.id === currentId ? ' current' : ''}${rec.stars ? ' done' : ''}" data-level="${l.id}" ${open ? '' : 'disabled'}>
        <span class="lvl-num">${l.n}</span>
        <span class="lvl-info"><b>${l.name}</b><span class="lvl-stars">${[1, 2, 3].map((s) => `<i class="${s <= rec.stars ? 'on' : ''}">★</i>`).join('')}</span></span>
        ${badges}</button>`;
    }).join('') + (state.sweeps[w.id] ? '<p class="sweep-note">♛ Every level at 3 stars</p>' : '');
    const cur = path.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  $('#world-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-world]');
    if (!b) return;
    mapWorld = b.dataset.world;
    renderMap();
  });
  $('#map-path').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b || b.disabled) return;
    openLevelSheet(Levels.BY_ID[b.dataset.level]);
  });

  function openLevelSheet(lvl) {
    const t = Levels.starsFor(lvl);
    const rec = state.levels[lvl.id];
    const MINI = { '.': 'e', P: 'p', x: 'x', o: 'o', O: 'bo', w: 'w', i: 'i', m: 'm', S: 's' };
    const miniCls = (ch) => MINI[ch] || (ch === 'C' ? (lvl.gift && !state.gifts[lvl.id] ? 'c' : 'e') : 'b');
    const mini = lvl.start.map((row) => [...row].map((ch) => `<i class="m-${miniCls(ch)}"></i>`).join('')).join('');
    const reward = lvl.reward.type === 'dig' ? `a free ${verb().toLowerCase()}` : `${lvl.reward.amount} bones`;
    const giftLine = lvl.gift && !state.gifts[lvl.id] ? `<p class="go-sub gift-line"><b>${Pups.BY_ID[lvl.gift].name}</b> is stuck in a crate! Clear 2 lines through the crate to set ${Pups.BY_ID[lvl.gift].name} free.</p>` : '';
    openModal(`<p class="eyebrow">Level ${lvl.n}</p>
      <h3 class="ls-name">${lvl.name}</h3>
      <div class="mini-board" data-world="${lvl.world}" aria-label="Starting board">${mini}</div>
      ${NOTE_HELP[lvl.note] ? `<p class="go-sub ls-note">New: <b>${lvl.note}</b>. ${NOTE_HELP[lvl.note]}</p>` : ''}
      <div class="ls-stars">${t.map((v, k) => `<div><span>${'★'.repeat(k + 1)}</span><b>${v.toLocaleString()}</b></div>`).join('')}</div>
      ${giftLine}
      ${bondOf(state.buddy) > 1 ? `<p class="go-sub">${Pups.BY_ID[state.buddy].name}'s bond: <b>${pct(Pups.bondBonus(bondOf(state.buddy)))} score</b></p>` : ''}
      <p class="go-sub">First clear: ${rec && rec.stars ? 'claimed' : reward}${rec ? ` · Best ${rec.best.toLocaleString()}` : ''}</p>
      <div class="stack"><button type="button" class="btn big" data-act="play">Play</button><button type="button" class="btn ghost" data-act="close">Close</button></div>`)
      .onclick = (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        closeModal();
        if (a.dataset.act === 'play') startRun({ level: lvl });
      };
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
    const tok = $('#btn-pull-token'), epic = $('#btn-pull-epic');
    tok.hidden = state.tokens.dig <= 0;
    tok.querySelector('.label').textContent = `Map ${verb().toLowerCase()} ×${state.tokens.dig} · free`;
    epic.hidden = state.tokens.epic <= 0;
    epic.querySelector('.label').textContent = `Epic ${verb().toLowerCase()} ×${state.tokens.epic} · Epic or better`;
    const weekly = $('#btn-pull-week');
    const wLeft = state.weekly.pullsLeft;
    weekly.disabled = wLeft <= 0;
    weekly.querySelector('.label').textContent = wLeft > 0
      ? `Weekly ${verb().toLowerCase()} · ${Pups.RARITY[ECON.WEEKLY_MIN_RARITY].label} or better`
      : `Next weekly ${verb().toLowerCase()} in ${fmtWait(State.msToNextWeek(Date.now()))}`;
    const free = $('#btn-pull-free');
    const left = state.daily.freePullsLeft;
    free.hidden = ECON.DAILY_AD_PULLS <= 0;
    free.disabled = left <= 0;
    free.querySelector('.label').textContent = left > 0 ? `Bonus ${verb().toLowerCase()} · watch an ad` : `Bonus ${verb().toLowerCase()} is back tomorrow`;
    $('#bone-pulls').hidden = !ECON.BONE_PULLS;
    $('#btn-pull-1').disabled = state.bones < Gacha.COST_1;
    $('#btn-pull-10').disabled = state.bones < Gacha.COST_10;
    $('#pity').textContent = `Epic or better guaranteed within ${Gacha.PITY_EPIC - state.pity.sinceEpic} pulls`;
  }

  async function doPull(count, source) {
    if (pulling) return;
    pulling = true;
    try {
      let opts;
      if (source === 'bones') {
        const cost = count === 10 ? Gacha.COST_10 : Gacha.COST_1;
        if (state.bones < cost) { toast('Not enough bones. Play a round to earn more.'); return; }
        state.bones -= cost;
      } else if (source === 'token' || source === 'epic') {
        if (state.tokens[source === 'token' ? 'dig' : 'epic'] <= 0) return;
        state.tokens[source === 'token' ? 'dig' : 'epic']--;
        if (source === 'epic') opts = { minRarity: 'epic' };
      } else if (source === 'weekly') {
        if (state.weekly.pullsLeft <= 0) return;
        state.weekly.pullsLeft--;
        opts = { minRarity: ECON.WEEKLY_MIN_RARITY };
      } else {
        if (state.daily.freePullsLeft <= 0) return;
        track('ad_rewarded_request', { placement: 'free_pull' });
        if (!(await ads.rewarded())) return;
        track('ad_rewarded_granted', { placement: 'free_pull' });
        state.daily.freePullsLeft--;
        state.ads.rewardedToday++;
      }
      if (!state.tutorial.done && state.tutorial.step === TUT.DIG) opts = Object.assign({ minRarity: 'rare' }, opts);
      coachHide();
      const results = Gacha.pullMany(state, rng, count, opts);
      save();
      track('gacha_pull', { count, source, best: results.reduce((b, r) => Math.max(b, Gacha.rarityRank(r.rarity)), 0) });
      renderGacha();
      if (!digMode() && !$('#screen-gacha').hidden) await PullFX.crank($('.machine svg'), fxCtx);
      const cost = count === 10 ? Gacha.COST_10 : Gacha.COST_1;
      await reveal(results, source === 'bones' ? {
        label: `Again · ${cost}`,
        can: () => state.bones >= cost,
        run: () => doPull(count, 'bones'),
      } : null);
    } finally { pulling = false; }
  }
  let pulling = false;

  $('#btn-pull-week').addEventListener('click', () => { Audio.unlock(); doPull(1, 'weekly'); });
  $('#btn-pull-token').addEventListener('click', () => { Audio.unlock(); doPull(1, 'token'); });
  $('#btn-pull-epic').addEventListener('click', () => { Audio.unlock(); doPull(1, 'epic'); });
  $('#btn-pull-1').addEventListener('click', () => { Audio.unlock(); doPull(1, 'bones'); });
  $('#btn-pull-10').addEventListener('click', () => { Audio.unlock(); doPull(10, 'bones'); });
  $('#btn-pull-free').addEventListener('click', () => { Audio.unlock(); doPull(1, 'ad'); });

  // ---- reveal (animation lives in pullfx.js)
  const fxCtx = {
    sfx, haptic,
    renderPup: (p, o) => Pups.renderPup(p, o),
    power: (p) => powerOf(p),
    stars: (r) => Pups.RARITY[r].stars,
    rarityLabel: (r) => Pups.RARITY[r].label,
    owned: (p) => state.pups[p.id],
    charges: (p, lvl) => Pups.chargesFor(p, lvl),
    copiesToNext: (p, lvl) => Pups.copiesToNext(lvl, p.rarity),
    maxLevel: Pups.MAX_LEVEL,
    miniCard: (r) => {
      const note = r.isNew ? '<span class="tag new">New!</span>'
        : r.leveledUp ? `<span class="tag up">Lv ${r.level}!</span>`
          : `<span class="tag dupe">+${r.refund}</span>`;
      return `<div class="card mini r-${r.rarity}"><div class="card-art">${Pups.renderPup(r.pup)}</div><p class="card-name">${r.pup.name}</p>${note}</div>`;
    },
  };

  async function reveal(results, again) {
    const sheet = openModal('', { cls: 'reveal' });
    const canAgain = () => again && again.can();
    if (results.length === 1) {
      const r = results[0];
      if (digMode()) await PullFX.dig(sheet, r, fxCtx);
      else await PullFX.single(sheet, r, fxCtx);
      PullFX.showResult(sheet, r, Object.assign({}, fxCtx, {
        actions: () => `
          ${state.buddy !== r.pup.id ? '<button type="button" class="btn" data-act="buddy">Make buddy</button>' : ''}
          <div class="pull-row">
            <button type="button" class="btn ghost" data-act="done">Nice!</button>
            ${canAgain() ? `<button type="button" class="btn alt" data-act="again">${again.label}</button>` : ''}
          </div>`,
      }));
      sheet.onclick = (e) => {
        const act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'buddy') { state.buddy = r.pup.id; save(); sfx.woof(); toast(`${r.pup.name} is your buddy now`); }
        closeModal(); renderGacha();
        tutorialAfterReveal();
        if (act.dataset.act === 'again') again.run();
      };
      return;
    }
    await PullFX.multi(sheet, results, Object.assign({}, fxCtx, {
      multiActions: () => `<div class="pull-row"><button type="button" class="btn ghost" data-act="done">Done</button>
        ${canAgain() ? `<button type="button" class="btn alt" data-act="again">${again.label}</button>` : ''}</div>`,
    }), digMode() ? 'dig' : 'capsule');
    sheet.onclick = (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      closeModal(); renderGacha();
      tutorialAfterReveal();
      if (act.dataset.act === 'again') again.run();
    };
  }

  // ---------------------------------------------------------------- kennel
  const FEED_SNACK = 50; // bones per snack
  function bondRow(pup, o) {
    const b = Pups.bondLevel(o.bond);
    const max = b >= Pups.BOND.MAX;
    const lo = Pups.BOND.XP[b - 1], hi = max ? lo : Pups.BOND.XP[b];
    const fill = max ? 100 : Math.round((100 * ((o.bond || 0) - lo)) / (hi - lo));
    const note = max ? 'Max bond' : `${Pups.bondToNext(o.bond)} XP to Bond ${b + 1} (${pct(Pups.bondBonus(b + 1))} score)`;
    return `<div><dt>Bond ${b}</dt><dd><span class="bond-bar"><i style="width:${fill}%"></i></span><small>${b > 1 ? `${pct(Pups.bondBonus(b))} score · ` : ''}${note}</small></dd></div>`;
  }
  function feedButtons(o) {
    const need = Pups.bondToNext(o.bond);
    if (!need) return '';
    const snack = Math.min(FEED_SNACK, need) * Pups.BOND.BONES_PER_XP, full = need * Pups.BOND.BONES_PER_XP;
    return `<p class="go-sub feed-note">Bond grows as you play with this pup. Treats speed it up.</p><div class="pull-row">
      <button type="button" class="btn ghost small" data-act="feed" ${state.bones < snack ? 'disabled' : ''}>Snack · ${snack} ${BONE_SVG}</button>
      ${full > snack ? `<button type="button" class="btn ghost small" data-act="feednext" ${state.bones < full ? 'disabled' : ''}>Bond ${Pups.bondLevel(o.bond) + 1} · ${full.toLocaleString()} ${BONE_SVG}</button>` : ''}
    </div>`;
  }
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
        <p class="card-name">${p.name}</p><p class="card-meta">${stars(p.rarity)}</p>${pips(o.level)}</button>`;
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
        <p class="go-sub">Power: <b>${powerOf(pup).name}</b>. ${powerOf(pup).desc}.<br>Not found yet. ${verb()} at the ${gachaName()} to meet this one.</p>
        <div class="stack"><button type="button" class="btn" data-act="gacha">Go to the ${gachaName()}</button><button type="button" class="btn ghost" data-act="close">Close</button></div>`)
        .onclick = (ev) => {
          const a = ev.target.closest('[data-act]');
          if (!a) return;
          closeModal();
          if (a.dataset.act === 'gacha') show('gacha');
        };
      return;
    }
    const isBuddy = state.buddy === pup.id;
    const n = Pups.chargesFor(pup, o.level);
    const need = o.level >= Pups.MAX_LEVEL ? 'Max level' : `${o.dupes}/${Pups.copiesToNext(o.level, pup.rarity)} copies to Lv ${o.level + 1} (${n + 1} ${chargeWord(n + 1, pup)})`;
    openModal(`<p class="eyebrow">${pup.breed}</p>
      <div class="detail-art r-${pup.rarity}">${Pups.renderPup(pup)}</div>
      <p class="detail-name">${pup.name} ${stars(pup.rarity)}</p>
      <dl class="detail-stats">
        <div><dt>${powerOf(pup).name}</dt><dd><small>${powerOf(pup).desc}</small></dd></div>
        <div><dt>Per run</dt><dd>${n} ${chargeWord(n, pup)}</dd></div>
        <div><dt>Level ${o.level}</dt><dd>${pips(o.level)}<small>${need}</small></dd></div>
        ${bondRow(pup, o)}
      </dl>
      <div class="stack">
        ${feedButtons(o)}
        ${isBuddy ? '<p class="go-sub">Your current buddy</p>' : '<button type="button" class="btn" data-act="buddy">Make buddy</button>'}
        ${dev() ? '<div class="dev-row"><span class="dev-tag">DEV</span><button type="button" class="btn ghost small" data-act="lvdown">Level −</button><button type="button" class="btn ghost small" data-act="lvup">Level +</button></div><div class="dev-row"><span class="dev-tag">DEV</span><button type="button" class="btn ghost small" data-act="bonddown">Bond −</button><button type="button" class="btn ghost small" data-act="bondup">Bond +</button></div>' : ''}
        <button type="button" class="btn ghost" data-act="close">Close</button>
      </div>`).onclick = (ev) => {
      const a = ev.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      const reopen = () => { save(); renderKennel(); $(`#kennel-grid .card[data-id="${pup.id}"]`).click(); };
      if (act === 'feed' || act === 'feednext') {
        const xp = act === 'feed' ? Math.min(FEED_SNACK, Pups.bondToNext(o.bond)) : Pups.bondToNext(o.bond);
        const cost = xp * Pups.BOND.BONES_PER_XP;
        if (!xp || state.bones < cost) return;
        state.bones -= cost;
        const { from, to } = Pups.addBond(o, xp);
        sfx.coin(); haptic('LIGHT');
        track('bond_feed', { pup: pup.id, bones: cost });
        reopen();
        if (to > from) { sfx.woof(); toast(`${pup.name} reached Bond ${to}: ${pct(Pups.bondBonus(to))} score`); }
        return;
      }
      if (act === 'bondup' || act === 'bonddown') {
        const b = Math.max(1, Math.min(Pups.BOND.MAX, Pups.bondLevel(o.bond) + (act === 'bondup' ? 1 : -1)));
        o.bond = Pups.BOND.XP[b - 1];
        reopen();
        return;
      }
      if (act === 'lvup' || act === 'lvdown') {
        o.level = Math.max(1, Math.min(Pups.MAX_LEVEL, o.level + (act === 'lvup' ? 1 : -1)));
        o.dupes = 0;
        save(); renderKennel();
        $(`#kennel-grid .card[data-id="${pup.id}"]`).click(); // reopen with the new level
        return;
      }
      if (act === 'buddy') { state.buddy = pup.id; save(); sfx.woof(); renderKennel(); }
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
        ${ALLOW_DEV ? `<label class="switch"><span>Developer mode</span><input id="set-dev" type="checkbox" ${s.dev ? 'checked' : ''}></label>` : ''}
      </div>
      <div class="stack">
        ${s.noAds ? '<p class="go-sub">Ads removed. Thank you! Optional reward ads stay available.</p>' : `<button type="button" class="btn alt" data-act="noads">Remove ads · ${store.price()}</button>`}
        <div class="pull-row"><button type="button" class="btn ghost small" data-act="restore">Restore purchases</button>
        ${adProvider.privacyOptionsRequired() || dev() ? '<button type="button" class="btn ghost small" data-act="privacy">Privacy choices</button>' : ''}</div>
        <button type="button" class="btn ghost" data-act="reset">Reset progress</button>
        <button type="button" class="btn ghost" data-act="close">Done</button>
      </div>
      <p class="fine">${gachaName()} odds: Common 62%, Rare 27%, Epic 9%, Legendary 2%. Epic or better every ${Gacha.PITY_EPIC} pulls; Legendary every ${Gacha.PITY_LEGENDARY}.</p>`);
    sheet.querySelector('#set-sound').onchange = (e) => { s.sound = e.target.checked; Audio.setSound(s.sound); save(); };
    sheet.querySelector('#set-haptics').onchange = (e) => { s.haptics = e.target.checked; Audio.setHaptics(s.haptics); save(); };
    const devBox = sheet.querySelector('#set-dev');
    if (devBox) devBox.onchange = (e) => { s.dev = e.target.checked; save(); renderDevButton(); if (s.dev) toast('Developer mode on. Tap DEV for tools.'); };
    sheet.onclick = (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'close') closeModal();
      if (act === 'noads') {
        track('iap_request', { product: 'removeAds' });
        store.buyRemoveAds().then((ok) => {
          if (!ok) return;
          s.noAds = true; save(); track('iap_purchase', { product: 'removeAds' });
          sfx.coin(); closeModal(); toast('Ads removed. Thank you!');
        });
      }
      if (act === 'restore') {
        store.restore().then((r) => {
          if (r.removeAds) { s.noAds = true; save(); closeModal(); toast('Purchases restored: ads removed'); }
          else toast(r.removeAds === null ? 'Restore connects to the App Store in the iOS build' : 'No purchases to restore');
        });
      }
      if (act === 'privacy') {
        if (adProvider.kind === 'mock') toast("Google's privacy choices form opens here in the iOS build");
        else adProvider.showPrivacyOptions();
      }
      if (act === 'reset') {
        if (a.dataset.armed) {
          state = State.freshState(); State.rollDaily(state, Date.now()); save(); closeModal(); show('home'); toast('Progress reset');
        } else { a.dataset.armed = '1'; a.textContent = 'Tap again to erase everything'; a.classList.add('danger'); }
      }
    };
  }

  // ---------------------------------------------------------------- tutorial
  // A scripted first run (place, double clear + treat, buddy power), then a guided first dig.
  // Each step is saved as it completes, so closing the app resumes at the right place.
  const TUT = { PLACE: 0, DOUBLE: 1, POWER: 2, POSTRUN: 3, DIG: 4, KENNEL: 5 };
  const coachEl = $('#coach');
  let coachOpts = null;

  function rectOf(target) {
    if (!target) return null;
    if (Array.isArray(target)) {
      const rs = target.map((el) => el.getBoundingClientRect());
      const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
      return { left: l, top: t, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t };
    }
    const el = typeof target === 'string' ? $(target) : target;
    return el ? el.getBoundingClientRect() : null;
  }

  // opts: { text, spot, drag: [from, to], tap, next }  (targets are elements, selectors or element lists)
  function coachShow(opts) {
    coachOpts = opts;
    coachEl.hidden = false;
    $('.coach-face').innerHTML = Pups.renderPup(Pups.BY_ID[Pups.STARTER_ID], { plain: true });
    $('.coach-text').textContent = opts.text;
    const spot = $('.coach-spot'), paw = $('.coach-paw'), bubble = $('.coach-bubble');
    const sr = rectOf(opts.spot);
    spot.hidden = !sr;
    if (sr) Object.assign(spot.style, { left: sr.left - 8 + 'px', top: sr.top - 8 + 'px', width: sr.width + 16 + 'px', height: sr.height + 16 + 'px' });
    paw.hidden = !(opts.drag || opts.tap);
    paw.className = 'coach-paw';
    const center = (r) => [r.left + r.width / 2 + 'px', r.top + r.height / 2 + 'px'];
    if (opts.drag) {
      const [a, b] = [rectOf(opts.drag[0]), rectOf(opts.drag[1])];
      const [x0, y0] = center(a), [x1, y1] = center(b);
      paw.style.setProperty('--x0', x0); paw.style.setProperty('--y0', y0);
      paw.style.setProperty('--x1', x1); paw.style.setProperty('--y1', y1);
      void paw.offsetWidth; paw.classList.add('drag');
    } else if (opts.tap) {
      const [x1, y1] = center(rectOf(opts.tap));
      paw.style.setProperty('--x1', x1); paw.style.setProperty('--y1', y1);
      paw.classList.add('tap');
    }
    const focusY = sr ? sr.top + sr.height / 2 : opts.drag ? rectOf(opts.drag[1]).top : 0;
    bubble.classList.toggle('at-top', focusY > innerHeight * 0.55);
    bubble.classList.toggle('at-bottom', !(focusY > innerHeight * 0.55));
    const next = $('.coach-next');
    next.hidden = !opts.next;
    if (opts.next) { next.textContent = opts.next; next.onclick = () => { const fn = opts.onNext; coachHide(); if (fn) fn(); }; }
    bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
  }
  function coachHide() { coachOpts = null; coachEl.hidden = true; document.querySelectorAll('.cell.tut-target').forEach((c) => c.classList.remove('tut-target')); }
  function coachBump() { const b = $('.coach-bubble'); if (coachEl.hidden) return; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  window.addEventListener('resize', () => { if (coachOpts) coachShow(coachOpts); if (run) renderCrate(); });
  $('.coach-skip').addEventListener('click', () => {
    finishTutorial();
    if (run && run.tut) startRun();
    else renderHome();
    track('tutorial_skipped', {});
  });

  function setStep(n) { state.tutorial.step = n; save(); track('tutorial_step', { step: n }); }
  function finishTutorial() { state.tutorial.done = true; save(); coachHide(); track('tutorial_done', {}); }

  function startTutorial() {
    const step = state.tutorial.step;
    if (step <= TUT.POWER) {
      startRun({ pup: Pups.BY_ID[Pups.STARTER_ID] });
      run.tut = true;
      setupTutorialStep(step);
    } else if (step >= TUT.KENNEL) finishTutorial();
    else show('home');
  }

  function setupTutorialStep(step) {
    const g = run.game, idx = Core.idx, piece = (id, color, treat) => Object.assign(Core.makePiece(g, Core.SHAPE_BY_ID[id]), { color, treat: treat == null ? -1 : treat });
    g.board.fill(0); g.treats.fill(0);
    g.score = 0; g.combo = 0; g.history = null;
    run.tutLock = false; run.tutTarget = null;
    coachHide();
    const slot = () => document.querySelectorAll('#tray .slot')[1];
    const mark = (cells) => cells.forEach((i) => cellEls[i].classList.add('tut-target'));
    if (step === TUT.PLACE) {
      for (let c = 0; c < 6; c++) g.board[idx(7, c)] = 2 + (c % 3);
      g.tray = [null, piece('i2h', 5), null];
      run.tutTarget = { i: 1, r: 7, c: 6 };
      renderBoard(); renderTray(); renderScore(); renderBuddyBar();
      mark([idx(7, 6), idx(7, 7)]);
      coachShow({ text: "Hi, I'm Mochi! Drag the piece into the gap.", drag: [slot(), [cellEls[idx(7, 6)], cellEls[idx(7, 7)]]] });
    } else if (step === TUT.DOUBLE) {
      for (let c = 0; c < 7; c++) g.board[idx(7, c)] = 2 + (c % 3);
      for (let r = 0; r < 7; r++) g.board[idx(r, 7)] = 5 + (r % 2);
      g.tray = [null, piece('dot', 4, 0), null];
      run.tutTarget = { i: 1, r: 7, c: 7 };
      renderBoard(); renderTray(); renderScore(); renderBuddyBar();
      mark([idx(7, 7)]);
      coachShow({ text: 'Fill the corner to clear a row and a column at once!', drag: [slot(), cellEls[idx(7, 7)]] });
    } else if (step === TUT.POWER) {
      for (let r = 0; r < Core.SIZE; r++) for (let c = 0; c < Core.SIZE; c++) g.board[idx(r, c)] = (r + 3 * c) % Core.SIZE === 0 ? 0 : 1 + ((r + c) % Core.COLORS);
      g.tray = [0, 1, 2].map((k) => piece('o2', 1 + k * 2));
      run.charges = 1; run.tutLock = true;
      renderBoard(); renderTray(); renderScore(); renderBuddyBar();
      coachShow({ text: "Uh oh, nothing fits! Tap me and I'll Fetch new pieces.", spot: '#btn-power', tap: '#btn-power' });
    }
  }

  function tutorialAfterPlace(res) {
    const step = state.tutorial.step;
    run.tutTarget = null; run.tutLock = true;
    coachHide();
    if (step === TUT.PLACE) {
      setTimeout(() => coachShow({ text: 'Full rows and columns clear!' }), 350);
      setTimeout(() => { setStep(TUT.DOUBLE); if (run && run.tut) setupTutorialStep(TUT.DOUBLE); }, 2000);
    } else if (step === TUT.DOUBLE) {
      setTimeout(() => coachShow({ text: 'Two lines at once means bonus points. And that bone? Bones buy digs!' }), 350);
      setTimeout(() => { setStep(TUT.POWER); if (run && run.tut) setupTutorialStep(TUT.POWER); }, 2800);
    }
  }

  function tutorialAfterPower() {
    run.tutLock = true;
    coachHide();
    setTimeout(() => coachShow({
      text: "That's it! Clear lines to make room. The run ends when nothing fits.", next: "Let's play",
      onNext: () => { setStep(TUT.POSTRUN); startRun({ level: Levels.WORLDS[0].levels[0] }); },
    }), 700);
  }

  function tutorialOnShow(name) {
    if (state.tutorial.done) return;
    const step = state.tutorial.step;
    if (step < TUT.POSTRUN) return;
    if (name === 'game') { coachHide(); return; }
    if (name === 'home' && (step === TUT.POSTRUN || step === TUT.DIG)) {
      if (step === TUT.POSTRUN) setStep(TUT.DIG);
      coachShow({ text: `You've got a free dig waiting! Let's dig up a new friend.`, spot: '#btn-gacha', tap: '#btn-gacha' });
    } else if (name === 'gacha' && step === TUT.DIG) {
      const btn = state.weekly.pullsLeft > 0 ? '#btn-pull-week' : '#btn-pull-1';
      coachShow({ text: 'Tap to dig!', spot: btn, tap: btn });
    } else if (name !== 'gacha' && step === TUT.DIG) coachHide();
  }

  function tutorialAfterReveal() {
    if (state.tutorial.done || state.tutorial.step !== TUT.DIG) return;
    setStep(TUT.KENNEL);
    coachShow({
      text: 'Your pups live in the Kennel. Your buddy brings its power into every run. Have fun!', next: 'Got it',
      onNext: () => finishTutorial(),
    });
  }

  // ---------------------------------------------------------------- developer tools
  function renderDevButton() { $('#dev-btn').hidden = !dev(); }
  $('#dev-btn').addEventListener('click', openDev);

  function refreshAll() {
    renderBones();
    if (!$('#screen-home').hidden) renderHome();
    if (!$('#screen-gacha').hidden) renderGacha();
    if (!$('#screen-kennel').hidden) renderKennel();
    if (!$('#screen-map').hidden) renderMap();
    if (run) { renderBoard(); renderTray(); renderScore(); renderBuddyBar(); }
  }

  // Fills the board so every row and column has exactly one hole, then deals pieces that can't fit.
  function devForceStuck() {
    const g = run.game;
    for (let r = 0; r < Core.SIZE; r++) {
      for (let c = 0; c < Core.SIZE; c++) {
        const hole = (r + 3 * c) % Core.SIZE === 0;
        g.board[Core.idx(r, c)] = hole ? 0 : 1 + ((r + c) % Core.COLORS);
        g.treats[Core.idx(r, c)] = 0;
      }
    }
    g.tray = [0, 1, 2].map(() => Core.makePiece(g, Core.SHAPE_BY_ID.o2));
    g.history = null;
    refreshAll();
    if (Core.isGameOver(g)) handleStuck();
  }

  function openDev() {
    const s = state.settings;
    const sheet = openModal(`<p class="eyebrow">Developer tools</p>
      <div class="dev-grid">
        <button type="button" class="btn ghost small" data-dev="bones">+1,000 bones</button>
        <button type="button" class="btn ghost small" data-dev="pulls">Refill free pulls</button>
        <button type="button" class="btn ghost small" data-dev="unlock">Unlock all pups</button>
        <button type="button" class="btn ghost small" data-dev="max">Max all pups</button>
        <button type="button" class="btn ghost small" data-dev="pity">Reset pity</button>
        <button type="button" class="btn ghost small" data-dev="starter">Back to starter only</button>
        <button type="button" class="btn ghost small" data-dev="tutorial">Replay tutorial</button>
        <button type="button" class="btn ghost small" data-dev="levels">Reset level progress</button>
      </div>
      <p class="eyebrow">Pull a specific rarity</p>
      <div class="dev-grid four">
        ${Gacha.ORDER.map((r) => `<button type="button" class="btn ghost small r-${r}" data-dev="pull-${r}"><span class="stars">${'★'.repeat(Pups.RARITY[r].stars)}</span></button>`).join('')}
      </div>
      <div class="settings">
        <label class="switch"><span>Skip ads (instant reward)</span><input id="dev-skipads" type="checkbox" ${s.devSkipAds ? 'checked' : ''}></label>
        <label class="switch"><span>Unlimited power charges</span><input id="dev-infinite" type="checkbox" ${s.devInfinite ? 'checked' : ''}></label>
        <label class="switch"><span>Sticker art instead of bean</span><input id="dev-sticker" type="checkbox" ${s.artStyle === 'sticker' ? 'checked' : ''}></label>
        <label class="switch"><span>Gumball machine instead of dig</span><input id="dev-gumball" type="checkbox" ${s.pullStyle === 'gumball' ? 'checked' : ''}></label>
      </div>
      ${run ? `<p class="eyebrow">This run</p>
      <div class="dev-grid">
        <button type="button" class="btn ghost small" data-dev="charges">Refill charges</button>
        <button type="button" class="btn ghost small" data-dev="newtray">New pieces</button>
        <button type="button" class="btn ghost small" data-dev="clear">Clear board</button>
        <button type="button" class="btn ghost small" data-dev="stuck">Get stuck now</button>
        <button type="button" class="btn ghost small" data-dev="score">+1,000 score</button>
      </div>` : ''}
      <div class="stack"><button type="button" class="btn" data-act="close">Done</button></div>`, { cls: 'dev' });
    sheet.querySelector('#dev-skipads').onchange = (e) => { s.devSkipAds = e.target.checked; save(); };
    sheet.querySelector('#dev-infinite').onchange = (e) => { s.devInfinite = e.target.checked; save(); };
    sheet.querySelector('#dev-gumball').onchange = (e) => { s.pullStyle = e.target.checked ? 'gumball' : 'dig'; save(); renderGachaTheme(); refreshAll(); };
    sheet.querySelector('#dev-sticker').onchange = (e) => { s.artStyle = e.target.checked ? 'sticker' : 'bean'; window.PB.artStyle = s.artStyle; save(); refreshAll(); };
    sheet.onclick = (e) => {
      if (e.target.closest('[data-act="close"]')) { closeModal(); return; }
      const b = e.target.closest('[data-dev]');
      if (!b) return;
      const act = b.dataset.dev;
      let msg = '';
      if (act === 'bones') { state.bones += 1000; msg = '+1,000 bones'; }
      if (act === 'pulls') { state.weekly.pullsLeft = Gacha.ECONOMY.WEEKLY_FREE_PULLS; state.daily.freePullsLeft = Gacha.ECONOMY.DAILY_AD_PULLS; msg = 'Free pulls refilled'; }
      if (act === 'unlock') { Pups.ROSTER.forEach((p) => { if (!state.pups[p.id]) state.pups[p.id] = { level: 1, dupes: 0 }; }); msg = 'All pups unlocked'; }
      if (act === 'max') { Pups.ROSTER.forEach((p) => { state.pups[p.id] = { level: Pups.MAX_LEVEL, dupes: 0 }; }); msg = 'All pups at max level'; }
      if (act === 'pity') { state.pity = { sinceEpic: 0, sinceLegendary: 0 }; msg = 'Pity reset'; }
      if (act === 'levels') { state.levels = {}; state.gifts = {}; state.sweeps = {}; msg = 'Level progress reset (dev mode unlocks every level)'; }
      if (act === 'tutorial') { state.tutorial = { step: 0, done: false }; save(); closeModal(); run = null; startTutorial(); return; }
      if (act === 'starter') { state.pups = { [Pups.STARTER_ID]: { level: 1, dupes: 0 } }; state.buddy = Pups.STARTER_ID; msg = 'Collection reset to Mochi'; }
      if (act.startsWith('pull-')) {
        const results = Gacha.pullMany(state, rng, 1, { rarity: act.slice(5) });
        save(); closeModal(); refreshAll(); reveal(results);
        return;
      }
      if (run) {
        if (act === 'charges') { run.charges = Pups.chargesFor(run.pup, run.level); run.stuckWithPower = false; msg = 'Charges refilled'; }
        if (act === 'newtray') { Core.dealTray(run.game); msg = 'New pieces'; }
        if (act === 'clear') { run.game.board.fill(0); run.game.treats.fill(0); run.game.history = null; msg = 'Board cleared'; }
        if (act === 'score') { run.game.score += 1000; msg = '+1,000 score'; }
        if (act === 'stuck') { save(); closeModal(); devForceStuck(); return; }
      }
      save(); refreshAll(); if (msg) toast(msg);
    };
  }

  // ---------------------------------------------------------------- boot
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal-sheet').classList.contains('gameover') && !$('#modal-sheet').classList.contains('reveal')) closeModal(); });
  renderGachaTheme();
  show('home');
  renderDevButton();
  if (!state.tutorial.done) startTutorial();
  if (!state.tutorial.done) { /* no toasts over the tutorial */ } else if (newWeek) setTimeout(() => toast(`Your weekly ${verb().toLowerCase()} is ready at the ${gachaName()}`), 500);
  else if (loginBonus) setTimeout(() => toast(`Daily treat: +${loginBonus} bones${state.daily.streak > 1 ? ` · ${state.daily.streak}-day streak` : ''}`), 500);
})();
