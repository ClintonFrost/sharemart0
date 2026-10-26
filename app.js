/* =====================================================================
   SHAREMART  -  app.js
   One script that powers every page. Each .html file sets PAGE='...'
   and then calls R(), which draws that page.

   CONTENTS
     1. Basic helpers
     2. Saved data (our "database" in the browser)
     3. Shared helpers (money, stock labels, charts, links)
     4. Product pictures and categories
     5. Notification slider
     6. Page layout (header + footer)
     7. Shop pages ........ home, product, cart, checkout
     8. Account pages ..... login, sign up, become a seller/marketer
     9. Money rules ....... payout split, balance, withdrawals
    10. Dashboards ........ marketer, seller, admin
    11. Info pages ........ about, contact, privacy
    12. Start-up

   SHORT NAMES USED EVERYWHERE
     D  = all saved data        PG = the page functions (PG.home ...)
     H  = draws header/footer   R  = re-draws the current page
     $  = querySelector         E  = makes text safe for HTML
     N  = formats money         V  = value of an input by its id
     me = logged-in user        pr / us = find a product / a user
   ===================================================================== */


/* ---------------------------------------------------------------------
   1. BASIC HELPERS
   --------------------------------------------------------------------- */
var PAGE;                 // each .html file sets this (e.g. 'home')
var PG = {};              // page functions are stored here
var L = localStorage;     // browser storage

function $(selector) { return document.querySelector(selector); }
function V(id) { return $('#' + id).value; }
function N(n) { return '₦' + (Math.round(n * 100) / 100).toLocaleString('en-US'); }
function E(s) { return String(s).replace(/[<>&"]/g, c => '&#' + c.charCodeAt() + ';'); }
function td() { return new Date().toISOString().slice(0, 10); }   // today as YYYY-MM-DD
function uid() { return Math.floor(1e8 + Math.random() * 9e8); }  // unique id for a new record
function rid(list) {                                              // short unique order number
  var n;
  do { n = Math.floor(1e6 + Math.random() * 9e6); } while (list.some(x => x.id == n));
  return n;
}
function short(name) {                                            // "Ife Okoro" -> "Ife O."
  var p = String(name || 'A user').trim().split(/\s+/);
  return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p[0];
}


/* ---------------------------------------------------------------------
   2. SAVED DATA
   Shared data (everyone sees it): D.u users  D.p products  D.o orders
     D.y payouts  D.w withdrawals  D.m messages  D.l activity log
   Private to this browser: D.s logged-in id  D.tok session token
     D.cart  D.ref referral link in use

   Two modes
     - Shared server (Netlify): the lists live on the server. Every change
       is sent there, and every visitor loads the same data.
     - Browser only (file:// or no server): the same lists are kept in
       this browser's storage, so the site still works offline.
   --------------------------------------------------------------------- */
var D = null;               // all data
var API = '';               // server address; empty = browser-only mode
var SNAP = {};              // what the server last sent (to find what changed)
var READY = false;          // data loaded?
var BOOT;                   // loading promise
var SHARED = ['u', 'p', 'o', 'y', 'w', 'm', 'l'];
var PUSHING = false, DIRTY = false;

function me() { return D.u.find(x => x.id == D.s); }
function pr(id) { return D.p.find(x => x.id == id); }
function us(id) { return D.u.find(x => x.id == id); }

function R() {                                      // draw the current page
  if (!READY) {
    $('#app').innerHTML = '<div class=load><i></i>Loading Sharemart…</div>';
    BOOT.then(R);
    return;
  }
  PG[PAGE]();
}

// Starter data (used the first time the site runs)
function makeSeed() {
  return {
    u: [
      [1, 'Admin',      'admin@sharemart.ng',    'admin123',  'admin'],
      [2, 'Ada Stores', 'seller@sharemart.ng',   'seller123', 'seller'],
      [3, 'Chika M.',   'marketer@sharemart.ng', 'market123', 'marketer'],
      [4, 'Tunde B.',   'buyer@sharemart.ng',    'buyer123',  'customer']
    ].map(a => ({
      id: a[0], n: a[1], e: a[2], pw: a[3], r: a[4],
      sl: a[4] == 'seller' ? 1 : 0,                    // is a seller
      mk: a[4] == 'marketer' ? 1 : 0,                  // is a marketer
      kyc: a[4] == 'seller' ? 'approved' : '',         // seller verification
      mv: a[4] == 'marketer' ? 1 : 0,                  // marketer fee paid
      rs: { d: '', c: 0 }                              // reshares today
    })),
    // Products 1-5 have photos in the images folder (product-1.jpg ...); product 6 uses a drawn picture.
    p: [
      ['Dinner Gown',      18000, 12, "Women's Clothing",  '👗', 'An elegant satin dinner gown in dusty rose, with a beaded long-sleeve bodice, a high neckline and a draped overskirt that flows into a graceful train. Made for weddings, galas and formal dinners.'],
      ['Wireless Earbuds', 25000, 30, 'Audio & Headphones', '🎧', 'True wireless earbuds with Hi-Res audio support, deep bass and a compact charging case. Bluetooth connection, touch controls and all-day listening with the case.'],
      ['Blender 1.5L',     32000,  4, 'Kitchen & Dining',  '🥤', 'A powerful countertop blender for smoothies, soups, sauces and crushed ice. Large easy-clean jar, several speed settings and a sturdy non-slip base.'],
      ['Shea Body Butter',  6500, 50, 'Skincare',          '🧴', 'Refined shea butter in a reusable jar with a bamboo lid. Deeply moisturising for skin, hair and lips, smooth to apply and gentle enough for everyday use.'],
      ['Smart Watch',      50000, 15, 'Smart Gadgets',     '⌚', 'A smart watch with a bright square display and a rose-gold finish. Tracks steps, heart rate and sleep, and shows call and message alerts on your wrist.'],
      ['Leather Sandals',  12000, 20, 'Shoes & Sandals',   '👡', 'Handcrafted leather sandals with a cushioned insole and a durable sole, comfortable for everyday wear and easy to dress up.']
    ].map((a, i) => ({
      id: i + 1, sid: 2, n: a[0], pr: a[1], st: a[2], c: a[3], e: a[4], d: a[5],
      col: [['Dusty Rose', 'Black', 'Navy'], ['Black', 'White'], ['Black', 'Red', 'Silver'], [], ['Rose Gold', 'Black', 'Silver'], ['Brown', 'Black', 'Tan']][i],
      pool: i < 3 ? [{ m: 3, pf: 'ok', l: 'https://social.example/chika/' + i }] : []
    })),
    l: [
      { id: uid(), k: 'withdraw', m: 'Ngozi O. withdrew ₦12,300 successfully' },
      { id: uid(), k: 'received', m: 'Tunde B. confirmed goods received — escrow released' },
      { id: uid(), k: 'payout',   m: 'Ada Stores received a payout of ₦17,100' },
      { id: uid(), k: 'withdraw', m: 'Chika M. withdrew ₦4,500 successfully' }
    ]
  };
}

async function boot() {                             // load the data, then pages can draw
  var pv = JSON.parse(L.pv || '{}');
  D = { s: pv.s || 0, cart: pv.cart || [], ref: pv.ref || null, tok: pv.tok || '', u: [], p: [], o: [], y: [], w: [], m: [], l: [], q: 10 };
  if (/^https?:$/.test(location.protocol)) {        // on the web: try the shared server
    API = '/.netlify/functions/api';
    var ok = await pull();
    if (ok === 'empty') { await call('init', { seed: makeSeed() }); ok = await pull(); }
    if (ok !== true) API = '';                      // no server here: work inside this browser only
  }
  if (!API) loadLocal();
  READY = true;
  if (API) {
    setInterval(poll, 15000);                       // pick up other people's changes
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }
}

function loadLocal() {                              // browser-only mode
  var saved = JSON.parse(L.sm || 'null');
  if (saved) D = saved;
  else { var sd = makeSeed(); D = Object.assign(D, { u: sd.u, p: sd.p, l: sd.l, o: [], y: [], w: [], m: [] }); }
  D.w = D.w || []; D.m = D.m || []; D.l = D.l || []; D.tok = D.tok || '';
  D.u.forEach(u => { if (u.r == 'seller') u.sl = 1; if (u.r == 'marketer') u.mk = 1; });
  if (!D.l.length) D.l = makeSeed().l;
  sv();
}

/* ---- talking to the shared server ---- */
async function call(op, body) {                     // returns the server's answer, or null if unreachable
  try {
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ op: op, tok: D.tok }, body)) });
    return r.ok || r.status == 401 ? await r.json() : null;
  } catch (e) { return null; }
}

async function pull() {                             // fetch the latest shared data
  var r = await call('state');
  if (!r || r.error) return false;
  if (r.empty) return 'empty';
  adopt(r);
  return true;
}

function adopt(r) {                                 // replace our copy with the server's
  SHARED.forEach(k => D[k] = r[k] || []);
  D.stats = r.stats || null;
  if (D.s && r.me !== D.s) { D.s = 0; D.tok = ''; } // our login is no longer valid
  SNAP = {};
  SHARED.forEach(k => D[k].forEach(x => SNAP[k + ':' + x.id] = JSON.stringify(x)));
  savePrivate();
}

function savePrivate() { L.pv = JSON.stringify({ s: D.s, cart: D.cart, ref: D.ref, tok: D.tok }); }

function sv() {                                     // save after every change
  savePrivate();
  if (!API) {
    try { L.sm = JSON.stringify(D); }
    catch (e) { alert('Storage full: use fewer or smaller photos.'); }
    return;
  }
  DIRTY = true;
  push();
}

async function push() {                             // send only what changed since the last sync
  if (PUSHING) return;
  PUSHING = true;
  var sent = false;
  while (DIRTY) {
    DIRTY = false;
    var ch = {}, del = [];
    SHARED.forEach(k => D[k].forEach(x => { if (SNAP[k + ':' + x.id] !== JSON.stringify(x)) (ch[k] = ch[k] || []).push(x); }));
    Object.keys(SNAP).forEach(key => { if (key.slice(0, 2) == 'p:' && !D.p.some(x => 'p:' + x.id == key)) del.push(+key.slice(2)); });
    if (!Object.keys(ch).length && !del.length) continue;
    sent = true;
    var r = await call('sync', { changes: ch, del: del });
    if (r && !r.error && !DIRTY) adopt(r);          // the server's merged copy wins
    else if (!r) toast('You seem to be offline, so your last change may not be saved.', '');
  }
  PUSHING = false;
  if (sent) refreshView();
}

