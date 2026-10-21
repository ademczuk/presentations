/* brief.js: the two motion pages of the 10-page brief deck (brief.html).
 * Scene contract (as the deck's other scenes): { steps, mount(host), step(i) }.
 * Every number on screen is MeshyChat's own, sourced in research-facts.md section 9 (21 Oct 2026).
 * Calm mode (?calm) and reduced motion render the end state of each step without animation. */
(function () {
  'use strict';
  var calm = function () { return !!window.__calm || document.documentElement.classList.contains('calm'); };
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  var css = '' +
    '.bf-full{inset:0!important;border:0!important;border-radius:0!important}' +
    '.bf{position:absolute;inset:0;color:#f4f8ff;font-family:Inter,Arial,sans-serif}' +
    '.bf .bf-fade{opacity:0;transition:opacity .6s ease,transform .6s ease}' +
    '.bf .bf-fade.on{opacity:1}' +
    '.bf .bf-up{transform:translateY(24px)}.bf .bf-up.on{transform:none}' +
    '.bf-head{position:absolute;left:48px;top:30px;font:600 22px/1 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#9fb3da}' +
    '.bf-tiles{position:absolute;left:48px;right:48px;top:84px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;transition:transform .8s ease,opacity .8s ease}' +
    '.bf-tile{padding:24px 28px;border-radius:20px;background:#ffffff0d;border:1px solid #ffffff1f}' +
    '.bf-tile b{display:block;font-size:64px;line-height:1;font-weight:800;letter-spacing:-.04em}' +
    '.bf-tile .lbl{display:block;margin-top:10px;font-size:22px;color:#b9c8e6}.bf-tile .num{font:inherit}' +
    '.bf-chart{position:absolute;left:48px;right:48px;top:300px;height:400px;transition:opacity .8s ease,transform .8s ease}' +
    '.bf-chart h4{margin:0 0 14px;font-size:22px;font-weight:600;color:#9fb3da}' +
    '.bf-legend{position:absolute;right:0;top:0;font-size:20px;color:#b9c8e6}.bf-legend i{display:inline-block;width:16px;height:16px;border-radius:4px;margin:0 8px 0 22px;vertical-align:-2px}' +
    '.bf-bars{position:absolute;left:0;right:0;bottom:40px;height:300px;display:grid;grid-template-columns:repeat(5,1fr);gap:36px;align-items:end}' +
    '.bf-wk{position:relative;height:100%;display:flex;gap:10px;align-items:flex-end;justify-content:center}' +
    '.bf-bar{width:46%;border-radius:10px 10px 4px 4px;height:0;transition:height 1s cubic-bezier(.2,.8,.2,1);position:relative}' +
    '.bf-bar em{position:absolute;left:0;right:0;top:-32px;text-align:center;font-style:normal;font-size:22px;font-weight:700}' +
    '.bf-bar.c{background:linear-gradient(180deg,#c4b5fd,#7c3aed)}.bf-bar.p{background:linear-gradient(180deg,#6ee7b7,#059669)}' +
    '.bf-wk label{position:absolute;left:0;right:0;bottom:-38px;text-align:center;font-size:20px;color:#9fb3da}' +
    '.bf-hero{position:absolute;left:48px;right:48px;top:120px;text-align:center;pointer-events:none}' +
    '.bf-big{font-size:150px;line-height:1;font-weight:800;letter-spacing:-.05em;background:linear-gradient(90deg,#67e8f9,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.bf-line{margin-top:18px;font-size:44px;font-weight:700}' +
    '.bf-sub{margin-top:14px;font-size:30px;color:#b9c8e6}' +
    '.bf.bf-dim .bf-tiles.on{opacity:.07;transform:scale(.94)}.bf.bf-dim .bf-chart.on{opacity:.07}.bf.bf-dim .bf-head.on{opacity:.3}' +
    '.bf-tl{position:absolute;left:48px;right:48px;bottom:40px;height:66px;display:flex;align-items:center;gap:18px}' +
    '.bf-play{width:0;height:0;border-left:24px solid #e7eefc;border-top:15px solid transparent;border-bottom:15px solid transparent}' +
    '.bf-track{position:relative;flex:1;height:8px;border-radius:4px;background:#ffffff26}' +
    '.bf-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:4px;background:#67e8f9;transition:width 2.4s linear}' +
    '.bf-pin{position:absolute;top:-46px;width:40px;height:40px;margin-left:-20px;border-radius:50% 50% 50% 4px;display:grid;place-items:center;font-weight:800;font-size:18px}' +
    '.bf-time{font:600 22px/1 "JetBrains Mono",monospace;color:#b9c8e6}' +
    '.bf-thread{position:absolute;right:48px;top:470px;width:560px;padding:20px 24px;border-radius:18px;background:#0b1328ee;border:1px solid #ffffff26}' +
    '.bf-thread h5{margin:0 0 12px;font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:#9fb3da}' +
    '.bf-cm{display:flex;gap:14px;align-items:flex-start;margin-top:12px}.bf-cm p{margin:0;font-size:24px;line-height:1.25}.bf-cm p b{display:block;font-size:18px;color:#9fb3da}' +
    '.bf-av{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:16px}' +
    '.bf-story{position:absolute;left:48px;top:330px;width:1000px}' +
    '.bf-story p{margin:0 0 14px;font-size:38px;line-height:1.2;font-weight:700}.bf-story p span{color:#9fb3da;font-weight:600}' +
    '.bf-end{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 50% 40%,#1d2a63,#070b18 70%)}' +
    '.bf-end h2{margin:0;font-size:96px;letter-spacing:-.05em;line-height:1.02}.bf-end p{margin:22px 0 0;font-size:32px;color:#b9c8e6}' +
    '.bf-credit{position:absolute;left:48px;bottom:8px;font-size:17px;color:#8091b5}' +
    /* close scene */
    '.bf-close{position:absolute;inset:0;background:radial-gradient(circle at 82% 20%,#2c2670,#0b1120 57%,#060914)}' +
    '.bf-qs{position:absolute;left:150px;right:150px;top:150px;transition:opacity .7s ease,transform .7s ease}' +
    '.bf-q{display:grid;grid-template-columns:620px 1fr;gap:60px;padding:30px 0;border-top:1px solid #7d94c366}' +
    '.bf-q b{font-size:46px;line-height:1.1;color:#91a2c3}.bf-q span{font-size:40px;line-height:1.2}' +
    '.bf-gone .bf-qs{opacity:0;transform:translateY(-40px)}' +
    '.bf-kin{position:absolute;left:0;right:0;top:330px;text-align:center;font-size:120px;font-weight:800;letter-spacing:-.06em;line-height:1}' +
    '.bf-kin span{display:inline-block;opacity:0;transform:translateY(60px) rotate(4deg);transition:opacity .5s ease,transform .7s cubic-bezier(.2,.9,.2,1)}' +
    '.bf-kin.on span{opacity:1;transform:none}' +
    '.bf-kin.up{top:120px;font-size:84px;transition:top .8s ease,font-size .8s ease}' +
    '.bf-sign{position:absolute;left:150px;right:150px;top:300px;display:grid;grid-template-columns:1fr 520px;gap:80px;align-items:center}' +
    '.bf-sign h1{margin:0;font-size:110px;line-height:.95;letter-spacing:-.06em}' +
    '.bf-sign .who{margin-top:24px;font-size:36px;color:#a8c8ff}.bf-sign .full{margin-top:34px;font-size:26px;line-height:1.35;color:#b9c8e6}' +
    '.bf-qr{display:grid;place-items:center;padding:38px 38px 26px;border-radius:30px;background:#fff;color:#15213b;box-shadow:0 28px 80px #0009}' +
    '.bf-qr img{display:block;width:400px;height:400px}.bf-qr span{margin-top:14px;font-size:24px;font-weight:600}' +
    'html.calm .bf *{transition:none!important}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function countUp(el, end, ms, render) {
    render = render || fmt;
    if (calm()) { el.textContent = render(end); return; }
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / ms);
      el.textContent = render(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function on(root, sel, yes) { root.querySelectorAll(sel).forEach(function (e) { e.classList.toggle('on', !!yes); }); }

  /* ---------------------------------------------------------- finale: dashboard to story */
  var WEEKS = [
    { l: 'week 1', c: 741, p: 0 }, { l: 'week 2', c: 391, p: 92 }, { l: 'week 3', c: 506, p: 128 },
    { l: 'week 4', c: 192, p: 59 }, { l: 'week 5 (3 days)', c: 7, p: 7 }
  ];
  var TILES = [
    { v: 30, l: 'days since the first commit', k: '#67e8f9' },
    { v: 1837, l: 'commits', k: '#c4b5fd' },
    { v: 286, l: 'merged pull requests', k: '#6ee7b7' },
    { v: 77, l: 'percent of commits by agent sessions', k: '#fcd34d', pre: 'about ', suf: '%' }
  ];
  var finale = {
    steps: 4,
    mount: function (host) {
      var tiles = TILES.map(function (T, i) {
        return '<div class="bf-tile"><b style="color:' + T.k + '">' + (T.pre ? '<small style="font-size:30px;font-weight:600">' + T.pre + '</small>' : '') +
          '<span class="num" data-n="' + i + '">0</span>' + (T.suf || '') + '</b><span class="lbl">' + T.l + '</span></div>';
      }).join('');
      var maxC = 741;
      var bars = WEEKS.map(function (w) {
        return '<div class="bf-wk"><div class="bf-bar c" data-h="' + Math.round(w.c / maxC * 280) + '"><em style="color:#c4b5fd">' + fmt(w.c) + '</em></div>' +
          '<div class="bf-bar p" data-h="' + Math.round(w.p / maxC * 280) + '"><em style="color:#6ee7b7">' + fmt(w.p) + '</em></div><label>' + w.l + '</label></div>';
      }).join('');
      host.innerHTML = '<div class="bf">' +
        '<div class="bf-head bf-fade" data-s="0">MeshyChat dashboard, the first 30 days</div>' +
        '<div class="bf-tiles bf-fade bf-up" data-s="0">' + tiles + '</div>' +
        '<div class="bf-chart bf-fade" data-s="0"><h4>commits and merged pull requests, by week</h4>' +
          '<div class="bf-legend"><i style="background:#8b5cf6"></i>commits<i style="background:#10b981"></i>merged pull requests</div>' +
          '<div class="bf-bars">' + bars + '</div></div>' +
        '<div class="bf-hero bf-fade bf-up" data-s="1"><div class="bf-big" data-big>0</div>' +
          '<div class="bf-line">of 1,837 commits were written by agent sessions</div>' +
          '<div class="bf-sub">and 286 pull requests merged in 30 days</div></div>' +
        '<div class="bf-thread bf-fade" data-s="2"><h5>comments on this story, an example</h5>' +
          '<div class="bf-cm"><div class="bf-av" style="background:#fbbf24;color:#1c1203">A</div><p><b>Andrew, at 0:03</b>Show how the work changed shape.</p></div>' +
          '<div class="bf-cm bf-fade" data-s="2b"><div class="bf-av" style="background:#22d3ee;color:#03141a">AI</div><p><b>Agent</b>Added the week-by-week beat at 0:05.</p></div></div>' +
        '<div class="bf-story" data-s="2c"><p class="bf-fade bf-up" data-s="2c1">Week 1: 741 commits, <span>no merged pull requests yet.</span></p>' +
          '<p class="bf-fade bf-up" data-s="2c2">Weeks 2 to 5: 286 pull requests merged, <span>each a reviewable change.</span></p></div>' +
        '<div class="bf-tl bf-fade" data-s="2"><div class="bf-play"></div><div class="bf-track"><div class="bf-fill"></div>' +
          '<div class="bf-pin" style="left:30%;background:#fbbf24;color:#1c1203">A</div></div><div class="bf-time">0:08</div></div>' +
        '<div class="bf-end bf-fade" data-s="3"><div><h2>Dashboards become stories.<br>Shared context is the frontier.</h2>' +
          '<p>A team that shares context can tell its own story, and steer it with comments.</p></div></div>' +
        '<div class="bf-credit">Technique after Anthropic&#39;s Claude Motion (beta, October 2026). Our numbers, our code.</div>' +
        '</div>';
      this.root = host.firstChild;
    },
    step: function (i) {
      var r = this.root;
      var show = function (key, yes) { r.querySelectorAll('[data-s="' + key + '"]').forEach(function (e) { e.classList.toggle('on', !!yes); }); };
      show('0', true);
      r.classList.toggle('bf-dim', i >= 1 && i < 3);
      show('1', i === 1);
      show('2', i === 2); show('2b', false); show('2c1', false); show('2c2', false);
      show('3', i >= 3);
      var bars = r.querySelectorAll('.bf-bar');
      if (i === 0) {
        r.querySelectorAll('[data-n]').forEach(function (el) { countUp(el, TILES[+el.dataset.n].v, 1200); });
        bars.forEach(function (b) { b.style.height = '0px'; });
        var grow = function () { bars.forEach(function (b) { b.style.height = b.dataset.h + 'px'; }); };
        calm() ? grow() : setTimeout(grow, 350);
      } else {
        r.querySelectorAll('[data-n]').forEach(function (el) { var T = TILES[+el.dataset.n]; el.textContent = fmt(T.v); });
        bars.forEach(function (b) { b.style.height = b.dataset.h + 'px'; });
      }
      if (i === 1) countUp(r.querySelector('[data-big]'), 1409, 1400);
      var fill = r.querySelector('.bf-fill');
      if (i === 2) {
        r.classList.add('bf-dim');
        fill.style.transition = 'none'; fill.style.width = '0'; void fill.offsetWidth; fill.style.transition = '';
        var later = function (ms, fn) { calm() ? fn() : setTimeout(fn, ms); };
        later(60, function () { fill.style.width = '62%'; });
        later(1400, function () { show('2b', true); });
        later(2200, function () { show('2c1', true); });
        later(3000, function () { show('2c2', true); });
      }
    }
  };

  /* ---------------------------------------------------------- close: three questions, then the line */
  var QS = [
    ['How much autonomy?', 'The routine runs itself. Risky steps wait for a person.'],
    ['Which identity?', 'Every agent signs every message with its own key.'],
    ['Speed without losing control?', 'Authors never review themselves. Every merge is checked.']
  ];
  var close = {
    steps: 3,
    mount: function (host) {
      var qs = QS.map(function (q, k) { return '<div class="bf-q bf-fade bf-up" data-q="' + k + '"><b>' + q[0] + '</b><span>' + q[1] + '</span></div>'; }).join('');
      var words = 'Shared context is the frontier.'.split(' ').map(function (w, k) {
        return '<span style="transition-delay:' + (k * 110) + 'ms">' + w + '</span>';
      }).join(' ');
      host.innerHTML = '<div class="bf bf-close">' +
        '<div class="bf-qs">' + qs + '</div>' +
        '<div class="bf-kin">' + words + '</div>' +
        '<div class="bf-sign bf-fade bf-up"><div><h1>Andrew Demczuk</h1><p class="who">Forward deployed engineer. github.com/ademczuk</p>' +
          '<p class="full">The full 44-slide version of this talk:<br>ademczuk.github.io/presentations/shared-context/slides.html</p></div>' +
          '<figure class="bf-qr" style="margin:0"><img src="qr-brief.png" alt="QR code for this deck"><span>This deck</span></figure></div>' +
        '</div>';
      this.root = host.firstChild;
    },
    step: function (i) {
      var r = this.root, qs = r.querySelectorAll('.bf-q'), kin = r.querySelector('.bf-kin'), sign = r.querySelector('.bf-sign');
      r.classList.toggle('bf-gone', i >= 1);
      kin.classList.toggle('on', i >= 1); kin.classList.toggle('up', i >= 2);
      sign.classList.toggle('on', i >= 2);
      qs.forEach(function (q, k) {
        q.classList.remove('on');
        if (i === 0) { calm() ? q.classList.add('on') : setTimeout(function () { q.classList.add('on'); }, 250 + k * 900); }
      });
    }
  };

  window.Brief = { finale: finale, close: close };
})();
