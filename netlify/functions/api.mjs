/* =====================================================================
   SHAREMART  -  shared server  (Netlify Function + Netlify Blobs)

   One endpoint:  /.netlify/functions/api   (POST, JSON)
   Everything every visitor must see (products, orders, payouts ...) is
   stored here, so a listing added or edited by a seller appears for
   everyone, on every device.

   What the server does
     init      first visit only: stores the starter users and products
     register  creates an account (password stored as a salted hash)
     login     checks the password and returns a signed session token
     state     returns the data the caller is allowed to see
     sync      saves changes sent by the browser, after checking the rules
     confirm   buyer confirms receipt: the server calculates the payout
     withdraw  moves a user's available balance out
   ===================================================================== */
import crypto from 'node:crypto';

const COLS = ['u', 'p', 'o', 'y', 'w', 'm', 'l'];        // users, products, orders, payouts, withdrawals, messages, log
const IMG = '/.netlify/functions/api?img=';

/* ---------- small helpers ---------- */
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const uid = () => Math.floor(1e8 + Math.random() * 9e8);
const today = () => new Date().toISOString().slice(0, 10);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const money = n => '₦' + (Math.round(n * 100) / 100).toLocaleString('en-US');
const short = n => { const p = String(n || 'A user').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : p[0]; };

/* ---------- passwords and session tokens ---------- */
const hash = (pw, salt = crypto.randomBytes(8).toString('hex')) => salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
const same = (pw, stored) => {
  try { const a = Buffer.from(hash(pw, stored.split(':')[0])), b = Buffer.from(stored); return a.length === b.length && crypto.timingSafeEqual(a, b); }
  catch { return false; }
};
async function getSecret(st) {
  let s = await st.get('secret');
  if (!s) { await st.set('secret', crypto.randomBytes(32).toString('hex'), { onlyIfNew: true }); s = await st.get('secret'); }
  return s;
}
const sign = (secret, id) => {
  const b = Buffer.from(JSON.stringify({ u: id, e: Date.now() + 30 * 864e5 })).toString('base64url');
  return b + '.' + crypto.createHmac('sha256', secret).update(b).digest('base64url');
};
const verify = (secret, tok) => {
  try {
    const [b, m] = String(tok).split('.');
    if (crypto.createHmac('sha256', secret).update(b).digest('base64url') !== m) return 0;
    const o = JSON.parse(Buffer.from(b, 'base64url'));
    return o.e > Date.now() ? o.u : 0;
  } catch { return 0; }
};

/* ---------- storage: one JSON blob per list, saved with a safety check ---------- */
const read = async (st, k) => (await st.get(k, { type: 'json' })) || [];
const loadDb = async st => Object.fromEntries(await Promise.all(COLS.map(async k => [k, await read(st, k)])));