async function flush() {                            // wait until every change has been sent
  while (PUSHING || DIRTY) await new Promise(r => setTimeout(r, 40));
}

function sig() { return JSON.stringify([D.p, D.o, D.l.length]); }

async function poll() {                             // every 15 seconds: look for other people's changes
  if (!API || PUSHING || DIRTY || document.hidden) return;
  var before = sig();
  if (await pull() === true && sig() != before) refreshView();
}

function refreshView() {                            // redraw the page unless the person is typing
  if (!READY || !API || !PG[PAGE]) return;
  var a = document.activeElement;
  var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.readOnly;
  var filled = [...document.querySelectorAll('main input:not([readonly]), main textarea')]
    .some(i => i.type == 'checkbox' ? i.checked : i.type == 'file' ? i.files.length : i.value);
  if (!typing && !filled) PG[PAGE]();
}


/* ---------------------------------------------------------------------
   3. SHARED HELPERS
   --------------------------------------------------------------------- */
// Stock label shown on every product: [css class, text]
function av(p) {
  if (p.st <= 0) return ['out', 'Out of stock'];
  if (p.st <= 5) return ['low', 'Almost finished · ' + p.st + ' left'];
  if (p.st <= 15) return ['ltd', 'Limited stock'];
  return ['ok', 'In stock'];
}

// Referral link for product p from marketer m
function link(p, m) {
  return new URL(`product.html?id=${p}&ref=${m}`, location.href).href;
}

// Simple bar chart.  rows = [[label, amount], ...]
function bars(rows) {
  var max = Math.max(1, ...rows.map(x => x[1]));
  return '<div class=ch>' + rows.map(x =>
    `<div><small>${N(x[1])}</small><b style="height:${x[1] / max * 75}%"></b><i>${x[0]}</i></div>`
  ).join('') + '</div>';
}

// Dashboard banner
function dh(icon, title, text) {
  return `<div class=dh><span>${icon}</span><div><h2>${title}</h2><p>${text}</p></div></div>`;
}

// Shown when a page needs a role the visitor does not have
function need(role) {
  H(`<p class=n>Please <a href=login.html>log in</a> as ${role} to view this page.</p>`);
}


/* ---------------------------------------------------------------------
   4. PRODUCT PICTURES AND CATEGORIES
   --------------------------------------------------------------------- */
// Drawn illustrations for the six sample products: [colour 1, colour 2, shapes]
var AR = {
  1: ['#ffe3d1', '#ffc9a8', [
    '<path d="M85 30l15 10 15-10 8 30-10 8 22 56H50l22-56-10-8z" fill="#e8742a"/>',
    '<path d="M100 40l15-10 8 30-10 8 22 56h-35z" fill="#0003"/>',
    '<g fill="#fff9"><circle cx="80" cy="95" r="5"/><circle cx="105" cy="105" r="5"/><circle cx="125" cy="90" r="4"/><circle cx="90" cy="75" r="3"/></g>'
  ].join('')],
  2: ['#2a2d3e', '#4b5169', [
    '<g id="pod"><ellipse cx="78" cy="62" rx="16" ry="20" fill="#f4f4f6"/><rect x="74" y="74" width="8" height="36" rx="4" fill="#dcdce4"/><ellipse cx="72" cy="55" rx="5" ry="8" fill="#fff"/></g>',
    '<use href="#pod" x="44" y="6"/>'
  ].join('')],
  3: ['#dff3ff', '#bfe3f7', [
    '<path d="M72 25h56l-8 70H80z" fill="#cfe9f5" fill-opacity=".8" stroke="#fff" stroke-width="2"/>',
    '<path d="M78 60h44l-3 35H81z" fill="#f2a65a" opacity=".9"/>',
    '<rect x="68" y="18" width="64" height="9" rx="4" fill="#333"/>',
    '<path d="M76 95h48l6 30H70z" fill="#2d3748"/>',
    '<circle cx="100" cy="110" r="5" fill="#e53e3e"/>',
    '<path d="M82 32l-4 55" stroke="#fff" stroke-width="3" opacity=".8"/>'
  ].join('')],
  4: ['#fff3d6', '#ffe0a3', [
    '<rect x="62" y="58" width="76" height="60" rx="10" fill="#f5e6c8"/>',
    '<rect x="58" y="42" width="84" height="20" rx="6" fill="#8b5a2b"/>',
    '<rect x="72" y="76" width="56" height="24" rx="4" fill="#fff"/>',
    '<path d="M80 86h40M84 93h32" stroke="#8b5a2b" stroke-width="3"/>',
    '<rect x="66" y="58" width="8" height="58" rx="4" fill="#fff8"/>'
  ].join('')],
  5: ['#e6e9f5', '#c9cfe8', [
    '<rect x="82" y="8" width="36" height="134" rx="10" fill="#2b2f3a"/>',
    '<rect x="66" y="40" width="68" height="68" rx="18" fill="#111827" stroke="#9ca3af" stroke-width="3"/>',
    '<rect x="72" y="46" width="56" height="56" rx="13" fill="#0b132b"/>',
    '<text x="100" y="80" font-size="17" fill="#6ee7b7" text-anchor="middle" font-family="monospace">10:09</text>',
    '<circle cx="100" cy="92" r="3" fill="#f87171"/>',
    '<path d="M76 52q12-6 24-6" stroke="#fff" stroke-width="2" opacity=".5" fill="none"/>'
  ].join('')],
  6: ['#f9e4cf', '#eec9a0', [
    '<path d="M40 100c0-18 22-30 50-30s70 12 70 28-30 22-70 22-50-6-50-20z" fill="#b5651d"/>',
    '<path d="M70 84c10-18 42-18 54 0" fill="none" stroke="#7a3e0a" stroke-width="9" stroke-linecap="round"/>',
    '<path d="M78 100c10-9 30-9 44 0" fill="none" stroke="#7a3e0a" stroke-width="7" stroke-linecap="round"/>'
  ].join('')]
};

// Illustration for a product. A real photo saved as images/product-N.jpg
// is laid on top automatically; if it is missing the image removes itself.
function art(p) {
  var a = AR[p.id];
  if (!a) return `<div class=em>${p.e}</div>`;
  return `<svg viewBox="0 0 200 150"><defs>
    <linearGradient id="g${p.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></linearGradient>
    <radialGradient id="s${p.id}"><stop offset="0" stop-color="#0006"/><stop offset="1" stop-color="#0000"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#g${p.id})"/>
    <ellipse cx="100" cy="128" rx="55" ry="9" fill="url(#s${p.id})"/>${a[2]}</svg>
    <img src="images/product-${p.id}.jpg" onerror="this.remove()">`;
}

// Picture box: seller's uploaded photo if there is one, else the illustration
function pic(p) {
  return `<div class=pw>${p.im && p.im[0] ? `<img src="${p.im[0]}">` : art(p)}</div>`;
}

// Product categories shown in the seller's "Add product" form
var CG = {
  'Fashion & Accessories': ["Women's Clothing", "Men's Clothing", "Kids' Clothing", 'Traditional & Ankara Wear', 'Shoes & Sandals', 'Bags & Luggage', 'Jewellery', 'Watches'],
  'Electronics':           ['Phones & Tablets', 'Computers & Laptops', 'Audio & Headphones', 'TVs & Home Theatre', 'Cameras', 'Gaming', 'Smart Gadgets'],
  'Home & Living':         ['Kitchen & Dining', 'Furniture', 'Home Appliances', 'Bedding & Decor', 'Lighting', 'Cleaning Supplies'],
  'Beauty & Health':       ['Skincare', 'Hair Care & Wigs', 'Makeup', 'Fragrances', 'Health & Wellness', 'Personal Care'],
  'Food & Groceries':      ['Groceries', 'Snacks & Beverages', 'Fresh Produce', 'Spices & Condiments'],
  'Kids & Baby':           ['Baby Care', 'Toys & Games', 'School Supplies'],
  'Sports & Outdoors':     ['Sports & Fitness', 'Camping & Outdoors', 'Bicycles'],
  'Automotive & Tools':    ['Car Parts & Accessories', 'Motorcycles', 'Tools & Hardware', 'Building Materials'],
  'Office & Media':        ['Office Supplies', 'Books & Stationery', 'Musical Instruments', 'Art & Crafts'],
  'Pets & Farm':           ['Pet Supplies', 'Farm & Agro Inputs'],
  'Other':                 ['Other']
};

// Colours a seller can offer. Anything typed in "other colours" is also accepted.
var COLORS = { 'Black': '#111111', 'White': '#ffffff', 'Red': '#d93025', 'Blue': '#1a73e8', 'Navy': '#1f2a5a', 'Green': '#1b9e63', 'Yellow': '#f5c518', 'Orange': '#f57c00', 'Pink': '#f48fb1', 'Purple': '#8e44ad', 'Brown': '#8b5a2b', 'Tan': '#d2b48c', 'Beige': '#e8d9b5', 'Grey': '#9aa0a6', 'Silver': '#c0c0c0', 'Gold': '#d4af37', 'Rose Gold': '#b76e79', 'Dusty Rose': '#c48b9f' };

function sw(c) { return COLORS[c] || c.replace(/\s+/g, ''); }          // swatch colour for a name

function dots(p) {                                   // little colour dots on cards and lists
  var l = p.col || [];
  if (!l.length) return '';
  return `<span class=dots>${l.slice(0, 5).map(c => `<i title="${E(c)}" style="background:${E(sw(c))}"></i>`).join('')}${l.length > 5 ? `<small>+${l.length - 5}</small>` : ''}</span>`;
}

function colorBox(sel) {                             // seller form: choose available colours
  sel = sel || [];
  var extra = sel.filter(c => !COLORS[c]).join(', ');
  return `<div class=box style="margin:10px 0"><b>🎨 Available colours</b> <small>(tick every colour you stock; leave empty if the product has no colour options)</small>
    <div class=cp>${Object.keys(COLORS).map(c => `<label class=cl><input type=checkbox value="${c}" ${sel.includes(c) ? 'checked' : ''}><i style="background:${COLORS[c]}"></i>${c}</label>`).join('')}</div>
    <input id=pcx placeholder="Other colours, separated by commas (e.g. Teal, Maroon)" value="${E(extra)}"></div>`;
}

