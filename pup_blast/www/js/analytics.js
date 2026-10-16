// Anonymous gameplay statistics through TelemetryDeck (telemetrydeck.com).
// No names, emails or advertising IDs: each install gets a random ID that is hashed before it is sent,
// so a signal can't be traced back to a person. Signals are batched and sent every few seconds.
// Browser previews and developer mode send as "test mode", which TelemetryDeck keeps apart from real data.
(function (root) {
  'use strict';

  const APP_ID = '071225CF-3667-4288-B2D5-C5F96AD1F6EB';
  const ENDPOINT = 'https://nom.telemetrydeck.com/v2/';
  const UID_KEY = 'pupblast.uid';
  const QUEUE_KEY = 'pupblast.signals';
  const FLUSH_MS = 10000;
  const MAX_QUEUE = 300;

  const store = (() => { try { return root.localStorage; } catch (e) { return null; } })();
  const get = (k) => { try { return store && store.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { if (store) store.setItem(k, v); } catch (e) { /* storage full or blocked */ } };
  const rand = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  async function sha256(text) {
    const subtle = root.crypto && root.crypto.subtle;
    if (!subtle) return text; // no WebCrypto (very old browser): the ID is random anyway
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // One install: a random ID plus the day it started (for "how fast do players progress").
  function install() {
    let rec = null;
    try { rec = JSON.parse(get(UID_KEY) || 'null'); } catch (e) { rec = null; }
    if (!rec || !rec.id) { rec = { id: rand(), since: Date.now() }; set(UID_KEY, JSON.stringify(rec)); }
    return rec;
  }

  // opts: { testMode: () => bool, context: () => ({ key: value }), version }
  function create(opts) {
    const o = opts || {};
    const rec = install();
    const sessionID = rand();
    const userHash = sha256(rec.id + 'pupblast');
    let queue = [];
    try { queue = JSON.parse(get(QUEUE_KEY) || '[]'); } catch (e) { queue = []; }
    let timer = null;
    let sending = false;

    const persist = () => set(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));

    async function flush(keepalive) {
      if (sending || !queue.length || typeof fetch !== 'function') return;
      sending = true;
      const batch = queue.slice(0, 50);
      const clientUser = await userHash;
      const body = batch.map((s) => Object.assign({ appID: APP_ID, clientUser, telemetryClientVersion: 'PupBlast 1' }, s));
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), keepalive: !!keepalive });
        // Sent (or rejected for good): drop them. Network errors keep them for the next try.
        if (res.ok || (res.status >= 400 && res.status < 500)) { queue = queue.slice(batch.length); persist(); }
      } catch (e) { /* offline: try again later */ }
      sending = false;
      if (queue.length) schedule();
    }
    function schedule() { if (!timer) timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS); }

    function track(type, params) {
      const payload = {};
      const add = (k, v) => { if (v !== null && v !== undefined && typeof v !== 'object') payload[`PupBlast.${k}`] = String(v); };
      const ctx = o.context ? o.context() : {};
      Object.entries(ctx).forEach(([k, v]) => add(k, v));
      Object.entries(params || {}).forEach(([k, v]) => add(k, v));
      add('daysSinceInstall', Math.floor((Date.now() - rec.since) / 86400000));
      add('version', o.version);
      const signal = { sessionID, type, payload, receivedAt: new Date().toISOString() };
      if (o.testMode && o.testMode()) signal.isTestMode = true;
      queue.push(signal);
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
      persist();
      schedule();
    }

    // Send what's waiting when the app goes to the background.
    if (root.document) root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden') flush(true); });
    if (queue.length) schedule();
    return { track, flush, installedAt: rec.since };
  }

  root.PB = root.PB || {};
  root.PB.Analytics = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
