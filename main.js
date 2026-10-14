const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs'), path = require('path');
const dataDir = path.join(app.getPath('appData'), 'PrimeLauncher');
app.setPath('userData', path.join(dataDir, 'electron'));
const { VERSION, getJSON } = require('./core/util');
const store = require('./core/store'), auth = require('./core/auth'), inst = require('./core/instances');
const mc = require('./core/mc'), ld = require('./core/loaders'), jv = require('./core/java'), content = require('./core/content');
let win;
const emit = (c, d) => { if (win && !win.isDestroyed()) win.webContents.send(c, d); };
const ALLOWED_HOSTS = ['discord.gg', 'www.youtube.com', 'primelauncherar.netlify.app', 'modrinth.com', 'www.curseforge.com', 'aka.ms', 'microsoft.com', 'www.microsoft.com', 'login.live.com', 'portal.azure.com', 'adoptium.net'];

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 760, minWidth: 980, minHeight: 620, backgroundColor: '#0f1218', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'), title: 'Prime Launcher',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
}
function openExternal(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) throw new Error('Blocked URL');
  return shell.openExternal(u.href);
}
const H = (c, fn) => ipcMain.handle(c, async (_e, ...a) => { try { return { ok: true, data: await fn(...a) }; } catch (e) { return { ok: false, error: e.message || String(e) }; } });

H('app:info', () => ({ version: VERSION, dataDir, electron: process.versions.electron, node: process.versions.node }));
H('cfg:get', () => store.pub());
H('cfg:set', p => {
  const ok = ['first', 'lang', 'theme', 'accent', 'msClientId', 'cfKey', 'autoJava', 'ram', 'javaPath', 'jvmArgs', 'closeOnLaunch'];
  const clean = {}; for (const k of ok) if (k in p) clean[k] = p[k];
  store.set(clean); return store.pub();
});
H('mc:versions', async () => (await mc.manifest()).versions.map(v => ({ id: v.id, type: v.type, date: v.releaseTime })));
H('mc:news', async () => {
  const base = 'https://launchercontent.mojang.com';
  const j = await getJSON(base + '/v2/javaPatchNotes.json');
  return (j.entries || []).slice(0, 12).map(e => ({ title: e.title, type: e.type, version: e.version, date: e.date, text: e.shortText || '', image: e.image && e.image.url ? (/^https?:/.test(e.image.url) ? e.image.url : base + e.image.url) : null }));
});
H('loader:versions', (v, t) => ld.versions(v, t));
H('inst:list', () => inst.list());
H('inst:create', p => inst.create(p));
H('inst:update', (id, p) => inst.update(id, p));
H('inst:delete', id => inst.remove(id));
H('inst:icon', async id => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] });
  return r.canceled ? null : inst.setIcon(id, r.filePaths[0]);
});
H('inst:launch', async id => {
  await inst.launch(id, emit);
  if (store.get().closeOnLaunch && win) win.minimize();
  return true;
});
H('inst:kill', id => inst.kill(id));
H('inst:repair', id => inst.repair(id, emit));
H('inst:open', (id, sub) => {
  const d = path.join(inst.gdir(id), ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs', ''].includes(sub || '') ? (sub || '') : '');
  fs.mkdirSync(d, { recursive: true }); return shell.openPath(d);
});
H('inst:files', (id, k) => inst.files(id, k));
H('inst:toggle', (id, k, f) => inst.toggle(id, k, f));
H('inst:del', (id, k, f) => inst.del(id, k, f));
H('inst:worlds', id => inst.worlds(id));
H('inst:shots', id => inst.shots(id));
H('inst:install', (id, r) => inst.install(id, r));
H('inst:modpack', r => inst.installModpack(r, emit));
H('content:search', p => content.search(p));
H('acct:offline', n => auth.addOffline(n) && store.pub());
H('acct:ms', async () => { await auth.msLogin(c => { emit('ms-code', c); try { openExternal(c.url); } catch {} }); return store.pub(); });
H('acct:select', id => { store.set({ selected: id }); return store.pub(); });
H('acct:remove', id => { auth.remove(id); return store.pub(); });
H('java:list', () => jv.list(path.join(inst.root(), 'runtimes')));
H('shell:open', url => openExternal(url));
// Skins: local library + upload to Microsoft accounts
const skinDir = () => path.join(inst.dataDir(), 'skins');
H('skin:list', () => store.get().skins.map(s => ({ ...s, url: require('url').pathToFileURL(path.join(skinDir(), s.file)).href })));
H('skin:add', async variant => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'PNG', extensions: ['png'] }], properties: ['openFile'] });
  if (r.canceled) return null;
  const buf = fs.readFileSync(r.filePaths[0]);
  if (buf.length > 200 * 1024 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('INVALID_SKIN');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== 64 || (h !== 64 && h !== 32)) throw new Error('INVALID_SKIN');
  const id = Date.now().toString(36), file = id + '.png';
  fs.mkdirSync(skinDir(), { recursive: true }); fs.writeFileSync(path.join(skinDir(), file), buf);
  const s = { id, file, name: path.basename(r.filePaths[0], '.png').slice(0, 30), variant: variant === 'slim' ? 'slim' : 'classic' };
  store.get().skins.push(s); store.save(); return true;
});
H('skin:remove', id => {
  const c = store.get(), s = c.skins.find(x => x.id === id); if (!s) return;
  fs.rmSync(path.join(skinDir(), s.file), { force: true }); c.skins = c.skins.filter(x => x.id !== id); store.save();
});
H('skin:apply', async id => {
  const c = store.get(), s = c.skins.find(x => x.id === id), acc = c.accounts.find(a => a.id === c.selected);
  if (!s || !acc) throw new Error('NO_ACCOUNT');
  if (acc.type !== 'microsoft') throw new Error('SKIN_OFFLINE');
  await auth.uploadSkin(acc, fs.readFileSync(path.join(skinDir(), s.file)), s.variant);
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    store.init(dataDir); inst.init(dataDir); createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
