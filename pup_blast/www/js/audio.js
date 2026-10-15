// Tiny synthesized sound kit and haptics. No audio files to ship.
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;
  let hapticsOn = true;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (AC) ctx = new AC();
  }

  function tone(freq, start, dur, type, gain, slideTo) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(start, dur, gain, freq) {
    if (!ctx || !enabled) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + start);
  }

  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319];

  const sfx = {
    pick() { tone(660, 0, 0.06, 'triangle', 0.08); },
    place() { tone(330, 0, 0.09, 'triangle', 0.14, 220); },
    nope() { tone(180, 0, 0.12, 'square', 0.05, 140); },
    clear(lines, combo) {
      const n = Math.min(2 + lines + combo, NOTES.length);
      for (let i = 0; i < n; i++) tone(NOTES[i], i * 0.05, 0.14, 'triangle', 0.1);
    },
    woof() {
      tone(420, 0, 0.09, 'sawtooth', 0.09, 260);
      tone(380, 0.12, 0.11, 'sawtooth', 0.09, 220);
    },
    coin() { tone(988, 0, 0.06, 'square', 0.05); tone(1319, 0.06, 0.12, 'square', 0.05); },
    rattle() { for (let i = 0; i < 6; i++) tone(240 + (i % 2) * 60, i * 0.07, 0.05, 'square', 0.04); },
    reveal(rank) {
      const base = [0, 2, 4, 7, 9, 12, 16];
      const n = 3 + rank * 1;
      for (let i = 0; i < n; i++) tone(523 * Math.pow(2, base[i % base.length] / 12), i * 0.08, 0.22, 'triangle', 0.1);
    },
    // Dig sequence
    dig() { noise(0, 0.18, 0.4, 900); tone(150, 0, 0.09, 'sine', 0.12, 80); },
    sniff() { noise(0, 0.06, 0.18, 3500); noise(0.1, 0.06, 0.18, 3500); noise(0.2, 0.08, 0.2, 3000); },
    // Pull sequence
    tick() { tone(1400, 0, 0.025, 'square', 0.03); },
    thunk() { tone(140, 0, 0.16, 'sine', 0.22, 70); tone(900, 0, 0.03, 'triangle', 0.05); },
    upgrade(step) {
      const base = 392 * Math.pow(2, step * 4 / 12);
      tone(base, 0, 0.18, 'triangle', 0.11); tone(base * 1.5, 0.06, 0.2, 'triangle', 0.08);
    },
    pop() { tone(300, 0, 0.12, 'sawtooth', 0.08, 900); tone(1600, 0.02, 0.08, 'triangle', 0.06, 2400); },
    ding(i) { tone(1047 * Math.pow(2, (i * 2) / 12), 0, 0.16, 'triangle', 0.08); },
    stamp() { tone(110, 0, 0.12, 'square', 0.1, 60); },
    fanfare(rank) {
      const seq = [0, 4, 7, 12, 16, 19];
      for (let i = 0; i < 3 + rank; i++) tone(523 * Math.pow(2, seq[i % seq.length] / 12), 0.1 + i * 0.09, 0.26, 'triangle', 0.09);
    },
    gameOver() { [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.24, 'triangle', 0.1)); },
  };

  function haptic(style) {
    if (!hapticsOn) return;
    const h = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Haptics;
    if (h) { h.impact({ style: style || 'LIGHT' }).catch(() => {}); return; }
    if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(style === 'HEAVY' ? 30 : 10);
  }

  root.PB = root.PB || {};
  root.PB.Audio = {
    unlock, sfx, haptic,
    setSound(on) { enabled = on; },
    setHaptics(on) { hapticsOn = on; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
