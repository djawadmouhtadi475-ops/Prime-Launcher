const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process'), { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const store = require('./store'), auth = require('./auth'), mc = require('./mc'), ld = require('./loaders'), jv = require('./java'), content = require('./content');
const { mkdir, safeName } = require('./util');
let D;
const procs = new Map();
const root = () => path.join(D, 'meta'), idir = id => path.join(D, 'instances', safeName(id));
const gdir = id => { let i = null; try { i = JSON.parse(fs.readFileSync(path.join(idir(id), 'instance.json'), 'utf8')); } catch {} return i && i.gameDir ? path.resolve(i.gameDir) : path.join(idir(id), 'game'); };
const jf = id => path.join(idir(id), 'instance.json');
function init(dir) { D = dir; mkdir(root()); mkdir(path.join(D, 'instances')); mkdir(path.join(D, 'skins')); }
const dataDir = () => D;

function read(id) { try { return JSON.parse(fs.readFileSync(jf(id), 'utf8')); } catch { return null; } }
function write(i) { mkdir(idir(i.id)); fs.writeFileSync(jf(i.id), JSON.stringify(i, null, 1)); return i; }
function view(i) {
  const icon = i.icon && fs.existsSync(path.join(idir(i.id), i.icon)) ? pathToFileURL(path.join(idir(i.id), i.icon)).href + '?t=' + (i.iconT || 0) : null;
  return { ...i, iconUrl: icon, running: procs.has(i.id) };
}
function list() {
  const dir = path.join(D, 'instances');
  return fs.readdirSync(dir).map(read).filter(Boolean).map(view).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || b.created - a.created);
}
function get(id) { const i = read(id); if (!i) throw new Error('Instance not found'); return i; }
const VIS = v => (v === 'minimize' || v === 'keep' ? v : '');
function create({ name, mc: ver, loader, gameDir, res, ram, javaPath, jvmArgs, iconPath, vis, demo }) {
  name = String(name || '').trim().slice(0, 40) || ver;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'instance';
  const id = slug + '-' + crypto.randomBytes(3).toString('hex');
  let gd = '';
  if (gameDir) { if (!path.isAbsolute(gameDir)) throw new Error('INVALID_DIR'); gd = path.resolve(gameDir); }
  const num = (v, lo, hi) => { v = Math.round(+v || 0); return v >= lo && v <= hi ? v : 0; };
  const i = write({ id, name, mc: ver, loader: { type: (loader && loader.type) || 'vanilla', version: (loader && loader.version) || '', id: '' }, ram: num(ram, 512, 65536), javaPath: String(javaPath || '').trim(), jvmArgs: String(jvmArgs || '').trim(),
    res: { w: num(res && res.w, 200, 8000), h: num(res && res.h, 200, 8000) }, gameDir: gd, vis: VIS(vis), demo: !!demo, icon: null, created: Date.now(), lastPlayed: 0 });
  mkdir(gdir(id));
  if (iconPath) { try { return setIcon(id, iconPath); } catch {} }
  return view(i);
}
function update(id, p) {
  const i = get(id);
  const allowed = ['name', 'ram', 'javaPath', 'jvmArgs', 'res'];
  for (const k of allowed) if (k in p) i[k] = p[k];
  if ('vis' in p) i.vis = VIS(p.vis);
  if ('demo' in p) i.demo = !!p.demo;
  if (p.mc && (p.mc !== i.mc || (p.loader && (p.loader.type !== i.loader.type || p.loader.version !== i.loader.version)))) {
    i.mc = p.mc; i.loader = { type: (p.loader && p.loader.type) || 'vanilla', version: (p.loader && p.loader.version) || '', id: '' };
  }
  i.name = String(i.name || '').trim().slice(0, 40) || i.mc;
  return view(write(i));
}
function remove(id) { if (procs.has(id)) throw new Error('RUNNING'); fs.rmSync(idir(id), { recursive: true, force: true }); }
function setIcon(id, src) {
  const i = get(id), ext = path.extname(src).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) throw new Error('Unsupported image');
  if (i.icon) fs.rmSync(path.join(idir(id), i.icon), { force: true });
  i.icon = 'icon' + ext; i.iconT = Date.now(); fs.copyFileSync(src, path.join(idir(id), i.icon));
  return view(write(i));
}
const SUB = { mods: 'mods', resourcepacks: 'resourcepacks', shaderpacks: 'shaderpacks' };
function files(id, kind) {
  const d = path.join(gdir(id), SUB[kind]); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(n => !n.startsWith('.')).map(n => {
    const p = path.join(d, n), st = fs.statSync(p), en = !n.endsWith('.disabled');
    const o = { file: n, size: st.size, enabled: en, dir: st.isDirectory(), title: n.replace(/\.disabled$/, ''), version: '' };
    if (kind === 'mods' && !st.isDirectory() && st.size < 80e6) {
      try {
        const z = new AdmZip(p); let e;
        if ((e = z.getEntry('fabric.mod.json')) || (e = z.getEntry('quilt.mod.json'))) { const j = JSON.parse(e.getData().toString('utf8').replace(/^\uFEFF/, '')); o.title = (j.name || (j.quilt_loader && j.quilt_loader.metadata && j.quilt_loader.metadata.name) || o.title); o.version = j.version || (j.quilt_loader && j.quilt_loader.version) || ''; }
        else if ((e = z.getEntry('META-INF/neoforge.mods.toml')) || (e = z.getEntry('META-INF/mods.toml'))) { const s = e.getData().toString('utf8'), n = /displayName\s*=\s*"([^"]+)"/.exec(s), v = /^\s*version\s*=\s*"([^"$]+)"/m.exec(s); if (n) o.title = n[1]; if (v) o.version = v[1]; }
      } catch {}
    }
    return o;
  }).sort((a, b) => a.title.localeCompare(b.title));
}
function toggle(id, kind, file) {
  const d = path.join(gdir(id), SUB[kind]), p = require('./util').safeJoin(d, file);
  fs.renameSync(p, p.endsWith('.disabled') ? p.slice(0, -9) : p + '.disabled');
}
function del(id, kind, file) { fs.rmSync(require('./util').safeJoin(path.join(gdir(id), SUB[kind]), file), { recursive: true, force: true }); }
function worlds(id) {
  const d = path.join(gdir(id), 'saves'); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(n => fs.statSync(path.join(d, n)).isDirectory()).map(n => ({ name: n, modified: fs.statSync(path.join(d, n)).mtimeMs }));
}
function shots(id) {
  const d = path.join(gdir(id), 'screenshots'); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(n => /\.(png|jpg|jpeg)$/i.test(n)).map(n => ({ name: n, url: pathToFileURL(path.join(d, n)).href, t: fs.statSync(path.join(d, n)).mtimeMs })).sort((a, b) => b.t - a.t);
}
async function install(id, req) { // mods / packs into an instance
  const i = get(id);
  return content.installFile({ ...req, mc: i.mc, loader: i.loader.type === 'vanilla' ? null : i.loader.type, gameDir: gdir(id) });
}
async function installModpack(req, emit) {
  const p = await content.prepareModpack(req, path.join(D, 'tmp'));
  const inst = create({ name: p.name, mc: p.mc, loader: p.loader });
  emit('progress', { id: inst.id, stage: 'modpack', pct: 0 });
  const missing = await p.apply(gdir(inst.id), pct => emit('progress', { id: inst.id, stage: 'modpack', pct }));
  emit('progress', { id: inst.id, stage: 'done', pct: 1 });
  return { instance: inst, missing: missing || [] };
}

