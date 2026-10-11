/*
 * distilled.js: act 6, "what we distilled", for the "Shared Context" deck.
 *
 *   window.Distilled = {
 *     frameT:     { steps, mount(containerEl), step(i) },   a video is a function of time
 *     storyboard: { steps, mount(containerEl), step(i) },   storyboard first
 *     loop:       { steps, mount(containerEl), step(i) },   render, look, fix, repeat
 *     styles:     { steps, mount(containerEl), step(i) },   one scene, any style
 *     motion:     { steps, mount(containerEl), step(i) }    from dashboard to story
 *   };
 *
 * Vanilla JS, inline SVG, <canvas> and one injected <style>. No libraries, no network.
 * Each scene is laid out on a fixed 1800x880 canvas scaled to fit its container.
 * Visual state is declarative (same convention as scenes.js): data-on="k" shows an
 * element from step k, data-off="m" hides it again from step m, data-d / data-od are
 * forward delays in ms; data-at / data-cls / data-cd toggle a class from a step.
 * Moving forward by one step animates, any other move snaps. step(0) on a freshly
 * activated slide plays the scene's entrance. Every requestAnimationFrame loop and
 * every CSS or SMIL loop runs only while the scene is on the active slide and on
 * screen. prefers-reduced-motion jumps to each end state and runs no loops.
 */
