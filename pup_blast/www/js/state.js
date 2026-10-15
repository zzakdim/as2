// Saved player state: bones, collection, daily freebies and settings.
// Stored in localStorage. In the iOS app main.js also mirrors every save to @capacitor/preferences
// and restores from it if WKWebView ever evicts localStorage.
(function (root) {
  'use strict';

  const Pups = root.PB && root.PB.Pups ? root.PB.Pups : require('./pups.js');

  const Gacha = root.PB && root.PB.Gacha ? root.PB.Gacha : require('./gacha.js');

  const KEY = 'pupblast.v1';
  const DAILY_FREE_PULLS = Gacha.ECONOMY.DAILY_AD_PULLS; // rewarded-ad pulls per day
  const WEEKLY_FREE_PULLS = Gacha.ECONOMY.WEEKLY_FREE_PULLS;
  const DAILY_LOGIN_BONES = 50;
  const STARTING_BONES = 100; // exactly one pull, so the gacha shows up after the first game

  function dayKey(now) {
    const d = new Date(now);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  // Weeks start Monday 00:00 local time.
  function weekStart(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function weekKey(now) { return dayKey(weekStart(now)); }
  function msToNextWeek(now) {
    const next = new Date(weekStart(now));
    next.setDate(next.getDate() + 7);
    return next.getTime() - now;
  }

  function freshState() {
    return {
      version: 1,
      bones: STARTING_BONES,
      best: 0,
      buddy: Pups.STARTER_ID,
      pups: { [Pups.STARTER_ID]: { level: 1, dupes: 0 } },
      pity: { sinceEpic: 0, sinceLegendary: 0 },
      daily: { date: '', freePullsLeft: DAILY_FREE_PULLS, loginClaimed: false, streak: 0, seen: 0 }, // seen: latest clock time seen
      weekly: { week: '', pullsLeft: 0 },
      ads: { gamesSinceInterstitial: 0, lastInterstitialAt: 0, rewardedToday: 0 },
      settings: { sound: true, haptics: true, noAds: false, dev: false, devSkipAds: false, devInfinite: false },
      stats: { games: 0, pulls: 0, lines: 0 },
      tutorial: { step: 0, done: false },
      levels: {}, // level id -> { stars, best }
      gifts: {}, // level id -> true once its crated pup is freed
      sweeps: {}, // world id -> true once every level has 3 stars
      tokens: { dig: 0, epic: 0 }, // digs earned on the map; epic = guaranteed Epic or better
      endless: { milestones: [] }, // Endless score milestones already paid
      boards: {}, // browser stand-in for Game Center: best score per leaderboard
    };
  }

  // Fills in anything an older save lacks, so new fields never crash old players.
  function normalize(raw) {
    const base = freshState();
    if (!raw || typeof raw !== 'object') return base;
    const out = Object.assign(base, raw);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    for (const k of ['pity', 'daily', 'weekly', 'ads', 'settings', 'stats', 'tutorial', 'levels', 'gifts', 'sweeps', 'tokens', 'endless', 'boards']) out[k] = Object.assign(freshState()[k], obj(raw[k]));
    out.bones = Math.max(0, num(out.bones, STARTING_BONES));
    out.best = Math.max(0, num(out.best, 0));
    if (!Array.isArray(out.endless.milestones)) out.endless.milestones = [];
    for (const k of ['dig', 'epic']) out.tokens[k] = Math.max(0, num(out.tokens[k], 0));
    for (const k of ['sinceEpic', 'sinceLegendary']) out.pity[k] = Math.max(0, num(out.pity[k], 0));
    // Level records: { stars 0-3, best }. Anything else is dropped rather than crashing the map.
    for (const id of Object.keys(out.levels)) {
      const r = out.levels[id];
      if (!r || typeof r !== 'object') { delete out.levels[id]; continue; }
      out.levels[id] = { stars: Math.max(0, Math.min(3, Math.floor(num(r.stars, 0)))), best: Math.max(0, num(r.best, 0)) };
    }
    // Saves from before the tutorial existed belong to players who already know the game.
    if (!raw.tutorial && raw.stats && raw.stats.games > 0) out.tutorial = { step: 0, done: true };
    // Pup records are rebuilt field by field, so one bad record can't take the rest of the save with it.
    out.pups = {};
    for (const [id, r] of Object.entries(obj(raw.pups))) {
      if (!Pups.BY_ID[id] || !r || typeof r !== 'object') continue;
      const rec = { level: Math.max(1, Math.min(Math.floor(num(r.level, 1)), Pups.MAX_LEVEL)), dupes: Math.max(0, Math.floor(num(r.dupes, 0))) };
      if (num(r.bond, 0) > 0) rec.bond = r.bond;
      out.pups[id] = rec;
    }
    if (!out.pups[Pups.STARTER_ID]) out.pups[Pups.STARTER_ID] = { level: 1, dupes: 0 };
    if (!Pups.BY_ID[out.buddy] || !out.pups[out.buddy]) out.buddy = Pups.STARTER_ID;
    return out;
  }

  // Setting the device clock back is the classic free-reward cheat: while the clock reads more than an
  // hour earlier than the latest time this save has seen, days and weeks don't roll over.
  const CLOCK_SLACK = 3600000;
  function clockWentBack(state, now) {
    const seen = state.daily.seen || 0;
    if (now < seen - CLOCK_SLACK) return true;
    state.daily.seen = Math.max(seen, now);
    return false;
  }

  // Starts a new week's free pull if the week changed. Returns true when a new pull was granted.
  function rollWeekly(state, now) {
    if (clockWentBack(state, now)) return false;
    const key = weekKey(now);
    if (state.weekly.week === key) return false;
    state.weekly.week = key;
    state.weekly.pullsLeft = WEEKLY_FREE_PULLS;
    return true;
  }

  // Rolls the daily counters over. Returns the login bonus granted today (0 if already claimed).
  function rollDaily(state, now) {
    if (clockWentBack(state, now)) return 0;
    const today = dayKey(now);
    if (state.daily.date === today) return 0;
    const y = new Date(now);
    y.setDate(y.getDate() - 1); // calendar yesterday (now - 24h misses it on a 23-hour DST day)
    const yesterday = dayKey(y.getTime());
    state.daily.streak = state.daily.date === yesterday ? state.daily.streak + 1 : 1;
    state.daily.date = today;
    state.daily.freePullsLeft = DAILY_FREE_PULLS;
    state.ads.rewardedToday = 0;
    const bonus = DAILY_LOGIN_BONES + 10 * Math.min(state.daily.streak - 1, 6);
    state.bones += bonus;
    return bonus;
  }

  // An unreadable save is copied to KEY + '.bak' before the game starts over, so it can be recovered.
  function load(storage) {
    let text = null;
    try { text = storage && storage.getItem(KEY); } catch (e) { return freshState(); }
    let raw = null;
    try { raw = text ? JSON.parse(text) : null; } catch (e) {
      try { storage.setItem(KEY + '.bak', text); } catch (e2) { /* storage full */ }
      return freshState();
    }
    return normalize(raw);
  }

  function save(storage, state) {
    try { storage && storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const State = { KEY, DAILY_FREE_PULLS, WEEKLY_FREE_PULLS, DAILY_LOGIN_BONES, STARTING_BONES, dayKey, weekKey, msToNextWeek, freshState, normalize, rollDaily, rollWeekly, load, save };

  root.PB = root.PB || {};
  root.PB.State = State;
  if (typeof module !== 'undefined' && module.exports) module.exports = State;
})(typeof globalThis !== 'undefined' ? globalThis : this);
