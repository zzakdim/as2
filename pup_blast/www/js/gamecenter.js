// Leaderboards through Apple Game Center.
// Inside the iOS app this talks to the small GameCenter plugin in native/ios/GameCenterPlugin.swift.
// In the browser it keeps a local list of your own best scores and shows it in a sheet.
(function (root) {
  'use strict';

  // Must match the leaderboard IDs created in App Store Connect (Game Center).
  // weekly is a recurring leaderboard that resets every Monday.
  const BOARDS = {
    endless: { id: 'com.example.pupblast.endless', name: 'Endless · all time' },
    weekly: { id: 'com.example.pupblast.endless.weekly', name: 'Endless · this week' },
    stars: { id: 'com.example.pupblast.stars', name: 'Total stars' },
  };

  function nativePlugin() {
    const cap = root.Capacitor;
    return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.GameCenter;
  }

  function createNative(GC) {
    let signedIn = false;
    return {
      kind: 'gamecenter',
      async init() {
        try { signedIn = !!(await GC.signIn()).authenticated; } catch (e) { signedIn = false; }
        return signedIn;
      },
      signedIn: () => signedIn,
      async submit(board, score) {
        if (!signedIn || !(score > 0)) return false;
        try { await GC.submitScore({ leaderboardId: BOARDS[board].id, score: Math.floor(score) }); return true; } catch (e) { return false; }
      },
      async show(board) {
        if (!signedIn) signedIn = await this.init();
        if (!signedIn) return false;
        await GC.showLeaderboard(board ? { leaderboardId: BOARDS[board].id } : {});
        return true;
      },
    };
  }

  // Browser stand-in: remembers your best per board (and this week's) in the save.
  // Week key: the Monday the week started (matches Game Center's Monday reset closely enough for a stand-in).
  function weekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toDateString();
  }
  function createLocal(getState, openSheet) {
    const rec = () => {
      const s = getState();
      s.boards = s.boards || {};
      return s.boards;
    };
    return {
      kind: 'local',
      async init() { return true; },
      signedIn: () => true,
      async submit(board, score) {
        const r = rec();
        if (!(score > 0)) return false;
        if (board === 'weekly') {
          const week = weekKey();
          if (!r.weekly || r.weekly.week !== week) r.weekly = { week, score: 0 };
          r.weekly.score = Math.max(r.weekly.score, Math.floor(score));
        } else r[board] = Math.max(r[board] || 0, Math.floor(score));
        return true;
      },
      async show() {
        const r = rec();
        const score = (k) => (k === 'weekly' ? (r.weekly && r.weekly.week === weekKey() ? r.weekly.score : 0) : r[k] || 0);
        openSheet(Object.entries(BOARDS).map(([k, b]) => ({ name: b.name, score: score(k) })));
        return true;
      },
    };
  }

  function createLeaderboards(getState, openSheet) {
    const plugin = nativePlugin();
    return plugin ? createNative(plugin) : createLocal(getState, openSheet);
  }

  const Leaderboards = { BOARDS, createLeaderboards };

  root.PB = root.PB || {};
  root.PB.Leaderboards = Leaderboards;
  if (typeof module !== 'undefined' && module.exports) module.exports = Leaderboards;
})(typeof globalThis !== 'undefined' ? globalThis : this);
