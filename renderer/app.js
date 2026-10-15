const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function A(c, ...a) { const r = await api.invoke(c, ...a); if (!r.ok) throw new Error(r.error); return r.data; }
const S = { cfg: null, info: { version: '0.3.7' }, view: 'home', insts: [], cur: null, tab: 'overview', td: null, vers: [], news: [], skins: [], run: {}, logs: {}, anim: true, ws: 0, wname: '',
  br: { src: 'modrinth', type: 'mod', q: '', res: null, inst: '', busy: false }, vfilter: 'release', sel: null, page: null, cdir: '', cicon: null, ciconUrl: null, createVer: null };
const T0 = Date.now();
const ART = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(n => `assets/art/${n}.jpg`);
const LINKS = { site: 'https://primelauncherar.netlify.app/', discord: 'https://discord.gg/Dtwcwhhv4j', youtube: 'https://www.youtube.com/@PrimeLauncher' };
const ACCENTS = { green: '#2fd480', yellow: '#f6c945', orange: '#ff9a3d', blue: '#4aa3ff', brown: '#b98152', red: '#ff5d5d', pink: '#ff78b4', purple: '#a971ff' };
const THEMES = ['system', 'auto', 'light', 'dark', 'oled'];
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];
const t = k => ((I18N[S.cfg && S.cfg.lang] || I18N.en)[k]) || I18N.en[k] || k;
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  home: ic('<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  library: ic('<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>'),
  browse: ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  skins: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  settings: ic('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>')
};
function errMsg(e) {
  const m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), code = m.split(':')[0];
  const k = 'e_' + code; return I18N.en[k] ? t(k) + (m.includes(':') && code === 'JAVA_MISSING' ? ' ' + m.split(':')[1] : '') : m;
}
function toast(msg, kind = '') {
  const d = document.createElement('div'); d.className = 'ts ' + kind; d.textContent = msg; $('#toasts').appendChild(d);
  setTimeout(() => { d.style.opacity = 0; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 400); }, 4200);
}
function modal(html, cls = '') { $('#modal').innerHTML = `<div class="ov" data-ov="1"><div class="md ${cls}">${html}</div></div>`; }
const closeModal = () => { $('#modal').innerHTML = ''; };
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0);
const fmtD = d => d ? new Date(d).toLocaleDateString(S.cfg.lang === 'ar' ? 'ar-EG' : undefined) : '';
const fmtS = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const acct = () => S.cfg.accounts.find(a => a.id === S.cfg.selected);
const avatar = a => a && a.type === 'microsoft' ? `https://minotar.net/helm/${a.uuid}/64.png` : `https://minotar.net/helm/${encodeURIComponent((a && a.name) || 'Steve')}/64.png`;

/* theme */
function resolvedTheme() {
  const th = S.cfg.theme;
  if (th === 'system') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (th === 'auto') { const h = new Date().getHours(); return h >= 7 && h < 18 ? 'light' : 'dark'; }
  return th;
}
function applyTheme() {
  const r = document.documentElement;
  r.dataset.theme = resolvedTheme(); r.dataset.accent = S.cfg.accent; r.lang = S.cfg.lang; r.dir = S.cfg.lang === 'ar' ? 'rtl' : 'ltr';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.cfg && applyTheme());
setInterval(() => S.cfg && S.cfg.theme === 'auto' && applyTheme(), 60000);

/* views */
function verOptions(filter, sel) {
  const ok = v => filter === 'all' ? true : filter === 'old' ? v.type.startsWith('old') : v.type === filter;
  const L = S.vers.filter(ok); if (sel && !L.find(v => v.id === sel)) L.unshift({ id: sel });
  return L.map(v => `<option ${v.id === sel ? 'selected' : ''}>${esc(v.id)}</option>`).join('');
}
const segFilter = (cur, id) => `<select id="${id}" data-c="vfilter" style="width:auto">${['release', 'snapshot', 'old', 'all'].map(f => `<option value="${f}" ${f === cur ? 'selected' : ''}>${t('f_' + f)}</option>`).join('')}</select>`;
const loaderOpts = sel => LOADERS.map(l => `<option value="${l}" ${l === sel ? 'selected' : ''}>${t('l_' + l)}</option>`).join('');
const instIcon = i => `<div class="ic">${i.iconUrl ? `<img src="${esc(i.iconUrl)}" alt="">` : '🧱'}</div>`;
const instCard = i => `<div class="card h inst" data-a="open" data-id="${esc(i.id)}">${instIcon(i)}<div class="grow" style="flex:1;min-width:0"><b>${esc(i.name)}</b>
<div class="mu sm">${esc(i.mc)} · ${t('l_' + i.loader.type)}${i.loader.version ? ' ' + esc(i.loader.version) : ''}</div><div class="mu sm">${i.lastPlayed ? fmtD(i.lastPlayed) : t('never')}</div></div>
<button class="btn p sm" data-a="play" data-id="${esc(i.id)}">▶</button></div>`;

