const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const { getJSON, download, mkdir, UA } = require('./util');
const META = { fabric: 'https://meta.fabricmc.net/v2/versions/loader/', quilt: 'https://meta.quiltmc.org/v3/versions/loader/' };
async function text(u) { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u); return r.text(); }
function nfPrefix(mc) { const m = /^1\.(\d+)(?:\.(\d+))?/.exec(mc); return m ? `${m[1]}.${m[2] || 0}.` : mc + '.'; }

async function versions(mc, type) {
  if (META[type]) return (await getJSON(META[type] + encodeURIComponent(mc))).map(x => x.loader.version);
  if (type === 'forge') {
    const x = await text('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
    return [...x.matchAll(/<version>([^<]+)<\/version>/g)].map(m => m[1]).filter(v => v.startsWith(mc + '-')).map(v => v.slice(mc.length + 1)).reverse();
  }
  if (type === 'neoforge') {
    const j = await getJSON('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'), p = nfPrefix(mc);
    return j.versions.filter(v => v.startsWith(p)).reverse();
  }
  return [];
}
// Installs the loader and returns the resulting launcher version id.
async function install(root, mc, type, ver, java) {
  if (META[type]) {
    const j = await getJSON(`${META[type]}${encodeURIComponent(mc)}/${encodeURIComponent(ver)}/profile/json`);
    const dir = path.join(root, 'versions', j.id); mkdir(dir);
    fs.writeFileSync(path.join(dir, j.id + '.json'), JSON.stringify(j)); return j.id;
  }
  const forge = type === 'forge', full = forge ? `${mc}-${ver}` : ver;
  const url = forge ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`
    : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`;
  const jar = path.join(root, 'installers', path.basename(url)); await download(url, jar);
  const lp = path.join(root, 'launcher_profiles.json');
  if (!fs.existsSync(lp)) fs.writeFileSync(lp, JSON.stringify({ profiles: {}, version: 3 }));
  const vd = path.join(root, 'versions'), before = new Set(fs.existsSync(vd) ? fs.readdirSync(vd) : []);
  await new Promise((res, rej) => execFile(java, ['-jar', jar, '--installClient', root], { cwd: root, maxBuffer: 1 << 26, windowsHide: true, timeout: 20 * 60 * 1000 },
    (e, so, se) => e ? rej(new Error('Installer failed: ' + String(se || so || e.message).slice(-600))) : res()));
  const now = fs.readdirSync(vd);
  const id = now.find(n => !before.has(n) && n.includes(ver)) || now.find(n => n.includes(ver) && /forge/i.test(n));
  if (!id) throw new Error('Installed version not found');
  return id;
}
module.exports = { versions, install, nfPrefix };
