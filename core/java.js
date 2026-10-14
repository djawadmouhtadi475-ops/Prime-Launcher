const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const { download } = require('./util');
const exe = d => path.join(d, 'bin', 'java.exe');

function major(bin) {
  return new Promise(res => execFile(bin, ['-version'], { timeout: 8000, windowsHide: true }, (e, so, se) => {
    const m = /version "(\d+)(?:\.(\d+))?/.exec(String(se || '') + String(so || ''));
    res(m ? (m[1] === '1' ? +m[2] : +m[1]) : 0);
  }));
}
function candidates(rt) {
  const c = [];
  if (process.env.JAVA_HOME) c.push(exe(process.env.JAVA_HOME));
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432].filter(Boolean);
  for (const p of pf) for (const v of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'BellSoft', 'Amazon Corretto', 'Semeru', 'AdoptOpenJDK']) {
    const d = path.join(p, v);
    if (fs.existsSync(d)) for (const s of fs.readdirSync(d)) c.push(exe(path.join(d, s)));
  }
  if (fs.existsSync(rt)) for (const s of fs.readdirSync(rt)) c.push(exe(path.join(rt, s)));
  c.push('java');
  return [...new Set(c)].filter(x => x === 'java' || fs.existsSync(x));
}
async function list(rt) {
  const out = [];
  for (const p of candidates(rt)) { const v = await major(p); if (v) out.push({ path: p, major: v }); }
  return out;
}
// Returns a java executable matching `want` (auto-downloads a JRE from Adoptium when missing).
async function ensure(rt, want, { custom, auto = true } = {}) {
  if (custom && fs.existsSync(custom)) return custom;
  if (want === 16) want = 17;
  const own = exe(path.join(rt, 'java-' + want));
  if (fs.existsSync(own)) return own;
  const found = await list(rt);
  const ex = found.find(j => j.major === want);
  if (ex) return ex.path;
  if (!auto) {
    const ge = want >= 17 && found.find(j => j.major >= want);
    if (ge) return ge.path;
    throw new Error('JAVA_MISSING:' + want);
  }
  fs.mkdirSync(rt, { recursive: true });
  const zip = path.join(rt, `java-${want}.zip`), tmp = path.join(rt, 'tmp-' + want);
  await download(`https://api.adoptium.net/v3/binary/latest/${want}/ga/windows/x64/jre/hotspot/normal/eclipse`, zip);
  fs.rmSync(tmp, { recursive: true, force: true });
  new AdmZip(zip).extractAllTo(tmp, true);
  const inner = fs.readdirSync(tmp).map(n => path.join(tmp, n)).find(d => fs.existsSync(exe(d)));
  if (!inner) throw new Error('Java extract failed');
  fs.renameSync(inner, path.join(rt, 'java-' + want));
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
  return exe(path.join(rt, 'java-' + want));
}
module.exports = { list, ensure, major };