(function () {
  'use strict';

  var W = 1800, H = 880;
  var EASE = 'cubic-bezier(.65,0,.35,1)';
  var OUT = 'cubic-bezier(.16,1,.3,1)';
  var POP = 'cubic-bezier(.34,1.4,.64,1)';
  var STYLE_ID = 'distilled-js-style';
  var MONO = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  var SANS = 'Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
  var HAND = '"Segoe Print","Ink Free","Bradley Hand","Chalkboard SE","Comic Sans MS",cursive';
  var SERIF = 'Georgia,"Times New Roman",serif';
  var NS = 'http://www.w3.org/2000/svg';

  var CREDIT_A = 'Distilled from "Claude Now Does Video (FOR FREE) Thanks To JavaScript", Chase AI, YouTube';
  var CREDIT_B = 'Distilled from "Introducing Claude Dashboards and Claude Motion", Claude (Anthropic), YouTube';

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function at(on, d, extra) {
    return ' data-on="' + on + '"' + (d ? ' data-d="' + d + '"' : '') + (extra || '');
  }

  /* ------------------------------------------------------------------ CSS */
  var CSS_TEXT = [
    '.dst-root{position:relative;width:100%;height:100%;overflow:hidden;color:#f1f5f9;line-height:1.2;letter-spacing:normal;',
    'text-transform:none;text-align:left;font-style:normal;font-family:' + SANS + ';-webkit-font-smoothing:antialiased;}',
    '.dst-inner{position:absolute;left:0;top:0;width:1800px;height:880px;transform-origin:0 0;}',
    '.dst-inner *{box-sizing:border-box;}',
    '.dst-mono{font-family:' + MONO + ';}',
    '.dst-abs{position:absolute;}',
    '.dst-svg{position:absolute;left:0;top:0;width:1800px;height:880px;overflow:visible;pointer-events:none;}',
    '.dst-credit{position:absolute;right:40px;top:6px;font-size:19px;font-weight:500;color:#7d8bab;white-space:nowrap;z-index:60;letter-spacing:.005em;}',
    '.dst-credit b{color:#a8b5d1;font-weight:600;}',

    /* caption */
    '.dst-caption{position:absolute;left:70px;right:70px;top:772px;height:100px;display:flex;align-items:center;justify-content:center;',
    'text-align:center;font-size:40px;font-weight:500;line-height:1.25;color:#f1f5f9;z-index:50;}',
    '.dst-caption:before{content:"";position:absolute;left:18%;right:18%;top:-6px;height:2px;',
    'background:linear-gradient(90deg,rgba(6,182,212,0),rgba(6,182,212,.55),rgba(168,85,247,.55),rgba(168,85,247,0));}',
    '.dst-cap-text{display:inline-block;transition:opacity .45s ' + EASE + ',transform .45s ' + EASE + ';}',
    '.dst-cap-text.dst-enter{opacity:0;transform:translateY(12px);transition:none;}',

    /* declarative visibility */
    '.dst-root [data-on]{opacity:0;transform:translateY(16px);transition:opacity .5s ' + EASE + ',transform .6s ' + EASE + ';}',
    '.dst-root [data-on].is-on{opacity:1;transform:none;}',
    '.dst-root svg [data-on]{transform-box:fill-box;transform-origin:center;}',
    '.dst-root .dst-pop[data-on]{transform:scale(.4);transition:opacity .3s ease-out,transform .6s ' + POP + ';}',
    '.dst-root .dst-pop[data-on].is-on{transform:none;}',
    '.dst-root .dst-fade[data-on],.dst-root .dst-fade[data-on].is-on{transform:none;}',
    '.dst-root .dst-drop[data-on]{transform:translateY(-46px);transition:opacity .45s ease-out,transform .8s ' + POP + ';}',
    '.dst-root .dst-drop[data-on].is-on{transform:none;}',
    '.dst-root .dst-draw[data-on]{transform:none;opacity:0;stroke-dasharray:1 1;stroke-dashoffset:1;',
    'transition:stroke-dashoffset .8s ' + EASE + ',opacity .15s linear;}',
    '.dst-root .dst-draw[data-on].is-on{opacity:1;stroke-dashoffset:0;}',
    '.dst-root .dst-grow[data-on]{opacity:1;transform:scaleX(0);transform-origin:0 50%;transition:transform 1s ' + OUT + ';}',
    '.dst-root .dst-grow[data-on].is-on{transform:scaleX(1);}',
    '.dst-snap,.dst-snap *{transition:none!important;}',
    '.dst-paused,.dst-paused *{animation-play-state:paused!important;}',
    '@keyframes dst-spin{to{transform:rotate(360deg);}}',

    /* ---------------- frameT */
    '.dst-code{position:absolute;border-radius:20px;background:linear-gradient(180deg,#121a33 0%,#0d1428 100%);border:2px solid #263457;',
    'box-shadow:0 30px 60px -30px rgba(0,0,0,.9);overflow:hidden;}',
    '.dst-code-bar{height:54px;display:flex;align-items:center;gap:10px;padding:0 22px;border-bottom:1px solid #222f52;background:rgba(255,255,255,.02);}',
    '.dst-code-bar i{width:14px;height:14px;border-radius:50%;background:#334166;display:block;}',
    '.dst-code-bar i:nth-child(1){background:#f87171;}.dst-code-bar i:nth-child(2){background:#fbbf24;}.dst-code-bar i:nth-child(3){background:#34d399;}',
    '.dst-code-bar span{margin-left:14px;font-size:22px;color:#94a3b8;}',
    '.dst-code-bar em{margin-left:auto;font-style:normal;font-size:20px;color:#67e8f9;letter-spacing:.06em;}',
    '.dst-code-body{position:relative;padding:16px 0 0 0;font-size:25px;line-height:38px;white-space:pre;}',
    '.dst-ln{position:relative;height:38px;display:flex;z-index:2;}',
    '.dst-lnno{width:62px;text-align:right;padding-right:20px;color:#3e4c72;flex:none;font-size:21px;}',
    '.dst-lntx{color:#cbd5e1;}',
    '.dst-hl{position:absolute;left:0;right:0;border-left:5px solid #22d3ee;background:linear-gradient(90deg,rgba(6,182,212,.22),rgba(6,182,212,.04));',
    'opacity:0;transition:opacity .25s linear;z-index:1;}',
    '.dst-hl.dst-hl-b{border-left-color:#34d399;background:linear-gradient(90deg,rgba(16,185,129,.24),rgba(16,185,129,.04));}',
    '.dst-hl.on{opacity:1;}',
    '.dst-tk-k{color:#c084fc;}.dst-tk-f{color:#67e8f9;}.dst-tk-s{color:#6ee7b7;}.dst-tk-n{color:#fcd34d;}.dst-tk-t{color:#fda4af;font-weight:700;}',
    '.dst-canvas-box{position:absolute;border-radius:18px;overflow:hidden;border:2px solid #263457;box-shadow:0 30px 60px -30px rgba(0,0,0,.9),0 0 0 1px rgba(6,182,212,.08);background:#070b18;}',
    '.dst-canvas-box canvas{display:block;width:100%;height:100%;}',
    '.dst-canvas-tag{position:absolute;left:18px;top:14px;font-size:20px;color:#94a3b8;background:rgba(7,11,24,.7);border:1px solid #2a3760;',
    'padding:5px 12px;border-radius:10px;}',
    '.dst-tread{position:absolute;font-size:56px;font-weight:700;color:#e2e8f0;white-space:nowrap;letter-spacing:-.01em;}',
    '.dst-tread b{color:#22d3ee;font-weight:800;}',
    '.dst-scrub{position:absolute;height:10px;border-radius:5px;background:#1c2747;}',
    '.dst-scrub-fill{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:5px;background:linear-gradient(90deg,#06b6d4,#a855f7);',
    'transform-origin:0 50%;transform:scaleX(0);}',
    '.dst-scrub-knob{position:absolute;left:-13px;top:-8px;width:26px;height:26px;border-radius:50%;background:#e0f7fe;',
    'box-shadow:0 0 0 5px rgba(6,182,212,.35),0 0 22px rgba(6,182,212,.8);}',
    '.dst-scrub-tick{position:absolute;top:-11px;font-size:28px;color:#94a3b8;white-space:nowrap;}',
    '.dst-film{position:absolute;}',
    '.dst-film-lbl{position:absolute;top:0;width:210px;text-align:center;font-size:28px;font-weight:600;color:#cbd5e1;white-space:nowrap;}',
    '.dst-film-band{position:absolute;left:0;right:0;top:38px;height:106px;border-radius:12px;background:#04060c;overflow:hidden;',
    'box-shadow:0 20px 40px -20px rgba(0,0,0,.9),inset 0 0 0 1px #1d2745;}',
    '.dst-film-band:before,.dst-film-band:after{content:"";position:absolute;left:8px;right:8px;height:8px;',
    'background:repeating-linear-gradient(90deg,#26314f 0 14px,transparent 14px 30px);border-radius:2px;}',
    '.dst-film-band:before{top:4px;}.dst-film-band:after{bottom:4px;}',
    '.dst-film-row{position:absolute;left:0;top:0;width:100%;height:100%;}',
    '.dst-film-cell{position:absolute;top:11px;width:150px;height:84px;}',
    '.dst-film-cell canvas{display:block;width:150px;height:84px;border-radius:6px;box-shadow:0 0 0 1px #2a3760;}',
    '.dst-film-label{position:absolute;left:44px;top:0;height:106px;display:flex;align-items:center;font-size:34px;font-weight:600;color:#e2e8f0;}',
    '.dst-film-label b{color:#22d3ee;font-weight:700;margin-left:12px;}',
    '.dst-reel{position:absolute;}',
    '.dst-reel svg{width:100%;height:100%;overflow:visible;}',
    '.dst-reel .dst-reel-spin{transform-origin:50% 50%;transform-box:fill-box;animation:dst-spin 2.4s linear infinite;}',

    /* ---------------- storyboard */
    '.dst-sb-board{position:absolute;left:24px;top:30px;width:1752px;height:700px;border-radius:26px;',
    'background:radial-gradient(ellipse at 50% 40%,rgba(30,41,74,.55),rgba(11,16,32,0) 70%);}',
    '.dst-sb-card{position:absolute;width:513px;height:300px;}',
    '.dst-sb-paper{position:absolute;inset:0;border-radius:6px;padding:12px 14px 0;transform:rotate(var(--r,0deg));',
    'background:linear-gradient(180deg,#f7f3ea,#efe8da);box-shadow:0 22px 40px -18px rgba(0,0,0,.95),0 2px 0 rgba(0,0,0,.25);}',
    '.dst-sb-paper:after{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;',
    'background:repeating-linear-gradient(0deg,rgba(120,100,70,.035) 0 2px,transparent 2px 5px);}',
    '.dst-sb-pin{position:absolute;left:50%;top:-11px;width:22px;height:22px;margin-left:-11px;border-radius:50%;z-index:3;',
    'background:radial-gradient(circle at 35% 30%,#fca5a5,#dc2626 60%,#7f1d1d);box-shadow:0 5px 8px rgba(0,0,0,.6);}',
    '.dst-sb-sketch{display:block;width:485px;height:212px;border:2px solid rgba(43,47,58,.55);border-radius:3px;background:#fbf8f1;}',
    '.dst-sb-lbl{position:absolute;left:14px;right:14px;bottom:8px;height:58px;display:flex;align-items:center;gap:14px;}',
    '.dst-sb-num{flex:none;width:46px;height:46px;border:3px solid #dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;',
    'font:700 26px/1 ' + SANS + ';color:#dc2626;transform:rotate(-6deg);}',
    '.dst-sb-num span{display:inline-block;}',
    '.dst-sb-ink{position:absolute;white-space:nowrap;}',
    '.dst-sb-title{font:700 32px/1.1 ' + HAND + ';color:#1f2430;white-space:nowrap;}',
    '.dst-sb-note{position:absolute;left:-30px;top:-14px;width:240px;padding:16px 18px 18px;z-index:6;',
    'background:linear-gradient(180deg,#ff8f8f,#f87171);color:#3b0a0a;font:700 28px/1.2 ' + HAND + ';',
    'box-shadow:0 18px 28px -12px rgba(0,0,0,.85);border-radius:2px;}',
    '.dst-root .dst-sb-note[data-on]{transform:rotate(4deg) scale(.4);transition:opacity .3s ease-out,transform .6s ' + POP + ';}',
    '.dst-root .dst-sb-note[data-on].is-on{transform:rotate(4deg);}',
    '.dst-sb-note:before{content:"";position:absolute;left:50%;top:-12px;width:90px;height:26px;margin-left:-45px;transform:rotate(-4deg);',
    'background:rgba(255,255,255,.45);box-shadow:0 1px 2px rgba(0,0,0,.2);}',
    '.dst-sb-stamp{position:absolute;left:900px;top:552px;z-index:20;white-space:nowrap;padding:20px 42px;border:9px double #ef4444;border-radius:16px;',
    'color:#ef4444;font:800 62px/1 ' + SANS + ';letter-spacing:.02em;background:rgba(11,16,32,.88);',
    'box-shadow:0 30px 70px -10px rgba(0,0,0,.9),0 0 50px rgba(239,68,68,.35);}',
    '.dst-root .dst-sb-stamp[data-on]{transform:translate(-50%,-50%) rotate(-5deg) scale(2.2);transition:opacity .25s ease-out,transform .5s cubic-bezier(.3,1.5,.5,1);}',
    '.dst-root .dst-sb-stamp[data-on].is-on{transform:translate(-50%,-50%) rotate(-5deg);}',

    /* ---------------- loop */
    '.dst-lp-frame{position:absolute;top:70px;width:820px;height:615px;transform-origin:0 0;',
    'transition:transform 1s ' + EASE + ';}',
    '.dst-lp-before{left:50px;transform:translate(-10px,-30px) scale(1.12195);}',
    '.dst-lp-after{left:930px;transform:translate(-890px,-30px) scale(1.12195);}',
    '.dst-lp-frame.small{transform:none;}',
    '.dst-lp-img{position:absolute;left:0;top:0;width:820px;height:615px;border-radius:14px;overflow:hidden;',
    'box-shadow:0 30px 70px -26px rgba(0,0,0,.95),0 0 0 2px #263457;background:#fff;}',
    '.dst-lp-img img{display:block;width:100%;height:100%;}',
    '.dst-lp-after .dst-lp-img{clip-path:inset(0 100% 0 0);transition:clip-path 1.4s ' + EASE + ';}',
    '.dst-lp-wrap.wiped .dst-lp-img{clip-path:inset(0 0 0 0);}',
    '.dst-lp-box{position:absolute;border:4px solid #ef4444;border-radius:10px;box-shadow:0 0 0 3px rgba(239,68,68,.25),0 0 18px rgba(239,68,68,.45);',
    'transition:border-color .4s,box-shadow .4s;}',
    '.dst-lp-box.fixed{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.25),0 0 18px rgba(16,185,129,.5);}',
    '.dst-lp-box i{position:absolute;right:-16px;top:-16px;width:32px;height:32px;border-radius:50%;background:#ef4444;color:#fff;',
    'font:800 19px/32px ' + SANS + ';text-align:center;font-style:normal;transition:background .4s;}',
    '.dst-lp-box.fixed i{background:#10b981;}',
    '.dst-lp-tag{position:absolute;top:630px;width:820px;text-align:center;font-size:34px;font-weight:700;}',
    '.dst-lp-head{position:absolute;left:1010px;top:58px;font-size:22px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#fca5a5;}',
    '.dst-lp-note{position:absolute;left:1010px;width:740px;display:flex;align-items:flex-start;gap:18px;}',
    '.dst-lp-note i{flex:none;width:46px;height:46px;border-radius:50%;background:#ef4444;color:#fff;font:800 24px/46px ' + SANS + ';text-align:center;font-style:normal;',
    'box-shadow:0 0 22px rgba(239,68,68,.55);}',
    '.dst-lp-note div{font-size:34px;font-weight:600;line-height:1.2;color:#f8fafc;padding-top:2px;}',
    '.dst-lp-note small{display:block;font-size:24px;font-weight:500;color:#94a3b8;margin-top:6px;}',
    '.dst-lp-wipe{position:absolute;left:40px;top:40px;width:6px;height:690px;margin-left:-3px;border-radius:3px;background:#a5f3fc;opacity:0;',
    'box-shadow:0 0 18px 4px rgba(34,211,238,.9),0 0 60px 14px rgba(6,182,212,.45);pointer-events:none;z-index:8;}',
    '.dst-lp-loop{position:absolute;left:1010px;top:60px;width:750px;height:660px;}',
    '.dst-lp-node{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:30px;font-weight:700;padding:10px 22px;border-radius:999px;',
    'background:#121b36;border:2px solid #334166;color:#e2e8f0;transition:border-color .3s,box-shadow .3s,color .3s;}',
    '.dst-lp-node.hot{border-color:#22d3ee;color:#a5f3fc;box-shadow:0 0 0 4px rgba(6,182,212,.18),0 0 30px rgba(6,182,212,.55);}',
    '.dst-lp-round{position:absolute;left:375px;top:330px;transform:translate(-50%,-50%);text-align:center;}',
    '.dst-lp-round small{display:block;font-size:28px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;}',
    '.dst-lp-round b{display:block;font-size:150px;line-height:1;font-weight:800;letter-spacing:-.04em;',
    'background:linear-gradient(180deg,#a5f3fc,#22d3ee 55%,#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent;}',
    '.dst-lp-of{position:absolute;left:375px;top:612px;transform:translateX(-50%);font-size:28px;color:#94a3b8;white-space:nowrap;}',

    /* ---------------- styles */
    '.dst-sty-layer{position:absolute;left:50px;top:30px;width:1700px;height:730px;border-radius:28px;overflow:hidden;transform-origin:0 0;',
    'box-shadow:0 34px 70px -30px rgba(0,0,0,.95);}',
    '.dst-sty-layer svg{position:absolute;left:0;top:0;width:1700px;height:730px;}',
    '.dst-root .dst-sty-layer[data-on]{opacity:1;transform:none;transition:transform 1s ' + EASE + ',clip-path 1.2s ' + EASE + ',opacity .4s linear;}',
    '.dst-root .dst-sty-l0[data-on]{opacity:0;transform:scale(.94);}',
    '.dst-root .dst-sty-l0[data-on].is-on{opacity:1;transform:none;}',
    '.dst-root .dst-sty-l1[data-on]{clip-path:inset(0 100% 0 0 round 28px);}',
    '.dst-root .dst-sty-l1[data-on].is-on{clip-path:inset(0 0 0 0 round 28px);}',
    '.dst-root .dst-sty-l2[data-on]{opacity:0;transform-origin:0 50%;transform:perspective(2600px) rotateY(-84deg);transition:transform 1.2s ' + OUT + ',opacity .35s linear;}',
    '.dst-root .dst-sty-l2[data-on].is-on{opacity:1;transform:perspective(2600px) rotateY(0deg);}',
    '.dst-root .dst-sty-l3[data-on]{clip-path:circle(0% at 50% 52%);transform:scale(1.06);}',
    '.dst-root .dst-sty-l3[data-on].is-on{clip-path:circle(80% at 50% 52%);transform:none;}',
    '.dst-root .dst-sty-layer[data-on].is-on.grid{border-radius:40px;}',
    '.dst-root .dst-sty-l0[data-on].is-on.grid{transform:translate(10px,0) scale(.48824);}',
    '.dst-root .dst-sty-l1[data-on].is-on.grid{transform:translate(860px,0) scale(.48824);}',
    '.dst-root .dst-sty-l2[data-on].is-on.grid{transform:translate(10px,368px) scale(.48824);transform-origin:0 0;}',
    '.dst-root .dst-sty-l3[data-on].is-on.grid{transform:translate(860px,368px) scale(.48824);clip-path:circle(80% at 50% 52%);}',
    '.dst-sty-paper{position:absolute;inset:0;background:',
    'radial-gradient(ellipse at 22% 18%,rgba(255,255,255,.75),rgba(255,255,255,0) 55%),',
    'radial-gradient(ellipse at 80% 90%,rgba(150,130,100,.18),rgba(150,130,100,0) 60%),',
    'repeating-linear-gradient(0deg,rgba(80,70,50,.03) 0 1px,transparent 1px 4px),',
    'repeating-linear-gradient(90deg,rgba(80,70,50,.025) 0 1px,transparent 1px 5px),#efe9dc;}',
    '.dst-sty-lbl{position:absolute;white-space:nowrap;pointer-events:none;}',
    '.dst-cp-tag{position:absolute;display:flex;align-items:center;justify-content:center;background:#fffaf0;color:#264653;border-radius:6px;',
    'font:800 50px/1 ' + q(SANS) + ';box-shadow:5px 9px 10px -2px rgba(74,52,32,.35);white-space:nowrap;}',
    '.dst-sty-nib{position:absolute;left:50px;top:30px;width:8px;height:730px;margin-left:-4px;border-radius:4px;background:#1f2430;opacity:0;',
    'box-shadow:0 0 24px 6px rgba(245,240,228,.6);z-index:9;pointer-events:none;}',

    /* ---------------- motion */
    '.dst-mo-head{position:absolute;left:60px;top:46px;font-size:40px;font-weight:800;letter-spacing:-.01em;}',
    '.dst-mo-head small{font-size:26px;font-weight:600;color:#94a3b8;margin-left:16px;letter-spacing:0;}',
    '.dst-mo-illus{position:absolute;right:60px;top:52px;z-index:45;font-size:22px;font-weight:600;color:#cbd5e1;padding:8px 18px;',
    'border:1.5px dashed #64748b;border-radius:999px;background:rgba(11,16,32,.75);letter-spacing:.02em;}',
    '.dst-mo-tile{position:absolute;top:122px;width:402px;height:214px;padding:22px 28px;border-radius:22px;',
    'background:linear-gradient(180deg,#16213f 0%,#0f172e 100%);border:2px solid #28355c;box-shadow:0 22px 44px -22px rgba(0,0,0,.8);}',
    '.dst-mo-tile b{display:block;font-size:76px;line-height:1;font-weight:800;letter-spacing:-.03em;}',
    '.dst-mo-tile>span{display:block;margin-top:12px;font-size:28px;line-height:1.15;color:#cbd5e1;}',
    '.dst-mo-pre{font-size:40px;font-weight:700;margin-right:12px;letter-spacing:0;}',
    '.dst-root .dst-mo-tile[data-off]{transition:opacity .5s ' + EASE + ',transform .7s ' + EASE + ';}',
    '.dst-root .dst-mo-out[data-on]{transform:translateY(24px);}',
    '.dst-mo-chart{position:absolute;left:60px;top:362px;width:1680px;height:390px;border-radius:22px;padding:26px 32px;',
    'background:linear-gradient(180deg,#121b36 0%,#0d1428 100%);border:2px solid #24325a;}',
    '.dst-mo-chart h4{margin:0;font-size:30px;font-weight:700;color:#e2e8f0;}',
    '.dst-mo-chart h4 small{font-size:24px;color:#94a3b8;font-weight:500;margin-left:12px;}',
    '.dst-mo-row{position:absolute;left:32px;right:32px;height:96px;display:flex;align-items:center;}',
    '.dst-mo-row label{flex:none;width:250px;font-size:30px;font-weight:600;color:#cbd5e1;}',
    '.dst-mo-bar{position:relative;height:72px;border-radius:14px;}',
    '.dst-mo-bar em{position:absolute;right:-22px;top:50%;transform:translate(100%,-50%);font-style:normal;font-size:54px;font-weight:800;letter-spacing:-.02em;}',
    '.dst-mo-hero{position:absolute;left:40px;top:40px;width:1720px;height:720px;border-radius:28px;overflow:hidden;transform-origin:0 0;',
    'background:radial-gradient(ellipse at 18% 30%,rgba(34,211,238,.38),rgba(34,211,238,0) 55%),',
    'radial-gradient(ellipse at 88% 80%,rgba(168,85,247,.45),rgba(168,85,247,0) 55%),linear-gradient(135deg,#0b3446 0%,#151a45 55%,#2a1350 100%);',
    'box-shadow:0 40px 90px -30px rgba(0,0,0,.95),inset 0 0 0 2px rgba(103,232,249,.18);}',
    '.dst-root .dst-mo-hero[data-on]{opacity:0;transform:translate(304px,568px) scale(.6395,.1);',
    'transition:opacity .2s linear,transform 1s ' + EASE + ',border-radius 1s ' + EASE + ';border-radius:80px;}',
    '.dst-root .dst-mo-hero[data-on].is-on{opacity:1;transform:none;border-radius:28px;}',
    '.dst-mo-big{position:absolute;left:96px;top:96px;font-size:330px;line-height:.86;font-weight:900;letter-spacing:-.06em;color:#f0fdff;',
    'text-shadow:0 0 60px rgba(34,211,238,.45);font-variant-numeric:tabular-nums;}',
    '.dst-mo-bigline{position:absolute;left:104px;top:404px;font-size:58px;font-weight:700;color:#e0f2fe;letter-spacing:-.01em;}',
    '.dst-mo-bigsub{position:absolute;left:106px;top:486px;font-size:30px;font-weight:600;color:#a5f3fc;letter-spacing:.04em;}',
    '.dst-mo-tl{position:absolute;left:96px;top:600px;width:1528px;height:84px;}',
    '.dst-mo-play{position:absolute;left:0;top:14px;width:56px;height:56px;border-radius:50%;background:#f0fdff;box-shadow:0 0 24px rgba(165,243,252,.5);}',
    '.dst-mo-play:after{content:"";position:absolute;left:22px;top:17px;border-left:18px solid #0b3446;border-top:11px solid transparent;border-bottom:11px solid transparent;}',
    '.dst-mo-track{position:absolute;left:84px;right:120px;top:37px;height:10px;border-radius:5px;background:rgba(255,255,255,.18);}',
    '.dst-mo-trackfill{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:5px;background:linear-gradient(90deg,#22d3ee,#c084fc);',
    'transform-origin:0 50%;transform:scaleX(.25);transition:transform 1.2s ' + EASE + ';}',
    '.dst-mo-tl.moved .dst-mo-trackfill{transform:scaleX(.5);}',
    '.dst-mo-head2{position:absolute;top:-9px;width:28px;height:28px;margin-left:-14px;border-radius:50%;background:#fff;left:25%;',
    'box-shadow:0 0 0 5px rgba(255,255,255,.25);transition:left 1.2s ' + EASE + ';}',
    '.dst-mo-tl.moved .dst-mo-head2{left:50%;}',
    '.dst-mo-time{position:absolute;right:0;top:24px;font-size:28px;font-weight:600;color:#e0f2fe;}',
    '.dst-mo-pin{position:absolute;top:-58px;width:46px;height:46px;margin-left:-23px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);',
    'display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px -6px rgba(0,0,0,.8);}',
    '.dst-mo-pin span{transform:rotate(45deg);font-size:22px;font-weight:800;}',
    '.dst-root .dst-mo-pin[data-on]{transform:rotate(-45deg) scale(.3);transition:opacity .3s,transform .55s ' + POP + ';}',
    '.dst-root .dst-mo-pin[data-on].is-on{transform:rotate(-45deg);}',
    '.dst-mo-thread{position:absolute;left:1046px;top:96px;width:640px;padding:26px 28px 14px;border-radius:22px;z-index:5;',
    'background:rgba(9,14,30,.86);border:1.5px solid rgba(165,243,252,.28);box-shadow:0 30px 60px -20px rgba(0,0,0,.9);}',
    '.dst-mo-thread h5{margin:0 0 14px;font-size:22px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;}',
    '.dst-mo-cm{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;}',
    '.dst-mo-av{flex:none;width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;}',
    '.dst-mo-cm p{margin:0;font-size:30px;line-height:1.25;color:#f1f5f9;}',
    '.dst-mo-cm p b{display:block;font-size:24px;color:#94a3b8;font-weight:700;margin-bottom:4px;}',
    '.dst-mo-export{position:absolute;left:1046px;top:440px;z-index:5;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:700;color:#04121a;',
    'padding:14px 26px 14px 18px;border-radius:999px;background:linear-gradient(90deg,#67e8f9,#c4b5fd);box-shadow:0 18px 40px -12px rgba(0,0,0,.8),0 0 40px rgba(103,232,249,.35);}',
    '.dst-mo-export svg{width:34px;height:34px;}',

    'html.calm .dst-root,html.calm .dst-root *,html.calm .dst-root *:before,html.calm .dst-root *:after{transition:none!important;animation:none!important;}'
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
    var ctx = {
      root: null, inner: null, cap: null, cur: -1, els: [], clsEls: [], timers: [], anims: [],
      loops: [], raf: 0, ro: null, io: null, mo: null, inView: true, live: false, refs: null
    };

    function fit() {
      if (!ctx.root) return;
      var cw = ctx.root.clientWidth, ch = ctx.root.clientHeight;
      if (!cw || !ch) return;
      var k = Math.min(cw / W, ch / H);
      var tx = (cw - W * k) / 2, ty = (ch - H * k) / 2;
      ctx.inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
    }

    function isLive() {
      var r = ctx.root;
      if (!r || !r.isConnected) return false;
      if (document.visibilityState === 'hidden') return false;
      if (!ctx.inView) return false;
      var slide = r.closest ? r.closest('.slide') : null;
      if (slide && !slide.classList.contains('active')) return false;
      return true;
    }

    function tick(now) {
      ctx.raf = 0;
      if (!isLive()) { refreshLive(); return; }
      var list = ctx.loops.slice();
      var keep = [];
      for (var k = 0; k < list.length; k++) {
        var L = list[k];
        if (ctx.loops.indexOf(L) < 0) continue;
        if (L(now) !== false) keep.push(L);
      }
      ctx.loops = ctx.loops.filter(function (L) { return keep.indexOf(L) >= 0 || list.indexOf(L) < 0; });
      if (ctx.loops.length) ctx.raf = requestAnimationFrame(tick);
    }

    function drive() {
      if (ctx.raf || !ctx.loops.length || !ctx.live) return;
      ctx.raf = requestAnimationFrame(tick);
    }

    function refreshLive() {
      if (!ctx.root) return;
      var live = isLive();
      if (live !== ctx.live) {
        ctx.live = live;
        ctx.root.classList.toggle('dst-paused', !live);
        ctx.anims.forEach(function (a) { try { if (live) { if (a.playState === 'paused') a.play(); } else if (a.playState === 'running') a.pause(); } catch (e) { /* ignore */ } });
        if (def.onLive) def.onLive(live, ctx.refs);
      }
      if (live) drive();
      else if (ctx.raf) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; }
    }

    function clearTransient() {
      ctx.timers.forEach(function (t) { clearTimeout(t); });
      ctx.timers = [];
      ctx.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
      ctx.anims = [];
      ctx.loops = [];
      if (ctx.raf) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; }
    }

    var fx = {
      rm: false,
      mode: 'snap',
      after: function (ms, fn) { ctx.timers.push(setTimeout(fn, ms)); },
      loop: function (fn) { ctx.loops.push(fn); drive(); },
      anim: function (el, kf, opts) {
        if (!el || !el.animate) return null;
        var a = el.animate(kf, opts);
        ctx.anims.push(a);
        if (!ctx.live) { try { a.pause(); } catch (e) { /* ignore */ } }
        return a;
      },
      /* count a number up inside an element */
      count: function (el, from, to, dur, delay, format) {
        format = format || fmt;
        if (fx.rm || fx.mode === 'snap') { el.textContent = format(to); return; }
        var t0 = null, start = null;
        if (!delay) el.textContent = format(from);
        fx.loop(function (now) {
          if (start === null) start = now + (delay || 0);
          if (now < start) return true;
          if (t0 === null) { t0 = now; el.textContent = format(from); }
          var p = clamp01((now - t0) / dur);
          el.textContent = format(from + (to - from) * easeOut(p));
          return p < 1;
        });
      }
    };

    function setCaption(i, animate) {
      var text = def.captions[i] || '';
      var span = ctx.cap;
      if (span.textContent === text && !animate) return;
      if (animate) {
        span.classList.add('dst-enter');
        span.textContent = text;
        void span.offsetWidth;
        span.classList.remove('dst-enter');
      } else {
        span.textContent = text;
      }
    }

    /* mode: 'fwd' (one step forward), 'intro' (entrance of step 0), 'snap' */
    function apply(i, mode) {
      clearTransient();
      var fwd = mode !== 'snap';
      if (mode === 'intro') {
        ctx.root.classList.add('dst-snap');
        ctx.els.forEach(function (el) { el.classList.remove('is-on'); });
        ctx.clsEls.forEach(function (el) { el.classList.remove(el.getAttribute('data-cls')); });
        void ctx.root.offsetWidth;
        ctx.root.classList.remove('dst-snap');
        void ctx.root.offsetWidth;
      }
      if (!fwd) ctx.root.classList.add('dst-snap');
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
        } else if (fwd && vis && el.hasAttribute('data-cd')) {
          el.style.transitionDelay = (+el.getAttribute('data-cd')) + 'ms';
        }
        el.classList.toggle(cls, vis);
      });
      setCaption(i, fwd);
      if (!fwd) {
        void ctx.root.offsetWidth;
        ctx.root.classList.remove('dst-snap');
      }
      var prev = ctx.cur;
      ctx.cur = i;
      ctx.root.setAttribute('data-step', String(i));
      fx.mode = mode;
      fx.rm = reducedMotion();
      if (def.enter) def.enter(i, mode, fx, ctx.refs, prev);
      refreshLive();
    }

    var api = {
      steps: def.captions.length,
      mount: function (container) {
        if (!container) return;
        injectStyle();
        if (ctx.ro) { try { ctx.ro.disconnect(); } catch (e) { /* ignore */ } }
        if (ctx.io) { try { ctx.io.disconnect(); } catch (e) { /* ignore */ } }
        clearTransient();
        var root = document.createElement('div');
        root.className = 'dst-root dst-' + def.name;
        root.setAttribute('role', 'img');
        root.setAttribute('aria-label', def.label);
        var inner = document.createElement('div');
        inner.className = 'dst-inner';
        inner.innerHTML = def.html() +
          (def.credit ? '<div class="dst-credit">' + def.credit + '</div>' : '');
        var capBox = document.createElement('div');
        capBox.className = 'dst-caption';
        capBox.setAttribute('aria-live', 'polite');
        var cap = document.createElement('span');
        cap.className = 'dst-cap-text';
        capBox.appendChild(cap);
        inner.appendChild(capBox);
        root.appendChild(inner);
        container.innerHTML = '';
        container.appendChild(root);
        ctx.root = root; ctx.inner = inner; ctx.cap = cap; ctx.live = true;
        ctx.els = Array.prototype.slice.call(inner.querySelectorAll('[data-on]'));
        ctx.clsEls = Array.prototype.slice.call(inner.querySelectorAll('[data-at]'));
        ctx.refs = def.init ? (def.init(inner) || {}) : {};
        ctx.cur = -1;
        fit();
        if (window.ResizeObserver) {
          ctx.ro = new ResizeObserver(fit);
          ctx.ro.observe(root);
        } else {
          window.addEventListener('resize', fit);
        }
        if (window.IntersectionObserver) {
          ctx.io = new IntersectionObserver(function (entries) {
            ctx.inView = entries[entries.length - 1].isIntersecting;
            refreshLive();
          });
          ctx.io.observe(root);
        }
        if (ctx.mo) { try { ctx.mo.disconnect(); } catch (e) { /* ignore */ } }
        var slide = root.closest ? root.closest('.slide') : null;
        if (slide && window.MutationObserver) {
          ctx.mo = new MutationObserver(refreshLive);
          ctx.mo.observe(slide, { attributes: true, attributeFilter: ['class'] });
        }
        if (!api._vis) {
          api._vis = true;
          document.addEventListener('visibilitychange', refreshLive);
        }
        apply(0, 'snap');
      },
      step: function (i) {
        if (!ctx.inner) return;
        i = Math.max(0, Math.min(api.steps - 1, Math.round(+i || 0)));
        fit();
        var rm = reducedMotion();
        var mode = 'snap';
        if (!rm && i === ctx.cur + 1) mode = 'fwd';
        else if (!rm && i === 0 && ctx.cur !== 1) mode = 'intro';
        apply(i, mode);
      }
    };
    return api;
  }

  /* ================================================================ 1. frameT */

  var CODE = [
    'function frame(t) {',
    '  clear(ctx);',
    "  card(ctx, 'neo', NEO);",
    "  card(ctx, 'joey', JOEY);",
    '  const p = ease(Math.min(t / 2.4, 1));',
    '  const at = arc(NEO, JOEY, p);',
    "  token(ctx, at, '#248');",
    '  if (t > 2.4) {',
    '    const r = (t - 2.4) * 140;',
    '    ripple(ctx, JOEY, r);',
    '    check(ctx, JOEY);',
    '  }',
    '}'
  ];

  function highlightLine(line) {
    var out = '';
    var re = /('[^']*')|(\b(?:function|const|if|return)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\())|(\bt\b)|([^'\w]+|\w+)/g;
    var m;
    while ((m = re.exec(line)) !== null) {
      if (m[1]) out += '<span class="dst-tk-s">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="dst-tk-k">' + m[2] + '</span>';
      else if (m[3]) out += '<span class="dst-tk-n">' + m[3] + '</span>';
      else if (m[4]) out += '<span class="dst-tk-f">' + m[4] + '</span>';
      else if (m[5]) out += '<span class="dst-tk-t">t</span>';
      else out += esc(m[6]);
    }
    return out;
  }

  /* The picture: a pure function of t, drawn into a 910x512 logical space. */
  var CW = 910, CH = 512;
  var NEO = { x: 205, y: 340, name: 'neo', sub: 'machine A', acc: '#22d3ee' };
  var JOEY = { x: 705, y: 340, name: 'joey', sub: 'machine B', acc: '#c084fc' };
  var ARC_C = { x: 455, y: -70 };
  var FLIGHT = 2.4, LOOP_T = 4;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function arcPoint(A, B, p) {
    var ax = A.x, ay = A.y - 114, bx = B.x, by = B.y - 114;
    var q = 1 - p;
    return { x: q * q * ax + 2 * q * p * ARC_C.x + p * p * bx, y: q * q * ay + 2 * q * p * ARC_C.y + p * p * by };
  }
  function drawClear(c) {
    var g = c.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, '#0c1430'); g.addColorStop(1, '#070b18');
    c.fillStyle = g; c.fillRect(0, 0, CW, CH);
    c.fillStyle = 'rgba(148,163,184,.13)';
    for (var gx = 22; gx < CW; gx += 34) for (var gy = 22; gy < CH; gy += 34) c.fillRect(gx, gy, 2, 2);
    /* faint flight path */
    c.save();
    c.setLineDash([8, 10]);
    c.strokeStyle = 'rgba(148,163,184,.28)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(NEO.x, NEO.y - 114);
    c.quadraticCurveTo(ARC_C.x, ARC_C.y, JOEY.x, JOEY.y - 114);
    c.stroke();
    c.restore();
  }
  function drawCard(c, P, lit) {
    var w = 250, h = 150, x = P.x - w / 2, y = P.y - h / 2 + 4;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 24; c.shadowOffsetY = 12;
    rr(c, x, y, w, h, 20);
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#18244a'); g.addColorStop(1, '#101833');
    c.fillStyle = g; c.fill();
    c.restore();
    c.lineWidth = 2.5;
    c.strokeStyle = lit ? P.acc : '#2c3a64';
    rr(c, x, y, w, h, 20); c.stroke();
    if (lit) {
      c.save(); c.globalAlpha = lit; c.shadowColor = P.acc; c.shadowBlur = 30; c.strokeStyle = P.acc; c.lineWidth = 3;
      rr(c, x, y, w, h, 20); c.stroke(); c.restore();
    }
    c.fillStyle = P.acc; rr(c, x - 1, y + 26, 6, h - 52, 3); c.fill();
    /* device glyph */
    c.save();
    c.strokeStyle = P.acc; c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round';
    var ix = x + w - 74, iy = y + 26;
    if (P === NEO) {
      rr(c, ix + 6, iy + 4, 44, 28, 4); c.stroke();
      c.beginPath(); c.moveTo(ix, iy + 40); c.lineTo(ix + 56, iy + 40); c.stroke();
    } else {
      rr(c, ix + 2, iy, 40, 28, 4); c.stroke();
      c.beginPath(); c.moveTo(ix + 22, iy + 28); c.lineTo(ix + 22, iy + 36); c.moveTo(ix + 12, iy + 38); c.lineTo(ix + 32, iy + 38); c.stroke();
      rr(c, ix + 48, iy - 4, 14, 44, 3); c.stroke();
    }
    c.restore();
    c.fillStyle = '#f1f5f9';
    c.font = '700 40px ' + SANS;
    c.textBaseline = 'alphabetic';
    c.fillText(P.name, x + 28, y + 72);
    c.fillStyle = '#94a3b8';
    c.font = '500 24px ' + SANS;
    c.fillText(P.sub, x + 28, y + 110);
  }
  function drawToken(c, pt, label, p) {
    /* trail */
    for (var k = 6; k >= 1; k--) {
      var q = p - k * 0.025;
      if (q <= 0) continue;
      var tp = arcPoint(NEO, JOEY, q);
      c.fillStyle = 'rgba(34,211,238,' + (0.22 - k * 0.03) + ')';
      c.beginPath(); c.arc(tp.x, tp.y, 16 - k * 1.6, 0, Math.PI * 2); c.fill();
    }
    var gl = c.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 70);
    gl.addColorStop(0, 'rgba(34,211,238,.6)'); gl.addColorStop(1, 'rgba(34,211,238,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(pt.x, pt.y, 70, 0, Math.PI * 2); c.fill();
    c.font = '800 26px ' + MONO;
    var tw = c.measureText(label).width + 34;
    c.save();
    c.shadowColor = 'rgba(34,211,238,.9)'; c.shadowBlur = 22;
    rr(c, pt.x - tw / 2, pt.y - 22, tw, 44, 22);
    c.fillStyle = '#22d3ee'; c.fill();
    c.restore();
    c.fillStyle = '#03141a';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, pt.x, pt.y + 1);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  function drawRipple(c, P, r) {
    c.save();
    c.beginPath();
    c.rect(0, 0, CW, CH);
    var x = P.x - 125, y = P.y - 71, w = 250, h = 150, q = 20;
    c.moveTo(x + q, y); c.lineTo(x, y + q); c.lineTo(x, y + h - q); c.lineTo(x + q, y + h);
    c.lineTo(x + w - q, y + h); c.lineTo(x + w, y + h - q); c.lineTo(x + w, y + q); c.lineTo(x + w - q, y); c.closePath();
    c.clip('evenodd');
    for (var k = 0; k < 3; k++) {
      var rk = r - k * 45;
      if (rk <= 2) continue;
      var a = Math.max(0, 0.9 - rk / 190);
      c.strokeStyle = 'rgba(192,132,252,' + a + ')';
      c.lineWidth = 4 - k;
      c.beginPath(); c.ellipse(P.x, P.y + 4, 132 + rk, 82 + rk * 0.62, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  function drawCheck(c, P, dt) {
    var s = Math.min(1, dt / 0.3);
    var sc = s < 1 ? 0.4 + 0.75 * easeOut(s) : 1 + 0.15 * Math.max(0, 1 - (dt - 0.3) / 0.25);
    var cx = P.x + 112, cy = P.y - 66;
    c.save();
    c.translate(cx, cy); c.scale(sc, sc);
    c.shadowColor = 'rgba(16,185,129,.8)'; c.shadowBlur = 24;
    c.fillStyle = '#10b981'; c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#03150e'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-13, 1); c.lineTo(-4, 11); c.lineTo(14, -10); c.stroke();
    c.restore();
    /* the message lands */
    var a = clamp01((dt - 0.2) / 0.4);
    if (a > 0) {
      c.globalAlpha = a;
      c.font = '600 28px ' + SANS;
      c.fillStyle = '#e2e8f0';
      c.textAlign = 'center';
      c.fillText('#248 is ready for review', CW / 2, CH - 34);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }
  }
  /* the real function: the code panel shows this, line for line */
  function frame(c, t) {
    drawClear(c);
    drawCard(c, NEO, 0);
    drawCard(c, JOEY, t > FLIGHT ? clamp01(1 - (t - FLIGHT) / 1.2) : 0);
    var p = easeIO(Math.min(t / FLIGHT, 1));
    var pt = arcPoint(NEO, JOEY, p);
    if (t <= FLIGHT + 0.05) drawToken(c, pt, '#248', p);
    if (t > FLIGHT) {
      var r = (t - FLIGHT) * 140;
      drawRipple(c, JOEY, r);
      drawCheck(c, JOEY, t - FLIGHT);
    }
  }
  function paint(canvas, t) {
    var c = canvas.getContext('2d');
    if (!c) return;
    var s = canvas.width / CW;
    c.setTransform(s, 0, 0, s, 0, 0);
    frame(c, t);
  }

  var FILM_T = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

  function frameTHtml() {
    var code = '';
    CODE.forEach(function (ln, k) {
      code += '<div class="dst-ln"><span class="dst-lnno">' + (k + 1) + '</span><span class="dst-lntx">' + highlightLine(ln) + '</span></div>';
    });
    var hlTop = function (k) { return 16 + k * 38; };
    var film = '';
    var lbls = '';
    FILM_T.forEach(function (t, k) {
      var x = 20 + k * 210;
      lbls += '<div class="dst-film-lbl dst-mono dst-pop" style="left:' + x + 'px"' + at(2, 250 + k * 110, ' data-off="3"') + '>t = ' + t + ' s</div>';
      film += '<div class="dst-film-cell dst-pop" style="left:' + (x + 30) + 'px"' + at(2, 250 + k * 110) + '><canvas width="300" height="168" data-ft="' + t + '"></canvas></div>';
    });
    var reel =
      '<svg viewBox="-80 -80 160 160" aria-hidden="true">' +
        '<circle r="76" fill="#0d1428" stroke="#67e8f9" stroke-width="3"/>' +
        '<g class="dst-reel-spin">' +
          '<circle r="62" fill="none" stroke="#1e2a4d" stroke-width="16"/>' +
          '<circle r="62" fill="none" stroke="#22d3ee" stroke-width="16" stroke-dasharray="40 25" opacity=".55"/>' +
          '<circle r="22" fill="#121b36" stroke="#a5f3fc" stroke-width="3"/>' +
          '<circle cx="0" cy="-38" r="11" fill="#0b1020"/><circle cx="33" cy="19" r="11" fill="#0b1020"/><circle cx="-33" cy="19" r="11" fill="#0b1020"/>' +
          '<circle r="6" fill="#a5f3fc"/>' +
        '</g>' +
      '</svg>';
    return '' +
      '<div class="dst-code" style="left:40px;top:40px;width:780px;height:586px">' +
        '<div class="dst-code-bar"><i></i><i></i><i></i><span class="dst-mono">frame.js</span><em class="dst-mono">runs every frame</em></div>' +
        '<div class="dst-code-body dst-mono">' +
          '<div class="dst-hl" data-blk="a" style="top:' + hlTop(4) + 'px;height:114px"></div>' +
          '<div class="dst-hl dst-hl-b" data-blk="b" style="top:' + hlTop(8) + 'px;height:114px"></div>' +
          code +
        '</div>' +
      '</div>' +
      '<div class="dst-canvas-box" style="left:850px;top:40px;width:910px;height:512px">' +
        '<canvas width="1820" height="1024" data-main="1"></canvas>' +
        '<div class="dst-canvas-tag dst-mono">&lt;canvas&gt; calling frame(t)</div>' +
      '</div>' +
      '<div class="dst-tread dst-mono" style="left:852px;top:566px">t = <b data-tr="1">0.00</b> s</div>' +
      '<div class="dst-scrub-tick dst-mono" style="left:1262px;top:578px">0 s</div>' +
      '<div class="dst-scrub" style="left:1336px;top:592px;width:340px">' +
        '<div class="dst-scrub-fill" data-sf="1"></div><div class="dst-scrub-knob" data-sk="1"></div>' +
      '</div>' +
      '<div class="dst-scrub-tick dst-mono" style="left:1700px;top:578px">4 s</div>' +
      '<div class="dst-film" style="left:40px;top:636px;width:1720px;height:146px">' +
        lbls +
        '<div class="dst-film-band dst-drop"' + at(2, 0) + '>' +
          '<div class="dst-film-row" data-row="1">' + film + '</div>' +
          '<div class="dst-film-label dst-fade"' + at(3, 1500) + '>headless browser, then FFmpeg:<b>24 frames a second</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="dst-reel dst-pop" style="left:1640px;top:657px;width:132px;height:132px;z-index:4"' + at(3, 0) + '>' + reel + '</div>';
  }

  var frameT = makeScene({
    name: 'frame-t',
    label: 'A video is a function of time: a short function frame(t) draws a message flying from neo to joey, and a canvas runs it every animation frame.',
    credit: CREDIT_A,
    captions: [
      'Give it t, get one picture. Every frame of this is code.',
      'Give it t, get one picture. Every frame of this is code.',
      'Eight values of t, eight pictures. Same function, nothing recorded.',
      'Nothing here is a video file. It is a function.'
    ],
    html: frameTHtml,
    init: function (inner) {
      var refs = {
        canvas: inner.querySelector('canvas[data-main]'),
        tr: inner.querySelector('[data-tr]'),
        sf: inner.querySelector('[data-sf]'),
        sk: inner.querySelector('[data-sk]'),
        hlA: inner.querySelector('[data-blk="a"]'),
        hlB: inner.querySelector('[data-blk="b"]'),
        row: inner.querySelector('[data-row]'),
        t: 0, last: 0, shownT: ''
      };
      Array.prototype.forEach.call(inner.querySelectorAll('canvas[data-ft]'), function (cv) { paint(cv, +cv.getAttribute('data-ft')); });
      refs.show = function (t) {
        paint(refs.canvas, t);
        var s = t.toFixed(2);
        if (s !== refs.shownT) { refs.tr.textContent = s; refs.shownT = s; }
        var f = t / LOOP_T;
        refs.sf.style.transform = 'scaleX(' + f + ')';
        refs.sk.style.transform = 'translateX(' + (f * 340) + 'px)';
        var inA = t > 0 && t <= FLIGHT, inB = t > FLIGHT;
        refs.hlA.classList.toggle('on', inA);
        refs.hlB.classList.toggle('on', inB);
      };
      refs.show(0);
      return refs;
    },
    enter: function (i, mode, fx, refs) {
      if (i === 0) { refs.t = 0; refs.show(0); }
      else if (fx.rm) { refs.t = 1.25; refs.show(1.25); }
      else {
        if (i === 1 && mode === 'fwd') refs.t = 0;
        refs.last = 0;
        fx.loop(function (now) {
          if (!refs.last) refs.last = now;
          var dt = Math.min(0.1, (now - refs.last) / 1000);
          refs.last = now;
          refs.t += dt;
          if (refs.t >= LOOP_T) refs.t -= LOOP_T;
          refs.show(refs.t);
          return true;
        });
      }
      /* film strip: frames slide into the reel */
      if (refs.row.getAnimations) refs.row.getAnimations().forEach(function (a) { a.cancel(); });
      if (i >= 3) {
        if (mode === 'fwd') {
          fx.anim(refs.row, [
            { transform: 'translateX(0)', opacity: 1 },
            { transform: 'translateX(1640px)', opacity: 1, offset: 0.9 },
            { transform: 'translateX(1700px)', opacity: 0 }
          ], { duration: 1500, delay: 250, easing: 'cubic-bezier(.55,0,.75,.4)', fill: 'forwards' });
        } else {
          refs.row.style.opacity = '0';
        }
      } else {
        refs.row.style.opacity = '';
      }
      if (i >= 3 && mode === 'fwd') refs.row.style.opacity = '';
      if (i < 3) refs.row.style.opacity = '';
    },
    onLive: function (live, refs) {
      if (live) refs.last = 0;
    }
  });

  /* ============================================================ 2. storyboard */

  var WOB = '<filter id="dst-sb-wob" x="-5%" y="-5%" width="110%" height="110%">' +
    '<feTurbulence type="turbulence" baseFrequency=".035" numOctaves="2" seed="4" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>';

  var SB_INK = 'fill="none" stroke="#2b2f3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  var SKETCH = {
    s2003:
      '<rect x="78" y="18" width="330" height="178" rx="3" fill="#fff" ' + SB_INK + '/>' +
      '<rect x="78" y="18" width="330" height="36" fill="#9cc0ea" stroke="#2b2f3a" stroke-width="3"/>' +
      '<path d="M98 36h120" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M100 82h150" stroke="#2b2f3a" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="106" cy="112" r="4" fill="#2b2f3a"/><path d="M118 112h190" ' + SB_INK + ' stroke-width="2.5"/>' +
      '<circle cx="106" cy="136" r="4" fill="#2b2f3a"/><path d="M118 136h160" ' + SB_INK + ' stroke-width="2.5"/>' +
      '<circle cx="106" cy="160" r="4" fill="#2b2f3a"/><path d="M118 160h200" ' + SB_INK + ' stroke-width="2.5"/>' +
      '<circle cx="360" cy="122" r="12" ' + SB_INK + '/><path d="M360 134v26M346 146h28M360 160l-12 20M360 160l12 20" ' + SB_INK + '/>' +
      '<path d="M380 184h16" ' + SB_INK + ' stroke-width="2"/>',
    trans:
      '<rect x="48" y="44" width="230" height="140" rx="3" fill="#e4ecf8" ' + SB_INK + '/>' +
      '<path d="M68 70h110M68 96h150M68 118h120" ' + SB_INK + ' stroke-width="2.5" opacity=".6"/>' +
      '<g transform="rotate(4 320 98)"><rect x="200" y="24" width="230" height="140" rx="3" fill="#fff" ' + SB_INK + '/>' +
      '<path d="M200 24h50v140h-50z" fill="#c4d7f0" stroke="none"/>' +
      '<path d="M215 34l20 120M232 30l20 120" ' + SB_INK + ' stroke-width="2" opacity=".55"/>' +
      '<path d="M270 56h120M270 84h140M270 108h100" ' + SB_INK + ' stroke-width="2.5"/></g>' +
      '<path d="M40 196c60-22 120-8 200-30" ' + SB_INK + '/><path d="M226 158l16 8-12 14" ' + SB_INK + '/>' +
      '<path d="M30 30l18 6M24 52l20 2M30 74l16-4" ' + SB_INK + ' stroke-width="2.4"/>',
    map:
      '<path d="M190 104c-40-10-80-40-104-56M296 104c40-10 80-40 104-56M190 124c-40 10-80 34-104 46M296 124c40 10 80 34 104 46M243 138v32" ' + SB_INK + ' stroke-width="2.4" opacity=".7"/>' +
      '<ellipse cx="243" cy="114" rx="60" ry="32" fill="#cdeefa" ' + SB_INK + '/>' +
      '<path d="M220 112h46" ' + SB_INK + ' stroke-width="4"/>' +
      '<rect x="34" y="22" width="86" height="46" rx="10" fill="#fdf3d0" ' + SB_INK + '/>' +
      '<rect x="366" y="22" width="86" height="46" rx="10" fill="#fdf3d0" ' + SB_INK + '/>' +
      '<rect x="34" y="150" width="86" height="46" rx="10" fill="#fdf3d0" ' + SB_INK + '/>' +
      '<rect x="366" y="150" width="86" height="46" rx="10" fill="#fdf3d0" ' + SB_INK + '/>' +
      '<rect x="204" y="170" width="78" height="34" rx="8" fill="#ead9fb" ' + SB_INK + '/>' +
      '<path d="M352 12h-14v14M466 12h14v14M352 80h-14v-14M466 80h14v-14" stroke="#dc2626" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M310 66l26-20M300 52l20-6" stroke="#dc2626" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>',
    motion:
      '<path d="M30 70h40M20 98h50M30 126h40" ' + SB_INK + ' stroke-width="2.6"/>' +
      '<path d="M88 150h236" stroke="#22d3ee" stroke-width="10" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M88 150h236" ' + SB_INK + ' stroke-width="2.4"/>' +
      '<rect x="356" y="128" width="22" height="50" fill="#a5d8ff" ' + SB_INK + ' stroke-width="2.4"/>' +
      '<rect x="390" y="96" width="22" height="82" fill="#a5d8ff" ' + SB_INK + ' stroke-width="2.4"/>' +
      '<rect x="424" y="52" width="22" height="126" fill="#a5d8ff" ' + SB_INK + ' stroke-width="2.4"/>' +
      '<path d="M350 66c30-30 56-40 92-48M432 12l12 6-8 12" ' + SB_INK + ' stroke-width="2.4"/>' +
      '<path d="M88 186h170" ' + SB_INK + ' stroke-width="2.4" opacity=".6"/>',
    five:
      (function () {
        var s = '';
        var glyph = [
          '<circle cx="39" cy="44" r="20" fill="#cdeefa" ' + SB_INK + ' stroke-width="2.4"/><circle cx="39" cy="44" r="8" ' + SB_INK + ' stroke-width="2"/>',
          '<path d="M22 22v54M56 22v54M22 38h34M56 58h-34" ' + SB_INK + ' stroke-width="2.4"/><path d="M48 33l8 5-8 5M30 53l-8 5 8 5" ' + SB_INK + ' stroke-width="2"/>',
          '<path d="M16 26v-8h10M62 26v-8h-10M16 64v8h10M62 64v8h-10" stroke="#dc2626" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M39 32v26M26 45h26" ' + SB_INK + ' stroke-width="2"/>',
          '',
          '<path d="M14 64c10-24 18 10 28-14s16 8 22-6" ' + SB_INK + ' stroke-width="2.6"/><path d="M50 22l12 12-24 24-14 2 2-14z" fill="#fde68a" ' + SB_INK + ' stroke-width="2.2"/>'
        ];
        for (var k = 0; k < 5; k++) {
          var x = 16 + k * 92, y = k % 2 ? 66 : 50, r = (k - 2) * 4;
          s += '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ' 39 46)"><rect x="0" y="0" width="78" height="94" rx="6" fill="#fff" ' + SB_INK + '/>' + glyph[k] + '</g>';
        }
        return s;
      })(),
    dist:
      '<rect x="18" y="26" width="124" height="70" rx="6" fill="#fde2e2" ' + SB_INK + '/><path d="M70 46v30l26-15z" fill="#dc2626" stroke="#2b2f3a" stroke-width="2"/>' +
      '<rect x="18" y="116" width="124" height="70" rx="6" fill="#fde2e2" ' + SB_INK + '/><path d="M70 136v30l26-15z" fill="#dc2626" stroke="#2b2f3a" stroke-width="2"/>' +
      '<path d="M150 62c30 0 40 30 66 36M150 150c30 0 40-30 66-36" ' + SB_INK + ' stroke-width="2.6"/>' +
      '<path d="M214 70h70l-26 40v34h-18v-34z" fill="#cdeefa" ' + SB_INK + '/>' +
      '<path d="M249 156c-6 10-6 16 0 20 6-4 6-10 0-20z" fill="#22d3ee" stroke="#2b2f3a" stroke-width="2"/>' +
      '<path d="M276 172c24 0 40-6 54-22" ' + SB_INK + ' stroke-width="2.6"/><path d="M318 146l14 2-2 14" ' + SB_INK + ' stroke-width="2.6"/>' +
      '<rect x="336" y="48" width="132" height="104" rx="4" fill="#0f172e" ' + SB_INK + '/>' +
      '<path d="M352 72h70M352 96h96M352 120h56" stroke="#67e8f9" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M446 24l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#fde68a" ' + SB_INK + ' stroke-width="2"/>'
  };
  /* lettering inside sketches is HTML: SVG text under a scaled, filtered parent renders at the wrong size in Chromium */
  var SB_INKS = {
    motion: '<div class="dst-sb-ink" style="left:100px;top:70px;font:700 72px/1 ' + HAND.replace(/"/g, "'") + ';color:#0e7490">4,201</div>',
    five: '<div class="dst-sb-ink" style="left:322px;top:106px;font:700 36px/1 Georgia,serif;color:#2b2f3a;transform:rotate(4deg)">Aa</div>'
  };
  var SB_PANELS = {
    s2003: { title: '2003 slides', r: -1.2 },
    trans: { title: 'transitions', r: 0.9 },
    motion: { title: 'motion', r: -0.7 },
    map: { title: 'a map you fly', r: 1.3 },
    five: { title: 'five techniques', r: -1 },
    dist: { title: 'what we distilled', r: 0.8 }
  };
  var SB_ORDER0 = ['s2003', 'trans', 'motion', 'map', 'five', 'dist'];
  var SB_ORDER1 = ['s2003', 'trans', 'map', 'motion', 'five', 'dist'];
  function sbSlot(k) { return { x: 90 + (k % 3) * 553, y: 74 + Math.floor(k / 3) * 354 }; }

  function storyboardHtml() {
    var cards = '';
    SB_ORDER0.forEach(function (id, k) {
      var P = SB_PANELS[id], s = sbSlot(k);
      var note = id === 'map' ? '<div class="dst-sb-note"' + at(1, 0) + '>swap: canvas before motion</div>' : '';
      cards +=
        '<div class="dst-sb-card dst-pop" data-sb="' + id + '" style="left:' + s.x + 'px;top:' + s.y + 'px;z-index:' + (id === 'map' ? 5 : 2) + '"' + at(0, 120 + k * 170) + '>' +
          '<div class="dst-sb-paper" style="--r:' + P.r + 'deg">' +
            '<span class="dst-sb-pin"></span>' +
            '<svg class="dst-sb-sketch" viewBox="0 0 485 212" aria-hidden="true"><g filter="url(#dst-sb-wob)">' + SKETCH[id] + '</g></svg>' + (SB_INKS[id] || '') +
            '<div class="dst-sb-lbl"><div class="dst-sb-num"><span>' + (k + 1) + '</span></div><div class="dst-sb-title">' + P.title + '</div></div>' +
            note +
          '</div>' +
        '</div>';
    });
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + WOB + '</defs></svg>' +
      '<div class="dst-sb-board"></div>' + cards +
      '<div class="dst-sb-stamp"' + at(2, 150) + '>approved, now render</div>';
  }

  var storyboard = makeScene({
    name: 'storyboard',
    label: 'Storyboard first: six hand-drawn panels, the first six acts of this deck. A sticky note swaps two panels, then a stamp approves the board.',
    credit: CREDIT_A,
    captions: [
      'Storyboard first: the first six acts of this deck as one rough panel.',
      'Changing the order costs a sticky note, not a re-render.',
      'See every scene before you spend an hour rendering it.'
    ],
    html: storyboardHtml,
    init: function (inner) {
      var refs = { cards: {} };
      Array.prototype.forEach.call(inner.querySelectorAll('[data-sb]'), function (el) {
        refs.cards[el.getAttribute('data-sb')] = { el: el, num: el.querySelector('.dst-sb-num span') };
      });
      return refs;
    },
    enter: function (i, mode, fx, refs) {
      var order = i >= 1 ? SB_ORDER1 : SB_ORDER0;
      var moving = mode === 'fwd' && i === 1;
      order.forEach(function (id, k) {
        var C = refs.cards[id], s = sbSlot(k);
        var ox = parseFloat(C.el.style.left), oy = parseFloat(C.el.style.top);
        C.el.style.left = s.x + 'px'; C.el.style.top = s.y + 'px';
        var dx = ox - s.x, dy = oy - s.y;
        if (moving && (dx || dy)) {
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / len, ny = dx / len, side = id === 'map' ? 1 : -1;
          fx.anim(C.el, [
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1) rotate(0deg)' },
            { transform: 'translate(' + (dx / 2 + nx * 110 * side) + 'px,' + (dy / 2 + ny * 110 * side) + 'px) scale(1.07) rotate(' + (3 * side) + 'deg)', offset: 0.5 },
            { transform: 'translate(0,0) scale(1) rotate(0deg)' }
          ], { duration: 1300, delay: 900, easing: EASE, fill: 'backwards' });
          var span = C.num;
          span.textContent = String(order === SB_ORDER1 ? SB_ORDER0.indexOf(id) + 1 : k + 1);
          fx.after(900 + 1250, function () {
            span.textContent = String(k + 1);
            fx.anim(span, [{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 450, easing: POP });
          });
        } else {
          C.num.textContent = String(k + 1);
        }
      });
    }
  });

  /* ================================================================== 3. loop */

  var SHEET = 1920 / 820;         /* sheet px per local px */
  var LP_BOXES = [                 /* sheet coordinates, round 1 contact sheet */
    { x: 28, y: 88, w: 310, h: 68 },     /* title slide body text */
    { x: 24, y: 470, w: 590, h: 230 },   /* empty white area under "You have context" */
    { x: 24, y: 1170, w: 1520, h: 78 }   /* the problem-today build, one bullet per click */
  ];
  var LP_NOTES = [
    { t: 'too small to read from the back', s: 'body text on the title slide', y: 96 },
    { t: 'the slide is mostly empty', s: 'one sentence, then white space', y: 300 },
    { t: 'one line per click, nothing moves', s: 'the problem-today build, frame by frame', y: 548 }
  ];
  var LOOP_NODES = [
    { t: 'render', a: -90 },
    { t: 'contact sheet', a: 0 },
    { t: 'look', a: 90 },
    { t: 'fix', a: 180 }
  ];
  var LP_CX = 375, LP_CY = 330, LP_R = 220;

  function loopHtml() {
    var boxes = '';
    LP_BOXES.forEach(function (b, k) {
      boxes += '<div class="dst-lp-box dst-pop" data-box="' + k + '" style="left:' + (b.x / SHEET) + 'px;top:' + (b.y / SHEET) + 'px;width:' + (b.w / SHEET) + 'px;height:' + (b.h / SHEET) + 'px"' +
        at(0, 400 + k * 320) + '><i>' + (k + 1) + '</i></div>';
    });
    var notes = '<div class="dst-lp-head dst-fade"' + at(0, 200, ' data-off="1"') + '>round 1, what the reviewer saw</div>';
    LP_NOTES.forEach(function (n, k) {
      notes += '<div class="dst-lp-note"' + at(0, 550 + k * 320, ' data-off="1"') + ' style="top:' + n.y + 'px"><i>' + (k + 1) + '</i><div>' + n.t + '<small>' + n.s + '</small></div></div>';
    });
    /* loop diagram */
    var ring = '<svg class="dst-svg" style="left:0;top:0;width:750px;height:660px" viewBox="0 0 750 660" aria-hidden="true">' +
      '<defs><marker id="dst-lp-ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M0 0L10 5L0 10z" fill="#475569"/></marker></defs>' +
      '<circle cx="' + LP_CX + '" cy="' + LP_CY + '" r="' + LP_R + '" fill="none" stroke="#1e2a4d" stroke-width="10"/>' +
      '<circle data-prog="1" cx="' + LP_CX + '" cy="' + LP_CY + '" r="' + LP_R + '" fill="none" stroke="url(#dst-lp-g)" stroke-width="10" stroke-linecap="round"' +
      ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" transform="rotate(-90 ' + LP_CX + ' ' + LP_CY + ')"/>' +
      '<defs><linearGradient id="dst-lp-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>';
    [-45, 45, 135, 225].forEach(function (a) {
      var r = a * Math.PI / 180, x = LP_CX + LP_R * Math.cos(r), y = LP_CY + LP_R * Math.sin(r);
      ring += '<path d="M' + (x - 8 * Math.cos(r + Math.PI / 2)) + ' ' + (y - 8 * Math.sin(r + Math.PI / 2)) + ' L' + (x + 8 * Math.cos(r + Math.PI / 2)) + ' ' + (y + 8 * Math.sin(r + Math.PI / 2)) + '"' +
        ' stroke="#64748b" stroke-width="3" marker-end="url(#dst-lp-ah)"/>';
    });
    ring += '<g data-dot="1"><circle r="26" fill="rgba(34,211,238,.25)"/><circle r="13" fill="#e0f7fe"/></g></svg>';
    var nodes = '';
    LOOP_NODES.forEach(function (n, k) {
      var r = n.a * Math.PI / 180;
      nodes += '<div class="dst-lp-node" data-node="' + k + '" style="left:' + (LP_CX + LP_R * Math.cos(r)) + 'px;top:' + (LP_CY + LP_R * Math.sin(r)) + 'px">' + n.t + '</div>';
    });
    var loopBox = '<div class="dst-lp-loop dst-fade"' + at(1, 350, ' data-off="3"') + '>' + ring + nodes +
      '<div class="dst-lp-round"><small>round</small><b data-round="1">1</b></div>' +
      '<div class="dst-lp-of">an agent looks at every frame</div></div>';
    return '' +
      '<div class="dst-lp-frame dst-lp-before" data-at="3" data-cls="small">' +
        '<div class="dst-lp-img"><img src="media/loop-before.jpg" alt="Round 1 contact sheet of this deck"></div>' +
        '<div data-annot="1">' + boxes + '</div>' +
        '<div class="dst-lp-tag dst-fade" style="color:#fca5a5"' + at(3, 700) + '>round 1</div>' +
      '</div>' +
      '<div class="dst-lp-frame dst-lp-after" data-at="3" data-cls="small"><div class="dst-lp-wrap" data-at="2" data-cls="wiped">' +
        '<div class="dst-lp-img"><img src="media/loop-after.jpg" alt="Round 4 contact sheet of this deck"></div>' +
        '</div>' +
        '<div class="dst-lp-tag dst-fade" style="color:#6ee7b7"' + at(3, 900) + '>round 4</div>' +
      '</div>' +
      '<div class="dst-lp-wipe" data-wipe="1"></div>' +
      notes + loopBox;
  }

  var loop = makeScene({
    name: 'loop',
    label: 'Render, look, fix, repeat: the round 1 contact sheet of this deck with three reviewer notes, the review loop running four rounds, and the round 4 sheet.',
    credit: CREDIT_A,
    captions: [
      'Round 1: render the deck, pull a contact sheet, look at it like a reviewer.',
      'Render, contact sheet, look, fix. Then go round again.',
      'The same deck, four rounds in. The loop kept going.',
      'This deck was built with that loop. Every round, an agent looked at every frame.'
    ],
    html: loopHtml,
    init: function (inner) {
      var refs = {
        before: inner.querySelector('.dst-lp-before'),
        after: inner.querySelector('.dst-lp-after'),
        annot: inner.querySelector('[data-annot]'),
        boxes: Array.prototype.slice.call(inner.querySelectorAll('[data-box]')),
        nodes: Array.prototype.slice.call(inner.querySelectorAll('[data-node]')),
        dot: inner.querySelector('[data-dot]'),
        prog: inner.querySelector('[data-prog]'),
        round: inner.querySelector('[data-round]'),
        wipe: inner.querySelector('[data-wipe]')
      };
      refs.setLoop = function (lapF) {           /* lapF in [0,4]: completed laps */
        var lap = Math.min(3, Math.floor(lapF));
        var f = lapF >= 4 ? 1 : lapF - lap;
        var a = (-90 + 360 * f) * Math.PI / 180;
        refs.dot.setAttribute('transform', 'translate(' + (LP_CX + LP_R * Math.cos(a)) + ' ' + (LP_CY + LP_R * Math.sin(a)) + ')');
        refs.prog.setAttribute('stroke-dashoffset', String(1 - f));
        refs.round.textContent = String(lap + 1);
        var node = Math.min(3, Math.floor(f * 4 + 0.15)) % 4;
        refs.nodes.forEach(function (n, k) { n.classList.toggle('hot', lapF < 4 && k === node); });
        refs.boxes.forEach(function (b, k) { b.classList.toggle('fixed', lapF >= k + 1); });
      };
      return refs;
    },
    enter: function (i, mode, fx, refs) {
      refs.wipe.style.opacity = '0';
      refs.annot.style.opacity = i >= 2 ? '0' : '';
      refs.annot.style.transition = 'opacity .5s';
      if (i === 0) { refs.setLoop(0); refs.boxes.forEach(function (b) { b.classList.remove('fixed'); }); return; }
      if (i === 1 && mode === 'fwd' && !fx.rm) {
        refs.setLoop(0);
        var t0 = null, LAP = 1150;
        fx.loop(function (now) {
          if (t0 === null) t0 = now + 500;
          if (now < t0) return true;
          var lf = Math.min(4, (now - t0) / LAP);
          refs.setLoop(lf);
          return lf < 4;
        });
        return;
      }
      refs.setLoop(4);
      if (i === 2 && mode === 'fwd' && !fx.rm) {
        refs.wipe.style.opacity = '1';
        fx.anim(refs.wipe, [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: 'translateX(920px)', opacity: 1, offset: 0.92 },
          { transform: 'translateX(920px)', opacity: 0 }
        ], { duration: 1500, easing: EASE, fill: 'forwards' });
      }
    }
  });

  /* ================================================================ 4. styles */

  /* Static lettering in the style panels is HTML laid over the SVG: SVG text inside
     transformed, composited layers was clipped or mis-sized in Chromium in testing. */
  var LBL = [];
  function lbl(x, base, anchor, size, font, color, text, extra) {
    var top = base - size * 0.84;
    var tx = anchor === 'middle' ? 'translateX(-50%)' : '';
    var parts = font.split('|');   /* "weight style|family" */
    LBL.push('<div class="dst-sty-lbl" style="left:' + x.toFixed(1) + 'px;top:' + top.toFixed(1) + 'px;font:' + parts[0] + ' ' + size + 'px/1 ' + q(parts[1]) +
      ';color:' + color + ';' + (tx || extra ? 'transform:' + tx + ' ' + (extra || '') + ';' : '') + '">' + text + '</div>');
  }
  function flushLbl() { var h = LBL.join(''); LBL = []; return h; }
  function q(f) { return f.replace(/"/g, "'"); }

  /* shared story geometry, 1700x730 panel space */
  var ST_PATH = 'M330 286 Q850 -40 1372 196';
  function smilToken(inner, extra) {
    return '<g opacity="0">' +
      '<animateMotion dur="4s" repeatCount="indefinite" path="' + ST_PATH + '" keyPoints="0;0;1;1" keyTimes="0;.12;.62;1" calcMode="spline"' +
      ' keySplines="0 0 1 1;.6 0 .35 1;0 0 1 1"/>' +
      '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;.08;.6;.66;1"/>' +
      inner + (extra || '') + '</g>';
  }
  function smilCheck(x, y, inner) {
    return '<g transform="translate(' + x + ' ' + y + ')"><g opacity="0">' +
      '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;.62;.67;.93;1"/>' +
      '<animateTransform attributeName="transform" type="scale" dur="4s" repeatCount="indefinite" values=".3;.3;1.18;1;1" keyTimes="0;.62;.7;.76;1"/>' +
      inner + '</g></g>';
  }
  function smilRipple(x, y, stroke, w) {
    return '<circle cx="' + x + '" cy="' + y + '" r="40" fill="none" stroke="' + stroke + '" stroke-width="' + (w || 5) + '" opacity="0">' +
      '<animate attributeName="r" dur="4s" repeatCount="indefinite" values="40;40;190;190" keyTimes="0;.62;.95;1"/>' +
      '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;0;.8;0;0" keyTimes="0;.61;.63;.95;1"/></circle>';
  }

  function cutPaperSvg() {
    var sh = ' filter="url(#dst-cp-sh)"';
    return '<svg viewBox="0 0 1700 730" aria-hidden="true"><defs>' +
      '<filter id="dst-cp-sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="5" dy="9" stdDeviation="5" flood-color="#4a3420" flood-opacity=".35"/></filter>' +
      '<filter id="dst-cp-fib"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>' +
      '<feColorMatrix values="0 0 0 0 .35 0 0 0 0 .26 0 0 0 0 .16 0 0 0 .09 0"/></filter></defs>' +
      '<rect width="1700" height="730" fill="#ead9bf"/><rect width="1700" height="730" filter="url(#dst-cp-fib)"/>' +
      '<circle cx="1530" cy="140" r="86" fill="#f4a261"' + sh + '/>' +
      '<path transform="translate(-170 20)" d="M1180 170c30-40 90-40 110 0 40-6 60 30 40 50h-170c-20-20-10-46 20-50z" fill="#fffaf0"' + sh + ' opacity=".95"/>' +
      '<path d="M0 560C300 480 520 610 860 545S1400 470 1700 560V730H0Z" fill="#2a9d8f"' + sh + '/>' +
      '<path d="M0 640C380 590 700 690 1100 630S1500 600 1700 650V730H0Z" fill="#1f6f67"' + sh + '/>' +
      /* neo laptop */
      '<g transform="rotate(-2.5 330 440)">' +
        '<rect x="200" y="300" width="260" height="176" rx="14" fill="#264653"' + sh + '/>' +
        '<rect x="218" y="318" width="224" height="140" rx="6" fill="#f6eddc"/>' +
        '<rect x="236" y="338" width="120" height="16" rx="8" fill="#e76f51"/>' +
        '<rect x="236" y="368" width="180" height="12" rx="6" fill="#d8c8ac"/><rect x="236" y="390" width="150" height="12" rx="6" fill="#d8c8ac"/>' +
        '<rect x="236" y="412" width="168" height="12" rx="6" fill="#d8c8ac"/>' +
        '<path d="M166 480H494L520 512H140Z" fill="#e76f51"' + sh + '/>' +
      '</g>' +
      /* joey workstation */
      '<g transform="rotate(1.8 1380 400)">' +
        '<rect x="1220" y="214" width="300" height="206" rx="14" fill="#264653"' + sh + '/>' +
        '<rect x="1238" y="232" width="264" height="170" rx="6" fill="#f6eddc"/>' +
        '<rect x="1258" y="254" width="140" height="16" rx="8" fill="#2a9d8f"/>' +
        '<rect x="1258" y="284" width="210" height="12" rx="6" fill="#d8c8ac"/><rect x="1258" y="306" width="170" height="12" rx="6" fill="#d8c8ac"/>' +
        '<rect x="1350" y="420" width="40" height="58" fill="#264653"/>' +
        '<rect x="1290" y="474" width="160" height="22" rx="11" fill="#e9c46a"' + sh + '/>' +
        '<rect x="1548" y="276" width="96" height="220" rx="12" fill="#e76f51"' + sh + '/>' +
        '<circle cx="1596" cy="314" r="12" fill="#f6eddc"/><rect x="1566" y="350" width="60" height="10" rx="5" fill="#b85540"/><rect x="1566" y="372" width="60" height="10" rx="5" fill="#b85540"/>' +
      '</g>' +
      '<path d="' + ST_PATH + '" fill="none" stroke="#264653" stroke-width="5" stroke-dasharray="18 14" stroke-linecap="round" opacity=".75"/>' +
      smilRipple(1370, 318, '#e76f51', 6) +
      smilToken('<g transform="rotate(-4)"><rect x="-86" y="-34" width="172" height="68" rx="34" fill="#e76f51"' + sh + '/>' +
        '<text x="0" y="13" text-anchor="middle" font-family="' + MONO.replace(/"/g, "'") + '" font-size="34" font-weight="800" fill="#fffaf0">#248</text></g>') +
      smilCheck(1520, 214, '<circle r="50" fill="#e9c46a"' + sh + '/><path d="M-22 2l14 15 30-32" fill="none" stroke="#264653" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>') +
      '</svg>' +
      '<div class="dst-cp-tag" style="left:236px;top:560px;width:190px;height:80px;transform:rotate(-3deg)">neo</div>' +
      '<div class="dst-cp-tag" style="left:1278px;top:560px;width:210px;height:80px;transform:rotate(2.5deg)">joey</div>' +
      '<div class="dst-cp-tag" style="left:54px;top:44px;width:384px;height:104px;transform:rotate(-3deg);font-size:68px;' +
      'justify-content:flex-start;padding-left:42px;border-left:18px solid #e76f51">cut paper</div>';
  }

  function crosshatchSvg() {
    var ink = '#1f2430';
    var IK = 'fill="none" stroke="' + ink + '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"';
    return '<svg viewBox="0 0 1700 730" aria-hidden="true"><defs>' +
      '<pattern id="dst-ch-h1" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V11" stroke="' + ink + '" stroke-width="1.7"/></pattern>' +
      '<pattern id="dst-ch-h2" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V11" stroke="' + ink + '" stroke-width="1.7"/></pattern>' +
      '<pattern id="dst-ch-hx" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10M0 0H10" stroke="' + ink + '" stroke-width="1.6"/></pattern>' +
      '<pattern id="dst-ch-hd" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V6" stroke="' + ink + '" stroke-width="1.9"/></pattern>' +
      '<pattern id="dst-ch-hl" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V16" stroke="' + ink + '" stroke-width="1.2"/></pattern>' +
      '</defs>' +
      '<rect width="1700" height="730" fill="#f6f1e5"/>' +
      '<rect x="22" y="22" width="1656" height="686" fill="none" stroke="' + ink + '" stroke-width="3"/>' +
      '<rect x="32" y="32" width="1636" height="666" fill="none" stroke="' + ink + '" stroke-width="1.2"/>' +
      '<path d="M90 540H1610" stroke="' + ink + '" stroke-width="3.5"/>' +
      '<rect x="90" y="542" width="1520" height="34" fill="url(#dst-ch-hl)" opacity=".55"/>' +
      '<ellipse cx="330" cy="530" rx="200" ry="20" fill="url(#dst-ch-hd)"/>' +
      '<ellipse cx="1420" cy="528" rx="250" ry="22" fill="url(#dst-ch-hd)"/>' +
      /* neo laptop */
      '<rect x="200" y="300" width="260" height="176" rx="12" fill="url(#dst-ch-h2)" ' + IK + '/>' +
      '<rect x="218" y="318" width="224" height="140" rx="5" fill="#f6f1e5" ' + IK + ' stroke-width="2.5"/>' +
      '<path d="M238 344h110M238 372h170M238 398h140M238 424h160" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M166 480H494L520 512H140Z" fill="url(#dst-ch-hx)" ' + IK + '/>' +
      /* joey workstation */
      '<rect x="1220" y="214" width="300" height="206" rx="12" fill="url(#dst-ch-h1)" ' + IK + '/>' +
      '<rect x="1238" y="232" width="264" height="170" rx="5" fill="#f6f1e5" ' + IK + ' stroke-width="2.5"/>' +
      '<path d="M1258 260h140M1258 290h200M1258 318h160M1258 346h190" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<rect x="1350" y="420" width="40" height="58" fill="url(#dst-ch-hx)" ' + IK + '/>' +
      '<rect x="1290" y="476" width="160" height="22" rx="4" fill="url(#dst-ch-hd)" ' + IK + '/>' +
      '<rect x="1548" y="276" width="96" height="220" rx="8" fill="url(#dst-ch-hx)" ' + IK + '/>' +
      '<rect x="1560" y="292" width="72" height="40" fill="#f6f1e5" ' + IK + ' stroke-width="2.4"/>' +
      '<path d="' + ST_PATH + '" fill="none" stroke="' + ink + '" stroke-width="4" stroke-dasharray="1 13" stroke-linecap="round"/>' +
      '<path d="M282 636c30 6 66 6 96 0" ' + IK + ' stroke-width="2.4"/>' +
      '<path d="M1326 636c34 6 74 6 108 0" ' + IK + ' stroke-width="2.4"/>' +
      smilRipple(1370, 318, ink, 3) +
      smilToken('<circle r="52" fill="#f6f1e5" ' + IK + '/><circle r="52" fill="url(#dst-ch-hl)" opacity=".6"/>' +
        '<circle r="40" fill="#f6f1e5" stroke="' + ink + '" stroke-width="2"/>' +
        '<text x="0" y="11" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="700" fill="' + ink + '">#248</text>') +
      smilCheck(1520, 214, '<circle r="50" fill="#f6f1e5" ' + IK + '/><circle r="50" fill="url(#dst-ch-h1)" opacity=".7"/>' +
        '<path d="M-22 2l14 15 30-32" fill="none" stroke="#f6f1e5" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M-22 2l14 15 30-32" ' + IK + ' stroke-width="8"/>') +
      '<rect x="72" y="146" width="380" height="16" fill="url(#dst-ch-hx)"/>' +
      '</svg>' + (lbl(330, 620, 'middle', 54, 'italic 400|Georgia,serif', ink, 'neo'), lbl(1380, 620, 'middle', 54, 'italic 400|Georgia,serif', ink, 'joey'),
        lbl(70, 128, 'start', 78, 'italic 400|Georgia,serif', ink, 'crosshatch'), flushLbl());
  }

  function sketchSvg() {
    var g = '#3d424d';
    var IK = 'fill="none" stroke="' + g + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"';
    function twice(s) {
      return '<g filter="url(#dst-sk-w1)">' + s + '</g><g filter="url(#dst-sk-w2)" opacity=".5" transform="translate(2 -1.5)">' + s + '</g>';
    }
    var rings = '';
    for (var x = 120; x < 1620; x += 64) {
      rings += '<circle cx="' + x + '" cy="26" r="9" fill="#d9d2c2" stroke="' + g + '" stroke-width="2"/>' +
        '<path d="M' + (x - 4) + ' 4c-10 14-10 26 4 34" fill="none" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/>';
    }
    var shade = '<rect x="210" y="310" width="240" height="156" fill="' + g + '" opacity=".08" filter="url(#dst-sk-w1)"/>' +
      '<path d="M170 488H490L510 506H150Z" fill="' + g + '" opacity=".14" filter="url(#dst-sk-w1)"/>' +
      '<path d="M1560 290h80v200h-80z" fill="' + g + '" opacity=".1" filter="url(#dst-sk-w1)"/>';
    var body = '<rect x="200" y="300" width="260" height="176" rx="12" ' + IK + '/>' +
      '<rect x="218" y="318" width="224" height="140" rx="5" ' + IK + ' stroke-width="2.2"/>' +
      '<path d="M240 350h100M240 378h160M240 404h120" ' + IK + ' stroke-width="2.2"/>' +
      '<path d="M166 480H494L520 512H140Z" ' + IK + '/>' +
      '<rect x="1220" y="214" width="300" height="206" rx="12" ' + IK + '/>' +
      '<rect x="1238" y="232" width="264" height="170" rx="5" ' + IK + ' stroke-width="2.2"/>' +
      '<path d="M1262 262h130M1262 292h190M1262 320h150" ' + IK + ' stroke-width="2.2"/>' +
      '<path d="M1350 420v56M1390 420v56M1290 488h160" ' + IK + '/>' +
      '<rect x="1548" y="276" width="96" height="220" rx="10" ' + IK + '/>' +
      '<circle cx="1596" cy="316" r="11" ' + IK + ' stroke-width="2.4"/>' +
      '<path d="M100 540c300-6 600 6 900-2s400 4 600 0" ' + IK + ' stroke-width="2.4" opacity=".7"/>' +
      '<path d="' + ST_PATH + '" ' + IK + ' stroke-width="2.6" stroke-dasharray="14 12"/>';
    return '<svg viewBox="0 0 1700 730" aria-hidden="true"><defs>' +
      '<filter id="dst-sk-w1" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="turbulence" baseFrequency=".022" numOctaves="2" seed="3" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="dst-sk-w2" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="turbulence" baseFrequency=".03" numOctaves="2" seed="11" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '</defs>' +
      rings + shade + twice(body) +
      smilRipple(1370, 318, '#6b7280', 3) +
      smilToken('<g filter="url(#dst-sk-w1)"><circle r="50" fill="#f3efe5" stroke="' + g + '" stroke-width="3.2"/>' +
        '<circle r="44" fill="none" stroke="' + g + '" stroke-width="1.6" opacity=".6"/>' +
        '<text x="0" y="11" text-anchor="middle" font-family="' + HAND.replace(/"/g, "'") + '" font-size="30" font-weight="700" fill="' + g + '">#248</text></g>') +
      smilCheck(1520, 214, '<g filter="url(#dst-sk-w1)"><circle r="48" fill="#e3efe5" stroke="' + g + '" stroke-width="3.2"/>' +
        '<path d="M-24 0l14 18 34-36" fill="none" stroke="#2f7d55" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>') +
      '<path d="M74 166c120 8 260 4 400-6" ' + IK + ' filter="url(#dst-sk-w1)"/>' +
      '</svg>' + (lbl(330, 620, 'middle', 54, '700|' + HAND, g, 'neo'), lbl(1380, 620, 'middle', 54, '700|' + HAND, g, 'joey'),
        lbl(70, 140, 'start', 76, '700|' + HAND, g, 'sketchbook'), flushLbl());
  }

  function isoSvg() {
    var OX = 860, OY = 150;
    function P(x, y, z) { return [OX + (x - y) * 0.8660254, OY + (x + y) * 0.5 - z]; }
    function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
    function box(x, y, z, w, d, h, top, left, right, extra) {
      var T = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
      var L = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
      var R = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
      var sk = ' stroke="rgba(255,255,255,.22)" stroke-width="1.5" stroke-linejoin="round"';
      return '<polygon points="' + pts(L) + '" fill="' + left + '"' + sk + '/>' +
        '<polygon points="' + pts(R) + '" fill="' + right + '"' + sk + '/>' +
        '<polygon points="' + pts(T) + '" fill="' + top + '"' + sk + (extra || '') + '/>';
    }
    function plate(x, y, w, d, col) {
      var T = [P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)];
      return '<polygon points="' + pts(T) + '" fill="' + col + '" fill-opacity=".12" stroke="' + col + '" stroke-width="2.5" stroke-opacity=".7"/>';
    }
    /* neo laptop around world (0..150, 520..630) */
    var neo = plate(-40, 480, 250, 200, '#22d3ee') +
      box(0, 540, 0, 160, 110, 12, '#5eead4', '#0e7490', '#155e75') +
      box(0, 540, 12, 160, 10, 104, '#67e8f9', '#0891b2', '#164e63');
    /* screen glow face on the laptop lid (front face y = 550) */
    var lid = [P(10, 550, 22), P(150, 550, 22), P(150, 550, 108), P(10, 550, 108)];
    neo += '<polygon points="' + pts(lid) + '" fill="#a5f3fc" fill-opacity=".85"/>';
    /* joey workstation around world (430..640, -80..60) */
    var joey = plate(370, -160, 330, 280, '#c084fc') +
      box(600, -140, 0, 64, 110, 150, '#d8b4fe', '#7e22ce', '#581c87') +
      box(470, -62, 0, 26, 22, 62, '#c4b5fd', '#6d28d9', '#4c1d95') +
      box(400, -50, 62, 170, 12, 118, '#e9d5ff', '#7c3aed', '#5b21b6');
    var scr = [P(410, -38, 72), P(560, -38, 72), P(560, -38, 170), P(410, -38, 170)];
    joey += '<polygon points="' + pts(scr) + '" fill="#f5d0fe" fill-opacity=".92"/>' +
      '<path d="' + 'M' + P(425, -38, 150).join(' ') + ' L' + P(520, -38, 150).join(' ') + ' M' + P(425, -38, 128).join(' ') + ' L' + P(545, -38, 128).join(' ') +
      ' M' + P(425, -38, 106).join(' ') + ' L' + P(500, -38, 106).join(' ') + '" stroke="#7c3aed" stroke-width="5" stroke-linecap="round" opacity=".55"/>' +
      box(420, -8, 0, 130, 44, 7, '#ede9fe', '#8b5cf6', '#6d28d9');
    var a = P(80, 550, 120), b = P(485, -44, 182);
    var path = 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' Q' + ((a[0] + b[0]) / 2).toFixed(1) + ' ' + (Math.min(a[1], b[1]) - 230).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    var chk = P(560, -44, 214);
    var lblN = P(210, 680, 0), lblJ = P(700, 120, 0);
    lblN[1] += 66; lblJ[1] += 66;
    var tok = '<g opacity="0">' +
      '<animateMotion dur="4s" repeatCount="indefinite" path="' + path + '" keyPoints="0;0;1;1" keyTimes="0;.12;.62;1" calcMode="spline" keySplines="0 0 1 1;.6 0 .35 1;0 0 1 1"/>' +
      '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;.08;.6;.66;1"/>' +
      '<circle r="54" fill="url(#dst-iso-glow)"/><circle r="22" fill="#e0f7fe"/>' +
      '<text x="0" y="-38" text-anchor="middle" font-family="' + MONO.replace(/"/g, "'") + '" font-size="30" font-weight="800" fill="#a5f3fc">#248</text></g>';
    return '<svg viewBox="0 0 1700 730" aria-hidden="true"><defs>' +
      '<pattern id="dst-iso-grid" width="69.282" height="40" patternUnits="userSpaceOnUse" x="' + OX + '" y="' + OY + '">' +
      '<path d="M0 0L69.282 40M0 40L69.282 0" stroke="#22d3ee" stroke-opacity=".13" stroke-width="1.4"/></pattern>' +
      '<radialGradient id="dst-iso-glow"><stop offset="0" stop-color="#22d3ee" stop-opacity=".9"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="dst-iso-bg" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#14204a"/><stop offset="1" stop-color="#080d1f"/></radialGradient>' +
      '</defs>' +
      '<rect width="1700" height="730" fill="url(#dst-iso-bg)"/><rect width="1700" height="730" fill="url(#dst-iso-grid)"/>' +
      neo + joey +
      '<path d="' + path + '" fill="none" stroke="#67e8f9" stroke-width="3" stroke-dasharray="4 12" stroke-linecap="round" opacity=".7"/>' +
      smilRipple(chk[0], chk[1] + 10, '#34d399', 4) +
      tok +
      smilCheck(chk[0], chk[1] - 30, '<circle r="46" fill="#10b981"/><path d="M-20 2l13 14 28-30" fill="none" stroke="#03150e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>') +
      '<g transform="translate(70 70)"><polygon points="30,0 60,17 30,34 0,17" fill="#67e8f9"/><polygon points="0,17 30,34 30,70 0,53" fill="#0891b2"/>' +
      '<polygon points="60,17 30,34 30,70 60,53" fill="#155e75"/></g>' +
      '</svg>' + (lbl(lblN[0], lblN[1], 'middle', 50, '800|' + MONO, '#67e8f9', 'neo'), lbl(lblJ[0], lblJ[1], 'middle', 50, '800|' + MONO, '#d8b4fe', 'joey'),
        lbl(156, 132, 'start', 70, '800|' + MONO, '#e0f7fe', 'isometric'), flushLbl());
  }

  function stylesHtml() {
    return '' +
      '<div class="dst-sty-layer dst-sty-l0" data-sty="0"' + at(0, 100, ' data-at="4" data-cls="grid" data-cd="0"') + '>' + cutPaperSvg() + '</div>' +
      '<div class="dst-sty-layer dst-sty-l1" data-sty="1"' + at(1, 0, ' data-at="4" data-cls="grid" data-cd="120"') + '>' + crosshatchSvg() + '</div>' +
      '<div class="dst-sty-layer dst-sty-l2" data-sty="2"' + at(2, 0, ' data-at="4" data-cls="grid" data-cd="240"') + '><div class="dst-sty-paper"></div>' + sketchSvg() + '</div>' +
      '<div class="dst-sty-layer dst-sty-l3" data-sty="3"' + at(3, 0, ' data-at="4" data-cls="grid" data-cd="360"') + '>' + isoSvg() + '</div>' +
      '<div class="dst-sty-nib" data-nib="1"></div>';
  }

  var styles = makeScene({
    name: 'styles',
    label: 'One scene, any style: the same story of neo sending a message to joey drawn as cut paper, crosshatch, sketchbook and isometric, then all four side by side.',
    credit: CREDIT_A,
    captions: [
      'Cut paper: flat shapes, paper colors, soft shadows.',
      'Crosshatch: the same story, drawn in ink.',
      'Sketchbook: graphite on paper, every line a little unsteady.',
      'Isometric: the two machines as blocks on a grid.',
      'Same story, new skin. Point at a reference and the style follows.'
    ],
    html: stylesHtml,
    init: function (inner) {
      return {
        svgs: Array.prototype.slice.call(inner.querySelectorAll('.dst-sty-layer > svg')),
        nib: inner.querySelector('[data-nib]')
      };
    },
    enter: function (i, mode, fx, refs) {
      refs.nib.style.opacity = '0';
      if (i === 1 && mode === 'fwd') {
        fx.anim(refs.nib, [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: 'translateX(1700px)', opacity: 1, offset: 0.94 },
          { transform: 'translateX(1700px)', opacity: 0 }
        ], { duration: 1200, easing: EASE, fill: 'forwards' });
      }
      if (fx.rm) {
        refs.svgs.forEach(function (s) { try { s.pauseAnimations(); s.setCurrentTime(2.9); } catch (e) { /* ignore */ } });
      }
    },
    onLive: function (live, refs) {
      if (!refs || !refs.svgs) return;
      refs.svgs.forEach(function (s) {
        try {
          if (live && !reducedMotion()) s.unpauseAnimations();
          else s.pauseAnimations();
        } catch (e) { /* ignore */ }
      });
    }
  });

  /* ================================================================ 5. motion */

  var MO_TILES = [
    { v: 20, f: function (n) { return fmt(n); }, l: 'days', c: '#67e8f9' },
    { v: 1591, f: function (n) { return fmt(n); }, l: 'commits', c: '#c4b5fd' },
    { v: 207, f: function (n) { return fmt(n); }, l: 'merged pull requests', c: '#6ee7b7' },
    { v: 80, f: function (n) { return fmt(n) + '%'; }, l: 'of commits by agent sessions', c: '#fcd34d' }
  ];
  /* chart geometry: bar for 132 spans 1100px; hero starts on that bar */
  var MO_BAR_X = 60 + 32 + 250, MO_FULL = 1100;

  function motionHtml() {
    var tiles = '';
    MO_TILES.forEach(function (T, k) {
      tiles += '<div class="dst-mo-tile dst-mo-out" style="left:' + (60 + k * 426) + 'px"' + at(0, 150 + k * 140, ' data-off="1" data-od="' + (k * 90) + '"') + '>' +
        '<b style="color:' + T.c + '">' + (k === 3 ? '<small class="dst-mo-pre">about</small>' : '') + '<span data-tile="' + k + '">' + T.f(T.v) + '</span></b><span>' + T.l + '</span></div>';
    });
    var w75 = Math.round(MO_FULL * 75 / 132);
    var chart = '<div class="dst-mo-chart dst-fade"' + at(0, 500, ' data-off="1" data-od="300"') + '>' +
      '<h4>merged pull requests<small>MeshyChat, first 20 days</small></h4>' +
      '<div class="dst-mo-row" style="top:108px"><label>days 1 to 13</label>' +
        '<div class="dst-mo-bar dst-grow" style="width:' + w75 + 'px;background:linear-gradient(90deg,#475569,#94a3b8)"' + at(0, 700) + '><em style="color:#cbd5e1">75</em></div></div>' +
      '<div class="dst-mo-row" style="top:232px"><label>last 7 days</label>' +
        '<div class="dst-mo-bar dst-grow" style="width:' + MO_FULL + 'px;background:linear-gradient(90deg,#06b6d4,#a855f7);box-shadow:0 0 30px rgba(6,182,212,.35)"' + at(0, 900) + '><em style="color:#67e8f9">132</em></div></div>' +
      '</div>';
    var hero = '<div class="dst-mo-hero"' + at(1, 450) + '>' +
      '<div class="dst-mo-big dst-fade" data-big="1"' + at(1, 1100) + '>132</div>' +
      '<div class="dst-mo-bigline dst-fade"' + at(1, 1500) + '>merged in the last 7 days</div>' +
      '<div class="dst-mo-bigsub dst-fade"' + at(1, 1800) + '>last 7 days</div>' +
      '<div class="dst-mo-tl dst-fade" data-at="2" data-cls="moved" data-cd="2200"' + at(2, 0) + '>' +
        '<div class="dst-mo-play"></div>' +
        '<div class="dst-mo-track"><div class="dst-mo-trackfill"></div>' +
          '<div class="dst-mo-head2"></div>' +
          '<div class="dst-mo-pin dst-pop" style="left:25%;background:#fbbf24;color:#1c1203"' + at(2, 400) + '><span>A</span></div>' +
          '<div class="dst-mo-pin dst-pop" style="left:50%;background:#22d3ee;color:#03141a"' + at(2, 2000) + '><span>AI</span></div>' +
        '</div>' +
        '<div class="dst-mo-time dst-mono">0:08</div>' +
      '</div>' +
      '<div class="dst-mo-thread dst-fade"' + at(2, 700) + '>' +
        '<h5>comments on this video</h5>' +
        '<div class="dst-mo-cm"><div class="dst-mo-av" style="background:#fbbf24;color:#1c1203">A</div><p><b>Andrew, at 0:02</b>can the 132 land on the beat?</p></div>' +
        '<div class="dst-mo-cm dst-fade"' + at(2, 1800) + '><div class="dst-mo-av" style="background:#22d3ee;color:#03141a">AI</div><p><b>Agent</b>moved it to 0:04,<br>and slowed the count-up</p></div>' +
      '</div>' +
      '<div class="dst-mo-export dst-pop"' + at(3, 200) + '><svg viewBox="0 0 24 24" fill="none" stroke="#04121a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="9" width="12" height="12" rx="2"/><path d="M12 3h9v9M21 3l-9 9"/></svg>export to design tools</div>' +
      '</div>';
    return '<div class="dst-mo-head dst-fade"' + at(0, 0, ' data-off="1"') + '>MeshyChat dashboard<small>the first 20 days</small></div>' +
      '<div class="dst-mo-illus">illustration of the technique</div>' +
      tiles + chart + hero;
  }

  var motion = makeScene({
    name: 'motion',
    label: 'From dashboard to story: a MeshyChat dashboard of the first 20 days turns into an animated narrative about 132 merged pull requests in the last 7 days, steered by comments on the timeline.',
    credit: CREDIT_B,
    captions: [
      'A dashboard: MeshyChat\'s first 20 days in four numbers and one chart.',
      'Motion turns the number that matters into the story.',
      'A comment pinned at 0:02 asks for a change; the agent moves the beat to 0:04.',
      'Dashboards become stories, and the team steers them with comments.'
    ],
    html: motionHtml,
    init: function (inner) {
      return {
        tiles: Array.prototype.slice.call(inner.querySelectorAll('[data-tile]')),
        big: inner.querySelector('[data-big]')
      };
    },
    enter: function (i, mode, fx, refs) {
      if (i === 0) {
        refs.tiles.forEach(function (el, k) {
          var T = MO_TILES[k];
          if (mode === 'intro') fx.count(el, 0, T.v, 1100, 250 + k * 140, T.f);
          else el.textContent = T.f(T.v);
        });
      }
      if (i === 1) {
        if (mode === 'fwd') fx.count(refs.big, 0, 132, 1300, 1100);
        else refs.big.textContent = '132';
      }
      if (i === 2) {
        if (mode === 'fwd') fx.count(refs.big, 0, 132, 2200, 2300);
        else refs.big.textContent = '132';
      }
      if (i === 3) refs.big.textContent = '132';
    }
  });

  window.Distilled = window.Distilled || {};
  window.Distilled.frameT = frameT;
  window.Distilled.storyboard = storyboard;
  window.Distilled.loop = loop;
  window.Distilled.styles = styles;
  window.Distilled.motion = motion;
})();
