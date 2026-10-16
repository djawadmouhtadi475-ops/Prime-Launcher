const fs = require('fs'), path = require('path'), secrets = require('./secrets');
let file, data;
const defaults = {
  first: true, lang: 'ar', theme: 'system', accent: 'green', accounts: [], selected: null,
  msClientId: '', cfKey: '', autoJava: true, ram: 4096, javaPath: '', jvmArgs: '', closeOnLaunch: false, skins: [],
  font: 'tajawal', fontSize: 15, blur: 14, glass: true, rounded: true, bgMode: 'art', bgImage: '', primary: '', customCss: ''
};
// Validates the appearance settings coming from the UI (ranges, enums, safe file URL, hex colour).
const num = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d; };
function sanitize(p) {
  const out = {};
  for (const k of ['first', 'lang', 'theme', 'accent', 'msClientId', 'cfKey', 'autoJava', 'ram', 'javaPath', 'jvmArgs', 'closeOnLaunch']) if (k in p) out[k] = p[k];
  if ('font' in p) out.font = ['tajawal', 'system'].includes(p.font) ? p.font : 'tajawal';
  if ('fontSize' in p) out.fontSize = num(p.fontSize, 12, 20, 15);
  if ('blur' in p) out.blur = num(p.blur, 0, 40, 14);
  if ('glass' in p) out.glass = !!p.glass;
  if ('rounded' in p) out.rounded = !!p.rounded;
  if ('bgMode' in p) out.bgMode = ['art', 'none', 'image'].includes(p.bgMode) ? p.bgMode : 'art';
  if ('bgImage' in p) out.bgImage = typeof p.bgImage === 'string' && /^file:\/\/[^"'\\\s]*$/.test(p.bgImage) ? p.bgImage : '';
  if ('primary' in p) out.primary = typeof p.primary === 'string' && /^#[0-9a-f]{6}$/i.test(p.primary) ? p.primary.toLowerCase() : '';
  if ('customCss' in p) out.customCss = String(p.customCss || '').slice(0, 20000);
  return out;
}
function init(dir) {
  file = path.join(dir, 'config.json');
  try { data = { ...defaults, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { data = { ...defaults }; }
}
const get = () => data;
function save() { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); }
function set(p) { Object.assign(data, p); save(); return data; }
// Config sent to the UI: never include tokens.
function pub() {
  return { ...data, cfBuiltin: !!secrets.cfKey, accounts: data.accounts.map(a => ({ id: a.id, type: a.type, name: a.name, uuid: a.uuid })) };
}
module.exports = { init, get, set, save, pub, sanitize };
