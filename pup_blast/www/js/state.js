// Saved player state: bones, collection, daily freebies and settings.
// Stored in localStorage. On iOS, swap `storage` for @capacitor/preferences before launch,
// since WKWebView can evict localStorage under storage pressure.
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
      daily: { date: '', freePullsLeft: DAILY_FREE_PULLS, loginClaimed: false, streak: 0 },
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
    };
  }

  // Fills in anything an older save lacks, so new fields never crash old players.
  function normalize(raw) {
    const base = freshState();
    if (!raw || typeof raw !== 'object') return base;
    const out = Object.assign(base, raw);
    for (const k of ['pity', 'daily', 'weekly', 'ads', 'settings', 'stats', 'tutorial', 'levels', 'gifts', 'sweeps', 'tokens', 'endless']) out[k] = Object.assign(freshState()[k], raw[k]);
    // Saves from before the tutorial existed belong to players who already know the game.
    if (!raw.tutorial && raw.stats && raw.stats.games > 0) out.tutorial = { step: 0, done: true };
    out.pups = Object.assign({}, raw.pups);
    if (!out.pups[Pups.STARTER_ID]) out.pups[Pups.STARTER_ID] = { level: 1, dupes: 0 };
    for (const id of Object.keys(out.pups)) {
      if (!Pups.BY_ID[id]) { delete out.pups[id]; continue; }
      out.pups[id].level = Math.min(out.pups[id].level || 1, Pups.MAX_LEVEL);
    }
    if (!Pups.BY_ID[out.buddy] || !out.pups[out.buddy]) out.buddy = Pups.STARTER_ID;
    return out;
  }

  // Starts a new week's free pull if the week changed. Returns true when a new pull was granted.
  function rollWeekly(state, now) {
    const key = weekKey(now);
    if (state.weekly.week === key) return false;
    state.weekly.week = key;
    state.weekly.pullsLeft = WEEKLY_FREE_PULLS;
    return true;
  }

  // Rolls the daily counters over. Returns the login bonus granted today (0 if already claimed).
  function rollDaily(state, now) {
    const today = dayKey(now);
    if (state.daily.date === today) return 0;
    const yesterday = dayKey(now - 86400000);
    state.daily.streak = state.daily.date === yesterday ? state.daily.streak + 1 : 1;
    state.daily.date = today;
    state.daily.freePullsLeft = DAILY_FREE_PULLS;
    state.ads.rewardedToday = 0;
    const bonus = DAILY_LOGIN_BONES + 10 * Math.min(state.daily.streak - 1, 6);
    state.bones += bonus;
    return bonus;
  }

  function load(storage) {
    try {
      const text = storage && storage.getItem(KEY);
      return normalize(text ? JSON.parse(text) : null);
    } catch (e) {
      return freshState();
    }
  }

  function save(storage, state) {
    try { storage && storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const State = { KEY, DAILY_FREE_PULLS, WEEKLY_FREE_PULLS, DAILY_LOGIN_BONES, STARTING_BONES, dayKey, weekKey, msToNextWeek, freshState, normalize, rollDaily, rollWeekly, load, save };

  root.PB = root.PB || {};
  root.PB.State = State;
  if (typeof module !== 'undefined' && module.exports) module.exports = State;
})(typeof globalThis !== 'undefined' ? globalThis : this);