function catopt(sel) {           // <option> list built from the categories above
  return Object.entries(CG).map(([group, list]) =>
    `<optgroup label="${group}">${list.map(c => `<option ${c == sel ? 'selected' : ''}>${E(c)}</option>`).join('')}</optgroup>`
  ).join('');
}


/* ---------------------------------------------------------------------
   5. NOTIFICATION SLIDER  (the banner at the very top of every page)
   NX = messages shown right now   D.l = saved activity log
   --------------------------------------------------------------------- */
var IC = { withdraw: '💸', payout: '✅', received: '📦', ok: '🎉', reward: '🎁', seller: '🏪', marketer: '📣', product: '🆕', stock: '⏳' };
var LB = { withdraw: 'WITHDRAWAL SUCCESSFUL', payout: 'PAYOUT RELEASED', received: 'GOODS RECEIVED', ok: 'NOTICE', reward: 'MARKETER REWARD', seller: 'NEW SELLER', marketer: 'NEW MARKETER', product: 'NEW LISTING', stock: 'LOW STOCK' };
var NAMES = ['Ngozi O.', 'Tunde B.', 'Chika M.', 'Ada S.', 'Emeka N.', 'Fatima K.', 'Bola A.', 'Kelechi U.', 'Zainab M.', 'Seun O.', 'Amaka E.', 'Ibrahim Y.', 'Funke A.', 'Obinna C.', 'Halima S.', 'Tobi A.'];
var SHOPS = ['Ada Stores', 'Kemi Fashion', 'Eze Foods', 'Lagos Gadgets', 'Bisi Beauty', 'Nuel Home', 'Zara Styles', 'Okoye Electronics'];
var CUR = null;      // news item showing now
var BUSY = false;    // a slide is moving
var NQ = [];         // real events waiting to be shown
var NT;              // timer
var NK = 0, LASTK = '';

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function amt(lo, hi) { return N(Math.round((lo + Math.random() * (hi - lo)) / 50) * 50); }

// The next piece of news. It never runs out: every fourth item replays a
// recorded event, the rest are generated sample activity (and live stock levels).
function nextNews() {
  NK++;
  if (NK % 4 == 0) {
    var recorded = D.l.filter(x => x.r);
    if (recorded.length) { var x = recorded[Math.floor(NK / 4) % recorded.length]; return { k: x.k, m: x.m, tag: 'recorded activity' }; }
  }
  var p = pick(D.p), low = D.p.filter(x => x.st > 0 && x.st <= 15), item;
  do {
    item = [
      () => ({ k: 'payout',   m: 'Payout of ' + amt(2000, 60000) + ' released to ' + pick(SHOPS) }),
      () => ({ k: 'withdraw', m: pick(NAMES) + ' withdrew ' + amt(1000, 40000) + ' successfully' }),
      () => ({ k: 'received', m: pick(NAMES) + ' confirmed goods received — escrow released' }),
      () => ({ k: 'reward',   m: 'Marketer reward of ' + amt(300, 3500) + ' paid to ' + pick(NAMES) }),
      () => ({ k: 'seller',   m: pick(SHOPS) + ' is now a verified seller' }),
      () => ({ k: 'marketer', m: pick(NAMES) + ' became a Verified Marketer' }),
      () => ({ k: 'product',  m: 'New listing: ' + E(p.n) + ' in ' + E(p.c) }),
      () => { var q = pick(low.length ? low : D.p); return { k: 'stock', m: E(q.n) + ': only ' + q.st + ' left in stock', tag: 'live stock' }; }
    ][Math.floor(Math.random() * 8)]();
  } while (item.k == LASTK);
  LASTK = item.k;
  return item;
}

function slideHtml(x) {
  return `<div class="ni ${x.k}"><span>${IC[x.k] || '🔔'}</span><div><small>${LB[x.k] || 'NOTICE'}</small><p>${x.m}</p></div><em>${x.real ? 'just now' : x.tag || 'sample activity'}</em></div>`;
}

function ns() {                                      // draw the banner (called by H)
  var box = $('#ns');
  if (!box) return;
  if (!CUR) CUR = nextNews();
  BUSY = false;
  box.innerHTML = `<span class=live>● LIVE</span><div class=nv><div class=nt>${slideHtml(CUR)}</div></div>`;
}

function advance(item) {                             // slide the next news in from the right
  var track = $('.nt');
  if (!track) { if (item) CUR = item; return; }
  if (BUSY) { if (item) NQ.unshift(item); return; }
  item = item || NQ.shift() || nextNews();
  BUSY = true; CUR = item;
  track.insertAdjacentHTML('beforeend', slideHtml(item));
  track.style.transition = 'transform .8s cubic-bezier(.65,0,.25,1)';
  track.getBoundingClientRect();                     // force the browser to notice
  track.style.transform = 'translateX(-100%)';
  setTimeout(() => {                                 // drop the old slide, reset position
    if (track.firstElementChild) track.firstElementChild.remove();
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    BUSY = false;
    if (NQ.length) setTimeout(() => advance(), 1200);   // show waiting real events soon
  }, 850);
}

function tick() { advance(); NT = setTimeout(tick, NQ.length ? 2200 : 4500); }
function nstart() { clearTimeout(NT); NT = setTimeout(tick, 4500); }

function toast(message, kind) {                      // show a real message at once
  advance({ k: kind || '', m: message, real: true });
  nstart();
}

// Log an event, save it, and show it (optionally after a delay in ms).
// 'ok' notices are shown but not saved to the activity log.
function note(kind, message, delay) {
  if (kind != 'ok' && !API) {                        // on the shared server the server keeps the log
    D.l.unshift({ id: uid(), k: kind, m: message, r: 1 });
    D.l.length = Math.min(D.l.length, 30);
  }
  sv();
  setTimeout(() => toast(message, kind), delay || 0);
}

function showEvents(list) {                          // show notices the server sent back
  (list || []).forEach(e => setTimeout(() => toast(e.m, e.k), e.d || 0));
}

// Popup card that drops in at the top of the screen, wherever you have scrolled to
function popup(icon, title, text, bad) {
  var box = $('#pp');
  if (!box) { box = document.createElement('div'); box.id = 'pp'; document.body.appendChild(box); }
  var card = document.createElement('div');
  card.className = 'pop' + (bad ? ' bad' : '');
  card.innerHTML = `<span>${icon}</span><div><b>${title}</b><p>${text}</p></div><button onclick="this.parentNode.remove()">✕</button>`;
  box.appendChild(card);
  setTimeout(() => { card.classList.add('x'); setTimeout(() => card.remove(), 500); }, 5500);
}


/* ---------------------------------------------------------------------
   6. PAGE LAYOUT  -  H(content) draws header, content and footer
   --------------------------------------------------------------------- */
function accountMenu(u) {                            // dropdown on computers
  if (!u) return '<a href=login.html>Login / Sign up</a>';
  var items = u.r == 'admin'
    ? `<a href=admin.html>Admin panel</a>`
    : `<a href=cart.html>My orders</a>`
      + (u.sl ? `<a href=seller.html>Seller dashboard</a>`
              : `<a href=# onclick="become('sl');return false">Become a seller</a>`)
      + (u.mk ? `<a href=marketer.html>Marketer dashboard</a>`
              : `<a href=# onclick="become('mk');return false">Become a marketer</a>`);
  return `<div class=dd><a href=# onclick="return false">👤 ${E(u.n.split(' ')[0])} ▾</a>`
       + `<div class=dm>${items}<a href=# onclick="logout();return false">Logout</a></div></div>`;
}

function menuItems(u, cartCount) {                   // links in the three-dot menu on phones
  var a = (label, href) => `<a href="${href}">${label}</a>`;
  var h = a('🏠 Shop', 'index.html') + a('ℹ️ About us', 'about.html') + a('✉️ Contact us', 'contact.html')
        + a('🔒 Privacy policy', 'privacy.html') + a(`🛒 Cart (${cartCount})`, 'cart.html') + '<hr>';
  if (!u) return h + a('👤 Login / Sign up', 'login.html');
  if (u.r == 'admin') h += a('🛡️ Admin panel', 'admin.html');
  else {
    h += a('📦 My orders', 'cart.html');
    h += u.sl ? a('🏪 Seller dashboard', 'seller.html') : `<a href=# onclick="become('sl');return false">🏪 Become a seller</a>`;
    h += u.mk ? a('📣 Marketer dashboard', 'marketer.html') : `<a href=# onclick="become('mk');return false">📣 Become a marketer</a>`;
  }
  return h + `<a href=# onclick="logout();return false">🚪 Logout (${E(u.n.split(' ')[0])})</a>`;
}

function menu(e) {                                   // open / close the three-dot menu
  e.stopPropagation();
  $('#mm').classList.toggle('open');
}

async function logout() {
  D.s = 0; D.tok = '';
  sv();
  await flush();
  location = 'index.html';
}

function H(content) {
  var u = me();
  var cartCount = D.cart.reduce((a, x) => a + x.q, 0);
  var animate = window.f ? '' : 'anim';      // entrance animation only on first draw
  window.f = 1;

  $('#app').innerHTML =
    `<header><a href=index.html class=lg>🛍 Sharemart</a><nav><a href=index.html>Shop</a><a href=about.html>About</a><a href=contact.html>Contact</a><a href=cart.html>Cart (${cartCount})</a>${accountMenu(u)}</nav>
      <a href=cart.html class=ct>🛒<b>${cartCount}</b></a><button class=kb onclick="menu(event)" aria-label="Menu">⋮</button></header>
    <div id=mm class=mm>${menuItems(u, cartCount)}</div>
    <main class="${animate}"><div id=ns class=ns></div>${content}</main>
    ${footer()}`;

  ns();
  nstart();
}


/* ---------------------------------------------------------------------
   6b. SHARED CONTENT BLOCKS  (used by several pages)
   --------------------------------------------------------------------- */
