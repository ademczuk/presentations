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
  // Cast colors (Andrew, 27 Oct): the Claude bot keeps Altitude's original orange; zombie threads are green,
  // mutant processes red, and the zombie mutants of the horde purple.
  K.ORANGE = '#ff6a1f';
  K.GREEN = '#3ddc84';
  K.RED = '#ff4b4b';
  K.PURPLE = '#a56bff';
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
  // A camera assembled from complete, timed keys.  Unlike K.camera's legacy
  // drift/dolly view, a key camera is exactly still while it is held.
  K.keyCamera = function (keys, t) {
    let a = keys[0], b = keys[0], p = 0;
    if (t >= keys[keys.length - 1].t) a = b = keys[keys.length - 1];
    else if (t > keys[0].t) {
      for (let i = 0; i < keys.length - 1; i++) {
        if (t >= keys[i].t && t <= keys[i + 1].t) {
          a = keys[i]; b = keys[i + 1]; p = K.eio(K.seg(t, a.t, b.t)); break;
        }
      }
    }
    const v = {};
    ['tx', 'ty', 'tz', 'd', 'yaw', 'pitch'].forEach(k => { v[k] = K.lerp(a[k], b[k], p); });
    return K.camera(v, 0);
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
  K.drawTerrain = function (T, c, alpha, tone, opts) {
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
      // Only the loose foreground contours recede.  Mountain rings retain
      // their readable silhouette even when the near-field fade is enabled.
      const near = opts && opts.nearFade && !L.hill ? 0.25 + 0.75 * K.seg(zs / zn, 350, 900) : 1;
      L.el.setAttribute('stroke-opacity', (da * L.fade * 0.85 * tn[3] * alpha * near).toFixed(3));
      L.el.setAttribute('stroke-width', 2);
    }
  };
  K.skyMask = function (parent) {
    const paths = {};
    HILLS.forEach(H => { paths[H.id] = K.mk('path', { stroke: 'none' }, parent); });
    return { paths };
  };
  K.drawSkyMask = function (M, T, c, hills, color) {
    const want = hills || HILLS.map(H => H.id);
    for (const id of want) {
      const L = T.lines.find(line => line.hill === id && line.q === 0.05), el = M.paths[id];
      if (!L || !el) continue;
      const pts = L.pts, n = pts.length / 3; let d = '';
      for (let i = 0; i < n; i++) {
        const j = i * 3; K.proj(c, pts[j], pts[j + 1], pts[j + 2], P);
        d += (i ? 'L' : 'M') + K.fx(P[0]) + ' ' + K.fx(P[1]);
      }
      el.setAttribute('d', d + 'Z'); el.setAttribute('fill', color);
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

  // ---------- pixel sprites (altitude.html's walker, recolored, plus the monsters) ----------
  K.SPRITES = {
    climber: { body: ['0000110000', '0011111100', '0111111110', '0110110110', '0111111110', '1111111111', '0111111110', '0011111100'],
               legs: [['0110000110', '0110000110'], ['0011001100', '0001001000']] },
    blob: { body: ['0001111000', '0111111110', '1111111111', '1101111011', '1111111111', '1111111111', '0111111110', '0011001100'],
            legs: [['0100000010', '0000000000'], ['0010000100', '0000000000']] },
    zombie: { body: ['0001111000', '0011111100', '0011001100', '0011111100', '1111111111', '1001111001', '0001111000', '0001111000'],
              legs: [['0011001100', '0110000110'], ['0001111000', '0011001100']] },
    // 12-wide monsters designed for the 27 Oct rework (Kimi K3, checked against the brief): the zombie thread
    // shambles with arms out, the mutant buds a second head, the zombie mutant has a jagged crown and three legs.
    shambler: { body: ['000111100000', '001111111000', '001001011000', '011111111100', '111111111111', '011111111110', '001111111000', '001111110000', '000111100000', '000111100000'],
             legs: [['001100011000', '011000001100'], ['000110001100', '001100000110']] },
    mutant: { body: ['000110011000', '001111111100', '011101101110', '011111111110', '001111111100', '001111111100', '011111111110', '011111111110', '001111111100', '000111111000'],
             legs: [['001100011000', '001100011000'], ['000110011000', '000110001100']] },
    zmutant: { body: ['001011010000', '011111111000', '011011011100', '111111111110', '011111111111', '001111111110', '011111111100', '001111111000', '000111110000', '000111100000'],
             legs: [['001100110000', '011001101100'], ['000110110000', '001101100110']] }
  };
  // ---------- the defenders: one rope team of different models (28 Oct) ----------
  // Same body and legs as the climber, so they walk in step; each has its own head so the team reads even in
  // grey: Claude keeps the antenna nub, Codex has two ears, Kimi a crescent, Antigravity a halo that floats,
  // Grok a visor, and the local models a plain round head. Colors stay clear of the monsters' green, red, purple.
  (function () {
    const C = K.SPRITES.climber, body = C.body, plain = ['0000000000'].concat(body.slice(1));
    const add = (name, rows) => { K.SPRITES[name] = { body: rows, legs: C.legs }; };
    add('botCodex', ['0110000110'].concat(body.slice(1)));
    add('botKimi', ['0000000110', '0000000011', '0000000011', '0000000110', '0000000000'].concat(body.slice(1)));
    add('botAnti', ['0011111100', '0000000000'].concat(body.slice(1)));
    add('botGrok', body.slice(0, 3).concat(['0100000010'], body.slice(4)));
    add('botLocal', plain);
    // Claude is the Claude Code mascot (Andrew, 28 Oct): a wide coral body with two square eyes, arms straight out
    // across the middle and four short legs. It replaces the old climber, so every scene that draws 'climber'
    // (the hero with the lantern) now draws the mascot; the other bots above keep the old climber's body.
    K.SPRITES.climber = {
      body: ['001111111100', '001101101100', '111111111111', '111111111111', '001111111100'],
      legs: [['001010010100', '001010010100'], ['000101101000', '001010010100']]
    };
  })();
  K.CLAUDE = '#d97757';   // the mascot's coral
  K.CAST = {
    claude: { name: 'Claude', color: K.CLAUDE, kind: 'climber', scale: 1.3 },   // the mascot is 7 pixels tall, the bots 10
    codex: { name: 'Codex', color: '#e9eef6', kind: 'botCodex' },
    kimi: { name: 'Kimi', color: '#5b8cff', kind: 'botKimi' },
    antigravity: { name: 'Antigravity', color: '#ffd23f', kind: 'botAnti' },
    grok: { name: 'Grok', color: '#36d1e0', kind: 'botGrok' },
    local: { name: 'local models', color: '#aab2be', kind: 'botLocal' }
  };
  K.CAST_ORDER = ['claude', 'codex', 'kimi', 'antigravity', 'grok', 'local'];
  // Draw a cast member: K.drawCast(S, 'kimi', x, y, ps, opacity, fr) is K.drawSprite with that model's head and color.
  K.drawCast = function (S, id, x, y, ps, opacity, fr) { const m = K.CAST[id]; K.drawSprite(S, m.kind, x, y, ps * (m.scale || 1), m.color, opacity, fr); };
  // ---- CODEX-A additions ----
  // The back view of a cast member: its face row with the eyes filled in. The mascot's face row is its own.
  K.castBack = function (id) {
    const kind = K.CAST[id].kind, back = kind + 'Back';
    if (!K.SPRITES[back]) {
      const body = K.SPRITES[kind].body.slice();
      const FACES = { '0110110110': '0111111110', '0100000010': '0111111110', '001101101100': '001111111100' };
      const face = body.findIndex(row => FACES[row]);
      if (face >= 0) body[face] = FACES[body[face]];
      K.SPRITES[back] = { body, legs: K.SPRITES[kind].legs };
    }
    return back;
  };

  K.sprite = function (parent, opts) {
    opts = opts || {};
    const g = K.mk('g', {}, parent);
    const glow = opts.glow ? K.mk('path', { filter: 'url(#og)', opacity: '.55' }, g) : null;
    const path = K.mk('path', { 'shape-rendering': 'crispEdges' }, g);
    return { g, path, glow, opts };
  };
  function spritePath(rows, x, y, ps, flip, scaleY, dissolve, seed) {
    const wd = rows[0].length, x0 = x - ps * wd / 2, y0 = y - ps * rows.length, sy = scaleY == null ? 1 : scaleY;
    const r = K.rng(seed == null ? 1 : seed), pixels = [];
    for (let row = 0; row < rows.length; row++) for (let col = 0; col < wd; col++) {
      if (rows[row][col] === '1') pixels.push({ row, col, rank: r() });
    }
    let d = '';
    for (const px of pixels) {
      const lost = px.rank < dissolve;
      // A deterministic dither lets the drifting fragment disappear as the
      // dissolve advances while keeping the sprite to one SVG path.
      if (lost && ((px.rank * 997 + dissolve * 13) % 1) < K.seg(dissolve, px.rank, Math.min(1, px.rank + .18))) continue;
      const q = flip ? wd - 1 - px.col : px.col, drift = lost ? 6 + 8 * ((px.rank * 17) % 1) : 0;
      const pxX = x0 + q * ps, rawY = y0 + px.row * ps - drift;
      const pxY = y - (y - rawY) * sy, h = (ps + .6) * sy, w = ps + .6;
      d += 'M' + K.fx(pxX) + ' ' + K.fx(pxY) + 'h' + w.toFixed(2) + 'v' + h.toFixed(2) + 'h-' + w.toFixed(2) + 'Z';
    }
    return d;
  }
  // `fr` remains the old numeric walk frame.  The object form adds motion
  // controls without making a frame depend on any preceding render.
  K.drawSprite = function (S, kind, x, y, ps, fill, opacity, fr) {
    if (opacity <= 0.002 || ps <= 0.05) { S.g.style.display = 'none'; return; }
    const o = typeof fr === 'number' || fr == null ? { t: 0, phase: fr || 0, cadence: 0, bob: false } : fr;
    ps = Math.max(4.5, ps);
    const frame = typeof fr === 'number' ? (fr ? 1 : 0) : Math.floor((o.t || 0) * (o.cadence || 0) + (o.phase || 0)) % 2;
    const bob = o.bob ? (frame ? -ps * .5 : Math.sin((o.t || 0) * 2.4) * ps * .15) : 0;
    const rows = K.SPRITES[kind].body.concat(K.SPRITES[kind].legs[frame ? 1 : 0]);
    const d = spritePath(rows, x, y + bob, ps, !!o.flip, o.scaleY, K.clamp01(o.dissolve || 0), o.seed);
    S.g.style.display = ''; S.g.setAttribute('fill', fill); S.g.setAttribute('opacity', opacity.toFixed(3));
    S.g.setAttribute('transform', o.rot ? 'rotate(' + o.rot + ' ' + K.fx(x) + ' ' + K.fx(y) + ')' : '');
    S.path.setAttribute('d', d);
    if (o.outline || S.opts.outline) { S.path.setAttribute('stroke', '#0b0d12'); S.path.setAttribute('stroke-width', '1.5'); S.path.setAttribute('paint-order', 'stroke'); }
    else S.path.setAttribute('stroke', 'none');
    if (S.glow) S.glow.setAttribute('d', d);
  };
  K.depthSort = function (items) { items.slice().sort((a, b) => b.z - a.z).forEach(item => item.g.parentNode.appendChild(item.g)); };

  // ---------- subject labels, using Altitude's pinned pill construction ----------
  K.label = function (parent, text, opts) {
    opts = opts || {};
    const g = K.mk('g', {}, parent);
    const lead = K.mk('line', { 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    const pin = K.mk('ellipse', { rx: 7, ry: 4 }, g);
    const halo = K.mk('rect', { rx: 16, fill: 'none', 'stroke-width': 6, filter: 'url(#halo)' }, g);
    const box = K.mk('rect', { rx: 16, fill: '#252321', 'stroke-width': 2 }, g);
    const label = K.mk('text', { class: 'sans', 'font-size': opts.size || 30, fill: '#f2ece4', 'text-anchor': 'middle' }, g);
    label.textContent = text;
    const L = { g, lead, pin, halo, box, text: label, h: opts.h || 56, lift: opts.lift || 90,
                width: opts.width || Math.max(130, text.length * (opts.size || 30) * .58 + 48), measured: false };
    const measure = () => {
      if (L.measured) return;
      try { const w = label.getComputedTextLength(); if (w > 0) { L.width = w + 48; L.measured = true; } } catch (e) { /* SVG text measurement is optional until fonts load. */ }
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure); else measure();
    return L;
  };
  K.drawLabel = function (L, x, y, grow, show, color) {
    grow = K.clamp01(grow); show = K.clamp01(show);
    if (grow <= 0 && show <= 0) { L.g.style.display = 'none'; return; }
    L.g.style.display = '';
    const top = y - L.lift * grow, bx = x - L.width / 2, by = y - L.lift - L.h + (1 - show) * 14;
    L.pin.setAttribute('cx', K.fx(x)); L.pin.setAttribute('cy', K.fx(y)); L.pin.setAttribute('fill', color);
    L.pin.setAttribute('opacity', Math.min(1, grow * 3).toFixed(3));
    L.lead.setAttribute('x1', K.fx(x)); L.lead.setAttribute('y1', K.fx(y)); L.lead.setAttribute('x2', K.fx(x)); L.lead.setAttribute('y2', K.fx(top));
    L.lead.setAttribute('stroke', color); L.lead.setAttribute('opacity', grow.toFixed(3));
    for (const R of [L.box, L.halo]) { R.setAttribute('x', K.fx(bx)); R.setAttribute('y', K.fx(by)); R.setAttribute('width', K.fx(L.width)); R.setAttribute('height', L.h); }
    L.box.setAttribute('stroke', color); L.box.setAttribute('opacity', show.toFixed(3));
    L.halo.setAttribute('stroke', color); L.halo.setAttribute('opacity', (show * .55).toFixed(3));
    L.text.setAttribute('x', K.fx(x)); L.text.setAttribute('y', K.fx(by + L.h / 2 + 10.5)); L.text.setAttribute('opacity', show.toFixed(3));
  };

  // ---------- the hanging lantern and its light pool ----------
  K.lantern = function (parent) {
    const svg = parent.ownerSVGElement || parent, defs = svg.querySelector('defs') || svg.insertBefore(K.mk('defs', {}, null), svg.firstChild);
    const id = 'filmkit-lantern-light';
    if (!svg.querySelector('#' + id)) {
      const grad = K.mk('radialGradient', { id, cx: '50%', cy: '50%', r: '50%' }, defs);
      K.mk('stop', { offset: '0', 'stop-color': '#ffe7a3', 'stop-opacity': '.7' }, grad);
      K.mk('stop', { offset: '.45', 'stop-color': '#ffd36b', 'stop-opacity': '.22' }, grad);
      K.mk('stop', { offset: '1', 'stop-color': '#ffd36b', 'stop-opacity': '0' }, grad);
    }
    const pool = K.mk('ellipse', { fill: 'url(#' + id + ')' }, parent);
    const g = K.mk('g', {}, parent);
    const handle = K.mk('path', { fill: 'none', stroke: '#c9b27a', 'stroke-width': 2 }, g);
    const cap = K.mk('rect', { fill: '#c9b27a' }, g), body = K.mk('rect', { fill: '#ffe7a3' }, g);
    return { g, pool, handle, cap, body };
  };
  K.drawLantern = function (L, handX, handY, ps, on, t) {
    on = K.clamp01(on); ps = Math.max(4.5, ps);
    const a = 1.5 * Math.sin(t * 2.1), rad = a * Math.PI / 180, lx = handX + Math.sin(rad) * ps * 1.2, ly = handY + Math.cos(rad) * ps * 1.2;
    L.g.setAttribute('transform', 'rotate(' + a.toFixed(3) + ' ' + K.fx(handX) + ' ' + K.fx(handY) + ')');
    L.body.setAttribute('x', K.fx(lx - ps * .9)); L.body.setAttribute('y', K.fx(ly - ps * 1.4));
    L.body.setAttribute('width', K.fx(ps * 1.8)); L.body.setAttribute('height', K.fx(ps * 2.2)); L.body.setAttribute('opacity', (.35 + .65 * on).toFixed(3));
    L.cap.setAttribute('x', K.fx(lx - ps * 1.2)); L.cap.setAttribute('y', K.fx(ly - ps * 2.1));
    L.cap.setAttribute('width', K.fx(ps * 2.4)); L.cap.setAttribute('height', K.fx(ps * .7));
    L.handle.setAttribute('d', 'M' + K.fx(lx - ps * .8) + ' ' + K.fx(ly - ps * 2.1) + 'Q' + K.fx(lx) + ' ' + K.fx(ly - ps * 3.6) + ' ' + K.fx(lx + ps * .8) + ' ' + K.fx(ly - ps * 2.1));
    L.pool.setAttribute('cx', K.fx(lx)); L.pool.setAttribute('cy', K.fx(handY - ps * 1.2));
    L.pool.setAttribute('rx', K.fx(ps * 58 * (.55 + .45 * on))); L.pool.setAttribute('ry', K.fx(ps * 26 * (.55 + .45 * on)));
    L.pool.setAttribute('opacity', on.toFixed(3));
  };

  // ---------- a projected, dotted route through world-space points ----------
  K.trail = function (parent) {
    const dots = [];
    for (let i = 0; i < 128; i++) dots.push(K.mk('circle', { r: 0, fill: '#d9d2c9' }, parent));
    return { dots };
  };
  K.drawTrail = function (T, c, pts, upto) {
    const world = pts.map(p => p.length === 2 ? [p[0], K.groundY(p[0], p[1]), p[1]] : p);
    const lengths = [0];
    for (let i = 1; i < world.length; i++) lengths.push(lengths[i - 1] + Math.hypot(world[i][0] - world[i - 1][0], world[i][1] - world[i - 1][1], world[i][2] - world[i - 1][2]));
    const total = lengths[lengths.length - 1] || 1, visible = total * K.clamp01(upto);
    let dot = 0;
    for (let s = 0; s <= visible && dot < T.dots.length; s += 24, dot++) {
      let i = 1; while (i < lengths.length && lengths[i] < s) i++;
      const span = lengths[i] - lengths[i - 1] || 1, p = (s - lengths[i - 1]) / span, a = world[i - 1], b = world[i];
      K.proj(c, K.lerp(a[0], b[0], p), K.lerp(a[1], b[1], p), K.lerp(a[2], b[2], p), P);
      const el = T.dots[dot];
      if (P[2] < 60) { el.setAttribute('r', 0); continue; }
      el.setAttribute('cx', K.fx(P[0])); el.setAttribute('cy', K.fx(P[1])); el.setAttribute('r', Math.max(1.6, 2600 / P[2]).toFixed(2));
    }
    for (; dot < T.dots.length; dot++) T.dots[dot].setAttribute('r', 0);
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

  // ---------- the player (altitude.html's, unchanged in behavior) ----------
  K.player = function (DUR, holdDefault, render, name) {
    const $ = K.$, QS = new URLSearchParams(location.search), FROM = +(QS.get('from') || 0);
    const DECK = document.documentElement.classList.contains('deck'), HOLD = QS.has('to') ? +QS.get('to') : holdDefault;
    const WAIT = /[?&]wait/.test(location.search);
    let now = FROM, playing = (DECK && !WAIT) || (!DECK && !matchMedia('(prefers-reduced-motion: reduce)').matches), last = null, dirty = true;
    addEventListener('message', e => { if (e.data === 'play') { now = FROM; playing = true; last = null; dirty = true; } if (e.data === 'end') { now = DECK ? HOLD : DUR; playing = false; show(); } });
    const playBtn = $('play'), scrub = $('scrub'), time = $('time');
    scrub.max = DUR;
    function show() { render(now); scrub.value = now; time.textContent = now.toFixed(1) + ' / ' + DUR.toFixed(1) + ' s'; playBtn.textContent = playing ? 'Pause' : 'Play'; }
    function tick(ts) {
      if (playing) { if (last !== null) now += (ts - last) / 1000; if (DECK && now >= HOLD) { now = HOLD; playing = false; dirty = true; } else if (now >= DUR) { now = DUR; playing = false; dirty = true; } }
      // A held frame is not re-rendered every frame: only while playing, or once after something changed.
      last = ts; if (playing || dirty) { show(); dirty = false; } requestAnimationFrame(tick);
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });
    requestAnimationFrame(tick);
  };
})();
