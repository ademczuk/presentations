/*
 * scenes.js: two animated explainer scenes for the "Shared Context" deck.
 *
 *   window.Scenes = {
 *     messageLife:   { steps, mount(containerEl), step(i) },
 *     mergePipeline: { steps, mount(containerEl), step(i) }
 *   };
 *
 * Vanilla JS, inline SVG, one injected <style>. No libraries, no network.
 * Each scene is laid out on a fixed 1800x880 canvas that is scaled to fit its
 * container. Visual state is declarative: an element with data-on="k" is shown
 * from step k, data-off="m" hides it again from step m. data-d / data-od are
 * the delays (ms) used when stepping forward by one. Any other move snaps.
 * Only transform, opacity, stroke-dashoffset, clip-path and offset-distance
 * are animated. prefers-reduced-motion jumps straight to each end state.
 */
(function () {
  'use strict';

  var W = 1800, H = 880;
  var EASE = 'cubic-bezier(.65,0,.35,1)';
  var POP = 'cubic-bezier(.34,1.4,.64,1)';
  var STYLE_ID = 'scenes-js-style';

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  var HAS_OFFSET = (function () {
    try { return !!(window.CSS && CSS.supports && CSS.supports('offset-path', "path('M0 0 L10 10')")); } catch (e) { return false; }
  })();

  /* ------------------------------------------------------------------ CSS */
  var CSS_TEXT = [
    '.scn-root{position:relative;width:100%;height:100%;overflow:hidden;color:#f1f5f9;line-height:1.2;letter-spacing:normal;text-transform:none;text-align:left;font-style:normal;',
    'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;}',
    '.scn-inner{position:absolute;left:0;top:0;width:1800px;height:880px;transform-origin:0 0;}',
    '.scn-inner *{box-sizing:border-box;}',
    '.scn-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
    '.scn-svg{position:absolute;left:0;top:0;width:1800px;height:880px;overflow:visible;pointer-events:none;}',

    /* cards */
    '.scn-card{position:absolute;border-radius:22px;background:linear-gradient(180deg,#16213f 0%,#0f172e 100%);',
    'border:2px solid #28355c;box-shadow:0 22px 44px -22px rgba(0,0,0,.8);}',
    '.scn-actor{padding:20px 24px;--acc:#06b6d4;}',
    '.scn-actor:before{content:"";position:absolute;left:-2px;top:26px;bottom:26px;width:6px;border-radius:0 5px 5px 0;background:var(--acc);}',
    '.scn-kicker{font-size:19px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;}',
    '.scn-title{font-size:40px;font-weight:700;line-height:1.1;margin-top:6px;letter-spacing:-.01em;}',
    '.scn-sub{font-size:28px;line-height:1.22;color:#cbd5e1;margin-top:8px;}',
    '.scn-icon{position:absolute;right:20px;top:18px;width:44px;height:44px;fill:none;stroke:var(--acc);stroke-width:2.4;',
    'stroke-linecap:round;stroke-linejoin:round;opacity:.9;}',
    '.scn-chips{position:absolute;left:22px;right:18px;bottom:18px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;}',
    '.scn-slot{position:relative;height:42px;width:100%;}',
    '.scn-slot>.scn-chip{position:absolute;left:0;top:0;white-space:nowrap;}',
    '.scn-lit{position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border-radius:22px;border:2px solid var(--glow,#06b6d4);',
    'box-shadow:0 0 0 1px var(--glow,#06b6d4),0 0 42px -4px var(--glow,#06b6d4),inset 0 0 30px -12px var(--glow,#06b6d4);pointer-events:none;}',

    /* chips and badges */
    '.scn-chip{display:inline-block;font-size:23px;font-weight:600;line-height:1.2;padding:6px 14px;border-radius:12px;',
    'border:1.5px solid;color:#e2e8f0;border-color:#475569;background:rgba(71,85,105,.18);}',
    '.scn-root .c-green{color:#6ee7b7;border-color:rgba(16,185,129,.6);background:rgba(16,185,129,.14);}',
    '.scn-root .c-cyan{color:#67e8f9;border-color:rgba(6,182,212,.6);background:rgba(6,182,212,.13);}',
    '.scn-root .c-amber{color:#fcd34d;border-color:rgba(245,158,11,.65);background:rgba(245,158,11,.14);}',
    '.scn-root .c-violet{color:#d8b4fe;border-color:rgba(168,85,247,.65);background:rgba(168,85,247,.15);}',
    '.scn-root .c-red{color:#fca5a5;border-color:rgba(239,68,68,.7);background:rgba(239,68,68,.15);}',
    '.scn-badge{position:absolute;right:76px;top:-22px;font-size:22px;font-weight:700;padding:7px 16px;border-radius:999px;',
    'white-space:nowrap;box-shadow:0 8px 22px -8px rgba(0,0,0,.8);}',
    '.scn-root .b-amber{background:#f59e0b;color:#1c1203;}',
    '.scn-root .b-green{background:#10b981;color:#03150e;}',

    /* edges */
    '.scn-edge{fill:none;stroke:#334166;stroke-width:4;}',
    '.scn-root .e-cyan{stroke:#06b6d4;}.scn-root .e-green{stroke:#10b981;}.scn-root .e-violet{stroke:#a855f7;}.scn-root .e-amber{stroke:#f59e0b;}.scn-root .e-dim{stroke:#3b4a72;}',
    '.scn-root .e-dash{stroke-dasharray:10 9;}',

    /* tokens */
    '.scn-token{position:absolute;left:0;top:0;z-index:30;pointer-events:none;white-space:nowrap;opacity:0;',
    'font:700 23px/1 "JetBrains Mono",ui-monospace,Consolas,monospace;padding:9px 16px;border-radius:999px;',
    'color:#03141a;background:#22d3ee;offset-rotate:0deg;will-change:offset-distance,transform,opacity;',
    'box-shadow:0 0 0 5px rgba(6,182,212,.25),0 0 34px 10px rgba(6,182,212,.55);}',
    '.scn-root .t-green{background:#34d399;color:#02160d;box-shadow:0 0 0 5px rgba(16,185,129,.25),0 0 34px 10px rgba(16,185,129,.55);}',
    '.scn-root .t-violet{background:#c084fc;color:#1a0629;box-shadow:0 0 0 5px rgba(168,85,247,.25),0 0 34px 10px rgba(168,85,247,.55);}',
    '.scn-root .t-amber{background:#fbbf24;color:#1c1203;box-shadow:0 0 0 5px rgba(245,158,11,.25),0 0 34px 10px rgba(245,158,11,.55);}',
    '.scn-ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #22d3ee;',
    'pointer-events:none;opacity:0;z-index:5;}',

    /* caption */
    '.scn-caption{position:absolute;left:70px;right:70px;top:772px;height:100px;display:flex;align-items:center;justify-content:center;',
    'text-align:center;font-size:40px;font-weight:500;line-height:1.25;color:#f1f5f9;}',
    '.scn-caption:before{content:"";position:absolute;left:18%;right:18%;top:-6px;height:2px;',
    'background:linear-gradient(90deg,rgba(6,182,212,0),rgba(6,182,212,.55),rgba(168,85,247,.55),rgba(168,85,247,0));}',
    '.scn-cap-text{display:inline-block;transition:opacity .45s ' + EASE + ',transform .45s ' + EASE + ';}',
    '.scn-cap-text.scn-enter{opacity:0;transform:translateY(12px);transition:none;}',

    /* declarative visibility */
    '.scn-root [data-on]{opacity:0;transform:translateY(16px);transition:opacity .5s ' + EASE + ',transform .6s ' + EASE + ';}',
    '.scn-root [data-on].is-on{opacity:1;transform:none;}',
    '.scn-root svg [data-on]{transform-box:fill-box;transform-origin:center;}',
    '.scn-root .scn-pop[data-on]{transform:scale(.45);transition:opacity .3s ease-out,transform .55s ' + POP + ';}',
    '.scn-root .scn-pop[data-on].is-on{transform:none;}',
    '.scn-root .scn-fade[data-on],.scn-root .scn-fade[data-on].is-on{transform:none;}',
    '.scn-root .scn-draw[data-on]{transform:none;opacity:0;stroke-dasharray:1 1;stroke-dashoffset:1;',
    'transition:stroke-dashoffset .7s ' + EASE + ',opacity .15s linear;}',
    '.scn-root .scn-draw[data-on].is-on{opacity:1;stroke-dashoffset:0;}',
    '.scn-root .scn-fill[data-on]{opacity:1;transform:scaleX(0);transform-origin:0 50%;transition:transform .9s ' + EASE + ';}',
    '.scn-root .scn-fill[data-on].is-on{transform:scaleX(1);}',
    '.scn-root .scn-type[data-on]{opacity:1;transform:none;clip-path:inset(0 100% 0 0);transition:clip-path .85s steps(24,end);}',
    '.scn-root .scn-type[data-on].is-on{clip-path:inset(0 0 0 0);}',
    '.scn-root [data-on].is-on.scn-dim{opacity:.38;}',
    '.scn-snap,.scn-snap *{transition:none!important;}',

    /* scene 1 specifics */
    '.scn-msg{padding:18px 22px;}',
    '.scn-msg-h{font-size:21px;color:#94a3b8;letter-spacing:.02em;}',
    '.scn-typewrap{position:relative;margin-top:10px;}',
    '.scn-type{display:inline-block;font-size:27px;font-weight:600;color:#f1f5f9;padding-right:16px;position:relative;white-space:nowrap;}',
    '.scn-type:after{content:"";position:absolute;right:2px;top:3px;bottom:3px;width:4px;border-radius:2px;background:#22d3ee;',
    'animation:scn-blink 1s steps(1,end) infinite;}',
    '@keyframes scn-blink{50%{opacity:0;}}',
    '.scn-graphtitle{position:absolute;left:24px;top:16px;font-size:32px;font-weight:700;}',
    '.scn-graphkick{position:absolute;right:22px;top:24px;font-size:19px;font-weight:600;letter-spacing:.14em;color:#94a3b8;}',
    '.scn-root .g-pill{stroke-width:2.5;}',
    '.scn-root .g-text{font:600 22px "JetBrains Mono",ui-monospace,Consolas,monospace;fill:#f1f5f9;text-anchor:middle;dominant-baseline:central;}',
    '.scn-root .g-lbl{font:600 20px Inter,system-ui,"Segoe UI",Arial,sans-serif;fill:#94a3b8;}',
    '.scn-side{padding:16px 20px;border-style:dashed;--acc:#a855f7;}',
    '.scn-side .scn-title{font-size:27px;line-height:1.2;margin-top:4px;}',
    '.scn-side .scn-sub{font-size:21px;color:#94a3b8;margin-top:6px;}',
    '.scn-read{padding:18px 22px;--glow:#10b981;}',
    '.scn-readtext{font-size:23px;font-weight:600;margin-top:12px;white-space:nowrap;}',
    '.scn-readnote{font-size:24px;line-height:1.25;color:#6ee7b7;margin-top:14px;}',
    '.scn-arclbl{position:absolute;left:840px;width:600px;top:70px;text-align:center;font-size:22px;font-weight:600;color:#d8b4fe;}',
    '.scn-lock{position:absolute;width:46px;height:46px;}',

    /* scene 2 specifics */
    '.scn-stage{padding:20px 26px;}',
    '.scn-stage .scn-body{opacity:.36;transition:opacity .6s ' + EASE + ';}',
    '.scn-stage.lit .scn-body{opacity:1;}',
    '.scn-stage .scn-title{font-size:42px;}',
    '.scn-stage .scn-sub{font-size:26px;}',
    '.scn-pr{position:absolute;left:30px;width:300px;height:64px;padding:0 18px;display:flex;align-items:center;',
    'justify-content:space-between;border-radius:16px;transition:transform .75s ' + EASE + ';}',
    '.scn-pr.moved{transform:translate(var(--tx),var(--ty)) scale(.82);}',
    '.scn-prnum{font-size:31px;font-weight:700;color:#67e8f9;}',
    '.scn-prby{font-size:20px;color:#94a3b8;}',
    '.scn-check{position:absolute;right:14px;top:12px;width:40px;height:40px;}',
    '.scn-tray{position:absolute;border:2px dashed #28355c;border-radius:20px;}',
    '.scn-trayok{position:absolute;left:20px;width:320px;top:266px;text-align:center;font-size:26px;font-weight:600;color:#6ee7b7;}',
    '.scn-sectlbl{position:absolute;font-size:22px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;}',
    '.scn-gatebar{position:absolute;left:26px;right:26px;bottom:24px;height:62px;}',
    '.scn-run{position:absolute;left:0;right:0;top:0;}',
    '.scn-runlbl{font-size:21px;color:#94a3b8;}',
    '.scn-trk{position:relative;height:22px;margin-top:8px;border-radius:11px;background:#1d2747;overflow:hidden;}',
    '.scn-trk>div{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:11px;}',
    '.scn-root .f-cyan{background:linear-gradient(90deg,#0891b2,#22d3ee);}',
    '.scn-root .f-red{background:linear-gradient(90deg,#b91c1c,#ef4444);}',
    '.scn-root .f-green{background:linear-gradient(90deg,#059669,#34d399);}',
    '.scn-seat{display:inline-block;margin-top:10px;font-size:28px;font-weight:700;padding:4px 14px;border-radius:10px;',
    'color:#e9d5ff;background:rgba(168,85,247,.22);border:1.5px solid rgba(168,85,247,.7);}',
    '.scn-mainlbl{position:absolute;left:36px;top:619px;font-size:34px;font-weight:700;color:#f1f5f9;}',
    '.scn-newlbl{position:absolute;left:1500px;width:200px;top:566px;text-align:center;font-size:27px;font-weight:700;color:#67e8f9;}',
    '.scn-footer{position:absolute;left:100px;right:100px;top:716px;text-align:center;font-size:28px;font-weight:600;color:#d8b4fe;}',

    '@media (prefers-reduced-motion: reduce){.scn-root,.scn-root *,.scn-root *:before,.scn-root *:after{transition:none!important;animation:none!important;}}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS_TEXT;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------- engine */
  function makeScene(def) {
    var ctx = { root: null, inner: null, svg: null, cap: null, cur: -1, els: [], clsEls: [], timers: [], tokens: [], rafs: [], ro: null };

    function fit() {
      if (!ctx.root) return;
      var cw = ctx.root.clientWidth, ch = ctx.root.clientHeight;
      if (!cw || !ch) return;
      var k = Math.min(cw / W, ch / H);
      var tx = (cw - W * k) / 2, ty = (ch - H * k) / 2;
      ctx.inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
    }

    function clearTransient() {
      ctx.timers.forEach(function (t) { clearTimeout(t); });
      ctx.rafs.forEach(function (r) { cancelAnimationFrame(r); });
      ctx.timers = []; ctx.rafs = [];
      ctx.tokens.forEach(function (el) {
        try { if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) { /* ignore */ }
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      ctx.tokens = [];
    }

    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

    /* move a glowing token along an SVG path string */
    function travel(d, label, cls, delay, dur) {
      var tok = document.createElement('div');
      tok.className = 'scn-token' + (cls ? ' ' + cls : '');
      tok.textContent = label || '';
      ctx.inner.appendChild(tok);
      ctx.tokens.push(tok);
      delay = delay || 0; dur = dur || 800;
      if (HAS_OFFSET && tok.animate) {
        tok.style.offsetPath = "path('" + d + "')";
        tok.style.offsetRotate = '0deg';
        var a = tok.animate([
          { offsetDistance: '0%', opacity: 0 },
          { offsetDistance: '9%', opacity: 1, offset: 0.09 },
          { offsetDistance: '90%', opacity: 1, offset: 0.9 },
          { offsetDistance: '100%', opacity: 0 }
        ], { duration: dur, delay: delay, easing: EASE, fill: 'both' });
        a.onfinish = function () { if (tok.parentNode) tok.parentNode.removeChild(tok); };
        return;
      }
      /* fallback: sample the path and drive transform from rAF */
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      ctx.svg.appendChild(p);
      var len = p.getTotalLength();
      var t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var raw = Math.min(1, (ts - t0) / dur);
        var pt = p.getPointAtLength(len * ease(raw));
        tok.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-50%)';
        tok.style.opacity = raw < 0.09 ? raw / 0.09 : (raw > 0.9 ? (1 - raw) / 0.1 : 1);
        if (raw < 1) ctx.rafs.push(requestAnimationFrame(frame));
        else { if (tok.parentNode) tok.parentNode.removeChild(tok); if (p.parentNode) p.parentNode.removeChild(p); }
      }
      ctx.timers.push(setTimeout(function () { ctx.rafs.push(requestAnimationFrame(frame)); }, delay));
    }

    /* one expanding ring, used for "everyone sees it" */
    function burst(x, y, delay, color) {
      var r = document.createElement('div');
      r.className = 'scn-ring';
      r.style.left = x + 'px'; r.style.top = y + 'px';
      if (color) r.style.borderColor = color;
      ctx.inner.appendChild(r);
      ctx.tokens.push(r);
      if (!r.animate) return;
      var a = r.animate([
        { transform: 'scale(.5)', opacity: 0.9 },
        { transform: 'scale(4.2)', opacity: 0 }
      ], { duration: 1300, delay: delay || 0, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
      a.onfinish = function () { if (r.parentNode) r.parentNode.removeChild(r); };
    }

    function setCaption(i, fwd) {
      var text = def.captions[i] || '';
      var span = ctx.cap;
      if (span.textContent === text && !fwd) return;
      if (fwd) {
        span.classList.add('scn-enter');
        span.textContent = text;
        void span.offsetWidth;
        span.classList.remove('scn-enter');
      } else {
        span.textContent = text;
      }
    }

    function apply(i, fwd) {
      clearTransient();
      if (!fwd) ctx.root.classList.add('scn-snap');
      ctx.els.forEach(function (el) {
        var on = +el.getAttribute('data-on');
        var off = el.hasAttribute('data-off') ? +el.getAttribute('data-off') : Infinity;
        var vis = i >= on && i < off;
        var was = el.classList.contains('is-on');
        var delay = 0;
        if (fwd && vis && !was) delay = +(el.getAttribute('data-d') || 0);
        if (fwd && !vis && was) delay = +(el.getAttribute('data-od') || 0);
        el.style.transitionDelay = delay + 'ms';
        if (vis !== was) el.classList.toggle('is-on', vis);
      });
      ctx.clsEls.forEach(function (el) {
        var at = +el.getAttribute('data-at');
        var until = el.hasAttribute('data-until') ? +el.getAttribute('data-until') : Infinity;
        var cls = el.getAttribute('data-cls');
        var vis = i >= at && i < until;
        var was = el.classList.contains(cls);
        if (vis === was) return;
        if (!el.hasAttribute('data-on')) {
          el.style.transitionDelay = ((fwd && vis) ? +(el.getAttribute('data-cd') || 0) : 0) + 'ms';
        }
        el.classList.toggle(cls, vis);
      });
      setCaption(i, fwd);
      if (!fwd) {
        void ctx.root.offsetWidth;
        ctx.root.classList.remove('scn-snap');
      }
      ctx.cur = i;
      ctx.root.setAttribute('data-step', String(i));
      if (fwd && def.forward) def.forward(i, { travel: travel, burst: burst });
    }

    var api = {
      steps: def.captions.length,
      mount: function (container) {
        if (!container) return;
        injectStyle();
        if (ctx.ro) { try { ctx.ro.disconnect(); } catch (e) { /* ignore */ } }
        clearTransient();
        var root = document.createElement('div');
        root.className = 'scn-root scn-' + def.name;
        root.setAttribute('role', 'img');
        root.setAttribute('aria-label', def.label);
        var inner = document.createElement('div');
        inner.className = 'scn-inner';
        inner.innerHTML = def.html();
        var capBox = document.createElement('div');
        capBox.className = 'scn-caption';
        capBox.setAttribute('aria-live', 'polite');
        var cap = document.createElement('span');
        cap.className = 'scn-cap-text';
        capBox.appendChild(cap);
        inner.appendChild(capBox);
        root.appendChild(inner);
        container.innerHTML = '';
        container.appendChild(root);
        ctx.root = root; ctx.inner = inner; ctx.cap = cap;
        ctx.svg = inner.querySelector('svg.scn-svg');
        ctx.els = Array.prototype.slice.call(inner.querySelectorAll('[data-on]'));
        ctx.clsEls = Array.prototype.slice.call(inner.querySelectorAll('[data-at]'));
        if (def.init) def.init(inner);
        ctx.cur = -1;
        fit();
        if (window.ResizeObserver) {
          ctx.ro = new ResizeObserver(fit);
          ctx.ro.observe(root);
        } else {
          window.addEventListener('resize', fit);
        }
        apply(0, false);
      },
      step: function (i) {
        if (!ctx.inner) return;
        i = Math.max(0, Math.min(api.steps - 1, Math.round(+i || 0)));
        fit();
        var fwd = (i === ctx.cur + 1) && !reducedMotion();
        apply(i, fwd);
      }
    };
    return api;
  }

  /* --------------------------------------------------------------- icons */
  var ICON = {
    laptop: '<rect x="9" y="11" width="30" height="20" rx="2.5"/><path d="M4 37h40"/><path d="M18 34h12"/>',
    server: '<rect x="8" y="7" width="32" height="13" rx="3"/><rect x="8" y="27" width="32" height="13" rx="3"/>' +
            '<path d="M14 13.5h.01M14 33.5h.01M21 13.5h12M21 33.5h12"/>',
    inbox: '<path d="M6 26l6-17h24l6 17v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6 26h10l3 5h10l3-5h10"/>',
    monitor: '<rect x="6" y="8" width="36" height="24" rx="2.5"/><path d="M24 32v7M16 40h16"/>',
    graph: '<circle cx="12" cy="14" r="4.5"/><circle cx="36" cy="12" r="4.5"/><circle cx="24" cy="36" r="4.5"/>' +
           '<path d="M16 15l16-2M14 18l8 14M34 16l-8 16"/>',
    review: '<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="5"/>',
    gate: '<path d="M10 6v36M38 6v36M10 16h28M10 32h28"/><path d="M18 24l4 4 8-8"/>',
    merge: '<circle cx="12" cy="10" r="4"/><circle cx="12" cy="38" r="4"/><circle cx="36" cy="22" r="4"/>' +
           '<path d="M12 14v20M12 14c0 8 8 8 20 8"/>'
  };
  function icon(name) {
    return '<svg class="scn-icon" viewBox="0 0 48 48" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  function lock(color, ok) {
    return '<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">' +
      '<path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="' + color + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<rect x="10" y="21" width="28" height="21" rx="5" fill="' + color + '"/>' +
      (ok ? '<path d="M18 31.5l4.5 4.5 8-8.5" fill="none" stroke="#03150e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<circle cx="24" cy="31" r="3.2" fill="#1c1203"/>') +
      '</svg>';
  }
  function checkIcon() {
    return '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#10b981"/>' +
      '<path d="M12 20.5l5.5 5.5 11-11.5" fill="none" stroke="#03150e" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function at(on, d, extra) {
    return ' data-on="' + on + '"' + (d ? ' data-d="' + d + '"' : '') + (extra || '');
  }

  /* ============================================================ SCENE 1 */
  /* layout on the 1800x880 canvas */
  var S1 = {
    row: 245,                       /* vertical center of the actor row */
    neo: [30, 330], server: [510, 810], postbox: [990, 1290], joey: [1470, 1770]
  };
  var P_LANE = 'M1620 370 L1620 384 Q1620 397 1607 397 L193 397 Q180 397 180 384 L180 370';
  var P_ARC = 'M660 120 C660 26 1620 26 1620 120';

  function messageLifeHtml() {
    var r = S1.row;
    var svg =
      '<svg class="scn-svg" viewBox="0 0 1800 880" aria-hidden="true">' +
        /* actor edges, drawn card edge to card edge */
        '<path class="scn-edge e-cyan scn-draw" pathLength="1" d="M330 ' + r + ' L510 ' + r + '"' + at(2, 100) + '/>' +
        '<path class="scn-edge e-violet scn-draw" pathLength="1" d="M660 370 L660 420"' + at(3, 100) + '/>' +
        '<path class="scn-edge e-cyan scn-draw" pathLength="1" d="M810 ' + r + ' L990 ' + r + '"' + at(4, 120) + '/>' +
        '<path class="scn-edge e-dim e-dash scn-fade" d="M1140 370 L1140 430"' + at(4, 450) + '/>' +
        '<path class="scn-edge e-amber scn-draw" pathLength="1" d="M1290 ' + r + ' L1470 ' + r + '"' + at(5, 0) + '/>' +
        '<path class="scn-edge e-violet scn-draw" pathLength="1" d="' + P_ARC + '"' + at(6, 0) + '/>' +
        '<path class="scn-edge e-green scn-draw" pathLength="1" d="' + P_LANE + '"' + at(7, 0) + '/>' +
      '</svg>';

    var neo =
      '<div class="scn-card scn-actor" style="--acc:#06b6d4;left:30px;top:120px;width:300px;height:250px">' +
        '<div class="scn-lit" style="--glow:#10b981"' + at(7, 1150) + '></div>' +
        icon('laptop') +
        '<div class="scn-kicker">Agent</div>' +
        '<div class="scn-title">neo</div>' +
        '<div class="scn-sub">Claude Code<br>another machine</div>' +
        '<div class="scn-badge b-amber scn-pop"' + at(3, 1150, ' data-off="7" data-od="1100"') + '>owed a reply</div>' +
        '<div class="scn-badge b-green scn-pop"' + at(7, 1200) + '>reply received</div>' +
      '</div>';

    var server =
      '<div class="scn-card scn-actor" style="--acc:#06b6d4;left:510px;top:120px;width:300px;height:250px"' + at(2, 0) + '>' +
        icon('server') +
        '<div class="scn-kicker">Server</div>' +
        '<div class="scn-title">MeshyChat</div>' +
        '<div class="scn-chips">' +
          '<div class="scn-chip c-green scn-pop"' + at(2, 1000) + '>signature checked</div>' +
          '<div class="scn-chip c-cyan scn-pop"' + at(2, 1200) + '>stored in a thread</div>' +
        '</div>' +
      '</div>';

    var postbox =
      '<div class="scn-card scn-actor" style="--acc:#f59e0b;left:990px;top:120px;width:300px;height:250px"' + at(4, 0) + '>' +
        icon('inbox') +
        '<div class="scn-kicker">joey\'s machine</div>' +
        '<div class="scn-title">postbox</div>' +
        '<div class="scn-chips">' +
          '<div class="scn-chip c-green scn-pop"' + at(4, 1050) + '>arrived in about 1 s</div>' +
          '<div class="scn-chip c-amber scn-pop"' + at(5, 100) + '>wakes joey\'s session</div>' +
        '</div>' +
      '</div>';

    var joey =
      '<div class="scn-card scn-actor" style="--acc:#10b981;left:1470px;top:120px;width:300px;height:250px">' +
        '<div class="scn-lit" style="--glow:#10b981"' + at(6, 1100) + '></div>' +
        icon('monitor') +
        '<div class="scn-kicker">Agent</div>' +
        '<div class="scn-title">joey</div>' +
        '<div class="scn-sub">Claude Code<br>another machine</div>' +
        '<div class="scn-chips"><div class="scn-slot">' +
          '<div class="scn-chip c-amber scn-pop"' + at(5, 850, ' data-off="6"') + '>1 new pointer</div>' +
          '<div class="scn-chip c-green scn-pop"' + at(6, 1150) + '>read, signature ok</div>' +
        '</div></div>' +
      '</div>';
    /* padlock sits over the icon slot of joey's card */
    var locks =
      '<div class="scn-lock scn-pop" style="left:1592px;top:166px"' + at(5, 900, ' data-off="6"') + '>' + lock('#f59e0b', false) + '</div>' +
      '<div class="scn-lock scn-pop" style="left:1592px;top:166px"' + at(6, 1150) + '>' + lock('#10b981', true) + '</div>';

    var msg =
      '<div class="scn-card scn-msg" style="left:30px;top:420px;width:450px;height:170px"' + at(1, 0) + '>' +
        '<div class="scn-msg-h scn-mono">to: joey   thread: neo-backlog</div>' +
        '<div class="scn-typewrap"><span class="scn-type scn-mono"' + at(1, 300) + '>#248 is ready for review</span></div>' +
        '<div style="margin-top:12px"><span class="scn-chip c-cyan scn-pop"' + at(1, 1200) + '>signed with neo\'s key</span></div>' +
      '</div>';

    /* the message graph, drawn in panel-local coordinates (540x325) */
    var g =
      '<div class="scn-card" style="left:500px;top:420px;width:540px;height:325px;--acc:#a855f7"' + at(3, 0) + '>' +
        '<div class="scn-graphtitle">Message graph</div>' +
        '<svg viewBox="0 0 540 325" width="540" height="325" style="position:absolute;left:-2px;top:-2px;overflow:visible" aria-hidden="true">' +
          /* earlier messages in the thread */
          '<path class="scn-edge e-dim" style="stroke-width:3" d="M150 286 L210 278 M168 248 L210 268"/>' +
          '<circle cx="150" cy="288" r="9" fill="#334166"/><circle cx="166" cy="246" r="9" fill="#334166"/>' +
          /* static nodes */
          '<rect class="g-pill" x="45" y="128" width="100" height="44" rx="22" fill="#0e2a35" stroke="#06b6d4"/>' +
          '<text class="g-text" x="95" y="150">neo</text>' +
          '<rect class="g-pill" x="405" y="128" width="100" height="44" rx="22" fill="#0b2a20" stroke="#10b981"/>' +
          '<text class="g-text" x="455" y="150">joey</text>' +
          '<rect class="g-pill" x="210" y="250" width="120" height="44" rx="22" fill="#241338" stroke="#a855f7"/>' +
          '<text class="g-text" x="270" y="272">thread</text>' +
          /* the new message node and its edges */
          '<path class="scn-edge e-cyan scn-draw" style="stroke-width:3" pathLength="1" d="M145 150 L215 150"' + at(3, 750) + '/>' +
          '<path class="scn-edge e-violet scn-draw" style="stroke-width:3" pathLength="1" d="M270 172 L270 250"' + at(3, 800) + '/>' +
          '<text class="g-lbl scn-fade" x="258" y="216" text-anchor="end"' + at(3, 900) + '>in thread</text>' +
          '<g class="scn-pop"' + at(3, 550) + '>' +
            '<rect class="g-pill" x="215" y="128" width="110" height="44" rx="22" fill="#06b6d4" stroke="#67e8f9"/>' +
            '<text class="g-text" x="270" y="150" style="fill:#03141a">#248</text>' +
          '</g>' +
          /* who owes whom */
          '<g class="scn-fade"' + at(3, 950, ' data-off="7" data-od="1100"') + '>' +
            '<path class="scn-edge e-amber e-dash" style="stroke-width:3" d="M455 128 C455 72 95 72 95 128"/>' +
            '<text class="g-lbl" x="270" y="112" text-anchor="middle" style="fill:#fcd34d">owes a reply</text>' +
          '</g>' +
          /* pending reply slot, filled at the end */
          '<g class="scn-fade"' + at(3, 1050, ' data-off="7" data-od="1100"') + '>' +
            '<path class="scn-edge e-dim e-dash" style="stroke-width:3" d="M398 250 L318 172"/>' +
            '<rect x="395" y="250" width="120" height="44" rx="22" fill="none" stroke="#475569" stroke-width="2.5" stroke-dasharray="7 6"/>' +
            '<text class="g-text" x="455" y="272" style="fill:#64748b">reply</text>' +
          '</g>' +
          '<text class="g-lbl scn-fade" x="366" y="198"' + at(3, 1050) + '>reply-to</text>' +
          '<path class="scn-edge e-green scn-draw" style="stroke-width:3" pathLength="1" d="M398 250 L318 172"' + at(7, 1250) + '/>' +
          '<path class="scn-edge e-green scn-draw" style="stroke-width:3" pathLength="1" d="M455 172 L455 250"' + at(7, 1300) + '/>' +
          '<g class="scn-pop"' + at(7, 1200) + '>' +
            '<rect class="g-pill" x="395" y="250" width="120" height="44" rx="22" fill="#10b981" stroke="#6ee7b7"/>' +
            '<text class="g-text" x="455" y="272" style="fill:#02160d">reply</text>' +
          '</g>' +
        '</svg>' +
      '</div>';

    var side =
      '<div class="scn-card scn-actor scn-side" style="left:1070px;top:430px;width:320px;height:136px"' + at(4, 350) + '>' +
        '<div class="scn-title">Codex / Kimi /<br>Antigravity</div>' +
        '<div class="scn-sub">also served by the postbox</div>' +
      '</div>';

    var read =
      '<div class="scn-card scn-read" style="left:1420px;top:420px;width:370px;height:206px"' + at(6, 1100) + '>' +
        '<div class="scn-msg-h scn-mono">from: neo, signed</div>' +
        '<div class="scn-readtext scn-mono">#248 is ready for review</div>' +
        '<div class="scn-readnote">A peer\'s request,<br>not an order.</div>' +
      '</div>';

    var arcLabel = '<div class="scn-arclbl scn-fade"' + at(6, 250) + '>joey fetches it from the server</div>';

    return svg + msg + g + side + read + neo + server + postbox + joey + locks + arcLabel;
  }

  var messageLife = makeScene({
    name: 'message-life',
    label: 'One message, step by step: neo sends a signed request through the MeshyChat server to joey, who answers.',
    captions: [
      'Two agents on two machines. Neither can see the other\'s context.',
      'neo writes a request and signs it with its own key.',
      'The server checks the signature, then stores the message in a thread.',
      'The message becomes a node in a graph: thread, reply-to, who owes whom.',
      'joey\'s machine has one postbox. It receives the message in about a second.',
      'The postbox wakes joey\'s session. Only a pointer is pushed, never the text.',
      'joey fetches the signed message in full and treats it as a peer\'s request, not an order.',
      'joey answers. The ask is no longer owed. Shared context, end to end.'
    ],
    html: messageLifeHtml,
    forward: function (i, fx) {
      var r = S1.row;
      if (i === 2) fx.travel('M300 ' + r + ' L570 ' + r, '#248', '', 350, 700);
      if (i === 3) fx.travel('M660 330 L660 470', '', 't-violet', 150, 500);
      if (i === 4) fx.travel('M780 ' + r + ' L1050 ' + r, '#248', '', 350, 700);
      if (i === 5) fx.travel('M1260 ' + r + ' L1530 ' + r, 'pointer', 't-amber', 200, 650);
      if (i === 6) fx.travel(P_ARC, '#248', 't-violet', 300, 850);
      if (i === 7) fx.travel(P_LANE, 'answer', 't-green', 200, 1000);
    }
  });

  /* ============================================================ SCENE 2 */
  var PRS = ['#241', '#242', '#237', '#240'];
  var PR_TOP = [140, 216, 292, 368];
  var SLOT_X = [520, 780, 1040, 1300];
  var TRACK_Y = 640;
  var NEW_X = 1600;

  function mergePipelineHtml() {
    var svg =
      '<svg class="scn-svg" viewBox="0 0 1800 880" aria-hidden="true">' +
        /* main track, existing history */
        '<path class="scn-edge e-dim" style="stroke-width:6" d="M150 ' + TRACK_Y + ' L1450 ' + TRACK_Y + '"/>' +
        '<circle cx="190" cy="' + TRACK_Y + '" r="12" fill="#3b4a72"/>' +
        '<circle cx="262" cy="' + TRACK_Y + '" r="12" fill="#3b4a72"/>' +
        '<circle cx="334" cy="' + TRACK_Y + '" r="12" fill="#3b4a72"/>' +
        '<path class="scn-edge e-green scn-fade" style="stroke-width:6" d="M410 ' + TRACK_Y + ' L1450 ' + TRACK_Y + '"' + at(4, 1500) + '/>' +
        '<path class="scn-edge e-cyan scn-draw" style="stroke-width:6" pathLength="1" d="M1450 ' + TRACK_Y + ' L' + (NEW_X - 22) + ' ' + TRACK_Y + '"' + at(5, 0) + '/>' +
        '<g class="scn-pop"' + at(5, 450) + '>' +
          '<circle cx="' + NEW_X + '" cy="' + TRACK_Y + '" r="34" fill="rgba(6,182,212,.18)"/>' +
          '<circle cx="' + NEW_X + '" cy="' + TRACK_Y + '" r="20" fill="#22d3ee" stroke="#cffafe" stroke-width="3"/>' +
        '</g>' +
        '<path class="scn-edge e-green scn-fade" style="stroke-width:12;stroke-opacity:.35" d="M150 ' + TRACK_Y + ' L' + NEW_X + ' ' + TRACK_Y + '"' + at(6, 450) + '/>' +
        /* stage connectors with arrowheads */
        '<path class="scn-edge e-cyan scn-draw" pathLength="1" d="M332 270 L404 270"' + at(1, 0) + '/>' +
        '<path class="scn-fade" fill="#06b6d4" d="M394 260 L410 270 L394 280 Z"' + at(1, 450) + '/>' +
        '<path class="scn-edge e-amber scn-draw" pathLength="1" d="M752 270 L824 270"' + at(2, 0) + '/>' +
        '<path class="scn-fade" fill="#f59e0b" d="M814 260 L830 270 L814 280 Z"' + at(2, 450) + '/>' +
        '<path class="scn-edge e-violet scn-draw" pathLength="1" d="M1292 270 L1364 270"' + at(4, 0) + '/>' +
        '<path class="scn-fade" fill="#a855f7" d="M1354 260 L1370 270 L1354 280 Z"' + at(4, 450) + '/>' +
      '</svg>';

    var prs = '<div class="scn-sectlbl" style="left:32px;top:96px">Pull requests</div>' +
      '<div class="scn-tray" style="left:20px;top:130px;width:320px;height:312px"></div>' +
      '<div class="scn-trayok scn-fade"' + at(4, 1650) + '>all four merged</div>';
    PRS.forEach(function (n, k) {
      var top = PR_TOP[k];
      var tx = SLOT_X[k] - 180, ty = TRACK_Y - (top + 32);
      var d = 300 + k * 190;
      prs +=
        '<div class="scn-card scn-pr" style="top:' + top + 'px;--tx:' + tx + 'px;--ty:' + ty + 'px"' +
          ' data-at="4" data-cls="moved" data-cd="' + d + '">' +
          '<span class="scn-prnum scn-mono">' + n + '</span>' +
          '<span class="scn-prby scn-fade"' + at(0, 0, ' data-off="4"') + '>agent-written</span>' +
          '<span class="scn-check scn-pop"' + at(4, d + 650) + '>' + checkIcon() + '</span>' +
        '</div>';
    });

    function stage(left, width, acc, kicker, title, sub, litOn, extra, iconName, inner) {
      return '<div class="scn-card scn-actor scn-stage" style="--acc:' + acc + ';left:' + left + 'px;top:140px;width:' + width + 'px;height:260px"' +
        ' data-at="' + litOn + '" data-cls="lit" data-cd="250">' +
        (extra || '') +
        '<div class="scn-body">' + icon(iconName) +
          '<div class="scn-kicker">' + kicker + '</div>' +
          '<div class="scn-title">' + title + '</div>' +
          '<div class="scn-sub">' + sub + '</div>' + (inner || '') +
        '</div>' +
      '</div>';
    }

    var review = stage(410, 340, '#06b6d4', 'Stage 1', 'Review', 'by a different agent', 1,
      '<div class="scn-lit" style="--glow:#06b6d4"' + at(1, 300) + '></div>' +
      '<div class="scn-lit" style="--glow:#a855f7"' + at(6, 0) + '></div>', 'review');

    var gateBar =
      '<div class="scn-gatebar">' +
        '<div class="scn-run scn-fade"' + at(2, 250, ' data-off="3"') + '>' +
          '<span class="scn-runlbl scn-mono">run 1</span>' +
          '<div class="scn-trk"><div class="f-cyan scn-fill"' + at(2, 300) + '></div>' +
          '<div class="f-red scn-fade"' + at(2, 1150) + '></div></div>' +
        '</div>' +
        '<div class="scn-run scn-fade"' + at(3, 0) + '>' +
          '<span class="scn-runlbl scn-mono">run 2, same tree</span>' +
          '<div class="scn-trk"><div class="f-green scn-fill"' + at(3, 150) + '></div></div>' +
        '</div>' +
      '</div>';
    var gate = stage(830, 460, '#f59e0b', 'Stage 2', 'Gate', 'every test, on the combined tree', 2,
      '<div class="scn-lit" style="--glow:#f59e0b"' + at(2, 300, ' data-off="3"') + '></div>' +
      '<div class="scn-lit" style="--glow:#ef4444"' + at(2, 1150, ' data-off="3"') + '></div>' +
      '<div class="scn-lit" style="--glow:#10b981"' + at(3, 1050, ' data-off="6"') + '></div>' +
      '<div class="scn-lit" style="--glow:#a855f7"' + at(6, 150) + '></div>', 'gate', gateBar);

    var merge = stage(1370, 400, '#a855f7', 'Stage 3', 'Merge', 'pinned, checked after each', 4,
      '<div class="scn-lit" style="--glow:#a855f7"' + at(4, 250) + '></div>' +
      '<div class="scn-lit" style="--glow:#a855f7"' + at(6, 300) + '></div>', 'merge',
      '<div><span class="scn-seat scn-mono scn-pop"' + at(4, 350) + '>baleen</span></div>');

    var chips =
      '<div class="scn-chip c-green scn-pop" style="position:absolute;left:410px;top:422px;max-width:340px"' + at(1, 750) + '>reviewed by a different agent</div>' +
      '<div class="scn-chip c-red scn-pop" style="position:absolute;left:830px;top:422px" data-at="3" data-cls="scn-dim"' + at(2, 1250) + '>failed: fixture key collision, about 1 in 6,000</div>' +
      '<div class="scn-chip c-green scn-pop" style="position:absolute;left:830px;top:478px"' + at(3, 1100) + '>7,543 tests passed, about 1 h 40 min</div>';

    var track =
      '<div class="scn-mainlbl scn-mono">main</div>' +
      '<div class="scn-newlbl scn-mono scn-fade"' + at(5, 550) + '>new main</div>' +
      '<div class="scn-footer scn-fade"' + at(6, 500) + '>authors, reviewers, gate, merger: four machines, one shared context</div>';

    return svg + track + review + gate + merge + chips + prs;
  }

  var mergePipeline = makeScene({
    name: 'merge-pipeline',
    label: 'This morning\'s merge: four agent pull requests are reviewed, gated twice, and merged into main by another agent.',
    captions: [
      'Four pull requests, written by agents.',
      'A different agent reviews each one. Authors never review themselves.',
      'The full test gate runs on the combined tree. It fails once, on a random collision in a test fixture.',
      'The flake is diagnosed, the same tree is gated again, and it passes.',
      'A third agent merges them, each pinned to its reviewed commit and checked after every merge.',
      'Main moves forward. Every agent sees it within seconds.',
      'Humans set the rules and approve the risky steps. The routine runs itself.'
    ],
    html: mergePipelineHtml,
    forward: function (i, fx) {
      if (i === 1) fx.travel('M318 270 L424 270', '4 PRs', '', 0, 600);
      if (i === 2) fx.travel('M738 270 L844 270', '4 PRs', 't-amber', 0, 600);
      if (i === 3) fx.travel('M900 352 L1210 352', '', 't-green', 100, 900);
      if (i === 4) fx.travel('M1278 270 L1384 270', '4 PRs', 't-violet', 0, 600);
      if (i === 5) {
        fx.burst(NEW_X, TRACK_Y, 600, '#22d3ee');
        fx.burst(NEW_X, TRACK_Y, 950, '#22d3ee');
      }
    }
  });

  window.Scenes = window.Scenes || {};
  window.Scenes.messageLife = messageLife;
  window.Scenes.mergePipeline = mergePipeline;
})();
