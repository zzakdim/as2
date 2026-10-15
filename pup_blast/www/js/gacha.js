// The Pup-a-Matic: capsule pulls, pity counters and duplicate level-ups.
(function (root) {
  'use strict';

  const Pups = root.PB && root.PB.Pups ? root.PB.Pups : require('./pups.js');

  const COST_1 = 100;
  const COST_10 = 900;
  const RATES = { common: 0.62, rare: 0.27, epic: 0.09, legendary: 0.02 };
  const PITY_EPIC = 10; // every 10th pull without an Epic+ is Epic+
  const PITY_LEGENDARY = 60; // every 60th pull without a Legendary is Legendary
  const ORDER = ['common', 'rare', 'epic', 'legendary'];

  // How players get pulls. The weekly pull is the headline; the others keep the gacha fed
  // between weeks. For a strict "one pull a week" game, set BONE_PULLS false and DAILY_AD_PULLS 0.
  const ECONOMY = {
    WEEKLY_FREE_PULLS: 1,
    WEEKLY_MIN_RARITY: 'rare',
    DAILY_AD_PULLS: 1,
    BONE_PULLS: true,
  };

  function rollRarity(rng, pity, minRarity) {
    const rolled = baseRoll(rng, pity);
    return minRarity && ORDER.indexOf(rolled) < ORDER.indexOf(minRarity) ? minRarity : rolled;
  }

  function baseRoll(rng, pity) {
    if (pity.sinceLegendary + 1 >= PITY_LEGENDARY) return 'legendary';
    if (pity.sinceEpic + 1 >= PITY_EPIC) {
      const share = RATES.legendary / (RATES.epic + RATES.legendary);
      return rng() < share ? 'legendary' : 'epic';
    }
    let roll = rng();
    for (const r of ORDER.slice().reverse()) {
      roll -= RATES[r];
      if (roll < 0) return r;
    }
    return 'common';
  }

  // Applies one pull to `state` (mutates collection, pity, bones refund). Returns what was won.
  function pull(state, rng, opts) {
    const rarity = (opts && opts.rarity) || rollRarity(rng, state.pity, opts && opts.minRarity);
    const pool = Pups.ROSTER.filter((p) => p.rarity === rarity);
    const pup = pool[Math.floor(rng() * pool.length)];

    state.pity.sinceEpic = rarity === 'epic' || rarity === 'legendary' ? 0 : state.pity.sinceEpic + 1;
    state.pity.sinceLegendary = rarity === 'legendary' ? 0 : state.pity.sinceLegendary + 1;
    state.stats.pulls++;

    return grant(state, pup);
  }

  // Adds one copy of a specific pup (a dig result, or a gift pup freed from a crate).
  function grant(state, pup) {
    const rarity = pup.rarity;
    const owned = state.pups[pup.id];
    if (!owned) {
      state.pups[pup.id] = { level: 1, dupes: 0 };
      return { pup, rarity, isNew: true, leveledUp: false, refund: 0 };
    }
    const refund = Pups.RARITY[rarity].refund;
    state.bones += refund;
    let leveledUp = false;
    if (owned.level < Pups.MAX_LEVEL) {
      owned.dupes++;
      if (owned.dupes >= Pups.copiesToNext(owned.level, pup.rarity)) { owned.dupes = 0; owned.level++; leveledUp = true; }
    }
    return { pup, rarity, isNew: false, leveledUp, refund, level: owned.level };
  }

  function pullMany(state, rng, count, opts) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(pull(state, rng, opts));
    return out;
  }

  function rarityRank(r) { return ORDER.indexOf(r); }

  const Gacha = { COST_1, COST_10, RATES, ECONOMY, ORDER, PITY_EPIC, PITY_LEGENDARY, rollRarity, pull, pullMany, grant, rarityRank };

  root.PB = root.PB || {};
  root.PB.Gacha = Gacha;
  if (typeof module !== 'undefined' && module.exports) module.exports = Gacha;
})(typeof globalThis !== 'undefined' ? globalThis : this);