var CATICON = { 'Fashion & Accessories': '👗', 'Electronics': '🎧', 'Home & Living': '🏠', 'Beauty & Health': '💄', 'Food & Groceries': '🛒', 'Kids & Baby': '🧸', 'Sports & Outdoors': '⚽', 'Automotive & Tools': '🔧', 'Office & Media': '📚', 'Pets & Farm': '🐾' };

var FAQ = [
  ['Is my money safe when I pay?', 'Yes. Your payment is held in escrow by Sharemart. The seller is paid only after you confirm that your goods arrived.'],
  ['What if my goods do not arrive?', 'Do not confirm receipt. Your payment stays in escrow while you contact us with your order number and we look into it.'],
  ['What does "Almost finished" mean?', 'A product marked Almost finished has 5 or fewer units left. "Limited stock" means 15 or fewer, and Out of stock items cannot be added to the cart.'],
  ['How do I become a seller?', 'Create a free account, open the account menu and choose Become a seller. Submit your ID number, pass the liveness check, and once an administrator approves you can list products with photos.'],
  ['How do marketer rewards work?', "Verified marketers (one-time fee of ₦3,000) join a product's pool and reshare it. When a sale comes through a pool link, 5% of the price is divided equally among the pool, and members with an approved proof-of-repost link are paid."],
  ['Can I be a buyer, seller and marketer at once?', 'Yes. One account does it all. Use the account menu to switch between your orders, your seller dashboard and your marketer dashboard.'],
  ['What does Sharemart charge?', 'The Company takes a 5% commission, only on completed sales. Buyers pay the listed price and nothing more.'],
  ['When can I withdraw my earnings?', 'As soon as a buyer confirms receipt, your share appears as available balance on your dashboard and you can withdraw it.']
];

