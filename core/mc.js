const fs = require('fs'), path = require('path'), os = require('os');
const AdmZip = require('adm-zip');
const { getJSON, download, pool, mkdir, VERSION } = require('./util');
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

const archName = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : null;
function ruleOk(rules, features = {}) {
  if (!rules) return true;
  let ok = false;
  for (const r of rules) {
    let m = true;
    if (r.os) {
      if (r.os.name && r.os.name !== 'windows') m = false;
      if (r.os.arch && r.os.arch !== archName) m = false;
      if (r.os.version && !new RegExp(r.os.version).test(os.release())) m = false;
    }
    if (r.features) for (const k of Object.keys(r.features)) if (!!features[k] !== r.features[k]) m = false;
    if (m) ok = r.action === 'allow';
  }
  return ok;
}
// "g:a:v[:classifier][@ext]" -> g/a/v/a-v[-classifier].ext
function mavenPath(name) {
  let ext = 'jar';
  if (name.includes('@')) { [name, ext] = name.split('@'); }
  const [g, a, v, c] = name.split(':');
  return `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${c ? '-' + c : ''}.${ext}`;
}
const subst = (s, vars) => String(s).replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
function flat(args, vars, features) {
  const out = [];
  for (const a of args || []) {
    if (typeof a === 'string') out.push(subst(a, vars));
    else if (ruleOk(a.rules, features)) (Array.isArray(a.value) ? a.value : [a.value]).forEach(x => out.push(subst(x, vars)));
  }
  return out;
}
function merge(p, c) {
  const r = { ...p, ...c };
  r.libraries = [...(c.libraries || []), ...(p.libraries || [])];
  if (p.arguments || c.arguments) r.arguments = { game: [...((p.arguments || {}).game || []), ...((c.arguments || {}).game || [])], jvm: [...((p.arguments || {}).jvm || []), ...((c.arguments || {}).jvm || [])] };
  r.minecraftArguments = c.minecraftArguments || p.minecraftArguments;
  r.assetIndex = c.assetIndex || p.assetIndex; r.assets = c.assets || p.assets;
  r.javaVersion = c.javaVersion || p.javaVersion; r.mainClass = c.mainClass || p.mainClass;
  r.downloads = p.downloads; r.logging = c.logging || p.logging;
  r.id = c.id; r._base = p._base;
  return r;
}
async function manifest() { return getJSON(MANIFEST); }
async function loadVersion(root, id) {
  const f = path.join(root, 'versions', id, id + '.json');
  let j;
  if (fs.existsSync(f)) j = JSON.parse(fs.readFileSync(f, 'utf8'));
  else {
    const e = (await manifest()).versions.find(v => v.id === id);
    if (!e) throw new Error('Unknown version ' + id);
    j = await getJSON(e.url); mkdir(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(j));
  }
  if (j.inheritsFrom) return merge(await loadVersion(root, j.inheritsFrom), j);
  j._base = j.id; return j;
}
function resolveLibs(j) {
  const out = [];
  for (const l of j.libraries || []) {
    if (!ruleOk(l.rules)) continue;
    const d = l.downloads;
    if (l.natives && l.natives.windows) {
      const cls = l.natives.windows.replace('${arch}', '64'), a = d && d.classifiers && d.classifiers[cls];
      if (a) out.push({ path: a.path, url: a.url, sha1: a.sha1, name: l.name, native: true, exclude: (l.extract && l.extract.exclude) || ['META-INF/'] });
    }
    if (d && d.artifact) out.push({ path: d.artifact.path, url: d.artifact.url, sha1: d.artifact.sha1, name: l.name, native: /:natives-windows/.test(l.name) ? 'both' : false });
    else if (!d) { const p = mavenPath(l.name); out.push({ path: p, url: (l.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/') + p, name: l.name }); }
  }
  return out;
}
const libKey = n => n.split(':').slice(0, 2).join(':') + (n.split(':')[3] ? ':' + n.split(':')[3] : '');
function classpath(root, j) {
  const seen = new Set(), cp = [];
  for (const l of resolveLibs(j)) {
    if (l.native === true) continue;
    const k = libKey(l.name || l.path); if (seen.has(k)) continue; seen.add(k);
    cp.push(path.join(root, 'libraries', l.path));
  }
  cp.push(path.join(root, 'versions', j._base, j._base + '.jar'));
  return cp;
}
async function ensureVersion(root, id, { onProgress = () => {}, verify = false } = {}) {
  const j = await loadVersion(root, id);
  const libs = resolveLibs(j), jobs = [];
  if (j.downloads && j.downloads.client) jobs.push({ url: j.downloads.client.url, dest: path.join(root, 'versions', j._base, j._base + '.jar'), sha: j.downloads.client.sha1 });
  for (const l of libs) if (l.url) jobs.push({ url: l.url, dest: path.join(root, 'libraries', l.path), sha: l.sha1 });
  let done = 0;
  await pool(jobs, 8, async x => { await download(x.url, x.dest, { sha: x.sha }); onProgress('libs', ++done / jobs.length); });
  if (j.assetIndex) {
    const ip = path.join(root, 'assets', 'indexes', j.assetIndex.id + '.json');
    await download(j.assetIndex.url, ip, { sha: j.assetIndex.sha1 });
    const objs = Object.values(JSON.parse(fs.readFileSync(ip, 'utf8')).objects);
    const need = objs.filter(o => { const f = path.join(root, 'assets', 'objects', o.hash.slice(0, 2), o.hash); return !fs.existsSync(f) || (!verify ? false : fs.statSync(f).size !== o.size); });
    let n = 0;
    await pool(need, 16, async o => { const h2 = o.hash.slice(0, 2); await download(`https://resources.download.minecraft.net/${h2}/${o.hash}`, path.join(root, 'assets', 'objects', h2, o.hash), { sha: verify ? o.hash : undefined }); onProgress('assets', ++n / need.length); });
  }
  const lg = j.logging && j.logging.client && j.logging.client.file;
  if (lg) await download(lg.url, path.join(root, 'assets', 'log_configs', lg.id), { sha: lg.sha1 });
  return j;
}
function extractNatives(root, j, dir) {
  fs.rmSync(dir, { recursive: true, force: true }); mkdir(dir);
  for (const l of resolveLibs(j)) {
    if (!l.native) continue;
    const f = path.join(root, 'libraries', l.path); if (!fs.existsSync(f)) continue;
    for (const e of new AdmZip(f).getEntries()) {
      if (e.isDirectory || !/\.(dll|so|dylib)$/i.test(e.entryName)) continue;
      if ((l.exclude || []).some(x => e.entryName.startsWith(x))) continue;
      fs.writeFileSync(path.join(dir, path.basename(e.entryName)), e.getData());
    }
  }
}
function prepareAssets(root, j, gameDir) {
  if (!j.assetIndex) return path.join(root, 'assets');
  const idx = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'indexes', j.assetIndex.id + '.json'), 'utf8'));
  const dest = idx.map_to_resources ? path.join(gameDir, 'resources') : idx.virtual ? path.join(root, 'assets', 'virtual', 'legacy') : null;
  if (dest) for (const [name, o] of Object.entries(idx.objects)) {
    const to = path.join(dest, name);
    if (!fs.existsSync(to)) { mkdir(path.dirname(to)); fs.copyFileSync(path.join(root, 'assets', 'objects', o.hash.slice(0, 2), o.hash), to); }
  }
  return idx.virtual ? path.join(root, 'assets', 'virtual', 'legacy') : path.join(root, 'assets');
}
// Builds the complete argument list (everything after the java executable).
function buildArgs(root, j, o) {
  const cp = classpath(root, j).join(';');
  const vars = {
    auth_player_name: o.account.name, version_name: j.id, game_directory: o.gameDir, assets_root: path.join(root, 'assets'),
    assets_index_name: j.assetIndex ? j.assetIndex.id : j.assets, auth_uuid: o.account.uuid, auth_access_token: o.account.type === 'microsoft' ? o.account.mcToken : '0',
    clientid: '', auth_xuid: '', user_type: o.account.type === 'microsoft' ? 'msa' : 'legacy', version_type: j.type || 'release',
    natives_directory: o.natives, launcher_name: 'PrimeLauncher', launcher_version: VERSION, classpath: cp, classpath_separator: ';',
    library_directory: path.join(root, 'libraries'), user_properties: '{}', game_assets: o.assetsDir,
    auth_session: `token:${o.account.type === 'microsoft' ? o.account.mcToken : '0'}:${o.account.uuid}`,
    resolution_width: String(o.res.w), resolution_height: String(o.res.h)
  };
  const features = { has_custom_resolution: !!(o.res.w && o.res.h), is_demo_user: !!o.demo };
  const jvm = j.arguments ? flat(j.arguments.jvm, vars, features) : ['-Djava.library.path=' + o.natives, '-cp', cp];
  const game = j.arguments ? flat(j.arguments.game, vars, features) : subst(j.minecraftArguments || '', vars).split(' ').filter(Boolean);
  const lg = j.logging && j.logging.client;
  const extra = lg && lg.argument ? [subst(lg.argument, { path: path.join(root, 'assets', 'log_configs', lg.file.id) })] : [];
  if (!jvm.some(a => a.startsWith('-Djava.library.path'))) jvm.unshift('-Djava.library.path=' + o.natives);
  if (!jvm.includes('-cp') && !jvm.includes('-classpath')) jvm.push('-cp', cp);
  const mem = [`-Xmx${o.ram}M`, `-Xms${Math.min(512, o.ram)}M`];
  return [...mem, ...o.jvmArgs, ...extra, ...jvm, j.mainClass, ...game, ...(o.res.w && !j.arguments ? ['--width', String(o.res.w), '--height', String(o.res.h)] : []), ...(o.demo && !j.arguments ? ['--demo'] : [])];
}
module.exports = { ruleOk, mavenPath, subst, merge, manifest, loadVersion, resolveLibs, classpath, ensureVersion, extractNatives, prepareAssets, buildArgs };
