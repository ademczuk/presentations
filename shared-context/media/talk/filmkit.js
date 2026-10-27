// filmkit.js: what the 18 Nov night films share (night.html, horde.html, fight.html). The world and the player are
// altitude.html's, so the deck drives these films exactly as it drives Altitude: ?deck plays once and holds at
// HOLD (?to=), ?from= starts there, a 'play' message starts it, 'end' jumps to the hold frame, window.seek/render.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const K = window.FilmKit = {};
  K.clamp01 = x => Math.min(1, Math.max(0, x));
  K.seg = (t, a, b) => K.clamp01((t - a) / (b - a));
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.eo = x => 1 - Math.pow(1 - x, 3);
  K.ei = x => x * x * x;
  K.eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  K.fx = n => n.toFixed(1);
  K.rng = function (s) { let a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  K.mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  K.$ = id => document.getElementById(id);
  K.GREEN = '#3ddc84';
  K.GREY = '#8d949e';

  // ---------- the camera (altitude.html's projection, one fixed view per film plus a slow drift) ----------
  const F = 1150;
  K.camera = function (v, t) {
    const c = { tx: v.tx, ty: v.ty, tz: v.tz, d: v.d - (v.dolly || 0) * t, yaw: v.yaw + (v.drift || 0) * t, pitch: v.pitch };
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    c.F = [sy * cp, -sp, cy * cp]; c.R = [cy, 0, -sy]; c.U = [sy * sp, cp, cy * sp];
    c.C = [c.tx - c.d * c.F[0], c.ty - c.d * c.F[1], c.tz - c.d * c.F[2]];
    return c;
  };
  K.proj = function (c, x, y, z, o) {
    const vx = x - c.C[0], vy = y - c.C[1], vz = z - c.C[2];
    const zc = vx * c.F[0] + vy * c.F[1] + vz * c.F[2];
    o[0] = 960 + F * (vx * c.R[0] + vz * c.R[2]) / zc;
    o[1] = 540 - F * (vx * c.U[0] + vy * c.U[1] + vz * c.U[2]) / zc;
    o[2] = zc; return o;
  };
  K.F = F;

  // ---------- the terrain: altitude.html's hills, contour rings ----------
  const HILLS = [
    { id: 'o', x: -120, z: 0, h: 150, r: 260, n: 11, seed: 3, fade: 1 },
    { id: 'm', x: 520, z: 900, h: 540, r: 620, n: 26, seed: 7, fade: 1 },
    { id: 'w', x: -950, z: 520, h: 120, r: 520, n: 9, seed: 11, fade: 0.9 },
    { id: 'f', x: -350, z: 2100, h: 260, r: 620, n: 14, seed: 5, fade: 0.55 }];
  K.HILLS = HILLS;
  function ring(cx, cz, y, rad, wob, ph, sx, sz) {
    const N = 72, a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = i / N * Math.PI * 2;
      const rr = rad * (1 + wob * (0.55 * Math.sin(2 * th + ph[0]) + 0.3 * Math.sin(3 * th + ph[1]) + 0.18 * Math.sin(5 * th + ph[2])));
      a[i * 3] = cx + Math.cos(th) * rr * sx; a[i * 3 + 1] = y; a[i * 3 + 2] = cz + Math.sin(th) * rr * sz;
    }
    return a;
  }
  K.terrain = function (parent) {
    const lines = [], summit = {};
    HILLS.forEach(H => {
      const r = K.rng(H.seed); const ph = [r() * 6.3, r() * 6.3, r() * 6.3]; const lean = r() * 6.3;
      for (let i = 0; i < H.n; i++) {
        const qv = 0.05 + 0.935 * i / (H.n - 1);
        const cx = H.x + Math.cos(lean) * H.r * 0.07 * qv, cz = H.z + Math.sin(lean) * H.r * 0.07 * qv;
        lines.push({ pts: ring(cx, cz, qv * H.h, H.r * Math.sqrt(Math.log(qv) / Math.log(0.05)), 0.11 * (1 - 0.6 * qv), ph, 1, 1), closed: true, fade: H.fade, hill: H.id, q: qv });
      }
      const tq = 0.985; summit[H.id] = [H.x + Math.cos(lean) * H.r * 0.07 * tq, H.h * tq, H.z + Math.sin(lean) * H.r * 0.07 * tq];
      if (H.id !== 'f') [1.14, 1.34, 1.6].forEach((m, j) => lines.push({ pts: ring(H.x, H.z, 0, H.r * m, 0.16 + j * 0.05, [ph[0] + j * 0.7, ph[1] - j * 0.9, ph[2] + j * 1.3], 1.05, 0.95), closed: true, fade: H.fade * 0.85 }));
    });
    const rr = K.rng(21);
    for (let n = 0; n < 70 && lines.length < 140; n++) {
      const x = K.lerp(-2600, 2600, rr()), z = K.lerp(-1100, 3400, rr()), rad = 45 + rr() * 170;
      const sx = 0.7 + rr() * 0.7, ph = [rr() * 6.3, rr() * 6.3, rr() * 6.3], k = 1 + Math.floor(rr() * 3);
      if (HILLS.some(H => Math.hypot(x - H.x, z - H.z) < H.r * 1.6 + rad)) continue;
      for (let j = 0; j < k; j++) lines.push({ pts: ring(x, z, 0, rad * (1 - j * 0.3), 0.26, ph, sx, 2 - sx), closed: true, fade: 0.8 });
    }
    lines.forEach(L => { L.el = K.mk('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent); });
    return { lines, summit };
  };
  const P = [0, 0, 0];
  // Draw every contour from camera c. tone(L) returns [r, g, b, alpha multiplier] for a line.
  K.drawTerrain = function (T, c, alpha, tone) {
    for (const L of T.lines) {
      const pts = L.pts, n = pts.length / 3;
      let d = '', pen = false, zs = 0, zn = 0;
      for (let i = 0; i <= n; i++) {
        if (i === n && !L.closed) break;
        const j = (i % n) * 3; K.proj(c, pts[j], pts[j + 1], pts[j + 2], P);
        if (P[2] < 60 || P[0] < -800 || P[0] > 2720) { pen = false; continue; }
        zs += P[2]; zn++;
        d += (pen ? 'L' : 'M') + K.fx(P[0]) + ' ' + K.fx(P[1]); pen = true;
      }
      L.el.setAttribute('d', d || 'M0 0');
      if (!zn) { L.el.setAttribute('stroke-opacity', 0); continue; }
      const da = Math.min(0.95, Math.max(0.16, 1.2 - (zs / zn - 700) / 3400)), tn = tone(L);
      L.el.setAttribute('stroke', 'rgb(' + tn[0] + ',' + tn[1] + ',' + tn[2] + ')');
      L.el.setAttribute('stroke-opacity', (da * L.fade * 0.85 * tn[3] * alpha).toFixed(3));
      L.el.setAttribute('stroke-width', 2);
    }
  };
  // The height of the main mountain's surface at world (x, z), so a figure can stand on its contours.
  K.groundY = function (x, z) {
    let y = 0;
    for (const H of HILLS) {
      const dd = Math.hypot(x - H.x, z - H.z) / H.r;
      if (dd < 1) y = Math.max(y, H.h * Math.pow(0.05, dd * dd));
    }
    return y;
  };

  // ---------- pixel sprites (altitude.html's walker, recoloured, plus the monsters) ----------
  K.SPRITES = {
    climber: { body: ['0000110000', '0011111100', '0111111110', '0110110110', '0111111110', '1111111111', '0111111110', '0011111100'],
               legs: [['0110000110', '0110000110'], ['0011001100', '0001001000']] },
    blob: { body: ['0001111000', '0111111110', '1111111111', '1101111011', '1111111111', '1111111111', '0111111110', '0011001100'],
            legs: [['0100000010', '0000000000'], ['0010000100', '0000000000']] },
    zombie: { body: ['0001111000', '0011111100', '0011001100', '0011111100', '1111111111', '1001111001', '0001111000', '0001111000'],
              legs: [['0011001100', '0110000110'], ['0001111000', '0011001100']] }
  };
  K.sprite = function (parent) {
    const g = K.mk('g', {}, parent), px = [];
    for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) px.push({ r, q, el: K.mk('rect', {}, g) });
    return { g, px };
  };
  // Draw sprite S of kind `kind` with its feet at screen (x, y), pixel size ps, walk frame fr.
  K.drawSprite = function (S, kind, x, y, ps, fill, opacity, fr) {
    if (opacity <= 0.002 || ps <= 0.05) { S.g.style.display = 'none'; return; }
    S.g.style.display = ''; S.g.setAttribute('fill', fill); S.g.setAttribute('opacity', opacity.toFixed(3));
    const def = K.SPRITES[kind], rows = def.body.concat(def.legs[fr ? 1 : 0]);
    const x0 = x - ps * 5, y0 = y - ps * rows.length;
    for (const p of S.px) {
      if (rows[p.r][p.q] !== '1') { p.el.setAttribute('width', 0); continue; }
      p.el.setAttribute('x', K.fx(x0 + p.q * ps)); p.el.setAttribute('y', K.fx(y0 + p.r * ps));
      p.el.setAttribute('width', (ps + 0.6).toFixed(2)); p.el.setAttribute('height', (ps + 0.6).toFixed(2));
    }
  };

  // ---------- stars ----------
  K.stars = function (parent, n, seed, top) {
    const r = K.rng(seed), out = [];
    for (let i = 0; i < n; i++) out.push({ x: r() * 1920, y: r() * top, s: 0.6 + r() * 1.9, ph: r() * 6.3, sp: 0.6 + r() * 1.6,
                                           el: K.mk('circle', { fill: '#dfe6f2' }, parent) });
    return out;
  };
  K.drawStars = function (S, t, alpha) {
    for (const s of S) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      s.el.setAttribute('cx', K.fx(s.x)); s.el.setAttribute('cy', K.fx(s.y)); s.el.setAttribute('r', (s.s * (0.8 + 0.2 * tw)).toFixed(2));
      s.el.setAttribute('opacity', (alpha * (0.25 + 0.6 * tw)).toFixed(3));
    }
  };

  // ---------- a line of text that fades in at a and out at b ----------
  K.fade = function (el, t, a, b, rise) {
    const i = K.eo(K.seg(t, a, a + 0.6)), o = b == null ? 0 : K.ei(K.seg(t, b, b + 0.4));
    el.setAttribute('opacity', (i * (1 - o)).toFixed(3));
    el.setAttribute('transform', 'translate(0 ' + K.fx((1 - i) * (rise == null ? 24 : rise) - o * 16) + ')');
  };

  // ---------- the player (altitude.html's, unchanged in behaviour) ----------
  K.player = function (DUR, holdDefault, render, name) {
    const $ = K.$, QS = new URLSearchParams(location.search), FROM = +(QS.get('from') || 0);
    const DECK = document.documentElement.classList.contains('deck'), HOLD = QS.has('to') ? +QS.get('to') : holdDefault;
    const WAIT = /[?&]wait/.test(location.search);
    let now = FROM, playing = (DECK && !WAIT) || (!DECK && !matchMedia('(prefers-reduced-motion: reduce)').matches), last = null;
    addEventListener('message', e => { if (e.data === 'play') { now = FROM; playing = true; last = null; } if (e.data === 'end') { now = DECK ? HOLD : DUR; playing = false; show(); } });
    const playBtn = $('play'), scrub = $('scrub'), time = $('time');
    scrub.max = DUR;
    function show() { render(now); scrub.value = now; time.textContent = now.toFixed(1) + ' / ' + DUR.toFixed(1) + ' s'; playBtn.textContent = playing ? 'Pause' : 'Play'; }
    function tick(ts) {
      if (playing) { if (last !== null) now += (ts - last) / 1000; if (DECK && now >= HOLD) { now = HOLD; playing = false; } else if (now >= DUR) { now = DUR; playing = false; } }
      last = ts; show(); requestAnimationFrame(tick);
    }
    playBtn.addEventListener('click', () => { if (!playing && now >= DUR) now = 0; playing = !playing; last = null; show(); });
    scrub.addEventListener('input', () => { now = +scrub.value; show(); });
    document.addEventListener('keydown', e => {
      if (e.target === scrub) return;
      if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
      if (e.code === 'ArrowRight') { now = Math.min(DUR, now + 1 / 30); playing = false; show(); }
      if (e.code === 'ArrowLeft') { now = Math.max(0, now - 1 / 30); playing = false; show(); }
    });
    $('save').addEventListener('click', () => {
      const svg = $('film').cloneNode(true);
      svg.setAttribute('width', 1920); svg.setAttribute('height', 1080);
      const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = name + '-' + now.toFixed(2) + 's.svg'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const seek = t => { now = t; playing = false; show(); };
    window.film = { seek, render };
    window.DURATION = DECK ? HOLD : DUR; window.render = render; window.seek = seek;
    window.play = () => { if (now >= window.DURATION) now = 0; playing = true; last = null; }; window.pause = () => { playing = false; };
    show();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(show);
    requestAnimationFrame(tick);
  };
})();
