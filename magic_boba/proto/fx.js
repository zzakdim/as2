// Magic Boba — visual effects: one full-screen canvas for particles + DOM floating text.
// Particles: dot, star, heart, confetti, pearl, ring (shockwave), mote (ambient magic dust).
(function (root) {
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, cx, W = 0, H = 0, dpr = 1;
  const parts = [];
  let running = false;
  // Ambient background particles; each skin picks a type: mote (rising dust), petal (falling, swaying), bubble (rising rings).
  let ambient = { type: 'mote', colors: ['#c9a7ff', '#ffe6a8'], count: 26 };

  function setup() {
    cv = document.createElement('canvas');
    cv.id = 'fx';
    cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 });
    document.body.appendChild(cv);
    cx = cv.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
    spawnAmbient();
    kick();
  }
  function resize() {
    dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function mote(anywhere) {
    const color = ambient.colors[Math.floor(Math.random() * ambient.colors.length)];
    const base = { ambient: true, type: ambient.type, x: Math.random() * W, life: 0, color, g: 0, drag: 1, tw: Math.random() * 6, rot: Math.random() * 6 };
    if (ambient.type === 'petal') return Object.assign(base, { y: anywhere ? Math.random() * H : -12, vx: 4 + Math.random() * 10, vy: 14 + Math.random() * 18,
      size: 3 + Math.random() * 3, max: 14 + Math.random() * 10, vr: (Math.random() - 0.5) * 2, sway: 18, sw: 0.8 + Math.random() });
    if (ambient.type === 'bubble') return Object.assign(base, { y: anywhere ? Math.random() * H : H + 10, vx: 0, vy: -(10 + Math.random() * 22),
      size: 1.5 + Math.random() * 3.5, max: 10 + Math.random() * 10, sway: 6, sw: 1.5 + Math.random() * 2 });
    return Object.assign(base, { type: 'mote', y: anywhere ? Math.random() * H : H + 10, vx: (Math.random() - 0.5) * 6, vy: -(6 + Math.random() * 14),
      size: 1 + Math.random() * 2.2, max: 9 + Math.random() * 8 });
  }
  function spawnAmbient() {
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].ambient) parts.splice(i, 1);
    if (!reduce) for (let i = 0; i < ambient.count; i++) parts.push(mote(true));
    kick();
  }

  function add(p) {
    parts.push(Object.assign({ life: 0, rot: 0, vr: 0, g: 600, drag: 0.985, size: 4 }, p));
    kick();
  }
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        if (p.ambient) parts[i] = mote(false); else parts.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.g * dt;
      p.x += p.vx * dt + (p.sway ? Math.sin(p.life * p.sw + p.tw) * p.sway * dt : 0); p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
      draw(p);
    }
    if (parts.length) requestAnimationFrame(frame); else running = false;
  }

  function draw(p) {
    const k = p.life / p.max;
    const alpha = p.ambient ? Math.sin(Math.PI * k) * (0.35 + 0.25 * Math.sin(p.life * 3 + p.tw)) : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    cx.save();
    cx.globalAlpha = Math.max(0, alpha);
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.fillStyle = p.color;
    const s = p.size * (p.grow ? 1 + k * p.grow : p.type === 'star' ? 1 - k * 0.5 : 1);
    switch (p.type) {
      case 'mote':
        cx.shadowColor = p.color; cx.shadowBlur = 8;
        cx.beginPath(); cx.arc(0, 0, s, 0, 7); cx.fill(); break;
      case 'petal':
        cx.globalAlpha = Math.min(1, alpha * 1.6);
        cx.scale(1, Math.abs(Math.cos(p.life * 1.7 + p.tw)) * 0.6 + 0.4);
        cx.beginPath(); cx.ellipse(0, 0, s * 1.4, s * 0.8, 0, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.45)'; cx.beginPath(); cx.ellipse(-s * 0.4, -s * 0.2, s * 0.5, s * 0.25, 0, 0, 7); cx.fill(); break;
      case 'bubble':
        cx.globalAlpha = Math.min(1, alpha * 1.5);
        cx.strokeStyle = p.color; cx.lineWidth = 1;
        cx.beginPath(); cx.arc(0, 0, s, 0, 7); cx.stroke();
        cx.fillStyle = p.color; cx.globalAlpha *= 0.5; cx.beginPath(); cx.arc(-s * 0.35, -s * 0.35, s * 0.25, 0, 7); cx.fill(); break;
      case 'dot':
      case 'pearl':
        cx.beginPath(); cx.arc(0, 0, s, 0, 7); cx.fill();
        if (p.type === 'pearl') { cx.fillStyle = 'rgba(255,255,255,.35)'; cx.beginPath(); cx.arc(-s * 0.35, -s * 0.35, s * 0.3, 0, 7); cx.fill(); }
        break;
      case 'star': {
        cx.shadowColor = p.color; cx.shadowBlur = 10;
        cx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s, a = (i * Math.PI) / 5 - Math.PI / 2; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        cx.closePath(); cx.fill(); break;
      }
      case 'heart':
        cx.beginPath();
        cx.moveTo(0, s * 0.35);
        cx.bezierCurveTo(-s * 1.1, -s * 0.4, -s * 0.45, -s * 1.1, 0, -s * 0.45);
        cx.bezierCurveTo(s * 0.45, -s * 1.1, s * 1.1, -s * 0.4, 0, s * 0.35);
        cx.fill(); break;
      case 'confetti':
        cx.scale(1, Math.cos(p.life * p.flip));
        cx.fillRect(-s, -s * 0.45, s * 2, s * 0.9); break;
      case 'ring':
        cx.globalAlpha = (1 - k) * 0.8;
        cx.strokeStyle = p.color; cx.lineWidth = 3 * (1 - k) + 0.5;
        cx.beginPath(); cx.arc(0, 0, p.size + k * p.reach, 0, 7); cx.stroke(); break;
    }
    cx.restore();
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const FX = {
    reduce,
    // generic radial burst
    burst(x, y, { colors = ['#fff'], count = 18, speed = 260, types = ['dot', 'star'], size = [2, 5], g = 500, life = [0.5, 1.0], up = 0 } = {}) {
      const n = reduce ? Math.ceil(count / 4) : count;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
        add({ type: pick(types), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g, size: rnd(size[0], size[1]), color: pick(colors),
          max: rnd(life[0], life[1]), vr: rnd(-8, 8), rot: Math.random() * 6, flip: rnd(6, 14) });
      }
    },
    ring(x, y, color = '#fff', reach = 70, size = 8) { add({ type: 'ring', x, y, vx: 0, vy: 0, g: 0, size, reach, color, max: 0.5 }); },
    hearts(x, y, n = 6) {
      for (let i = 0; i < (reduce ? 2 : n); i++) add({ type: 'heart', x: x + rnd(-14, 14), y, vx: rnd(-50, 50), vy: rnd(-160, -90), g: -40, drag: 0.97,
        size: rnd(5, 9), color: pick(['#ff7aa8', '#ff9ec2', '#ffd0e0']), max: rnd(0.9, 1.4), vr: rnd(-1, 1) });
    },
    // falling pearls from a pour lip into a cup
    pearls(x, y0, y1, n, dur) {
      for (let i = 0; i < n; i++) setTimeout(() => add({ type: 'pearl', x: x + rnd(-3, 3), y: y0, vx: rnd(-10, 10), vy: 80, g: 1800, drag: 1,
        size: rnd(3.5, 5), color: '#3a2626', max: Math.sqrt((2 * Math.max(10, y1 - y0)) / 1800) + 0.02 }), (i / n) * dur);
    },
    setAmbient(opts) { Object.assign(ambient, opts); if (cv) spawnAmbient(); },
    confetti(colors = ['#a689e0', '#7cc46a', '#f7b733', '#f47fa4', '#5b8def', '#ffe6a8', '#ffffff']) {
      const n = reduce ? 20 : 140;
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        add({ type: 'confetti', x: left ? -10 : W + 10, y: H * rnd(0.45, 0.85), vx: (left ? 1 : -1) * rnd(250, 700), vy: rnd(-900, -450), g: 900, drag: 0.975,
          size: rnd(3, 6), color: pick(colors), max: rnd(1.6, 2.6), vr: rnd(-12, 12), flip: rnd(6, 16) });
      }
    },
    // DOM text that pops, floats and fades
    text(x, y, str, { color = '#fff', size = 22, rise = 60, dur = 1000, cls = '' } = {}) {
      const el = document.createElement('div');
      el.className = 'floaty ' + cls;
      el.textContent = str;
      Object.assign(el.style, { left: x + 'px', top: y + 'px', color, fontSize: size + 'px' });
      document.body.appendChild(el);
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 },
        { transform: `translate(-50%, calc(-50% - ${rise}px)) scale(1)`, opacity: 0 },
      ], { duration: reduce ? 600 : dur, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
    },
    shake(el, px = 4, dur = 260) {
      if (reduce || !el) return;
      el.animate([0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: `translate(${i === 6 ? 0 : (Math.random() * 2 - 1) * px * (1 - i / 6)}px, ${i === 6 ? 0 : (Math.random() * 2 - 1) * px * (1 - i / 6)}px)` })), { duration: dur });
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
  root.BobaFX = FX;
})(window);
