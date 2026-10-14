// Offline unit/integration tests for the launcher core (no real Minecraft servers needed).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const AdmZip = require('adm-zip');
const mc = require('../core/mc'), util = require('../core/util'), store = require('../core/store'), auth = require('../core/auth'), inst = require('../core/instances'), ld = require('../core/loaders');
let n = 0; const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ✓', name); }, e => { console.error('  ✗', name, '\n', e); process.exitCode = 1; });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));

(async () => {
  console.log('core tests');
  await ok('mavenPath', () => {
    assert.strictEqual(mc.mavenPath('org.ow2.asm:asm:9.6'), 'org/ow2/asm/asm/9.6/asm-9.6.jar');
    assert.strictEqual(mc.mavenPath('org.lwjgl:lwjgl:3.3.3:natives-windows'), 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar');
    assert.strictEqual(mc.mavenPath('de.oceanlabs.mcp:mcp_config:1.20.1@zip'), 'de/oceanlabs/mcp/mcp_config/1.20.1/mcp_config-1.20.1.zip');
  });
  await ok('ruleOk', () => {
    assert(mc.ruleOk(undefined));
    assert(mc.ruleOk([{ action: 'allow' }]));
    assert(!mc.ruleOk([{ action: 'allow' }, { action: 'disallow', os: { name: 'windows' } }]));
    assert(mc.ruleOk([{ action: 'allow' }, { action: 'disallow', os: { name: 'osx' } }]));
    assert(!mc.ruleOk([{ action: 'allow', os: { name: 'linux' } }]));
    assert(!mc.ruleOk([{ action: 'allow', features: { is_demo_user: true } }]));
    assert(mc.ruleOk([{ action: 'allow', features: { has_custom_resolution: true } }], { has_custom_resolution: true }));
  });
  await ok('subst', () => assert.strictEqual(mc.subst('a ${x} ${y}', { x: '1' }), 'a 1 ${y}'));
  await ok('offline uuid matches Mojang algorithm', () => assert.strictEqual(auth.offlineUUID('Notch'), 'b50ad385829d3141a2167e7d7539ba7f'));
  await ok('safeJoin blocks traversal', () => {
    assert.throws(() => util.safeJoin(tmp, '../evil.txt'));
    assert.throws(() => util.safeJoin(tmp, 'a/../../evil.txt'));
    assert(util.safeJoin(tmp, 'mods/a.jar').startsWith(tmp));
  });
  await ok('nfPrefix', () => { assert.strictEqual(ld.nfPrefix('1.21.1'), '21.1.'); assert.strictEqual(ld.nfPrefix('1.21'), '21.0.'); });

  // ---- local fake Mojang CDN ----
  const root = path.join(tmp, 'meta'), clientJar = Buffer.from('CLIENTJAR'), libJar = Buffer.from('LIBJAR');
  const nz = new AdmZip(); nz.addFile('lwjgl.dll', Buffer.from('DLL')); nz.addFile('META-INF/x.sf', Buffer.from('no')); const nativeJar = nz.toBuffer();
  const files = { '/client.jar': clientJar, '/lib.jar': libJar, '/native.jar': nativeJar, '/idx.json': Buffer.from(JSON.stringify({ objects: {} })), '/log.xml': Buffer.from('<x/>') };
  const srv = http.createServer((q, r) => { const f = files[q.url]; if (!f) { r.statusCode = 404; return r.end(); } r.end(f); });
  await new Promise(r => srv.listen(0, r)); const B = 'http://127.0.0.1:' + srv.address().port;
  const sha = b => crypto.createHash('sha1').update(b).digest('hex');
  const vanilla = { id: '1.20.1', type: 'release', mainClass: 'net.minecraft.client.main.Main', javaVersion: { majorVersion: 17 },
    downloads: { client: { url: B + '/client.jar', sha1: sha(clientJar) } }, assetIndex: { id: '5', url: B + '/idx.json', sha1: sha(files['/idx.json']) },
    logging: { client: { argument: '-Dlog4j.configurationFile=${path}', file: { id: 'client-1.12.xml', url: B + '/log.xml', sha1: sha(files['/log.xml']) } } },
    libraries: [
      { name: 'com.example:lib:1.0', downloads: { artifact: { path: 'com/example/lib/1.0/lib-1.0.jar', url: B + '/lib.jar', sha1: sha(libJar) } } },
      { name: 'org.lwjgl:lwjgl:3.3.1', downloads: { artifact: { path: 'org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1.jar', url: B + '/lib.jar', sha1: sha(libJar) } } },
      { name: 'org.lwjgl:lwjgl:3.3.1:natives-windows', rules: [{ action: 'allow', os: { name: 'windows' } }], downloads: { artifact: { path: 'org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-windows.jar', url: B + '/native.jar', sha1: sha(nativeJar) } } },
      { name: 'org.lwjgl:lwjgl:3.3.1:natives-linux', rules: [{ action: 'allow', os: { name: 'linux' } }], downloads: { artifact: { path: 'x/linux.jar', url: B + '/nope.jar', sha1: 'aa' } } },
      { name: 'old:native:1', natives: { windows: 'natives-windows' }, extract: { exclude: ['META-INF/'] }, downloads: { classifiers: { 'natives-windows': { path: 'old/native/1/native-1-natives-windows.jar', url: B + '/native.jar', sha1: sha(nativeJar) } } } }
    ],
    arguments: { jvm: ['-Djava.library.path=${natives_directory}', { rules: [{ action: 'allow', os: { name: 'windows' } }], value: '-XX:HeapDumpPath=x' }, { rules: [{ action: 'allow', os: { name: 'osx' } }], value: '-XstartOnFirstThread' }, '-cp', '${classpath}'],
      game: ['--username', '${auth_player_name}', '--uuid', '${auth_uuid}', '--accessToken', '${auth_access_token}', '--version', '${version_name}', { rules: [{ action: 'allow', features: { has_custom_resolution: true } }], value: ['--width', '${resolution_width}', '--height', '${resolution_height}'] }] } };
  fs.mkdirSync(path.join(root, 'versions', '1.20.1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'versions', '1.20.1', '1.20.1.json'), JSON.stringify(vanilla));
  const fabric = { id: 'fabric-loader-0.16.0-1.20.1', inheritsFrom: '1.20.1', mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient', type: 'release',
    libraries: [{ name: 'net.fabricmc:fabric-loader:0.16.0', url: B + '/' }, { name: 'com.example:lib:2.0', url: B + '/' }], arguments: { game: [], jvm: ['-DFabricMcEmu=x'] } };
  fs.mkdirSync(path.join(root, 'versions', fabric.id), { recursive: true });
  fs.writeFileSync(path.join(root, 'versions', fabric.id, fabric.id + '.json'), JSON.stringify(fabric));
  // maven-style libs: serve at path derived from name
  files['/net/fabricmc/fabric-loader/0.16.0/fabric-loader-0.16.0.jar'] = libJar; files['/com/example/lib/2.0/lib-2.0.jar'] = libJar;

  await ok('ensureVersion downloads + verifies', async () => {
    const steps = []; const j = await mc.ensureVersion(root, '1.20.1', { onProgress: (s, p) => steps.push(s) });
    assert.strictEqual(j.id, '1.20.1'); assert(fs.existsSync(path.join(root, 'versions', '1.20.1', '1.20.1.jar')));
    assert(fs.existsSync(path.join(root, 'libraries', 'org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-windows.jar')));
    assert(!fs.existsSync(path.join(root, 'libraries', 'x/linux.jar')), 'linux lib must be filtered out');
    assert(fs.existsSync(path.join(root, 'assets', 'log_configs', 'client-1.12.xml')));
  });
  await ok('hash mismatch is detected', async () => {
    const bad = path.join(tmp, 'bad.jar'); await assert.rejects(util.download(B + '/lib.jar', bad, { sha: 'deadbeef' }));
    assert(!fs.existsSync(bad));
  });
  await ok('natives are extracted (no META-INF)', () => {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'versions', '1.20.1', '1.20.1.json'), 'utf8')), d = path.join(tmp, 'natives');
    mc.extractNatives(root, { ...j, _base: '1.20.1' }, d);
    assert.deepStrictEqual(fs.readdirSync(d), ['lwjgl.dll']);
  });
  await ok('fabric inherits & overrides libs, builds launch args', async () => {
    const j = await mc.ensureVersion(root, fabric.id);
    assert.strictEqual(j.mainClass, fabric.mainClass); assert.strictEqual(j._base, '1.20.1');
    const cp = mc.classpath(root, j); assert(cp.some(p => p.endsWith('fabric-loader-0.16.0.jar')));
    assert.strictEqual(cp.filter(p => /[\\/]lib[\\/]/.test(p)).length, 1, 'duplicate com.example:lib must be deduped');
    assert(cp[cp.length - 1].endsWith('1.20.1.jar'));
    const args = mc.buildArgs(root, j, { account: { name: 'Steve', uuid: 'u1', type: 'offline' }, gameDir: path.join(tmp, 'g'), natives: path.join(tmp, 'natives'), assetsDir: path.join(root, 'assets'), ram: 3000, res: { w: 854, h: 480 }, jvmArgs: ['-Dx=1'] });
    assert.strictEqual(args[0], '-Xmx3000M'); assert(args.includes('-Dx=1')); assert(args.includes('-XX:HeapDumpPath=x')); assert(!args.includes('-XstartOnFirstThread'));
    assert(args.some(a => a.startsWith('-Dlog4j.configurationFile=')), 'log4j config inherited from vanilla must be applied');
    const mi = args.indexOf(fabric.mainClass); assert(mi > 0); assert.deepStrictEqual(args.slice(mi + 1, mi + 5), ['--username', 'Steve', '--uuid', 'u1']);
    assert(args.includes('--width') && args.includes('854')); assert(args.includes('0'), 'offline token placeholder');
    assert(args.includes('-cp') && args[args.indexOf('-cp') + 1].includes(';'));
  });
  await ok('legacy minecraftArguments format', () => {
    const j = { id: 'old', type: 'release', mainClass: 'M', _base: 'old', minecraftArguments: '--username ${auth_player_name} --gameDir ${game_directory}', libraries: [], assets: 'legacy' };
    const a = mc.buildArgs(root, j, { account: { name: 'A', uuid: 'u', type: 'offline' }, gameDir: 'G', natives: 'N', assetsDir: 'AS', ram: 1024, res: { w: 0, h: 0 }, jvmArgs: [] });
    assert(a.includes('-Djava.library.path=N') && a.includes('-cp')); assert.deepStrictEqual(a.slice(a.indexOf('M') + 1), ['--username', 'A', '--gameDir', 'G']);
  });

  // ---- store / accounts / instances ----
  store.init(path.join(tmp, 'data')); inst.init(path.join(tmp, 'data'));
  await ok('offline account validation + token-free public config', () => {
    assert.throws(() => auth.addOffline('a b'), /INVALID_NAME/); assert.throws(() => auth.addOffline('ab'));
    const a = auth.addOffline('Steve_1'); assert.strictEqual(a.uuid.length, 32);
    store.get().accounts.push({ id: 'ms-1', type: 'microsoft', name: 'X', uuid: 'u', mcToken: 'SECRET', refresh: 'SECRET2' });
    assert(!JSON.stringify(store.pub()).includes('SECRET'));
  });
  await ok('instances: create/update/list/files/toggle/delete', () => {
    const i = inst.create({ name: 'Test ../Pack', mc: '1.20.1', loader: { type: 'fabric', version: '0.16.0' } });
    assert(/^[a-z0-9-]+$/.test(i.id), i.id);
    const g = inst.gdir(i.id); fs.mkdirSync(path.join(g, 'mods'), { recursive: true });
    const z = new AdmZip(); z.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ name: 'Cool Mod', version: '1.2.3' }))); z.writeZip(path.join(g, 'mods', 'cool.jar'));
    let f = inst.files(i.id, 'mods'); assert.strictEqual(f[0].title, 'Cool Mod'); assert.strictEqual(f[0].version, '1.2.3'); assert(f[0].enabled);
    inst.toggle(i.id, 'mods', 'cool.jar'); assert(!inst.files(i.id, 'mods')[0].enabled);
    assert.throws(() => inst.toggle(i.id, 'mods', '../../../etc/passwd'));
    const u = inst.update(i.id, { name: 'Renamed', mc: '1.21.1', loader: { type: 'vanilla', version: '' }, ram: 2048 });
    assert.strictEqual(u.name, 'Renamed'); assert.strictEqual(u.loader.type, 'vanilla'); assert.strictEqual(inst.list().length, 1);
    inst.del(i.id, 'mods', 'cool.jar.disabled'); assert.strictEqual(inst.files(i.id, 'mods').length, 0);
    inst.remove(i.id); assert.strictEqual(inst.list().length, 0);
  });
  srv.close();
  console.log(`\n${n} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