function sec(title, sub, html) {
  return `<div class=sec><h2>${title}</h2>${sub ? `<p class=sub>${sub}</p>` : ''}${html}</div>`;
}
function faq(list) {
  return `<div class=box>${list.map(x => `<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('')}</div>`;
}
function stepsRow(list) {
  return `<div class=steps>${list.map((x, i) => `<div><b>${i + 1}</b><h4>${x[0]}</h4><p>${x[1]}</p></div>`).join('')}</div>`;
}
function band(title, text, buttons) {
  return `<div class=band><div><h2>${title}</h2><p>${text}</p></div><div class=row>${buttons}</div></div>`;
}
function guide(title, items, tip) {                  // numbered how-to box used on dashboards
  return `<div class=box style="margin-top:18px"><h3>${title}</h3><ol class=gl>${items.map(x => `<li>${x}</li>`).join('')}</ol>${tip ? `<p class=n>💡 ${tip}</p>` : ''}</div>`;
}
function stats() {                                   // live numbers from the saved data
  var paid = D.stats ? D.stats.paid : D.y.filter(y => y.t == 'seller' || y.t == 'marketer').reduce((a, y) => a + y.a, 0);
  var done = D.stats ? D.stats.completed : D.o.filter(o => o.st == 'completed').length;
  return `<div class=sb>${[
    [D.p.length, 'Products listed'], [D.u.filter(u => u.sl).length, 'Sellers'], [D.u.filter(u => u.mk).length, 'Marketers'],
    [done, 'Orders completed'], [N(paid), 'Paid out to sellers and marketers']
  ].map(x => `<div><b>${x[0]}</b>${x[1]}</div>`).join('')}</div>`;
}
function footer() {
  return `<footer><div class=fg>
    <div><h4>🛍 Sharemart</h4><p>Secure online shopping with escrow-protected payments and shared marketing rewards.</p></div>
    <div><h4>Shop</h4><a href=index.html>All products</a><a href=cart.html>Cart</a><a href=cart.html>My orders</a></div>
    <div><h4>Sell &amp; earn</h4><a href=# onclick="become('sl');return false">Become a seller</a><a href=# onclick="become('mk');return false">Become a marketer</a><a href=about.html>How it works</a></div>
    <div><h4>Company</h4><a href=about.html>About us</a><a href=contact.html>Contact us</a><a href=privacy.html>Privacy policy</a></div>
    <div><h4>Support</h4><p>support@sharemart.ng<br>Mon–Fri, 9am–5pm (WAT)</p></div></div>
    <div class=fb>© 2026 Sharemart · Demonstration project: payments are simulated · 5% Company commission · 5% marketer pool</div></footer>`;
}
function subscribe() {
  var e = V('ne').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return popup('⚠️', 'Check your email', 'Please enter a valid email address, for example name@example.com.', true);
  D.m.unshift({ id: uid(), n: 'Newsletter', e, m: 'Subscribed to the newsletter', d: td() });
  sv();
  $('#ne').value = '';
  popup('📬', 'Subscribed successfully!', 'Thank you, ' + E(e) + '. You will now receive Sharemart news and offers.');
}

/* ---------------------------------------------------------------------
   7. SHOP PAGES
   --------------------------------------------------------------------- */
var CF = '';     // category filter chosen on the homepage
var CS = [];     // list of categories that have products
var SC = '';     // colour chosen on the product page
var SP = 0;      // product that colour belongs to
var EDIT = 0;    // product being edited by the seller (0 = none)

function card(p, i) {                              // one product card
  var a = av(p);
  return `<a class=card style="--i:${i}" href="product.html?id=${p.id}">${pic(p)}<span class="bd ${a[0]}">${a[1]}</span><h3>${E(p.n)}</h3><b>${N(p.pr)}</b>${dots(p)}<br><small>${E(p.c)} · Pool ${p.pool.length}/100</small></a>`;
}

// "Sell on Sharemart" / "Earn as a marketer" boxes on the homepage
function cta() {
  var u = me();
  if (u && u.r == 'admin') return '';
  function button(flag, page, word, label) {
    if (!u) return '<a href=login.html><button>Create a free account</button></a>';
    return u[flag]
      ? `<a href=${page}><button>Open ${label} dashboard</button></a>`
      : `<button onclick="become('${flag}')">Become a ${word}</button>`;
  }
  return `<div class=g style="margin-bottom:14px">
    <div class=box><h3>🏪 Sell on Sharemart</h3><p>List products with photos and get paid safely through escrow.</p>${button('sl', 'seller.html', 'seller', 'seller')}</div>
    <div class=box><h3>📣 Earn as a marketer</h3><p>Reshare products and share a 5% pool reward.</p>${button('mk', 'marketer.html', 'marketer', 'marketer')}</div></div>`;
}

PG.home = () => {
  var q = ($('#q') || {}).value || '';
  var list = D.p.filter(p => p.n.toLowerCase().includes(q.toLowerCase()) && (!CF || p.c == CF || (CG[CF] && CG[CF].includes(p.c))));
  CS = [...new Set(D.p.map(p => p.c))];

  var hero = `<section class=hero><div><h1>Shop safe. Share. Earn.</h1><p>Your payment is held in escrow until you confirm delivery. Every verified marketer who reshares a product shares 5% of its sale price.</p><div class=row><button onclick="$('#shop').scrollIntoView({behavior:'smooth'})">Start shopping</button>${me() ? '' : '<a href=login.html><button class=s>Join free</button></a>'}</div></div><div class=hs><div><b>100%</b>escrow protected</div><div><b>5%</b>marketer rewards</div><div><b>${D.p.length}</b>products live</div></div></section>`;
  var trust = `<div class=tb><span>🔒 Escrow protected</span><span>✅ Verified sellers</span><span>📦 Delivery confirmation</span><span>💸 Fast payouts</span></div>`;
  var chips = `<div class=chips><button class="${CF ? 's' : ''}" onclick="CF='';R()">All</button>${CS.map((c, i) => `<button class="${CF == c ? '' : 's'}" onclick="CF=CS[${i}];R()">${E(c)}</button>`).join('')}</div>`;
  var tiles = `<div class=tiles>${Object.keys(CG).filter(g => g != 'Other').map((g, i) =>
    `<div class=tile onclick="CF=Object.keys(CG)[${i}];R();$('#shop').scrollIntoView({behavior:'smooth'})"><span>${CATICON[g]}</span><b>${g}</b><small>${D.p.filter(p => CG[g].includes(p.c)).length} products</small></div>`).join('')}</div>`;
  var voices = infoCards([
    ['💬', 'Ngozi O. · Buyer', '"I paid, waited for my goods and only released the money after checking them. That peace of mind is why I shop here."'],
    ['💬', 'Ada S. · Seller', '"Listing was quick once my verification was approved, and I am paid as soon as the buyer confirms."'],
    ['💬', 'Chika M. · Marketer', '"I share products on my page and earn from the pool without chasing anyone for payment."']
  ]);

  H(hero + trust + cta()
    + sec('Shop by category', 'Browse a wide range of products from verified sellers.', tiles)
    + `<h2 id=shop>Browse products</h2>`
    + `<div class=bar><input id=q placeholder="🔍 Search products" value="${E(q)}" oninput=R()></div>`
    + chips
    + `<div class=g>${list.map(card).join('') || '<p>No products found.</p>'}</div>`
    + sec('How Sharemart works', 'Four simple steps from checkout to payout.', stepsRow([
        ['Browse and choose', 'Search products from verified sellers and check availability at a glance.'],
        ['Pay into escrow', 'Your money is held safely by Sharemart. The seller cannot touch it yet.'],
        ['Receive and confirm', 'Give your delivery address, follow the order, and confirm when the goods arrive.'],
        ['Everyone gets paid', 'The seller, the Company and the marketer pool each receive their share.']]))
    + sec('Why shop with Sharemart', 'Built so that buyers, sellers and marketers can all trust the process.', infoCards([
        ['🔒', 'Escrow protection', 'Money moves to the seller only after you confirm delivery.'],
        ['✅', 'Verified sellers', 'Every seller passes KYC and a liveness check before listing.'],
        ['💰', 'Transparent pricing', 'You pay the listed price. The 5% commission is taken from completed sales only.'],
        ['📣', 'Shared rewards', 'Marketers in a pool split 5% of each sale made through their links.'],
        ['🔔', 'Live activity', 'Payouts, withdrawals and deliveries appear instantly in the banner at the top.'],
        ['⚡', 'One account', 'Buy, sell and market from a single account, switching roles any time.']]))
    + band('📣 Turn your social media into income', 'Become a verified marketer for a one-time ₦3,000 fee, reshare up to 50 products a day and share 5% of every sale made through your pool links.',
        `<button onclick="become('mk')">Become a marketer</button><a href=about.html><button class=s>Learn more</button></a>`)
    + sec('Sharemart at a glance', 'Live figures from the marketplace.', stats())
    + sec('Community voices', 'Sample feedback shown for demonstration.', voices)
    + sec('Frequently asked questions', 'Quick answers to common questions.', faq(FAQ.slice(0, 6)))
    + `<div class="box nl"><div><h3>📬 Stay in the loop</h3><p>Get news about new sellers, products and marketer rewards.</p></div><div class=row><input id=ne placeholder="Your email address"><button onclick=subscribe()>Subscribe</button></div></div>`);

  if (q) { var box = $('#q'); box.focus(); box.setSelectionRange(q.length, q.length); }   // keep typing
};

PG.product = () => {
  var params = new URLSearchParams(location.search);
  var p = pr(params.get('id')), u = me();
  if (!p) return H('Product not found.');

  if (params.get('ref')) { D.ref = { p: p.id, m: +params.get('ref') }; sv(); }   // remember referral

  var n = p.pool.length;
  var mine = u && p.pool.find(m => m.m == u.id);       // my pool entry, if any
  var isMarketer = u && u.mk && u.mv;
  var a = av(p), seller = us(p.sid) || { n: 'Seller' };
  var cols = p.col || [];
  if (SP != p.id) { SP = p.id; SC = cols[0] || ''; }          // default to the first colour
  var picker = cols.length
    ? `<div class=colors><b>Colour:</b> <span>${E(SC)}</span><div class=swr>${cols.map((c, i) => `<button class="swb ${c == SC ? 'on' : ''}" title="${E(c)}" onclick="pickColor(${i})"><i style="background:${E(sw(c))}"></i></button>`).join('')}</div></div>`
    : '';
  var related = D.p.filter(x => x.id != p.id && x.c == p.c).concat(D.p.filter(x => x.id != p.id && x.c != p.c)).slice(0, 4);

  var gallery = p.im && p.im.length > 1
    ? `<div class=gal>${p.im.map(i => `<img src="${i}">`).join('')}</div>`
    : pic(p);

  H(`<p class=bc><a href=index.html>Shop</a> › ${E(p.c)} › ${E(p.n)}</p>
    <div class=pd>
      <div class=box>${gallery}</div>
      <div class=box>
        <span class="bd ${a[0]} in">${a[1]}</span>
        <h2>${E(p.n)}</h2>
        <h3 class=pr>${N(p.pr)}</h3>
        <p>Sold by <b>${E(seller.n)}</b> ✅ verified seller</p>
        <div class=stk><div><b class="${a[0]}" style="width:${Math.min(100, p.st * 4)}%"></b></div><small>${p.st} units in stock · ${E(p.c)}</small></div>
        ${picker}<ul class=ck><li>🔒 Paid into escrow, released only after you confirm delivery</li><li>📦 Delivery address is collected after payment</li><li>💬 Support available if anything goes wrong</li></ul>
        <div class=pool>🎁 <b>Reward pool: ${n}/100 marketers</b><br>If sold through a marketer's link, 5% (${N(p.pr * .05)}) is split equally among the pool${n ? ` ≈ ${N(p.pr * .05 / n)} each` : ''}.</div>
        <div class=row><button ${p.st <= 0 ? 'disabled' : ''} onclick="add(${p.id})">${p.st <= 0 ? 'Out of stock' : '🛒 Add to cart'}</button>${isMarketer ? `<button class=s onclick="share(${p.id})">${mine ? 'Show my referral link' : 'Reshare & join pool'}</button>` : ''}</div>
        ${mine ? `<p>Your link: <input readonly size=40 value="${link(p.id, u.id)}"></p>` : ''}
      </div>
    </div>
    <div class=g3>
      <div class=box><h3>📝 About this product</h3><p>${p.d ? E(p.d) : 'The seller has not added a description yet. Contact us if you need more details before buying.'}</p></div>
      <div class=box><h3>🔒 Buyer protection</h3><p>Pay now and your money stays in escrow. When your goods arrive, confirm receipt and the seller is paid. Until then the seller cannot withdraw the funds.</p></div>
      <div class=box><h3>📣 Earn by sharing</h3><p>Verified marketers can reshare this product and join its pool. Every sale through a pool link rewards the pool with 5% of the price, shared equally.</p></div>
    </div>
    <h2>You may also like</h2><div class=g>${related.map(card).join('')}</div>`);
};

function pickColor(i) {                              // buyer picks a colour
  SC = (pr(SP).col || [])[i];
  R();
}

function add(id) {                                   // add to cart (never more than the stock)
  var p = pr(id), colour = SC || '';
  var have = D.cart.filter(x => x.pid == id).reduce((a, x) => a + x.q, 0);       // all colours together
  if (have >= p.st) return toast('Only ' + p.st + ' available in stock.', '');
  var line = D.cart.find(x => x.pid == id && (x.c || '') == colour);
  line ? line.q++ : D.cart.push({ pid: id, q: 1, c: colour });
  sv(); R();
}

function share(id) {                                 // marketer joins a product's pool
  var u = me(), p = pr(id), r = u.rs;
  if (r.d != td()) r = { d: td(), c: 0 };            // new day, reset the counter
  if (!p.pool.find(m => m.m == u.id)) {
    if (r.c >= 50) return alert('Daily reshare limit (50) reached.');
    if (p.pool.length >= 100) return alert('Pool is full (100).');
    p.pool.push({ m: u.id, pf: 'none', l: '' });
    r.c++;
  }
  u.rs = r; sv(); R();
}

PG.cart = () => {
  var u = me(), total = 0;
  D.cart = D.cart.filter(x => pr(x.pid));            // ignore products that were removed
  var orders = u ? D.o.filter(o => o.cid == u.id).reverse() : [];

  var rows = D.cart.map((x, i) => {
    var p = pr(x.pid);
    total += p.pr * x.q;
    return `<div class=ci>${pic(p)}<div><b>${E(p.n)}</b><br><small>${N(p.pr)} × ${x.q}${x.c ? ` · Colour: <i class=sd style="background:${E(sw(x.c))}"></i> ${E(x.c)}` : ''}</small></div><b>${N(p.pr * x.q)}</b><button class=r onclick="D.cart.splice(${i},1);sv();R()">✕</button></div>`;
  }).join('');

  function tracker(o) {                              // Paid -> Shipped -> Received
    var step = ['paid', 'shipped', 'completed'].indexOf(o.st);
    return `<div class=trk>${['Paid in escrow', 'Shipped', 'Received & paid out'].map((x, i) => `<span class="${i <= step ? 'on' : ''}">${x}</span>`).join('')}</div>`;
  }

  function action(o) {                               // what the buyer can do next
    if (!o.addr) return `<input id=a${o.id} placeholder="Delivery address"> <button onclick="addr(${o.id})">Save address</button>`;
    if (o.st == 'shipped') return `<button onclick="conf(${o.id})">✔ Confirm goods received</button>`;
    if (o.st == 'completed') return '✔ Delivered and paid out';
    return 'Awaiting seller to ship';
  }

  var cartBox = rows
    ? `<div class=cg><div>${rows}</div><div class=box><h3>Order summary</h3><p>Items <b style=float:right>${D.cart.reduce((a, x) => a + x.q, 0)}</b></p><p>Total <b style=float:right>${N(total)}</b></p><p><small>🔒 Held in escrow until you confirm delivery.</small></p><button onclick=checkout()>Pay ${N(total)}</button></div></div>`
    : '<div class=box>Your cart is empty. <a href=index.html>Browse products</a></div>';

  var orderBoxes = orders.map(o =>
    `<div class=box style="margin-bottom:12px"><b>#${o.id} · ${E((pr(o.pid) || { n: 'Removed product' }).n)} ×${o.q}${o.col ? ' · ' + E(o.col) : ''}</b> <span class=tag>${o.es}</span><b style=float:right>${N(o.price)}</b>${tracker(o)}<p>${action(o)}</p></div>`
  ).join('') || '<div class=box>No orders yet.</div>';

  var more = D.p.filter(x => !D.cart.find(c => c.pid == x.id)).slice(0, 4);
  H(`<section class="hero ph2"><div><h1>🛒 Your cart</h1><p>Review your items, pay into escrow and follow each order until it arrives.</p></div></section>${cartBox}
    <h2>📦 My orders</h2>${orderBoxes}
    ${infoCards([['🔒', 'Escrow protected', 'Your payment is held until you confirm delivery.'], ['📦', 'Track every step', 'Paid, shipped and received are shown on each order.'], ['💬', 'Need help?', 'Contact support with your order number and we will look into it.']])}
    <h2>You may also like</h2><div class=g>${more.map(card).join('')}</div>`);
};

function checkout() {                                // pay: money goes into escrow
  var u = me();
  if (!u) return location = 'login.html';
  D.cart = D.cart.filter(x => pr(x.pid));            // ignore products that were removed
  var wanted = {};                                   // total per product, all colours together
  for (var x of D.cart) {
    wanted[x.pid] = (wanted[x.pid] || 0) + x.q;
    if (pr(x.pid).st < wanted[x.pid]) return alert('Not enough stock: ' + pr(x.pid).n);
  }
  D.cart.forEach(x => {
    var p = pr(x.pid), r = D.ref;
    p.st -= x.q;
    D.o.push({
      id: rid(D.o), cid: u.id, pid: p.id,
      mid: r && r.p == p.id && p.pool.find(m => m.m == r.m) ? r.m : null,   // referring marketer
      q: x.q, col: x.c || '', price: p.pr * x.q, es: 'held', st: 'paid', addr: '', d: td()
    });
  });
  D.cart = [];
  sv();
  alert('Payment received and held in escrow. Please enter your delivery address.');
  R();
}

function addr(id) {                                  // buyer saves delivery address
  var v = V('a' + id).trim();
  if (!v) return;
  D.o.find(o => o.id == id).addr = v;
  sv(); R();
}

