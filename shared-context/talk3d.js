/* talk3d.js: three pages of the talk deck rebuilt as full-screen vector animation (Andrew, 21 Oct night:
 * "animate it", "the evolution should become ever more advanced"). Loaded after talk.js; replaces
 * Talk.whyGraph, Talk.lexifina and Talk.evidence. Same scene contract { steps, mount(host), step(i) }.
 * Each scene draws a canvas at device resolution with requestAnimationFrame, as a function of the time since
 * the current step began; going back jumps to that step's settled state; reduced motion shows end states.
 * Text sits in a DOM overlay (local fonts). No network. */
(function () {
  'use strict';
  var W = 1920, H = 1080;
  var BG = '#0e0d0c', INK = '#f2ece4', MUTED = '#a6a098', LINE = '#d9d2c9', OR = '#ff6a1f', CORAL = '#fb7185', HIT = '#f6d38a';
  var RM = false; try { RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  var ease = function (x) { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var eo = function (x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  var lerp = function (a, b, p) { return a + (b - a) * p; };
  function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function mixHex(h1, h2, p) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    var r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, p)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, p)), bl = Math.round(lerp(a & 255, b & 255, p));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  var css = '' +
    '.t3{position:absolute;inset:0;background:' + BG + ';overflow:hidden}' +
    '.t3 canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.t3 .ov{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;pointer-events:none;color:' + INK + ';font-family:Manrope,Arial,sans-serif}' +
    '.t3 .f{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease}' +
    '.t3 .f.on{opacity:1;transform:none}.t3 .f.dim{opacity:.38;transform:none}' +
    '.t3 .kick{font:600 22px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:' + MUTED + '}' +
    '.t3 .h{font:700 64px/1.05 "Source Serif 4",Georgia,serif;letter-spacing:-.01em}' +
    '.t3 .cap{position:absolute;left:0;right:0;bottom:84px;text-align:center;font:700 52px/1.15 "Source Serif 4",Georgia,serif;text-shadow:0 2px 24px #000}' +
    '.t3 .cap em{font-style:normal;color:' + OR + '}' +
    '.t3 .scrim{position:absolute;top:0;bottom:0;right:0;width:760px;background:linear-gradient(90deg,' + hexA(BG, 0) + ',' + hexA(BG, .88) + ' 26%,' + hexA(BG, .94) + ')}' +
    '.t3 .pt{margin-top:18px;padding:18px 22px;border-radius:16px;background:rgba(242,236,228,.06);border:1px solid rgba(242,236,228,.14);font-size:27px;line-height:1.3;color:#e9e3da}' +
    '.t3 .pt b{color:' + OR + '}' +
    '.t3 .pt.on{border-color:' + hexA(OR, .7) + ';box-shadow:0 0 30px ' + hexA(OR, .18) + '}' +
    '.t3 .note{font-size:21px;color:' + MUTED + '}' +
    '.t3 .log{font:500 27px/1.75 "JetBrains Mono",Consolas,monospace;color:#cfc8be}' +
    '.t3 .log .bad{color:' + CORAL + '}.t3 .log .good{color:' + OR + '}' +
    '.t3 .q{padding:24px 30px;border:1px solid rgba(242,236,228,.2);border-radius:16px;background:rgba(242,236,228,.05);font:500 38px/1.25 "JetBrains Mono",Consolas,monospace}' +
    '.t3 .q em{font-style:normal;color:' + OR + '}' +
    '.t3 .card .who{font:700 34px/1.2 Manrope,Arial,sans-serif}.t3 .card .when{margin-top:6px;font-size:22px;color:' + MUTED + '}' +
    '.t3 .card .big{margin-top:18px;font:700 60px/1.1 Manrope,Arial,sans-serif}.t3 .card .big b{color:' + OR + '}' +
    '.t3 .card .cav{margin-top:12px;font-size:25px;line-height:1.35;color:#d9d2c9;max-width:900px}' +
    '@media (prefers-reduced-motion: reduce){.t3 .f{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // A full-screen scene: a canvas at device resolution, a 1920x1080 overlay, and a frame loop that runs only while
  // the page is the active one. draw(ctx, step, sinceStep, total) works in 1920x1080 design units.
  function scene(opts) {
    var S = { step: 0, since0: 0, t0: 0, raf: 0, host: null, canvas: null, ctx: null, ov: null, k: 1, ox: 0, oy: 0, dpr: 1 };
    function fit() {
      if (!S.host) return;
      var r = S.host.getBoundingClientRect(), w = r.width, h = r.height;
      if (!w || !h) return;
      // the stage itself is scaled by the deck: measure the host in its own (untransformed) pixels
      w = S.host.clientWidth || w; h = S.host.clientHeight || h;
      var stageScale = r.width / w || 1;
      S.dpr = (window.devicePixelRatio || 1) * stageScale;
      S.canvas.width = Math.round(w * S.dpr); S.canvas.height = Math.round(h * S.dpr);
      S.k = Math.min(w / W, h / H); S.ox = (w - W * S.k) / 2; S.oy = (h - H * S.k) / 2;
      S.ov.style.transform = 'translate(' + S.ox + 'px,' + S.oy + 'px) scale(' + S.k + ')';
    }
    function active() { var s = S.host && S.host.closest('.slide'); return !!(s && s.classList.contains('active') && !document.hidden); }
    function frame(now) {
      S.raf = 0;
      if (!S.host || !S.host.isConnected) return;
      var since = RM ? 999 : (now - S.since0) / 1000, total = (now - S.t0) / 1000;
      var c = S.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = BG; c.fillRect(0, 0, S.canvas.width, S.canvas.height);
      c.setTransform(S.k * S.dpr, 0, 0, S.k * S.dpr, S.ox * S.dpr, S.oy * S.dpr);
      opts.draw(c, S.step, since, total, S);
      if (active()) S.raf = requestAnimationFrame(frame);
    }
    function kick() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
    return {
      steps: opts.steps,
      mount: function (host) {
        S.host = host; host.classList.add('tk-full'); host.innerHTML = '';
        var root = document.createElement('div'); root.className = 't3';
        S.canvas = document.createElement('canvas'); S.ctx = S.canvas.getContext('2d');
        S.ov = document.createElement('div'); S.ov.className = 'ov'; S.ov.innerHTML = opts.overlay();
        root.appendChild(S.canvas); root.appendChild(S.ov); host.appendChild(root);
        fit(); try { new ResizeObserver(fit).observe(host); } catch (e) {} addEventListener('resize', fit);
        S.t0 = performance.now(); S.since0 = S.t0;
      },
      step: function (i) {
        var now = performance.now();
        if (i === 0 && S.step === 0 && now - S.since0 < 1200 && S.started) { kick(); return; }   // the deck activates twice
        var back = i < S.step && S.started;
        S.step = i; S.started = true; S.since0 = back ? now - 60000 : now;
        if (i === 0 && !back) S.t0 = now;
        fit();
        if (opts.onStep) opts.onStep(S.ov, i, back);
        kick();
      }
    };
  }
  function toggle(ov, sel, fn) { ov.querySelectorAll(sel).forEach(function (e) { var r = fn(+e.dataset.at, e); e.classList.toggle('on', !!r && r !== 'dim'); e.classList.toggle('dim', r === 'dim'); }); }

  // ---------------------------------------------------------------- Why a graph
  var why = (function () {
    var FOLD = ['API/', 'BILLING/', 'ORDERS/', 'AUTH/', 'QUEUE/', 'SHARED/'];
    var tiles = [], X0 = 860, Y0 = 150, FW = 310, FH = 330;
    FOLD.forEach(function (name, f) {
      var fx = X0 + (f % 3) * (FW + 26), fy = Y0 + Math.floor(f / 3) * (FH + 40);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) tiles.push({ f: f, x: fx + 22 + c * 92, y: fy + 46 + r * 138, w: 72, h: 120 });
    });
    var ORDER = [2, 8, 15, 21, 27, 33, 30, 24, 18, 11, 5, 26, 35, 13, 20];
    var NAMES = ['POST /orders', 'handleOrder', 'processOrder', 'saveOrder', 'OrderQueue', 'Checkout', 'billing.charge'];
    // graph layout: each folder a cluster on an ellipse, its six files around the cluster center
    var R = rng(41), CX = 1350, CY = 500;
    tiles.forEach(function (T, i) {
      var a = -Math.PI / 2 + T.f / 6 * Math.PI * 2, j = i % 6, b = j / 6 * Math.PI * 2 + T.f;
      T.nx = CX + Math.cos(a) * 390 + Math.cos(b) * (70 + R() * 30);
      T.ny = CY + Math.sin(a) * 270 + Math.sin(b) * (60 + R() * 26);
    });
    var named = {}; ORDER.slice(0, NAMES.length).forEach(function (ti, k) { named[ti] = NAMES[k]; });
    var EDGES = [];
    for (var i = 0; i < ORDER.length - 1; i++) EDGES.push([ORDER[i], ORDER[i + 1], 'path']);
    for (var f = 0; f < 6; f++) for (var j = 0; j < 6; j++) if (R() < .55) EDGES.push([f * 6 + j, f * 6 + (j + 1) % 6, 'in']);
    for (var x = 0; x < 9; x++) EDGES.push([Math.floor(R() * 36), Math.floor(R() * 36), 'x']);
    EDGES = EDGES.filter(function (e) { return e[0] !== e[1]; });
    var HOP = (function () {
      var src = ORDER[2], d = {}, q = [src]; d[src] = 0;
      while (q.length) { var u = q.shift(); EDGES.forEach(function (e) { var v = e[0] === u ? e[1] : e[1] === u ? e[0] : -1; if (v >= 0 && d[v] === undefined) { d[v] = d[u] + 1; q.push(v); } }); }
      return d;
    })();
    function pos(T, u) { return [lerp(T.x + T.w / 2, T.nx, u), lerp(T.y + T.h / 2, T.ny, u)]; }
    function draw(c, step, t, total, S) {
      var lit = function (k) { return 0.45 + k * 0.3; };
      var morph = step === 0 ? 0 : step === 1 ? ease(t / 2.2) : 1;
      var shake = step === 0 && t > 4.8 && t < 5.6 ? Math.sin(t * 60) * 6 * (1 - seg(t, 4.8, 5.6)) : 0;
      // folders, fading as the files become nodes
      var fa = 1 - morph;
      if (fa > 0.01) FOLD.forEach(function (name, f) {
        var fx = X0 + (f % 3) * (FW + 26), fy = Y0 + Math.floor(f / 3) * (FH + 40);
        c.globalAlpha = fa; c.strokeStyle = 'rgba(242,236,228,.16)'; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect(fx, fy, FW, FH, 16); c.stroke();
        c.fillStyle = MUTED; c.font = '600 20px "JetBrains Mono",monospace'; c.fillText(name, fx + 22, fy + 30);
      });
      c.globalAlpha = 1;
      // the agent's path from file to file (step 0), then the same path as edges
      var pathN = step === 0 ? clamp((t - lit(0)) / 0.3 + 1, 0, ORDER.length) : ORDER.length;
      var pcol = mixHex(CORAL, OR, step >= 2 ? 1 : morph);
      c.strokeStyle = pcol; c.lineWidth = 3; c.lineJoin = 'round';
      if (step === 0) { c.shadowColor = CORAL; c.shadowBlur = 10; }
      c.beginPath();
      for (var k = 0; k < Math.floor(pathN); k++) {
        var P = pos(tiles[ORDER[k]], morph); if (!k) c.moveTo(P[0] + shake, P[1]); else c.lineTo(P[0] + shake, P[1]);
      }
      if (step === 0 && pathN > 1 && pathN < ORDER.length) {
        var a = pos(tiles[ORDER[Math.floor(pathN) - 1]], 0), b = pos(tiles[ORDER[Math.min(ORDER.length - 1, Math.floor(pathN))]], 0), fr = pathN % 1;
        c.lineTo(lerp(a[0], b[0], fr), lerp(a[1], b[1], fr));
      }
      c.stroke(); c.shadowBlur = 0;
      // the other edges draw out in step 2
      if (step >= 2) EDGES.forEach(function (e, n) {
        if (e[2] === 'path') return;
        var u = step === 2 ? ease((t - 0.2 - n * 0.045) / 0.7) : 1; if (u <= 0) return;
        var A = pos(tiles[e[0]], 1), B = pos(tiles[e[1]], 1);
        var hot = step === 3 && HOP[e[0]] !== undefined && HOP[e[1]] !== undefined && Math.max(HOP[e[0]], HOP[e[1]]) <= 2 && t > 0.4 + Math.max(HOP[e[0]], HOP[e[1]]) * 0.6;
        c.strokeStyle = hot ? OR : 'rgba(242,236,228,' + (step === 3 ? .16 : .42) + ')'; c.lineWidth = hot ? 3 : 1.8;
        c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(lerp(A[0], B[0], u), lerp(A[1], B[1], u)); c.stroke();
      });
      // files, then nodes
      tiles.forEach(function (T, i) {
        var k = ORDER.indexOf(i), hit = k >= 0 && (step > 0 || t > lit(k)), opened = k >= 0 && (step > 0 || t > lit(k) + 0.3);
        var P = pos(T, morph), wv = lerp(T.w, named[i] ? 34 : 22, morph), hv = lerp(T.h, named[i] ? 34 : 22, morph), rr = lerp(8, wv / 2, morph);
        var col = 'rgba(242,236,228,.07)', edge = 'rgba(242,236,228,.2)';
        if (step === 0) { if (opened) { col = hexA(CORAL, .22); edge = CORAL; } else if (hit) { col = hexA(HIT, .25); edge = HIT; } }
        else {
          col = hexA(OR, named[i] ? .9 : .55); edge = OR;
          if (step === 3) {
            var h = HOP[i], on = h !== undefined && h <= 2 && t > 0.4 + h * 0.6;
            col = on ? OR : 'rgba(242,236,228,.18)'; edge = on ? OR : 'rgba(242,236,228,.25)';
          }
        }
        c.fillStyle = col; c.strokeStyle = edge; c.lineWidth = 2;
        if (step >= 1 && (step !== 3 || (HOP[i] !== undefined && HOP[i] <= 2))) { c.shadowColor = OR; c.shadowBlur = 12; }
        c.beginPath(); c.roundRect(P[0] - wv / 2 + shake * (1 - morph), P[1] - hv / 2, wv, hv, rr); c.fill(); c.stroke(); c.shadowBlur = 0;
      });
      // the selected node's rings (step 3)
      if (step === 3) {
        var S0 = pos(tiles[ORDER[2]], 1);
        for (var ring = 0; ring < 3; ring++) {
          var u = ((t - ring * 0.6) % 1.8) / 1.8; if (t < ring * 0.6) continue;
          c.strokeStyle = hexA(OR, .55 * (1 - u)); c.lineWidth = 3; c.beginPath(); c.arc(S0[0], S0[1], 24 + u * 190, 0, Math.PI * 2); c.stroke();
        }
      }
      // names of the definitions
      var la = step === 1 ? seg(t, 1.6, 2.4) : step >= 2 ? 1 : 0;
      if (la > 0) Object.keys(named).forEach(function (ti) {
        var P = pos(tiles[+ti], 1), h = HOP[+ti], on = step !== 3 || (h !== undefined && h <= 2 && t > 0.4 + h * 0.6);
        c.globalAlpha = la * (on ? 1 : .35); c.font = '600 24px "JetBrains Mono",monospace'; c.textAlign = 'center';
        c.lineWidth = 6; c.strokeStyle = BG; c.strokeText(named[ti], P[0], P[1] - 32); c.fillStyle = INK; c.fillText(named[ti], P[0], P[1] - 32);
        c.textAlign = 'left'; c.globalAlpha = 1;
      });
      // the context bar
      var fill = step === 0 ? seg(t, 0.4, 4.9) * 1.18 : step === 3 ? lerp(1.18, 0.06, ease(t / 1.4)) : 1.18;
      var bx = 70, by = 760, bw = 640;
      c.fillStyle = 'rgba(242,236,228,.1)'; c.beginPath(); c.roundRect(bx + shake, by, bw, 16, 8); c.fill();
      var over = fill > 1, gcol = c.createLinearGradient(bx, 0, bx + bw, 0);
      gcol.addColorStop(0, step === 3 ? OR : HIT); gcol.addColorStop(1, step === 3 ? OR : CORAL);
      c.fillStyle = gcol; c.beginPath(); c.roundRect(bx + shake, by, Math.min(fill, 1.18) * bw, 16, 8); c.fill();
      c.font = '600 22px "JetBrains Mono",monospace'; c.fillStyle = over ? CORAL : MUTED; c.fillText('CONTEXT WINDOW', bx, by - 16);
      c.textAlign = 'right'; c.fillText(Math.round(fill * 100) + '%', bx + bw, by - 16); c.textAlign = 'left';
    }
    function overlay() {
      return '<div style="position:absolute;left:70px;top:76px;width:700px">' +
        '<div class="q">where is <em>processOrder</em> used?</div>' +
        '<div class="log" style="margin-top:44px">' +
        '<div class="f l0" data-at="0">&gt; grep "processOrder"</div>' +
        '<div class="f l1" data-at="0">60 matches across 12 packages</div>' +
        '<div class="f l2" data-at="0">&gt; reads 60 files, one after another...</div>' +
        '<div class="f l3 bad" data-at="0">context fills, early files drop out</div>' +
        '<div class="f l4 good" data-at="3">&gt; trace processOrder in the graph</div>' +
        '<div class="f l5" data-at="3">its callers and effects, in one call</div>' +
        '</div></div>' +
        '<div class="cap f c1" data-at="1">these aren\'t text, <em>they\'re edges</em>.</div>' +
        '<div class="cap f c2" data-at="2">each definition a node, each reference an edge</div>' +
        '<div class="cap f c3" data-at="3">the agent <em>traces</em> what a change touches before it edits.</div>';
    }
    var timers = [];
    function onStep(ov, i, back) {
      timers.forEach(clearTimeout); timers = [];
      ov.querySelectorAll('.cap').forEach(function (e) { e.classList.toggle('on', +e.dataset.at === i); });
      var lines = [['.l0', .2], ['.l1', .9], ['.l2', 1.6], ['.l3', 4.6]];
      lines.forEach(function (L) {
        var e = ov.querySelector(L[0]);
        if (i === 0 && !back && !RM) { e.classList.remove('on', 'dim'); timers.push(setTimeout(function () { e.classList.add('on'); }, L[1] * 1000)); }
        else { e.classList.toggle('on', i < 3); e.classList.toggle('dim', i === 3); }
      });
      ['.l4', '.l5'].forEach(function (s, n) {
        var e = ov.querySelector(s);
        if (i === 3 && !back && !RM) { e.classList.remove('on'); timers.push(setTimeout(function () { e.classList.add('on'); }, 500 + n * 600)); }
        else e.classList.toggle('on', i === 3);
      });
    }
    return scene({ steps: 4, draw: draw, overlay: overlay, onStep: onStep });
  })();

  // ---------------------------------------------------------------- 3D helpers
  function camera(target, yaw, pitch, dist, cx, cy, focal) {
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var F = [syw * cp, -sp, cyw * cp], Rt = [cyw, 0, -syw], U = [syw * sp, cp, cyw * sp];
    var C = [target[0] - dist * F[0], target[1] - dist * F[1], target[2] - dist * F[2]];
    return function (x, y, z) {
      var vx = x - C[0], vy = y - C[1], vz = z - C[2], zc = vx * F[0] + vy * F[1] + vz * F[2];
      if (zc < 20) return null;
      return [cx + focal * (vx * Rt[0] + vz * Rt[2]) / zc, cy - focal * (vx * U[0] + vy * U[1] + vz * U[2]) / zc, zc];
    };
  }

  // ---------------------------------------------------------------- Lexifina: seven planes of a firm's graph
  var lexi = (function () {
    var PL = ['Time and money', 'Dates and deadlines', 'Correspondence', 'Clients and people', 'Matters and documents', 'Firm knowledge', 'Law'];
    var GAP = 115, PW = 560, PD = 380, R = rng(7);
    var NODES = PL.map(function (n, p) { var a = []; for (var i = 0; i < 26; i++) a.push([(R() - .5) * PW * 1.8, (R() - .5) * PD * 1.8]); return a; });
    var LINKS = []; for (var i = 0; i < 46; i++) { var p = Math.floor(R() * 7), q = Math.min(6, p + 1 + Math.floor(R() * 3)); if (p !== q) LINKS.push([p, Math.floor(R() * 26), q, Math.floor(R() * 26)]); }
    var QUERY = [[4, 3], [3, 7], [5, 12], [1, 5], [0, 9]];   // a question walking the planes: documents, people, knowledge, deadlines, money
    var LIT = [[], [4, 3], [0, 1, 2, 3, 4, 5, 6], [1, 2], [4, 3, 5, 1, 0], [0, 1, 2, 3, 4, 5, 6]];
    function py(p) { return (3 - p) * GAP; }
    function draw(c, step, t, total) {
      var yaw = -0.55 + 0.18 * Math.sin(total * 0.2), pitch = 0.48, dist = 2050;
      var proj = camera([0, 0, 0], yaw, pitch, dist, 760, 560, 1300);
      var build = step === 0 ? t : 99;
      var litSet = LIT[step] || [], since = step === 0 ? 0 : t;
      for (var p = 6; p >= 0; p--) {
        var a = eo((build - p * 0.18) / 1.2); if (a <= 0) continue;
        var y = py(p) * lerp(2.6, 1, a), on = litSet.indexOf(p) >= 0, glow = on ? eo(since / 0.8) : 0;
        var cs = [[-PW, -PD], [PW, -PD], [PW, PD], [-PW, PD]].map(function (q) { return proj(q[0], y, q[1]); });
        if (cs.some(function (v) { return !v; })) continue;
        c.globalAlpha = a;
        c.beginPath(); cs.forEach(function (v, k) { if (!k) c.moveTo(v[0], v[1]); else c.lineTo(v[0], v[1]); }); c.closePath();
        c.fillStyle = on ? hexA(OR, .05 + .1 * glow) : 'rgba(242,236,228,.035)'; c.fill();
        c.strokeStyle = on ? hexA(OR, .5 + .4 * glow) : 'rgba(242,236,228,.24)'; c.lineWidth = on ? 2.5 : 1.4; c.stroke();
        NODES[p].forEach(function (n, k) {
          var v = proj(n[0] * .5, y, n[1] * .5); if (!v) return;
          var r = Math.max(2, 2600 / v[2]) * (on ? 1.25 : 1);
          c.fillStyle = on ? OR : 'rgba(242,236,228,.62)';
          if (on) { c.shadowColor = OR; c.shadowBlur = 10 * glow; }
          c.beginPath(); c.arc(v[0], v[1], r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
        });
        var lab = cs.reduce(function (m, v) { return v[0] < m[0] ? v : m; }); if (lab) {
          c.font = '700 26px Manrope,Arial,sans-serif'; c.textAlign = 'right';
          var lx = Math.max(lab[0] - 18, c.measureText(PL[p]).width + 40);
          c.lineWidth = 7; c.strokeStyle = BG; c.strokeText(PL[p], lx, lab[1] + 7);
          c.fillStyle = on ? OR : MUTED; c.fillText(PL[p], lx, lab[1] + 7); c.textAlign = 'left';
        }
      }
      // edges dropping between planes
      var la = step === 0 ? seg(t, 1.6, 2.6) : 1;
      c.globalAlpha = la;
      LINKS.forEach(function (L, k) {
        var A = NODES[L[0]][L[1]], B = NODES[L[2]][L[3]];
        var u = step === 0 ? ease((t - 1.6 - k * 0.02) / 0.8) : 1; if (u <= 0) return;
        var va = proj(A[0] * .5, py(L[0]), A[1] * .5), vb = proj(B[0] * .5, py(L[2]), B[1] * .5); if (!va || !vb) return;
        var on = litSet.indexOf(L[0]) >= 0 && litSet.indexOf(L[2]) >= 0 && step !== 2;
        c.strokeStyle = on ? hexA(OR, .55) : 'rgba(242,236,228,.16)'; c.lineWidth = on ? 1.8 : 1;
        c.beginPath(); c.moveTo(va[0], va[1]); c.lineTo(lerp(va[0], vb[0], u), lerp(va[1], vb[1], u)); c.stroke();
      });
      c.globalAlpha = 1;
      // a question walking the planes (points 4 and 5)
      if (step >= 4) {
        var pts = QUERY.map(function (q) { var n = NODES[q[0]][q[1]]; return proj(n[0] * .5, py(q[0]), n[1] * .5); });
        var u = step === 4 ? clamp(t / 2.4, 0, 1) * (pts.length - 1) : pts.length - 1;
        c.strokeStyle = OR; c.lineWidth = 4; c.shadowColor = OR; c.shadowBlur = 14; c.setLineDash([16, 12]);
        c.beginPath();
        for (var k = 0; k <= Math.floor(u) && k < pts.length; k++) { if (!pts[k]) continue; if (!k) c.moveTo(pts[k][0], pts[k][1]); else c.lineTo(pts[k][0], pts[k][1]); }
        var f = u % 1, k0 = Math.floor(u);
        if (k0 < pts.length - 1 && pts[k0] && pts[k0 + 1]) c.lineTo(lerp(pts[k0][0], pts[k0 + 1][0], f), lerp(pts[k0][1], pts[k0 + 1][1], f));
        c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
        pts.forEach(function (v, k) { if (v && k <= u) { c.fillStyle = OR; c.beginPath(); c.arc(v[0], v[1], 9, 0, Math.PI * 2); c.fill(); } });
      }
    }
    function overlay() {
      return '<div class="scrim"></div>' +
        '<div style="position:absolute;right:70px;top:80px;width:640px">' +
        '<div class="kick" style="color:' + OR + '">Not just our experience</div>' +
        '<div class="h" style="margin-top:14px">The whole firm in one graph</div>' +
        '<div class="note" style="margin-top:12px">After Lexifina, 20 Oct 2026, on a test firm\'s records</div>' +
        '<div class="pt f" data-at="1">Most of the graph <b>already exists</b> in the firm\'s records. Joining them is cheap.</div>' +
        '<div class="pt f" data-at="2">Built from the records in about 1.6 s with <b>0 model calls</b>: 6,333 nodes and 7,563 edges.</div>' +
        '<div class="pt f" data-at="3">Rules first: a model read only <b>141 of 8,939</b> sentences, for <b>$0.047</b>.</div>' +
        '<div class="pt f" data-at="4">On five test questions: <b>509 s to 139 s</b>, 1.35M to 102k input tokens.</div>' +
        '<div class="pt f" data-at="5">Accuracy unchanged on those questions (99% to 100%), in <b>73% less time</b>.</div>' +
        '<div class="note" style="margin-top:22px">A controlled test on clean text; production results may differ.</div>' +
        '</div>';
    }
    function onStep(ov, i) { toggle(ov, '.pt', function (at) { return at === i ? true : at < i ? 'dim' : false; }); }
    return scene({ steps: 6, draw: draw, overlay: overlay, onStep: onStep });
  })();

  // ---------------------------------------------------------------- Measured elsewhere: a flight between four clusters
  var evid = (function () {
    var SRC = [
      { who: 'Atlassian, Teamwork Graph', when: 'July 2026, agents with and without graph context', c: [-950, 120, -250],
        big: [{ v: 44, s: '%' }, ' more accurate, ', { v: 48, s: '%' }, ' fewer tokens'], cav: 'Their internal benchmark.' },
      { who: 'Codebase-Memory, arXiv paper', when: 'March 2026, 31 real repositories', c: [720, -180, 320],
        big: ['About ', { v: 10, s: 'x' }, ' fewer tokens, ', { v: 2.1, s: 'x', d: 1 }, ' fewer tool calls'], cav: 'The honest trade-off: answer quality 83% against 92% for an agent that reads the files.' },
      { who: 'Microsoft GraphRAG', when: '2024, questions about a whole corpus', c: [-260, -320, 980],
        big: ['About ', { v: 2 }, ' to ', { v: 3, s: '%' }, ' of the tokens'], cav: 'Top-level summaries, which also won about 70 to 80% of judged comparisons with plain retrieval.' },
      { who: 'Honcho, Plastic Labs', when: 'memory that serves curated context', c: [880, 260, -760],
        big: [{ v: 60 }, ' to ', { v: 90, s: '%' }, ' token savings'], cav: 'Their own figure.' }
    ];
    var R = rng(19), PTS = [], EDG = [];
    SRC.forEach(function (S, k) {
      var base = PTS.length;
      for (var i = 0; i < 70; i++) {
        var u = R(), v = R(), w = R(), r = 210 * Math.cbrt(R());
        var th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
        PTS.push({ x: S.c[0] + r * Math.sin(ph) * Math.cos(th), y: S.c[1] + r * Math.cos(ph), z: S.c[2] + r * Math.sin(ph) * Math.sin(th), k: k });
      }
      for (var i2 = 0; i2 < 70; i2++) {
        var a = PTS[base + i2], best = [], bd = [];
        for (var j = 0; j < 70; j++) if (j !== i2) { var b = PTS[base + j], d = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z); best.push([d, base + j]); }
        best.sort(function (p, q) { return p[0] - q[0]; }); EDG.push([base + i2, best[0][1]], [base + i2, best[1][1]]);
      }
    });
    for (var i = 0; i < 260; i++) PTS.push({ x: (R() - .5) * 4200, y: (R() - .5) * 2000, z: (R() - .5) * 4200, k: -1 });
    for (var i3 = 0; i3 < 14; i3++) { var a3 = Math.floor(R() * 4) * 70 + Math.floor(R() * 70), b3 = Math.floor(R() * 4) * 70 + Math.floor(R() * 70); if (Math.floor(a3 / 70) !== Math.floor(b3 / 70)) EDG.push([a3, b3, 1]); }
    var POSE = [{ t: [0, 0, 0], d: 3600, yaw: -0.4 }].concat(SRC.map(function (S, k) { return { t: S.c, d: 820, yaw: -0.4 + k * 0.9 }; }));
    var from = POSE[0], to = POSE[1];
    function poseAt(step, t) {
      var p = ease(t / 1.9), A = step === 0 ? POSE[0] : POSE[step], B = POSE[step + 1];
      return { t: [0, 1, 2].map(function (i) { return lerp(A.t[i], B.t[i], p); }), d: lerp(A.d, B.d, p) - Math.sin(p * Math.PI) * -900, yaw: lerp(A.yaw, B.yaw, p) };
    }
    function draw(c, step, t, total) {
      var P = poseAt(step, t), proj = camera(P.t, P.yaw + total * 0.02, 0.32, P.d, 1320, 470, 1100);
      EDG.forEach(function (e) {
        var a = PTS[e[0]], b = PTS[e[1]], va = proj(a.x, a.y, a.z), vb = proj(b.x, b.y, b.z); if (!va || !vb) return;
        var on = a.k === step && b.k === step && t > 1.4, seen = a.k < step && b.k < step;
        c.strokeStyle = on ? hexA(OR, .5 * seg(t, 1.4, 2.2)) : e[2] ? 'rgba(242,236,228,.07)' : seen ? hexA(OR, .14) : 'rgba(242,236,228,.13)';
        c.lineWidth = on ? 1.6 : 1; c.beginPath(); c.moveTo(va[0], va[1]); c.lineTo(vb[0], vb[1]); c.stroke();
      });
      PTS.forEach(function (n) {
        var v = proj(n.x, n.y, n.z); if (!v) return;
        var on = n.k === step, seen = n.k >= 0 && n.k < step, r = Math.max(1.2, (n.k < 0 ? 1600 : 3800) / v[2]);
        var g = on ? seg(t, 1.2, 2.0) : 0;
        c.fillStyle = on ? mixHex('#d9d2c9', OR, g) : seen ? hexA(OR, .55) : n.k < 0 ? 'rgba(242,236,228,.3)' : 'rgba(242,236,228,.6)';
        if (g > 0) { c.shadowColor = OR; c.shadowBlur = 10 * g; }
        c.beginPath(); c.arc(v[0], v[1], r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
      });
      SRC.forEach(function (S, k) {
        if (k >= step) return;
        var v = proj(S.c[0], S.c[1] + 250, S.c[2]); if (!v) return; v[1] = Math.max(v[1], 190); v[0] = clamp(v[0], 220, 1700);
        c.font = '600 22px Manrope,Arial,sans-serif'; c.textAlign = 'center';
        c.lineWidth = 6; c.strokeStyle = BG; c.strokeText(S.who, v[0], v[1]); c.fillStyle = OR; c.fillText(S.who, v[0], v[1]); c.textAlign = 'left';
      });
    }
    function bigHtml(parts) { return parts.map(function (p, n) { return typeof p === 'string' ? p : '<b class="cnt" data-v="' + p.v + '" data-s="' + (p.s || '') + '" data-d="' + (p.d || 0) + '">0' + (p.s || '') + '</b>'; }).join(''); }
    function overlay() {
      var h = '<div style="position:absolute;left:80px;top:72px"><div class="kick">Not just us: measured elsewhere</div>' +
        '<div style="margin-top:12px;font-size:28px;color:' + MUTED + '">Different teams, different methods, the same direction: less reading, fewer tokens.</div></div>';
      SRC.forEach(function (S, k) {
        h += '<div class="card f" data-at="' + k + '" style="position:absolute;left:80px;bottom:150px;width:1000px">' +
          '<div class="who">' + S.who + '</div><div class="when">' + S.when + '</div>' +
          '<div class="big">' + bigHtml(S.big) + '</div><div class="cav">' + S.cav + '</div></div>';
      });
      return h + '<div class="note" style="position:absolute;left:80px;bottom:78px">Sources: atlassian.com/blog (15 Jul 2026), arxiv.org/abs/2603.27277, microsoft.com/research (2 Jul 2024), honcho.dev</div>';
    }
    var raf = 0;
    function onStep(ov, i, back) {
      ov.querySelectorAll('.card').forEach(function (e) { e.classList.toggle('on', +e.dataset.at === i); });
      cancelAnimationFrame(raf);
      var card = ov.querySelector('.card[data-at="' + i + '"]'), cnts = card.querySelectorAll('.cnt'), t0 = performance.now() + (back || RM ? -99999 : 1000);
      function tick(now) {
        var p = eo((now - t0) / 800);
        cnts.forEach(function (e) { var v = +e.dataset.v * p, d = +e.dataset.d; e.textContent = (d ? v.toFixed(d) : Math.round(v)) + e.dataset.s; });
        if (p < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    return scene({ steps: 4, draw: draw, overlay: overlay, onStep: onStep });
  })();

  if (window.Talk) { window.Talk.whyGraph = why; window.Talk.lexifina = lexi; window.Talk.evidence = evid; }
})();