async function update(st, k, fn) {                    // read, change, write; retry if someone else wrote first
  for (let i = 0; i < 8; i++) {
    const cur = await st.getWithMetadata(k, { type: 'json' });
    const next = await fn(cur ? cur.data : []);
    const res = await st.setJSON(k, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (!res || res.modified !== false) return next;
  }
  throw new Error('busy');
}

async function images(st, list) {                     // photos are stored once and served by URL
  const out = [];
  for (const x of (Array.isArray(list) ? list : []).slice(0, 4)) {
    if (typeof x !== 'string') continue;
    if (x.startsWith(IMG)) out.push(x);
    else if (/^data:image\/(jpeg|png|webp);base64,/.test(x) && x.length < 500000) {
      const key = crypto.createHash('sha1').update(x).digest('hex').slice(0, 20);
      await st.set('img/' + key, x);
      out.push(IMG + key);
    }
  }
  return out;
}

/* ---------- what each caller is allowed to see ---------- */
function viewFor(user, db) {
  const admin = !!user && user.r === 'admin', id = user && user.id;
  const clean = ({ pw, ...x }) => x;
  const mine = user ? db.p.filter(p => p.sid === id).map(p => p.id) : [];
  const paidOut = db.y.filter(y => y.t === 'seller' || y.t === 'marketer').reduce((a, y) => a + y.a, 0);
  return {
    me: id || null,
    stats: { completed: db.o.filter(o => o.st === 'completed').length, paid: paidOut },
    l: db.l.slice(0, 30),
    p: db.p.map(p => admin ? p : { ...p, pool: p.pool.map(m => m.m === id ? m : { m: m.m, pf: '', l: '' }) }),
    u: admin ? db.u.map(clean)
      : db.u.filter(u => u.sl || u.mk || u.id === id).map(u => u.id === id ? clean(u) : { id: u.id, n: u.n, sl: u.sl, mk: u.mk }),
    o: !user ? [] : (admin ? db.o : db.o.filter(o => o.cid === id || mine.includes(o.pid) || db.y.some(y => y.o === o.id && y.u === id)))
        .map(o => admin || o.cid === id || mine.includes(o.pid) ? o : { ...o, addr: '' }),
    y: !user ? [] : admin ? db.y : db.y.filter(y => y.u === id),
    w: !user ? [] : admin ? db.w : db.w.filter(w => w.u === id),
    m: admin ? db.m : []
  };
}

/* ---------- saving changes, with the rules ---------- */
async function applySync(st, user, ch, del) {
  if (Array.isArray(ch.m)) await update(st, 'm', ms => {                         // anyone may send a message / subscribe
    for (const r of ch.m.slice(0, 5)) {
      if (ms.some(x => x.id === r.id)) continue;
      if (r.n === 'Newsletter' && ms.some(x => x.n === 'Newsletter' && x.e === r.e)) continue;
      ms.unshift({ id: +r.id || uid(), n: str(r.n, 80), e: str(r.e, 120), m: str(r.m, 2000), d: today() });
    }
    return ms.slice(0, 500);
  });
  if (!user) return;
  const admin = user.r === 'admin';

  if (Array.isArray(ch.u)) await update(st, 'u', us => {                         // accounts: only a few fields can change
    for (const r of ch.u) {
      const cur = us.find(x => x.id === r.id);
      if (!cur || (r.id !== user.id && !admin)) continue;
      if (r.id === user.id) {
        for (const k of ['n', 'ph', 'idn', 'lv', 'rs']) if (r[k] !== undefined) cur[k] = r[k];
        if (r.sl) cur.sl = 1;
        if (r.mk) cur.mk = 1;
        if (r.mv && cur.mk) cur.mv = 1;
        if (r.kyc === 'pending' && cur.kyc !== 'approved') cur.kyc = 'pending';
      }
      if (admin && ['approved', 'rejected'].includes(r.kyc)) cur.kyc = r.kyc;   // only an administrator decides
    }
    return us;
  });

  if (Array.isArray(ch.p) || del.length) await update(st, 'p', async ps => {      // products
    for (const r of ch.p || []) {
      const cur = ps.find(x => x.id === r.id);
      if (!cur) {                                                                  // new listing: approved sellers only
        if (user.sl && user.kyc === 'approved' && r.sid === user.id)
          ps.unshift({ id: +r.id || uid(), sid: user.id, n: str(r.n, 80), d: str(r.d, 600), pr: Math.max(0, +r.pr || 0), st: Math.max(0, Math.floor(+r.st || 0)), c: str(r.c, 60), e: '📦',
            col: (Array.isArray(r.col) ? r.col : []).map(c => str(c, 24)).filter(Boolean).slice(0, 20), im: await images(st, r.im), pool: [] });
        continue;
      }
      if (cur.sid === user.id || admin) {                                          // owner or admin: edit the listing
        for (const k of ['n', 'd', 'c']) if (r[k] !== undefined) cur[k] = str(r[k], k === 'd' ? 600 : 80);
        if (r.pr !== undefined) cur.pr = Math.max(0, +r.pr || 0);
        if (r.st !== undefined) cur.st = Math.max(0, Math.floor(+r.st || 0));
        if (Array.isArray(r.col)) cur.col = r.col.map(c => str(c, 24)).filter(Boolean).slice(0, 20);
        if (r.im) cur.im = await images(st, r.im);
      } else if (r.st !== undefined && +r.st >= 0 && +r.st < cur.st) cur.st = Math.floor(+r.st);   // a buyer lowers the stock
      if (Array.isArray(r.pool)) {
        if (admin) cur.pool = r.pool.map(m => ({ m: +m.m, pf: str(m.pf, 8), l: str(m.l, 300) }));   // admin approves proof links
        else {
          const mineEntry = r.pool.find(m => m.m === user.id);
          if (mineEntry && user.mk && user.mv) {
            let t = cur.pool.find(m => m.m === user.id);
            if (!t && cur.pool.length < 100) { t = { m: user.id, pf: 'none', l: '' }; cur.pool.push(t); }
            if (t && mineEntry.l !== undefined && str(mineEntry.l, 300) !== t.l) { t.l = str(mineEntry.l, 300); t.pf = 'pending'; }
            else if (t && t.pf === 'no' && mineEntry.pf === 'pending') t.pf = 'pending';     // resubmitted after a rejection
          }
        }
      }
    }
    for (const id of del) { const i = ps.findIndex(x => x.id === id); if (i >= 0 && (ps[i].sid === user.id || admin)) ps.splice(i, 1); }
    return ps;
  });

  if (Array.isArray(ch.o)) await update(st, 'o', async os => {                    // orders
    const ps = await read(st, 'p');
    for (const r of ch.o) {
      const cur = os.find(x => x.id === r.id), prod = ps.find(p => p.id === r.pid || (cur && p.id === cur.pid));
      if (!cur) {
        if (r.cid !== user.id || !prod || !(+r.q > 0)) continue;
        const mid = r.mid && prod.pool.some(m => m.m === +r.mid) ? +r.mid : null;
        os.push({ id: r.id, cid: user.id, pid: prod.id, mid, q: Math.floor(+r.q), col: str(r.col, 24), price: prod.pr * Math.floor(+r.q), es: 'held', st: 'paid', addr: '', d: today() });
      } else {
        if (cur.cid === user.id && !cur.addr && r.addr) cur.addr = str(r.addr, 300);
        if (prod && (prod.sid === user.id || admin) && cur.st === 'paid' && cur.addr && r.st === 'shipped') cur.st = 'shipped';
      }
    }
    return os;
  });

  if (Array.isArray(ch.y)) await update(st, 'y', ys => {                          // only the simulated marketer fee comes from a browser
    for (const r of ch.y) if (r.t === 'fee' && r.a === 3000 && user.mk && !ys.some(x => x.id === r.id)) ys.push({ id: +r.id || uid(), o: 0, t: 'fee', u: 1, a: 3000 });
    return ys;
  });
}

/* ---------- payout when the buyer confirms receipt  (Algorithm 4.1) ---------- */
async function addLog(st, ev) {
  if (ev.length) await update(st, 'l', l => { [...ev].reverse().forEach(e => l.unshift({ id: uid(), k: e.k, m: e.m, r: 1 })); return l.slice(0, 30); });
}
async function confirm(st, user, id) {
  let out = null;
  await update(st, 'o', async os => {
    out = null;
    const o = os.find(x => x.id === id);
    if (!o || o.cid !== user.id || o.st !== 'shipped' || o.es !== 'held') return os;
    const p = (await read(st, 'p')).find(x => x.id === o.pid), us = await read(st, 'u');
    const company = o.price * .05, rows = [];
    let seller;
    if (o.mid && p.pool.length) {
      const pool = o.price * .05, per = pool / p.pool.length;
      seller = o.price - company - pool;
      p.pool.forEach(m => { if (m.pf === 'ok') rows.push({ o: o.id, t: 'marketer', u: m.m, a: per }); });
    } else seller = o.price - company;
    rows.push({ o: o.id, t: 'company', u: 1, a: company }, { o: o.id, t: 'seller', u: p.sid, a: seller });
    o.es = 'released'; o.st = 'completed';
    const nm = i => short((us.find(x => x.id === i) || {}).n);
    const ev = [{ k: 'received', m: nm(o.cid) + ' confirmed goods received — escrow released', d: 0 },
                { k: 'payout', m: 'Payout of ' + money(seller) + ' released to ' + nm(p.sid), d: 1400 }];
    rows.filter(x => x.t === 'marketer').forEach((x, i) => ev.push({ k: 'payout', m: 'Marketer reward of ' + money(x.a) + ' paid to ' + nm(x.u), d: 2800 + i * 1400 }));
    out = { rows, ev };
    return os;
  });
  if (!out) return [];
  await update(st, 'y', ys => { out.rows.forEach(x => ys.push({ id: uid(), ...x })); return ys; });
  await addLog(st, out.ev);
  return out.ev;
}

async function withdraw(st, user) {
  const db = { y: await read(st, 'y'), w: await read(st, 'w') };
  const earned = db.y.filter(y => (y.t === 'seller' || y.t === 'marketer') && y.u === user.id).reduce((a, y) => a + y.a, 0);
  const bal = earned - db.w.filter(w => w.u === user.id).reduce((a, w) => a + w.a, 0);
  if (bal <= 0) return null;
  await update(st, 'w', ws => { ws.push({ id: uid(), u: user.id, a: bal, d: today() }); return ws; });
  const ev = [{ k: 'withdraw', m: short(user.n) + ' withdrew ' + money(bal) + ' successfully', d: 0 }];
  await addLog(st, ev);
  return ev;
}

/* ---------- the request handler ---------- */
async function route(st, b) {
  if (b.op === 'init') {                                                          // first ever visit: store the starter data
    if ((await read(st, 'u')).length) return json({ ok: true });
    const sd = b.seed || {}, adminPw = (typeof process !== 'undefined' && process.env && process.env.ADMIN_PASSWORD) || '';
    await update(st, 'u', cur => cur.length ? cur : (sd.u || []).slice(0, 10).map(u => ({
      id: +u.id, n: str(u.n, 60), e: str(u.e, 80), pw: hash(u.r === 'admin' && adminPw ? adminPw : u.pw),
      r: ['admin', 'seller', 'marketer', 'customer'].includes(u.r) ? u.r : 'customer',
      sl: u.sl ? 1 : 0, mk: u.mk ? 1 : 0, kyc: str(u.kyc, 10), mv: u.mv ? 1 : 0, rs: { d: '', c: 0 } })));
    await update(st, 'p', cur => cur.length ? cur : (sd.p || []).slice(0, 50).map(p => ({
      id: +p.id, sid: +p.sid, n: str(p.n, 80), d: str(p.d, 600), pr: +p.pr || 0, st: +p.st || 0, c: str(p.c, 60), e: str(p.e, 8),
      col: (p.col || []).map(c => str(c, 24)), im: [], pool: (p.pool || []).map(m => ({ m: +m.m, pf: str(m.pf, 8), l: str(m.l, 200) })) })));
    await update(st, 'l', cur => cur.length ? cur : (sd.l || []).slice(0, 10).map(x => ({ id: uid(), k: str(x.k, 10), m: str(x.m, 200) })));
    return json({ ok: true });
  }
  const secret = await getSecret(st);
  if (b.op === 'register') {
    const name = str(b.name, 60).trim(), email = str(b.email, 80).trim(), pw = String(b.pw || '');
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || pw.length < 4) return json({ error: 'Please fill in your name, a valid email and a password of at least 4 characters.' });
    let id = uid(), dup = false;
    await update(st, 'u', us => {
      dup = us.some(x => x.e.toLowerCase() === email.toLowerCase());
      if (!dup) us.push({ id, n: name, e: email, ph: str(b.phone, 30), pw: hash(pw), r: 'customer', sl: 0, mk: 0, kyc: '', mv: 0, rs: { d: '', c: 0 } });
      return us;
    });
    return dup ? json({ error: 'Email already registered' }) : json({ tok: sign(secret, id), uid: id });
  }
  if (b.op === 'login') {
    const u = (await read(st, 'u')).find(x => x.e.toLowerCase() === String(b.email || '').trim().toLowerCase());
    return u && same(b.pw, u.pw) ? json({ tok: sign(secret, u.id), uid: u.id }) : json({ error: 'Wrong email or password' });
  }
  const db = await loadDb(st);
  if (b.op === 'state' && !db.u.length) return json({ empty: true });
  const user = db.u.find(x => x.id === (b.tok ? verify(secret, b.tok) : 0)) || null;
  if (b.op === 'state') return json(viewFor(user, db));
  if (b.op === 'sync') { await applySync(st, user, b.changes || {}, Array.isArray(b.del) ? b.del : []); return json(viewFor(user, await loadDb(st))); }
  if (!user) return json({ error: 'Please log in again.' }, 401);
  if (b.op === 'confirm') { const ev = await confirm(st, user, +b.id); return json({ ...viewFor(user, await loadDb(st)), ev }); }
  if (b.op === 'withdraw') { const ev = await withdraw(st, user); return ev ? json({ ...viewFor(user, await loadDb(st)), ev }) : json({ error: 'Nothing to withdraw yet.' }); }
  return json({ error: 'Unknown request' }, 400);
}

export function makeHandler(st) {
  return async req => {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('img')) {                    // product photo
      const d = await st.get('img/' + url.searchParams.get('img').replace(/[^a-f0-9]/g, ''));
      const m = d && /^data:(image\/[a-z]+);base64,(.+)$/.exec(d);
      return m ? new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' } })
               : new Response('Not found', { status: 404 });
    }
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    try { return await route(st, body); } catch (e) { return json({ error: 'Server busy, please try again.' }, 500); }
  };
}

/* Netlify entry point: the shared store is Netlify Blobs */
export default async req => {
  const { getStore } = await import('@netlify/blobs');
  return makeHandler(getStore({ name: 'sharemart', consistency: 'strong' }))(req);
};
