// Tiny synthesized sound kit, a generated music loop and haptics. No audio files to ship.
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;
  let hapticsOn = true;

  let musicOn = true;
  let sfxBus = null, musicBus = null, verb = null;

  // Everything runs through one mix: effects and music each get a volume, share a little room
  // reverb for warmth, and a limiter keeps stacked sounds (a big combo over the music) from clipping.
  function build() {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 6;
    limiter.attack.value = 0.003; limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(limiter);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(limiter);
    // A short synthetic room: decaying noise as the impulse.
    const len = Math.floor(ctx.sampleRate * 1.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    verb.connect(wet).connect(limiter);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.5; sfxBus.connect(sfxSend).connect(verb);
    const musicSend = ctx.createGain(); musicSend.gain.value = 0.9; musicBus.connect(musicSend).connect(verb);
  }

  function unlock() {
    // Any touch wakes the audio again, also after iOS interrupts it (a call, Siri) and leaves it 'interrupted'.
    if (ctx) { if (ctx.state !== 'running' && live()) ctx.resume().catch(() => {}); startMusic(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ctx.onstatechange = () => { if (ctx.state === 'running') startMusic(); };
    build();
    startMusic();
  }

  // Nothing is queued while the audio is stopped (an ad, the background): it would all play at once on return.
  const audible = () => ctx && enabled && !paused && ctx.state === 'running';
  function tone(freq, start, dur, type, gain, slideTo) {
    if (!audible()) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(start, dur, gain, freq) {
    if (!audible()) return;
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
    src.connect(f).connect(g).connect(sfxBus);
    src.start(ctx.currentTime + start);
  }

  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319];

  const sfx = {
    tap() { tone(520, 0, 0.045, 'sine', 0.05, 700); }, // any button
    pick() { tone(660, 0, 0.06, 'triangle', 0.08); tone(1320, 0, 0.04, 'sine', 0.025); },
    // A soft wooden knock: a low thump under the click.
    place() { tone(330, 0, 0.09, 'triangle', 0.13, 220); tone(110, 0, 0.11, 'sine', 0.16, 70); noise(0, 0.03, 0.07, 2400); },
    nope() { tone(180, 0, 0.12, 'square', 0.05, 140); },
    clear(lines, combo) {
      const n = Math.min(2 + lines + combo, NOTES.length);
      // A rising run with a bell an octave up on each note, and a low swell under bigger clears.
      for (let i = 0; i < n; i++) { tone(NOTES[i], i * 0.05, 0.16, 'triangle', 0.09); tone(NOTES[i] * 2, i * 0.05, 0.3, 'sine', 0.03); }
      if (lines + combo > 1) tone(131, 0, 0.45, 'sine', 0.1, 196);
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
    gameOver() { [392, 330, 262].forEach((f, i) => { tone(f, i * 0.16, 0.3, 'triangle', 0.1); tone(f / 2, i * 0.16, 0.4, 'sine', 0.06); }); },
  };

  function haptic(style) {
    if (!hapticsOn) return;
    const h = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Haptics;
    if (h) { h.impact({ style: style || 'LIGHT' }).catch(() => {}); return; }
    if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(style === 'HEAVY' ? 30 : 10);
  }

  // ---- Music: a quiet generated loop. Four soft chords, a bass note per bar and a wandering
  // pentatonic melody that never repeats exactly. Each place has its own key, tempo and mood.
  const THEMES = {
    home: { root: 60, bpm: 76, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 16]], density: 0.45 },
    w1: { root: 65, bpm: 72, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 16]], density: 0.4 }, // living room: warm, slow
    w2: { root: 67, bpm: 88, chords: [[0, 4, 7, 9], [5, 9, 12, 14], [7, 11, 14, 16], [0, 4, 7, 11]], density: 0.6 }, // dog park: bright, bouncy
    w3: { root: 62, bpm: 84, chords: [[0, 4, 7, 11], [2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 9]], density: 0.55 }, // beach: breezy
    w4: { root: 57, bpm: 66, chords: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 19]], density: 0.35 }, // snowy hill: minor, sparse
    w5: { root: 63, bpm: 78, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [8, 12, 15, 19], [10, 14, 17, 20]], density: 0.5 }, // autumn: mellow minor
  };
  const MUSIC_LEVEL = 0.8;
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  let theme = 'home', bar = 0, nextBar = 0, timer = 0, paused = false, lastStep = 2;

  // One note of the music: a gain envelope into the music mix.
  function voice(freq, t, dur, type, gain, attack) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function scheduleBar(t) {
    const th = THEMES[theme] || THEMES.home;
    const beat = 60 / th.bpm;
    const chord = th.chords[bar % th.chords.length];
    // Pad: the chord, soft and slow, an octave below the melody.
    chord.forEach((n, i) => voice(hz(th.root - 12 + n), t, beat * 4.4, i % 2 ? 'sine' : 'triangle', 0.028, beat * 0.9));
    // Bass on the first beat, and a lighter touch on the third.
    voice(hz(th.root - 24 + chord[0]), t, beat * 2.2, 'sine', 0.085, 0.02);
    voice(hz(th.root - 24 + chord[0]), t + beat * 2, beat * 1.6, 'sine', 0.045, 0.02);
    // Melody: steps through the chord's notes (plus the octave), mostly moving to a neighbour.
    const pool = [...chord, chord[0] + 12, chord[1] + 12];
    for (let k = 0; k < 8; k++) {
      const strong = k % 2 === 0;
      if (Math.random() > th.density * (strong ? 1.25 : 0.7)) continue;
      lastStep = Math.max(0, Math.min(pool.length - 1, lastStep + [-1, -1, 0, 1, 1, 2, -2][Math.floor(Math.random() * 7)]));
      const at = t + k * beat * 0.5;
      voice(hz(th.root + pool[lastStep]), at, beat * 1.3, 'triangle', strong ? 0.05 : 0.036, 0.008);
      voice(hz(th.root + 12 + pool[lastStep]), at, beat * 0.8, 'sine', 0.012, 0.008);
    }
    bar++;
    return beat * 4;
  }

  function pump() {
    if (!ctx || !musicOn || !enabled || paused) return;
    if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.08; // after a pause, pick up from now
    while (nextBar < ctx.currentTime + 0.7) nextBar += scheduleBar(nextBar);
  }
  function fade(to, secs) {
    if (!musicBus) return;
    const g = musicBus.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + secs);
  }
  function startMusic() {
    if (!ctx || timer || !musicOn || !enabled || paused) return;
    fade(MUSIC_LEVEL, 1.6);
    pump();
    timer = setInterval(pump, 200);
  }
  function stopMusic() {
    clearInterval(timer); timer = 0;
    fade(0, 0.4);
  }
  // Ads and a backgrounded app go quiet: the whole audio clock stops, so nothing plays over a video.
  // Two separate reasons ('ad', 'hidden'): coming back to the app mid-ad must not restart the sound.
  const reasons = { ad: false, hidden: false };
  let suspendTimer = 0;
  const live = () => enabled && !paused;
  function sync() {
    if (!ctx) return;
    clearTimeout(suspendTimer);
    if (!live()) {
      stopMusic();
      // A beat later, so the tap that opened the ad is heard before the clock stops.
      suspendTimer = setTimeout(() => { if (!live()) ctx.suspend().catch(() => {}); }, 90);
    } else { ctx.resume().catch(() => {}); startMusic(); }
  }
  function setPaused(reason, on) {
    reasons[reason] = !!on;
    paused = reasons.ad || reasons.hidden;
    sync();
  }

  root.PB = root.PB || {};
  root.PB.Audio = {
    unlock, sfx, haptic,
    setSound(on) { enabled = on; sync(); }, // off also stops the audio clock, to save battery
    setMusic(on) { musicOn = on; if (on) startMusic(); else stopMusic(); },
    // Which place the music is for: 'home' or a world id. The next bar plays in its key and tempo.
    setTheme(name) { theme = THEMES[name] ? name : 'home'; },
    setPaused, THEMES,
    setHaptics(on) { hapticsOn = on; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
