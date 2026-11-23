// Sharing: draws a "brag card" image (a pup, a headline and the App Store name) and opens the phone's
// share sheet with it. In the iOS app this uses the Share and Filesystem plugins; in a browser it falls
// back to the Web Share API where there is one. share() resolves { completed } — true only when the
// player actually sent or saved it (the iOS share sheet reports a cancel as a rejection).
(function (root) {
  'use strict';

  const APP_URL = 'https://apps.apple.com/app/id6826938640';
  const W = 1080, H = 1350; // 4:5, fits Messages, Instagram and most feeds
  const NIGHT = '#1f1b45', DEEP = '#13102e', INK = '#fff7ec', MUTED = '#c9c3ef';

  function plugins() {
    const cap = root.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !cap.Plugins) return null;
    const { Share, Filesystem } = cap.Plugins;
    return Share ? { Share, Filesystem } : null;
  }

  // The pup's SVG as an image the canvas can draw.
  function svgImage(svg) {
    const src = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return new Promise((resolve, reject) => {
      const img = new root.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }

  // Wraps text to at most `lines` lines that fit `maxW`, shrinking the font if it still doesn't fit.
  function fitText(ctx, text, maxW, size, weight, family, lines) {
    for (let s = size; s >= size * 0.55; s -= 2) {
      ctx.font = `${weight} ${s}px ${family}`;
      const words = text.split(/(\s+)/).filter((w) => w.trim());
      const out = [];
      let line = '';
      const cjk = !/\s/.test(text.trim()); // Japanese/Korean lines can break anywhere
      const units = cjk ? [...text] : words;
      for (const u of units) {
        const next = line ? (cjk ? line + u : line + ' ' + u) : u;
        if (ctx.measureText(next).width <= maxW || !line) line = next;
        else { out.push(line); line = u; }
      }
      if (line) out.push(line);
      if (out.length <= lines && out.every((l) => ctx.measureText(l).width <= maxW)) return { size: s, lines: out };
    }
    return { size: size * 0.55, lines: [text] };
  }

  // opts: { pupSvg, headline, sub, kicker, accent, footer }
  async function card(opts) {
    const doc = root.document;
    const canvas = doc.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const accent = opts.accent || '#ff8fab';
    const display = "'Fredoka', 'Hiragino Maru Gothic ProN', 'Apple SD Gothic Neo', sans-serif";
    const body = "'Nunito', 'Hiragino Maru Gothic ProN', 'Apple SD Gothic Neo', sans-serif";
    const logo = "'Gluten', 'Fredoka', sans-serif";
    try { await Promise.all(['700 80px Fredoka', '800 40px Nunito', '800 80px Gluten'].map((f) => doc.fonts.load(f))); } catch (e) { /* draw with fallbacks */ }

    // Night sky with a glow in the pup's rarity color, sunburst rays and a few stars.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2c2763'); bg.addColorStop(0.6, NIGHT); bg.addColorStop(1, DEEP);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = 520;
    ctx.save();
    ctx.translate(cx, cy);
    for (let k = 0; k < 16; k++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, -900); ctx.lineTo(70, -900); ctx.closePath();
      ctx.fillStyle = accent + (k % 2 ? '14' : '0a'); ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 460);
    glow.addColorStop(0, accent + '66'); glow.addColorStop(1, accent + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 40; k++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * 760, 1.5 + rnd() * 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The pup.
    if (opts.pupSvg) {
      try {
        const img = await svgImage(opts.pupSvg);
        const size = 660;
        ctx.drawImage(img, cx - size / 2, cy - size / 2 - 10, size, size);
      } catch (e) { /* card still works without art */ }
    }

    // Kicker chip (a rarity, "New best!").
    let y = 900;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (opts.kicker) {
      ctx.font = `800 34px ${display}`;
      const kw = ctx.measureText(opts.kicker.toUpperCase()).width + 64;
      ctx.fillStyle = accent;
      roundRect(ctx, cx - kw / 2, y - 30, kw, 60, 30); ctx.fill();
      ctx.fillStyle = '#2a1630'; ctx.fillText(opts.kicker.toUpperCase(), cx, y + 2);
      y += 80;
    }
    // Headline and sub line.
    const head = fitText(ctx, opts.headline, W - 140, 84, 700, display, 2);
    ctx.font = `700 ${head.size}px ${display}`;
    ctx.fillStyle = INK;
    head.lines.forEach((l, k) => {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillText(l, cx, y + k * head.size * 1.08 + 6);
      ctx.fillStyle = INK; ctx.fillText(l, cx, y + k * head.size * 1.08);
    });
    y += head.lines.length * head.size * 1.08 + 10;
    if (opts.sub) {
      const sub = fitText(ctx, opts.sub, W - 160, 40, 800, body, 2);
      ctx.font = `800 ${sub.size}px ${body}`;
      ctx.fillStyle = MUTED;
      sub.lines.forEach((l, k) => ctx.fillText(l, cx, y + k * sub.size * 1.2));
    }

    // Footer: the game's name, where to get it.
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, H - 150, W, 150);
    ctx.font = `800 64px ${logo}`;
    ctx.fillStyle = '#ffd9a8'; ctx.fillText('Pup', cx - 100, H - 78);
    ctx.fillStyle = '#ff8fab'; ctx.fillText('Blast', cx + 80, H - 78);
    if (opts.footer) {
      ctx.font = `800 30px ${body}`;
      ctx.fillStyle = MUTED; ctx.fillText(opts.footer, cx, H - 30);
    }
    return canvas.toDataURL('image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Opens the share sheet. { title, text, image (a PNG data URL) }. Never throws.
  async function share({ title, text, image }) {
    const native = plugins();
    try {
      if (native) {
        const files = [];
        if (image && native.Filesystem) {
          const written = await native.Filesystem.writeFile({ path: 'pup-blast-card.png', data: image.split(',')[1], directory: 'CACHE' });
          files.push(written.uri);
        }
        const res = await native.Share.share({ title, text, url: APP_URL, files: files.length ? files : undefined, dialogTitle: title });
        return { completed: true, activity: (res && res.activityType) || '' };
      }
      const nav = root.navigator;
      if (nav && nav.share) {
        const data = { title, text, url: APP_URL };
        if (image && nav.canShare) {
          const blob = await (await root.fetch(image)).blob();
          const file = new root.File([blob], 'pup-blast-card.png', { type: 'image/png' });
          if (nav.canShare({ files: [file] })) data.files = [file];
        }
        await nav.share(data);
        return { completed: true, activity: 'web' };
      }
      return { completed: false, unavailable: true };
    } catch (e) {
      return { completed: false, error: String((e && e.message) || e) };
    }
  }

  const ShareKit = { APP_URL, card, share };
  root.PB = root.PB || {};
  root.PB.Share = ShareKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = ShareKit;
})(typeof globalThis !== 'undefined' ? globalThis : this);