async function conf(id) {                            // buyer confirms goods received
  if (API) {                                         // on the shared server the payout is worked out there
    await flush();
    var r = await call('confirm', { id });
    if (!r || r.error) return alert('Could not confirm yet. Please try again in a moment.');
    adopt(r); showEvents(r.ev);
    return R();
  }
  release(D.o.find(o => o.id == id));
  sv(); R();
}


/* ---------------------------------------------------------------------
   8. ACCOUNT PAGES
   --------------------------------------------------------------------- */
PG.login = () => H(`<div class=auth>
  <div class=ap><h2>Welcome to Sharemart</h2><p>Shop with confidence, sell to more customers, or earn by sharing.</p>
    <ul><li>🔒 Escrow-protected payments</li><li>✅ Verified sellers only</li><li>📣 Shared 5% marketer rewards</li><li>⚡ One account: become a seller or marketer any time</li></ul><div class=qt>"I only released the money after my goods arrived. That is why I trust Sharemart."<small>Ngozi O. · Buyer (sample feedback)</small></div></div>
  <div class=af>
    <div class=tabs><button id=t1 onclick=tab(1)>Login</button><button id=t2 class=s onclick=tab(2)>Sign up</button></div>
    <div id=lf><h3>Welcome back</h3>
      <label>Email<input id=le placeholder="you@example.com"></label>
      <label>Password<input id=lp type=password placeholder="Password"></label>
      <button onclick=login()>Log in</button>
      <p><small>By continuing you agree to our <a href=privacy.html>Privacy policy</a>.</small></p>
      <p><small>Demo accounts: ${API ? '' : 'admin@sharemart.ng/admin123 · '}seller@sharemart.ng/seller123 · marketer@sharemart.ng/market123 · buyer@sharemart.ng/buyer123</small></p></div>
    <div id=rf hidden><h3>Create your account</h3><small>One account for everyone. Become a seller or marketer later from the account menu.</small>
      <label>Full name<input id=rn></label>
      <label>Email<input id=re></label>
      <label>Phone<input id=rt></label>
      <label>Password<input id=rp type=password></label>
      <button onclick=reg()>Create account</button></div>
  </div></div>`);

function tab(n) {                                    // switch Login / Sign up tabs
  $('#lf').hidden = n != 1;
  $('#rf').hidden = n != 2;
  $('#t1').className = n == 1 ? '' : 's';
  $('#t2').className = n == 2 ? '' : 's';
}

async function login() {
  var email = V('le').trim(), pw = V('lp');
  if (API) {
    var r = await call('login', { email, pw });
    if (!r || r.error) return alert(r && r.error ? r.error : 'Could not reach the server. Please try again.');
    D.tok = r.tok; D.s = r.uid;
    savePrivate();
    await pull();
  } else {
    var u = D.u.find(x => x.e == email && x.pw == pw);
    if (!u) return alert('Wrong email or password');
    D.s = u.id; sv();
  }
  location = me() && me().r == 'admin' ? 'admin.html' : 'index.html';
}

async function reg() {                               // everyone signs up as a customer
  var e = V('re').trim(), n = V('rn').trim(), p = V('rp');
  if (!e || !n || !p) return alert('Fill all fields');
  if (API) {
    var r = await call('register', { name: n, email: e, phone: V('rt'), pw: p });
    if (!r || r.error) return alert(r && r.error ? r.error : 'Could not reach the server. Please try again.');
    D.tok = r.tok; D.s = r.uid;
  } else {
    if (D.u.find(x => x.e == e)) return alert('Email already registered');
    var u = {
      id: uid(),
      n, e, ph: V('rt'), pw: p, r: 'customer', sl: 0, mk: 0, kyc: '', mv: 0, rs: { d: '', c: 0 }
    };
    D.u.push(u);
    D.s = u.id;
  }
  L.fl = 'Welcome, ' + n.split(' ')[0] + '! Your account is ready — open the account menu to become a seller or marketer.';
  sv();
  location = 'index.html';
}

async function become(role) {                        // role: 'sl' = seller, 'mk' = marketer
  var u = me();
  if (!u) return location = 'login.html';
  u[role] = 1;
  L.fl = role == 'sl'
    ? 'You are now a seller — complete KYC to start listing products.'
    : 'You are now a marketer — pay the ₦3,000 verification to start earning.';
  sv();
  await flush();                                     // make sure the change reached the server
  location = role == 'sl' ? 'seller.html' : 'marketer.html';
}


/* ---------------------------------------------------------------------
   9. MONEY RULES
   --------------------------------------------------------------------- */
function pay(order, to, userId, amount) {            // record one payout (browser-only mode)
  D.y.push({ id: uid(), o: order.id, t: to, u: userId, a: amount });
}

// Released when the buyer confirms receipt  (Algorithm 4.1 in the report)
//   Company  : 5% of the sale
//   Pool     : another 5% when the sale came from a marketer's link,
//              divided by everyone in the pool; only marketers whose
//              proof link is approved ('ok') are paid
//   Seller   : the rest
// On the shared server the same calculation runs in netlify/functions/api.mjs.
function release(o) {
  var p = pr(o.pid);
  var companyShare = o.price * .05;
  var sellerShare;

  if (o.mid) {
    var poolShare = o.price * .05;
    var perMarketer = poolShare / p.pool.length;
    sellerShare = o.price - companyShare - poolShare;
    p.pool.forEach(m => { if (m.pf == 'ok') pay(o, 'marketer', m.m, perMarketer); });
  } else {
    sellerShare = o.price - companyShare;
  }

  pay(o, 'company', 1, companyShare);
  pay(o, 'seller', p.sid, sellerShare);
  o.es = 'released';
  o.st = 'completed';

  // notifications (staggered so they slide in one after another)
  note('received', E(short(us(o.cid).n)) + ' confirmed goods received — escrow released');
  note('payout', 'Payout of ' + N(sellerShare) + ' released to ' + E(short(us(p.sid).n)), 1400);
  D.y.filter(y => y.o == o.id && y.t == 'marketer').forEach((y, k) =>
    note('payout', 'Marketer reward of ' + N(y.a) + ' paid to ' + E(short(us(y.u).n)), 2800 + k * 1400));
}

function bal(u) {                                    // money available to withdraw
  var earned = D.y.filter(y => (y.t == 'seller' || y.t == 'marketer') && y.u == u.id).reduce((a, y) => a + y.a, 0);
  var taken = D.w.filter(w => w.u == u.id).reduce((a, w) => a + w.a, 0);
  return earned - taken;
}

async function wd() {                                // withdraw everything available
  var u = me(), b = bal(u);
  if (b <= 0) return toast('No funds available to withdraw yet.', '');
  if (API) {
    await flush();
    var r = await call('withdraw');
    if (!r || r.error) return toast((r && r.error) || 'Withdrawal failed. Please try again.', '');
    adopt(r); showEvents(r.ev);
    return R();
  }
  D.w.push({ id: uid(), u: u.id, a: b, d: td() });
  note('withdraw', E(short(u.n)) + ' withdrew ' + N(b) + ' successfully');
  R();
}


/* ---------------------------------------------------------------------
   10. DASHBOARDS
   --------------------------------------------------------------------- */

/* ---- Marketer ---- */
PG.marketer = () => {
  var u = me();
  if (!u || !u.mk) return need('a marketer');
  var banner = dh('📣', 'Marketer dashboard', 'Welcome back, ' + E(u.n) + '. Reshare products and earn from the marketer pool.');

  if (!u.mv) {                                       // must pay the ₦3,000 fee first
    return H(`${banner}<div class=box><p>Pay the one-time <b>₦3,000</b> verification fee to become a Verified Marketer and reshare products.</p><button onclick="payFee()">Pay ₦3,000 (simulated)</button></div>`);
  }

  var pools = D.p.filter(p => p.pool.find(m => m.m == u.id));
  var mine = D.y.filter(y => y.t == 'marketer' && y.u == u.id);
  var total = mine.reduce((a, y) => a + y.a, 0);
  var used = u.rs.d == td() ? u.rs.c : 0;
  var status = { none: 'no proof', pending: 'pending review', ok: 'verified', no: 'rejected' };

  var chart = bars(pools.map(p => [
    p.n.slice(0, 9),
    mine.filter(y => pr(D.o.find(o => o.id == y.o).pid) == p).reduce((a, y) => a + y.a, 0)
  ]));

  var rows = pools.map(p => {
    var m = p.pool.find(m => m.m == u.id);
    return `<tr><td>${E(p.n)}<td>${p.pool.length}/100<td><input readonly size=22 value="${link(p.id, u.id)}"><td><input id=l${p.id} value="${E(m.l)}" placeholder="Link to your post"><button onclick="proof(${p.id})">Submit</button><td><span class=tag>${status[m.pf]}</span>`;
  }).join('') || '<tr><td colspan=5>Open a product page and click "Reshare & join pool".';

  H(`${banner}
    <div class=st><div>Total earned<b>${N(total)}</b></div><div>Pools joined<b>${pools.length}</b></div><div>Reshares today<b>${used}/50</b></div><div>Available<b>${N(bal(u))}</b></div></div>
    <p><button onclick=wd()>Withdraw ${N(bal(u))}</button></p>
    <h3>Earnings per product</h3>${chart}
    <h3>My pools &amp; referral links</h3>
    <table><tr><th>Product<th>Pool<th>Referral link<th>Proof of repost<th>Status</tr>${rows}</table>${guide('How you earn as a marketer', ['Pay the one-time ₦3,000 verification fee.', 'Open a product page and click Reshare &amp; join pool (up to 50 a day, 100 marketers per pool).', 'Post your referral link on your page and submit the link to your post as proof.', 'An administrator reviews your proof link.', 'When a buyer confirms a sale made through a pool link, 5% of the price is divided equally among the pool and your share is paid if your proof is approved.'], 'Example: on a ₦20,000 sale through a pool of 10 marketers, ₦1,000 goes to the pool and each member gets ₦100.')}`);
};

function payFee() {                                  // simulated ₦3,000 verification payment
  var u = me();
  u.mv = 1;
  D.y.push({ id: uid(), o: 0, t: 'fee', u: 1, a: 3000 });
  sv(); R();
}

function proof(id) {                                 // marketer submits proof-of-repost link
  var m = pr(id).pool.find(m => m.m == D.s), v = V('l' + id).trim();
  if (!v) return;
  m.l = v;
  m.pf = 'pending';
  sv(); R();
}

