/* ============================================================
   Canon Moment Photography — location-first package pricing

   Flow on the Packages page
     1. Visitor chooses where their session is, before any prices show.
     2. Choosing a place fades that location's photo into the hero.
     3. "See packages" restores the normal hero and reveals the packages,
        with the travel fee already folded into every price.

   Landing pages record their own city, so someone arriving from the
   Key West page has Key West pre-selected and is one click away from
   correctly-priced packages.

   Travel fee is a flat per-city add-on applied to every tier. Verified
   against the live landing pages (Tampa +$50, Miami +$200, Key West
   +$550, Pensacola +$675) across proposal, wedding, event and corporate.

   NOTE: deliberately no MutationObserver. The package cards are static
   markup; observing them while rewriting their text re-triggers the
   observer and hangs the tab (this caused RESULT_CODE_HUNG in Chrome).
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'cm-loc';
  var KEY_OK = 'cm-loc-ok';

  /* [display name, slug, travel fee] */
  var FL = [["Altamonte Springs","altamonte-springs",0],["Apopka","apopka",0],["Celebration","celebration",0],["Clermont","clermont",0],["Cocoa Beach","cocoa-beach",0],["Davenport","davenport",0],["Daytona Beach","daytona-beach",0],["Deltona","deltona",0],["Kissimmee","kissimmee",0],["Lake Buena Vista","lake-buena-vista",0],["Lake Mary","lake-mary",0],["Leesburg","leesburg",0],["Maitland","maitland",0],["Mount Dora","mount-dora",0],["New Smyrna Beach","new-smyrna-beach",0],["Ocoee","ocoee",0],["Orlando","orlando",0],["Oviedo","oviedo",0],["Sanford","sanford",0],["St. Cloud","st-cloud",0],["Titusville","titusville",0],["Windermere","windermere",0],["Winter Garden","winter-garden",0],["Winter Park","winter-park",0],["St. Augustine","st-augustine",50],["St. Augustine Beach","st-augustine-beach",50],["Tampa","tampa",50],["Vero Beach","vero-beach",50],["Anna Maria Island","anna-maria-island",75],["Clearwater","clearwater",75],["Clearwater Beach","clearwater-beach",75],["Gainesville","gainesville",75],["Sarasota","sarasota",75],["St. Petersburg","st-petersburg",75],["Jacksonville","jacksonville",100],["Siesta Key","siesta-key",100],["Fort Myers","fort-myers",125],["Palm Beach","palm-beach",125],["Sanibel Island","sanibel",125],["West Palm Beach","west-palm-beach",125],["Boca Raton","boca-raton",150],["Naples","naples",150],["Fort Lauderdale","fort-lauderdale",175],["Marco Island","marco-island",175],["Miami","miami",200],["Tallahassee","tallahassee",225],["Key West","key-west",550],["Pensacola","pensacola",675]];
  /* destinations quoted individually */
  var DEST = [["New York","new-york"],["Las Vegas","las-vegas"],["Nashville","nashville"],["Chicago","chicago"],["Napa Valley","napa-valley"],["Paris","paris"],["Santorini","santorini"],["Amalfi Coast","amalfi-coast"],["Punta Cana","punta-cana"],["Cancún","cancun"]];

  /* Location photos shown behind the chooser. Only genuinely-matching
     shots are mapped; anywhere else keeps the default hero. To add more,
     drop the file in /images/venues/ and add one line here. */
  var PHOTO = {
    'orlando': '/images/venues/lake-eola.jpg',
    'winter-park': '/images/venues/kraft-azalea.jpg',
    'lake-buena-vista': '/images/venues/disney-springs.jpg',
    'celebration': '/images/venues/disney-springs.jpg',
    'clearwater': '/images/venues/clearwater-beach.jpg',
    'clearwater-beach': '/images/venues/clearwater-beach.jpg',
    'cocoa-beach': '/images/venues/cocoa-beach.jpg',
    'maitland': '/images/venues/mead-garden.jpg',
    'leesburg': '/images/venues/howey-mansion.jpg',
    'mount-dora': '/images/venues/howey-mansion.jpg',
    'davenport': '/images/venues/bok-tower.jpg',
    'clermont': '/images/venues/bok-tower.jpg'
  };

  function feeOf(s) { for (var i = 0; i < FL.length; i++) if (FL[i][1] === s) return FL[i][2]; return null; }
  function nameOf(s) {
    for (var i = 0; i < FL.length; i++) if (FL[i][1] === s) return FL[i][0];
    for (var j = 0; j < DEST.length; j++) if (DEST[j][1] === s) return DEST[j][0];
    return null;
  }
  function isDest(s) { for (var j = 0; j < DEST.length; j++) if (DEST[j][1] === s) return true; return false; }

  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function get(k) { var s = ss(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { var s = ss(); try { if (s) s.setItem(k, v); } catch (e) {} }

  /* ---------- landing pages: record the city and stop ---------- */
  var SELF = document.currentScript || (function () {
    var t = document.getElementsByTagName('script'); return t[t.length - 1];
  })();
  var pageCity = SELF && SELF.getAttribute('data-city-slug');
  if (pageCity) { set(KEY, pageCity); return; }

  /* ---------- homepage ---------- */
  var money = function (n) { return '$' + n.toLocaleString('en-US'); };
  var $ = function (id) { return document.getElementById(id); };

  function priceEls() {
    return Array.prototype.slice.call(document.querySelectorAll('.package-price'));
  }
  function captureBases() {
    priceEls().forEach(function (el) {
      if (el.getAttribute('data-cm-base')) return;
      var m = (el.textContent || '').trim().match(/\$\s*([\d,]+)/);
      el.setAttribute('data-cm-base', m ? m[1].replace(/,/g, '') : 'custom');
    });
  }
  function lowestBase() {
    var lo = null;
    priceEls().forEach(function (el) {
      var b = el.getAttribute('data-cm-base');
      if (!b || b === 'custom') return;
      var n = parseInt(b, 10);
      if (lo === null || n < lo) lo = n;
    });
    return lo;
  }
  function applyPrices(slug) {
    var fee = feeOf(slug), dest = isDest(slug);
    priceEls().forEach(function (el) {
      var b = el.getAttribute('data-cm-base');
      if (!b || b === 'custom') return;
      el.textContent = money(parseInt(b, 10) + (dest ? 0 : (fee || 0)));
    });
  }

  /* ---------- packages hero photo ---------- */
  var hero = null, heroSrc = null, heroOpacity = null;
  function heroImg() {
    if (hero) return hero;
    var page = $('page-packages-page');
    hero = page ? page.querySelector('img') : null;
    if (hero && heroSrc === null) {
      heroSrc = hero.getAttribute('src');
      heroOpacity = hero.style.opacity || '0.22';
      hero.style.transition = 'opacity .45s ease';
    }
    return hero;
  }
  function showPhoto(slug) {
    var im = heroImg(); if (!im) return;
    var p = PHOTO[slug];
    im.style.opacity = '0';
    setTimeout(function () {
      im.setAttribute('src', p || heroSrc);
      im.style.opacity = p ? '0.5' : '0.3';
    }, 200);
  }
  function restorePhoto() {
    var im = heroImg(); if (!im) return;
    im.style.opacity = '0';
    setTimeout(function () {
      im.setAttribute('src', heroSrc);
      im.style.opacity = heroOpacity;
    }, 200);
  }

  /* ---------- reveal / hide the package body ---------- */
  var SECTIONS = ['proposals', 'weddings', 'setup', 'events', 'corporate', 'family'];
  function subnavRow() { var b = $('pnav-main'); return b ? b.parentNode : null; }
  function hideBody() {
    SECTIONS.forEach(function (s) { var el = $('pkg-section-' + s); if (el) el.style.display = 'none'; });
    var row = subnavRow(); if (row) row.style.display = 'none';
  }
  function showBody() {
    var row = subnavRow(); if (row) row.style.display = 'flex';
    if (typeof window.showPkgSection === 'function') { try { window.showPkgSection('main'); return; } catch (e) {} }
    ['proposals', 'weddings', 'setup'].forEach(function (s) {
      var el = $('pkg-section-' + s); if (el) el.style.display = '';
    });
  }

  var CSS =
  '.cml{margin-top:28px;max-width:820px;font-family:var(--sans,sans-serif)}' +
  '.cml-gate{border:.5px solid rgba(201,169,110,.4);background:rgba(18,18,18,.74);padding:26px 26px 24px}' +
  '.cml-k{font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold,#C9A96E);display:block;margin-bottom:10px}' +
  '.cml-h{font-family:var(--serif,Georgia,serif);font-size:clamp(24px,3vw,34px);font-weight:300;color:#FDFCFA;line-height:1.12;margin-bottom:10px}' +
  '.cml-h em{font-style:italic;color:var(--gold,#C9A96E)}' +
  '.cml-p{font-size:13px;line-height:1.65;color:rgba(255,255,255,.6);margin-bottom:18px;max-width:560px}' +
  '.cml-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:stretch}' +
  '.cml-sel{flex:1 1 240px;min-width:200px;background:rgba(16,16,16,.95);color:#FDFCFA;border:.5px solid rgba(201,169,110,.45);' +
  'padding:13px 14px;font-family:inherit;font-size:14px;border-radius:0;outline:none;cursor:pointer}' +
  '.cml-sel:focus{border-color:#C9A96E}' +
  '.cml-sel optgroup{background:#1C1C1C;color:#C9A96E;font-style:normal}' +
  '.cml-sel option{background:#1C1C1C;color:#FDFCFA}' +
  '.cml-go{flex:0 0 auto;background:var(--gold,#C9A96E);color:#1C1C1C;border:none;font-family:inherit;font-size:11px;' +
  'letter-spacing:.2em;text-transform:uppercase;padding:13px 26px;font-weight:500;cursor:pointer;transition:background .25s}' +
  '.cml-go:hover:not(:disabled){background:#9B7A3F}.cml-go:disabled{opacity:.4;cursor:default}' +
  '.cml-pre{margin-top:14px;font-size:13px;line-height:1.6;color:rgba(255,255,255,.72);min-height:20px}' +
  '.cml-pre strong{color:#E8D5B0;font-weight:500}' +
  '.cml-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:.5px solid rgba(201,169,110,.32);' +
  'background:rgba(201,169,110,.06);padding:14px 18px}' +
  '.cml-bar .t{flex:1 1 auto;font-size:12.5px;line-height:1.6;color:rgba(255,255,255,.66);min-width:220px}' +
  '.cml-bar .t strong{color:#E8D5B0;font-weight:500}' +
  '.cml-chg{background:none;border:.5px solid rgba(201,169,110,.5);color:var(--gold,#C9A96E);font-family:inherit;' +
  'font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px;cursor:pointer;transition:all .25s}' +
  '.cml-chg:hover{background:var(--gold,#C9A96E);color:#1C1C1C}' +
  /* The packages hero carries an inline padding:160px 80px, which leaves
     barely 230px of usable width on a phone. Inline styles need !important
     to override, and this hosts the location chooser. */
  '@media(max-width:900px){#page-packages-page>div:first-child{padding:120px 28px 56px!important}.cml{margin-top:22px}}' +
  '@media(max-width:600px){#page-packages-page>div:first-child{padding:100px 18px 40px!important}.cml-gate{padding:20px 16px}.cml-go{width:100%}.cml-sel{min-width:0;flex:1 1 100%}.cml-h{font-size:23px}.cml-bar{padding:13px 15px}.cml-chg{width:100%;text-align:center}}' +
  '@media(max-width:380px){#page-packages-page>div:first-child{padding:92px 13px 34px!important}}';

  function options() {
    var o = '<option value="" disabled selected>Select a location…</option><optgroup label="Florida">';
    FL.forEach(function (c) { o += '<option value="' + c[1] + '">' + c[0] + '</option>'; });
    o += '</optgroup><optgroup label="Destination">';
    DEST.forEach(function (d) { o += '<option value="' + d[1] + '">' + d[0] + '</option>'; });
    return o + '</optgroup>';
  }

  function preview(slug) {
    var el = $('cml-pre'); if (!el) return;
    if (!slug) { el.innerHTML = ''; return; }
    var nm = nameOf(slug), fee = feeOf(slug), lo = lowestBase() || 375;
    if (isDest(slug)) {
      el.innerHTML = '<strong>' + nm + '</strong> &mdash; destination session. Travel is quoted per trip; coverage starts at ' + money(lo) + '.';
    } else if (!fee) {
      el.innerHTML = '<strong>' + nm + '</strong> &mdash; inside our Orlando service area, so <strong>no travel fee</strong>. Packages from ' + money(lo) + '.';
    } else {
      el.innerHTML = '<strong>' + nm + '</strong> &mdash; includes a <strong>' + money(fee) + ' travel fee</strong> from our Orlando studio. Packages from ' + money(lo + fee) + '.';
    }
  }

  function barHTML(slug) {
    var nm = nameOf(slug) || 'Orlando', fee = feeOf(slug), t;
    if (isDest(slug)) {
      t = 'Showing <strong>' + nm + '</strong> &mdash; destination travel is quoted per trip. ' +
          '<a href="/contact" style="color:var(--gold,#C9A96E);text-decoration:underline;">Request a quote</a>.';
    } else if (!fee) {
      t = 'Showing <strong>' + nm + '</strong> pricing &mdash; no travel fee inside the Orlando area.';
    } else {
      t = 'Showing <strong>' + nm + '</strong> pricing &mdash; every price below already includes the <strong>' +
          money(fee) + ' travel fee</strong> from our Orlando studio. Coverage, editing and delivery are identical everywhere.';
    }
    return '<div class="cml-bar"><div class="t">' + t + '</div>' +
           '<button type="button" class="cml-chg" id="cml-change">Change location</button></div>';
  }

  var mount;

  function renderGate(pre) {
    mount.innerHTML =
      '<div class="cml"><div class="cml-gate">' +
        '<span class="cml-k">Step 1 of 2</span>' +
        '<div class="cml-h">Where is your <em>session?</em></div>' +
        '<p class="cml-p">Coverage is the same everywhere we shoot &mdash; the only variable is travel from our Orlando studio. ' +
        'Tell us where you are and the packages will show your real price, not an estimate.</p>' +
        '<div class="cml-ctl">' +
          '<select class="cml-sel" id="cml-sel" aria-label="Choose your session location">' + options() + '</select>' +
          '<button class="cml-go" id="cml-go" type="button" disabled>See packages &rarr;</button>' +
        '</div>' +
        '<div class="cml-pre" id="cml-pre"></div>' +
      '</div></div>';

    var sel = $('cml-sel'), go = $('cml-go');
    sel.addEventListener('change', function () {
      go.disabled = !this.value;
      preview(this.value);
      showPhoto(this.value);
      if (this.value) set(KEY, this.value);
    });
    go.addEventListener('click', function () { if (sel.value) commit(sel.value); });

    if (pre) {
      sel.value = pre;
      if (sel.value === pre) { go.disabled = false; preview(pre); showPhoto(pre); }
    }
    hideBody();
  }

  function renderBar(slug) {
    mount.innerHTML = '<div class="cml">' + barHTML(slug) + '</div>';
    var b = $('cml-change');
    if (b) b.addEventListener('click', function () {
      set(KEY_OK, '');
      renderGate(get(KEY) || null);
      try { mount.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    });
  }

  function commit(slug) {
    set(KEY, slug);
    set(KEY_OK, '1');
    applyPrices(slug);
    restorePhoto();
    showBody();
    renderBar(slug);
    try { if (typeof gtag === 'function') gtag('event', 'pricing_location_selected', { location: slug }); } catch (e) {}
  }

  function init() {
    mount = $('cm-loc-mount');
    if (!mount || mount.getAttribute('data-ready')) return;
    mount.setAttribute('data-ready', '1');

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    captureBases();
    heroImg();

    var chosen = get(KEY);
    if (get(KEY_OK) === '1' && chosen && nameOf(chosen)) {
      applyPrices(chosen);
      renderBar(chosen);
      showBody();
    } else {
      renderGate(chosen && nameOf(chosen) ? chosen : null);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
