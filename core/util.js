const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { pipeline } = require('stream/promises'), { Readable } = require('stream');
const VERSION = '0.3.7';
const UA = `PrimeLauncher/${VERSION} (https://primelauncherar.netlify.app)`;
const mkdir = p => fs.mkdirSync(p, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}
function sha1(file) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
  });
}
// Download with retry + optional sha1 check. Skips when the file already exists (and matches sha1 if given).
async function download(url, dest, { sha } = {}) {
  if (fs.existsSync(dest) && (!sha || (await sha1(dest)) === sha)) return dest;
  mkdir(path.dirname(dest));
  const tmp = dest + '.part';
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
      if (sha && (await sha1(tmp)) !== sha) throw new Error('hash mismatch');
      fs.renameSync(tmp, dest);
      return dest;
    } catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw new Error(`${url}: ${last.message}`);
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}
// Resolve `rel` inside `base` and refuse anything that escapes it (zip-slip / path traversal).
function safeJoin(base, rel) {
  const p = path.resolve(base, rel);
  if (p !== path.resolve(base) && !p.startsWith(path.resolve(base) + path.sep)) throw new Error('Unsafe path: ' + rel);
  return p;
}
const safeName = s => String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);
module.exports = { VERSION, UA, mkdir, sleep, getJSON, sha1, download, pool, safeJoin, safeName };
