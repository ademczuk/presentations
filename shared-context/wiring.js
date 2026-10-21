/* wiring.js: how a company's shared memory is wired, one animated slide.
 * Scene contract (as the deck's other scenes): { steps, mount(host), step(i) }.
 * Registers window.Wiring = { wiring: scene }.
 * Design canvas 1920x1080, scaled to fit the host with letterboxing.
 * Every step is declared as an end state, so step(i) works in either direction and step(0) resets.
 * No network requests: no web fonts, no images. */
(function () {
  'use strict';

  var W = 1920, H = 1080;
  var ORANGE = '#ff6a1f';
  var NS = 'http://www.w3.org/2000/svg';

  var TITLES = [
    'How the team shares what it knows',
    'Ask through your own Claude',
    'Hand routine work to agents (pilot)',
    'Ask a person when a decision is needed',
    'Sources in. Answers out. People decide.'
  ];

  var SOURCES = [
    { x: 450, label: 'chat conversations', sub: 'next, once privacy gates clear' },
    { x: 790, label: 'meeting transcripts' },
    { x: 1130, label: 'code repositories' },
    { x: 1470, label: 'data spine', sub: 'next: warehouse data connector' }
  ];
  var SRC_Y = 860;
  var SRC_IN = [870, 925, 995, 1050];      // where each source line meets the memory's bottom edge

  var PEOPLE = [
    { y: 330, label: 'product' },
    { y: 500, label: 'data' },
    { y: 670, label: 'engineering' }
  ];
  var PPL_IN = [455, 500, 545];             // where each person line meets the memory's left edge

  var AGENTS = [
    { y: 330, label: 'review' },
    { y: 450, label: 'research' },
    { y: 570, label: 'build' },
    { y: 690, label: 'distill' }
  ];

  var MEM = { x: 790, y: 390, w: 340, h: 220 };
  var BOT = { cx: 1420, cy: 470, w: 260, h: 120 };
  var AG_CX = 1755, AG_W = 220, AG_H = 80;

  var css = '' +
    '.wr-root{position:absolute;inset:0;overflow:hidden;background:#0e0d0c;color:#f2ece4;' +
      'font-family:Manrope,system-ui,-apple-system,"Segoe UI",Arial,sans-serif}' +
    '.wr-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;' +
      'background:radial-gradient(ellipse 62% 58% at 50% 50%,#2a2622 0%,#1b1916 48%,#0e0d0c 100%)}' +
    '.wr-svg{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible}' +
    '.wr-ring-bg{fill:none;stroke:#a6a098;stroke-opacity:.07;stroke-width:1.5}' +
    '.wr-title{position:absolute;left:160px;right:160px;top:56px;text-align:center;' +
      'font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-weight:700;font-size:68px;line-height:1.1;' +
      'letter-spacing:-.01em;color:#f2ece4;transition:opacity .35s ease}' +
    '.wr-title.wr-out{opacity:0}' +
    '.wr-ln{fill:none;stroke:#a6a098;stroke-opacity:0;stroke-width:2;stroke-linecap:round;' +
      'stroke-dasharray:var(--len);stroke-dashoffset:var(--len);' +
      'transition:stroke-dashoffset .9s ease,stroke .6s ease,stroke-opacity .6s ease}' +
    '.wr-ln.wr-on{stroke-dashoffset:0;stroke-opacity:.55}' +
    '.wr-ln.wr-on.wr-hot{stroke:' + ORANGE + ';stroke-opacity:1}' +
    '.wr-ln.wr-on.wr-dim{stroke-opacity:.25}' +
    '.wr-node{position:absolute;box-sizing:border-box;background:#252321;border:2px solid rgba(217,210,201,.42);' +
      'border-radius:999px;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'text-align:center;white-space:nowrap;opacity:0;transform:translateY(14px);' +
      'transition:opacity .7s ease,transform .7s ease,border-color .6s ease}' +
    '.wr-node.wr-on{opacity:1;transform:none}' +
    '.wr-pill{height:60px;font-size:26px;color:#f2ece4}' +
    '.wr-sub{position:absolute;font-size:22px;color:#d9d2c9;opacity:0;white-space:nowrap;' +
      'transform:translateX(-50%);transition:opacity .7s ease}' +
    '.wr-sub.wr-on{opacity:.72}' +
    '.wr-group{position:absolute;left:0;width:1920px;text-align:center;top:958px;font-size:22px;' +
      'color:#a6a098;opacity:0;transition:opacity .8s ease}' +
    '.wr-group.wr-on{opacity:1}' +
    '.wr-mem{position:absolute;box-sizing:border-box;left:790px;top:390px;width:340px;height:220px;' +
      'border-radius:44px;background:#252321;border:2px solid rgba(242,236,228,.6);' +
      'box-shadow:0 0 80px rgba(0,0,0,.45)}' +
    '.wr-mem-label{position:absolute;left:0;right:0;bottom:30px;text-align:center;' +
      'font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-weight:700;font-size:34px;color:#f2ece4}' +
    '.wr-hotring{position:absolute;box-sizing:border-box;inset:-2px;border-radius:inherit;' +
      'border:2px solid ' + ORANGE + ';opacity:0;transition:opacity .6s ease;pointer-events:none}' +
    '.wr-hotring.wr-on{opacity:1}' +
    '.wr-mem .wr-hotring{box-shadow:0 0 34px rgba(255,106,31,.28)}' +
    '.wr-person{position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;opacity:0;' +
      'transform:translateY(14px);transition:opacity .7s ease,transform .7s ease}' +
    '.wr-person.wr-on{opacity:1;transform:none}' +
    '.wr-badge{height:40px;font-size:22px;color:#d9d2c9;border-color:rgba(166,160,152,.38)}' +
    '.wr-bot{border-radius:30px}' +
    '.wr-bot b{font-weight:600;font-size:30px;color:#f2ece4}' +
    '.wr-bot span{font-family:"JetBrains Mono",Consolas,monospace;font-size:22px;color:#a6a098;margin-top:6px}' +
    '.wr-card{border-radius:20px;border-color:rgba(166,160,152,.38)}' +
    '.wr-card b{font-weight:600;font-size:26px;color:#f2ece4}' +
    '.wr-stat{position:relative;height:22px;width:140px;margin-top:6px}' +
    '.wr-stat i{position:absolute;inset:0;font-style:normal;font-family:"JetBrains Mono",Consolas,monospace;' +
      'font-size:22px;color:#a6a098;letter-spacing:.06em;opacity:0;transition:opacity .5s ease;' +
      'display:flex;align-items:center;justify-content:center;gap:8px}' +
    '.wr-stat i.wr-on{opacity:1}' +
    '.wr-stat i.wr-w{color:#d9d2c9}' +
    '.wr-stat i.wr-q{color:' + ORANGE + '}' +
    '.wr-pulse{width:8px;height:8px;border-radius:50%;background:#d9d2c9;animation:wr-pulse 1.6s ease-in-out infinite}' +
    '@keyframes wr-pulse{0%,100%{opacity:.3}50%{opacity:1}}' +
    '.wr-gate{position:absolute;left:-22px;top:50%;width:40px;height:40px;margin-top:-20px;border-radius:50%;' +
      'background:#252321;border:2px solid ' + ORANGE + ';box-sizing:border-box}' +
    '.wr-flag{position:absolute;font-size:22px;color:' + ORANGE + ';white-space:nowrap;opacity:0;' +
      'transform:translateX(-50%);transition:opacity .6s ease}' +
    '.wr-flag.wr-on{opacity:1}' +
    '.wr-check{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;' +
      'background:' + ORANGE + ';opacity:0;transform:scale(.6);transition:opacity .5s ease,transform .5s ease}' +
    '.wr-check.wr-on{opacity:1;transform:none}' +
    '.wr-chip{position:absolute;left:0;top:0;height:40px;padding:0 18px;box-sizing:border-box;border-radius:999px;' +
      'background:#252321;border:2px solid ' + ORANGE + ';font-size:22px;color:#f2ece4;white-space:nowrap;' +
      'display:flex;align-items:center;opacity:0;pointer-events:none}' +
    '.wr-dot{transition:none}' +
    '.wr-rm *,.wr-rm *::before,.wr-rm *::after{transition:none!important;animation:none!important}';

  function injectCss() {
    if (document.getElementById('wr-style')) return;
    var s = document.createElement('style');
    s.id = 'wr-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, style, html, parent) {
    var e = document.createElement('div');
    e.className = cls;
    if (style) e.setAttribute('style', style);
    if (html) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  var CHECK_SVG = '<svg width="36" height="36" viewBox="0 0 36 36"><path d="M10 18.5l5.5 5.5L26 13" ' +
    'fill="none" stroke="#0e0d0c" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SMALL_CHECK = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" fill="none" ' +
    'stroke="#d9d2c9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var GATE_SVG = '<svg width="36" height="36" viewBox="0 0 36 36" style="position:absolute;left:0;top:0">' +
    '<path d="M11 26V11M25 26V11M11 15h14M11 21h14" fill="none" stroke="' + ORANGE + '" stroke-width="2" ' +
    'stroke-linecap="round"/></svg>';
  var PERSON_SVG = '<svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="36" fill="#252321" ' +
    'stroke="rgba(217,210,201,.5)" stroke-width="2"/><circle cx="38" cy="29" r="10" fill="none" stroke="#f2ece4" ' +
    'stroke-width="2"/><path d="M19 58c2.5-10 10-15 19-15s16.5 5 19 15" fill="none" stroke="#f2ece4" ' +
    'stroke-width="2" stroke-linecap="round"/></svg>';

  function build(root) {
    var stage = div('wr-stage', '', '', root);
    var svg = svgEl('svg', { 'class': 'wr-svg', viewBox: '0 0 1920 1080' }, stage);
    stage._svg = svg;

    // faint topographic rings around the memory
    for (var r = 0; r < 6; r++) {
      svgEl('ellipse', { 'class': 'wr-ring-bg', cx: 960, cy: 500, rx: 260 + r * 135, ry: 170 + r * 92 }, svg);
    }

    var gLines = svgEl('g', {}, svg);
    var gDots = svgEl('g', {}, svg);
    var refs = { stage: stage, lines: {}, nodes: {}, gDots: gDots };

    function line(id, d) {
      var p = svgEl('path', { 'class': 'wr-ln', d: d }, gLines);
      refs.lines[id] = p;
      return p;
    }

    SOURCES.forEach(function (s, i) {
      var mx = SRC_IN[i];
      line('src' + i, 'M ' + s.x + ' ' + (SRC_Y - 32) + ' C ' + s.x + ' 730, ' + mx + ' 700, ' + mx + ' ' + (MEM.y + MEM.h));
    });
    PEOPLE.forEach(function (p, i) {
      var by = p.y + 40, my = PPL_IN[i];
      line('ppl' + i, 'M 420 ' + by + ' C 600 ' + by + ', 640 ' + my + ', ' + MEM.x + ' ' + my);
    });
    line('task', 'M 418 366 C 650 190, 1230 200, ' + BOT.cx + ' ' + (BOT.cy - BOT.h / 2));
    AGENTS.forEach(function (a, i) {
      var x0 = BOT.cx + BOT.w / 2, x1 = AG_CX - AG_W / 2;
      line('fan' + i, 'M ' + x0 + ' ' + BOT.cy + ' C ' + (x0 + 50) + ' ' + BOT.cy + ', ' + (x1 - 45) + ' ' + a.y + ', ' + x1 + ' ' + a.y);
    });
    line('decide', 'M ' + (AG_CX - AG_W / 2) + ' 318 C 1350 150, 500 120, 140 278');
    line('back', 'M ' + (BOT.cx - BOT.w / 2) + ' ' + BOT.cy + ' C 1220 ' + BOT.cy + ', 1200 500, ' + (MEM.x + MEM.w) + ' 500');

    // shared memory node with a small graph glyph
    var mem = div('wr-mem', '', '', stage);
    var gl = '<svg width="340" height="140" viewBox="0 0 340 140" style="position:absolute;left:0;top:14px">';
    var pts = [[110, 62], [158, 34], [214, 50], [246, 92], [192, 100], [140, 98], [96, 106], [178, 66]];
    var eds = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 5], [1, 7], [7, 2], [7, 4], [7, 5]];
    eds.forEach(function (e) {
      gl += '<line x1="' + pts[e[0]][0] + '" y1="' + pts[e[0]][1] + '" x2="' + pts[e[1]][0] + '" y2="' + pts[e[1]][1] +
        '" stroke="#a6a098" stroke-opacity=".6" stroke-width="1.5"/>';
    });
    pts.forEach(function (p, i) {
      gl += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === 7 ? 7 : 5) + '" fill="' + (i === 7 ? '#f2ece4' : '#d9d2c9') + '"/>';
    });
    gl += '</svg>';
    mem.innerHTML = gl + '<div class="wr-mem-label">shared memory</div>';
    refs.memHot = div('wr-hotring', '', '', mem);

    // sources
    SOURCES.forEach(function (s, i) {
      refs.nodes['src' + i] = div('wr-node wr-pill', 'left:' + (s.x - 145) + 'px;top:' + (SRC_Y - 30) + 'px;width:290px', s.label, stage);
      if (s.sub) refs.nodes['srcsub' + i] = div('wr-sub', 'left:' + s.x + 'px;top:' + (SRC_Y + 38) + 'px', s.sub, stage);
    });
    refs.group = div('wr-group', '', 'meetings and code today; chat and business data next', stage);

    // people
    PEOPLE.forEach(function (p, i) {
      refs.nodes['icon' + i] = div('wr-person', 'left:130px;top:' + (p.y + 5) + 'px', PERSON_SVG, stage);
      refs.nodes['role' + i] = div('wr-node wr-pill', 'left:195px;top:' + (p.y - 48) + 'px;width:210px;height:56px', p.label, stage);
      refs.nodes['badge' + i] = div('wr-node wr-badge', 'left:182px;top:' + (p.y + 20) + 'px;width:236px', 'their AI assistant', stage);
    });
    refs.check = div('wr-check', 'left:172px;top:' + (PEOPLE[0].y - 30) + 'px', CHECK_SVG, stage);

    // company bot
    refs.nodes.bot = div('wr-node wr-bot', 'left:' + (BOT.cx - BOT.w / 2) + 'px;top:' + (BOT.cy - BOT.h / 2) + 'px;width:' +
      BOT.w + 'px;height:' + BOT.h + 'px', '<b>company bot</b><span>meta-orchestrator</span>', stage);
    refs.botHot = div('wr-hotring', '', '', refs.nodes.bot);

    // agents
    refs.cards = [];
    AGENTS.forEach(function (a, i) {
      var c = div('wr-node wr-card', 'left:' + (AG_CX - AG_W / 2) + 'px;top:' + (a.y - AG_H / 2) + 'px;width:' + AG_W + 'px;height:' + AG_H + 'px',
        '<b>' + a.label + '</b><div class="wr-stat"><i class="wr-w"><span class="wr-pulse"></span>working</i>' +
        '<i class="wr-q">waiting</i><i>' + SMALL_CHECK + 'done</i></div>', stage);
      var ring = div('wr-hotring', '', '', c);
      var st = c.querySelectorAll('.wr-stat i');
      var card = { el: c, ring: ring, work: st[0], wait: st[1], done: st[2] };
      if (i === 0) card.gate = div('wr-gate wr-hotring', 'inset:auto;left:-22px', GATE_SVG, c);
      refs.cards.push(card);
    });
    refs.flag = div('wr-flag', 'left:' + AG_CX + 'px;top:' + (AGENTS[0].y - AG_H / 2 - 40) + 'px', 'needs a decision', stage);

    refs.chip = div('wr-chip', '', 'decisions and open work', stage);
    refs.title = div('wr-title', '', TITLES[0], stage);
    return refs;
  }

  /* Flows: dots that travel along a line. loop flows repeat; once flows travel one time.
   * dir -1 travels the path backwards. delay may depend on the step. */
  function flowList() {
    var f = [];
    SOURCES.forEach(function (s, i) {
      f.push({ line: 'src' + i, steps: [0, 1, 2, 3, 4], n: 2, period: 2.8, dir: 1, color: '#d9d2c9',
        delay: function (st) { return st === 0 ? 0.9 + i * 0.22 : 0; } });
    });
    f.push({ line: 'ppl0', steps: [1], once: true, start: 0.15, period: 0.7, dir: 1, color: '#f2ece4', r: 7 });
    f.push({ line: 'ppl0', steps: [1], once: true, start: 0.95, period: 0.9, dir: -1, color: ORANGE, r: 7, chip: true });
    f.push({ line: 'task', steps: [2], once: true, start: 0.15, period: 0.9, dir: 1, color: ORANGE, r: 7 });
    AGENTS.forEach(function (a, i) {
      f.push({ line: 'fan' + i, steps: [2], n: 1, period: 1.6, dir: 1, color: ORANGE, delay: function () { return 1.0 + i * 0.1; } });
    });
    f.push({ line: 'decide', steps: [3], once: true, start: 0.2, period: 0.8, dir: 1, color: ORANGE, r: 7 });
    f.push({ line: 'decide', steps: [3], once: true, start: 1.05, period: 0.6, dir: -1, color: ORANGE, r: 7 });
    AGENTS.forEach(function (a, i) {
      f.push({ line: 'fan' + i, steps: [4], n: 1, period: 1.4, dir: -1, color: ORANGE, delay: function () { return 0.5 + i * 0.12; } });
    });
    f.push({ line: 'back', steps: [4], n: 2, period: 1.2, dir: 1, color: ORANGE, delay: function () { return 0.9; } });
    return f;
  }

  var CHIP_STOP = 0.25;   // the answer chip parks here on the product line (fraction of the line from the person)

  function makeScene() {
    var host = null, root = null, refs = null, flows = null;
    var cur = -1, t0 = 0, raf = 0, titleTimer = 0, ro = null;

    function fit() {
      if (!root || !refs) return;
      var w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) return;
      var k = Math.min(w / W, h / H);
      var x = (w - W * k) / 2, y = (h - H * k) / 2;
      refs.stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    }

    function measure() {
      for (var id in refs.lines) {
        var p = refs.lines[id];
        if (p._len) continue;
        var L = 0;
        try { L = p.getTotalLength(); } catch (e) { L = 0; }
        if (L > 0) { p._len = L; p.style.setProperty('--len', String(Math.ceil(L) + 2)); }
      }
    }

    function set(el, cls, on, delay, fwd) {
      if (!el) return;
      var has = el.classList.contains(cls);
      if (has === !!on) return;
      el.style.transitionDelay = (fwd && on && delay) ? (delay + 's') : '0s';
      el.classList.toggle(cls, !!on);
    }

    function setTitle(i, animate) {
      clearTimeout(titleTimer);
      var t = refs.title;
      if (!animate) { t.textContent = TITLES[i]; t.classList.remove('wr-out'); return; }
      if (t.textContent === TITLES[i] && !t.classList.contains('wr-out')) return;
      t.classList.add('wr-out');
      titleTimer = setTimeout(function () { t.textContent = TITLES[i]; t.classList.remove('wr-out'); }, 360);
    }

    function apply(i, fwd) {
      var L = refs.lines, N = refs.nodes, C = refs.cards;
      var first = (i === 0);

      // sources: always on, staggered on first entry
      SOURCES.forEach(function (s, j) {
        set(N['src' + j], 'wr-on', true, first ? 0.1 + j * 0.22 : 0, fwd);
        set(L['src' + j], 'wr-on', true, first ? 0.3 + j * 0.22 : 0, fwd);
        if (N['srcsub' + j]) set(N['srcsub' + j], 'wr-on', true, first ? 0.25 + j * 0.22 : 0, fwd);
      });
      set(refs.group, 'wr-on', true, first ? 1.0 : 0, fwd);

      // people
      PEOPLE.forEach(function (p, j) {
        var on = i >= 1;
        set(N['icon' + j], 'wr-on', on, j * 0.15, fwd);
        set(N['role' + j], 'wr-on', on, j * 0.15, fwd);
        set(N['badge' + j], 'wr-on', on, 0.1 + j * 0.15, fwd);
        // hot and dim first, so the draw-in stagger on wr-on keeps its own delay
        set(L['ppl' + j], 'wr-hot', i === 1 && j === 0, 0, fwd);
        set(L['ppl' + j], 'wr-dim', i === 1 && j !== 0, 0, fwd);
        set(L['ppl' + j], 'wr-on', on, 0.3 + j * 0.15, fwd);
      });
      set(refs.memHot, 'wr-on', i === 1 || i === 4, i === 1 ? 0.8 : 0.6, fwd);
      if (i !== 1) refs.chip.style.opacity = '0';

      // bot, task and agents
      set(N.bot, 'wr-on', i >= 2, 0, fwd);
      set(refs.botHot, 'wr-on', i === 2 || i === 4, i === 2 ? 0.9 : 0.6, fwd);
      set(L.task, 'wr-on', i >= 2, 0, fwd);
      set(L.task, 'wr-hot', i === 2, 0, fwd);
      set(L.task, 'wr-dim', i >= 3, 0, fwd);
      C.forEach(function (c, j) {
        set(c.el, 'wr-on', i >= 2, 0.8 + j * 0.1, fwd);
        set(L['fan' + j], 'wr-hot', i === 2 || i === 4, i === 2 ? 0.9 : 0.3, fwd);
        set(L['fan' + j], 'wr-on', i >= 2, 0.7 + j * 0.1, fwd);
        var isGate = (j === 0);
        set(c.work, 'wr-on', i === 2 || (i === 3 && !isGate), 1.0 + j * 0.1, fwd);
        set(c.wait, 'wr-on', false, 0, fwd);
        set(c.done, 'wr-on', i >= 4 || (i === 3 && isGate), i === 3 ? 1.6 : 0.3 + j * 0.12, fwd);
        set(c.ring, 'wr-on', (i === 3 && isGate) || i === 4, i === 4 ? 0.3 + j * 0.12 : 0, fwd);
        if (c.gate) set(c.gate, 'wr-on', i === 3, 0, fwd);
      });
      // the gated card shows "waiting" until the person decides
      if (i === 3) {
        var g = C[0];
        set(g.wait, 'wr-on', true, 0, fwd);
        // the wait label clears when the decision lands
        g._waitTimer && clearTimeout(g._waitTimer);
        if (!reduced()) g._waitTimer = setTimeout(function () { if (cur === 3) g.wait.classList.remove('wr-on'); }, 1600);
        else g.wait.classList.remove('wr-on');
      } else if (C[0]._waitTimer) { clearTimeout(C[0]._waitTimer); }

      set(refs.flag, 'wr-on', i === 3, 0.1, fwd);
      set(L.decide, 'wr-on', i >= 3, 0, fwd);
      set(L.decide, 'wr-hot', i === 3, 0, fwd);
      set(L.decide, 'wr-dim', i >= 4, 0, fwd);
      set(refs.check, 'wr-on', i >= 3, 1.0, fwd);
      set(L.back, 'wr-on', i >= 4, 0.4, fwd);
      set(L.back, 'wr-hot', i >= 4, 0.4, fwd);
    }

    function ensureDots() {
      if (flows) return;
      flows = flowList();
      flows.forEach(function (f) {
        f.dots = [];
        var n = f.once ? 1 : f.n;
        for (var k = 0; k < n; k++) {
          f.dots.push(svgEl('circle', { 'class': 'wr-dot', r: f.r || 5, fill: f.color, opacity: 0 }, refs.gDots));
        }
      });
    }

    // the chip sits above the line, its left end just behind the dot, so it never covers a line or a node
    function placeChip(p, s, op) {
      var L = p._len || 0;
      if (!L) return;
      var pt = p.getPointAtLength(L * s);
      var c = refs.chip;
      c.style.transform = 'translate(' + Math.round(pt.x - 60) + 'px,' + Math.round(pt.y - 62) + 'px)';
      c.style.opacity = String(op);
    }

    function frame(now) {
      raf = 0;
      if (!root || !root.isConnected) return;
      var rm = reduced();
      var el = (now - t0) / 1000;
      flows.forEach(function (f) {
        var p = refs.lines[f.line];
        var active = !rm && f.steps.indexOf(cur) >= 0 && p._len;
        if (f.chip && cur === 1) {
          // the chip rides with the answer, then parks part way along the line
          var sChip = CHIP_STOP, op = 1;
          if (!rm) {
            var ph = (el - f.start) / f.period;
            var s = ph <= 0 ? 1 : 1 - Math.min(ph, 1);
            sChip = Math.max(s, CHIP_STOP);
            op = Math.max(0, Math.min(1, (0.62 - sChip) / 0.15));
          }
          placeChip(p, sChip, op);
        }
        f.dots.forEach(function (d, k) {
          if (!active) { d.setAttribute('opacity', 0); return; }
          var phase;
          if (f.once) {
            phase = (el - f.start) / f.period;
            if (phase < 0 || phase > 1) { d.setAttribute('opacity', 0); return; }
          } else {
            var t = el - (f.delay ? f.delay(cur) : 0);
            if (t < 0) { d.setAttribute('opacity', 0); return; }
            phase = ((t / f.period) + k / f.dots.length) % 1;
          }
          var s2 = f.dir < 0 ? 1 - phase : phase;
          var pt = p.getPointAtLength(p._len * s2);
          d.setAttribute('cx', pt.x.toFixed(1));
          d.setAttribute('cy', pt.y.toFixed(1));
          d.setAttribute('opacity', (0.15 + 0.85 * Math.sin(Math.PI * phase)).toFixed(2));
        });
      });
      raf = requestAnimationFrame(frame);
    }

    return {
      steps: 5,
      mount: function (h) {
        injectCss();
        host = h;
        host.classList.add('tk-full');
        host.innerHTML = '';
        root = div('wr-root', '', '', host);
        refs = build(root);
        fit();
        window.addEventListener('resize', fit);
        if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(root); }
      },
      step: function (i) {
        if (!refs) return;
        i = Math.max(0, Math.min(4, i | 0));
        fit();
        measure();
        ensureDots();
        var rm = reduced();
        root.classList.toggle('wr-rm', rm);
        var fwd = !rm && i > cur;
        if (i === 0) {
          // full reset: clear everything without transitions, then build step 0 forward
          root.classList.add('wr-rm');
          var all = root.querySelectorAll('.wr-on,.wr-hot,.wr-dim');
          for (var a = 0; a < all.length; a++) { all[a].classList.remove('wr-on', 'wr-hot', 'wr-dim'); }
          void root.offsetWidth;
          root.classList.toggle('wr-rm', rm);
          fwd = !rm;
        }
        cur = i;
        t0 = performance.now();
        setTitle(i, !rm && i !== 0);
        apply(i, fwd);
        if (!raf) raf = requestAnimationFrame(frame);
      }
    };
  }

  window.Wiring = { wiring: makeScene() };
})();