/* ---- Seller ---- */
PG.seller = () => {
  var u = me();
  if (!u || !u.sl) return need('a seller');

  var products = D.p.filter(p => p.sid == u.id);
  var orders = D.o.filter(o => products.find(p => p.id == o.pid));
  var mine = D.y.filter(y => y.t == 'seller' && y.u == u.id);
  var k = u.kyc;                                     // '', 'pending', 'approved', 'rejected'

  var kycBox;
  var ep = EDIT ? products.find(p => p.id == EDIT) : null;      // product being edited, if any
  if (k == 'approved') {
    kycBox = `<h3>${ep ? 'Edit product' : 'Add product'}</h3>
      <div class=row><input id=pn placeholder=Name value="${ep ? E(ep.n) : ''}"><input id=pd placeholder=Description value="${ep ? E(ep.d || '') : ''}"><input id=pp type=number placeholder="Price ₦" value="${ep ? ep.pr : ''}"><input id=ps type=number placeholder=Stock value="${ep ? ep.st : ''}"><select id=pc>${catopt(ep && ep.c)}</select></div>
      ${colorBox(ep && ep.col)}
      <div class=row><label>📷 Photos (up to 4): <input id=pi type=file accept=image/* multiple></label><button onclick=addp()>${ep ? 'Save changes' : 'List product'}</button>${ep ? '<button class=s onclick="editp(0)">Cancel</button>' : ''}</div>
      <small>${ep ? 'Leave the photos empty to keep the current ones. Your changes are visible to everyone as soon as you save.' : 'Your listing is visible to everyone as soon as you list it. A referral link and an empty marketer pool are created automatically.'}</small>`;
  } else if (k == 'pending') {
    kycBox = '<p class=n>KYC submitted — waiting for admin review.</p>';
  } else {
    kycBox = `<div class=box><h3>KYC &amp; liveness verification</h3>${k == 'rejected' ? '<p class=n>Previous submission rejected. Please resubmit.</p>' : ''}
      <div class=row><input id=ki placeholder="ID number (NIN / passport)"><button class=s onclick="runLiveness()">Run liveness check</button><button onclick=kycs()>Submit for review</button></div></div>`;
  }

  var chart = bars(products.map(p => [
    p.n.slice(0, 9),
    mine.filter(y => D.o.find(o => o.id == y.o).pid == p.id).reduce((a, y) => a + y.a, 0)
  ]));

  var productRows = products.map(p =>
    `<tr><td>${p.im && p.im[0] ? `<img class=th src="${p.im[0]}"> ` : p.e + ' '}${E(p.n)} ${dots(p)}<td>${N(p.pr)}<td>${p.st}<td>${p.pool.length}<td><button onclick="editp(${p.id})">Edit</button> <button class=r onclick="D.p=D.p.filter(x=>x.id!=${p.id});sv();R()">Remove</button>`
  ).join('');

  var orderRows = orders.map(o =>
    `<tr><td>${o.id}<td>${E((pr(o.pid) || { n: 'Removed product' }).n)} ×${o.q}${o.col ? ' (' + E(o.col) + ')' : ''}<td>${N(o.price)}<td>${o.es}<td>${o.st}<td>${E(o.addr) || '—'}<td>${o.st == 'paid' && o.addr ? `<button onclick="D.o.find(o=>o.id==${o.id}).st='shipped';sv();R()">Mark shipped</button>` : ''}`
  ).join('');

  H(`${dh('🏪', 'Seller dashboard', 'Welcome back, ' + E(u.n) + '. List products, ship orders and withdraw your earnings.')}
    <div class=st><div>Net payouts<b>${N(mine.reduce((a, y) => a + y.a, 0))}</b></div><div>Products<b>${products.length}</b></div><div>Orders<b>${orders.length}</b></div><div>KYC<b>${k || 'not started'}</b></div><div>Available<b>${N(bal(u))}</b></div></div>
    <p><button onclick=wd()>Withdraw ${N(bal(u))}</button></p>
    ${kycBox}
    <h3>Payouts per product</h3>${chart}
    <h3>My products</h3><table><tr><th>Name<th>Price<th>Stock<th>Pool<th></tr>${productRows}</table>
    <h3>Orders</h3><table><tr><th>#<th>Item<th>Amount<th>Escrow<th>Status<th>Delivery<th></tr>${orderRows}</table>${guide('Seller guide', ['Submit your ID number and pass the liveness check. An administrator approves your account.', 'List products with a clear description, up to four photos, the colours you offer and an accurate stock count. Labels such as Limited stock and Almost finished update automatically.', 'When an order is paid and the buyer has given a delivery address, ship it and click Mark shipped.', 'The buyer confirms receipt and your earnings appear as available balance, ready to withdraw.'], 'On a ₦20,000 sale the Company takes ₦1,000 (5%). If the sale came through a marketer link, a further ₦1,000 goes to the marketer pool.')}`);
};

function runLiveness() {                             // simulated liveness check
  var u = me();
  u.lv = 1;
  sv();
  alert('Liveness check passed (simulated)');
}

function kycs() {                                    // submit KYC for admin review
  var u = me();
  if (!V('ki').trim() || !u.lv) return alert('Enter an ID number and run the liveness check first.');
  u.kyc = 'pending';
  u.idn = V('ki');
  sv(); R();
}

