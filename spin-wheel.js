/* ============================================================
   Canon Moment Photography — Spin & Win lead-capture wheel
   Self-contained: injects its own CSS + markup. No dependencies.

   Usage (one line per page):
     <script src="/spin-wheel.js" defer data-city="Orlando" data-lang="en"></script>

   Behaviour
     • Shows once per browsing session until the visitor submits.
     • Once a prize is claimed (email submitted) it never shows again.
     • Dismissing without submitting keeps it eligible for next visit.
   ============================================================ */
(function () {
  'use strict';

  var SCRIPT = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var LANG = (SCRIPT && SCRIPT.getAttribute('data-lang')) ||
             (document.documentElement.lang || 'en').slice(0, 2);
  if (LANG !== 'es') LANG = 'en';
  var CITY = (SCRIPT && SCRIPT.getAttribute('data-city')) || '';

  var KEY_WON  = 'cm-spin-won';    // localStorage — permanent, set only on submit
  var KEY_SEEN = 'cm-spin-seen';   // sessionStorage — per browsing session

  var WEB3FORMS_KEY = '226c6cf8-a728-46e6-81a1-8cd4d7d286eb';
  var WORKER_URL = 'https://canon-moment-worker.johnrg07.workers.dev';

  /* ---------- prizes ----------
     w  = relative weight (need not total 100)
     en / es = full name shown when they win
     sh / shEs = SHORT label printed on the wheel face. Keep these under
     ~10 characters: they are set radially and will overflow the rim if
     they get long. */
  var PRIZES = [
    { id: 'print',    w: 20, en: 'Free 8×10 Print',        es: 'Impresión 8×10 Gratis',      sh: '8×10 PRINT', shEs: 'IMPRESIÓN' },
    { id: 'toast',    w: 18, en: 'Free Champagne Toast',   es: 'Brindis de Champán Gratis',  sh: 'CHAMPAGNE',  shEs: 'CHAMPÁN' },
    { id: 'digital',  w: 16, en: 'Free Digital Image',     es: 'Imagen Digital Gratis',      sh: 'DIGITAL',    shEs: 'DIGITAL' },
    { id: 'time',     w: 14, en: 'Extra 15 Minutes Free',  es: '15 Minutos Extra Gratis',    sh: '+15 MIN',    shEs: '+15 MIN' },
    { id: 'ten',      w: 14, en: '10% Off Any Booking',    es: '10% de Descuento',           sh: '10% OFF',    shEs: '10% DESC.' },
    { id: 'scouting', w: 6,  en: 'Free Location Scouting', es: 'Exploración de Lugar Gratis',sh: 'SCOUTING',   shEs: 'SCOUTING' },
    { id: 'fifty',    w: 6,  en: '$50 Off a Wedding',      es: '$50 de Descuento en Boda',   sh: '$50 OFF',    shEs: '$50 DESC.' },
    { id: 'guide',    w: 6,  en: 'Free Location Guide',    es: 'Guía de Lugares Gratis',     sh: 'GUIDE',      shEs: 'GUÍA' }
  ];

  var T = {
    en: {
      tag: 'One spin per guest',
      title: 'Spin &amp; Win',
      titleEm: 'Your Session Perk',
      desc: 'Every spin wins something — a free print, a champagne toast, session credit and more. Enter your email and give the wheel a turn.',
      guide: 'Every winner also gets our free Location Guide — 68 proposal and photo spots across Florida and beyond.',
      email: 'Your email address',
      name: 'First name (optional)',
      spin: 'Spin the Wheel →',
      spinning: 'Spinning…',
      invalid: 'Please enter a valid email address.',
      wonPre: 'You won',
      code: 'Your code',
      redeem: 'Mention this code when you book — valid for 90 days. We\'ve emailed a copy to you.',
      viewGuide: 'Open your free Location Guide →',
      book: 'Book Your Session →',
      close: 'Close',
      later: 'No thanks',
      sound: 'Sound on / off'
    },
    es: {
      tag: 'Un giro por invitado',
      title: 'Gira y Gana',
      titleEm: 'Tu Beneficio de Sesión',
      desc: 'Cada giro gana algo — una impresión gratis, un brindis de champán, crédito de sesión y más. Ingresa tu correo y gira la rueda.',
      guide: 'Todos los ganadores reciben además nuestra Guía de Lugares gratuita — 68 sitios para propuestas y fotos en Florida y más allá.',
      email: 'Tu correo electrónico',
      name: 'Nombre (opcional)',
      spin: 'Girar la Rueda →',
      spinning: 'Girando…',
      invalid: 'Por favor ingresa un correo válido.',
      wonPre: 'Ganaste',
      code: 'Tu código',
      redeem: 'Menciona este código al reservar — válido por 90 días. Te enviamos una copia por correo.',
      viewGuide: 'Abre tu Guía de Lugares gratis →',
      book: 'Reserva tu Sesión →',
      close: 'Cerrar',
      later: 'No, gracias',
      sound: 'Sonido'
    }
  }[LANG];

  var GUIDE_URL = LANG === 'es' ? '/photo-locations-es' : '/photo-locations';
  var BOOK_URL = '/contact';

  /* ---------- eligibility ---------- */
  function store(kind) {
    try { return kind === 's' ? window.sessionStorage : window.localStorage; }
    catch (e) { return null; }
  }
  function alreadyWon() {
    var ls = store('l');
    try { return !!(ls && ls.getItem(KEY_WON)); } catch (e) { return false; }
  }
  function seenThisSession() {
    var ss = store('s');
    try { return !!(ss && ss.getItem(KEY_SEEN)); } catch (e) { return false; }
  }
  function markSeen() {
    var ss = store('s');
    try { if (ss) ss.setItem(KEY_SEEN, '1'); } catch (e) {}
  }
  function markWon(prizeId, code) {
    var ls = store('l');
    try {
      if (ls) ls.setItem(KEY_WON, JSON.stringify({ prize: prizeId, code: code, at: Date.now() }));
    } catch (e) {}
  }

  // Preview/QA hatch: add ?spin=1 to any URL to force the wheel open,
  // ignoring the "already seen / already won" rules.
  var FORCE = /[?&]spin=1\b/.test(location.search);

  if (!FORCE) {
    if (alreadyWon()) return;         // claimed already — never show again
    if (seenThisSession()) return;    // already shown this session
  }

  /* ---------- styles ---------- */
  var CSS = '' +
  '.cmw-ov{position:fixed;inset:0;z-index:100000;background:rgba(10,10,10,.82);backdrop-filter:blur(6px);' +
  'display:none;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .35s ease}' +
  '.cmw-ov.on{display:flex}.cmw-ov.vis{opacity:1}' +
  '.cmw-box{position:relative;width:100%;max-width:880px;max-height:94vh;overflow-y:auto;background:#1C1C1C;' +
  'border:.5px solid rgba(201,169,110,.45);display:grid;grid-template-columns:1fr 1fr;' +
  'font-family:"Jost",system-ui,sans-serif;color:#FDFCFA;transform:translateY(14px) scale(.985);transition:transform .35s cubic-bezier(.25,.46,.45,.94)}' +
  '.cmw-ov.vis .cmw-box{transform:none}' +
  '.cmw-x{position:absolute;top:12px;right:14px;z-index:3;background:none;border:none;color:#8d8d8d;font-size:24px;' +
  'line-height:1;cursor:pointer;padding:6px;transition:color .2s}.cmw-x:hover{color:#C9A96E}' +
  '.cmw-l{padding:38px 34px;display:flex;flex-direction:column;justify-content:center;gap:14px;min-width:0}' +
  '.cmw-tag{font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:#C9A96E}' +
  '.cmw-t{font-family:"Cormorant Garamond",Georgia,serif;font-size:clamp(28px,4vw,40px);font-weight:300;line-height:1.06}' +
  '.cmw-t em{display:block;font-style:italic;color:#C9A96E}' +
  '.cmw-d{font-size:13px;line-height:1.65;color:#B8B8B8}' +
  '.cmw-note{font-size:11.5px;line-height:1.6;color:#8d8d8d;border-left:2px solid rgba(201,169,110,.5);padding-left:12px}' +
  '.cmw-f{display:flex;flex-direction:column;gap:9px;margin-top:4px}' +
  '.cmw-f input{width:100%;background:transparent;border:.5px solid rgba(201,169,110,.4);color:#FDFCFA;padding:12px 13px;' +
  'font-family:inherit;font-size:14px;outline:none;border-radius:0;transition:border-color .2s}' +
  '.cmw-f input:focus{border-color:#C9A96E}.cmw-f input::placeholder{color:#7a7a7a}' +
  '.cmw-go{width:100%;background:#C9A96E;border:none;color:#1C1C1C;font-family:inherit;font-size:11px;letter-spacing:.2em;' +
  'text-transform:uppercase;padding:14px;cursor:pointer;font-weight:500;transition:background .25s}' +
  '.cmw-go:hover:not(:disabled){background:#9B7A3F}.cmw-go:disabled{opacity:.55;cursor:default}' +
  '.cmw-err{font-size:11.5px;color:#E74C3C;min-height:14px}' +
  '.cmw-later{background:none;border:none;color:#6B6B6B;font-family:inherit;font-size:10.5px;letter-spacing:.12em;' +
  'text-transform:uppercase;cursor:pointer;padding:4px 0;text-align:left;transition:color .2s}.cmw-later:hover{color:#B8B8B8}' +
  '.cmw-r{position:relative;background:#161616;border-left:.5px solid rgba(201,169,110,.18);' +
  'display:flex;align-items:center;justify-content:center;padding:30px 24px;min-width:0}' +
  '.cmw-stage{position:relative;width:min(320px,100%);aspect-ratio:1/1;flex:0 0 auto}' +
  '.cmw-ptr{position:absolute;top:-2px;left:50%;transform:translateX(-50%);z-index:4;width:0;height:0;' +
  'border-left:11px solid transparent;border-right:11px solid transparent;border-top:20px solid #C9A96E;' +
  'filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}' +
  '.cmw-wheel{width:100%;height:100%;transform:rotate(0deg);transition:transform 5s cubic-bezier(.17,.67,.16,1)}' +
  '.cmw-hub{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;' +
  'background:#1C1C1C;border:1px solid #C9A96E;display:flex;align-items:center;justify-content:center;z-index:3;' +
  'font-family:"Cormorant Garamond",Georgia,serif;font-size:19px;color:#C9A96E;pointer-events:none}' +
  '.cmw-win{display:none;flex-direction:column;gap:13px;text-align:center;padding:8px 0}' +
  '.cmw-win.on{display:flex}' +
  '.cmw-wpre{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8d8d8d}' +
  '.cmw-wname{font-family:"Cormorant Garamond",Georgia,serif;font-size:clamp(26px,3.6vw,36px);font-weight:400;color:#C9A96E;line-height:1.15}' +
  '.cmw-codewrap{border:.5px dashed rgba(201,169,110,.55);padding:12px}' +
  '.cmw-codelbl{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#8d8d8d;margin-bottom:5px}' +
  '.cmw-code{font-family:"Jost",monospace;font-size:19px;letter-spacing:.16em;color:#FDFCFA}' +
  '.cmw-redeem{font-size:11.5px;color:#8d8d8d;line-height:1.6}' +
  '.cmw-links{display:flex;flex-direction:column;gap:8px;margin-top:2px}' +
  '.cmw-links a{font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:12px;text-decoration:none;transition:all .25s}' +
  '.cmw-links a.p{background:#C9A96E;color:#1C1C1C;font-weight:500}.cmw-links a.p:hover{background:#9B7A3F}' +
  '.cmw-links a.s{border:.5px solid rgba(201,169,110,.45);color:#C9A96E}.cmw-links a.s:hover{border-color:#C9A96E;background:rgba(201,169,110,.08)}' +
  '.cmw-snd{position:absolute;top:12px;left:14px;z-index:4;width:34px;height:34px;border-radius:50%;' +
  'background:rgba(28,28,28,.72);border:.5px solid rgba(201,169,110,.45);cursor:pointer;display:flex;' +
  'align-items:center;justify-content:center;padding:0;transition:all .25s}' +
  '.cmw-snd:hover{background:rgba(201,169,110,.16);border-color:#C9A96E}' +
  '.cmw-snd svg{width:16px;height:16px;stroke:#C9A96E;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
  '.cmw-snd .off{display:none}.cmw-snd.muted .on{display:none}.cmw-snd.muted .off{display:block}' +
  '.cmw-snd.muted svg{stroke:#6B6B6B}' +
  '@media(max-width:900px){.cmw-box{grid-template-columns:1fr;max-width:440px}' +
  '.cmw-r{order:-1;border-left:none;border-bottom:.5px solid rgba(201,169,110,.18);padding:26px 20px 18px}' +
  '.cmw-stage{width:min(260px,68vw)}.cmw-l{padding:24px 22px 28px}}'
  '@media(max-width:600px){.cmw-note{display:none}.cmw-stage{width:min(230px,62vw)}.cmw-l{padding:22px 18px 26px}.cmw-ov{padding:12px}}' +
  '@media(max-height:620px){.cmw-note{display:none}.cmw-stage{width:min(190px,42vh)}.cmw-r{padding:16px}}' +
  '@media(prefers-reduced-motion:reduce){.cmw-wheel{transition-duration:.6s}.cmw-ov,.cmw-box{transition:none}}';

  /* ---------- build wheel SVG ---------- */
  var N = PRIZES.length, SEG = 360 / N;

  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function segPath(i) {
    var s = i * SEG, e = s + SEG, r = 100, c = 100;
    var p1 = polar(c, c, r, s), p2 = polar(c, c, r, e);
    return 'M' + c + ',' + c + ' L' + p1[0].toFixed(2) + ',' + p1[1].toFixed(2) +
           ' A' + r + ',' + r + ' 0 0 1 ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2) + ' Z';
  }
  function label(p) { return LANG === 'es' ? p.shEs : p.sh; }

  /* Text is set RADIALLY (running from the hub out toward the rim) rather
     than tangentially. Tangential text on a 45° segment runs out of arc and
     spills past the rim — which is what made the old labels overflow.
     Radially there is ~66 units of room (hub r=30 to rim r=96), so a
     10-character label at font-size 7 sits comfortably inside. */
  var LABEL_R = 63;       // centre of the label along the radius
  var FONT = 7;

  var svg = '<svg class="cmw-wheel" id="cmw-wheel" viewBox="0 0 200 200" aria-hidden="true">';
  for (var i = 0; i < N; i++) {
    var fill = i % 2 === 0 ? '#241f18' : '#1a1a1a';
    svg += '<path d="' + segPath(i) + '" fill="' + fill + '" stroke="rgba(201,169,110,.35)" stroke-width=".6"/>';
  }
  for (var j = 0; j < N; j++) {
    var mid = j * SEG + SEG / 2;
    var tp = polar(100, 100, LABEL_R, mid);
    // mid-90 makes the baseline run along the radius; flip on the left
    // half so nothing reads upside-down.
    var rot = mid - 90;
    if (mid > 180) rot += 180;
    svg += '<text x="' + tp[0].toFixed(1) + '" y="' + tp[1].toFixed(1) + '" fill="#E8D5B0" ' +
           'font-size="' + FONT + '" font-family="Jost,sans-serif" letter-spacing=".55" ' +
           'text-anchor="middle" dominant-baseline="central" ' +
           'transform="rotate(' + rot.toFixed(1) + ' ' + tp[0].toFixed(1) + ' ' + tp[1].toFixed(1) + ')">' +
           label(PRIZES[j]) + '</text>';
  }
  svg += '<circle cx="100" cy="100" r="99" fill="none" stroke="#C9A96E" stroke-width="1.2"/></svg>';

  /* ---------- markup ---------- */
  var HTML = '' +
  '<div class="cmw-box" role="dialog" aria-modal="true" aria-labelledby="cmw-title">' +
    '<button class="cmw-x" id="cmw-x" aria-label="' + T.close + '">&times;</button>' +
    '<div class="cmw-r">' +
      '<button class="cmw-snd" id="cmw-snd" type="button" aria-label="' + T.sound + '" title="' + T.sound + '">' +
        '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/>' +
        '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>' +
        '<svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/>' +
        '<path d="m17 9 4 6"/><path d="m21 9-4 6"/></svg>' +
      '</button>' +
      '<div class="cmw-stage"><div class="cmw-ptr"></div>' + svg +
      '<div class="cmw-hub">CM</div></div></div>' +
    '<div class="cmw-l">' +
      '<div id="cmw-intro">' +
        '<div class="cmw-tag">' + T.tag + '</div>' +
        '<div class="cmw-t" id="cmw-title">' + T.title + '<em>' + T.titleEm + '</em></div>' +
        '<p class="cmw-d">' + T.desc + '</p>' +
        '<p class="cmw-note">' + T.guide + '</p>' +
        '<form class="cmw-f" id="cmw-form" novalidate>' +
          '<input type="email" id="cmw-email" placeholder="' + T.email + '" autocomplete="email" required>' +
          '<input type="text" id="cmw-name" placeholder="' + T.name + '" autocomplete="given-name">' +
          '<div class="cmw-err" id="cmw-err"></div>' +
          '<button class="cmw-go" id="cmw-go" type="submit">' + T.spin + '</button>' +
        '</form>' +
        '<button class="cmw-later" id="cmw-later" type="button">' + T.later + '</button>' +
      '</div>' +
      '<div class="cmw-win" id="cmw-win">' +
        '<div class="cmw-wpre">' + T.wonPre + '</div>' +
        '<div class="cmw-wname" id="cmw-wname"></div>' +
        '<div class="cmw-codewrap"><div class="cmw-codelbl">' + T.code + '</div>' +
          '<div class="cmw-code" id="cmw-code"></div></div>' +
        '<p class="cmw-redeem">' + T.redeem + '</p>' +
        '<div class="cmw-links">' +
          '<a class="p" href="' + BOOK_URL + '">' + T.book + '</a>' +
          '<a class="s" href="' + GUIDE_URL + '" target="_blank" rel="noopener">' + T.viewGuide + '</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* ---------- mount ---------- */
  var styleEl, ov, opened = false, spun = false;

  function mount() {
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    ov = document.createElement('div');
    ov.className = 'cmw-ov';
    ov.id = 'cmw-ov';
    ov.innerHTML = HTML;
    document.body.appendChild(ov);

    var sb = document.getElementById('cmw-snd');
    if (sb) sb.addEventListener('click', toggleSound);
    paintSound();

    document.getElementById('cmw-x').addEventListener('click', close);
    document.getElementById('cmw-later').addEventListener('click', close);
    document.getElementById('cmw-form').addEventListener('submit', onSubmit);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && opened) close();
    });
  }

  function open() {
    if (opened || (!FORCE && alreadyWon())) return;
    opened = true;
    markSeen();
    ov.classList.add('on');
    // force reflow so the transition runs
    void ov.offsetWidth;
    ov.classList.add('vis');
    document.body.style.overflow = 'hidden';
    var em = document.getElementById('cmw-email');
    if (em && window.innerWidth > 760) { try { em.focus(); } catch (e) {} }
    track('spin_wheel_shown', {});
  }

  function close() {
    if (!opened) return;
    opened = false;
    ov.classList.remove('vis');
    document.body.style.overflow = '';
    setTimeout(function () { ov.classList.remove('on'); }, 350);
  }

  /* ============================================================
     Sound — everything is synthesised with the Web Audio API, so there
     are no audio files to host and nothing to load. The context is only
     created on the first click (browsers block audio before a gesture).
     ============================================================ */
  var KEY_MUTE = 'cm-spin-mute';
  var ctx = null, muted = false;
  try { muted = window.localStorage.getItem(KEY_MUTE) === '1'; } catch (e) {}

  function audio() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    return ctx;
  }

  /* one short shaped tone */
  function tone(freq, at, dur, peak, type) {
    var c = audio(); if (!c || muted) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(c.destination);
      o.start(at); o.stop(at + dur + 0.02);
    } catch (e) {}
  }

  /* the peg-click as a segment passes the pointer */
  function tick(at, strength) {
    tone(1100 + Math.random() * 130, at, 0.035, 0.16 * (strength || 1), 'square');
  }

  /* Match the ticks to the CSS easing so they slow down with the wheel. */
  function bezierY(t, p1x, p1y, p2x, p2y) {
    // sample the cubic-bezier by solving x(u)=t with a few Newton steps
    function bx(u) { return 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u; }
    function by(u) { return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u; }
    var u = t;
    for (var i = 0; i < 6; i++) {
      var x = bx(u) - t;
      var d = (bx(u + 1e-4) - bx(u - 1e-4)) / 2e-4;
      if (Math.abs(d) < 1e-6) break;
      u -= x / d;
      if (u < 0) u = 0; else if (u > 1) u = 1;
    }
    return by(u);
  }

  function playSpin(totalDeg, durationSec) {
    var c = audio(); if (!c || muted) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    var now = c.currentTime;
    var turns = totalDeg / SEG;                 // how many segments pass by
    var last = -1;
    // step through the animation and fire a tick on each segment boundary
    for (var s = 0; s <= 1.0001; s += 0.004) {
      var progressed = bezierY(s, 0.17, 0.67, 0.16, 1) * turns;
      var idx = Math.floor(progressed);
      if (idx !== last) {
        last = idx;
        var when = now + s * durationSec;
        // quieter as it slows, so the ending feels like a settle
        tick(when, 0.55 + 0.45 * (1 - s));
      }
    }
  }

  /* short celebratory flourish on the reveal */
  function playWin() {
    var c = audio(); if (!c || muted) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    var t0 = c.currentTime + 0.04;
    var notes = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
    notes.forEach(function (f, i) { tone(f, t0 + i * 0.11, 0.42, 0.17, 'triangle'); });
    tone(1567.98, t0 + 0.46, 0.7, 0.12, 'sine');    // G6 shimmer
  }

  function paintSound() {
    var b = document.getElementById('cmw-snd');
    if (b) b.className = 'cmw-snd' + (muted ? ' muted' : '');
  }
  function toggleSound() {
    muted = !muted;
    try { window.localStorage.setItem(KEY_MUTE, muted ? '1' : '0'); } catch (e) {}
    paintSound();
    if (!muted) { var c = audio(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } tone(880, (c ? c.currentTime : 0) + 0.01, 0.12, 0.14, 'triangle'); }
  }

  /* ---------- prize selection ---------- */
  function pickPrize() {
    var total = 0, k;
    for (k = 0; k < PRIZES.length; k++) total += PRIZES[k].w;
    var r = Math.random() * total, acc = 0;
    for (k = 0; k < PRIZES.length; k++) {
      acc += PRIZES[k].w;
      if (r <= acc) return k;
    }
    return PRIZES.length - 1;
  }

  function makeCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'CM-' + s;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function track(evt, data) {
    try { if (typeof gtag === 'function') gtag('event', evt, data || {}); } catch (e) {}
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: evt }, data || {}));
    } catch (e) {}
  }

  /* ---------- submit ---------- */
  function onSubmit(e) {
    e.preventDefault();
    if (spun) return;

    var emailEl = document.getElementById('cmw-email');
    var nameEl = document.getElementById('cmw-name');
    var errEl = document.getElementById('cmw-err');
    var btn = document.getElementById('cmw-go');
    var email = (emailEl.value || '').trim();
    var name = (nameEl.value || '').trim();

    if (!validEmail(email)) {
      errEl.textContent = T.invalid;
      try { emailEl.focus(); } catch (e2) {}
      return;
    }
    errEl.textContent = '';
    spun = true;
    btn.disabled = true;
    btn.textContent = T.spinning;

    var idx = pickPrize();
    var prize = PRIZES[idx];
    var code = makeCode();

    send(email, name, prize, code);

    // spin so the chosen segment lands under the top pointer
    var mid = idx * SEG + SEG / 2;
    var jitter = (Math.random() * (SEG * 0.5)) - (SEG * 0.25);
    var deg = (360 * 6) - mid + jitter;
    var wheel = document.getElementById('cmw-wheel');
    wheel.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
    playSpin(deg, 5);

    markWon(prize.id, code);
    track('spin_wheel_win', { prize: prize.id, code: code, city: CITY });
    track('generate_lead', { form_source: 'spin-wheel', currency: 'USD', value: 1 });

    setTimeout(function () { reveal(prize, code); }, 5200);
  }

  function reveal(prize, code) {
    playWin();
    document.getElementById('cmw-intro').style.display = 'none';
    document.getElementById('cmw-wname').textContent = prize[LANG];
    document.getElementById('cmw-code').textContent = code;
    document.getElementById('cmw-win').classList.add('on');
  }

  /* ---------- delivery ---------- */
  function send(email, name, prize, code) {
    var page = location.pathname;
    var when = new Date().toLocaleString();
    var body =
      'New Spin & Win entry.\n\n' +
      'Name:  ' + (name || 'Not provided') + '\n' +
      'Email: ' + email + '\n' +
      'Prize: ' + prize.en + '\n' +
      'Code:  ' + code + '\n' +
      'City:  ' + (CITY || 'n/a') + '\n' +
      'Page:  ' + page + '\n' +
      'Lang:  ' + LANG + '\n' +
      'Time:  ' + when;

    try {
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: 'Spin & Win — ' + prize.en + (CITY ? ' — ' + CITY : ''),
          from_name: 'Canon Moment Website',
          name: name || 'Not provided',
          email: email,
          prize: prize.en,
          code: code,
          city: CITY || 'n/a',
          page: page,
          message: body
        })
      }).catch(function () {});
    } catch (e) {}

    try {
      fetch(WORKER_URL + '/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email, name: name, source: 'spin-wheel',
          prize: prize.en, code: code, city: CITY, page: page,
          timestamp: new Date().toISOString()
        })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- triggers ---------- */
  function arm() {
    mount();

    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      open();
    }

    if (FORCE) { setTimeout(go, 400); return; }   // preview mode: open right away

    setTimeout(go, 35000);                        // dwell

    window.addEventListener('scroll', function onScroll() {
      var h = document.body.scrollHeight - window.innerHeight;
      if (h > 0 && (window.scrollY / h) >= 0.5) {
        window.removeEventListener('scroll', onScroll);
        go();
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function onExit(e) {  // exit intent, desktop
      if (e.clientY <= 0) {
        document.removeEventListener('mouseleave', onExit);
        go();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else {
    arm();
  }
})();
