/* Local test server:  node dev-server.mjs   ->  http://localhost:8888
   Serves the website and the same /.netlify/functions/api used on Netlify,
   keeping its data in the .data folder (delete the folder to start fresh). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeHandler } from './netlify/functions/api.mjs';

const DIR = '.data';
fs.mkdirSync(DIR, { recursive: true });
const file = k => path.join(DIR, encodeURIComponent(k));
const etag = s => crypto.createHash('md5').update(s).digest('hex');
const readRaw = k => { try { return fs.readFileSync(file(k), 'utf8'); } catch { return null; } };
function put(k, s, o = {}) {
  const cur = readRaw(k);
  if (o.onlyIfNew && cur !== null) return { modified: false };
  if (o.onlyIfMatch && (cur === null || etag(cur) !== o.onlyIfMatch)) return { modified: false };
  fs.writeFileSync(file(k), s);
  return { modified: true, etag: etag(s) };
}
const store = {
  async get(k, o) { const s = readRaw(k); return s === null ? null : (o && o.type === 'json' ? JSON.parse(s) : s); },
  async getWithMetadata(k, o) { const s = readRaw(k); return s === null ? null : { data: o && o.type === 'json' ? JSON.parse(s) : s, etag: etag(s), metadata: {} }; },
  async set(k, v, o) { return put(k, String(v), o); },
  async setJSON(k, v, o) { return put(k, JSON.stringify(v), o); }
};
const api = makeHandler(store);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/.netlify/functions/api') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await api(new Request('http://localhost' + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const f = path.join('.', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!path.resolve(f).startsWith(process.cwd()) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8888, () => console.log('Sharemart running at http://localhost:8888'));