// Shrink an uploaded photo to max 500px so it fits in browser storage
function rz(file) {
  return new Promise(resolve => {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      var k = Math.min(1, 500 / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = img.width * k;
      canvas.height = img.height * k;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', .7));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function editp(id) {                                 // load a product into the form (0 = cancel)
  EDIT = id;
  R();
  if (id && $('#pn')) $('#pn').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function addp() {                              // seller lists a new product, or saves an edit
  var name = V('pn').trim(), price = +V('pp'), stock = +V('ps');
  if (!name || price <= 0 || stock < 0) return alert('Enter valid details');
  var photos = (await Promise.all([...$('#pi').files].slice(0, 4).map(rz))).filter(Boolean);
  var colours = [...document.querySelectorAll('.cp input:checked')].map(i => i.value);   // ticked colours
  V('pcx').split(',').map(x => x.trim()).filter(Boolean).forEach(x => {                  // typed colours
    x = x.charAt(0).toUpperCase() + x.slice(1);
    if (!colours.some(c => c.toLowerCase() == x.toLowerCase())) colours.push(x);
  });
  if (EDIT) {                                        // save changes to an existing product
    var p = pr(EDIT);
    p.n = name; p.d = V('pd').trim(); p.pr = price; p.st = stock; p.c = V('pc'); p.col = colours;
    if (photos.length) p.im = photos;                // keep the old photos unless new ones were chosen
    EDIT = 0;
    sv(); R();
    return popup('✅', 'Changes saved', E(name) + ' has been updated and everyone can see the changes now.');
  }
  D.p.push({
    id: uid(),
    sid: D.s, n: name, d: V('pd').trim(), pr: price, st: stock,
    c: V('pc'), e: '📦', im: photos, col: colours, pool: []
  });
  sv(); R();
  popup('✅', 'Product listed', E(name) + ' is now visible to everyone on Sharemart.');
}

/* ---- Admin ---- */
PG.admin = () => {
  var u = me();
  if (!u || u.r != 'admin') return need('an administrator');

  var pendingKyc = D.u.filter(x => x.kyc == 'pending');
  var pendingProofs = [];
  D.p.forEach(p => p.pool.forEach(m => { if (m.pf == 'pending') pendingProofs.push([p, m]); }));
  var commission = D.y.filter(y => y.t == 'company');

  var kycRows = pendingKyc.map(s =>
    `<tr><td>${E(s.n)}<td>${E(s.idn)}${s.lv ? ' · liveness ✔' : ''}<td><button onclick="dec(${s.id},'approved')">Approve</button> <button class=r onclick="dec(${s.id},'rejected')">Reject</button>`
  ).join('') || '<tr><td colspan=3>Nothing pending';

  var proofRows = pendingProofs.map(([p, m]) =>
    `<tr><td>${E(us(m.m).n)}<td>${E(p.n)}<td>${E(m.l)}<td><button onclick="pv(${p.id},${m.m},'ok')">Approve</button> <button class=r onclick="pv(${p.id},${m.m},'no')">Reject</button>`
  ).join('') || '<tr><td colspan=4>Nothing pending';

  var messageRows = D.m.map(m =>
    `<tr><td>${E(m.n)}<td>${E(m.e)}<td>${E(m.m)}<td>${m.d}`
  ).join('') || '<tr><td colspan=4>No messages';

  var orderRows = D.o.map(o =>
    `<tr><td>${o.id}<td>${E(pr(o.pid) ? pr(o.pid).n : '')}${o.col ? ' (' + E(o.col) + ')' : ''}<td>${E(us(o.cid).n)}<td>${o.mid ? 'Marketer: ' + E(us(o.mid).n) : 'Direct'}<td>${N(o.price)}<td>${o.es}<td>${o.st}`
  ).join('');

  H(`${dh('🛡️', 'Admin panel', 'Welcome back, ' + E(u.n) + '. Review verifications, monitor escrow and track commission.')}
    <div class=st><div>Commission earned<b>${N(commission.reduce((a, y) => a + y.a, 0))}</b></div><div>Marketer fees<b>${N(D.y.filter(y => y.t == 'fee').reduce((a, y) => a + y.a, 0))}</b></div><div>Held in escrow<b>${N(D.o.filter(o => o.es == 'held').reduce((a, o) => a + o.price, 0))}</b></div></div>
    <h3>Commission per order</h3>${bars(commission.map(y => ['#' + y.o, y.a]))}
    <h3>Seller KYC reviews</h3><table><tr><th>Seller<th>ID<th></tr>${kycRows}</table>
    <h3>Proof-of-repost reviews</h3><table><tr><th>Marketer<th>Product<th>Link<th></tr>${proofRows}</table>
    <h3>Contact messages</h3><table><tr><th>From<th>Email<th>Message<th>Date</tr>${messageRows}</table>
    <h3>Escrow &amp; order monitor</h3><table><tr><th>#<th>Product<th>Buyer<th>Channel<th>Amount<th>Escrow<th>Status</tr>${orderRows}</table>${guide('Administrator checklist', ['Review pending seller KYC submissions and approve or reject them.', 'Review proof-of-repost links so eligible marketers can be paid.', 'Watch the escrow monitor for orders that stay unshipped or unconfirmed.', 'Read and answer contact messages and newsletter sign-ups.'], 'Commission shown above is 5% of every completed sale.')}`);
};

function dec(userId, status) {                       // admin approves/rejects seller KYC
  us(userId).kyc = status;
  sv(); R();
}

function pv(productId, marketerId, status) {         // admin approves/rejects a proof link
  pr(productId).pool.find(x => x.m == marketerId).pf = status;
  sv(); R();
}


/* ---------------------------------------------------------------------
   11. INFO PAGES
   --------------------------------------------------------------------- */
function infoCards(items) {                          // grid of icon cards
  return `<div class=g3>${items.map(x => `<div class=box><div class=ic>${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join('')}</div>`;
}
function pageHero(title, text) {
  return `<section class="hero ph2"><div><h1>${title}</h1><p>${text}</p></div></section>`;
}

PG.about = () => H(pageHero('About Sharemart', 'A marketplace where trust is built into every sale.')
  + `<div class=cg2><div class=box><h3>🎯 Our mission</h3><p>To make online buying and selling in Nigeria safe, fair and rewarding, so that no buyer pays for goods they never receive and no honest seller is left without payment.</p></div>
     <div class=box><h3>🔭 Our vision</h3><p>A trusted marketplace where independent sellers reach more customers, and everyday people earn by helping good products get noticed.</p></div></div>`
  + sec('Why we built Sharemart', '', `<div class=box><p>Many small traders still depend on a physical shop front, which limits how many customers they can reach and how fast they can grow. Online platforms solve part of that problem, but they bring their own: high entry barriers for small sellers, little protection for buyers who pay first, and promotion systems that reward only the seller.</p><p>Sharemart answers all three. Payments are held in escrow until delivery is confirmed. Sellers are verified before they can list. And marketers who help a product get noticed share a fixed reward, so promotion becomes a team effort instead of a cost.</p></div>`)
  + sec('What we stand for', '', infoCards([
      ['🔒', 'Trust first', 'Every payment is held by the Company and released only when you confirm delivery.'],
      ['✅', 'Verified sellers', 'Sellers pass KYC and a liveness check before they can list a product.'],
      ['📣', 'Shared rewards', 'Marketers in a pool split 5% of the sale price when a sale comes through their link.'],
      ['💼', 'Fair commission', 'The Company earns 5% only on completed sales.'],
      ['🔍', 'Transparency', 'Stock levels, pool sizes and order progress are visible at every step.'],
      ['🤝', 'Opportunity', 'Anyone can start as a buyer and later become a seller or marketer from one account.']]))
  + sec('How escrow works', 'From payment to payout in five steps.', stepsRow([
      ['You pay', 'Your payment goes into escrow, not to the seller.'],
      ['You give an address', 'Delivery details are collected only after payment and shown only to the seller.'],
      ['Seller ships', 'The seller prepares the order and marks it as shipped.'],
      ['You confirm', 'When the goods arrive in good condition, you confirm receipt.'],
      ['Payout', 'The Company takes 5%, the marketer pool receives its reward (if any), and the seller gets the rest.']]))
  + sec('Trust and safety', '', `<div class=box><ul class=ck><li>Seller identity checked through an ID number and a liveness check</li><li>Marketer proof-of-repost links reviewed by an administrator before rewards are paid</li><li>Role-based access: only administrators can approve sellers and proofs</li><li>Every payout and withdrawal is recorded and announced in the activity banner</li></ul></div>`)
  + sec('Sharemart in numbers', 'Live figures from the marketplace.', stats())
  + sec('Frequently asked questions', '', faq(FAQ))
  + band('Ready to get started?', 'Create a free account in under a minute and shop, sell or earn.', `<a href=login.html><button>Create an account</button></a><a href=contact.html><button class=s>Talk to us</button></a>`));

PG.contact = () => H(pageHero('Contact us', 'We usually reply within one working day.')
  + `<div class=cg2>
    <div class=box><h3>Send us a message</h3>
      <label>Name<input id=cn></label>
      <label>Email<input id=ce></label>
      <label>Message<textarea id=cm rows=6></textarea></label>
      <button onclick=send()>Send message</button></div>
    <div>
      <div class=box><div class=ic>✉</div><h3>Email</h3><p>support@sharemart.ng</p></div>
      <div class=box><div class=ic>🕘</div><h3>Opening hours</h3><p>Mon–Fri, 9am–5pm (WAT). Messages sent outside these hours are answered the next working day.</p></div>
      <div class=box><div class=ic>🛡️</div><h3>Order problem?</h3><p>Include your order number and do not confirm receipt until the issue is resolved.</p></div>
    </div></div>`
  + sec('How quickly we respond', '', `<table><tr><th>Topic<th>What to include<th>Typical reply</tr>
      <tr><td>Order or delivery problem<td>Order number and a short description<td>Same working day
      <tr><td>Seller or marketer verification<td>Your account email<td>1 – 2 working days
      <tr><td>Payouts and withdrawals<td>Date and amount<td>1 working day
      <tr><td>General questions<td>Your question<td>1 working day</table>`)
  + sec('Before you write', 'These answers may save you time.', faq(FAQ.slice(0, 4))));

function send() {                                    // contact form -> saved for the admin
  var n = V('cn').trim(), e = V('ce').trim(), m = V('cm').trim();
  if (!n || !e || !m) return popup('⚠️', 'Missing details', 'Please fill in your name, email and message.', true);
  D.m.unshift({ id: uid(), n, e, m, d: td() });
  sv();
  popup('✉️', 'Message sent', 'Thank you, ' + E(n) + '. We will reply to ' + E(e) + ' within one working day.');
  R();
}

var POL = [
  ['Introduction', ['Sharemart ("we", "us") runs an online marketplace where buyers pay into escrow, sellers are verified, and marketers earn a shared reward. This policy explains what information we collect, why we collect it and the choices you have.', 'By creating an account or using the site you agree to the practices described here.']],
  ['Information we collect', ['<b>Account details:</b> your name, email address, phone number and password.', '<b>Order details:</b> products ordered, amounts paid, delivery address and order history.', '<b>Seller verification:</b> an identification number and the result of a liveness check.', '<b>Marketer activity:</b> products you reshare, your referral links and proof-of-repost links.', '<b>Messages:</b> anything you send us through the Contact page or newsletter form.']],
  ['How we use your information', ['To create and secure your account, process escrow payments and orders, and release payouts and withdrawals.', 'To verify sellers and marketers, review proof links, and calculate the 5% commission and marketer rewards.', 'To answer your messages and to send the notifications you see on the site.']],
  ['Escrow and payments', ['Payments are held in escrow until you confirm delivery. In this demonstration, payments are simulated and no real money moves. In a live version, card and bank details would be handled by a licensed payment provider and never stored by Sharemart.']],
  ['Sharing your information', ['Your delivery address is shown only to the seller of the product you ordered. Administrators can see account, verification and order information needed to run the marketplace.', 'We do not sell your personal data to anyone.']],
  ['Activity notifications', ['Payout, withdrawal and delivery notices appear in a banner at the top of each page. Names in these notices are shortened (for example "Ngozi O.") and amounts are shown, but no contact details are ever displayed.']],
  ['Cookies and browser storage', ["This demonstration keeps your data in your own browser's local storage so the site works without a server. It is not shared with other devices. Clearing your browser data removes it."]],
  ['How long we keep data', ['We keep account and order records for as long as your account is active and for as long as needed to resolve disputes and meet legal obligations. You may ask us to delete your account at any time.']],
  ['Security', ['Access to dashboards is role-based. A live deployment would use encrypted connections and store passwords only as secure hashes. Please choose a strong password and do not share it.']],
  ['Your rights', ['You may ask to see, correct or delete the personal data we hold about you, and to stop receiving newsletters. Contact us through the Contact page and we will respond within one working day.']],
  ['Children', ['Sharemart is intended for adults. We do not knowingly collect information from children.']],
  ['Changes to this policy', ['We may update this policy from time to time. The date at the top of the page shows when it was last changed.']],
  ['Contact us', ['Questions about this policy? Write to support@sharemart.ng or use the <a href=contact.html>Contact page</a>.']]
];

PG.privacy = () => H(pageHero('Privacy policy', 'How Sharemart collects, uses and protects your information. Last updated October 2026.')
  + `<div class=pol><nav class=toc><b>On this page</b>${POL.map((x, i) => `<a href="#s${i + 1}" onclick="$('#s${i + 1}').scrollIntoView({behavior:'smooth'});return false">${i + 1}. ${x[0]}</a>`).join('')}</nav>
     <div>${POL.map((x, i) => `<div class=box id=s${i + 1} style="margin-bottom:14px"><h3>${i + 1}. ${x[0]}</h3>${x[1].map(t => `<p>${t}</p>`).join('')}</div>`).join('')}</div></div>`);


/* ---------------------------------------------------------------------
   12. START-UP
   --------------------------------------------------------------------- */
// Close the phone menu when you tap elsewhere, and fade the page out
// (after any unsaved change has reached the server) before moving to another page
document.addEventListener('click', e => {
  if (!e.target.closest('.mm, .kb')) { var m = $('#mm'); if (m) m.classList.remove('open'); }
  var a = e.target.closest('a'), href = a && a.getAttribute('href');
  if (href && /\.html/.test(href) && !e.ctrlKey) {
    e.preventDefault();
    document.body.classList.add('out');
    Promise.all([flush(), new Promise(r => setTimeout(r, 220))]).then(() => location = a.href);
  }
});
document.addEventListener('keydown', e => { if (e.key == 'Escape') { var m = $('#mm'); if (m) m.classList.remove('open'); } });
addEventListener('pageshow', () => document.body.classList.remove('out'));

// Start loading the shared data now; pages draw themselves when R() is called
BOOT = boot();

// Message saved before a page change (e.g. the welcome notice after sign-up)
if (L.fl) {
  var flash = L.fl;
  delete L.fl;
  BOOT.then(() => setTimeout(() => toast(flash, 'ok'), 600));
}