const instSub = i => `${esc(i.mc)}${i.loader.type !== 'vanilla' ? ' · ' + t('l_' + i.loader.type) + (i.loader.version ? ' ' + esc(i.loader.version) : '') : ''}`;
const selInst = () => S.insts.find(i => i.id === S.sel) || S.insts[0];
function vHome() {
  const a = acct(), cur = selInst(), rel = S.vers.filter(v => v.type === 'release').slice(0, 6), snap = S.vers.find(v => v.type === 'snapshot'), el = ((Date.now() - T0) / 1000) % 48;
  const menu = `<div class="selmenu" id="selmenu">${S.insts.map(i => `<button class="mi ${cur && i.id === cur.id ? 'on' : ''}" data-a="selPick" data-id="${esc(i.id)}">${instIcon(i)}<div><b>${esc(i.name)}</b><small>${instSub(i)}</small></div></button>`).join('')}<button class="mi" data-a="newInst"><div class="ic">＋</div><div><b>${t('newInst')}</b></div></button></div>`;
  return `<div class="stage"><div class="slides">${ART.map((u, i) => `<div class="sl" style="animation-delay:${(i * 8 - el).toFixed(2)}s;background-image:url('${u}')"></div>`).join('')}</div>
  <div class="tx"><h1>${t('welcome')}${a ? '، ' + esc(a.name) : ''}</h1><p>${t('tagline')}</p></div>
  <div class="bar2"><div class="selwrap">${menu}<button class="sel" data-a="selToggle">${cur ? instIcon(cur) + `<div><b>${esc(cur.name)}</b><small>${instSub(cur)}</small></div>` : `<div class="ic">＋</div><div><b>${t('newInst')}</b></div>`}<span>▾</span></button></div>
  ${cur ? `<button class="btn p play" data-a="play" data-id="${esc(cur.id)}">${t('play')}</button>` : `<button class="btn p play" data-a="newInst">＋ ${t('newInst')}</button>`}</div></div>
  <h2>${t('news')}</h2><div class="grid news">${S.news.map((n, k) => `<div class="card h"><img class="nimg" src="${esc(n.image || ART[k % ART.length])}" alt="" loading="lazy"><div class="row"><b class="grow">${esc(n.title)}</b></div><div class="mu sm" style="margin:4px 0">${esc(n.version || '')} · ${fmtD(n.date)}</div><p class="sm mu">${esc(n.text).slice(0, 160)}</p></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${S.remote ? t('newsOff') : t('loading')}</div>`}</div>
  <h2>${t('releases')}</h2><div class="grid">${(snap ? [snap] : []).concat(rel).map(v => `<div class="card h"><div class="row"><b class="grow">${esc(v.id)}</b><span class="tag ${v.type === 'release' ? 'ac' : ''}">${t('f_' + v.type)}</span></div><div class="mu sm" style="margin:4px 0 12px">${fmtD(v.date)}</div><button class="btn sm" data-a="quick" data-v="${esc(v.id)}">＋ ${t('newInst')}</button></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${S.remote ? t('newsOff') : t('loading')}</div>`}</div>`;
}
function vLibrary() {
  return `<div class="row"><h1 class="grow">${t('library')}</h1><button class="btn p" data-a="newInst">＋ ${t('newInst')}</button></div>
  <div class="grid" style="margin-top:18px">${S.insts.map(instCard).join('') || `<div class="empty" style="grid-column:1/-1">${t('noInst')}</div>`}</div>`;
}
function vInst() {
  const i = S.insts.find(x => x.id === S.cur); if (!i) return vLibrary();
  const tabs = ['overview', 'mods', 'resourcepacks', 'shaderpacks', 'worlds', 'screenshots'];
  return `<div class="row"><button class="btn sm" data-a="nav" data-v="library">${S.cfg.lang === 'ar' ? '→' : '←'}</button>${instIcon(i)}<div class="grow"><h1 style="font-size:24px">${esc(i.name)}</h1><div class="mu">${esc(i.mc)} · ${t('l_' + i.loader.type)}${i.loader.version ? ' ' + esc(i.loader.version) : ''}</div></div>
  ${i.running || S.run[i.id] && S.run[i.id].running ? `<button class="btn d" data-a="stop" data-id="${esc(i.id)}">■ ${t('stop')}</button>` : `<button class="btn p big" data-a="play" data-id="${esc(i.id)}">▶ ${t('play')}</button>`}</div>
  <div class="tabs">${tabs.map(x => `<button class="${S.tab === x ? 'on' : ''}" data-a="tab" data-t="${x}">${t('tab_' + x)}</button>`).join('')}</div>${vTab(i)}`;
}
function vTab(i) {
  const id = esc(i.id), td = S.td;
  if (S.tab === 'overview') {
    const ram = i.ram || S.cfg.ram;
    return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="card"><h3>${t('general')}</h3>
    <label class="f">${t('name')}</label><input type="text" id="i-name" value="${esc(i.name)}" maxlength="40">
    <label class="f">${t('version')}</label><div class="row"><select id="i-ver" class="grow" data-c="loaderRefresh" data-pre="i">${verOptions('all', i.mc)}</select></div>
    <label class="f">${t('loader')}</label><div class="row"><select id="i-loader" data-c="loaderRefresh" data-pre="i" style="flex:1">${loaderOpts(i.loader.type)}</select><select id="i-lver" style="flex:1" data-cur="${esc(i.loader.version)}"><option>${esc(i.loader.version || '')}</option></select></div>
    <div class="row" style="margin-top:14px"><button class="btn p" data-a="saveInst" data-id="${id}">${t('save')}</button><button class="btn" data-a="icon" data-id="${id}">🖼 ${t('changeIcon')}</button></div></div>
    <div class="card"><h3>${t('java')}</h3><label class="f">${t('ram')}: <b id="ramv">${ram}</b> MB</label><input type="range" id="i-ram" min="1024" max="16384" step="256" value="${ram}" data-c="ramv">
    <label class="f">${t('javaPath')}</label><input type="text" id="i-java" value="${esc(i.javaPath)}" placeholder="${t('auto')}">
    <label class="f">${t('jvmArgs')}</label><input type="text" id="i-jvm" value="${esc(i.jvmArgs)}" placeholder="-XX:+UseG1GC"><label class="f">${t('resolution')}</label><div class="row"><input type="text" id="i-w" value="${i.res && i.res.w || ''}" placeholder="W" style="width:90px"><span>×</span><input type="text" id="i-h" value="${i.res && i.res.h || ''}" placeholder="H" style="width:90px"></div></div>
    <div class="card"><h3>${t('tools')}</h3><div class="row"><button class="btn" data-a="openDir" data-id="${id}" data-sub="">📂 ${t('openFolder')}</button><button class="btn" data-a="repair" data-id="${id}">🛠 ${t('repair')}</button><button class="btn" data-a="logs" data-id="${id}">📜 ${t('logs')}</button><button class="btn d" data-a="delInst" data-id="${id}">🗑 ${t('delete')}</button></div></div></div>`;
  }
  if (!td) return `<div class="empty">${t('loading')}</div>`;
  if (['mods', 'resourcepacks', 'shaderpacks'].includes(S.tab)) {
    const type = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader' }[S.tab];
    return `<div class="row" style="margin-bottom:12px"><button class="btn p" data-a="browseFor" data-id="${id}" data-type="${type}">＋ ${t('addContent')}</button><button class="btn" data-a="openDir" data-id="${id}" data-sub="${S.tab}">📂 ${t('openFolder')}</button><span class="mu">${td.length}</span></div>
    <div class="card" style="padding:0">${td.map(f => `<div class="li"><input type="checkbox" ${f.enabled ? 'checked' : ''} data-a="toggleF" data-id="${id}" data-k="${S.tab}" data-f="${esc(f.file)}"><div class="t"><b>${esc(f.title)}</b><span class="mu sm">${esc(f.version)} ${f.dir ? '' : fmtS(f.size)}</span></div><button class="btn sm d" data-a="delF" data-id="${id}" data-k="${S.tab}" data-f="${esc(f.file)}">✕</button></div>`).join('') || `<div class="empty">${t('empty')}</div>`}</div>`;
  }
  if (S.tab === 'worlds') return `<div class="card" style="padding:0">${td.map(w => `<div class="li"><span>🌍</span><div class="t"><b>${esc(w.name)}</b><span class="mu sm">${fmtD(w.modified)}</span></div></div>`).join('') || `<div class="empty">${t('empty')}</div>`}</div>`;
  if (S.tab === 'screenshots') return `<div class="row" style="margin-bottom:12px"><button class="btn" data-a="openDir" data-id="${id}" data-sub="screenshots">📂 ${t('openFolder')}</button></div><div class="shots">${td.map(s => `<img src="${esc(s.url)}" alt="" loading="lazy" data-a="shot" data-u="${esc(s.url)}">`).join('') || `<div class="empty">${t('empty')}</div>`}</div>`;
  return '';
}
function vBrowse() {
  const b = S.br, inst = S.insts.find(i => i.id === b.inst), needInst = b.type !== 'modpack';
  return `<h1>${t('browse')}</h1><div class="card" style="margin:16px 0"><div class="row">
  <div class="seg">${['modrinth', 'curseforge'].map(s => `<button class="${b.src === s ? 'on' : ''}" data-a="brSrc" data-v="${s}">${s === 'modrinth' ? 'Modrinth' : 'CurseForge'}</button>`).join('')}</div>
  <div class="seg">${['mod', 'resourcepack', 'shader', 'modpack'].map(s => `<button class="${b.type === s ? 'on' : ''}" data-a="brType" data-v="${s}">${t('ty_' + s)}</button>`).join('')}</div></div>
  <div class="row" style="margin-top:12px"><input type="search" id="br-q" class="grow" style="flex:1" placeholder="${t('search')}" value="${esc(b.q)}" data-enter="brSearch">
  ${needInst ? `<select id="br-inst" style="width:220px" data-c="brInst"><option value="">${t('selectInst')}</option>${S.insts.map(i => `<option value="${esc(i.id)}" ${i.id === b.inst ? 'selected' : ''}>${esc(i.name)} (${esc(i.mc)})</option>`).join('')}</select>` : ''}
  <button class="btn p" data-a="brSearch">${t('search')}</button></div>${b.src === 'curseforge' && !S.cfg.cfKey ? `<p class="mu sm" style="margin-top:10px">⚠ ${t('e_NO_CF_KEY')}</p>` : ''}</div>
  <div class="grid">${b.res === null ? `<div class="empty" style="grid-column:1/-1">${t('browseHint')}</div>` : b.res.map((r, n) => `<div class="card h"><div class="row" style="flex-wrap:nowrap">${r.icon ? `<img src="${esc(r.icon)}" width="52" height="52" style="border-radius:12px;flex:none" alt="">` : ''}<div style="min-width:0"><b>${esc(r.title)}</b><div class="mu sm">${esc(r.author || '')} · ⬇ ${fmtN(r.downloads)}</div></div></div>
  <p class="sm mu" style="margin:10px 0;min-height:36px">${esc(r.desc || '').slice(0, 120)}</p><div class="row"><button class="btn p sm" data-a="install" data-n="${n}" ${b.busy ? 'disabled' : ''}>⬇ ${t('install')}</button>${r.url ? `<button class="btn sm" data-a="link" data-u="${esc(r.url)}">↗</button>` : ''}</div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${t('noResults')}</div>`}</div>`;
}
function vSkins() {
  const a = acct();
  return `<div class="row"><h1 class="grow">${t('skins')}</h1><button class="btn p" data-a="skinAdd" data-v="classic">＋ ${t('addSkin')} (Steve)</button><button class="btn" data-a="skinAdd" data-v="slim">＋ ${t('addSkin')} (Alex)</button></div>
  <p class="mu sm" style="margin:8px 0 18px">${a && a.type === 'microsoft' ? t('skinMs') : t('skinOffline')}</p>
  <div class="grid">${a ? `<div class="card" style="text-align:center"><canvas class="sk" width="96" height="192" data-skin="https://minotar.net/skin/${a.type === 'microsoft' ? esc(a.uuid) : encodeURIComponent(a.name)}"></canvas><div style="margin-top:8px"><b>${esc(a.name)}</b></div><div class="mu sm">${t('current')}</div></div>` : ''}
  ${S.skins.map(s => `<div class="card" style="text-align:center"><canvas class="sk" width="96" height="192" data-skin="${esc(s.url)}"></canvas><div style="margin:8px 0"><b>${esc(s.name)}</b> <span class="tag">${s.variant}</span></div><div class="row" style="justify-content:center"><button class="btn p sm" data-a="skinApply" data-id="${esc(s.id)}">${t('apply')}</button><button class="btn d sm" data-a="skinDel" data-id="${esc(s.id)}">✕</button></div></div>`).join('')}</div>`;
}
function vSettings() {
  const c = S.cfg;
  return `<h1>${t('settings')}</h1><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-top:18px">
  <div class="card"><h3>${t('appearance')}</h3><label class="f">${t('language')}</label><select data-c="cfg:lang"><option value="ar" ${c.lang === 'ar' ? 'selected' : ''}>العربية</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select>
  <label class="f">${t('theme')}</label><div class="seg">${THEMES.map(x => `<button class="${c.theme === x ? 'on' : ''}" data-a="theme" data-v="${x}">${t('th_' + x)}</button>`).join('')}</div>
  <label class="f">${t('accent')}</label><div class="sw">${Object.entries(ACCENTS).map(([k, v]) => `<button class="${c.accent === k ? 'on' : ''}" data-a="accent" data-v="${k}" style="background:${v}" title="${t('ac_' + k)}"></button>`).join('')}</div>
  <label class="f"><input type="checkbox" data-c="cfg:closeOnLaunch" ${c.closeOnLaunch ? 'checked' : ''}> ${t('minimize')}</label></div>
  <div class="card"><h3>${t('java')}</h3><label class="f"><input type="checkbox" data-c="cfg:autoJava" ${c.autoJava ? 'checked' : ''}> ${t('autoJava')}</label>
  <label class="f">${t('ram')}: <b id="ramv">${c.ram}</b> MB</label><input type="range" min="1024" max="16384" step="256" value="${c.ram}" data-c="cfg:ram">
  <label class="f">${t('javaPath')}</label><input type="text" value="${esc(c.javaPath)}" data-c="cfg:javaPath" placeholder="${t('auto')}"><label class="f">${t('jvmArgs')}</label><input type="text" value="${esc(c.jvmArgs)}" data-c="cfg:jvmArgs">
  <div style="margin-top:12px"><button class="btn sm" data-a="javaList">${t('detectJava')}</button></div></div>
  <div class="card"><h3>${t('accounts')}</h3>${c.accounts.map(a => `<div class="li" style="padding:8px 0"><img src="${avatar(a)}" width="30" height="30" style="border-radius:6px;image-rendering:pixelated" alt=""><div class="t"><b>${esc(a.name)}</b><span class="mu sm">${t('acc_' + a.type)}</span></div>${a.id === c.selected ? `<span class="tag ac">✓</span>` : `<button class="btn sm" data-a="acctSel" data-id="${esc(a.id)}">${t('use')}</button>`}<button class="btn sm d" data-a="acctDel" data-id="${esc(a.id)}">✕</button></div>`).join('') || `<p class="mu">${t('noAcc')}</p>`}
  <label class="f">${t('offlineName')}</label><div class="row"><input type="text" id="off-name" class="grow" style="flex:1" maxlength="16" data-enter="acctOff"><button class="btn" data-a="acctOff">${t('add')}</button></div>
  <div style="margin-top:12px"><button class="btn p" data-a="acctMs">${t('msLogin')}</button></div>
  <label class="f">${t('msClient')} <a href="#" data-a="link" data-u="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app" style="color:var(--ac)">?</a></label><input type="text" value="${esc(c.msClientId)}" data-c="cfg:msClientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
  <label class="f">${t('cfKey')}</label><input type="password" value="${esc(c.cfKey)}" data-c="cfg:cfKey" placeholder="$2a$10$..."></div>
  <div class="card"><h3>${t('about')}</h3><p class="mu sm" style="margin-bottom:12px">Prime Launcher v${esc(S.info.version)}</p><div class="row"><button class="btn p" data-a="about">ℹ ${t('about')}</button><button class="btn" data-a="link" data-u="${LINKS.discord}">Discord</button><button class="btn" data-a="link" data-u="${LINKS.youtube}">YouTube</button><button class="btn" data-a="link" data-u="${LINKS.site}">${t('website')}</button></div></div></div>`;
}
function aboutHtml() {
  return `<div style="text-align:center"><img src="assets/logo.svg" style="width:min(320px,80%);border-radius:16px" alt="Prime Launcher"><h2 style="margin:14px 0 2px">Prime Launcher</h2><div class="mu">${t('tagline')}</div><div class="tag ac" style="margin-top:8px">v${esc(S.info.version)}</div></div>
  <div class="card" style="margin:18px 0"><div class="li"><span class="grow">${t('devSite')}</span><b>egyptia26</b></div><div class="li"><span class="grow">${t('devApp')}</span><b>djawad1</b></div><div class="li"><span class="grow">${t('credits')}</span><b>GMU Launcher</b></div></div>
  <p class="sm" style="text-align:center"><b>© GMU Studio</b> — GMU Launcher. ${t('rights')}</p><p class="mu sm" style="text-align:center;margin-top:10px">${t('disclaimer')}</p>
  <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" data-a="link" data-u="${LINKS.site}">${t('website')}</button><button class="btn" data-a="link" data-u="${LINKS.discord}">Discord</button><button class="btn" data-a="link" data-u="${LINKS.youtube}">YouTube</button><button class="btn p" data-a="closeModal">${t('close')}</button></div>`;
}
function vWelcome() {
  const c = S.cfg, dots = `<div class="dots">${[0, 1, 2].map(i => `<i class="${S.ws === i ? 'on' : ''}"></i>`).join('')}</div>`;
  let body;
  if (S.ws === 0) body = `<div class="step"><img class="lg" src="assets/logo.svg" alt="Prime Launcher"><h1 style="margin-top:20px">${t('welcomeTitle')}</h1><p class="mu">${t('welcomeSub')}</p>
    <div class="row" style="justify-content:center;margin:22px 0"><div class="seg"><button class="${c.lang === 'ar' ? 'on' : ''}" data-a="lang" data-v="ar">العربية</button><button class="${c.lang === 'en' ? 'on' : ''}" data-a="lang" data-v="en">English</button></div></div>
    <div class="seg" style="margin-bottom:16px">${THEMES.map(x => `<button class="${c.theme === x ? 'on' : ''}" data-a="theme" data-v="${x}">${t('th_' + x)}</button>`).join('')}</div>
    <div class="sw" style="justify-content:center;margin-bottom:24px">${Object.entries(ACCENTS).map(([k, v]) => `<button class="${c.accent === k ? 'on' : ''}" data-a="accent" data-v="${k}" style="background:${v}"></button>`).join('')}</div>
    <button class="btn p big" data-a="wsNext">${t('next')}</button></div>`;
  else if (S.ws === 1) body = `<div class="step"><h1>${t('signIn')}</h1><p class="mu" style="margin-bottom:22px">${t('signInSub')}</p>
    <div class="card" style="text-align:start"><h3>${t('acc_offline')}</h3><div class="row"><input type="text" id="off-name" class="grow" style="flex:1" maxlength="16" placeholder="Steve" value="${esc(S.wname)}" data-enter="wsOff"><button class="btn p" data-a="wsOff">${t('next')}</button></div></div>
    <div class="card" style="margin-top:12px;text-align:start"><h3>${t('acc_microsoft')}</h3><p class="mu sm" style="margin-bottom:10px">${t('msHint')}</p><label class="f">${t('msClient')}</label><input type="text" value="${esc(c.msClientId)}" data-c="cfg:msClientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"><div style="margin-top:10px"><button class="btn" data-a="acctMs">${t('msLogin')}</button></div></div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" data-a="wsBack">${t('back')}</button>${c.accounts.length ? `<button class="btn p" data-a="wsNext">${t('next')}</button>` : ''}</div></div>`;
  else body = `<div class="step"><div style="font-size:64px">🎮</div><h1>${t('ready')}</h1><p class="mu">${t('readySub')}</p><div class="row" style="justify-content:center;margin-top:24px"><button class="btn" data-a="wsBack">${t('back')}</button><button class="btn p big" data-a="wsFinish">${t('start')}</button></div></div>`;
  return `<div class="wel"><div class="box">${body}${dots}</div></div>`;
}
function render() {
  if (!S.cfg) return;
  applyTheme();
  const app = $('#app');
  if (S.cfg.first) { app.innerHTML = vWelcome(); return; }
  const nav = [['home', 'home'], ['library', 'library'], ['browse', 'browse'], ['skins', 'skins'], ['settings', 'settings']], a = acct();
  const v = S.cur ? vInst() : { home: vHome, library: vLibrary, browse: vBrowse, skins: vSkins, settings: vSettings }[S.view]();
  const mainEl = $('#mainv'), keep = mainEl ? mainEl.scrollTop : 0, pg = S.page === 'create' ? $('.page') : null;
  app.innerHTML = `<div class="shell"><aside class="side"><div class="brand"><img src="assets/icon.svg" alt=""><div><b>Prime Launcher</b><small>${t('tagline')}</small></div></div>
  ${nav.map(([k, i]) => `<button class="nav ${!S.cur && S.view === k || S.cur && k === 'library' ? 'on' : ''}" data-a="nav" data-v="${k}">${ICONS[i]}<span>${t(k)}</span></button>`).join('')}<div class="sp"></div>
  <button class="acc" data-a="nav" data-v="settings"><img src="${avatar(a)}" alt=""><div><b>${esc(a ? a.name : t('noAcc'))}</b><small>${a ? t('acc_' + a.type) : ''}</small></div></button><div class="ver">v${esc(S.info.version)}</div></aside>
  <main id="mainv"><div class="view ${S.anim ? 'enter' : ''}">${v}</div></main></div>`;
  S.anim = false; if (S.keepScroll) { $('#mainv').scrollTop = keep; }
  if (S.page === 'create') { if (pg) app.appendChild(pg); else app.insertAdjacentHTML('beforeend', vCreate()); }
  drawSkins(); if (S.tab === 'overview' && S.cur) refreshLoader('i'); if (S.page === 'create' && !pg) refreshLoader('c');
}
/* skins canvas */
function drawSkins() {
  document.querySelectorAll('canvas[data-skin]').forEach(cv => {
    const img = new Image(); img.onload = () => {
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 96, 192); const s = 6, old = img.height === 32;
      const d = (sx, sy, w, h, dx, dy, flip) => { if (flip) { x.save(); x.translate((dx + w) * s, dy * s); x.scale(-1, 1); x.drawImage(img, sx, sy, w, h, 0, 0, w * s, h * s); x.restore(); } else x.drawImage(img, sx, sy, w, h, dx * s, dy * s, w * s, h * s); };
      d(4, 20, 4, 12, 4, 20); d(old ? 4 : 20, old ? 20 : 52, 4, 12, 8, 20, old); d(44, 20, 4, 12, 0, 8); d(old ? 44 : 36, old ? 20 : 52, 4, 12, 12, 8, old);
      d(20, 20, 8, 12, 4, 8); d(8, 8, 8, 8, 4, 0); d(40, 8, 8, 8, 4, 0);
    }; img.src = cv.dataset.skin;
  });
}
/* dock */
function renderDock() {
  $('#dock').innerHTML = Object.entries(S.run).map(([id, r]) => {
    const i = S.insts.find(x => x.id === id), pct = Math.round((r.pct || 0) * 100);
    return `<div class="dk"><div class="row"><b class="grow">${esc(i ? i.name : id)}</b>${r.running ? `<span class="tag ac">${t('running')}</span><button class="btn sm d" data-a="stop" data-id="${esc(id)}">■</button>` : `<span class="mu sm">${t('st_' + r.stage)} ${pct}%</span>`}<button class="btn sm" data-a="logs" data-id="${esc(id)}">📜</button></div>${r.running ? '' : `<div class="bar"><i style="width:${pct}%"></i></div>`}</div>`;
  }).join('');
}
/* data */
async function refresh() { S.insts = await A('inst:list'); S.skins = await A('skin:list'); }
async function loadTab() {
  S.td = null; if (S.tab === 'overview') return;
  const k = S.tab; try { S.td = await A({ worlds: 'inst:worlds', screenshots: 'inst:shots' }[k] || 'inst:files', S.cur, ...(['worlds', 'screenshots'].includes(k) ? [] : [k])); } catch (e) { toast(errMsg(e), 'err'); S.td = []; }
}
async function refreshLoader(pre) {
  const mcv = $('#' + pre + '-ver'), lt = $('#' + pre + '-loader'), lv = $('#' + pre + '-lver'); if (!mcv || !lt || !lv) return;
  const cur = lv.dataset.cur || '';
  if (lt.value === 'vanilla') { lv.innerHTML = '<option value="">—</option>'; lv.disabled = true; return; }
  lv.disabled = false; lv.innerHTML = `<option>${t('loading')}</option>`;
  try { const L = await A('loader:versions', mcv.value, lt.value); lv.innerHTML = L.length ? L.slice(0, 80).map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('') : `<option value="">${t('noLoader')}</option>`; }
  catch (e) { lv.innerHTML = `<option value="">${t('noLoader')}</option>`; }
  lv.dataset.cur = '';
}
function vCreate() {
  const v = S.createVer || (S.vers.find(x => x.type === 'release') || {}).id;
  return `<div class="page"><header>${t('createTitle')}<button class="btn sm" data-a="cancelCreate">✕</button></header><div class="body"><div class="col">
  <div style="text-align:center"><button class="iconpick" data-a="pickIcon" id="c-icon">${S.ciconUrl ? `<img src="${esc(S.ciconUrl)}" alt="">` : '🧱'}</button><div class="mu sm" style="margin-top:6px">${t('changeIcon')}</div></div>
  <div class="lbl">${t('name')}</div><input type="text" id="c-name" maxlength="40" placeholder="${t('myInst')}">
  <div class="lbl"><span>${t('version')}</span>${segFilter(S.vfilter, 'c-filter')}</div><select id="c-ver" data-c="loaderRefresh" data-pre="c">${verOptions(S.vfilter, v)}</select>
  <div class="lbl">${t('loader')}</div><div class="row" style="flex-wrap:nowrap"><select id="c-loader" style="flex:1" data-c="loaderRefresh" data-pre="c">${loaderOpts('vanilla')}</select><select id="c-lver" style="flex:1" disabled><option value="">—</option></select></div>
  <div class="lbl">${t('gameDir')}</div><div class="row" style="flex-wrap:nowrap"><input type="text" id="c-dir" style="flex:1" readonly placeholder="${t('defaultDir')}" value="${esc(S.cdir)}"><button class="btn" data-a="pickDir">${t('browse')}</button></div>
  <div class="lbl">${t('resolution')}</div><div class="row" style="flex-wrap:nowrap"><input type="text" id="c-w" placeholder="${t('auto')}"><span>×</span><input type="text" id="c-h" placeholder="${t('auto')}"></div>
  <div class="lbl" style="cursor:pointer" data-a="moreToggle"><span>${t('moreOptions')} ▾</span></div>
  <div class="more" id="c-more"><div class="lbl">${t('ram')}: <b id="cramv">${S.cfg.ram}</b> MB</div><input type="range" id="c-ram" min="1024" max="16384" step="256" value="${S.cfg.ram}" data-c="cramv">
  <div class="lbl">${t('javaPath')}</div><input type="text" id="c-java" placeholder="${t('auto')}"><div class="lbl">${t('jvmArgs')}</div><input type="text" id="c-jvm" placeholder="-XX:+UseG1GC"></div>
  </div></div><footer><button class="btn" data-a="cancelCreate">${t('cancel')}</button><button class="btn p" data-a="createInst">${t('create')}</button></footer></div>`;
}
function openCreate(v) {
  S.page = 'create'; S.cdir = ''; S.cicon = null; S.ciconUrl = null; S.createVer = v || null;
  S.vfilter = v && S.vers.find(x => x.id === v && x.type !== 'release') ? 'all' : 'release'; closeModal(); render();
}
async function play(id) {
  if (S.run[id]) return; S.run[id] = { stage: 'java', pct: 0 }; renderDock();
  try { await A('inst:launch', id); if (S.run[id]) { S.run[id].running = true; } S.insts = await A('inst:list'); renderDock(); }
  catch (e) { delete S.run[id]; renderDock(); toast(errMsg(e), 'err'); }
}
function showLogs(id) {
  const i = S.insts.find(x => x.id === id);
  modal(`<div class="row"><h2 class="grow" style="margin:0">${esc(i ? i.name : '')} — ${t('logs')}</h2><button class="btn sm" data-a="closeModal">✕</button></div><pre class="log" id="logbox" data-id="${esc(id)}" style="margin-top:12px">${esc((S.logs[id] || []).join(''))}</pre>`, 'w');
  const b = $('#logbox'); b.scrollTop = b.scrollHeight;
}
async function msLogin() {
  try {
    toast(t('msWait'));
    S.cfg = await A('acct:ms'); closeModal(); toast(t('done')); if (S.cfg.first && S.ws === 1) S.ws = 2; render();
  } catch (e) { closeModal(); toast(errMsg(e), 'err'); }
}
function instForm(pre) { const g = id => $('#' + pre + '-' + id); return { ver: g('ver').value, loader: { type: g('loader').value, version: g('lver').value || '' } }; }

/* actions */
const ACT = {
  nav: d => { S.view = d.v; S.cur = null; S.anim = true; if (d.v === 'library') refresh().then(render); else render(); },
  closeModal, link: d => A('shell:open', d.u), newInst: () => openCreate(), quick: d => openCreate(d.v),
  selToggle: () => $('#selmenu').classList.toggle('open'), selPick: d => { S.sel = d.id; render(); },
  cancelCreate: () => { S.page = null; render(); }, moreToggle: () => $('#c-more').classList.toggle('open'),
  pickIcon: async () => { const r = await A('pick:image'); if (r) { S.cicon = r.path; S.ciconUrl = r.url; const im = document.createElement('img'); im.src = r.url; $('#c-icon').replaceChildren(im); } },
  pickDir: async () => { const r = await A('pick:dir'); if (r) { S.cdir = r; $('#c-dir').value = r; } },
  lang: async d => { S.cfg = await A('cfg:set', { lang: d.v }); render(); },
  theme: async d => { S.cfg = await A('cfg:set', { theme: d.v }); render(); },
  accent: async d => { S.cfg = await A('cfg:set', { accent: d.v }); render(); },
  wsNext: () => { S.ws = Math.min(2, S.ws + 1); render(); }, wsBack: () => { S.ws = Math.max(0, S.ws - 1); render(); },
  wsOff: async () => { S.wname = $('#off-name').value; S.cfg = await A('acct:offline', S.wname); S.ws = 2; render(); },
  wsFinish: async () => { S.cfg = await A('cfg:set', { first: false }); S.anim = true; render(); },
  createInst: async () => {
    const f = instForm('c'); if (!f.ver) return toast(t('loading'), 'err');
    const g = id => $('#c-' + id).value.trim(), ram = +$('#c-ram').value;
    const inst = await A('inst:create', { name: g('name'), mc: f.ver, loader: f.loader, gameDir: S.cdir, iconPath: S.cicon, res: { w: +g('w') || 0, h: +g('h') || 0 }, ram: ram === S.cfg.ram ? 0 : ram, javaPath: g('java'), jvmArgs: g('jvm') });
    S.page = null; await refresh(); S.sel = inst.id; S.view = 'home'; S.cur = null; S.anim = true; render(); toast(t('created'));
  },
  open: async d => { S.cur = d.id; S.tab = 'overview'; S.td = null; S.anim = true; render(); },
  tab: async d => { S.tab = d.t; render(); await loadTab(); render(); },
  play: d => play(d.id), stop: d => A('inst:kill', d.id),
  saveInst: async d => {
    const f = instForm('i'), g = id => $('#i-' + id).value;
    await A('inst:update', d.id, { name: g('name'), mc: f.ver, loader: f.loader, ram: +g('ram'), javaPath: g('java').trim(), jvmArgs: g('jvm').trim(), res: { w: +g('w') || 0, h: +g('h') || 0 } });
    await refresh(); render(); toast(t('saved'));
  },
  icon: async d => { const r = await A('inst:icon', d.id); if (r) { await refresh(); render(); } },
  openDir: d => A('inst:open', d.id, d.sub),
  repair: async d => { S.run[d.id] = { stage: 'libs', pct: 0 }; renderDock(); try { await A('inst:repair', d.id); toast(t('repaired')); } catch (e) { toast(errMsg(e), 'err'); } delete S.run[d.id]; renderDock(); },
  delInst: async d => { if (!confirm(t('confirmDel'))) return; await A('inst:delete', d.id); S.cur = null; await refresh(); S.anim = true; render(); },
  logs: d => showLogs(d.id),
  toggleF: async d => { await A('inst:toggle', d.id, d.k, d.f); await loadTab(); render(); },
  delF: async d => { if (!confirm(t('confirmDel'))) return; await A('inst:del', d.id, d.k, d.f); await loadTab(); render(); },
  shot: d => modal(`<img src="${esc(d.u)}" style="width:100%;border-radius:12px" alt=""><div style="text-align:center;margin-top:12px"><button class="btn" data-a="closeModal">${t('close')}</button></div>`, 'w'),
  browseFor: d => { S.br.inst = d.id; S.br.type = d.type; S.br.res = null; S.view = 'browse'; S.cur = null; S.anim = true; render(); ACT.brSearch(); },
  brSrc: d => { S.br.src = d.v; S.br.res = null; render(); }, brType: d => { S.br.type = d.v; S.br.res = null; render(); },
  brSearch: async () => {
    const q = $('#br-q'); if (q) S.br.q = q.value; const inst = S.insts.find(i => i.id === S.br.inst);
    S.br.res = []; render(); toast(t('searching'));
    try { S.br.res = await A('content:search', { src: S.br.src, type: S.br.type, q: S.br.q, mc: inst && S.br.type !== 'modpack' ? inst.mc : '', loader: inst && inst.loader.type !== 'vanilla' ? inst.loader.type : '' }); }
    catch (e) { S.br.res = null; toast(errMsg(e), 'err'); } render();
  },
  install: async d => {
    const r = S.br.res[+d.n], b = S.br; if (b.busy) return;
    if (r.type !== 'modpack' && !b.inst) return toast(t('selectInst'), 'err');
    b.busy = true; render(); toast(t('installing') + ' ' + r.title);
    try {
      if (r.type === 'modpack') { const o = await A('inst:modpack', { src: r.src, id: r.id }); await refresh(); toast(t('installed')); if (o.missing && o.missing.length) toast(t('cfMissing') + ' ' + o.missing.length, 'err'); }
      else { await A('inst:install', b.inst, { src: r.src, id: r.id, type: r.type }); toast(t('installed')); }
    } catch (e) { toast(errMsg(e), 'err'); } b.busy = false; render();
  },
  skinAdd: async d => { try { if (await A('skin:add', d.v)) { await refresh(); render(); } } catch (e) { toast(errMsg(e), 'err'); } },
  skinApply: async d => { await A('skin:apply', d.id); toast(t('done')); }, skinDel: async d => { await A('skin:remove', d.id); await refresh(); render(); },
  acctOff: async () => { S.cfg = await A('acct:offline', $('#off-name').value); render(); toast(t('done')); },
  acctSel: async d => { S.cfg = await A('acct:select', d.id); render(); }, acctDel: async d => { S.cfg = await A('acct:remove', d.id); render(); },
  acctMs: () => msLogin(), about: () => modal(aboutHtml()),
  javaList: async () => { const L = await A('java:list'); modal(`<h2 style="margin-top:0">Java</h2>${L.map(j => `<div class="li"><b>Java ${j.major}</b><span class="mu sm">${esc(j.path)}</span></div>`).join('') || `<div class="empty">${t('empty')}</div>`}<div style="text-align:end;margin-top:12px"><button class="btn p" data-a="closeModal">${t('close')}</button></div>`); }
};
const CHG = {
  vfilter: el => { S.vfilter = el.value; const v = $('#c-ver') || $('#i-ver'); if (v) { v.innerHTML = verOptions(el.value, v.value); refreshLoader(v.dataset.pre); } },
  loaderRefresh: el => refreshLoader(el.dataset.pre), ramv: el => { $('#ramv').textContent = el.value; }, cramv: el => { $('#cramv').textContent = el.value; },
  brInst: el => { S.br.inst = el.value; }
};
document.addEventListener('click', async e => {
  if (!e.target.closest('.selwrap')) { const m = $('#selmenu'); if (m) m.classList.remove('open'); }
  const ov = e.target.closest('[data-ov]'); if (ov && e.target === ov) return closeModal();
  const b = e.target.closest('[data-a]'); if (!b || (b.type === 'checkbox' && e.type !== 'click')) return;
  if (b.tagName === 'A') e.preventDefault();
  const f = ACT[b.dataset.a]; if (f) try { await f(b.dataset, b, e); } catch (err) { toast(errMsg(err), 'err'); }
});
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-c]'); if (!el) return; const k = el.dataset.c;
  try {
    if (CHG[k]) return CHG[k](el);
    if (k.startsWith('cfg:')) { const key = k.slice(4); const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; S.cfg = await A('cfg:set', { [key]: v }); if (key === 'lang' || key === 'theme') render(); else applyTheme(); }
  } catch (err) { toast(errMsg(err), 'err'); }
});
document.addEventListener('input', e => { if (e.target.matches('[data-c="ramv"]')) CHG.ramv(e.target); if (e.target.matches('[data-c="cramv"]')) CHG.cramv(e.target); if (e.target.matches('input[type=range][data-c^="cfg:"]')) { const r = $('#ramv'); if (r) r.textContent = e.target.value; } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal').innerHTML) closeModal(); else if (S.page) ACT.cancelCreate(); }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) ACT[e.target.dataset.enter]().catch(err => toast(errMsg(err), 'err'));
});
api.on('progress', d => { if (S.run[d.id] || d.stage === 'modpack') { S.run[d.id] = { ...(S.run[d.id] || {}), stage: d.stage, pct: d.pct, running: d.stage === 'run' ? true : S.run[d.id] && S.run[d.id].running }; if (d.stage === 'done') delete S.run[d.id]; renderDock(); } });
api.on('log', d => { const L = S.logs[d.id] || (S.logs[d.id] = []); L.push(d.text); if (L.length > 500) L.shift(); const b = $('#logbox'); if (b && b.dataset.id === d.id) { b.textContent += d.text; b.scrollTop = b.scrollHeight; } });
api.on('exit', async d => { delete S.run[d.id]; renderDock(); try { S.insts = await A('inst:list'); } catch {} if (d.code && d.code !== 0) toast(`${t('crashed')} (${d.code}) — ${t('logs')}: 📜`, 'err'); if (S.cur === d.id || S.view === 'library') render(); });
api.on('ms-code', c => modal(`<div style="text-align:center"><h2 style="margin-top:0">${t('msLogin')}</h2><p class="mu">${t('msStep')}</p><div style="font-size:38px;letter-spacing:8px;font-weight:800;margin:18px 0;color:var(--ac)">${esc(c.code)}</div><button class="btn" data-a="link" data-u="${esc(c.url)}">${esc(c.url)}</button><p class="mu sm" style="margin-top:14px">${t('msWait')}</p></div>`));
async function loadRemote() {
  try { S.vers = await A('mc:versions'); } catch {} try { S.news = await A('mc:news'); } catch {} S.remote = true;
  if (!S.cur && S.view === 'home' && !S.cfg.first) { S.anim = false; render(); }
}
(async function boot() {
  try { S.cfg = await A('cfg:get'); S.info = await A('app:info'); applyTheme(); render(); await refresh(); render(); loadRemote(); }
  catch (e) { document.body.innerHTML = '<pre style="padding:20px;color:#f66">' + esc(e.message) + '</pre>'; }
})();
