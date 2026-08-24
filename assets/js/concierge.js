/* ============================================================================
 * ESTATE CONCIERGE — concierge.js
 * Replaces the generic helper widget. One self-contained ES5 IIFE, no
 * dependencies, in the estate.js house style (motion as enhancement).
 *
 * PRIVACY LAW (practice-stack WEBSITE_SPEC E9): chat must be BAA-covered or
 * explicitly non-PHI. This concierge is the latter, structurally:
 *   - 100% client-side. It answers ONLY from window.CONCIERGE_INDEX, which is
 *     generated from this site's own pages at build time.
 *   - ZERO network calls. Nothing typed here ever leaves the browser.
 *   - Conversation state lives in sessionStorage only (gone when the tab ends).
 *   - The panel carries an explicit non-PHI notice.
 * ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    /* E9 seam — DISABLED BY DEFAULT, and it must stay null until a signed BAA
     * exists. Only a BAA-covered AI endpoint may EVER be configured here; a
     * general AI API is a PHI leak with a transcript. While aiBackend is null
     * the concierge performs no network request of any kind. Wiring a future
     * backend also requires updating the panel's privacy notice. */
    aiBackend: null,
    maxTranscript: 40
  };

  var IDX = window.CONCIERGE_INDEX;
  if (!IDX || !IDX.pages) { return; }

  /* ---- page context ------------------------------------------------------ */
  var scriptEl = document.querySelector('script[data-page]');
  var PAGE = (scriptEl && scriptEl.getAttribute('data-page')) || '';
  var CUR = null; // the index entry for the page we are on
  var i, j;
  for (i = 0; i < IDX.pages.length; i++) {
    if (IDX.pages[i].page === PAGE) { CUR = IDX.pages[i]; break; }
  }
  if (!CUR) { // fall back to pathname suffix match (longest wins)
    var pn = location.pathname;
    if (pn.charAt(pn.length - 1) === '/') { pn += 'index.html'; }
    var best = null;
    for (i = 0; i < IDX.pages.length; i++) {
      var cand = IDX.pages[i].path;
      if (pn.length >= cand.length && pn.slice(-cand.length - 1) === '/' + cand) {
        if (!best || cand.length > best.path.length) { best = IDX.pages[i]; }
      }
    }
    CUR = best || IDX.pages[0];
  }
  var IN_OSA = CUR.path.indexOf('osa/') === 0;
  var PREFIX = IN_OSA ? '../' : '';
  var CAMPUS = CUR.campus === 'okc' ? 'okc' : 'tulsa';
  var LOC = IDX.locations[CAMPUS];
  var LOC_TULSA = IDX.locations.tulsa;
  var LOC_OKC = IDX.locations.okc;
  var REDUCED = false;
  try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function pageBy(pt) {
    for (var k = 0; k < IDX.pages.length; k++) {
      if (IDX.pages[k].path === pt) { return IDX.pages[k]; }
    }
    return null;
  }
  function campusPath(rootPath, osaPath) { return CAMPUS === 'okc' ? osaPath : rootPath; }

  /* ---- tiny DOM + text helpers ------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }
  function hrefFor(pathname, id) {
    return PREFIX + pathname + (id ? '#' + id : '');
  }

  /* ---- fuzzy quick-jump index -------------------------------------------- */
  var ENTRIES = [];
  function addEntry(label, pathname, id, weight, extra) {
    ENTRIES.push({ label: label, path: pathname, id: id || null,
      weight: weight || 1, extra: extra || '' });
  }
  (function buildEntries() {
    var p, s, k;
    for (i = 0; i < IDX.pages.length; i++) {
      p = IDX.pages[i];
      if (p.page === 'verify' || /notfound/.test(p.page)) { continue; }
      var extraKw = p.h1 + ' ' + p.page.replace(/-/g, ' ');
      if (p.page === 'home') { extraKw += ' home homepage main start'; }
      if (p.page === 'osa-home') { extraKw += ' okc home homepage'; }
      addEntry(p.title, p.path, null, 1.05, extraKw);
      for (j = 0; j < (p.sections || []).length; j++) {
        s = p.sections[j];
        if (s.l === 1) { continue; }
        addEntry(s.t + ' — ' + (p.h1 || p.title), p.path, s.id, 1, p.title);
      }
    }
    for (i = 0; i < (IDX.surgeons || []).length; i++) {
      s = IDX.surgeons[i];
      if (s.path !== 'surgeons.html' && CAMPUS !== 'okc') { continue; }
      if (s.path === 'surgeons.html' && CAMPUS === 'okc') { continue; }
      addEntry(s.name + ' — ' + s.role, s.path, s.id, 1.2, 'surgeon doctor');
    }
    var rows = IDX.pricing[CAMPUS] || [];
    var prPage = campusPath('pricing.html', 'osa/pricing.html');
    for (i = 0; i < rows.length; i++) {
      addEntry(rows[i].name + ' — cost & pricing', prPage, 'averages', 1, 'price fee');
    }
    var gal = IDX.gallery[CAMPUS] || {};
    var galPage = campusPath('gallery.html', 'osa/results.html');
    for (i = 0; i < (gal.filters || []).length; i++) {
      addEntry(gal.filters[i].label + ' — before & after cases', galPage,
        gal.filters[i].id, 1, 'results gallery photos');
    }
    for (i = 0; i < (gal.procedures || []).length; i++) {
      addEntry(gal.procedures[i].name + ' — real results', galPage,
        procFilterId(gal.procedures[i].name), 1, 'before after gallery');
    }
  }());

  function procFilterId(name) {
    var n = name.toLowerCase();
    if (/rhino|nose/.test(n)) { return 'f-nose'; }
    if (/blephar|eye/.test(n)) { return 'f-eyes'; }
    if (/breast|mastopexy|gynecom/.test(n)) { return (/gynecom/.test(n) ? 'f-men' : 'f-breast'); }
    if (/facelift|face|neck|brow|laser/.test(n)) { return 'f-face'; }
    if (/brazilian|bbl/.test(n)) { return 'f-bbl'; }
    if (/mommy/.test(n)) { return 'f-mommy'; }
    if (/tummy|lipo|weight|body|arm|thigh|labia/.test(n)) { return 'f-body'; }
    return 'f-all';
  }

  function lev(a, b) {
    var la = a.length, lb = b.length, r = [], c, x, y, cost;
    if (la === 0) { return lb; } if (lb === 0) { return la; }
    if (la > 24) { a = a.slice(0, 24); la = 24; }
    if (lb > 24) { b = b.slice(0, 24); lb = 24; }
    for (x = 0; x <= la; x++) { r[x] = [x]; }
    for (y = 0; y <= lb; y++) { r[0][y] = y; }
    for (x = 1; x <= la; x++) {
      for (y = 1; y <= lb; y++) {
        cost = a.charAt(x - 1) === b.charAt(y - 1) ? 0 : 1;
        c = r[x - 1][y] + 1;
        if (r[x][y - 1] + 1 < c) { c = r[x][y - 1] + 1; }
        if (r[x - 1][y - 1] + cost < c) { c = r[x - 1][y - 1] + cost; }
        r[x][y] = c;
      }
    }
    return r[la][lb];
  }
  function toks(s) {
    var out = [], raw = String(s).toLowerCase().replace(/[^a-z0-9$]+/g, ' ').split(' ');
    for (var t = 0; t < raw.length; t++) { if (raw[t].length > 1) { out.push(raw[t]); } }
    return out;
  }
  function tokenScore(q, t) {
    if (q === t) { return 1; }
    if (t.indexOf(q) === 0 && q.length >= 3) { return 0.85; }
    if (q.indexOf(t) === 0 && t.length >= 4) { return 0.75; }
    if (t.indexOf(q) > 0 && q.length >= 4) { return 0.6; }
    if (q.length >= 5 && t.length >= 5) {
      var d = lev(q, t);
      if (d <= 1) { return 0.8; }
      if (d === 2) { return 0.65; }
    } else if (q.length >= 4 && lev(q, t) <= 1) { return 0.7; }
    return 0;
  }
  var STOP = ' the a an of to for in on and or me my show take go open where is what how much your you us with i ';
  function search(query, limit) {
    var qt0 = toks(query), qt = [], sc, e, tt, bestT, s, hits;
    for (i = 0; i < qt0.length; i++) {
      if (STOP.indexOf(' ' + qt0[i] + ' ') === -1) { qt.push(qt0[i]); }
    }
    if (!qt.length) { qt = qt0; }
    if (!qt.length) { return []; }
    var scored = [];
    for (i = 0; i < ENTRIES.length; i++) {
      e = ENTRIES[i];
      tt = toks(e.label + ' ' + e.extra);
      hits = 0; sc = 0;
      for (j = 0; j < qt.length; j++) {
        bestT = 0;
        for (var m = 0; m < tt.length; m++) {
          s = tokenScore(qt[j], tt[m]);
          if (s > bestT) { bestT = s; }
        }
        if (bestT > 0) { hits++; sc += bestT; }
      }
      if (!hits) { continue; }
      sc = (sc / qt.length) * (0.6 + 0.4 * (hits / qt.length)) * e.weight;
      // locality: prefer a section on the page we're on, and our own campus
      if (e.path === CUR.path && e.id) { sc *= 1.2; }
      var eCampus = (e.path.indexOf('osa/') === 0 || e.path === 'oklahoma-city.html') ? 'okc' : 'tulsa';
      if (eCampus !== CAMPUS) { sc *= 0.9; }
      scored.push({ e: e, s: sc });
    }
    scored.sort(function (a, b) { return b.s - a.s || (a.e.label < b.e.label ? -1 : 1); });
    return scored.slice(0, limit || 3);
  }

  /* ---- UI ---------------------------------------------------------------- */
  var launcher = el('button', null,
    '<span class="cg-glyph" aria-hidden="true">✦</span><span>Concierge</span>');
  launcher.id = 'cg-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'cg-panel');
  if (document.querySelector('.bagpill')) { launcher.className = 'cg-raised'; }

  var panel = el('div', null, '');
  panel.id = 'cg-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Estate Concierge');

  var head = el('div', 'cg-head',
    '<h2>The Estate <em>Concierge</em></h2>' +
    '<p class="cg-sub">' + (CAMPUS === 'okc' ? 'Oklahoma Surgical Arts · Oklahoma City' :
      'Tulsa Surgical Arts · Bella Roma · Wellness') + '</p>' +
    '<p class="cg-notice">Please don’t include personal health details — this concierge ' +
    'answers from the site’s own pages, and nothing you type leaves your browser.</p>');
  var closeBtn = el('button', 'cg-close', 'Close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close the concierge');
  head.appendChild(closeBtn);

  var log = el('div', 'cg-log', '');
  log.setAttribute('aria-live', 'polite');

  var form = el('form', 'cg-inputrow', '');
  var input = el('input', 'cg-input', null);
  input.type = 'text';
  input.autocomplete = 'off';
  input.setAttribute('aria-label',
    'Ask the concierge, or type a page, procedure or section to jump to');
  input.placeholder = 'Ask, or type a destination…';
  var send = el('button', 'cg-send', 'Ask');
  send.type = 'submit';
  form.appendChild(input); form.appendChild(send);

  var bar = el('div', 'cg-bar', '');
  var barBook = el('a', 'cg-bar-book', 'Book a consultation');
  barBook.href = LOC.book || LOC_TULSA.book;
  barBook.target = '_blank'; barBook.rel = 'noopener';
  barBook.setAttribute('data-evt', 'book_click');
  var barCall = el('a', 'cg-bar-call', 'Call ' + LOC.disp);
  barCall.href = 'tel:' + LOC.tel;
  barCall.setAttribute('data-evt', 'call_click');
  bar.appendChild(barBook); bar.appendChild(barCall);

  panel.appendChild(head); panel.appendChild(log);
  panel.appendChild(form); panel.appendChild(bar);
  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  /* ---- transcript (sessionStorage only — never leaves the browser) ------- */
  var SKEY = 'tsaConciergeV1';
  function loadState() {
    try {
      var s = sessionStorage.getItem(SKEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function saveState() {
    try {
      var msgs = [], nodes = log.querySelectorAll('.cg-msg,.cg-chips,.cg-prompts');
      for (var n = 0; n < nodes.length; n++) {
        msgs.push({ c: nodes[n].className, h: nodes[n].innerHTML });
        if (msgs.length >= CONFIG.maxTranscript) { break; }
      }
      sessionStorage.setItem(SKEY, JSON.stringify({ open: isOpen(), msgs: msgs }));
    } catch (e) {}
  }

  /* ---- rendering --------------------------------------------------------- */
  function scrollLog() { log.scrollTop = log.scrollHeight; }
  function addUser(text) {
    log.appendChild(el('div', 'cg-msg cg-msg-user', esc(text)));
    scrollLog();
  }
  function chipNode(c) {
    var a;
    if (c.prompt) {
      a = el('button', 'cg-chip cg-chip-line', esc(c.t));
      a.type = 'button';
      a.setAttribute('data-cg-prompt', c.prompt);
      return a;
    }
    a = el('a', 'cg-chip ' + (c.kind === 'gold' ? 'cg-chip-gold' : 'cg-chip-line'), esc(c.t));
    if (c.tel) { a.href = 'tel:' + c.tel; a.setAttribute('data-evt', 'call_click'); }
    else if (c.sms) { a.href = 'sms:' + c.sms; a.setAttribute('data-evt', 'text_click'); }
    else if (c.ext) {
      a.href = c.ext; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('data-evt', c.evt || 'book_click');
    } else if (c.path) {
      a.href = hrefFor(c.path, c.id);
      a.setAttribute('data-cg-path', c.path);
      if (c.id) { a.setAttribute('data-cg-id', c.id); }
    }
    return a;
  }
  function addAnswer(ans) {
    var html = ans.html + (ans.fine ? '<span class="cg-fine">' + ans.fine + '</span>' : '');
    log.appendChild(el('div', 'cg-msg cg-msg-bot', html));
    if (ans.chips && ans.chips.length) {
      var row = el('div', 'cg-chips', '');
      for (var c = 0; c < ans.chips.length && c < 4; c++) {
        row.appendChild(chipNode(ans.chips[c]));
      }
      log.appendChild(row);
    }
    scrollLog(); saveState();
  }
  function addPrompts(list, label) {
    var box = el('div', 'cg-prompts', '');
    box.appendChild(el('p', 'cg-prompts-label', label || 'Popular on this page'));
    for (var p = 0; p < list.length && p < 6; p++) {
      var b = el('button', 'cg-prompt', esc(list[p]));
      b.type = 'button';
      b.setAttribute('data-cg-prompt', list[p]);
      box.appendChild(b);
    }
    log.appendChild(box); scrollLog(); saveState();
  }

  /* ---- same-page scroll + flash ------------------------------------------ */
  function flashTarget(id) {
    var t = document.getElementById(id);
    if (!t) { return false; }
    t.scrollIntoView(REDUCED ? {} : { behavior: 'smooth', block: 'start' });
    t.classList.add('cg-flash');
    setTimeout(function () { t.classList.add('cg-flash-fade'); }, REDUCED ? 900 : 1400);
    setTimeout(function () {
      t.classList.remove('cg-flash'); t.classList.remove('cg-flash-fade');
    }, REDUCED ? 1400 : 2800);
    return true;
  }
  function goTo(pathname, id) {
    if (pathname === CUR.path && !id) { closePanelSoft(); return; }
    if (pathname === CUR.path && id) {
      closePanelSoft();
      var t = document.getElementById(id);
      if (t && t.className.indexOf('chip') !== -1 && t.getAttribute('data-f')) {
        t.click(); // gallery filter chips: activate the filter, not just scroll to it
      }
      flashTarget(id);
      return;
    }
    if (id) { try { sessionStorage.setItem('cgArrive', id); } catch (e) {} }
    location.href = hrefFor(pathname, id);
  }
  (function arriveFlash() { // flash the section we deep-linked to from another page
    var want = null;
    try { want = sessionStorage.getItem('cgArrive'); sessionStorage.removeItem('cgArrive'); }
    catch (e) {}
    if (want && location.hash === '#' + want) {
      setTimeout(function () { flashTarget(want); }, 250);
    }
  }());

  /* ---- shared chip builders ---------------------------------------------- */
  function chipBook(gold) {
    return { t: CAMPUS === 'okc' ? 'Book an OKC consult' : 'Book a consultation',
      ext: LOC.book, kind: gold ? 'gold' : 'line',
      evt: CAMPUS === 'okc' ? 'osa_consult_form' : 'book_click' };
  }
  function chipCall() { return { t: 'Call ' + LOC.disp, tel: LOC.tel }; }
  function chipPricing() {
    return { t: 'See pricing', path: campusPath('pricing.html', 'osa/pricing.html'), id: 'averages' };
  }
  function chipResults(id) {
    return { t: 'View results', path: campusPath('gallery.html', 'osa/results.html'), id: id || null };
  }
  function chipDirections() {
    return { t: 'Get directions', ext: LOC.maps, evt: 'directions_click' };
  }

  /* ---- intent helpers ----------------------------------------------------- */
  var PROC_SYNONYMS = [
    [/nose job|rhino/i, 'Rhinoplasty'],
    [/face ?lift|deep plane/i, 'Facelift'],
    [/upper (eyelid|bleph)|eyelid.*upper/i, 'Eyelid surgery (upper)'],
    [/lower (eyelid|bleph)|eyelid.*lower/i, 'Eyelid surgery (lower)'],
    [/eyelid|bleph/i, 'Eyelid surgery (upper)'],
    [/brow/i, 'Brow lift'],
    [/neck lift/i, 'Neck lift'],
    [/chin/i, 'Chin augmentation'],
    [/buccal/i, 'Buccal fat removal'],
    [/breast aug|boob job|implant/i, 'Breast augmentation (implants)'],
    [/breast lift|mastopexy/i, 'Breast lift (mastopexy)'],
    [/breast reduc/i, 'Breast reduction (aesthetic)'],
    [/gynecomastia|male breast/i, 'Gynecomastia surgery'],
    [/liposuction|lipo\b/i, 'Liposuction'],
    [/tummy tuck|abdominoplasty/i, 'Tummy tuck'],
    [/brazilian|bbl/i, 'Brazilian butt lift (fat grafting)'],
    [/labiaplasty/i, 'Labiaplasty'],
    [/arm lift|brachioplasty/i, 'Arm lift (brachioplasty)'],
    [/thigh/i, 'Thigh lift'],
    [/mommy makeover/i, 'Mommy makeover'],
    [/breast/i, 'Breast augmentation (implants)']
  ];
  function priceRowFor(q) {
    var rows = IDX.pricing[CAMPUS] || IDX.pricing.tulsa, r, s;
    for (i = 0; i < PROC_SYNONYMS.length; i++) {
      if (PROC_SYNONYMS[i][0].test(q)) {
        for (j = 0; j < rows.length; j++) {
          if (rows[j].name === PROC_SYNONYMS[i][1]) { return rows[j]; }
        }
      }
    }
    // fuzzy row match as a fallback — generic words must not pick a row
    var GENERIC = ' surgery surgical cosmetic procedure cost costs price prices pricing fee fees quote average what does much ';
    var qt0 = toks(q), qt = [];
    for (i = 0; i < qt0.length; i++) {
      if (GENERIC.indexOf(' ' + qt0[i] + ' ') === -1) { qt.push(qt0[i]); }
    }
    if (!qt.length) { return null; }
    var bestR = null, bestS = 0;
    for (j = 0; j < rows.length; j++) {
      r = rows[j]; s = 0;
      var nt = toks(r.name);
      for (var a = 0; a < qt.length; a++) {
        for (var b = 0; b < nt.length; b++) {
          var ts = tokenScore(qt[a], nt[b]);
          if (ts > s) { s = ts; }
        }
      }
      if (s > bestS) { bestS = s; bestR = r; }
    }
    return bestS >= 0.65 ? bestR : null;
  }
  function faqFor(pagePath, re) {
    var p = pageBy(pagePath);
    if (!p || !p.faqs) { return null; }
    for (var f = 0; f < p.faqs.length; f++) {
      if (re.test(p.faqs[f].q)) { return p.faqs[f]; }
    }
    return null;
  }
  function cardFor(pagePath, titleRe) {
    var p = pageBy(pagePath);
    if (!p || !p.cards) { return null; }
    for (var c = 0; c < p.cards.length; c++) {
      if (titleRe.test(p.cards[c].t)) { return p.cards[c]; }
    }
    return null;
  }
  function surgeonByName(q) {
    var pool = IDX.surgeons || [], want = CAMPUS === 'okc' ? 'osa/surgeons.html' : 'surgeons.html';
    var names = [
      [/cuzalina/i, 'cuzalina'], [/nelson/i, 'nelson'], [/\beid\b|rola/i, 'eid'],
      [/tolomeo|pasquale/i, 'tolomeo'], [/champion|carisa/i, 'champion'],
      [/gutierrez|pineres|sebastian/i, 'gutierrez'], [/fogleman|trent/i, 'fogleman']
    ];
    for (i = 0; i < names.length; i++) {
      if (names[i][0].test(q)) {
        var id = names[i][1], hit = null, anyHit = null;
        for (j = 0; j < pool.length; j++) {
          if (pool[j].id === id) {
            anyHit = pool[j];
            if (pool[j].path === want) { hit = pool[j]; }
          }
        }
        return hit || anyHit;
      }
    }
    return null;
  }

  /* ---- intents ------------------------------------------------------------ */
  function ansPricing(q) {
    var row = priceRowFor(q);
    var prPage = campusPath('pricing.html', 'osa/pricing.html');
    if (row) {
      return {
        html: '<b>' + esc(row.name) + '</b> — the practice publishes the national ' +
          'ASPS member-survey data so you can plan honestly:' +
          '<div class="cg-kv"><div><b>ASPS national avg</b><span>' + esc(row.avg) +
          '</span></div><div><b>2024 projected range</b><span>' + esc(row.range) +
          '</span></div></div>' +
          'Those are national figures for expectation-setting — <b>not this practice’s ' +
          'fees</b>. Your own quote is personal, all-in, and delivered in writing at ' +
          'consultation.',
        fine: 'Figures as published on the pricing page, sourced to plasticsurgery.org.',
        chips: [chipBook(true), { t: 'All 20 national averages', path: prPage, id: 'averages' },
          { t: 'Financing options', path: prPage, id: 'financing' }]
      };
    }
    return {
      html: 'The practice doesn’t do internet price tags — your quote is personal and ' +
        'written at consultation. What it <b>does</b> publish: national ASPS average ' +
        'surgeon fees for 20 procedures, what moves the number, and monthly financing ' +
        'through CareCredit, PatientFi and Cherry.',
      chips: [{ t: 'See the national averages', kind: 'gold',
        path: prPage, id: 'averages' },
        { t: 'Financing options', path: prPage, id: 'financing' }, chipBook(false)]
    };
  }
  function ansFinancing() {
    var prPage = campusPath('pricing.html', 'osa/pricing.html');
    return {
      html: 'Yes — the practice works with <b>CareCredit</b>, <b>PatientFi</b> and ' +
        '<b>Cherry</b>, monthly-payment plans patients already use here. Bring your ' +
        'target number to the consult team and they’ll run the monthly figures with ' +
        'your written quote.',
      chips: [{ t: 'Financing, in plain terms', kind: 'gold', path: prPage, id: 'financing' },
        chipCall(), chipBook(false)]
    };
  }
  function ansCandidacy(q) {
    if (/glp|weight|wellness|peptide|hormone|hrt/i.test(q)) { return ansWellness(q); }
    var extra = '';
    var f = faqFor('rhinoplasty.html', /breathing/i);
    if (/rhino|nose|breath/i.test(q) && f) {
      extra = '<br><br><b>' + esc(f.q) + '</b> ' + esc(f.a);
    }
    return {
      html: 'Honest answer: candidacy is a clinical decision, made at an examination — ' +
        'not by a widget. What I can tell you is how it works here: you meet the ' +
        'surgeon, they examine you, and you leave with a real answer and one written, ' +
        'all-in quote. Consults can be in person or virtual' +
        (CAMPUS === 'okc' ? ', with surgery in Oklahoma City or Tulsa' : '') + '.' + extra,
      chips: [chipBook(true), chipCall(), chipResults()]
    };
  }
  function ansRecovery(q) {
    var f = faqFor('rhinoplasty.html', /recovery/i);
    if (/rhino|nose/i.test(q) || CUR.page === 'procedure-rhinoplasty') {
      var g = pageBy('rhinoplasty.html');
      var kv = '';
      if (g && g.glance) {
        kv = '<div class="cg-kv">';
        for (i = 0; i < g.glance.length; i++) {
          kv += '<div><b>' + esc(g.glance[i][0]) + '</b><span>' +
            esc(g.glance[i][1]) + '</span></div>';
        }
        kv += '</div>';
      }
      return {
        html: '<b>Rhinoplasty recovery, as the practice publishes it:</b> ' +
          (f ? esc(f.a) : 'splint about a week; most patients present publicly by 7–10 days.') + kv,
        fine: 'Typical planning ranges from the rhinoplasty page — your written plan is set at consultation.',
        chips: [{ t: 'Rhinoplasty in depth', path: 'rhinoplasty.html', id: null },
          chipBook(true), chipCall()]
      };
    }
    return {
      html: 'Recovery is procedure- and patient-specific, so the practice publishes ' +
        'honest planning ranges rather than promises — rhinoplasty, for example, is ' +
        'splint for about a week and publicly presentable by 7–10 days for most. For ' +
        'your procedure, the consult team gives you the real timeline in writing.',
      chips: [{ t: 'Rhinoplasty recovery', path: 'rhinoplasty.html', id: 'faq' },
        chipBook(true), chipCall()]
    };
  }
  function ansResults(q) {
    var gal = IDX.gallery[CAMPUS] || {}, galPage = campusPath('gallery.html', 'osa/results.html');
    var fid = null, label = 'the full case archive', n = 0, p;
    for (i = 0; i < (gal.procedures || []).length; i++) {
      p = gal.procedures[i];
      if (new RegExp(p.name.split(' ')[0], 'i').test(q)) {
        fid = procFilterId(p.name); label = p.name + ' cases'; n = p.cases; break;
      }
    }
    if (!fid) {
      var fmap = [[/nose|rhino/i, 'f-nose'], [/breast|boob/i, 'f-breast'],
        [/eye|bleph/i, 'f-eyes'], [/face|neck/i, 'f-face'], [/bbl|brazilian|contour/i, 'f-bbl'],
        [/mommy/i, 'f-mommy'], [/tummy|body|lipo/i, 'f-body'], [/men|male/i, 'f-men']];
      for (i = 0; i < fmap.length; i++) {
        if (fmap[i][0].test(q)) { fid = fmap[i][1]; break; }
      }
      if (fid) {
        for (i = 0; i < (gal.filters || []).length; i++) {
          if (gal.filters[i].id === fid) { label = gal.filters[i].label + ' cases'; }
        }
      }
    }
    var total = 0;
    for (i = 0; i < (gal.procedures || []).length; i++) { total += gal.procedures[i].cases; }
    return {
      html: 'Every image in the gallery is a consented patient of this practice — ' +
        'catalogued, consent-verified, and attributed to the operating surgeon. ' +
        (n ? ('I count <b>' + n + ' published ' + esc(label) + '</b> right now, ') :
          ('<b>' + total + ' published cases</b> are live, ')) +
        'with draggable before/after comparisons.',
      chips: [{ t: fid ? 'Open ' + label : 'Open the gallery', kind: 'gold',
        path: galPage, id: fid }, chipBook(false), chipPricing()]
    };
  }
  function ansBook() {
    if (CAMPUS === 'okc') {
      return {
        html: 'Two doors, both real: submit the <b>OKC consult form</b> and the team ' +
          'schedules a virtual or in-person visit with your surgeon — surgery in ' +
          'Oklahoma City or Tulsa, whichever serves you better. Or simply call ' +
          '<b>' + esc(LOC_OKC.disp) + '</b>.',
        chips: [chipBook(true), chipCall(), { t: 'Visit & contact', path: 'osa/contact.html', id: null }]
      };
    }
    return {
      html: 'Three doors, all real: <b>book online</b> through the practice’s own ' +
        'scheduler, <b>call</b> ' + esc(LOC_TULSA.disp) + ', or <b>text</b> the same ' +
        'number and the consult team takes it from there. Med-spa providers book ' +
        'directly from their cards on the Bella Roma page.',
      chips: [chipBook(true), chipCall(), { t: 'Text us', sms: LOC_TULSA.sms || LOC_TULSA.tel }]
    };
  }
  function ansHours() {
    var h = LOC_TULSA.hours.length ? LOC_TULSA.hours[0] : '';
    var html = '<b>' + esc(LOC_TULSA.name) + '</b><div class="cg-kv">' +
      '<div><b>Hours</b><span>' + esc(h) + '</span></div>' +
      '<div><b>Phone</b><span>' + esc(LOC_TULSA.disp) + '</span></div></div>';
    html += '<b>' + esc(LOC_OKC.name) + '</b><div class="cg-kv">' +
      '<div><b>Hours</b><span>not published on the site — call to confirm</span></div>' +
      '<div><b>Phone</b><span>' + esc(LOC_OKC.disp) + '</span></div></div>';
    return {
      html: html,
      fine: 'Hours as published on the visit page. I won’t guess the ones the site doesn’t list.',
      chips: [chipCall(), chipDirections(), { t: 'Visit & contact',
        path: campusPath('contact.html', 'osa/contact.html'), id: null }]
    };
  }
  function ansLocation() {
    function block(l) {
      return '<b>' + esc(l.name) + '</b><div class="cg-kv">' +
        '<div><b>Address</b><span>' + esc(l.address) + '</span></div>' +
        '<div><b>Phone</b><span>' + esc(l.disp) + '</span></div>' +
        (l.hours.length ? '<div><b>Hours</b><span>' + esc(l.hours[0]) + '</span></div>' : '') +
        '</div>';
    }
    var first = CAMPUS === 'okc' ? LOC_OKC : LOC_TULSA;
    var second = CAMPUS === 'okc' ? LOC_TULSA : LOC_OKC;
    return {
      html: block(first) + block(second),
      chips: [chipDirections(), chipCall(),
        { t: 'Visit & contact', path: campusPath('contact.html', 'osa/contact.html'), id: null }]
    };
  }
  function ansOKC() {
    return {
      html: 'You want <b>Oklahoma Surgical Arts</b> — Dr. Cuzalina’s Oklahoma City ' +
        'campus at ' + esc(LOC_OKC.address) + ', with two operating rooms. Every Tulsa ' +
        'Surgical Arts surgeon sees OKC patients: consults virtual or in person, ' +
        'surgery in Oklahoma City or Tulsa.',
      chips: [{ t: 'The OKC campus', kind: 'gold', path: 'osa/index.html', id: null },
        { t: 'OKC surgeons', path: 'osa/surgeons.html', id: null },
        { t: 'Call ' + LOC_OKC.disp, tel: LOC_OKC.tel }]
    };
  }
  function ansTulsa() {
    return {
      html: 'The flagship: <b>Tulsa Surgical Arts</b> — the villa at ' +
        esc(LOC_TULSA.address) + ', an AAAHC-accredited surgery center with overnight ' +
        'guest suites, plus Bella Roma Medical Spa and TSA Wellness under the same roof.',
      chips: [{ t: 'Tulsa Surgical Arts', kind: 'gold', path: 'index.html', id: null },
        { t: 'Call ' + LOC_TULSA.disp, tel: LOC_TULSA.tel },
        { t: 'Visit the villa', path: 'contact.html', id: 'campuses' }]
    };
  }
  function ansSurgeon(q) {
    var s = surgeonByName(q);
    if (s) {
      var badges = s.badges && s.badges.length ?
        '<div class="cg-kv"><div><b>Credentials</b><span>' + esc(s.badges.join(' · ')) +
        '</span></div>' + (s.focus ? '<div><b>Focus</b><span>' + esc(s.focus) +
        '</span></div>' : '') + '</div>' : '';
      return {
        html: '<b>' + esc(s.name) + '</b><br>' + esc(s.role) + badges,
        fine: 'Credentials quoted from the surgeons page, which names its primary sources.',
        chips: [{ t: 'Full profile', kind: 'gold', path: s.path, id: s.id },
          chipResults(), chipBook(false)]
      };
    }
    var okcish = CAMPUS === 'okc' || /okc|oklahoma city/i.test(q);
    var want = okcish ? 'osa/surgeons.html' : 'surgeons.html';
    var names = [];
    for (i = 0; i < IDX.surgeons.length; i++) {
      if (IDX.surgeons[i].path === want) { names.push(IDX.surgeons[i].name.split(',')[0]); }
    }
    return {
      html: (okcish ? 'Seven surgeons serve Oklahoma City' :
        'Six cosmetic surgeons, one standard') + ' — led by founder Dr. Angelo ' +
        'Cuzalina, past president of the American Academy of Cosmetic Surgery, who ' +
        'directs the fellowship that trains the specialty’s next generation.<br><b>' +
        esc(names.join(' · ')) + '</b>',
      chips: [{ t: 'Meet every surgeon', kind: 'gold', path: want, id: null },
        chipResults(), chipBook(false)]
    };
  }
  function ansFellowship() {
    var p = pageBy('fellowship.html');
    return {
      html: '<b>' + esc(p.h1) + '</b> — ' + esc(p.desc) + ' The surgeon who trains ' +
        'surgeons can be your surgeon.',
      chips: [{ t: 'The fellowship', kind: 'gold', path: 'fellowship.html', id: null },
        { t: 'The current fellows', path: 'fellowship.html', id: 'fellows' },
        chipBook(false)]
    };
  }
  function ansMedspa(q) {
    if (CAMPUS === 'okc' || /okc|oklahoma city/i.test(q)) {
      var c = cardFor('osa/injectables.html', /Neurotoxins/i);
      return {
        html: 'Injectables and skin in OKC, on the program’s standards — consultation ' +
          'first, never a cart.' + (c ? ' <b>Neurotoxins:</b> ' +
          esc(c.items.join(' · ')) : ''),
        chips: [{ t: 'The injectables menu', kind: 'gold', path: 'osa/injectables.html', id: 'menu' },
          { t: 'Call ' + LOC_OKC.disp, tel: LOC_OKC.tel }, chipBook(false)]
      };
    }
    var inj = cardFor('medspa.html', /^Injectables$/i);
    var wantLymph = /lymph|massage|mld/i.test(q);
    if (wantLymph) {
      return {
        html: '<b>Lymphatic & massage at Bella Roma</b> — post-op lymphatic therapy ' +
          '(MLD), prenatal and deep tissue, delivered by the team that cares for ' +
          'surgical patients every day, led by Brandy Fenwick, the educator who ' +
          'trains the field.',
        chips: [{ t: 'Lymphatic & massage', kind: 'gold', path: 'medspa.html', id: 'lymphatic' },
          chipCall(), chipBook(false)]
      };
    }
    return {
      html: '<b>Bella Roma Medical Spa</b> lives inside the practice — injectors ' +
        'trained personally by Dr. Cuzalina, one-tap booking per provider.' +
        (inj ? '<div class="cg-kv"><div><b>Injectables</b><span>' +
        esc(inj.items.slice(0, 2).join(' · ')) + '</span></div></div>' : '') +
        'Lasers, facials, lymphatic care, lash & brow — the whole menu is on the page.',
      chips: [{ t: 'Book with an injector', kind: 'gold', path: 'medspa.html', id: 'book' },
        { t: 'The full menu', path: 'medspa.html', id: 'menu' }, chipCall()]
    };
  }
  function ansWellness(q) {
    var glp = cardFor('wellness.html', /GLP-1 Weight Management/i);
    var elig = '';
    if (glp) {
      for (i = 0; i < glp.items.length; i++) {
        if (/BMI/i.test(glp.items[i])) { elig = glp.items[i]; }
      }
    }
    var wPage = campusPath('wellness.html', 'osa/wellness.html');
    if (/glp|weight|eligib/i.test(q) && elig) {
      return {
        html: '<b>GLP-1 weight management</b> runs like medicine here — NP-led, labs ' +
          'first, ongoing supervision. The practice’s published eligibility: ' +
          '<b>' + esc(elig.replace(/^Eligibility, verbatim:\s*/i, '')) + '</b> — plus ' +
          'commitment to lifestyle change. Candidacy is a clinical decision made at ' +
          'your evaluation, never by a cart.',
        fine: 'Quoted from the wellness page. Programs begin with a provider evaluation.',
        chips: [{ t: 'Start a wellness consult', kind: 'gold', ext: IDX.links.wellness_form,
          evt: 'wellness_form' }, { t: 'The wellness pillar', path: wPage, id: 'programs' },
          chipCall()]
      };
    }
    return {
      html: '<b>TSA Wellness</b> — GLP-1 weight management, four peptide-therapy ' +
        'tracks, and bio-identical HRT, led by Nurse Practitioner Valerie Baker. ' +
        'Programs begin with a provider evaluation and laboratory work, never a cart. ' +
        'Current specials on the page: $99 peptide consultation, $50 off the first ' +
        'peptide package, 10% off lab testing.',
      fine: 'Specials as published on the wellness page.',
      chips: [{ t: 'Start a wellness consult', kind: 'gold', ext: IDX.links.wellness_form,
        evt: 'wellness_form' }, { t: 'Explore the programs', path: wPage, id: 'programs' },
        chipCall()]
    };
  }
  function ansStore(q) {
    if (/membership|bella club|tier/i.test(q)) {
      return {
        html: '<b>The Bella Club</b> — the spa’s monthly membership, two tiers: ' +
          '<b>Ciao Bella</b> (entry — member pricing, credit that rolls into the ' +
          'chair or the shelf) and <b>Bellissima</b> (signature — deeper monthly ' +
          'credit across the full menu). Both live in the store today.',
        chips: [{ t: 'Explore membership', kind: 'gold', path: 'store.html', id: 'membership' },
          { t: 'The online store', ext: IDX.links.store, evt: 'store_click' }, chipCall()]
      };
    }
    if (/gift/i.test(q)) {
      return {
        html: '<b>Gift cards:</b> digital, multiple denominations, redeemable across ' +
          'the spa and the store — give the treatment, let her choose the chair.',
        chips: [{ t: 'The store page', kind: 'gold', path: 'store.html', id: 'membership' },
          { t: 'The online store', ext: IDX.links.store, evt: 'store_click' }]
      };
    }
    if (/refill/i.test(q)) {
      return {
        html: '<b>Concierge refills:</b> text the spa your cadence — sunscreen every ' +
          'quarter, retinol every other month — and your order ships on schedule ' +
          'from the practice’s own store. Real people, your schedule, no algorithm.',
        chips: [{ t: 'Text your refill list', kind: 'gold', sms: LOC_TULSA.tel },
          { t: 'The store', path: 'store.html', id: 'refills' }]
      };
    }
    return {
      html: 'The store is the shelf behind the results: physician-dispensed skincare ' +
        '(SkinMedica, Obagi, GlyMed Plus, Revision, Latisse, Nutrafol), the Bella ' +
        'Roma private-label line, treatment packages, memberships and gift cards. ' +
        'Every card opens the practice’s own secure store.',
      chips: [{ t: 'Browse the store', kind: 'gold', path: 'store.html', id: 'products' },
        { t: 'Shop by concern', path: 'store.html', id: 'concerns' },
        { t: 'The online store', ext: IDX.links.store, evt: 'store_click' }]
    };
  }
  function ansSpecials() {
    var out = [], c;
    var msp = pageBy('medspa.html');
    if (msp && msp.cards) {
      for (i = 0; i < msp.cards.length; i++) {
        c = msp.cards[i];
        if (/% off|\$\d+ off/i.test(c.t)) { out.push(esc(c.t) + (c.p ? ' — ' + esc(c.p) : '')); }
      }
    }
    return {
      html: '<b>Current specials, as published:</b><ul><li>' + out.join('</li><li>') +
        '</li></ul>Wellness runs its own: $99 peptide consultation, $50 off the ' +
        'first peptide package, 10% off lab testing.',
      fine: 'Specials sync from the practice’s specials page — confirm current dates when booking.',
      chips: [{ t: 'Med-spa specials', kind: 'gold', path: 'medspa.html', id: 'specials' },
        { t: 'Wellness specials', path: 'wellness.html', id: null }, chipCall()]
    };
  }
  function ansReviews() {
    return {
      html: 'On the record, as the site publishes it: <b>4.8★ across 170 Healthgrades ' +
        'reviews</b> and <b>5.0★ across 690+ Google reviews</b> (as of August 2026), ' +
        'with patient quotes republished verbatim — never edited, never invented.',
      chips: [chipResults(), { t: 'Patient voices', path: 'index.html', id: 'reviews' },
        chipBook(false)]
    };
  }
  function ansInsurance() {
    var f = faqFor(campusPath('pricing.html', 'osa/pricing.html'), /insurance/i) ||
      faqFor('pricing.html', /insurance/i);
    return {
      html: f ? ('<b>' + esc(f.q) + '</b><br>' + esc(f.a)) :
        'Cosmetic procedures are self-pay; breast reduction is often covered when ' +
        'medically indicated — determined case-by-case.',
      chips: [chipPricing(), chipBook(true), chipCall()]
    };
  }
  function ansFlyIn() {
    return {
      html: 'Patients travel from across the country. The pattern: a <b>virtual ' +
        'consultation first</b>, surgery scheduled around your trip, and recovery in ' +
        'the villa’s private overnight guest suites.',
      chips: [{ t: 'Fly-in details', kind: 'gold', path: 'index.html', id: 'visit' },
        chipCall(), chipBook(false)]
    };
  }
  function ansVirtual() {
    return {
      html: 'Consults can be virtual or in person' + (CAMPUS === 'okc' ?
        ' — submit the OKC consult form and the team schedules a virtual visit with ' +
        'your surgeon; surgery happens in Oklahoma City or Tulsa.' :
        ' — start with the booking hub or a call and the consult team sets it up ' +
        'around you.'),
      chips: [chipBook(true), chipCall(),
        { t: 'Visit & contact', path: campusPath('contact.html', 'osa/contact.html'), id: null }]
    };
  }
  function ansLibrary() {
    var p = pageBy('library.html');
    return {
      html: '<b>The Cuzalina Library</b> — the founder’s complete published record: ' +
        '18 peer-reviewed articles, textbooks & chapters (including the chapters on ' +
        'rhinoplasty’s hardest variants), leadership and editorial roles, teaching, ' +
        'film, and honors.',
      chips: [{ t: 'Open the library', kind: 'gold', path: 'library.html', id: null },
        { t: 'Textbooks & chapters', path: 'library.html', id: 'textbooks' },
        chipBook(false)]
    };
  }
  function ansHuman() {
    return {
      html: 'Of course — real people answer during business hours' +
        (LOC_TULSA.hours.length ? ' (' + esc(LOC_TULSA.hours[0]) + ' in Tulsa)' : '') +
        '. Call' + (CAMPUS === 'okc' ? ' ' + esc(LOC_OKC.disp) :
        ' or text ' + esc(LOC_TULSA.disp)) + ' and the consult team takes it from there.',
      chips: [chipCall(), CAMPUS === 'okc' ? chipBook(false) :
        { t: 'Text us', sms: LOC_TULSA.tel }, chipBook(true)]
    };
  }
  function ansPrivacy() {
    return {
      html: 'The privacy policy covers what the website collects, forms and booking, ' +
        'patient photography (published only with written consent), embedded media ' +
        'and analytics. This concierge adds nothing to that: it runs entirely in ' +
        'your browser and sends nothing anywhere.',
      chips: [{ t: 'Privacy policy', kind: 'gold',
        path: campusPath('privacy.html', 'osa/privacy.html'), id: null },
        { t: 'Accessibility', path: campusPath('accessibility.html', 'osa/accessibility.html'), id: null }]
    };
  }
  function ansConsultFree() {
    var f = faqFor(campusPath('pricing.html', 'osa/pricing.html'), /consultation itself free/i) ||
      faqFor('pricing.html', /consultation itself free/i);
    return {
      html: f ? ('<b>' + esc(f.q) + '</b><br>' + esc(f.a)) :
        'Consultation policies are confirmed when you book — call ' + esc(LOC.disp) + '.',
      chips: [chipCall(), chipBook(true)]
    };
  }
  function ansThanks() {
    return {
      html: 'My pleasure. Whenever you’re ready, the fastest doors are below — and ' +
        'I’m here if you want to see anything else on the estate.',
      chips: [chipBook(true), chipCall()]
    };
  }

  /* ---- intent table ------------------------------------------------------- */
  var INTENTS = [
    /* specific intents first; generic conversions (book, campus) last */
    [/\b(thank|thanks|thank you)\b/i, ansThanks],
    [/(financ|carecredit|patientfi|cherry|payment plan|monthly payment)/i, ansFinancing],
    [/(consultation( itself)? free|free consult)/i, ansConsultFree],
    [/(insurance|covered by)/i, ansInsurance],
    [/(special|discount|promo\b|promotion)/i, ansSpecials],
    [/(cost|price|pricing|how much|fees?\b|quote|afford)/i, ansPricing],
    [/(candidate|candidacy|eligib|qualify|right for me|good fit)/i, ansCandidacy],
    [/(recovery|recover|downtime|back to work|healing|swelling|time off)/i, ansRecovery],
    [/(before\s*(&|and|\/)?\s*after|results|gallery|photos|cases)/i, ansResults],
    [/(virtual|video visit|online consult|zoom)/i, ansVirtual],
    [/(fly.?in|flying|travel|out of (state|town)|from out)/i, ansFlyIn],
    [/(hours|open today|what time|when are you open)/i, ansHours],
    [/(address|directions|located|location|where are you|where is|map|parking|find you)/i, ansLocation],
    [/(fellowship|fellows)/i, ansFellowship],
    [/(library|publish|textbook|articles|research)/i, ansLibrary],
    [/(review|rating|testimonial|stars)/i, ansReviews],
    [/(cuzalina|nelson|\beid\b|tolomeo|champion|gutierrez|fogleman|surgeon|doctor|who (will|does|performs))/i, ansSurgeon],
    [/(lymphatic|massage|mld)/i, ansMedspa],
    [/(botox|jeuveau|dysport|xeomin|filler|juvederm|inject(?:ab|or)|morpheus|hydrafacial|facial|peel|laser|ipl|microneedl|med spa|medspa|bella roma|lash|brow|wax|emsculpt|skin ?vive|radiesse|sculptra)/i, ansMedspa],
    [/(glp|weight|semaglutide|peptide|hormone|\bhrt\b|testosterone|pellet|wellness|labs?\b)/i, ansWellness],
    [/(membership|bella club|gift card|refill|store|shop|skincare|skinmedica|obagi|latisse|nutrafol|sunscreen|spf|retinol)/i, ansStore],
    [/(human|real person|someone|front desk|receptionist|talk to)/i, ansHuman],
    [/(privacy|hipaa|consent|data)/i, ansPrivacy],
    [/(book|appointment|schedule|consult)/i, ansBook],
    [/(oklahoma city|okc)/i, ansOKC],
    [/\btulsa\b/i, ansTulsa]
  ];

  function navQuery(q) {
    var m = q.match(/^(?:please\s+)?(?:take me to|go to|open|navigate to|jump to)\s+(.+)$/i);
    return m ? m[1] : null;
  }

  function resolve(q) {
    var navTerm = navQuery(q);
    if (navTerm) {
      var hits = search(navTerm, 5);
      if (hits.length && hits[0].s >= 0.55) {
        var e = hits[0].e;
        if (e.path === CUR.path && !e.id) {
          // the best match is the page we are on — aim for a section instead
          var alt = null;
          for (i = 1; i < hits.length; i++) {
            if (hits[i].s < hits[0].s * 0.7) { break; }
            if (hits[i].e.id) {
              if (hits[i].e.path === CUR.path) { alt = hits[i].e; break; }
              if (!alt) { alt = hits[i].e; }
            }
          }
          if (alt) { e = alt; }
        }
        if (e.path === CUR.path && !e.id) {
          addAnswer({
            html: 'You’re already on it — this is <b>' + esc(e.label) + '</b>. ' +
              'Anything on this page I can take you to?',
            chips: [chipBook(true), chipCall()]
          });
          return;
        }
        addAnswer({
          html: 'Right this way — <b>' + esc(e.label) + '</b>.',
          chips: [{ t: 'Open: ' + e.label.split(' — ')[0], kind: 'gold', path: e.path, id: e.id }]
        });
        setTimeout(function () { goTo(e.path, e.id); }, REDUCED ? 120 : 420);
        return;
      }
    }
    for (var t = 0; t < INTENTS.length; t++) {
      if (INTENTS[t][0].test(q)) { addAnswer(INTENTS[t][1](q)); return; }
    }
    // typed quick-jump: strong match navigates the conversation
    var top = search(q, 3);
    if (top.length && top[0].s >= 0.62) {
      var chips = [];
      for (i = 0; i < top.length && i < 3; i++) {
        chips.push({ t: top[i].e.label.split(' — ')[0], path: top[i].e.path,
          id: top[i].e.id, kind: i === 0 ? 'gold' : 'line' });
      }
      addAnswer({
        html: 'Closest thing on the estate: <b>' + esc(top[0].e.label) +
          '</b>. Shall I take you?',
        chips: chips
      });
      return;
    }
    // honest fallback — never a canned deflection
    var fchips = [chipBook(true), chipCall()];
    var near = '';
    if (top.length) {
      near = '<br><br>Closest matches I do have:';
      for (i = 0; i < top.length; i++) {
        fchips.push({ t: top[i].e.label.split(' — ')[0], path: top[i].e.path, id: top[i].e.id });
      }
    }
    addAnswer({
      html: 'I don’t have that on file — I only answer from this site’s own pages, ' +
        'and I won’t guess. The fastest way to a real answer is the consult team: ' +
        'call ' + esc(LOC.disp) + ' or book below.' + near,
      chips: fchips.slice(0, 4)
    });
  }

  /* ---- suggested prompts per page ---------------------------------------- */
  var PROMPTS = {
    'home': ['What does surgery cost?', 'Show me real before & afters',
      'Meet the surgeons', 'I’m in Oklahoma City', 'Med spa & injectables',
      'Book a consultation'],
    'pricing': ['What does a facelift cost?', 'What does rhinoplasty cost?',
      'Do you offer financing?', 'Is the consultation free?',
      'Does insurance ever apply?'],
    'procedure-rhinoplasty': ['Am I a candidate?', 'What’s recovery like?',
      'Show before & afters', 'What does rhinoplasty cost?', 'Book a consultation'],
    'gallery': ['Show rhinoplasty results', 'Show breast results',
      'Show tummy & body results', 'Who performs these surgeries?', 'What does surgery cost?'],
    'surgeons': ['Tell me about Dr. Cuzalina', 'Who operates in Oklahoma City?',
      'See real results', 'What is the fellowship?', 'Book a consultation'],
    'fellowship': ['What is the fellowship?', 'Who are the current fellows?',
      'Meet the surgeons', 'Book a consultation'],
    'library': ['What has Dr. Cuzalina published?', 'Meet the surgeons',
      'See real results', 'Book a consultation'],
    'medspa': ['Which injectables do you carry?', 'Book with an injector',
      'Current specials', 'Lymphatic massage after surgery', 'Shop skincare'],
    'wellness': ['Am I eligible for GLP-1?', 'What are the peptide programs?',
      'Start a wellness consult', 'Current wellness specials'],
    'store': ['How does The Bella Club work?', 'Set up concierge refills',
      'Buy a gift card', 'Current specials'],
    'contact': ['What are your hours?', 'Get directions', 'Plan a fly-in consult',
      'I’m in Oklahoma City', 'Book a consultation'],
    'okc-guide': ['Which surgeons serve OKC?', 'Get directions', 'What does surgery cost?',
      'Book an OKC consult'],
    'notfound': ['Take me to the homepage', 'See real results', 'What does surgery cost?',
      'Book a consultation'],
    'osa-home': ['What does breast augmentation cost?', 'Which surgeons serve OKC?',
      'See OKC results', 'Get directions', 'Book a consultation'],
    'osa-pricing': ['What does breast augmentation cost?', 'Do you offer financing?',
      'Is the consultation free?', 'Book an OKC consult'],
    'osa-results': ['Show breast results', 'Show rhinoplasty results',
      'What does surgery cost?', 'Book an OKC consult'],
    'osa-surgeons': ['Tell me about Dr. Cuzalina', 'Who is Dr. Fogleman?',
      'See real results', 'Book an OKC consult'],
    'osa-injectables': ['Which injectables do you carry?', 'GLP-1 & wellness in OKC',
      'Shop skincare', 'Book an OKC consult'],
    'osa-wellness': ['Am I eligible for GLP-1?', 'What is HRT here?',
      'Start a wellness consult', 'Call the OKC office'],
    'osa-contact': ['Get directions', 'Can I consult virtually?',
      'Prefer the Tulsa villa?', 'Book an OKC consult']
  };
  function promptsForPage() {
    if (PROMPTS[PAGE]) { return PROMPTS[PAGE]; }
    if (PAGE.indexOf('osa-') === 0) { return PROMPTS['osa-home']; }
    return PROMPTS.home;
  }

  /* ---- open / close / focus trap ----------------------------------------- */
  function isOpen() { return panel.className.indexOf('cg-on') !== -1; }
  var lastFocus = null;
  function openPanel() {
    if (isOpen()) { return; }
    lastFocus = document.activeElement;
    panel.classList.add('cg-on');
    launcher.setAttribute('aria-expanded', 'true');
    if (!log.childNodes.length) { greet(); }
    input.focus();
    saveState();
  }
  function closePanel() {
    closePanelSoft();
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    else { launcher.focus(); }
  }
  function closePanelSoft() {
    panel.classList.remove('cg-on');
    launcher.setAttribute('aria-expanded', 'false');
    saveState();
  }
  function greet() {
    addAnswer({
      html: CAMPUS === 'okc' ?
        'Good day — I’m the estate concierge for the Oklahoma City campus. I answer ' +
        'from this site’s own pages: the surgeons, real results, honest national ' +
        'pricing, injectables, wellness, and the fastest way to book. I can also ' +
        'take you to any page or section — just type where you’d like to go.' :
        'Good day — I’m the estate concierge. I answer from this site’s own pages: ' +
        'procedures and real results, honest national pricing, the surgeons, Bella ' +
        'Roma, wellness, the store — and I can take you to any page or section. ' +
        'Just type where you’d like to go.',
      chips: []
    });
    addPrompts(promptsForPage());
  }

  launcher.addEventListener('click', function () {
    if (isOpen()) { closePanel(); } else { openPanel(); }
  });
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) { e.preventDefault(); closePanel(); return; }
    if (e.key === 'Tab' || e.keyCode === 9) {
      var focusables = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      var list = [];
      for (var f = 0; f < focusables.length; f++) {
        if (focusables[f].offsetParent !== null) { list.push(focusables[f]); }
      }
      if (!list.length) { return; }
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* prompt buttons + internal chips: one delegated listener */
  panel.addEventListener('click', function (e) {
    var node = e.target;
    var promptEl = null, linkEl = null;
    while (node && node !== panel) {
      if (node.getAttribute) {
        if (node.getAttribute('data-cg-prompt')) { promptEl = node; break; }
        if (node.getAttribute('data-cg-path')) { linkEl = node; break; }
      }
      node = node.parentNode;
    }
    if (promptEl) {
      var q = promptEl.getAttribute('data-cg-prompt');
      addUser(q);
      resolve(q);
      return;
    }
    if (linkEl) {
      var p = linkEl.getAttribute('data-cg-path');
      var id = linkEl.getAttribute('data-cg-id');
      if (p === CUR.path) { e.preventDefault(); goTo(p, id); }
      else if (id) { try { sessionStorage.setItem('cgArrive', id); } catch (err) {} }
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.replace(/^\s+|\s+$/g, '');
    if (!q) { return; }
    input.value = '';
    addUser(q);
    resolve(q);
  });

  /* restore a same-session conversation (this tab only) */
  (function restore() {
    var st = loadState();
    if (st && st.msgs && st.msgs.length) {
      for (var n = 0; n < st.msgs.length; n++) {
        log.appendChild(el('div', st.msgs[n].c, st.msgs[n].h));
      }
      scrollLog();
      if (st.open) {
        panel.classList.add('cg-on');
        launcher.setAttribute('aria-expanded', 'true');
      }
    }
  }());
}());
