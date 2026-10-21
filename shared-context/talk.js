/* talk.js: the new pages of the talk deck (talk.html), 22 Oct 2026.
 * Scene contract (as the deck's other scenes): { steps, mount(host), step(i) }.
 * Third-party media is never copied into this repo: Lexifina's film loads from media-local/ (kept out of git)
 * when the deck runs from a laptop folder, and from Lexifina's own player when it does not.
 * To swap in a Claude Motion export, drop the HTML file in media/talk/ and set its path in CONFIG below. */
(function () {
  'use strict';
  var CONFIG = {
    altitude: 'media/talk/altitude.html',      // Claude Motion's Altitude film, with a deck mode (plays once, holds before its fade)
    together: 'media/talk/together.html',      // the team version, built in the same engine; opens on Altitude's last frame
    whyGraph: null,                             // e.g. 'media/talk/why-graph.html' once Claude Motion has built it
    lexifinaLocal: 'media-local/lexifina-firm-graph.mp4',
    lexifinaPlayer: 'https://iframe.videodelivery.net/7df80c0ca5b323c277d2d11847f134d0?controls=false&autoplay=true&muted=true&preload=true&letterboxColor=transparent'
  };

  var css = '' +
    '.tk{position:absolute;inset:0;color:#f4f8ff;font-family:Manrope,Inter,Arial,sans-serif;overflow:hidden;background:#05080f}' +
    '.tk-full{inset:0!important;border:0!important;border-radius:0!important}' +
    '.tk iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0e0d0c}' +
    '.tk video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#05080f}' +
    '.tk .fade{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}' +
    '.tk .fade.on{opacity:1;transform:none}' +
    '.tk-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,#05080f 0,#05080f00 16%),linear-gradient(90deg,#05080ff2 0,#05080fd9 30%,#05080f00 58%),linear-gradient(0deg,#05080fe6 0,#05080f00 32%)}' +
    '.tk-cap{position:absolute;left:56px;top:44px;max-width:1150px;text-shadow:0 2px 18px #000}' +
    '.tk-cap .kick{font:600 22px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}' +
    '.tk-cap h2{margin:14px 0 0;font-size:62px;line-height:1.05;letter-spacing:-.04em}' +
    '.tk-cap p{margin:14px 0 0;font-size:30px;line-height:1.3;color:#c9d6ef}' +
    '.tk-stats{position:absolute;left:56px;bottom:52px;display:flex;gap:44px;text-shadow:0 2px 18px #000}' +
    '.tk-stats b{display:block;font-size:64px;font-weight:800;letter-spacing:-.04em;color:#fff}' +
    '.tk-stats span{font-size:24px;color:#b9c8e6}' +
    '.tk-src{position:absolute;right:28px;bottom:18px;font-size:18px;color:#8ea2c8}' +
    // Lexifina: film on the left two thirds, the key points on the right
    '.tk-lx video,.tk-lx iframe{position:absolute;inset:auto;left:40px;top:7%;width:62%;height:80%;border-radius:18px;filter:brightness(.82) contrast(1.05);box-shadow:0 30px 90px #000a}' +
    '.tk-lx .side{position:absolute;left:66%;right:44px;top:7%;bottom:7%;display:flex;flex-direction:column;gap:18px}' +
    '.tk-lx .side h2{margin:0;font-size:40px;line-height:1.1;letter-spacing:-.03em}' +
    '.tk-lx .side .who{font-size:20px;color:#8ea2c8;margin-top:-8px}' +
    '.tk-lx .side .kick2{font:600 18px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}' +
    '.tk-lx .pt{padding:16px 20px;border-radius:16px;background:#ffffff0d;border:1px solid #ffffff1f;font-size:24px;line-height:1.3;color:#dfe8fa}' +
    '.tk-lx .pt b{color:#67e8f9}' +
    '.tk-lx .note{font-size:18px;color:#8ea2c8;margin-top:auto}' +
    // why a graph: our own build of the argument, used until a Claude Motion version is dropped in
    '.tk-wg{background:#07090d;font-family:"JetBrains Mono",Consolas,monospace}' +
    '.tk-wg .ask{position:absolute;left:70px;top:70px;width:640px;padding:26px 30px;border:1px solid #ffffff22;border-radius:16px;background:#0f1218;font-size:38px;line-height:1.25}' +
    '.tk-wg .ask em{font-style:normal;color:#6ee7b7}' +
    '.tk-wg .agent{position:absolute;left:70px;top:270px;width:780px;font-size:25px;line-height:1.9;color:#c7cfdc}' +
    '.tk-wg .agent .st{display:inline-block;padding:4px 12px;border-radius:8px;background:#ffffff10;color:#6ee7b7;margin-bottom:8px}' +
    '.tk-wg .agent .bad{color:#fb7185}' +
    '.tk-wg .tk-bar{position:absolute;left:70px;top:620px;width:640px}' +
    '.tk-wg .tk-bar i{display:block;height:14px;border-radius:7px;background:linear-gradient(90deg,#fbbf24,#fb7185);width:0;transition:width 2.2s ease}' +
    '.tk-wg .tk-bar span{display:block;margin-bottom:10px;font-size:20px;color:#8ea2c8;letter-spacing:.12em}' +
    '.tk-wg svg{position:absolute;left:790px;top:90px;width:1060px;height:720px}' +
    '.tk-wg .line{position:absolute;left:0;right:0;bottom:70px;text-align:center;font-size:52px;color:#f4f8ff}' +
    '.tk-wg .line em{font-style:normal;color:#6ee7b7}' +
    // measured elsewhere: one row per source, each with its caveat
    '.tk-ev{background:radial-gradient(circle at 30% 20%,#2a2622 0,transparent 55%),#0e0d0c;color:#f2ece4;padding:84px 120px}' +
    '.tk-ev h2{margin:0;font:700 66px/1.05 "Source Serif 4",Georgia,serif;letter-spacing:-.02em}' +
    '.tk-ev .sub{margin:14px 0 40px;font-size:30px;color:#a6a098}' +
    '.tk-ev .row{display:grid;grid-template-columns:420px 1fr;gap:36px;padding:22px 0;border-top:1px solid #ffffff22;align-items:baseline}' +
    '.tk-ev .who{font-size:28px;font-weight:700}.tk-ev .who small{display:block;font-size:20px;font-weight:600;color:#8b857d;margin-top:6px}' +
    '.tk-ev .res{font-size:34px;line-height:1.25}.tk-ev .res b{color:#ff6a1f}.tk-ev .res small{display:block;font-size:21px;color:#a6a098;margin-top:6px}' +
    '.tk-ev .src{position:absolute;left:120px;bottom:30px;font-size:18px;color:#8b857d}' +
    // close
    '.tk-close{background:radial-gradient(circle at 30% 20%,#2a2622 0,transparent 45%),#0e0d0c;display:flex;align-items:center;justify-content:space-between;padding:0 120px}' +
    '.tk-close h1{margin:0;font:700 92px/1.04 "Source Serif 4",Georgia,serif;letter-spacing:-.02em;max-width:1000px;color:#f2ece4}' +
    '.tk-close p{font-size:34px;color:#a6a098;margin:26px 0 0}' +
    '.tk-close figure{margin:0;display:grid;place-items:center;padding:34px 34px 24px;border-radius:28px;background:#f2ece4;color:#1d1b19}' +
    '.tk-close figure img{display:block;width:360px;height:360px}.tk-close figure span{margin-top:12px;font-size:24px;font-weight:600}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function fades(root, n) { root.querySelectorAll('[data-at]').forEach(function (e) { e.classList.toggle('on', +e.dataset.at <= n); }); }

  // A page that plays an HTML animation (Altitude, or the team version) from its first frame.
  // The film loads when the deck starts and waits on frame 0, so entering the page shows it at once (no placeholder);
  // step(0) sends 'play'; a second right press sends 'end' (jump to the held last frame) before the deck moves on.
  function framePage(getSrc, fallback) {
    var frame = null, ready = false, used = false, lastStart = 0, pending = null;
    function send(msg) { try { frame.contentWindow.postMessage(msg, '*'); } catch (e) {} }
    function load() {
      var src = getSrc(); ready = false; used = false;
      frame.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'deck=1&wait=1&r=' + (++load.n);
    }
    load.n = 0;
    return {
      steps: 2,
      mount: function (host) {
        var src = getSrc();
        host.classList.add('tk-full');
        if (!src) { host.innerHTML = fallback; return; }
        host.innerHTML = '';
        var box = el('<div class="tk"></div>'); frame = document.createElement('iframe');
        frame.title = 'animation'; frame.tabIndex = -1; frame.style.pointerEvents = 'none';
        frame.onload = function () { ready = true; if (pending) { send(pending); if (pending === 'play') used = true; pending = null; } try { window.focus(); } catch (e) {} };
        box.appendChild(frame); host.appendChild(box); load();
      },
      step: function (i) {
        if (!frame) return;
        if (i === 0) {
          var now = (window.performance && performance.now()) || 0;
          if (now - lastStart < 1200) return;            // the deck activates a page twice; start it once
          lastStart = now;
          if (used) { load(); pending = 'play'; return; }  // re-entry: reload, then play from frame 0
          if (ready) { send('play'); used = true; } else pending = 'play';
        } else if (i === 1) send('end');
      }
    };
  }

  // A full-screen looping film of one of our graphs, with a caption that builds over it.
  function graphFilm(o) {
    var root = null, video = null;
    return {
      steps: o.steps,
      mount: function (host) {
        host.classList.add('tk-full');
        root = el('<div class="tk">' +
          '<video muted loop playsinline preload="auto" poster="' + o.poster + '"' + (o.videoStyle ? ' style="' + o.videoStyle + '"' : '') + '><source src="' + o.src + '" type="video/mp4"></video>' +
          '<div class="tk-shade"></div>' +
          '<div class="tk-cap"><div class="kick fade" data-at="0">' + o.kick + '</div><h2 class="fade" data-at="0">' + o.title + '</h2>' +
          (o.sub ? '<p class="fade" data-at="0">' + o.sub + '</p>' : '') + '</div>' +
          (o.stats ? '<div class="tk-stats fade" data-at="' + (o.steps - 1) + '">' + o.stats.map(function (x) { return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' : '') +
          (o.src2 ? '<div class="tk-src">' + o.src2 + '</div>' : '') + '</div>');
        host.innerHTML = ''; host.appendChild(root); video = root.querySelector('video');
      },
      step: function (i) {
        fades(root, i);
        if (i === 0 && video) { try { video.currentTime = 0; video.play().catch(function () {}); } catch (e) {} }
      }
    };
  }

  // Lexifina's film with the article's key points stepping in beside it.
  var lexifina = (function () {
    var root = null, video = null, usingPlayer = false;
    function usePlayer() {
      if (usingPlayer || !root) return; usingPlayer = true;
      if (video) video.remove();
      var f = document.createElement('iframe'); f.src = CONFIG.lexifinaPlayer; f.title = 'The whole firm in one graph (Lexifina)';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.tabIndex = -1; f.style.pointerEvents = 'none';
      root.insertBefore(f, root.firstChild);
    }
    return {
      steps: 6,
      mount: function (host) {
        host.classList.add('tk-full');
        root = el('<div class="tk tk-lx">' +
          '<video muted playsinline preload="auto"><source src="' + CONFIG.lexifinaLocal + '" type="video/mp4"></video>' +
          '<div class="side"><div class="kick2">Not just our experience</div><h2>The whole firm in one graph</h2><div class="who">Lexifina, 20 Oct 2026, on a test firm\'s records</div>' +
          '<div class="pt fade" data-at="1">Most of the graph <b>already exists</b> in the firm\'s records. Joining them is cheap.</div>' +
          '<div class="pt fade" data-at="2">Built from the records in about 1.6 s with <b>0 model calls</b>: 6,333 nodes and 7,563 edges.</div>' +
          '<div class="pt fade" data-at="3">Rules first: a model read only <b>141 of 8,939</b> sentences, for <b>$0.047</b>.</div>' +
          '<div class="pt fade" data-at="4">On five test questions: <b>509 s to 139 s</b>, 1.35M to 102k input tokens.</div>' +
          '<div class="pt fade" data-at="5">Accuracy unchanged on those questions (99% to 100%), in <b>73% less time</b>.</div>' +
          '<div class="note">A controlled test on clean text; production results may differ.</div></div></div>');
        host.innerHTML = ''; host.appendChild(root); video = root.querySelector('video');
        video.addEventListener('error', usePlayer, true);
        video.querySelector('source').addEventListener('error', usePlayer);
        setTimeout(function () { if (video && video.readyState === 0) usePlayer(); }, 2500);
      },
      step: function (i) {
        fades(root, i);
        if (i === 0 && video && !usingPlayer) { try { video.currentTime = 0; video.play().catch(function () {}); } catch (e) {} }
      }
    };
  })();

  // Why a graph: question, the agent drowning in grep, then the same code read as a graph.
  var whyGraphOwn = (function () {
    var root = null;
    var cells = [], X0 = 40, Y0 = 60, CW = 70, CH = 120, GAP = 22;
    var dirs = ['api/', 'billing/', 'orders/', 'auth/', 'queue/', 'shared/'];
    function grid() {
      var s = '';
      dirs.forEach(function (d, k) {
        var gx = X0 + (k % 3) * 340, gy = Y0 + Math.floor(k / 3) * 320;
        s += '<rect x="' + (gx - 16) + '" y="' + (gy - 40) + '" width="300" height="300" rx="14" fill="none" stroke="#ffffff1c"/>' +
             '<text x="' + gx + '" y="' + (gy - 14) + '" fill="#8ea2c8" font-size="18" letter-spacing="2">' + d.toUpperCase() + '</text>';
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
          var x = gx + c * (CW + GAP / 2 + 6), y = gy + r * (CH + 14);
          cells.push([x + CW / 2, y + CH / 2]);
          s += '<rect class="cell" x="' + x + '" y="' + y + '" width="' + CW + '" height="' + CH + '" rx="6" fill="#ffffff08" stroke="#ffffff22"/>';
        }
      });
      return s;
    }
    function zig() {
      var order = [2, 8, 15, 21, 27, 33, 30, 24, 18, 11, 5, 26, 35, 13, 20], p = '';
      order.forEach(function (i, n) { var c = cells[i % cells.length]; p += (n ? 'L' : 'M') + c[0] + ' ' + c[1]; });
      return p;
    }
    function nodes() {
      var N = [['POST /orders', 360, 130, '#fbbf24'], ['handleOrder', 360, 360, '#6ee7b7'], ['processOrder', 640, 360, '#6ee7b7'],
               ['OrderQueue', 200, 560, '#93c5fd'], ['saveOrder', 560, 560, '#93c5fd'], ['Checkout', 120, 330, '#93c5fd'], ['billing.charge', 820, 560, '#93c5fd']];
      var E = [[0, 1], [1, 2], [5, 1], [2, 3], [2, 4], [4, 6]], s = '';
      E.forEach(function (e) { s += '<line class="edge" x1="' + N[e[0]][1] + '" y1="' + N[e[0]][2] + '" x2="' + N[e[1]][1] + '" y2="' + N[e[1]][2] + '" stroke="#6ee7b7" stroke-width="3"/>'; });
      N.forEach(function (n) { s += '<g><rect x="' + (n[1] - 95) + '" y="' + (n[2] - 26) + '" width="190" height="52" rx="10" fill="#0f1218" stroke="' + n[3] + '"/><text x="' + n[1] + '" y="' + (n[2] + 7) + '" text-anchor="middle" fill="#f4f8ff" font-size="20">' + n[0] + '</text></g>'; });
      return s;
    }
    return {
      steps: 4,
      mount: function (host) {
        host.classList.add('tk-full');
        cells = [];
        var g = grid();
        root = el('<div class="tk tk-wg">' +
          '<div class="ask fade" data-at="0">where is <em>processOrder</em> used?</div>' +
          '<div class="agent fade" data-at="0"><span class="st">AGENT</span><br>&gt; grep "processOrder"<br>60 matches across 12 packages<br>&gt; reads 60 files, one after another...<br><span class="bad">a full context window pushes out the first ones</span></div>' +
          '<div class="tk-bar fade" data-at="0"><span>CONTEXT WINDOW</span><i></i></div>' +
          '<svg viewBox="0 0 1060 720"><g class="flat">' + g + '<path class="zz" d="' + zig() + '" fill="none" stroke="#fb7185" stroke-width="3" stroke-linejoin="round"/></g>' +
          '<g class="graph" opacity="0">' + nodes() + '</g></svg>' +
          '<div class="line fade" data-at="1">these aren\'t text, <em>they\'re edges</em>.</div>' +
          '<div class="line fade" data-at="2" style="bottom:70px">each definition a node, each reference an edge</div>' +
          '<div class="line fade" data-at="3" style="bottom:70px">the agent <em>traces</em> what a change touches before it edits.</div></div>');
        host.innerHTML = ''; host.appendChild(root);
        var zz = root.querySelector('.zz'), len = zz.getTotalLength(); zz.style.strokeDasharray = len; zz.style.strokeDashoffset = len;
        zz.style.transition = 'stroke-dashoffset 2.6s ease';
        root.querySelector('.graph').style.transition = 'opacity .8s ease';
        root.querySelector('.flat').style.transition = 'opacity .8s ease';
      },
      step: function (i) {
        fades(root, i);
        root.querySelectorAll('.line').forEach(function (e) { if (+e.dataset.at !== i) e.classList.remove('on'); });
        var zz = root.querySelector('.zz'), bar = root.querySelector('.tk-bar i');
        zz.style.strokeDashoffset = i === 0 ? 0 : zz.style.strokeDashoffset;
        bar.style.width = '100%';
        root.querySelector('.flat').style.opacity = i >= 1 ? '0.12' : '1';
        root.querySelector('.graph').style.opacity = i >= 1 ? '1' : '0';
        root.querySelectorAll('.agent .bad').forEach(function (b) { b.style.opacity = '1'; });
      }
    };
  })();

  var evidence = {
    steps: 4,
    mount: function (host) {
      host.classList.add('tk-full');
      var r = el('<div class="tk tk-ev"><h2>Not just us: measured elsewhere</h2>' +
        '<div class="sub">Different teams, different methods, the same direction: less reading, fewer tokens.</div>' +
        '<div class="row fade" data-at="0"><div class="who">Atlassian, Teamwork Graph<small>July 2026, agents with and without graph context</small></div>' +
        '<div class="res"><b>44%</b> more accurate results, <b>48%</b> fewer tokens<small>Their internal benchmark</small></div></div>' +
        '<div class="row fade" data-at="1"><div class="who">Codebase-Memory, arXiv paper<small>March 2026, 31 real repositories</small></div>' +
        '<div class="res">About <b>10x</b> fewer tokens, 2.1x fewer tool calls<small>The honest trade-off: answer quality 83% against 92% for a file-reading agent</small></div></div>' +
        '<div class="row fade" data-at="2"><div class="who">Microsoft GraphRAG<small>2024, questions about a whole corpus</small></div>' +
        '<div class="res">Top-level summaries use about <b>2 to 3%</b> of the tokens<small>And won about 70 to 80% of judged comparisons with plain retrieval</small></div></div>' +
        '<div class="row fade" data-at="3"><div class="who">Honcho, Plastic Labs<small>memory that serves curated context</small></div>' +
        '<div class="res"><b>60 to 90%</b> token savings<small>Their own figure</small></div></div>' +
        '<div class="src">Sources: atlassian.com/blog (15 Jul 2026), arxiv.org/abs/2603.27277, microsoft.com/research (2 Jul 2024), honcho.dev</div></div>');
      host.innerHTML = ''; host.appendChild(r); evidence._root = r;
    },
    step: function (i) { fades(evidence._root, i); }
  };

  var close = {
    steps: 1,
    mount: function (host) {
      host.classList.add('tk-full');
      host.innerHTML = '<div class="tk tk-close"><div><h1>Shared context is the frontier.</h1>' +
        '<p>Better models matter. The next advantage is a team and its AI working from the same context.</p>' +
        '<p style="font-size:28px;color:#8ea2c8">Andrew Demczuk, Forward Deployed Engineer</p></div>' +
        '<figure><img src="qr-talk.png" alt="QR code for this deck"><span>This deck</span></figure></div>';
    },
    step: function () {}
  };

  window.Talk = {
    altitude: framePage(function () { return CONFIG.altitude; }, '<div class="scene-fallback">Ask for the outcome, not the task.</div>'),
    together: framePage(function () { return CONFIG.together; }, '<div class="scene-fallback">Shared context: one team, one shared picture.</div>'),
    lexifina: lexifina,
    firstGraph: graphFilm({
      src: 'media/talk/agentreef-graph.mp4', poster: 'media/talk/agentreef-graph-poster.jpg', steps: 2,
      videoStyle: 'inset:auto;left:-460px;top:-170px;width:2442px;height:1468px;object-fit:fill',
      kick: 'My first graph', title: 'A graph for my business and my travel',
      sub: 'This view maps the code my agents run on.',
      stats: [['12,460', 'nodes'], ['43,621', 'edges'], ['20', 'clusters']]
    }),
    whyGraph: CONFIG.whyGraph ? framePage(function () { return CONFIG.whyGraph; }, '') : whyGraphOwn,
    omarchy: graphFilm({
      src: 'media/talk/omarchy-neo-graph.mp4', poster: 'media/talk/omarchy-neo-graph-poster.jpg', steps: 2,
      kick: 'A real project', title: 'Omarchy on Apple silicon: the Neo graph',
      sub: 'Every repository of the build in one graph, so the agents doing the work see the same map we do.'
    }),
    evidence: evidence,
    close: close
  };
  // the wiring slide's scene lives in wiring.js (loaded before this file)
  Object.defineProperty(window.Talk, 'wiring', { get: function () { return window.Wiring && window.Wiring.wiring; } });
})();
