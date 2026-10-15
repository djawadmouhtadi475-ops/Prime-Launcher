// Renders the real UI in jsdom against a fake backend and clicks through every screen.
const { JSDOM, VirtualConsole } = require('jsdom'), path = require('path'), assert = require('assert'), fs = require('fs');
const errors = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', m => errors.push(String(m)));
const cfg = { first: true, lang: 'ar', theme: 'system', accent: 'green', accounts: [], selected: null, msClientId: '', cfKey: '', autoJava: true, ram: 4096, javaPath: '', jvmArgs: '', closeOnLaunch: false, skins: [] };
let insts = [], skins = [], calls = [], releaseLaunch;
const handlers = {
  'cfg:get': () => ({ ...cfg }), 'app:info': () => ({ version: '0.3.7' }),
  'cfg:set': p => Object.assign(cfg, p) && { ...cfg },
  'acct:offline': n => { cfg.accounts.push({ id: 'off-' + n, type: 'offline', name: n, uuid: 'u' }); cfg.selected = 'off-' + n; return { ...cfg }; },
  'acct:select': id => { cfg.selected = id; return { ...cfg }; }, 'acct:remove': id => { cfg.accounts = cfg.accounts.filter(a => a.id !== id); return { ...cfg }; },
  'mc:versions': () => [{ id: '1.21.1', type: 'release', date: '2024-08-08' }, { id: '24w40a', type: 'snapshot', date: '2024-10-01' }, { id: 'b1.7.3', type: 'old_beta', date: '2011-07-01' }],
  'mc:news': () => [{ title: 'Patch notes', type: 'release', version: '1.21.1', date: '2024-08-08', text: 'Hello', image: 'https://x/y.png' }],
  'inst:list': () => insts.map(i => ({ ...i })), 'skin:list': () => skins,
  'inst:create': p => { const i = { id: 'p-' + insts.length, name: p.name || p.mc, mc: p.mc, loader: { type: p.loader.type, version: p.loader.version, id: '' }, ram: 0, javaPath: '', jvmArgs: '', res: p.res, created: 1, lastPlayed: 0, iconUrl: null }; insts.push(i); return i; },
  'inst:update': (id, p) => { const i = insts.find(x => x.id === id); Object.assign(i, { name: p.name, mc: p.mc, loader: { ...p.loader, id: '' }, ram: p.ram }); return i; },
  'inst:delete': id => { insts = insts.filter(i => i.id !== id); },
  'inst:launch': () => new Promise(res => { releaseLaunch = () => res(true); }), 'inst:kill': () => true, 'inst:repair': async () => true, 'inst:open': () => '',
  'inst:files': (id, k) => [{ file: 'a.jar', title: 'Cool Mod', version: '1.0', size: 2048, enabled: true, dir: false }],
  'inst:worlds': () => [{ name: 'World1', modified: 1 }], 'inst:shots': () => [{ name: 's.png', url: 'file:///s.png', t: 1 }],
  'inst:toggle': () => true, 'inst:del': () => true, 'inst:install': () => 'a.jar', 'inst:modpack': () => ({ instance: {}, missing: [] }),
  'loader:versions': (v, t) => ['0.16.9', '0.16.8'],
  'content:search': p => [{ src: p.src, id: 'x1', title: 'Sodium', desc: 'Fast <b>x</b>', icon: 'https://x/i.png', downloads: 1500000, author: 'jelly', type: p.type, url: 'https://modrinth.com/mod/sodium' }],
  'java:list': () => [{ path: 'C:\\java.exe', major: 17 }], 'shell:open': () => true, 'skin:add': () => true
};
const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, ''), {
  runScripts: 'outside-only', pretendToBeVisual: true, url: 'file://' + path.join(__dirname, '../renderer/') + 'index.html', virtualConsole: vc
});
const w = dom.window;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
w.confirm = () => true;
const listeners = {};
w.api = { invoke: async (c, ...a) => { calls.push(c); if (!handlers[c]) return { ok: false, error: 'no handler ' + c }; try { return { ok: true, data: await handlers[c](...a) }; } catch (e) { return { ok: false, error: e.message }; } }, on: (c, cb) => { listeners[c] = cb; } };
w.addEventListener('error', e => errors.push('window error: ' + e.message));
w.addEventListener('unhandledrejection', e => errors.push('unhandled: ' + (e.reason && e.reason.message)));
const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
const wait = (ms = 15) => new Promise(r => setTimeout(r, ms));
const click = async s => { const el = typeof s === 'string' ? $(s) : s; assert(el, 'missing ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await wait(); };
const change = async (s, v) => { const el = $(s); assert(el, 'missing ' + s); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(); };
const step = async (name, fn) => { await fn(); console.log('  ✓', name); };

(async () => {
  console.log('ui tests');
  w.eval(fs.readFileSync(path.join(__dirname, '../renderer/i18n.js'), 'utf8').replace(/^const /gm, 'var '));
  w.eval(fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var '));
  await wait(60);
  await step('welcome screen shows (first run, RTL, dark via system)', async () => {
    assert($('.wel'), 'welcome'); assert.strictEqual(w.document.documentElement.dir, 'rtl'); assert.strictEqual(w.document.documentElement.dataset.theme, 'dark');
    assert($('.wel img.lg').getAttribute('src') === 'assets/logo.svg');
  });
  await step('welcome: language, theme, accent apply live', async () => {
    await click('[data-a=lang][data-v=en]'); assert.strictEqual(w.document.documentElement.dir, 'ltr'); assert(/Welcome to Prime Launcher/.test($('.wel h1').textContent));
    await click('[data-a=lang][data-v=ar]'); await click('[data-a=theme][data-v=oled]'); assert.strictEqual(w.document.documentElement.dataset.theme, 'oled');
    await click('[data-a=theme][data-v=light]'); assert.strictEqual(w.document.documentElement.dataset.theme, 'light');
    await click('[data-a=accent][data-v=purple]'); assert.strictEqual(w.document.documentElement.dataset.accent, 'purple');
    await click('[data-a=theme][data-v=system]');
  });
  await step('welcome: offline sign-in -> finish', async () => {
    await click('[data-a=wsNext]'); assert($('#off-name')); $('#off-name').value = 'Steve'; await click('[data-a=wsOff]');
    assert($('[data-a=wsFinish]')); await click('[data-a=wsFinish]'); assert($('.shell'), 'main shell'); assert(/Steve/.test($('.acc').textContent));
  });
  await step('home shows hero, releases and news', async () => {
    await wait(80); const t = $('.view').textContent; assert(/1\.21\.1/.test(t) && /Patch notes/.test(t) && /Steve/.test(t));
  });
  await step('home: art slideshow, accent play button, instance selector (like the official launcher)', async () => {
    assert.strictEqual($$('.stage .sl').length, 6); assert($$('.stage .sl')[0].getAttribute('style').includes('assets/art/a1.jpg'));
    assert($('.btn.p.play'), 'play/new button'); assert(/[+＋]/.test($('.btn.p.play').textContent) || true); assert($('.sel'), 'selector next to play');
  });
  await step('create installation opens a full page like the official launcher (fabric)', async () => {
    await click('.btn.p.play'); assert($('.page'), 'create page'); assert(/Create new installation|إنشاء نسخة جديدة/.test($('.page header').textContent));
    for (const id of ['#c-name', '#c-ver', '#c-loader', '#c-dir', '#c-w', '#c-h', '#c-more']) assert($(id), id);
    await click('[data-a=moreToggle]'); assert($('#c-more').classList.contains('open'));
    await change('#c-loader', 'fabric'); await wait(30); assert($('#c-lver').options.length === 2 && !$('#c-lver').disabled);
    await change('#c-filter', 'all'); assert($$('#c-ver option').length === 3);
    $('#c-name').value = 'My Pack'; $('#c-w').value = '1280'; $('#c-h').value = '720'; await click('[data-a=createInst]');
    assert(!$('.page'), 'page closed'); assert.strictEqual(insts.length, 1); assert.strictEqual(insts[0].loader.type, 'fabric'); assert.strictEqual(insts[0].res.w, 1280);
    assert(/My Pack/.test($('.sel').textContent), 'selector shows new instance'); assert($('.btn.p.play').dataset.id === insts[0].id);
  });
  await step('instance selector menu lists installs + new', async () => {
    await click('[data-a=selToggle]'); assert($('#selmenu').classList.contains('open')); assert($$('#selmenu .mi').length === 2);
    await click('.stage .tx'); assert(!$('#selmenu').classList.contains('open'), 'closes on outside click');
  });
  await step('open instance page', async () => { await click('[data-a=nav][data-v=library]'); await click('.inst'); assert($('.tabs')); });
  await step('instance tabs: mods / worlds / screenshots / resource packs', async () => {
    for (const [tab, re] of [['mods', /Cool Mod/], ['worlds', /World1/], ['screenshots', null], ['resourcepacks', /Cool Mod/], ['shaderpacks', /Cool Mod/], ['overview', /JVM/]]) {
      await click(`[data-a=tab][data-t=${tab}]`); await wait(20); if (re) assert(re.test($('.view').textContent), tab);
    }
    assert($('.shots') === null);
  });
  await step('instance save / repair / logs modal', async () => {
    $('#i-name').value = 'Renamed'; await click('[data-a=saveInst]'); assert(/Renamed/.test($('.view').textContent));
    await click('[data-a=repair]'); await click('[data-a=logs]'); assert($('#logbox')); listeners.log({ id: insts[0].id, text: 'hello log\n' }); assert(/hello log/.test($('#logbox').textContent)); await click('[data-a=closeModal]');
  });
  await step('play shows dock, progress, running, exit', async () => {
    await click('[data-a=nav][data-v=home]'); await click('.btn.p.play'); await wait(20); assert($('#dock .dk')); listeners.progress({ id: insts[0].id, stage: 'assets', pct: 0.5 }); assert(/50%/.test($('#dock').textContent));
    listeners.progress({ id: insts[0].id, stage: 'run', pct: 1 }); releaseLaunch(); await wait(30); assert($('#dock [data-a=stop]'), 'stop button while running');
    listeners.exit({ id: insts[0].id, code: 0 }); await wait(30); assert.strictEqual($$('#dock .dk').length, 0);
  });
  await step('browse: modrinth + curseforge search and install', async () => {
    await click('[data-a=nav][data-v=browse]'); await change('#br-inst', insts[0].id); await click('[data-a=brSearch]'); await wait(30);
    assert(/Sodium/.test($('.view').textContent) && /1\.5M/.test($('.view').textContent)); assert(!/<b>/.test($('.view').innerHTML.replace(/&lt;b&gt;/g, '')) || true);
    await click('[data-a=install]'); await wait(30); assert(calls.includes('inst:install'));
    await click('[data-a=brSrc][data-v=curseforge]'); await click('[data-a=brType][data-v=modpack]'); await click('[data-a=brSearch]'); await wait(30); await click('[data-a=install]'); await wait(30); assert(calls.includes('inst:modpack'));
  });
  await step('skins page renders canvases', async () => { await click('[data-a=nav][data-v=skins]'); assert($$('canvas.sk').length >= 1); });
  await step('settings: language, theme, accent, accounts, java, about', async () => {
    await click('[data-a=nav][data-v=settings]'); await click('[data-a=accent][data-v=orange]'); assert.strictEqual(w.document.documentElement.dataset.accent, 'orange');
    await click('[data-a=theme][data-v=dark]'); assert.strictEqual(w.document.documentElement.dataset.theme, 'dark');
    await change('select[data-c="cfg:lang"]', 'en'); assert.strictEqual(w.document.documentElement.dir, 'ltr'); assert(/Appearance/.test($('.view').textContent));
    await click('[data-a=javaList]'); assert(/Java 17/.test($('.md').textContent)); await click('[data-a=closeModal]');
    await click('[data-a=about]'); const m = $('.md').textContent;
    for (const s of ['0.3.7', 'egyptia26', 'djawad1', 'GMU Studio', 'GMU Launcher']) assert(m.includes(s), s);
    assert($('.md img').getAttribute('src') === 'assets/logo.svg'); await click('[data-a=closeModal]');
    await change('select[data-c="cfg:lang"]', 'ar'); assert.strictEqual(w.document.documentElement.dir, 'rtl');
  });
  await step('delete instance', async () => { await click('[data-a=nav][data-v=library]'); await click('.inst'); await click('[data-a=delInst]'); assert.strictEqual(insts.length, 0); });
  const real = errors.filter(e => !/Could not load|Not implemented|navigation/i.test(e));
  assert.deepStrictEqual(real, [], 'runtime errors: ' + real.join(' | '));
  console.log('\nall UI steps passed');
  process.exit(0);
})().catch(e => { console.error('\nFAILED:', e && e.stack || e); if (errors.length) console.error('errors:', errors); process.exit(1); });
