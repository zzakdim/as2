// Magic Boba — procedural audio. Every sound is synthesised live with Web Audio (no files).
//
// Design notes (why it sounds the way it does):
//  * One musical key. All tonal SFX snap to F-major pentatonic (F G A C D), the same key as the
//    music, so overlapping sounds never clash — every action "plays along" with the track.
//  * Filling = rising pitch. A pour's resonance follows the air column left in the cup
//    (quarter-wave: f ∝ 1 / air length), so pitch climbs as the cup fills — the sound people know
//    from filling a bottle. Each poured layer also plucks the next note of the scale.
//  * Bubbles use the classic synthesised bubble: a sine whose pitch sweeps up fast while it
//    decays (cf. Minnaert resonance; A. Farnell, "Designing Sound").
//  * Glass uses inharmonic partials (≈1, 2.76, 5.4, 8.9 × f) so clinks read as glass, not beeps.
//  * Escalation. Consecutive successes climb the scale (the Peggle/Candy Crush trick); finishing
//    sounds are brighter and longer than routine ones, so the big moments stand out.
//  * Anti-fatigue. Small random pitch/time jitter on every repeat so nothing sounds copy-pasted.
//  * Gentle failure. A wrong move is a soft muted "bonk", never a buzzer.
//  * Mix. Compressor on the master, a generated reverb for sparkle, and the music ducks under
//    big rewards (side-chain style) so they cut through.
//  * Music is scheduled with a look-ahead clock (C. Wilson, "A Tale of Two Clocks") for tight
//    timing.
(function (root) {
  const PENTA = [0, 2, 4, 7, 9];
  const ROOT = 349.23; // F4
  const hz = (step) => {
    const o = Math.floor(step / 5), d = ((step % 5) + 5) % 5;
    return ROOT * Math.pow(2, (PENTA[d] + 12 * o) / 12);
  };
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const jitter = (c = 8) => Math.pow(2, ((Math.random() * 2 - 1) * c) / 1200);

  let ctx = null, master, sfx, music, wetIn, noiseBuf, duckGain, meterNode;
  let sfxOn = true, musicOn = true;
  try { sfxOn = localStorage.getItem('boba.sfx') !== '0'; musicOn = localStorage.getItem('boba.music') !== '0'; } catch {}

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    meterNode = ctx.createAnalyser(); meterNode.fftSize = 2048; comp.connect(meterNode); // for tests / debugging

    const verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 3);
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    wetIn = ctx.createGain(); wetIn.connect(verb); verb.connect(wet); wet.connect(master);

    sfx = ctx.createGain(); sfx.gain.value = sfxOn ? 1 : 0; sfx.connect(master);
    duckGain = ctx.createGain(); duckGain.gain.value = 1;
    music = ctx.createGain(); music.gain.value = musicOn ? 0.55 : 0;
    music.connect(duckGain); duckGain.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---- primitives -----------------------------------------------------------------------
  // Plays an oscillator with an attack/exponential-decay envelope. `rev` = reverb send 0..1.
  function tone({ f, f2, glide = 0.05, type = 'sine', t = 0, a = 0.004, dur = 0.3, g = 0.3, rev = 0.2, bus, pan = 0, detune = 0 }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + glide);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(g, now + a);
    e.gain.exponentialRampToValueAtTime(0.0001, now + a + dur);
    let node = e;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; e.connect(p); node = p; }
    o.connect(e);
    node.connect(bus || sfx);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(wetIn); }
    o.start(now); o.stop(now + a + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.1, g = 0.2, type = 'bandpass', f = 1000, f2, Q = 1, a = 0.005, rev = 0, bus, shape = 'exp' }) {
    const now = ctx.currentTime + t;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = Q;
    flt.frequency.setValueAtTime(f, now);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, now);
    e.gain.exponentialRampToValueAtTime(g, now + a);
    if (shape === 'hold') { e.gain.setValueAtTime(g, now + dur * 0.8); e.gain.exponentialRampToValueAtTime(0.0001, now + dur); }
    else e.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt); flt.connect(e); e.connect(bus || sfx);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; e.connect(s); s.connect(wetIn); }
    src.start(now, Math.random() * 1.5); src.stop(now + dur + 0.05);
  }

  // Glass: inharmonic partials with faster decay up high.
  function glass(f, t = 0, g = 0.22, rev = 0.25, pan = 0) {
    const P = [[1, 1, 0.55], [2.76, 0.45, 0.32], [5.4, 0.22, 0.18], [8.93, 0.1, 0.1]];
    const j = jitter(10);
    for (const [r, gg, dd] of P) tone({ f: f * r * j, t, a: 0.002, dur: dd, g: g * gg, rev, pan });
  }

  // Bell / chime: near-harmonic partials, long tail.
  function bell(f, t = 0, g = 0.2, dur = 1.1, rev = 0.45) {
    tone({ f, t, a: 0.003, dur, g, rev });
    tone({ f: f * 2.0, t, a: 0.003, dur: dur * 0.6, g: g * 0.35, rev });
    tone({ f: f * 3.01, t, a: 0.002, dur: dur * 0.35, g: g * 0.15, rev });
    tone({ f: f * 4.2, t, a: 0.002, dur: dur * 0.15, g: g * 0.08, rev });
  }

  function bubble(f, t = 0, g = 0.12) {
    tone({ f, f2: f * (1.8 + Math.random() * 0.8), glide: 0.035 + Math.random() * 0.03, t, a: 0.002, dur: 0.06, g, rev: 0.1, pan: Math.random() * 0.6 - 0.3 });
  }

  function sparkle(t = 0, count = 6, base = 18, g = 0.05) {
    for (let i = 0; i < count; i++) tone({ f: hz(base + Math.floor(Math.random() * 6)) * jitter(15), t: t + i * 0.045 + Math.random() * 0.03, a: 0.002, dur: 0.25, g, rev: 0.7, pan: Math.random() * 1.4 - 0.7 });
  }

  function duck(amount = 0.35, hold = 0.5) {
    const now = ctx.currentTime, p = duckGain.gain;
    p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(amount, now + 0.04);
    p.setValueAtTime(amount, now + hold);
    p.linearRampToValueAtTime(1, now + hold + 0.6);
  }

  // Haptics only after the first touch (browsers block it before), and only where supported.
  const vibrate = (p) => { if (!ctx) return; try { navigator.vibrate && navigator.vibrate(p); } catch {} };
  const ready = () => ctx && ctx.state === 'running';

  // ---- game sounds ---------------------------------------------------------------------
  const S = {
    hz,
    unlock() {
      if (!init()) return;
      if (ctx.state !== 'running') ctx.resume();
      if (musicOn) Music.start();
    },
    // Peak output level right now (0..1) — used by automated tests to prove sound is playing.
    meter() {
      if (!meterNode) return 0;
      const d = new Float32Array(meterNode.fftSize); meterNode.getFloatTimeDomainData(d);
      return d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setSfx(on) {
      sfxOn = on; try { localStorage.setItem('boba.sfx', on ? '1' : '0'); } catch {}
      if (ctx) sfx.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
    },
    setMusic(on) {
      musicOn = on; try { localStorage.setItem('boba.music', on ? '1' : '0'); } catch {}
      if (!ctx) return;
      music.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.15);
      if (on) Music.start();
    },

    select(level = 0) { // lifting a cup: glass clink pitched by how full it is
      vibrate(8);
      if (!ready()) return;
      glass(hz(12 + level), 0, 0.2);
      noise({ dur: 0.05, g: 0.05, type: 'highpass', f: 3000 });
    },
    deselect() {
      if (!ready()) return;
      glass(hz(9), 0, 0.12, 0.15);
    },

    // amount: layers moving. from: dest fill level before. cap: dest capacity.
    pour(amount, from, cap, solid, unitMs) {
      vibrate([12, 30, 12]);
      if (!ready()) return;
      const U = unitMs / 1000;
      const res = (lvl) => 260 * cap / Math.max(0.6, cap - lvl + 0.4);
      if (!solid) {
        // the stream: band-passed noise whose resonance rises as the air column shortens
        const now = ctx.currentTime, total = amount * U + 0.08;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
        bp.frequency.setValueAtTime(res(from), now);
        bp.frequency.exponentialRampToValueAtTime(res(from + amount), now + total);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0.0001, now);
        e.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
        e.gain.setValueAtTime(0.22, now + total - 0.06);
        e.gain.exponentialRampToValueAtTime(0.0001, now + total + 0.05);
        src.connect(bp); bp.connect(lp); lp.connect(e); e.connect(sfx);
        src.start(now); src.stop(now + total + 0.1);
        // glugs + bubbles
        for (let u = 0; u < amount; u++) {
          const base = res(from + u + 0.5);
          tone({ f: base * 0.5, f2: base * 0.75, glide: 0.06, t: u * U + 0.02, a: 0.005, dur: 0.07, g: 0.12, rev: 0.05 });
          for (let b = 0; b < 4; b++) bubble(base * (1.2 + Math.random()), u * U + Math.random() * U, 0.06);
        }
      } else {
        // pearls: soft rubbery plops that sink
        for (let u = 0; u < amount; u++) for (let k = 0; k < 4; k++) {
          const t = u * U + k * (U / 4) + Math.random() * 0.02;
          tone({ f: 230 * jitter(80), f2: 95, glide: 0.07, t, a: 0.003, dur: 0.09, g: 0.12, rev: 0.05 });
          noise({ t, dur: 0.02, g: 0.04, type: 'highpass', f: 2500 });
        }
      }
      // the musical layer: each poured layer plucks the next note up the scale
      for (let u = 0; u < amount; u++) {
        const step = 5 + from + u;
        tone({ f: hz(step), t: u * U + 0.03, type: 'triangle', a: 0.004, dur: 0.28, g: 0.13, rev: 0.3 });
        tone({ f: hz(step) * 2, t: u * U + 0.03, a: 0.003, dur: 0.12, g: 0.04, rev: 0.3 });
      }
    },

    // a cup becomes complete. streak climbs the scale.
    complete(streak = 0) {
      vibrate([20, 40, 30]);
      if (!ready()) return;
      duck(0.4, 0.4);
      // cork/lid pop
      noise({ dur: 0.03, g: 0.25, type: 'bandpass', f: 1800, Q: 0.8 });
      tone({ f: 760, f2: 240, glide: 0.06, a: 0.002, dur: 0.08, g: 0.25, rev: 0.05 });
      const s = 10 + Math.min(streak, 8) * 2;
      [0, 2, 4].forEach((d, i) => bell(hz(s + d), 0.07 + i * 0.075, 0.16, 0.9));
      sparkle(0.25, 6 + streak, s + 5);
    },

    // a customer's order is finished
    serve(streak = 0) {
      vibrate([15, 30, 15, 30, 40]);
      if (!ready()) return;
      duck(0.35, 0.6);
      noise({ dur: 0.03, g: 0.2, type: 'bandpass', f: 1600, Q: 0.8 });
      const s = 12 + Math.min(streak, 8) * 2;
      bell(hz(s), 0.05, 0.2, 1.2);
      bell(hz(s + 2), 0.16, 0.2, 1.4);
      // the customer's happy "yay!"
      tone({ f: 520, f2: 980, glide: 0.09, t: 0.25, type: 'triangle', a: 0.01, dur: 0.12, g: 0.1, rev: 0.1 });
      tone({ f: 700, f2: 1300, glide: 0.08, t: 0.38, type: 'triangle', a: 0.01, dur: 0.14, g: 0.09, rev: 0.1 });
      sparkle(0.3, 8, s + 6);
    },

    invalid() {
      vibrate(30);
      if (!ready()) return;
      tone({ f: 150, f2: 95, glide: 0.1, a: 0.004, dur: 0.14, g: 0.17, rev: 0 });
      tone({ f: 118, f2: 80, glide: 0.1, t: 0.09, a: 0.004, dur: 0.14, g: 0.11, rev: 0 });
    },

    undo() {
      vibrate(10);
      if (!ready()) return;
      noise({ dur: 0.18, g: 0.1, type: 'bandpass', f: 2600, f2: 500, Q: 2 });
      glass(hz(7), 0.08, 0.08, 0.1);
    },

    vial() { // magic glissando
      vibrate([10, 20, 10, 20, 10, 20, 40]);
      if (!ready()) return;
      duck(0.3, 0.8);
      for (let i = 0; i < 10; i++) tone({ f: hz(8 + i), t: i * 0.035, type: 'triangle', a: 0.003, dur: 0.35, g: 0.1, rev: 0.6, pan: (i / 10) * 1.2 - 0.6 });
      noise({ t: 0, dur: 0.45, g: 0.06, type: 'highpass', f: 5000, rev: 0.6 });
      bell(hz(18), 0.38, 0.15, 1.4);
    },

    praise(streak) { // little whoosh under the praise text
      if (!ready()) return;
      noise({ dur: 0.22, g: 0.05, type: 'bandpass', f: 600, f2: 3200, Q: 1.5, rev: 0.3 });
    },

    hop(i) { // victory lap: cups hop one by one up the scale
      vibrate(6);
      if (!ready()) return;
      tone({ f: hz(10 + i), type: 'triangle', a: 0.003, dur: 0.22, g: 0.12, rev: 0.35 });
      glass(hz(15 + i), 0, 0.06, 0.3);
    },

    win() {
      vibrate([30, 60, 30, 60, 80]);
      if (!ready()) return;
      duck(0.25, 2.2);
      const chord = [0, 2, 3, 5, 7, 8, 10]; // F A C F A C F (scale steps)
      chord.forEach((d, i) => tone({ f: hz(5 + d), t: i * 0.06, type: 'triangle', a: 0.005, dur: 0.9, g: 0.17, rev: 0.5 }));
      chord.forEach((d, i) => bell(hz(10 + d), i * 0.06, 0.07, 0.8));
      [0, 2, 3].forEach((d) => tone({ f: hz(d) / 2, t: 0.42, type: 'sine', a: 0.08, dur: 2.2, g: 0.16, rev: 0.4 }));
      [0, 2, 3, 5].forEach((d) => tone({ f: hz(5 + d), t: 0.42, type: 'triangle', a: 0.12, dur: 2.0, g: 0.05, rev: 0.7, detune: (d % 2 ? 6 : -6) }));
      noise({ t: 0.42, dur: 0.6, g: 0.05, type: 'highpass', f: 6000, rev: 0.5 });
    },

    star(n) { // n = 0,1,2 — each higher, last one biggest
      vibrate(n === 2 ? [30, 30, 60] : 25);
      if (!ready()) return;
      const s = 15 + n * 2;
      bell(hz(s), 0, 0.22, 1.3);
      if (n === 2) { bell(hz(s + 5), 0.06, 0.12, 1.6); sparkle(0.1, 10, s + 4, 0.06); }
      else sparkle(0.05, 4, s + 3);
    },

    coin(i) { // count-up ticks, slowly rising
      if (!ready()) return;
      tone({ f: hz(15 + Math.min(i, 12)) * 2, a: 0.001, dur: 0.06, g: 0.05, rev: 0.1 });
      tone({ f: hz(15 + Math.min(i, 12)) * 3, a: 0.001, dur: 0.04, g: 0.02, rev: 0.1 });
    },

    golden() { // rare golden tip: the jackpot sound
      vibrate([40, 40, 40, 40, 120]);
      if (!ready()) return;
      duck(0.2, 1.5);
      for (let i = 0; i < 14; i++) tone({ f: hz(10 + i), t: i * 0.04, type: 'square', a: 0.003, dur: 0.1, g: 0.035, rev: 0.4 });
      [0, 2, 4, 5].forEach((d, i) => bell(hz(18 + d), 0.55 + i * 0.09, 0.14, 1.6));
      sparkle(0.6, 16, 20, 0.05);
    },

    tap() { // UI buttons
      vibrate(5);
      if (!ready()) return;
      tone({ f: hz(10), f2: hz(11), glide: 0.03, a: 0.002, dur: 0.05, g: 0.06, rev: 0 });
    },

    customer() { // a new customer arrives: little door bell
      if (!ready()) return;
      glass(hz(17), 0, 0.07, 0.4, 0.4);
      glass(hz(15), 0.09, 0.06, 0.4, 0.4);
    },
  };

  // ---- generative lo-fi music ------------------------------------------------------------
  // 80 BPM, swung 8ths. Fmaj7 – Dm9 – Bbmaj7 – C6. Soft keys, round bass, brushed kit, vinyl dust.
  const Music = (() => {
    const BPM = 80, SPB = 60 / BPM, SWING = 0.58;
    const CHORDS = [
      { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
      { bass: 38, notes: [50, 53, 57, 64] }, // Dm9 (no root)
      { bass: 46, notes: [50, 53, 57, 62] }, // Bbmaj7
      { bass: 36, notes: [52, 55, 57, 60] }, // C6
    ];
    let running = false, timer = null, nextTime = 0, step = 0;

    function keys(m, t, len, g) {
      const f = midi(m);
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.02);
        e.gain.exponentialRampToValueAtTime(g * 0.4, t + 0.4); e.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(lp); lp.connect(e); e.connect(music);
        const s = ctx.createGain(); s.gain.value = 0.35; e.connect(s); s.connect(wetIn);
        o.start(t); o.stop(t + len + 0.05);
      }
    }
    function bass(m, t, len) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(m);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      e.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(e); e.connect(music); o.start(t); o.stop(t + len + 0.05);
    }
    function kick(t) {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const e = ctx.createGain(); e.gain.setValueAtTime(0.32, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(e); e.connect(music); o.start(t); o.stop(t + 0.32);
    }
    function hit(t, f, dur, g, type = 'highpass') {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f;
      const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(flt); flt.connect(e); e.connect(music); src.start(t, Math.random()); src.stop(t + dur + 0.02);
    }
    // a simple melodic fragment over the loop, from the same pentatonic scale
    const MELODY = [null, 12, null, 11, 10, null, null, null, null, 10, null, 8, 9, null, null, null,
                    null, 13, null, 12, 11, null, 10, null, null, null, 8, null, 7, null, null, null];

    function schedule(t, s) {
      const bar = Math.floor(s / 8) % 4, beat8 = s % 8;
      const ch = CHORDS[bar];
      if (beat8 === 0) { ch.notes.forEach((n, i) => keys(n, t + i * 0.012, SPB * 3.6, 0.045)); bass(ch.bass, t, SPB * 1.8); }
      if (beat8 === 5) ch.notes.slice(1).forEach((n) => keys(n, t, SPB * 1.4, 0.03));
      if (beat8 === 4) bass(ch.bass + 7, t, SPB * 1.2);
      if (beat8 === 0 || beat8 === 5) kick(t);
      if (beat8 === 2 || beat8 === 6) hit(t, 1800, 0.12, 0.07, 'bandpass'); // brushed snare
      hit(t, 7000, 0.04, beat8 % 2 ? 0.025 : 0.04); // hats
      const mel = MELODY[s % 32];
      if (mel !== null && Math.floor(s / 32) % 2 === 1) tone({ f: hz(mel), t: t - ctx.currentTime, type: 'sine', a: 0.01, dur: 0.5, g: 0.05, rev: 0.5, bus: music });
      if (Math.random() < 0.3) hit(t + Math.random() * SPB, 3000 + Math.random() * 4000, 0.01, 0.012 + Math.random() * 0.01); // vinyl dust
    }
    function tick() {
      while (nextTime < ctx.currentTime + 0.15) {
        const swingOffset = step % 2 ? (SWING - 0.5) * SPB : 0;
        schedule(nextTime + swingOffset, step);
        nextTime += SPB / 2;
        step++;
      }
    }
    return {
      start() {
        if (running || !ctx) return;
        running = true; nextTime = ctx.currentTime + 0.1; step = 0;
        timer = setInterval(tick, 25);
      },
    };
  })();

  root.BobaAudio = S;
})(window);
