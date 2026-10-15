const fs = require('fs'), path = require('path'), secrets = require('./secrets');
let file, data;
const defaults = {
  first: true, lang: 'ar', theme: 'system', accent: 'green', accounts: [], selected: null,
  msClientId: '', cfKey: '', autoJava: true, ram: 4096, javaPath: '', jvmArgs: '', closeOnLaunch: false, skins: []
};
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
module.exports = { init, get, set, save, pub };