async function prepare(i, { emit, verify = false }) {
  const R = root(), cfg = store.get();
  const prog = (stage, pct) => emit('progress', { id: i.id, stage, pct });
  const vanilla = await mc.loadVersion(R, i.mc);
  const vmajor = (vanilla.javaVersion && vanilla.javaVersion.majorVersion) || 8;
  prog('java', 0);
  const java1 = await jv.ensure(path.join(R, 'runtimes'), vmajor, { custom: i.javaPath || cfg.javaPath, auto: cfg.autoJava });
  let vid = i.mc;
  if (i.loader.type !== 'vanilla') {
    if (!i.loader.id || !fs.existsSync(path.join(R, 'versions', i.loader.id, i.loader.id + '.json'))) {
      prog('loader', 0);
      if (i.loader.type === 'forge' || i.loader.type === 'neoforge') await mc.ensureVersion(R, i.mc, { onProgress: prog });
      let ver = i.loader.version;
      if (!ver) ver = (await ld.versions(i.mc, i.loader.type))[0];
      if (!ver) throw new Error('NO_LOADER_VERSION');
      i.loader.version = ver; i.loader.id = await ld.install(R, i.mc, i.loader.type, ver, java1); write(i);
    }
    vid = i.loader.id;
  }
  const j = await mc.ensureVersion(R, vid, { onProgress: prog, verify });
  const major = (j.javaVersion && j.javaVersion.majorVersion) || vmajor;
  const java = major === vmajor ? java1 : await jv.ensure(path.join(R, 'runtimes'), major, { custom: i.javaPath || cfg.javaPath, auto: cfg.autoJava });
  return { j, java };
}
async function launch(id, emit) {
  if (procs.has(id)) throw new Error('ALREADY_RUNNING');
  const i = get(id), cfg = store.get(), R = root();
  const acc = cfg.accounts.find(a => a.id === cfg.selected);
  if (!acc) throw new Error('NO_ACCOUNT');
  await auth.fresh(acc);
  const { j, java } = await prepare(i, { emit });
  const gameDir = gdir(id); mkdir(gameDir);
  const natives = path.join(R, 'natives', safeName(i.id));
  mc.extractNatives(R, j, natives);
  const assetsDir = mc.prepareAssets(R, j, gameDir);
  const args = mc.buildArgs(R, j, {
    account: acc, gameDir, natives, assetsDir, ram: i.ram || cfg.ram || 4096, res: i.res || { w: 0, h: 0 },
    jvmArgs: `${cfg.jvmArgs || ''} ${i.jvmArgs || ''}`.split(/\s+/).filter(Boolean), demo: !!i.demo
  });
  emit('progress', { id, stage: 'run', pct: 1 });
  const child = spawn(java, args, { cwd: gameDir, windowsHide: true });
  procs.set(id, child);
  i.lastPlayed = Date.now(); write(i);
  let ls = null; try { ls = fs.createWriteStream(lastLogFile(id)); ls.on('error', () => { ls = null; }); } catch {}
  const out = d => { const text = d.toString(); if (ls) ls.write(text); emit('log', { id, text }); };
  child.stdout.on('data', out); child.stderr.on('data', out);
  child.on('error', e => { procs.delete(id); if (ls) ls.end('\n[launcher] ' + e.message + '\n'); emit('exit', { id, code: -1, error: e.message }); });
  child.on('exit', code => { procs.delete(id); if (ls) ls.end('\n[launcher] exit code ' + code + '\n'); emit('exit', { id, code }); });
  return true;
}
const lastLogFile = id => path.join(idir(id), 'last-run.log');
// Tail of the previous game output (kept on disk so the log survives a launcher restart).
function lastLog(id) {
  try { const b = fs.readFileSync(lastLogFile(id)); return b.slice(Math.max(0, b.length - 200 * 1024)).toString('utf8'); } catch { return ''; }
}
function kill(id) { const c = procs.get(id); if (c) c.kill(); }
async function repair(id, emit) {
  const i = get(id); i.loader.id = i.loader.type === 'vanilla' ? '' : i.loader.id;
  await prepare(i, { emit, verify: true });
  emit('progress', { id, stage: 'done', pct: 1 });
}
module.exports = { init, dataDir, root, gdir, list, get, create, update, remove, setIcon, files, toggle, del, worlds, shots, install, installModpack, launch, kill, repair, lastLog };
