const crypto = require('crypto');
const { UA, sleep } = require('./util');
const store = require('./store');
const TOKEN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const SCOPE = 'XboxLive.signin offline_access';

function offlineUUID(name) {
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  return h.toString('hex');
}
function upsert(acc) {
  const L = store.get().accounts, i = L.findIndex(a => a.id === acc.id);
  if (i >= 0) L[i] = acc; else L.push(acc);
  store.get().selected = acc.id; store.save(); return acc;
}
function addOffline(name) {
  name = String(name || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('INVALID_NAME');
  return upsert({ id: 'off-' + name.toLowerCase(), type: 'offline', name, uuid: offlineUUID(name) });
}
function remove(id) {
  const c = store.get(); c.accounts = c.accounts.filter(a => a.id !== id);
  if (c.selected === id) c.selected = c.accounts[0] ? c.accounts[0].id : null; store.save();
}
async function jpost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.XErr ? 'Xbox error ' + j.XErr : (j.errorMessage || j.error_description || j.error || 'HTTP ' + r.status));
  return j;
}
async function form(url, obj) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: new URLSearchParams(obj) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}
async function xboxChain(msAccess) {
  const xbl = await jpost('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msAccess }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' });
  const xsts = await jpost('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' });
  const uhs = xsts.DisplayClaims.xui[0].uhs;
  const mc = await jpost('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.Token}` });
  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + mc.access_token, 'User-Agent': UA } });
  if (!pr.ok) throw new Error('NO_MINECRAFT');
  const p = await pr.json();
  return { mcToken: mc.access_token, expires: Date.now() + mc.expires_in * 1000 - 60000, name: p.name, uuid: p.id };
}
async function msLogin(onCode) {
  const cid = store.get().msClientId;
  if (!cid) throw new Error('NO_CLIENT_ID');
  const dc = await form('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', { client_id: cid, scope: SCOPE });
  if (!dc.ok) throw new Error(dc.j.error_description || 'device code failed');
  onCode({ code: dc.j.user_code, url: dc.j.verification_uri });
  const end = Date.now() + dc.j.expires_in * 1000; let wait = (dc.j.interval || 5) * 1000;
  while (Date.now() < end) {
    await sleep(wait);
    const t = await form(TOKEN, { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: cid, device_code: dc.j.device_code });
    if (t.ok) {
      const x = await xboxChain(t.j.access_token);
      return upsert({ id: 'ms-' + x.uuid, type: 'microsoft', name: x.name, uuid: x.uuid, mcToken: x.mcToken, expires: x.expires, refresh: t.j.refresh_token });
    }
    if (t.j.error === 'authorization_pending') continue;
    if (t.j.error === 'slow_down') { wait += 5000; continue; }
    throw new Error(t.j.error_description || t.j.error || 'login failed');
  }
  throw new Error('LOGIN_TIMEOUT');
}
async function fresh(acc) {
  if (acc.type !== 'microsoft' || acc.expires > Date.now()) return acc;
  const t = await form(TOKEN, { grant_type: 'refresh_token', client_id: store.get().msClientId, refresh_token: acc.refresh, scope: SCOPE });
  if (!t.ok) throw new Error('SESSION_EXPIRED');
  const x = await xboxChain(t.j.access_token);
  Object.assign(acc, { mcToken: x.mcToken, expires: x.expires, name: x.name, refresh: t.j.refresh_token || acc.refresh });
  store.save(); return acc;
}
async function uploadSkin(acc, pngBuffer, variant) {
  await fresh(acc);
  const fd = new FormData();
  fd.append('variant', variant === 'slim' ? 'slim' : 'classic');
  fd.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'skin.png');
  const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', { method: 'POST', headers: { Authorization: 'Bearer ' + acc.mcToken, 'User-Agent': UA }, body: fd });
  if (!r.ok) throw new Error('Skin upload failed (HTTP ' + r.status + ')');
}
module.exports = { offlineUUID, addOffline, remove, msLogin, fresh, uploadSkin };
