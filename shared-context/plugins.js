/*
 * plugins.js: act 5 of the "Shared Context" deck, "the plugins".
 *
 *   window.Plugins = {
 *     showtime:   { steps, mount(containerEl), step(i) },   transition gallery
 *     seecode:    { steps, mount(containerEl), step(i) },   self-drawing sequence diagram
 *     fftrack:    { steps, mount(containerEl), step(i) },   computer-vision tracking HUD
 *     remocn:     { steps, mount(containerEl), step(i) },   kinetic typography
 *     explainroo: { steps, mount(containerEl), step(i) }    hand-drawn narrated explainer
 *   };
 *
 * Each scene re-implements the LOOK of an open-source motion project in our
 * own code (no code or brand assets copied) and applies it to MeshyChat.
 * Vanilla JS, inline SVG, one injected <style>, no libraries, no network.
 * Every scene draws on a fixed 1800x880 canvas scaled to fit its container.
 * step(i) is idempotent: stepping forward by one animates, any other move
 * snaps to the end state. Calling step(0) again on a scene already at step 0
 * replays its entrance. prefers-reduced-motion jumps straight to end states.
 * Only transform, opacity, clip-path, filter, stroke-dashoffset and
 * offset-distance are animated.
 */
(function () {
  'use strict';

  var W = 1800, H = 880;
  var EASE = 'cubic-bezier(.65,0,.35,1)';
  var OUT = 'cubic-bezier(.16,1,.3,1)';
  var POP = 'cubic-bezier(.34,1.45,.64,1)';
  var STYLE_ID = 'plugins-js-style';
  var NS = 'http://www.w3.org/2000/svg';
  var MONO = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  var HAND = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Marker Felt",cursive';
  var uidSeq = 0;

  /* the desk photo sits next to this script */
  var SCRIPT_BASE = (function () {
    try {
      var s = document.currentScript;
      if (s && s.src) { var src = s.src.split(/[?#]/)[0]; return src.slice(0, src.lastIndexOf('/') + 1); }
    } catch (e) { /* ignore */ }
    return '';
  })();
  function fleetImg() { return window.PLUGINS_FLEET_IMG || (SCRIPT_BASE + 'fleet-desk.jpg'); }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  var HAS_OFFSET = (function () {
    try { return !!(window.CSS && CSS.supports && CSS.supports('offset-path', "path('M0 0 L10 10')")); } catch (e) { return false; }
  })();

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }
  function at(on, d, extra) {
    return ' data-on="' + on + '"' + (d ? ' data-d="' + d + '"' : '') + (extra || '');
  }

  /* ------------------------------------------------------------------ CSS */
  var CSS_TEXT = [
    '.plg-root{position:relative;width:100%;height:100%;overflow:hidden;color:#f1f5f9;line-height:1.2;letter-spacing:normal;text-transform:none;text-align:left;font-style:normal;',
    'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;}',
    '.plg-inner{position:absolute;left:0;top:0;width:1800px;height:880px;transform-origin:0 0;}',
    '.plg-inner *{box-sizing:border-box;}',
    '.plg-mono{font-family:' + MONO + ';}',
    '.plg-svg{position:absolute;left:0;top:0;width:1800px;height:880px;overflow:visible;pointer-events:none;}',
    '.plg-credit{position:absolute;right:40px;top:12px;z-index:60;font:500 20px/1.3 ' + MONO + ';color:#64748b;white-space:nowrap;}',

    /* caption */
    '.plg-caption{position:absolute;left:70px;right:70px;top:772px;height:100px;z-index:50;display:flex;align-items:center;justify-content:center;',
    'text-align:center;font-size:40px;font-weight:500;line-height:1.25;color:#f1f5f9;}',
    '.plg-caption:before{content:"";position:absolute;left:18%;right:18%;top:-6px;height:2px;',
    'background:linear-gradient(90deg,rgba(6,182,212,0),rgba(6,182,212,.55),rgba(168,85,247,.55),rgba(168,85,247,0));}',
    '.plg-cap-text{display:inline-block;transition:opacity .45s ' + EASE + ',transform .45s ' + EASE + ';}',
    '.plg-cap-text.plg-enter{opacity:0;transform:translateY(12px);transition:none;}',

    /* declarative visibility */
    '.plg-root [data-on]{opacity:0;transform:translateY(16px);transition:opacity .5s ' + EASE + ',transform .6s ' + EASE + ';}',
    '.plg-root [data-on].is-on{opacity:1;transform:none;}',
    '.plg-root svg [data-on]{transform-box:fill-box;transform-origin:center;}',
    '.plg-root .plg-pop[data-on]{transform:scale(.4);transition:opacity .25s ease-out,transform .55s ' + POP + ';}',
    '.plg-root .plg-pop[data-on].is-on{transform:none;}',
    '.plg-root .plg-fade[data-on],.plg-root .plg-fade[data-on].is-on{transform:none;}',
    '.plg-root .plg-draw[data-on]{transform:none;opacity:0;stroke-dasharray:1 1;stroke-dashoffset:1;',
    'transition:stroke-dashoffset var(--dur,.7s) ' + EASE + ',opacity .12s linear;}',
    '.plg-root .plg-draw[data-on].is-on{opacity:1;stroke-dashoffset:0;}',
    '.plg-root .plg-grow[data-on]{opacity:1;transform:scaleX(0);transform-origin:0 50%;transition:transform var(--dur,.6s) ' + EASE + ';}',
    '.plg-root .plg-grow[data-on].is-on{transform:scaleX(1);}',
    '.plg-root [data-on].is-on.plg-dimmed{opacity:.42;}',
    '.plg-snap,.plg-snap *{transition:none!important;}',

    /* shared tokens and rings */
    '.plg-tok{position:absolute;left:0;top:0;z-index:30;pointer-events:none;opacity:0;offset-rotate:0deg;will-change:offset-distance,transform,opacity;}',
    '.plg-ring{position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #22d3ee;pointer-events:none;opacity:0;z-index:25;}',
    '.plg-chip{display:inline-block;font-size:26px;font-weight:600;line-height:1.2;padding:7px 16px;border-radius:12px;white-space:nowrap;',
    'border:1.5px solid;color:#e2e8f0;border-color:#475569;background:rgba(71,85,105,.18);}',
    '.plg-root .c-green{color:#6ee7b7;border-color:rgba(16,185,129,.6);background:rgba(16,185,129,.14);}',
    '.plg-root .c-cyan{color:#67e8f9;border-color:rgba(6,182,212,.6);background:rgba(6,182,212,.13);}',
    '.plg-root .c-amber{color:#fcd34d;border-color:rgba(245,158,11,.65);background:rgba(245,158,11,.14);}',
    '.plg-root .c-violet{color:#d8b4fe;border-color:rgba(168,85,247,.65);background:rgba(168,85,247,.15);}',

    /* ============ showtime */
    '.plg-st-rail{position:absolute;left:60px;top:124px;width:330px;height:620px;}',
    '.plg-st-kick{position:absolute;left:4px;top:0;font-size:19px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;}',
    '.plg-st-hl{position:absolute;left:0;top:0;width:330px;height:84px;border-radius:16px;opacity:0;',
    'background:linear-gradient(90deg,rgba(6,182,212,.20),rgba(6,182,212,.04));border:1.5px solid rgba(6,182,212,.55);',
    'box-shadow:0 0 30px -8px rgba(6,182,212,.6);transition:transform .55s ' + EASE + ',opacity .4s ' + EASE + ';}',
    '.plg-st-hl:before{content:"";position:absolute;left:-2px;top:16px;bottom:16px;width:5px;border-radius:0 4px 4px 0;background:#22d3ee;}',
    '.plg-st-item{position:absolute;left:0;width:330px;height:84px;padding:12px 16px 0 22px;display:flex;gap:16px;align-items:flex-start;}',
    '.plg-st-num{font:600 20px/1.6 ' + MONO + ';color:#475569;width:30px;flex:none;}',
    '.plg-st-name{font-size:29px;font-weight:700;color:#94a3b8;letter-spacing:-.01em;}',
    '.plg-st-sub{font-size:24px;color:#64748b;margin-top:3px;white-space:nowrap;}',
    '.plg-st-item.is-act .plg-st-name{color:#a5f3fc;}.plg-st-item.is-act .plg-st-num{color:#22d3ee;}.plg-st-item.is-act .plg-st-sub{color:#94a3b8;}',
    '.plg-st-item.is-done .plg-st-name{color:#cbd5e1;}',
    '.plg-st-tick{position:absolute;right:14px;top:24px;width:30px;height:30px;opacity:0;transform:scale(.5);',
    'transition:opacity .3s ' + EASE + ',transform .45s ' + POP + ';}',
    '.plg-st-item.is-done .plg-st-tick{opacity:1;transform:none;}',
    '.plg-st-tag{position:absolute;left:430px;top:30px;height:70px;display:flex;align-items:center;gap:26px;opacity:0;}',
    '.plg-st-tname{font:700 56px/1 ' + MONO + ';color:#f1f5f9;letter-spacing:-.02em;}',
    '.plg-st-tname:before{content:"transition";display:block;font:600 15px/1 Inter,system-ui,"Segoe UI",Arial,sans-serif;letter-spacing:.2em;',
    'text-transform:uppercase;color:#22d3ee;margin:0 0 6px 2px;}',
    '.plg-st-t{font:600 28px/1 ' + MONO + ';color:#94a3b8;margin-top:22px;}',
    '.plg-st-bar{position:relative;width:240px;height:8px;border-radius:4px;background:#1d2747;overflow:hidden;margin-top:22px;}',
    '.plg-st-bar>i{position:absolute;inset:0;border-radius:4px;background:linear-gradient(90deg,#06b6d4,#a855f7);transform-origin:0 50%;}',
    '.plg-st-stage{position:absolute;left:430px;top:124px;width:1310px;height:620px;border-radius:28px;overflow:hidden;',
    'background:#0c1328;border:2px solid #28355c;box-shadow:0 30px 60px -28px rgba(0,0,0,.9);isolation:isolate;}',
    '.plg-card{position:absolute;left:0;top:0;width:1310px;height:620px;padding:54px 64px;overflow:hidden;opacity:0;visibility:hidden;}',
    '.plg-root .st-c0{background:radial-gradient(900px 520px at 88% 0%,rgba(6,182,212,.30),transparent 62%),linear-gradient(160deg,#10263c,#0a1226);}',
    '.plg-root .st-c1{background:radial-gradient(900px 560px at 8% 100%,rgba(168,85,247,.34),transparent 62%),linear-gradient(160deg,#1c1238,#0c0a1f);}',
    '.plg-root .st-c2{background:radial-gradient(900px 560px at 92% 100%,rgba(245,158,11,.26),transparent 62%),linear-gradient(160deg,#241a0d,#0f0f1e);}',
    '.plg-root .st-c3{background:radial-gradient(1000px 520px at 50% 0%,rgba(16,185,129,.30),transparent 62%),linear-gradient(160deg,#0b2a22,#091320);}',
    '.plg-root .st-c4{background:radial-gradient(900px 560px at 10% 0%,rgba(59,130,246,.30),transparent 62%),linear-gradient(160deg,#0c2246,#091027);}',
    '.plg-root .st-c5{background:linear-gradient(rgba(148,163,184,.06) 1px,transparent 1px) 0 0/48px 48px,',
    'linear-gradient(90deg,rgba(148,163,184,.06) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(160deg,#121a36,#0a1024);}',
    '.plg-root .st-c6{background:radial-gradient(700px 420px at 0% 0%,rgba(245,158,11,.20),transparent 60%),',
    'radial-gradient(700px 420px at 100% 0%,rgba(16,185,129,.20),transparent 60%),radial-gradient(700px 420px at 0% 100%,rgba(168,85,247,.22),transparent 60%),',
    'radial-gradient(700px 420px at 100% 100%,rgba(96,165,250,.22),transparent 60%),#0b1124;}',
    '.plg-ch{display:flex;align-items:center;gap:24px;}',
    '.plg-av{width:84px;height:84px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;',
    'font-size:42px;font-weight:800;color:#04131a;background:var(--av);box-shadow:0 0 0 6px rgba(255,255,255,.06);}',
    '.plg-ck{font-size:20px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;}',
    '.plg-cn{font-size:40px;font-weight:700;margin-top:4px;}.plg-cn span{font-size:30px;font-weight:500;color:#94a3b8;margin-left:12px;}',
    '.plg-ref{position:absolute;right:62px;top:68px;font:700 32px/1.2 ' + MONO + ';padding:10px 20px;border-radius:14px;white-space:nowrap;',
    'color:#a5f3fc;background:rgba(6,182,212,.16);border:2px solid rgba(6,182,212,.65);}',
    '.plg-root .plg-ref-big{right:auto;left:951px;top:218px;font-size:56px;padding:14px 26px;border-radius:20px;color:#03141a;background:#22d3ee;',
    'border-color:#a5f3fc;box-shadow:0 0 0 6px rgba(6,182,212,.22),0 0 46px 6px rgba(6,182,212,.55);}',
    '.plg-cbody{margin-top:62px;font-size:76px;font-weight:800;line-height:1.06;letter-spacing:-.025em;max-width:1080px;text-wrap:balance;}',
    '.plg-cfoot{position:absolute;left:64px;right:64px;bottom:50px;display:flex;align-items:center;justify-content:space-between;}',
    '.plg-cmeta{font:500 22px/1 ' + MONO + ';color:#94a3b8;}',
    '.plg-checks{display:flex;gap:10px;margin-top:30px;}',
    '.plg-checks i{width:30px;height:30px;border-radius:8px;background:rgba(16,185,129,.85);box-shadow:0 0 14px -2px rgba(16,185,129,.8);}',
    '.plg-tl{position:absolute;left:64px;top:340px;width:1182px;height:4px;border-radius:2px;background:linear-gradient(90deg,#334166,#22d3ee);}',
    '.plg-tl-dot{position:absolute;top:331px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#1e2a4d;border:3px solid #64748b;}',
    '.plg-tl-lbl{position:absolute;top:372px;width:120px;margin-left:-60px;text-align:center;font:600 26px/1 ' + MONO + ';color:#94a3b8;}',
    '.plg-tl-new{background:#22d3ee;border-color:#a5f3fc;width:30px;height:30px;margin-left:-15px;top:327px;box-shadow:0 0 22px 4px rgba(6,182,212,.7);}',
    '.plg-vends{display:flex;gap:16px;margin-top:40px;}',
    '.plg-vend{display:flex;align-items:center;gap:12px;font-size:28px;font-weight:600;padding:12px 20px;border-radius:14px;',
    'background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.14);}',
    '.plg-vend i{width:16px;height:16px;border-radius:50%;background:var(--c);box-shadow:0 0 12px 2px var(--c);}',

    /* ============ seecode */
    '.plg-sq-head{position:absolute;top:54px;width:260px;height:100px;border-radius:18px;padding:16px 10px 0;text-align:center;',
    'background:linear-gradient(180deg,#17223f,#0f172e);border:2px solid #28355c;box-shadow:0 18px 36px -20px rgba(0,0,0,.85);}',
    '.plg-sq-head:before{content:"";position:absolute;left:24px;right:24px;top:-2px;height:5px;border-radius:0 0 5px 5px;background:var(--c);}',
    '.plg-sq-hn{font-size:31px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;}',
    '.plg-sq-hs{font-size:24px;color:#94a3b8;margin-top:5px;white-space:nowrap;}',
    '.plg-sq-hub{border-color:rgba(6,182,212,.7);background:linear-gradient(180deg,#0f2a3c,#0c1a2e);}',
    '.plg-sq-glow{position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border-radius:18px;border:2px solid var(--c);',
    'box-shadow:0 0 0 1px var(--c),0 0 40px -4px var(--c),inset 0 0 26px -10px var(--c);}',
    '.plg-sq-life{fill:none;stroke:#334166;stroke-width:3;stroke-dasharray:6 10;}',
    '.plg-sq-lit{fill:none;stroke-width:4;}',
    '.plg-sq-edge{fill:none;stroke-width:4;stroke-linecap:round;}',
    '.plg-sq-lbl{position:absolute;text-align:center;height:44px;}',
    '.plg-sq-pill{display:inline-flex;align-items:center;gap:10px;padding:6px 16px 6px 7px;border-radius:999px;white-space:nowrap;',
    'font:600 22px/1.2 ' + MONO + ';color:#e2e8f0;background:#0d1530;border:1.5px solid #2c3a63;}',
    '.plg-sq-pill b{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;',
    'font:700 18px/1 ' + MONO + ';color:#04131a;background:var(--c);}',
    '.plg-sq-note{position:absolute;padding:8px 16px;border-radius:12px;font:600 21px/1.25 ' + MONO + ';white-space:nowrap;}',
    '.plg-sq-owed{color:#fcd34d;background:rgba(245,158,11,.12);border:2px dashed rgba(245,158,11,.7);}',
    '.plg-sq-clear{color:#6ee7b7;background:rgba(16,185,129,.14);border:2px solid rgba(16,185,129,.7);}',
    '.plg-sq-strike{position:absolute;left:10px;right:10px;top:50%;height:3px;margin-top:-1px;background:#fcd34d;border-radius:2px;}',
    '.plg-sq-dot{width:20px;height:20px;border-radius:50%;}',
    '.plg-sq-final{position:absolute;left:0;right:0;top:722px;text-align:center;font-size:25px;font-weight:600;color:#94a3b8;letter-spacing:.02em;}',

    /* ============ fftrack */
    '.plg-ff-clip{position:absolute;left:0;top:0;width:1800px;height:880px;overflow:hidden;}',
    '.plg-ff-world{position:absolute;left:0;top:0;width:1800px;height:880px;transform-origin:50% 42%;',
    'animation:plg-ff-drift 14s ease-in-out infinite alternate;}',
    '@keyframes plg-ff-drift{0%{transform:translate(0,0) scale(1);}100%{transform:translate(-12px,-7px) scale(1.014);}}',
    '.plg-ff-img{position:absolute;left:0;top:-110px;width:1800px;height:1013px;max-width:none;filter:brightness(.6) saturate(.75) contrast(1.06);}',
    '.plg-ff-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 70% at 50% 42%,transparent 55%,rgba(4,7,16,.62) 100%),',
    'linear-gradient(180deg,rgba(11,16,32,0) 0,rgba(11,16,32,0) 655px,rgba(11,16,32,.9) 760px,#0b1020 880px);}',
    '.plg-ff-crt{position:absolute;inset:0;pointer-events:none;opacity:.6;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px);}',
    '.plg-trk{position:absolute;filter:drop-shadow(0 0 5px var(--v));}',
    '.plg-root .plg-trk[data-on]{opacity:0;transform:scale(1.5);transition:opacity .16s linear,transform .42s ' + POP + ';}',
    '.plg-root .plg-trk[data-on].is-on{opacity:1;transform:none;}',
    '.plg-trk-fill{position:absolute;inset:0;background:var(--v);opacity:.08;}',
    '.plg-trk-ol{position:absolute;inset:0;border:1.5px solid var(--v);opacity:.45;}',
    '.plg-trk>i{position:absolute;width:20px;height:20px;border:0 solid var(--v);}',
    '.plg-trk>i.tl{left:-3px;top:-3px;border-left-width:4px;border-top-width:4px;}',
    '.plg-trk>i.tr{right:-3px;top:-3px;border-right-width:4px;border-top-width:4px;}',
    '.plg-trk>i.bl{left:-3px;bottom:-3px;border-left-width:4px;border-bottom-width:4px;}',
    '.plg-trk>i.br{right:-3px;bottom:-3px;border-right-width:4px;border-bottom-width:4px;}',
    '.plg-trk-x{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;}',
    '.plg-trk-x:before,.plg-trk-x:after{content:"";position:absolute;background:var(--v);}',
    '.plg-trk-x:before{left:12px;top:0;width:2px;height:26px;}.plg-trk-x:after{left:0;top:12px;width:26px;height:2px;}',
    '.plg-trk-tag{position:absolute;left:4px;top:4px;padding:3px 7px 4px;border-radius:4px;background:var(--v);color:#061016;',
    'font:700 13px/1.15 ' + MONO + ';white-space:nowrap;}',
    '.plg-trk-tag b{display:block;letter-spacing:.06em;}.plg-trk-tag span{display:block;font-weight:600;opacity:.82;}',
    '.plg-trk-tag.below{top:auto;bottom:-46px;left:-3px;}',
    '.plg-ff-track{fill:none;stroke:rgba(226,232,240,.75);stroke-width:2;stroke-dasharray:7 7;}',
    '.plg-ff-tracks{transition:opacity .6s ' + EASE + ';}.plg-ff-tracks.plg-ff-dim{opacity:.18;}',
    '.plg-ff-link{fill:none;stroke-width:2;opacity:.85;}',
    '.plg-ff-ret{position:absolute;left:0;top:0;width:60px;height:60px;z-index:30;pointer-events:none;opacity:0;',
    'border:2px solid #a5f3fc;border-radius:50%;box-shadow:0 0 18px 2px rgba(34,211,238,.7),inset 0 0 12px rgba(34,211,238,.45);}',
    '.plg-ff-ret:before,.plg-ff-ret:after{content:"";position:absolute;background:#a5f3fc;}',
    '.plg-ff-ret:before{left:29px;top:-12px;width:2px;height:84px;}.plg-ff-ret:after{left:-12px;top:29px;width:84px;height:2px;}',
    '.plg-ff-dot{width:10px;height:10px;border-radius:50%;background:var(--v);box-shadow:0 0 10px 3px var(--v);}',
    '.plg-ff-scan{position:absolute;left:0;right:0;top:0;height:880px;pointer-events:none;}',
    '.plg-ff-scanline{position:absolute;left:0;right:0;top:0;height:120px;',
    'background:linear-gradient(180deg,rgba(34,211,238,0),rgba(34,211,238,.10) 85%,rgba(165,243,252,.85) 99%,rgba(34,211,238,0));',
    'animation:plg-ff-scan 2.6s cubic-bezier(.45,0,.55,1) infinite;}',
    '@keyframes plg-ff-scan{0%{transform:translateY(-40px);opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{transform:translateY(560px);opacity:0;}}',
    '.plg-ff-corner{position:absolute;width:46px;height:46px;border:0 solid rgba(226,232,240,.55);}',
    '.plg-ff-hudtl{position:absolute;left:44px;top:30px;display:flex;align-items:center;gap:12px;font:700 19px/1 ' + MONO + ';',
    'letter-spacing:.12em;color:#e2e8f0;text-shadow:0 1px 6px rgba(0,0,0,.9);}',
    '.plg-ff-rec{width:14px;height:14px;border-radius:50%;background:#ef4444;box-shadow:0 0 10px 2px rgba(239,68,68,.8);animation:plg-ff-blink 1.2s steps(1,end) infinite;}',
    '@keyframes plg-ff-blink{50%{opacity:.15;}}',
    '.plg-ff-modes{position:relative;display:inline-block;min-width:150px;height:20px;}.plg-ff-modes>span{position:absolute;left:0;top:0;}',
    '.plg-ff-panel{position:absolute;right:40px;top:46px;width:340px;height:176px;padding:16px 22px;border-radius:16px;',
    'background:rgba(8,12,26,.78);border:1.5px solid rgba(34,211,238,.45);box-shadow:0 18px 40px -16px rgba(0,0,0,.9);}',
    '.plg-ff-plbl{font:700 16px/1 ' + MONO + ';letter-spacing:.16em;color:#94a3b8;}',
    '.plg-ff-num{position:relative;height:88px;margin-top:10px;overflow:hidden;}',
    '.plg-ff-strip{position:absolute;left:0;top:0;}',
    '.plg-ff-strip>div{height:88px;font:700 80px/88px ' + MONO + ';color:#67e8f9;text-shadow:0 0 24px rgba(34,211,238,.55);}',
    '.plg-ff-of{position:absolute;left:112px;top:46px;font:600 26px/1 ' + MONO + ';color:#475569;}',
    '.plg-ff-sub{position:absolute;left:22px;right:16px;bottom:16px;font:600 17px/1.2 ' + MONO + ';color:#94a3b8;white-space:nowrap;}',
    '.plg-ff-sub>span{position:absolute;left:0;bottom:0;}',
    '.plg-ff-mb{position:absolute;left:220px;top:60px;width:160px;height:160px;}',
    '.plg-ff-mbc{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.35),rgba(8,12,26,.88) 62%);',
    'border:2px solid #22d3ee;box-shadow:0 0 0 10px rgba(34,211,238,.12),0 0 50px 6px rgba(34,211,238,.5);}',
    '.plg-ff-mbc svg{position:absolute;left:44px;top:46px;width:72px;height:68px;}',
    '.plg-ff-mbl{position:absolute;left:-50px;width:260px;top:170px;text-align:center;padding:6px 10px 8px;border-radius:12px;background:rgba(8,12,26,.9);border:1.5px solid rgba(34,211,238,.55);}',
    '.plg-ff-mbl b{display:block;font-size:30px;font-weight:800;text-shadow:0 2px 10px rgba(0,0,0,.95);}',
    '.plg-ff-mbl span{display:block;font:600 19px/1.3 ' + MONO + ';color:#a5f3fc;text-shadow:0 2px 8px rgba(0,0,0,.95);}',
    '.plg-fftrack .plg-credit{right:84px;top:13px;color:#cbd5e1;background:rgba(8,12,26,.78);padding:2px 10px;border-radius:6px;}',
    '.plg-ff-legend{position:absolute;left:0;right:0;top:704px;display:flex;justify-content:center;gap:16px;}',
    '.plg-ff-key{display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:12px;font-size:22px;font-weight:600;',
    'background:rgba(8,12,26,.8);border:1.5px solid rgba(255,255,255,.14);}',
    '.plg-ff-key i{width:16px;height:16px;border-radius:3px;border:3px solid var(--v);}',

    /* ============ remocn */
    '.plg-rm-line{position:absolute;left:0;right:0;height:160px;display:flex;justify-content:center;align-items:center;gap:.26em;',
    'font-size:148px;font-weight:800;line-height:1;letter-spacing:-.035em;white-space:nowrap;}',
    '.plg-w{display:inline-block;position:relative;transition:opacity .6s ' + OUT + ',transform .85s ' + OUT + ',filter .85s ' + OUT + ';}',
    '.plg-w.w-pre{opacity:0;filter:blur(20px);transform:scale(1.06);}',
    '.plg-w.w-zin{opacity:0;filter:blur(22px);transform:scale(1.9);}',
    '.plg-w.w-zout{opacity:0;filter:blur(26px);transform:scale(2.3);transition:opacity .45s ' + EASE + ',transform .55s cubic-bezier(.5,0,.75,0),filter .55s ' + EASE + ';}',
    '.plg-w.w-dim{opacity:.26;filter:blur(1.5px);}',
    '.plg-w.w-fout{opacity:0;filter:blur(18px);transform:translateY(-40px);transition:opacity .5s ' + EASE + ',transform .7s ' + EASE + ',filter .6s ' + EASE + ';}',
    '.plg-rm-shared{padding:0 .06em;}',
    '.plg-rm-hl{position:absolute;left:-.08em;right:-.08em;top:.08em;bottom:.02em;border-radius:22px;',
    'background:linear-gradient(90deg,#06b6d4,#8b5cf6 60%,#a855f7);box-shadow:0 0 60px -6px rgba(124,58,237,.75);',
    'transform:scaleX(0);transform-origin:0 50%;transition:transform .7s ' + EASE + ';}',
    '.plg-rm-sha{position:relative;}',
    '.plg-rm-shb{position:absolute;left:.06em;top:0;color:#050b16;clip-path:inset(-10% 100% -10% -2%);transition:clip-path .7s ' + EASE + ';}',
    '.plg-rm-on .plg-rm-hl{transform:scaleX(1);}.plg-rm-on .plg-rm-shb{clip-path:inset(-10% -8% -10% -2%);}',
    '.plg-rm-q{position:relative;display:inline-block;}',
    '.plg-rm-q>span{display:inline-block;transition:opacity .45s ' + EASE + ',transform .6s ' + POP + ';}',
    '.plg-rm-q .q2{position:absolute;left:.08em;top:0;opacity:0;transform:scale(.3);}',
    '.plg-rm-dot .q1{opacity:0;transform:rotate(-25deg) scale(.4);}.plg-rm-dot .q2{opacity:1;transform:none;color:#22d3ee;}',
    '.plg-rm-wrap{position:relative;display:flex;gap:.26em;}',
    '.plg-rm-ul{position:absolute;left:0;right:0;bottom:-30px;height:12px;border-radius:6px;',
    'background:linear-gradient(90deg,#06b6d4,#a855f7);box-shadow:0 0 30px rgba(124,58,237,.6);',
    'transform:scaleX(0);transform-origin:0 50%;transition:transform .9s ' + EASE + ';}',
    '.plg-rm-l2b{transition:transform 1s ' + EASE + ';}',
    '.plg-rm-l2b.is-center{transform:translateY(-95px) scale(1.07);}',
    '.plg-rm-l2b.is-center .plg-rm-ul{transform:scaleX(1);}',

    /* ============ explainroo */
    '.plg-ex-page{position:absolute;left:50px;top:56px;width:1700px;height:708px;border-radius:14px;',
    'background:linear-gradient(90deg,transparent 92px,rgba(220,38,38,.34) 92px,rgba(220,38,38,.34) 94px,transparent 94px),',
    'repeating-linear-gradient(180deg,transparent 0 51px,rgba(59,130,246,.15) 51px 52px),',
    'repeating-radial-gradient(circle at 17% 31%,rgba(60,40,10,.035) 0 1px,transparent 1px 4px),',
    'radial-gradient(1200px 620px at 30% 15%,rgba(255,255,255,.6),transparent 70%),',
    'radial-gradient(900px 500px at 95% 100%,rgba(140,100,40,.14),transparent 70%),#f3ead6;',
    'box-shadow:0 34px 60px -20px rgba(0,0,0,.8),inset 0 0 90px rgba(120,90,40,.22);}',
    '.plg-ex-rings{position:absolute;left:70px;right:70px;top:40px;height:34px;',
    'background:radial-gradient(ellipse 7px 12px at 50% 55%,#2b3550 0 5px,transparent 6px) 0 0/56px 34px repeat-x,',
    'radial-gradient(ellipse 9px 16px at 50% 50%,transparent 6px,#cbd5e1 7px,#94a3b8 9px,transparent 10px) 0 0/56px 34px repeat-x;}',
    '.plg-ex-s{fill:none;stroke-linecap:round;stroke-linejoin:round;}',
    '.plg-ex-s2{fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.45;}',
    '.plg-ex-hand{font-family:' + HAND + ';color:#1e293b;}',
    '.plg-ex-txt{position:absolute;white-space:nowrap;line-height:1.15;}',
    '.plg-root .plg-ex-write[data-on]{opacity:1;transform:none;clip-path:inset(-20% 100% -30% -2%);transition:clip-path var(--dur,.8s) linear;}',
    '.plg-root .plg-ex-write[data-on].is-on{clip-path:inset(-20% -2% -30% -2%);}',
    '.plg-ex-note{position:absolute;left:640px;top:520px;width:520px;height:226px;}',
    '.plg-ex-notein{position:absolute;inset:0;transform:rotate(-1.5deg);border-radius:4px;',
    'background:linear-gradient(180deg,#fff1a8,#fde68a);box-shadow:0 14px 22px -12px rgba(60,40,0,.55),inset 0 -20px 30px -20px rgba(160,110,0,.25);}',
    '.plg-ex-tape{position:absolute;left:200px;top:-16px;width:120px;height:32px;transform:rotate(3deg);background:rgba(203,213,225,.55);',
    'box-shadow:0 1px 2px rgba(0,0,0,.08);}',
    '.plg-ex-clock-h{transition:transform 1.6s ' + EASE + ';}',
    '.plg-ex-m.plg-ex-clock-h{transform:rotate(720deg);}.plg-ex-h.plg-ex-clock-h{transform:rotate(60deg);}',
    '.plg-ex-env{position:absolute;left:0;top:0;width:54px;height:40px;z-index:30;opacity:0;pointer-events:none;',
    'filter:drop-shadow(0 6px 6px rgba(60,40,0,.35));}',

    '@media (prefers-reduced-motion: reduce){.plg-root,.plg-root *,.plg-root *:before,.plg-root *:after{transition:none!important;animation:none!important;}}'
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
    var ctx = { root: null, inner: null, cap: null, cur: -1, els: [], clsEls: [], timers: [], anims: [], temps: [], rafs: [], ro: null, uid: '' };

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
      ctx.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
      ctx.temps.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      ctx.timers = []; ctx.rafs = []; ctx.anims = []; ctx.temps = [];
    }

    var tools = {
      later: function (fn, ms) { ctx.timers.push(setTimeout(fn, ms)); },
      raf: function (fn) { ctx.rafs.push(requestAnimationFrame(fn)); },
      anim: function (el, frames, opts) {
        if (!el || !el.animate) return null;
        var a = el.animate(frames, opts);
        ctx.anims.push(a);
        return a;
      },
      temp: function (el, parent) { (parent || ctx.inner).appendChild(el); ctx.temps.push(el); return el; },
      uid: function () { return ctx.uid; },
      /* move an element along an SVG path string (offset-path, rAF fallback) */
      travel: function (d, o) {
        o = o || {};
        var tok = o.el;
        if (!tok) {
          tok = document.createElement('div');
          tok.className = 'plg-tok' + (o.cls ? ' ' + o.cls : '');
          if (o.html) tok.innerHTML = o.html;
          if (o.style) tok.setAttribute('style', o.style);
        }
        tools.temp(tok, o.parent);
        var delay = o.delay || 0, dur = o.dur || 800, fade = o.fade !== false;
        var kf = fade ? [
          { offsetDistance: '0%', opacity: 0 },
          { offsetDistance: '8%', opacity: 1, offset: 0.08 },
          { offsetDistance: '92%', opacity: 1, offset: 0.92 },
          { offsetDistance: '100%', opacity: 0 }
        ] : [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }];
        if (HAS_OFFSET && tok.animate) {
          tok.style.offsetPath = "path('" + d + "')";
          tok.style.offsetRotate = o.rotate || '0deg';
          var a = tools.anim(tok, kf, {
            duration: dur, delay: delay, easing: o.easing || EASE,
            fill: o.loop ? 'both' : (fade ? 'both' : 'none'),
            iterations: o.loop ? Infinity : 1
          });
          if (a && !o.loop) a.onfinish = function () { if (tok.parentNode) tok.parentNode.removeChild(tok); };
          return tok;
        }
        /* fallback: sample the path and drive transform from rAF */
        var hold = document.createElementNS(NS, 'svg');
        hold.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden');
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        hold.appendChild(p);
        tools.temp(hold);
        var len = p.getTotalLength();
        var t0 = null;
        var ez = o.easing === 'linear' ? function (x) { return x; } : easeIO;
        function frame(ts) {
          if (t0 === null) t0 = ts;
          var raw = (ts - t0) / dur;
          if (o.loop) raw = raw % 1; else raw = Math.min(1, raw);
          var pt = p.getPointAtLength(len * ez(raw));
          tok.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-50%)';
          tok.style.opacity = !fade ? 1 : (raw < 0.08 ? raw / 0.08 : (raw > 0.92 ? (1 - raw) / 0.08 : 1));
          if (o.loop || raw < 1) tools.raf(frame);
          else if (tok.parentNode) tok.parentNode.removeChild(tok);
        }
        tools.later(function () { tools.raf(frame); }, delay);
        return tok;
      },
      burst: function (x, y, o) {
        o = o || {};
        var r = document.createElement('div');
        r.className = 'plg-ring';
        r.style.left = x + 'px'; r.style.top = y + 'px';
        if (o.color) r.style.borderColor = o.color;
        tools.temp(r, o.parent);
        tools.anim(r, [
          { transform: 'scale(.5)', opacity: 0.9 },
          { transform: 'scale(' + (o.scale || 4.2) + ')', opacity: 0 }
        ], { duration: o.dur || 1300, delay: o.delay || 0, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
      }
    };

    function setCaption(i, fwd) {
      var text = def.captions[i] || '';
      var span = ctx.cap;
      if (span.textContent === text && !fwd) return;
      if (fwd) {
        span.classList.add('plg-enter');
        span.textContent = text;
        void span.offsetWidth;
        span.classList.remove('plg-enter');
      } else {
        span.textContent = text;
      }
    }

    function apply(i, fwd, intro) {
      clearTransient();
      ctx.root.classList.add('plg-snap');
      if (intro) {
        /* replay the entrance of step 0: hide its elements, then let them come in */
        ctx.els.forEach(function (el) { if (+el.getAttribute('data-on') === 0) el.classList.remove('is-on'); });
        if (def.preIntro) def.preIntro(ctx.inner);
        void ctx.root.offsetWidth;
      }
      if (fwd) ctx.root.classList.remove('plg-snap');
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
        var a = +el.getAttribute('data-at');
        var until = el.hasAttribute('data-until') ? +el.getAttribute('data-until') : Infinity;
        var cls = el.getAttribute('data-cls');
        var vis = i >= a && i < until;
        var was = el.classList.contains(cls);
        if (vis === was) return;
        if (!el.hasAttribute('data-on')) {
          el.style.transitionDelay = ((fwd && vis) ? +(el.getAttribute('data-cd') || 0) : 0) + 'ms';
        }
        el.classList.toggle(cls, vis);
      });
      setCaption(i, fwd);
      if (def.snap) def.snap(i, ctx.inner, fwd, intro);
      if (!fwd) {
        void ctx.root.offsetWidth;
        ctx.root.classList.remove('plg-snap');
      }
      ctx.cur = i;
      ctx.root.setAttribute('data-step', String(i));
      if (fwd && def.forward) def.forward(i, tools, ctx.inner, intro);
      if (def.ambient && !reducedMotion()) def.ambient(i, tools, ctx.inner, fwd);
    }

    var api = {
      steps: def.captions.length,
      mount: function (container) {
        if (!container) return;
        injectStyle();
        if (ctx.ro) { try { ctx.ro.disconnect(); } catch (e) { /* ignore */ } }
        if (ctx.root) clearTransient();
        ctx.uid = 'plg' + (++uidSeq);
        var root = document.createElement('div');
        root.className = 'plg-root plg-' + def.name;
        root.setAttribute('role', 'img');
        root.setAttribute('aria-label', def.label);
        var inner = document.createElement('div');
        inner.className = 'plg-inner';
        inner.innerHTML = def.html(ctx.uid);
        var credit = document.createElement('div');
        credit.className = 'plg-credit';
        credit.textContent = def.credit;
        inner.appendChild(credit);
        var capBox = document.createElement('div');
        capBox.className = 'plg-caption';
        capBox.setAttribute('aria-live', 'polite');
        var cap = document.createElement('span');
        cap.className = 'plg-cap-text';
        capBox.appendChild(cap);
        inner.appendChild(capBox);
        root.appendChild(inner);
        container.innerHTML = '';
        container.appendChild(root);
        ctx.root = root; ctx.inner = inner; ctx.cap = cap;
        ctx.els = Array.prototype.slice.call(inner.querySelectorAll('[data-on]'));
        ctx.clsEls = Array.prototype.slice.call(inner.querySelectorAll('[data-at]'));
        if (def.init) def.init(inner, ctx.uid);
        ctx.cur = -1;
        fit();
        if (window.ResizeObserver) {
          ctx.ro = new ResizeObserver(fit);
          ctx.ro.observe(root);
        } else {
          window.addEventListener('resize', fit);
        }
        apply(0, false, false);
      },
      step: function (i) {
        if (!ctx.inner) return;
        i = Math.max(0, Math.min(api.steps - 1, Math.round(+i || 0)));
        fit();
        var rm = reducedMotion();
        var intro = !rm && i === 0 && ctx.cur === 0;
        var fwd = !rm && (intro || i === ctx.cur + 1);
        apply(i, fwd, intro);
      }
    };
    return api;
  }

  /* offset of el relative to an ancestor, ignoring transforms */
  function offsetIn(el, anc) {
    var x = 0, y = 0, n = el;
    while (n && n !== anc) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  /* sample a pure function of time into Web Animations keyframes */
  function sampleFx(fx, n, hold, c) {
    var out = { A: [], B: [], X: [] };
    function push(list, st, off) {
      var k = {}; for (var p in st) if (Object.prototype.hasOwnProperty.call(st, p)) k[p] = st[p];
      k.offset = off; list.push(k);
    }
    for (var k = 0; k <= n; k++) {
      var r = k / n;
      var st = fx(r, k, c);
      var offs = [r];
      if (hold && k < n) offs.push(Math.max(r, (k + 1) / n - 0.0001));
      offs.forEach(function (off) {
        push(out.A, st.A || {}, off);
        push(out.B, st.B || {}, off);
        (st.X || []).forEach(function (xs, j) { out.X[j] = out.X[j] || []; push(out.X[j], xs, off); });
      });
    }
    return out;
  }

  /* ========================================================= 1. SHOWTIME */
  var SW = 1310, SH = 620;
  var ST_FX = [
    { name: 'iris', sub: 'circle from one point', dur: 1150 },
    { name: 'wipe bars', sub: 'seven staggered strips', dur: 1250 },
    { name: 'glitch', sub: 'turbulence, RGB split', dur: 1050 },
    { name: 'whip-pan', sub: 'directional blur', dur: 950 },
    { name: 'match', sub: 'shared element, FLIP', dur: 1250 },
    { name: 'zoom-through', sub: 'scale through, blur', dur: 1150 }
  ];

  function stDefs(u) {
    var gl = '';
    var cfg = [[1, 'a', 14, 5, 3], [1, 'b', 18, 7, 9], [2, 'a', 32, 10, 5], [2, 'b', 38, 13, 11], [3, 'a', 58, 18, 7], [3, 'b', 70, 22, 13]];
    cfg.forEach(function (g) {
      gl += '<filter id="' + u + '-gl' + g[0] + g[1] + '" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.0015 ' + (0.05 + g[0] * 0.03) + '" numOctaves="1" seed="' + g[4] + '" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + g[2] + '" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
        '<feColorMatrix in="d" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
        '<feOffset in="r" dx="' + (-g[3]) + '" dy="0" result="ro"/>' +
        '<feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/>' +
        '<feOffset in="gb" dx="' + g[3] + '" dy="0" result="go"/>' +
        '<feBlend in="ro" in2="go" mode="screen"/>' +
        '</filter>';
    });
    var wb = '';
    [[1, 10], [2, 28], [3, 56]].forEach(function (b) {
      wb += '<filter id="' + u + '-wb' + b[0] + '" x="-20%" y="-5%" width="140%" height="110%">' +
        '<feGaussianBlur stdDeviation="' + b[1] + ' 0"/></filter>';
    });
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + gl + wb + '</svg>';
  }

  function stCard(k, c) {
    var head = c.head ||
      ('<div class="plg-ch"><div class="plg-av" style="--av:' + c.avc + '">' + c.av + '</div>' +
       '<div><div class="plg-ck">' + c.kick + '</div><div class="plg-cn">' + c.who + '<span>' + c.to + '</span></div></div></div>');
    return '<div class="plg-card st-c' + k + '" data-card="' + k + '">' + head + (c.inner || '') +
      '<div class="plg-ref' + (c.big ? ' plg-ref-big' : '') + '" data-ref="1">#248</div>' +
      (c.body ? '<div class="plg-cbody">' + c.body + '</div>' : '') + (c.extra || '') +
      '<div class="plg-cfoot"><span class="plg-chip ' + c.chip[0] + '">' + c.chip[1] + '</span><span class="plg-cmeta">' + c.meta + '</span></div>' +
      '</div>';
  }

  function showtimeHtml(u) {
    var rail = '<div class="plg-st-rail"><div class="plg-st-kick plg-fade"' + at(0, 0) + '>Transitions</div>' +
      '<div class="plg-st-hl"></div>';
    ST_FX.forEach(function (f, k) {
      rail += '<div class="plg-st-item" data-k="' + k + '" style="top:' + (48 + k * 94) + 'px"' + at(0, 120 + k * 70) + '>' +
        '<span class="plg-st-num">0' + (k + 1) + '</span>' +
        '<div><div class="plg-st-name">' + f.name + '</div><div class="plg-st-sub">' + f.sub + '</div></div>' +
        '<svg class="plg-st-tick" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="#10b981"/>' +
        '<path d="M8.5 15.5l4.2 4.2 8.8-9" fill="none" stroke="#03150e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>';
    });
    rail += '</div>';
    var tag = '<div class="plg-st-tag"><span class="plg-st-tname">iris</span><span class="plg-st-t">t = 1.00</span>' +
      '<span class="plg-st-bar"><i></i></span></div>';
    var cards = [
      stCard(0, { av: 'n', avc: '#22d3ee', kick: 'A message from neo to joey', who: 'neo', to: 'to joey',
        body: '#248 is ready for review', chip: ['c-amber', 'needs an answer'], meta: 'thread #248, message 1' }),
      stCard(1, { av: 'j', avc: '#c084fc', kick: 'joey answers neo', who: 'joey', to: 'to neo',
        body: 'Approve, with one small ask', chip: ['c-violet', 'in-reply-to message 1'], meta: 'thread #248, message 2' }),
      stCard(2, { av: 'n', avc: '#22d3ee', kick: 'neo answers joey', who: 'neo', to: 'to joey',
        body: 'Small ask done in one more commit', chip: ['c-amber', 'needs a final look'], meta: 'thread #248, message 3' }),
      stCard(3, { av: 'g', avc: '#34d399', kick: 'The pre-push gate reports', who: 'gate', to: 'to everyone',
        body: 'Gate green: every suite passed', extra: '<div class="plg-checks">' + new Array(25).join('<i></i>') + '</div>',
        chip: ['c-green', 'checks passed'], meta: 'thread #248, message 4' }),
      stCard(4, { av: 'b', avc: '#fbbf24', kick: 'baleen reports to everyone', who: 'baleen', to: 'to everyone',
        body: 'Merged #248 into main', chip: ['c-cyan', 'merged'], meta: 'thread #248, message 5' }),
      stCard(5, { big: true,
        head: '<div class="plg-ch"><div class="plg-av" style="--av:#94a3b8">m</div>' +
          '<div><div class="plg-ck">The main branch, after the merge</div><div class="plg-cn">main<span>newest on the right</span></div></div></div>',
        inner: '<div class="plg-tl"></div>' +
          [[220, '#241'], [470, '#243'], [720, '#247']].map(function (d) {
            return '<div class="plg-tl-dot" style="left:' + d[0] + 'px"></div><div class="plg-tl-lbl" style="left:' + d[0] + 'px">' + d[1] + '</div>';
          }).join('') +
          '<div class="plg-tl-dot plg-tl-new" style="left:1040px"></div>' +
          '<div class="plg-cbody" style="position:absolute;left:64px;top:428px;margin:0;font-size:58px">main now carries #248</div>',
        chip: ['c-cyan', 'merged by baleen'], meta: 'the shared chip is the same element' }),
      stCard(6, { av: '<svg viewBox="0 0 40 40" width="44" height="44" aria-hidden="true"><path d="M10 21l7 7 14-15" fill="none" stroke="#03150e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>', avc: '#34d399', kick: 'The owed list for thread #248', who: 'owed list', to: 'for everyone',
        body: 'Empty. Every agent saw #248 land.',
        extra: '<div class="plg-vends">' +
          [['Claude Code', '#f59e0b'], ['Codex', '#10b981'], ['Kimi', '#a855f7'], ['Antigravity', '#60a5fa']].map(function (v) {
            return '<span class="plg-vend" style="--c:' + v[1] + '"><i></i>' + v[0] + '</span>';
          }).join('') + '</div>',
        chip: ['c-green', 'thread closed'], meta: 'nothing owed' })
    ];
    return stDefs(u) + rail + tag + '<div class="plg-st-stage">' + cards.join('') + '</div>';
  }

  var ST_FUNCS = {
    iris: function (r, k, c) {
      var p = easeIO(r);
      return {
        A: { opacity: r < 1 ? 1 : 0, filter: 'brightness(' + f2(lerp(1, 0.45, p)) + ')' },
        B: { opacity: 1, clipPath: 'circle(' + f2(c.R * p) + 'px at ' + f2(c.cx) + 'px ' + f2(c.cy) + 'px)' }
      };
    },
    'wipe bars': function (r, k, c) {
      var bw = SW / 7, d = '', X = [];
      for (var b = 0; b < 7; b++) {
        var q = easeIO(clamp((r - b * 0.07) / (1 - 6 * 0.07), 0, 1));
        var x0 = b * bw - 0.5, x1 = (b + 1) * bw + 0.5, y = SH * q;
        d += 'M' + f2(x0) + ' 0 L' + f2(x1) + ' 0 L' + f2(x1) + ' ' + f2(y) + ' L' + f2(x0) + ' ' + f2(y) + ' Z ';
        X.push({ transform: 'translateY(' + f2(y - 3) + 'px)', opacity: (q > 0.01 && q < 0.995) ? 1 : 0 });
      }
      return {
        A: { opacity: r < 1 ? 1 : 0, filter: 'brightness(' + f2(lerp(1, 0.5, smooth(0, 0.8, r))) + ')' },
        B: { opacity: 1, clipPath: "path('" + d.trim() + "')" },
        X: X
      };
    },
    glitch: function (r, k) {
      var s = Math.pow(Math.sin(Math.PI * r), 2.2);
      var lvl = s > 0.75 ? 3 : (s > 0.4 ? 2 : (s > 0.08 ? 1 : 0));
      var f = lvl ? 'url(#' + this.u + '-gl' + lvl + (k % 2 ? 'a' : 'b') + ')' : 'none';
      var showB = r > 0.56 || (r > 0.4 && hash(k + 7) > 0.5);
      var jit = lvl ? (hash(k) * 2 - 1) * 30 * s : 0;
      var sl = lvl ? 'inset(' + f2(hash(k + 3) * 18 * s) + '% 0 ' + f2(hash(k + 5) * 14 * s) + '% 0)' : 'inset(0% 0 0% 0)';
      return {
        A: { opacity: showB ? 0 : 1, filter: showB ? 'none' : f, transform: 'translateX(' + f2(jit) + 'px)', clipPath: showB ? 'inset(0% 0 0% 0)' : sl },
        B: { opacity: showB ? 1 : 0, filter: showB ? f : 'none', transform: 'translateX(' + f2(-jit) + 'px)', clipPath: showB ? sl : 'inset(0% 0 0% 0)' }
      };
    },
    'whip-pan': function (r) {
      var p = easeIO(r);
      var v = r < 0.5 ? 12 * r * r : 12 * (1 - r) * (1 - r);
      var lvl = v > 2.1 ? 3 : (v > 1.0 ? 2 : (v > 0.35 ? 1 : 0));
      var f = lvl ? 'url(#' + this.u + '-wb' + lvl + ')' : 'none';
      return {
        A: { transform: 'translateX(' + f2(-p * 112) + '%)', filter: f, opacity: r < 1 ? 1 : 0 },
        B: { transform: 'translateX(' + f2((1 - p) * 112) + '%)', filter: f, opacity: 1 }
      };
    },
    match: function (r, k, c) {
      var pa = smooth(0, 0.55, r), pb = smooth(0.32, 1, r), q = easeIO(smooth(0.04, 0.92, r));
      return {
        A: { opacity: 1 - pa, transform: 'scale(' + f2(lerp(1, 0.965, pa)) + ')' },
        B: { opacity: pb, transform: 'scale(' + f2(lerp(1.035, 1, pb)) + ')' },
        X: [{ transform: 'translate(' + f2(c.dx * (1 - q)) + 'px,' + f2(c.dy * (1 - q)) + 'px) scale(' + (lerp(c.s, 1, q)).toFixed(4) + ')' }]
      };
    },
    'zoom-through': function (r) {
      var a = easeIO(smooth(0, 0.8, r)), b = easeOut(smooth(0.22, 1, r));
      return {
        A: { transform: 'scale(' + f2(lerp(1, 2.5, a)) + ')', filter: 'blur(' + f2(a * 16) + 'px)', opacity: 1 - smooth(0.12, 0.72, r), zIndex: 3 },
        B: { transform: 'scale(' + f2(lerp(0.78, 1, b)) + ')', filter: 'blur(' + f2((1 - b) * 12) + 'px)', opacity: smooth(0.22, 0.8, r), zIndex: 2 }
      };
    }
  };

  function stSnap(i, inner) {
    var cards = inner.querySelectorAll('.plg-card');
    for (var k = 0; k < cards.length; k++) {
      var c = cards[k];
      c.style.opacity = k === i ? '1' : '0';
      c.style.visibility = (k === i || k === i - 1) ? 'visible' : 'hidden';
      c.style.zIndex = k === i ? '2' : (k === i - 1 ? '1' : '0');
    }
    var items = inner.querySelectorAll('.plg-st-item');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('is-done', j + 1 < i);
      items[j].classList.toggle('is-act', j + 1 === i);
    }
    var hl = inner.querySelector('.plg-st-hl');
    if (i >= 1) hl.style.transform = 'translateY(' + (48 + (i - 1) * 94) + 'px)';
    hl.style.opacity = i >= 1 ? '1' : '0';
    var tag = inner.querySelector('.plg-st-tag');
    tag.style.opacity = i >= 1 ? '1' : '0';
    if (i >= 1) inner.querySelector('.plg-st-tname').textContent = ST_FX[i - 1].name;
    inner.querySelector('.plg-st-t').textContent = 't = 1.00';
    inner.querySelector('.plg-st-bar>i').style.transform = 'scaleX(1)';
  }

  function stForward(i, tools, inner) {
    var cards = inner.querySelectorAll('.plg-card');
    if (i === 0) {
      tools.anim(cards[0], [
        { opacity: 0, transform: 'scale(.94)', filter: 'blur(10px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' }
      ], { duration: 800, delay: 150, easing: OUT, fill: 'backwards' });
      return;
    }
    var A = cards[i - 1], B = cards[i];
    var spec = ST_FX[i - 1], dur = spec.dur;
    var stage = inner.querySelector('.plg-st-stage');
    var c = { u: tools.uid() };
    var fx = ST_FUNCS[spec.name];
    var extras = [];
    if (spec.name === 'iris') {
      var ra = offsetIn(A.querySelector('[data-ref]'), A);
      c.cx = ra.x + ra.w / 2; c.cy = ra.y + ra.h / 2;
      c.R = Math.sqrt(Math.pow(Math.max(c.cx, SW - c.cx), 2) + Math.pow(Math.max(c.cy, SH - c.cy), 2)) + 6;
    }
    if (spec.name === 'wipe bars') {
      for (var b = 0; b < 7; b++) {
        var e = document.createElement('div');
        e.setAttribute('style', 'position:absolute;left:' + f2(b * SW / 7) + 'px;top:0;width:' + f2(SW / 7) + 'px;height:6px;z-index:4;opacity:0;' +
          'background:linear-gradient(90deg,rgba(165,243,252,.2),#a5f3fc,rgba(165,243,252,.2));box-shadow:0 0 18px 4px rgba(34,211,238,.75)');
        extras.push(tools.temp(e, stage));
      }
    }
    if (spec.name === 'match') {
      var chipA = A.querySelector('[data-ref]'), chipB = B.querySelector('[data-ref]');
      var a0 = offsetIn(chipA, A), b0 = offsetIn(chipB, B);
      c.s = a0.w / b0.w;
      c.dx = a0.x + a0.w / 2 - b0.w * c.s / 2 - b0.x;
      c.dy = a0.y + a0.h / 2 - b0.h * c.s / 2 - b0.y;
      var fl = document.createElement('div');
      fl.className = chipB.className;
      fl.textContent = chipB.textContent;
      fl.style.zIndex = '6';
      fl.style.transformOrigin = '0 0';
      extras.push(tools.temp(fl, stage));
      tools.anim(chipA, [{ opacity: 0 }, { opacity: 0 }], { duration: dur, fill: 'both' });
      tools.anim(chipB, [{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], { duration: dur, fill: 'both' });
    }
    var hold = spec.name === 'glitch';
    var kf = sampleFx(function (r, k) { return fx.call(c, r, k, c); }, hold ? 30 : 48, hold, c);
    var opts = { duration: dur, easing: 'linear', fill: 'both' };
    tools.anim(A, kf.A, opts);
    var main = tools.anim(B, kf.B, opts);
    extras.forEach(function (el, j) {
      var a = tools.anim(el, kf.X[j], opts);
      if (a && spec.name === 'match') a.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    });

    /* the tag: name settles in, the clock t runs 0 to 1 */
    var tag = inner.querySelector('.plg-st-tag'), tname = inner.querySelector('.plg-st-tname');
    var tval = inner.querySelector('.plg-st-t'), bar = inner.querySelector('.plg-st-bar>i');
    tools.anim(tname, [
      { opacity: 0, transform: 'translateY(14px)', filter: 'blur(8px) drop-shadow(0 0 0 rgba(34,211,238,0))' },
      { opacity: 1, transform: 'none', filter: 'blur(0px) drop-shadow(0 0 18px rgba(34,211,238,.95))', offset: 0.25 },
      { opacity: 1, transform: 'none', filter: 'blur(0px) drop-shadow(0 0 18px rgba(34,211,238,.95))', offset: 0.8 },
      { opacity: 1, transform: 'none', filter: 'blur(0px) drop-shadow(0 0 0 rgba(34,211,238,0))' }
    ], { duration: dur + 250, easing: 'ease-out', fill: 'backwards' });
    if (i === 1) tools.anim(tag, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'backwards' });
    tools.anim(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur, easing: 'linear', fill: 'backwards' });
    tval.textContent = 't = 0.00';
    if (!main) { tval.textContent = 't = 1.00'; return; }
    (function tick() {
      var ct = main.currentTime;
      var t = ct == null ? 0 : clamp(ct / dur, 0, 1);
      tval.textContent = 't = ' + t.toFixed(2);
      if (main.playState !== 'finished' && main.playState !== 'idle') tools.raf(tick);
      else tval.textContent = 't = 1.00';
    })();
  }

  var showtime = makeScene({
    name: 'showtime',
    label: 'A transition gallery in the showtime style: one message card about pull request 248 replaced by the next using six named transitions.',
    credit: 'technique: showtime by Favio Vazquez, github.com/FavioVazquez/showtime (MIT)',
    captions: [
      'One thread about pull request #248. Each next card arrives through a named transition.',
      'iris: the reply opens as a circle from the point it answers.',
      'wipe bars: seven strips, each one a beat behind the last.',
      'glitch: turbulence displaces the frame, the color channels split, then it settles.',
      'whip-pan: both cards travel sideways under a directional blur.',
      'match: the shared #248 chip flies to its new place while the rest dissolves.',
      'Every transition is a function of time: give it t, get one picture.'
    ],
    html: showtimeHtml,
    snap: stSnap,
    forward: stForward
  });

  /* ========================================================== 2. SEECODE */
  var SQ_COLS = [
    { x: 220, n: 'Claude Code', s: 'Anthropic', c: '#f59e0b' },
    { x: 560, n: 'Codex', s: 'OpenAI', c: '#10b981' },
    { x: 900, n: 'MeshyChat', s: 'shared mailbox', c: '#22d3ee', hub: true },
    { x: 1240, n: 'Kimi', s: 'Moonshot AI', c: '#a855f7' },
    { x: 1580, n: 'Antigravity', s: 'Google', c: '#60a5fa' }
  ];
  /* step, from, to, y, label, kind, color, number */
  var SQ_MSGS = [
    [1, 0, 2, 222, 'request: review #248', 'sync', '#f59e0b', '1'],
    [2, 2, 1, 306, 'deliver', 'async', '#22d3ee', '2'],
    [3, 1, 2, 390, 'answer: approve', 'reply', '#10b981', '3'],
    [4, 2, 0, 474, 'answer, in-reply-to 1', 'reply', '#22d3ee', '4'],
    [5, 0, 2, 558, 'ack', 'sync', '#f59e0b', '5'],
    [6, 2, 3, 642, 'cc: same thread', 'async', '#22d3ee', '6'],
    [6, 2, 4, 704, 'cc: same thread', 'async', '#22d3ee', '7']
  ];
  var SQ_TOP = 156, SQ_BOT = 740;

  function sqGeom(m) {
    var x1 = SQ_COLS[m[1]].x, xt = SQ_COLS[m[2]].x, dir = xt > x1 ? 1 : -1;
    var xs = x1 + dir * 4, xe = xt - dir * 20, tip = xt - dir * 3;
    return { y: m[3], dir: dir, xs: xs, xe: xe, tip: tip, d: 'M' + xs + ' ' + m[3] + ' L' + xe + ' ' + m[3], full: 'M' + xs + ' ' + m[3] + ' L' + tip + ' ' + m[3] };
  }
  function sqDelay(m) {
    /* the second cc arrow of the last step follows the first */
    return (m[0] === 6 && m[7] === '7') ? 520 : 0;
  }

  function seecodeHtml(u) {
    var svg = '<svg class="plg-svg" viewBox="0 0 1800 880" aria-hidden="true">';
    SQ_COLS.forEach(function (c, k) {
      svg += '<path class="plg-sq-life plg-fade" d="M' + c.x + ' ' + SQ_TOP + ' L' + c.x + ' ' + SQ_BOT + '"' + at(0, 250 + k * 80) + '/>';
      svg += '<path class="plg-sq-lit plg-draw" pathLength="1" style="stroke:' + c.c + ';--dur:1s;filter:drop-shadow(0 0 6px ' + c.c + ')" d="M' + c.x + ' ' + SQ_TOP + ' L' + c.x + ' ' + SQ_BOT + '"' +
        at(6, 1150 + k * 110) + '/>';
    });
    SQ_MSGS.forEach(function (m, k) {
      var g = sqGeom(m), dl = sqDelay(m), id = u + '-sq' + k;
      if (m[5] === 'sync') {
        svg += '<path class="plg-sq-edge plg-draw" pathLength="1" style="stroke:' + m[6] + '" d="' + g.d + '"' + at(m[0], 100 + dl) + '/>';
      } else {
        svg += '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="1800" height="880">' +
          '<path class="plg-draw" pathLength="1" d="' + g.d + '" fill="none" stroke="#fff" stroke-width="16"' + at(m[0], 100 + dl) + '/></mask>' +
          '<path class="plg-sq-edge" mask="url(#' + id + ')" style="stroke:' + m[6] + ';stroke-dasharray:' + (m[5] === 'reply' ? '12 10' : '22 8') + '" d="' + g.d + '"/>';
      }
      var hx = g.tip, hy = g.y, bx = g.tip - g.dir * 20;
      if (m[5] === 'sync') {
        svg += '<path class="plg-pop" style="fill:' + m[6] + '" d="M' + hx + ' ' + hy + ' L' + bx + ' ' + (hy - 11) + ' L' + bx + ' ' + (hy + 11) + ' Z"' + at(m[0], 720 + dl) + '/>';
      } else {
        svg += '<path class="plg-pop" style="fill:none;stroke:' + m[6] + ';stroke-width:4;stroke-linecap:round;stroke-linejoin:round" d="M' + bx + ' ' + (hy - 12) +
          ' L' + hx + ' ' + hy + ' L' + bx + ' ' + (hy + 12) + '"' + at(m[0], 720 + dl) + '/>';
      }
      svg += '<circle class="plg-pop" cx="' + g.xs + '" cy="' + g.y + '" r="7" style="fill:' + m[6] + '"' + at(m[0], 60 + dl) + '/>';
    });
    svg += '</svg>';

    var heads = '';
    SQ_COLS.forEach(function (c, k) {
      heads += '<div class="plg-sq-head plg-pop' + (c.hub ? ' plg-sq-hub' : '') + '" style="left:' + (c.x - 130) + 'px;--c:' + c.c + '"' + at(0, k * 90) + '>' +
        '<div class="plg-sq-glow plg-fade" style="--c:' + c.c + '"' + at(6, 1150 + k * 110) + '></div>' +
        '<div class="plg-sq-hn">' + c.n + '</div><div class="plg-sq-hs">' + c.s + '</div></div>';
    });

    var labels = '';
    SQ_MSGS.forEach(function (m) {
      var g = sqGeom(m), dl = sqDelay(m);
      var lo = Math.min(SQ_COLS[m[1]].x, SQ_COLS[m[2]].x), hi = Math.max(SQ_COLS[m[1]].x, SQ_COLS[m[2]].x);
      labels += '<div class="plg-sq-lbl" style="left:' + lo + 'px;width:' + (hi - lo) + 'px;top:' + (g.y - 52) + 'px"' + at(m[0], 260 + dl) + '>' +
        '<span class="plg-sq-pill" style="--c:' + m[6] + '"><b>' + m[7] + '</b>' + m[4] + '</span></div>';
    });

    var notes =
      '<div class="plg-sq-note plg-sq-owed plg-pop" style="left:932px;top:288px" data-at="5" data-cls="plg-dimmed"' + at(2, 820) + '>Codex owes an answer' +
        '<div class="plg-sq-strike plg-grow"' + at(5, 900) + '></div></div>' +
      '<div class="plg-sq-note plg-sq-clear plg-pop" style="left:932px;top:530px"' + at(5, 1050) + '>owed cleared</div>';

    return svg + heads + labels + notes;
  }

  function sqTokens(i, tools, fwd) {
    SQ_MSGS.forEach(function (m) {
      if (m[0] !== i) return;
      var g = sqGeom(m), dl = sqDelay(m);
      var st = 'width:20px;height:20px;border-radius:50%;background:' + m[6] + ';box-shadow:0 0 0 5px rgba(255,255,255,.12),0 0 24px 8px ' + m[6];
      if (fwd) tools.travel(g.full, { style: st, delay: 100 + dl, dur: 700 });
      tools.travel(g.full, { style: st, delay: (fwd ? 1100 : 200) + dl, dur: 1900, loop: true, easing: 'linear' });
    });
  }

  var seecode = makeScene({
    name: 'seecode',
    label: 'A self-drawing sequence diagram in the SeeCode style: Claude Code, Codex, Kimi, and Antigravity talk through MeshyChat.',
    credit: 'technique: SeeCode by Aryanutkarsh, github.com/Aryanutkarsh/SeeCode (MIT)',
    captions: [
      'A sequence diagram that draws itself, one message per step.',
      'Claude Code sends a request through MeshyChat.',
      'MeshyChat delivers it to Codex and records that Codex owes an answer.',
      'Codex answers on the same thread.',
      'The answer reaches Claude Code, marked in-reply-to the request.',
      'Claude Code acks, and the owed entry clears.',
      'Four vendors, one conversation.'
    ],
    html: seecodeHtml,
    ambient: function (i, tools, inner, fwd) { if (i >= 1) sqTokens(i, tools, fwd); }
  });

  /* ========================================================== 3. FFTRACK */
  var FF_V = {
    cc: { n: 'CLAUDE', c: '#f59e0b' },
    cx: { n: 'CODEX', c: '#10b981' },
    km: { n: 'KIMI', c: '#c084fc' },
    ag: { n: 'ANTIGRAV', c: '#60a5fa' }
  };
  var FF_DY = -110; /* the photo is shifted up so the screens sit in frame */
  /* x1, y1, x2, y2 in photo pixels, vendor, confidence, step, tag placement */
  var FF_BOX = [
    [678, 208, 766, 378, 'cc', 0.97, 1],
    [772, 208, 860, 378, 'cx', 0.95, 1],
    [866, 208, 952, 378, 'km', 0.93, 1],
    [889, 404, 1040, 590, 'cc', 0.98, 1],
    [737, 400, 885, 590, 'cc', 0.96, 1],
    [563, 400, 733, 586, 'cx', 0.97, 1],
    [338, 408, 543, 600, 'cc', 0.94, 2],
    [34, 420, 334, 640, 'cx', 0.92, 2],
    [1050, 374, 1205, 565, 'cc', 0.97, 2],
    [1211, 374, 1395, 608, 'ag', 0.95, 2],
    [1402, 377, 1585, 690, 'cc', 0.98, 2],
    [1590, 380, 1780, 714, 'cx', 0.96, 2],
    [1313, 642, 1392, 756, 'cc', 0.91, 3, 'below'],
    [1088, 558, 1177, 675, 'km', 0.94, 3],
    [994, 558, 1084, 680, 'cx', 0.93, 3],
    [374, 598, 596, 748, 'ag', 0.92, 3]
  ];
  var FF_START = [900, 400];
  var FF_MAIL = [300, 140];
  function ffCenter(b) { return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2 + FF_DY]; }
  function ffHop(k) {
    /* position of box k inside its step group */
    var s = FF_BOX[k][6], n = 0;
    for (var j = 0; j < k; j++) if (FF_BOX[j][6] === s) n++;
    return n;
  }
  function ffDelay(k) { return 220 + ffHop(k) * 360; }
  function ffCount(i) { var n = 0; FF_BOX.forEach(function (b) { if (b[6] <= i) n++; }); return n; }

  function fftrackHtml(u) {
    var w = '<div class="plg-ff-clip"><div class="plg-ff-world"><img class="plg-ff-img" alt="" src="' + fleetImg() + '">';
    var svg = '<svg class="plg-svg" viewBox="0 0 1800 880" aria-hidden="true"><defs>';
    var lines = '';
    FF_BOX.forEach(function (b, k) {
      if (k === 0) return;
      var p = ffCenter(FF_BOX[k - 1]), q = ffCenter(b), id = u + '-tr' + k;
      var d = 'M' + f2(p[0]) + ' ' + f2(p[1]) + ' L' + f2(q[0]) + ' ' + f2(q[1]);
      svg += '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="1800" height="880">' +
        '<path class="plg-draw" pathLength="1" style="--dur:.3s" d="' + d + '" fill="none" stroke="#fff" stroke-width="10"' + at(b[6], ffDelay(k)) + '/></mask>';
      lines += '<path class="plg-ff-track" mask="url(#' + id + ')" d="' + d + '"/>';
    });
    svg += '</defs><g class="plg-ff-tracks" data-at="4" data-cls="plg-ff-dim">' + lines + '</g>';
    FF_BOX.forEach(function (b, k) {
      var q = ffCenter(b);
      svg += '<path class="plg-ff-link plg-draw" pathLength="1" style="stroke:' + FF_V[b[4]].c + ';--dur:.65s" d="M' + f2(q[0]) + ' ' + f2(q[1]) +
        ' L' + FF_MAIL[0] + ' ' + FF_MAIL[1] + '"' + at(4, k * 45) + '/>';
    });
    svg += '</svg>';
    w += svg;
    FF_BOX.forEach(function (b, k) {
      var v = FF_V[b[4]], id = (k < 9 ? '0' : '') + (k + 1);
      w += '<div class="plg-trk" style="left:' + b[0] + 'px;top:' + (b[1] + FF_DY) + 'px;width:' + (b[2] - b[0]) + 'px;height:' + (b[3] - b[1]) + 'px;--v:' + v.c + '"' +
        at(b[6], ffDelay(k) + 250) + '>' +
        '<div class="plg-trk-fill"></div><div class="plg-trk-ol"></div><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>' +
        '<div class="plg-trk-x"></div>' +
        '<div class="plg-trk-tag' + (b[7] ? ' ' + b[7] : '') + '"><b>' + v.n + '</b><span>#' + id + ' ' + b[5].toFixed(2) + '</span></div></div>';
    });
    w += '<div class="plg-ff-mb plg-pop"' + at(4, 520) + '><div class="plg-ff-mbc">' +
      '<svg viewBox="0 0 72 68" aria-hidden="true"><rect x="5" y="14" width="62" height="44" rx="6" fill="none" stroke="#a5f3fc" stroke-width="4"/>' +
      '<path d="M7 18l29 22 29-22" fill="none" stroke="#a5f3fc" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg></div>' +
      '<div class="plg-ff-mbl"><b>MeshyChat</b><span>one shared mailbox</span></div></div>';
    w += '</div></div>';

    var hud = '<div class="plg-ff-vig"></div><div class="plg-ff-crt"></div>' +
      '<div class="plg-ff-scan plg-fade"' + at(0, 0, ' data-off="1"') + '><div class="plg-ff-scanline"></div></div>' +
      '<div class="plg-ff-corner" style="left:22px;top:22px;border-left-width:3px;border-top-width:3px"></div>' +
      '<div class="plg-ff-corner" style="right:22px;top:22px;border-right-width:3px;border-top-width:3px"></div>' +
      '<div class="plg-ff-corner" style="left:22px;top:812px;border-left-width:3px;border-bottom-width:3px"></div>' +
      '<div class="plg-ff-corner" style="right:22px;top:812px;border-right-width:3px;border-bottom-width:3px"></div>' +
      '<div class="plg-ff-hudtl"><i class="plg-ff-rec"></i><span>CAM 01</span><span class="plg-ff-modes">' +
        '<span class="plg-fade"' + at(0, 0, ' data-off="1"') + '>SCANNING</span><span class="plg-fade"' + at(1, 0) + '>TRACKING</span></span></div>' +
      '<div class="plg-ff-panel"><div class="plg-ff-plbl">SESSIONS TRACKED</div>' +
        '<div class="plg-ff-num"><div class="plg-ff-strip">' + (function () { var s = ''; for (var n = 0; n <= 16; n++) s += '<div>' + n + '</div>'; return s; })() + '</div></div>' +
        '<div class="plg-ff-sub"><span class="plg-fade"' + at(0, 0, ' data-off="4"') + '>lock: corners, label, crosshair</span>' +
          '<span class="plg-fade"' + at(4, 300) + '>4 machines, 4 vendors</span></div></div>' +
      '<div class="plg-ff-legend plg-fade"' + at(4, 900) + '>' +
        [['cc', 'Claude Code'], ['cx', 'Codex'], ['km', 'Kimi'], ['ag', 'Antigravity']].map(function (v) {
          return '<span class="plg-ff-key" style="--v:' + FF_V[v[0]].c + '"><i></i>' + v[1] + '</span>';
        }).join('') + '</div>';
    return w + hud;
  }

  function ffSnap(i, inner) {
    var n = ffCount(i);
    inner.querySelector('.plg-ff-strip').style.transform = 'translateY(' + (-n * 88) + 'px)';
  }

  function ffForward(i, tools, inner) {
    if (i === 0) return;
    var world = inner.querySelector('.plg-ff-world');
    var strip = inner.querySelector('.plg-ff-strip');
    if (i === 4) {
      FF_BOX.forEach(function (b, k) {
        var q = ffCenter(b);
        tools.travel('M' + f2(q[0]) + ' ' + f2(q[1]) + ' L' + FF_MAIL[0] + ' ' + FF_MAIL[1], {
          cls: 'plg-ff-dot', style: '--v:' + FF_V[b[4]].c, parent: world, delay: 260 + k * 45, dur: 760
        });
      });
      tools.burst(FF_MAIL[0], FF_MAIL[1], { parent: world, delay: 900, scale: 5, dur: 1400 });
      return;
    }
    /* the reticle hops from target to target and each box locks as it lands */
    var prev = null, locks = [];
    FF_BOX.forEach(function (b, k) {
      if (k > 0 && FF_BOX[k - 1][6] < i && b[6] === i) prev = ffCenter(FF_BOX[k - 1]);
      if (b[6] !== i) return;
      var from = prev || FF_START, to = ffCenter(b), dl = ffDelay(k);
      var ret = document.createElement('div');
      ret.className = 'plg-ff-ret';
      tools.travel('M' + f2(from[0]) + ' ' + f2(from[1]) + ' L' + f2(to[0]) + ' ' + f2(to[1]), {
        el: ret, parent: world, delay: dl, dur: 280, fade: false, easing: 'cubic-bezier(.5,0,.2,1)'
      });
      tools.anim(world.querySelectorAll('.plg-trk')[k].querySelector('.plg-trk-fill'),
        [{ opacity: 0.08 }, { opacity: 0.5, offset: 0.25 }, { opacity: 0.08 }],
        { duration: 600, delay: dl + 260, easing: 'ease-out' });
      locks.push(dl + 270);
      prev = to;
    });
    var from = ffCount(i - 1), total = locks[locks.length - 1] + 200;
    var kf = [{ transform: 'translateY(' + (-from * 88) + 'px)', offset: 0 }];
    locks.forEach(function (t, j) {
      kf.push({ transform: 'translateY(' + (-(from + j) * 88) + 'px)', offset: t / total });
      kf.push({ transform: 'translateY(' + (-(from + j + 1) * 88) + 'px)', offset: Math.min(1, (t + 150) / total) });
    });
    kf.push({ transform: 'translateY(' + (-(from + locks.length) * 88) + 'px)', offset: 1 });
    tools.anim(strip, kf, { duration: total, easing: 'linear', fill: 'backwards' });
  }

  var fftrack = makeScene({
    name: 'fftrack',
    label: 'A computer vision tracking overlay in the ff-tracking style: boxes lock onto 16 agent sessions on one desk of screens.',
    credit: 'technique: ff-tracking by Mustafa Sarac, github.com/mrsarac/ff-tracking (MIT)',
    captions: [
      'A tracker sweeps one desk, looking for live agent sessions.',
      'Boxes snap onto each terminal pane: vendor, confidence, a crosshair on the target.',
      'The tracker keeps hopping. Every pane is its own agent session.',
      'The laptop, the tablet, and the phone carry sessions too.',
      'About 16 agent sessions, four machines, one shared mailbox.'
    ],
    html: fftrackHtml,
    snap: ffSnap,
    forward: ffForward
  });

  /* =========================================================== 4. REMOCN */
  var RM_WORDS = {
    l1: ['You', 'have', 'context.'],
    l2a: ['Do', 'you', 'have']
  };
  function remocnHtml() {
    function words(list, key) {
      return list.map(function (t, k) { return '<span class="plg-w" data-w="' + key + k + '">' + t + '</span>'; }).join('');
    }
    return '<div class="plg-rm-line plg-rm-l1" style="top:302px">' + words(RM_WORDS.l1, 'l1') + '</div>' +
      '<div class="plg-rm-line plg-rm-l2a" style="top:200px">' + words(RM_WORDS.l2a, 'l2a') + '</div>' +
      '<div class="plg-rm-line plg-rm-l2b" style="top:400px"><span class="plg-rm-wrap">' +
        '<span class="plg-w plg-rm-shared" data-w="sh"><span class="plg-rm-hl"></span><span class="plg-rm-sha">SHARED</span><span class="plg-rm-shb" aria-hidden="true">SHARED</span></span>' +
        '<span class="plg-w" data-w="cx">context<span class="plg-rm-q"><span class="q1">?</span><span class="q2">.</span></span></span>' +
        '<span class="plg-rm-ul"></span></span></div>';
  }
  var RM_STATES = ['w-pre', 'w-zin', 'w-zout', 'w-dim', 'w-fout'];
  function rmSet(el, cls, delay) {
    RM_STATES.forEach(function (s) { el.classList.remove(s); });
    if (cls) el.classList.add(cls);
    el.style.transitionDelay = (delay || 0) + 'ms';
  }
  function rmSnap(i, inner, fwd, intro) {
    var q = function (k) { return inner.querySelector('[data-w="' + k + '"]'); };
    var d = function (ms) { return fwd ? ms : 0; };
    /* line 1 */
    for (var k = 0; k < 3; k++) rmSet(q('l1' + k), i === 0 ? '' : 'w-zout', d(intro ? 150 + k * 150 : k * 45));
    /* line 2 */
    var l2 = ['l2a0', 'l2a1', 'l2a2', 'sh', 'cx'];
    l2.forEach(function (key, k) {
      var cls = '', dl = 0;
      if (i === 0) cls = 'w-zin';
      if (i === 1) { cls = ''; dl = 380 + k * 110; }
      if (i === 2) { cls = (key === 'sh') ? '' : 'w-dim'; dl = 0; }
      if (i === 3) {
        if (key.indexOf('l2a') === 0) { cls = 'w-fout'; dl = k * 70; }
        else { cls = ''; dl = 200; }
      }
      rmSet(q(key), cls, d(dl));
    });
    var sh = q('sh');
    sh.classList.toggle('plg-rm-on', i >= 2);
    sh.querySelector('.plg-rm-hl').style.transitionDelay = d(150) + 'ms';
    sh.querySelector('.plg-rm-shb').style.transitionDelay = d(150) + 'ms';
    var l2b = inner.querySelector('.plg-rm-l2b');
    l2b.classList.toggle('is-center', i >= 3);
    l2b.style.transitionDelay = d(250) + 'ms';
    l2b.querySelector('.plg-rm-ul').style.transitionDelay = d(900) + 'ms';
    var qm = q('cx').querySelector('.plg-rm-q');
    qm.classList.toggle('plg-rm-dot', i >= 3);
    Array.prototype.forEach.call(qm.children, function (c) { c.style.transitionDelay = d(800) + 'ms'; });
  }
  var remocn = makeScene({
    name: 'remocn',
    label: 'Kinetic typography in the remocn style: You have context. Do you have shared context?',
    credit: 'technique: remocn by Remocn, github.com/Remocn/remocn (MIT)',
    captions: [
      'A focus-pull: each word pulls into focus, a beat after the last.',
      'Zoom-blur: the old line rushes past the camera and the question lands.',
      'A highlight sweep picks out the one word that matters.',
      'Shared context: one thread that every agent can read.'
    ],
    html: remocnHtml,
    preIntro: function (inner) {
      for (var k = 0; k < 3; k++) rmSet(inner.querySelector('[data-w="l1' + k + '"]'), 'w-pre', 0);
    },
    snap: rmSnap
  });

  /* ======================================================= 5. EXPLAINROO */
  var INK = '#1e293b', C_ASK = '#0e7490', C_JOEY = '#7c3aed', C_MESH = '#047857', C_OWE = '#d97706', C_OK = '#059669';

  function robot(cx, cy) {
    return [
      'M' + (cx - 58) + ' ' + (cy - 70) + ' H' + (cx + 58) + ' Q' + (cx + 80) + ' ' + (cy - 70) + ' ' + (cx + 80) + ' ' + (cy - 48) +
        ' V' + (cy + 28) + ' Q' + (cx + 80) + ' ' + (cy + 50) + ' ' + (cx + 58) + ' ' + (cy + 50) + ' H' + (cx - 58) +
        ' Q' + (cx - 80) + ' ' + (cy + 50) + ' ' + (cx - 80) + ' ' + (cy + 28) + ' V' + (cy - 48) + ' Q' + (cx - 80) + ' ' + (cy - 70) + ' ' + (cx - 58) + ' ' + (cy - 70) + ' Z',
      'M' + (cx - 43) + ' ' + (cy - 18) + ' a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
      'M' + (cx + 21) + ' ' + (cy - 18) + ' a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
      'M' + (cx - 30) + ' ' + (cy + 14) + ' Q' + cx + ' ' + (cy + 34) + ' ' + (cx + 30) + ' ' + (cy + 14),
      'M' + cx + ' ' + (cy - 70) + ' V' + (cy - 98) + ' M' + (cx - 8) + ' ' + (cy - 106) + ' a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
      'M' + (cx - 96) + ' ' + (cy + 122) + ' Q' + (cx - 90) + ' ' + (cy + 64) + ' ' + (cx - 40) + ' ' + (cy + 62) + ' H' + (cx + 40) +
        ' Q' + (cx + 90) + ' ' + (cy + 64) + ' ' + (cx + 96) + ' ' + (cy + 122)
    ];
  }
  var EX_CLOUD = 'M792 372 Q758 372 758 342 Q758 306 798 304 Q802 262 848 260 Q878 236 914 254 Q950 232 982 264 Q1036 266 1036 312 ' +
    'Q1062 332 1044 358 Q1034 374 1006 372 Z';
  var EX_MESHNET = 'M852 330 L905 302 L962 332 M852 330 L962 332';
  var EX_MESHDOTS = 'M845 330 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M898 302 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M955 332 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0';
  var EX_ASK1 = 'M425 300 Q600 240 765 305', EX_ASK2 = 'M1040 305 Q1210 240 1375 300';
  var EX_ASK_HEADS = 'M740 308 L765 305 L749 286 M1350 304 L1375 300 L1358 281';
  var EX_ANS1 = 'M1375 400 Q1210 470 1040 395', EX_ANS2 = 'M765 395 Q600 470 425 400';
  var EX_ANS_HEADS = 'M1065 393 L1040 395 L1055 415 M450 397 L425 400 L441 419';
  var EX_ASK_PATH = 'M425 300 Q600 240 765 305 L1040 305 Q1210 240 1375 300';
  var EX_ANS_PATH = 'M1375 400 Q1210 470 1040 395 L765 395 Q600 470 425 400';
  var EX_CLOCK = [300, 640];

  function exStrokes(list) {
    /* list: [d, color, on, delay, width, dur, off] rendered twice for a sketchy double line */
    function one(cls, wmul) {
      return list.map(function (s) {
        return '<path class="plg-draw ' + cls + '" pathLength="1" d="' + s[0] + '" style="stroke:' + s[1] + ';stroke-width:' + f2((s[4] || 4.5) * wmul) +
          ';--dur:' + (s[5] || 800) + 'ms"' + at(s[2], s[3] + (wmul < 1 ? 70 : 0), s[6] != null ? ' data-off="' + s[6] + '"' : '') + '/>';
      }).join('');
    }
    return one('plg-ex-s', 1) + '<g transform="translate(1.8 1.4)">' + one('plg-ex-s2', 0.5) + '</g>';
  }

  function explainrooHtml(u) {
    var rough = '<filter id="' + u + '-rough" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>';
    var list = [];
    list.push(['M140 160 Q420 172 780 154', C_OWE, 0, 700, 5, 700]);
    robot(330, 330).forEach(function (d, k) { list.push([d, C_ASK, 0, 150 + k * 110, 4.5, 650]); });
    list.push([EX_CLOUD, C_MESH, 0, 450, 4.5, 900]);
    list.push([EX_MESHNET, C_MESH, 0, 900, 3.5, 500]);
    list.push([EX_MESHDOTS, C_MESH, 0, 1000, 3.5, 500]);
    robot(1470, 330).forEach(function (d, k) { list.push([d, C_JOEY, 0, 650 + k * 110, 4.5, 650]); });
    /* step 1: the ask */
    list.push([EX_ASK1, C_ASK, 1, 0, 5, 600]);
    list.push([EX_ASK2, C_ASK, 1, 650, 5, 600]);
    list.push([EX_ASK_HEADS, C_ASK, 1, 1150, 5, 300]);
    /* step 2: mesh writes it down */
    list.push(['M900 432 L900 512', C_MESH, 2, 0, 4, 400]);
    /* step 3: the clock */
    var cx = EX_CLOCK[0], cy = EX_CLOCK[1];
    list.push(['M' + (cx - 64) + ' ' + cy + ' a64 64 0 1 0 128 0 a64 64 0 1 0 -128 0', INK, 3, 0, 4.5, 700]);
    var ticks = '';
    for (var t = 0; t < 12; t++) {
      var a = t * Math.PI / 6, r1 = t % 3 ? 54 : 48;
      ticks += 'M' + f2(cx + Math.sin(a) * r1) + ' ' + f2(cy - Math.cos(a) * r1) + ' L' + f2(cx + Math.sin(a) * 60) + ' ' + f2(cy - Math.cos(a) * 60) + ' ';
    }
    list.push([ticks.trim(), INK, 3, 400, 3, 400]);
    /* step 4: the answer */
    list.push([EX_ANS_HEADS, C_OK, 4, 1150, 5, 300]);
    var strokes = exStrokes(list);

    var dashed = '';
    [[EX_ANS1, 0], [EX_ANS2, 650]].forEach(function (a, k) {
      var id = u + '-ans' + k;
      dashed += '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="1800" height="880">' +
        '<path class="plg-draw" pathLength="1" d="' + a[0] + '" fill="none" stroke="#fff" stroke-width="16" style="--dur:600ms"' + at(4, a[1]) + '/></mask>' +
        '<path class="plg-ex-s" mask="url(#' + id + ')" d="' + a[0] + '" style="stroke:' + C_OK + ';stroke-width:5;stroke-dasharray:14 12"/>';
    });

    var hands =
      '<g' + at(3, 500, ' class="plg-fade"') + '>' +
        '<g class="plg-ex-clock-h" style="transform-origin:' + cx + 'px ' + cy + 'px" data-at="3" data-cls="plg-ex-m" data-cd="550">' +
          '<path d="M' + cx + ' ' + cy + ' L' + cx + ' ' + (cy - 46) + '" style="stroke:' + INK + ';stroke-width:4.5;stroke-linecap:round"/></g>' +
        '<g class="plg-ex-clock-h" style="transform-origin:' + cx + 'px ' + cy + 'px" data-at="3" data-cls="plg-ex-h" data-cd="550">' +
          '<path d="M' + cx + ' ' + cy + ' L' + cx + ' ' + (cy - 30) + '" style="stroke:' + C_OWE + ';stroke-width:6;stroke-linecap:round"/></g>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="' + INK + '"/>' +
      '</g>';

    var svg = '<svg class="plg-svg" viewBox="0 0 1800 880" aria-hidden="true"><defs>' + rough + '</defs>' +
      '<g style="filter:url(#' + u + '-rough)">' + strokes + dashed + '</g>' + hands + '</svg>';

    function txt(x, y, size, color, s, on, d, extra, cls, dur) {
      return '<div class="plg-ex-txt plg-ex-hand ' + (cls || 'plg-ex-write') + '" style="left:' + x + 'px;top:' + y + 'px;font-size:' + size + 'px;color:' + color +
        (dur ? ';--dur:' + dur + 'ms' : '') + '"' +
        at(on, d, extra) + '>' + s + '</div>';
    }
    function centered(x, y, size, color, s, on, d, extra) {
      return '<div class="plg-ex-txt plg-ex-hand plg-ex-write" style="left:' + (x - 300) + 'px;width:600px;text-align:center;top:' + y + 'px;font-size:' + size + 'px;color:' + color + '"' +
        at(on, d, extra) + '>' + s + '</div>';
    }

    var noteSvg = '<svg viewBox="0 0 520 226" width="520" height="226" style="position:absolute;left:0;top:0;overflow:visible" aria-hidden="true">' +
      '<g style="filter:url(#' + u + '-rough)">' +
        '<path class="plg-draw plg-ex-s" pathLength="1" d="M14 132 C16 86, 500 84, 504 128 C508 174, 26 178, 10 138" style="stroke:' + C_OWE + ';stroke-width:5;--dur:700ms"' + at(2, 1200, ' data-off="4" data-od="1350"') + '/>' +
        '<path class="plg-draw plg-ex-s" pathLength="1" d="M26 134 Q240 124 486 130" style="stroke:' + INK + ';stroke-width:4.5;--dur:500ms"' + at(4, 1400) + '/>' +
      '</g></svg>';
    var note = '<div class="plg-ex-note plg-fade"' + at(0, 1100) + '><div class="plg-ex-notein"><div class="plg-ex-tape"></div>' +
      txt(30, 18, 36, INK, 'owed list', 0, 1300, '', 'plg-fade') +
      '<div style="position:absolute;left:30px;top:68px;width:170px;height:3px;background:' + INK + ';opacity:.55;border-radius:2px"></div>' +
      txt(34, 108, 30, '#64748b', '(nothing owed)', 0, 1400, ' data-off="2"', 'plg-fade') +
      txt(34, 106, 31, INK, 'joey owes neo: review #248', 2, 500, '', '') +
      noteSvg + '</div></div>';

    var envelope = '';
    var texts =
      txt(140, 82, 58, INK, 'What is an owed ask?', 0, 0, '', '', 900) +
      centered(330, 462, 46, INK, 'neo', 0, 900) +
      centered(330, 518, 28, C_ASK, 'the agent who asks', 0, 1100) +
      centered(1470, 462, 46, INK, 'joey', 0, 1400) +
      centered(1470, 518, 28, C_JOEY, 'the agent who is asked', 0, 1600) +
      centered(900, 382, 36, C_MESH, 'the mesh', 0, 1150) +
      txt(470, 190, 34, C_ASK, 'ask: review #248?', 1, 300) +
      '<div class="plg-ex-txt plg-pop" style="left:1150px;top:194px"' + at(1, 1200) + '><span class="plg-chip c-amber" style="font-size:22px;color:#92400e;' +
        'background:#fef3c7;border-color:#d97706">needs an answer</span></div>' +
      txt(392, 602, 34, INK, '2 hours later', 3, 900) +
      '<div class="plg-ex-txt" style="left:1190px;top:600px"' + at(3, 1500, ' data-off="4"') + '><div class="plg-ex-hand" style="font-size:36px;color:' + C_OWE +
        ';transform:rotate(-6deg)">still owed</div></div>' +
      '<div class="plg-ex-txt plg-pop" style="left:1190px;top:596px"' + at(4, 1700) + '><div class="plg-ex-hand" style="font-size:40px;color:' + C_OK +
        ';transform:rotate(-4deg)">cleared</div></div>' +
      txt(978, 448, 28, C_OK, 'answer, in-reply-to: the ask', 4, 600);

    var check = '<svg class="plg-svg" viewBox="0 0 1800 880" aria-hidden="true"><g style="filter:url(#' + u + '-rough)">' +
      '<path class="plg-draw plg-ex-s" pathLength="1" d="M1340 610 L1358 632 L1396 586" style="stroke:' + C_OK + ';stroke-width:6;--dur:400ms"' + at(4, 2000) + '/></g></svg>';

    return '<div class="plg-ex-page"></div><div class="plg-ex-rings"></div>' + svg + note + texts + check + envelope;
  }

  var EX_ENV = '<svg viewBox="0 0 54 40" width="54" height="40" aria-hidden="true"><rect x="2" y="3" width="50" height="34" rx="3" fill="#fffdf5" stroke="#1e293b" stroke-width="3"/>' +
    '<path d="M4 6l23 17 23-17" fill="none" stroke="#1e293b" stroke-width="3" stroke-linejoin="round"/></svg>';

  var explainroo = makeScene({
    name: 'explainroo',
    label: 'A hand-drawn explainer in the explainroo style: what an owed ask is, from the ask to the cleared owed list.',
    credit: 'technique: explainroo by vincentsch, github.com/vincentsch/explainroo (MIT)',
    captions: [
      'Two agents and the mesh between them. What is an owed ask?',
      'neo sends joey an ask through the mesh, marked: needs an answer.',
      'The mesh writes it on the owed list: joey owes neo an answer.',
      'Time passes. The ask stays on the list instead of scrolling away.',
      'joey answers with in-reply-to. The mesh matches it and the owed list clears.'
    ],
    html: explainrooHtml,
    forward: function (i, tools, inner) {
      if (i === 1) tools.travel(EX_ASK_PATH, { cls: 'plg-ex-env', html: EX_ENV, delay: 150, dur: 1300 });
      if (i === 4) tools.travel(EX_ANS_PATH, { cls: 'plg-ex-env', html: EX_ENV, delay: 150, dur: 1300 });
    }
  });

  window.Plugins = {
    showtime: showtime,
    seecode: seecode,
    fftrack: fftrack,
    remocn: remocn,
    explainroo: explainroo
  };
})();
