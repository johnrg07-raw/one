/* ============================================================
   Canon Moment Photography — location-aware package pricing

   Problem it solves: visitors arrive on a city landing page (say Key West,
   from $925), click through to the homepage Packages section, and see the
   Orlando base price ($375) with no explanation of the difference.

   How it works
     • Every landing page records its city + travel fee in sessionStorage.
     • The Packages section reads that and pre-selects the visitor's city,
       adds the travel fee to every tier, and says so in plain language.
     • A picker lets anyone switch location; prices update live.

   Travel fee is a flat add-on per city, applied to every package tier.
   Verified against the live landing pages (Tampa +$50, Miami +$200,
   Key West +$550, Pensacola +$675) across proposal, wedding, event
   and corporate packages.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'cm-loc';
  var BASE_CITY = 'orlando';

  /* [display name, slug, travel fee] */
  var FL = [["Altamonte Springs","altamonte-springs",0],["Apopka","apopka",0],["Celebration","celebration",0],["Clermont","clermont",0],["Cocoa Beach","cocoa-beach",0],["Davenport","davenport",0],["Daytona Beach","daytona-beach",0],["Deltona","deltona",0],["Kissimmee","kissimmee",0],["Lake Buena Vista","lake-buena-vista",0],["Lake Mary","lake-mary",0],["Leesburg","leesburg",0],["Maitland","maitland",0],["Mount Dora","mount-dora",0],["New Smyrna Beach","new-smyrna-beach",0],["Ocoee","ocoee",0],["Orlando","orlando",0],["Oviedo","oviedo",0],["Sanford","sanford",0],["St. Cloud","st-cloud",0],["Titusville","titusville",0],["Windermere","windermere",0],["Winter Garden","winter-garden",0],["Winter Park","winter-park",0],["St. Augustine","st-augustine",50],["St. Augustine Beach","st-augustine-beach",50],["Tampa","tampa",50],["Vero Beach","vero-beach",50],["Anna Maria Island","anna-maria-island",75],["Clearwater","clearwater",75],["Clearwater Beach","clearwater-beach",75],["Gainesville","gainesville",75],["Sarasota","sarasota",75],["St. Petersburg","st-petersburg",75],["Jacksonville","jacksonville",100],["Siesta Key","siesta-key",100],["Fort Myers","fort-myers",125],["Palm Beach","palm-beach",125],["Sanibel Island","sanibel",125],["West Palm Beach","west-palm-beach",125],["Boca Raton","boca-raton",150],["Naples","naples",150],["Fort Lauderdale","fort-lauderdale",175],["Marco Island","marco-island",175],["Miami","miami",200],["Tallahassee","tallahassee",225],["Key West","key-west",550],["Pensacola","pensacola",675]];
  /* destinations quoted individually */
  var DEST = [["New York","new-york"],["Las Vegas","las-vegas"],["Nashville","nashville"],["Chicago","chicago"],["Napa Valley","napa-valley"],["Paris","paris"],["Santorini","santorini"],["Amalfi Coast","amalfi-coast"],["Punta Cana","punta-cana"],["Cancún","cancun"]];

  function feeOf(slug) {
    for (var i = 0; i < FL.length; i++) if (FL[i][1] === slug) return FL[i][2];
    return null;
  }
  function nameOf(slug) {
    for (var i = 0; i < FL.length; i++) if (FL[i][1] === slug) return FL[i][0];
    for (var j = 0; j < DEST.length; j++) if (DEST[j][1] === slug) return DEST[j][0];
    return null;
  }
  function isDest(slug) {
    for (var j = 0; j < DEST.length; j++) if (DEST[j][1] === slug) return true;
    return false;
  }
  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function save(slug) { var s = ss(); try { if (s && slug) s.setItem(KEY, slug); } catch (e) {} }
  function load() { var s = ss(); try { return s ? s.getItem(KEY) : null; } catch (e) { return null; } }

  /* ---------- 1. landing pages: remember where the visitor came from ---------- */
  var SELF = document.currentScript || (function () {
    var t = document.getElementsByTagName('script'); return t[t.length - 1];
  })();
  var pageCity = SELF && SELF.getAttribute('data-city-slug');
  if (pageCity) { save(pageCity); return; }   // landing page: record and stop

  /* ---------- 2. homepage: render picker + apply fee ---------- */
  var money = function (n) { return '$' + n.toLocaleString('en-US'); };

  function priceEls() {
    return Array.prototype.slice.call(document.querySelectorAll('.package-price'));
  }

  function captureBases() {
    priceEls().forEach(function (el) {
      if (el.getAttribute('data-cm-base')) return;
      var raw = (el.textContent || '').trim();
      var m = raw.match(/\$\s*([\d,]+)/);
      el.setAttribute('data-cm-base', m ? m[1].replace(/,/g, '') : 'custom');
    });
  }

  function apply(slug) {
    var fee = feeOf(slug);
    var dest = isDest(slug);
    priceEls().forEach(function (el) {
      var b = el.getAttribute('data-cm-base');
      if (!b || b === 'custom') return;
      var base = parseInt(b, 10);
      el.textContent = money(dest ? base : base + (fee || 0));
    });
    banner(slug, fee, dest);
    var sel = document.getElementById('cm-loc-select');
    if (sel && sel.value !== slug) sel.value = slug;
  }

  function banner(slug, fee, dest) {
    var el = document.getElementById('cm-loc-note');
    if (!el) return;
    var nm = nameOf(slug) || 'Orlando';
    if (dest) {
      el.innerHTML = '<strong>' + nm + '</strong> is a destination session — travel is quoted per trip ' +
        '(flights and lodging vary by date). Prices below are base coverage; ' +
        '<a href="/contact" style="color:var(--gold);text-decoration:underline;">ask for an exact quote</a>.';
      el.className = 'cm-loc-note dest';
    } else if (!fee) {
      el.innerHTML = 'Showing <strong>' + nm + '</strong> pricing — no travel fee inside the Orlando area. ' +
        'Shooting somewhere else in Florida? Pick your city above and the prices update.';
      el.className = 'cm-loc-note base';
    } else {
      el.innerHTML = 'Showing <strong>' + nm + '</strong> pricing — every package below includes the ' +
        '<strong>' + money(fee) + ' travel fee</strong> from our Orlando studio. ' +
        'That is the only difference: coverage, editing and delivery are identical everywhere.';
      el.className = 'cm-loc-note fee';
    }
  }

  var CSS =
  '.cm-loc-wrap{margin-top:28px;padding:18px 20px;border:.5px solid rgba(201,169,110,.35);' +
  'background:rgba(201,169,110,.06);max-width:760px}' +
  '.cm-loc-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}' +
  '.cm-loc-lbl{font-family:var(--sans,sans-serif);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold,#C9A96E)}' +
  '#cm-loc-select{flex:1;min-width:210px;background:rgba(28,28,28,.9);color:#FDFCFA;border:.5px solid rgba(201,169,110,.45);' +
  'padding:10px 12px;font-family:var(--sans,sans-serif);font-size:13.5px;border-radius:0;outline:none;cursor:pointer}' +
  '#cm-loc-select:focus{border-color:#C9A96E}' +
  '#cm-loc-select optgroup{background:#1C1C1C;color:#C9A96E;font-style:normal}' +
  '#cm-loc-select option{background:#1C1C1C;color:#FDFCFA}' +
  '.cm-loc-note{margin-top:12px;font-family:var(--sans,sans-serif);font-size:12.5px;line-height:1.65;color:rgba(255,255,255,.62)}' +
  '.cm-loc-note strong{color:#E8D5B0;font-weight:500}' +
  '.cm-loc-note.fee{color:rgba(255,255,255,.72)}' +
  '@media(max-width:600px){.cm-loc-wrap{padding:15px 16px}.cm-loc-row{flex-direction:column;align-items:stretch}}';

  function build() {
    var mount = document.getElementById('cm-loc-mount');
    if (!mount || mount.getAttribute('data-ready')) return;
    mount.setAttribute('data-ready', '1');

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var opts = '<optgroup label="Florida">';
    FL.forEach(function (c) {
      opts += '<option value="' + c[1] + '">' + c[0] +
              (c[2] ? '  (+' + money(c[2]) + ' travel)' : '  (no travel fee)') + '</option>';
    });
    opts += '</optgroup><optgroup label="Destination — quoted per trip">';
    DEST.forEach(function (d) { opts += '<option value="' + d[1] + '">' + d[0] + '</option>'; });
    opts += '</optgroup>';

    mount.innerHTML =
      '<div class="cm-loc-wrap">' +
        '<div class="cm-loc-row">' +
          '<span class="cm-loc-lbl">Where is your session?</span>' +
          '<select id="cm-loc-select" aria-label="Choose your session location">' + opts + '</select>' +
        '</div>' +
        '<div class="cm-loc-note" id="cm-loc-note"></div>' +
      '</div>';

    document.getElementById('cm-loc-select').addEventListener('change', function () {
      apply(this.value);
      save(this.value);
      try {
        if (typeof gtag === 'function') gtag('event', 'pricing_location_change', { location: this.value });
      } catch (e) {}
    });

    captureBases();
    apply(load() || BASE_CITY);
  }

  /* the Packages view is rendered client-side, so re-apply when it appears */
  function watch() {
    build();
    var page = document.getElementById('page-packages-page');
    if (page && window.MutationObserver) {
      new MutationObserver(function () {
        build();
        var sel = document.getElementById('cm-loc-select');
        if (sel) { captureBases(); apply(sel.value); }
      }).observe(page, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
