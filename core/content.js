const fs = require('fs'), path = require('path');
const AdmZip = require('adm-zip');
const { getJSON, download, pool, mkdir, safeJoin, safeName, UA } = require('./util');
const store = require('./store');
const MR = 'https://api.modrinth.com/v2', CF = 'https://api.curseforge.com/v1';
const DIRS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };
const CFCLASS = { mod: 6, resourcepack: 12, modpack: 4471, shader: 6552 };
const CFLOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const enc = encodeURIComponent;

async function cf(p, opt = {}) {
  const key = store.get().cfKey;
  if (!key) throw new Error('NO_CF_KEY');
  return getJSON(CF + p, { ...opt, headers: { 'x-api-key': key, ...(opt.headers || {}) } });
}
async function search({ src, type, q, mc, loader, offset = 0 }) {
  if (src === 'curseforge') {
    let u = `/mods/search?gameId=432&classId=${CFCLASS[type]}&searchFilter=${enc(q || '')}&pageSize=24&index=${offset}&sortField=2&sortOrder=desc`;
    if (mc && type !== 'modpack') u += '&gameVersion=' + enc(mc);
    if (loader && CFLOADER[loader] && type === 'mod') u += '&modLoaderType=' + CFLOADER[loader];
    const r = await cf(u);
    return r.data.map(m => ({ src, id: String(m.id), title: m.name, desc: m.summary, icon: m.logo && m.logo.thumbnailUrl, downloads: m.downloadCount, author: m.authors && m.authors[0] && m.authors[0].name, type, url: m.links && m.links.websiteUrl }));
  }
  const f = [[`project_type:${type}`]];
  if (mc && type !== 'modpack') f.push([`versions:${mc}`]);
  if (loader && type === 'mod') f.push([`categories:${loader}`]);
  const r = await getJSON(`${MR}/search?query=${enc(q || '')}&limit=24&offset=${offset}&facets=${enc(JSON.stringify(f))}`);
  return r.hits.map(h => ({ src, id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, type, url: `https://modrinth.com/${type}/${h.slug}` }));
}
async function mrVersion(id, mc, loader, type) {
  const q = [];
  if (mc && type !== 'modpack') q.push('game_versions=' + enc(JSON.stringify([mc])));
  if (loader && type === 'mod') q.push('loaders=' + enc(JSON.stringify(loader === 'quilt' ? ['quilt', 'fabric'] : [loader])));
  const v = await getJSON(`${MR}/project/${id}/version?${q.join('&')}`);
  if (!v.length) throw new Error('NO_COMPATIBLE_FILE');
  return v[0];
}
const pickFile = v => v.files.find(f => f.primary) || v.files[0];

// Install a single mod / resource pack / shader into a game dir (Modrinth resolves required dependencies).
async function installFile({ src, id, type, mc, loader, gameDir }, depth = 0) {
  const dir = path.join(gameDir, DIRS[type]); mkdir(dir);
  if (src === 'curseforge') {
    let u = `/mods/${id}/files?pageSize=1&gameVersion=${enc(mc || '')}`;
    if (loader && CFLOADER[loader] && type === 'mod') u += '&modLoaderType=' + CFLOADER[loader];
    const f = (await cf(u)).data[0];
    if (!f) throw new Error('NO_COMPATIBLE_FILE');
    if (!f.downloadUrl) throw new Error('CF_MANUAL');
    const sha = (f.hashes || []).find(h => h.algo === 1);
    await download(f.downloadUrl, safeJoin(dir, safeName(f.fileName)), { sha: sha && sha.value });
    return f.fileName;
  }
  const v = await mrVersion(id, mc, loader, type), file = pickFile(v);
  await download(file.url, safeJoin(dir, safeName(file.filename)), { sha: file.hashes && file.hashes.sha1 });
  if (depth < 2 && type === 'mod') for (const d of v.dependencies || []) {
    if (d.dependency_type === 'required' && d.project_id) { try { await installFile({ src, id: d.project_id, type, mc, loader, gameDir }, depth + 1); } catch {} }
  }
  return file.filename;
}
function copyOverrides(zip, prefix, gameDir) {
  for (const e of zip.getEntries()) {
    if (e.isDirectory || !e.entryName.startsWith(prefix + '/')) continue;
    const to = safeJoin(gameDir, e.entryName.slice(prefix.length + 1));
    mkdir(path.dirname(to)); fs.writeFileSync(to, e.getData());
  }
}
// Downloads a modpack and returns { name, mc, loader:{type,version}, apply(gameDir, progress) }
async function prepareModpack({ src, id }, tmpDir) {
  mkdir(tmpDir);
  let file;
  if (src === 'curseforge') {
    const f = (await cf(`/mods/${id}/files?pageSize=1`)).data[0];
    if (!f || !f.downloadUrl) throw new Error('CF_MANUAL');
    file = await download(f.downloadUrl, path.join(tmpDir, safeName(f.fileName)));
  } else {
    const v = await mrVersion(id, null, null, 'modpack'), pf = pickFile(v);
    file = await download(pf.url, path.join(tmpDir, safeName(pf.filename)), { sha: pf.hashes && pf.hashes.sha1 });
  }
  const zip = new AdmZip(file);
  const mr = zip.getEntry('modrinth.index.json'), cfm = zip.getEntry('manifest.json');
  if (mr) {
    const ix = JSON.parse(mr.getData().toString('utf8')), d = ix.dependencies || {};
    const lt = d['fabric-loader'] ? ['fabric', d['fabric-loader']] : d['quilt-loader'] ? ['quilt', d['quilt-loader']] : d.neoforge ? ['neoforge', d.neoforge] : d.forge ? ['forge', d.forge] : ['vanilla', ''];
    return { name: ix.name, mc: d.minecraft, loader: { type: lt[0], version: lt[1] }, async apply(gameDir, prog) {
      const files = (ix.files || []).filter(f => !(f.env && f.env.client === 'unsupported'));
      let n = 0;
      await pool(files, 6, async f => { await download(f.downloads[0], safeJoin(gameDir, f.path), { sha: f.hashes && f.hashes.sha1 }); prog(++n / files.length); });
      copyOverrides(zip, 'overrides', gameDir); copyOverrides(zip, 'client-overrides', gameDir);
    } };
  }
  if (cfm) {
    const m = JSON.parse(cfm.getData().toString('utf8')), ml = (m.minecraft.modLoaders.find(x => x.primary) || m.minecraft.modLoaders[0] || {}).id || '';
    const mm = /^(forge|fabric|quilt|neoforge)-(.+)$/.exec(ml);
    return { name: m.name, mc: m.minecraft.version, loader: { type: mm ? mm[1] : 'vanilla', version: mm ? mm[2] : '' }, async apply(gameDir, prog) {
      const ids = m.files.map(f => f.fileID);
      const res = (await cf('/mods/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds: ids }) })).data;
      let n = 0;
      const missing = [];
      await pool(res, 6, async f => {
        if (!f.downloadUrl) missing.push(f.fileName);
        else { const sub = /\.zip$/i.test(f.fileName) ? 'resourcepacks' : 'mods'; await download(f.downloadUrl, safeJoin(path.join(gameDir, sub), safeName(f.fileName))); }
        prog(++n / res.length);
      });
      copyOverrides(zip, m.overrides || 'overrides', gameDir);
      return missing;
    } };
  }
  throw new Error('Unsupported modpack format');
}
module.exports = { search, installFile, prepareModpack, DIRS };
