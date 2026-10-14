// Electron smoke test: boots the real app, waits for the UI, saves a screenshot and exits.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
require('../main.js');
app.whenReady().then(() => setTimeout(async () => {
  const w = BrowserWindow.getAllWindows()[0];
  try {
    const info = await w.webContents.executeJavaScript('({title:document.title,dir:document.documentElement.dir,theme:document.documentElement.dataset.theme,welcome:!!document.querySelector(".wel"),api:typeof window.api,h1:(document.querySelector("h1")||{}).textContent})');
    console.log('SMOKE', JSON.stringify(info));
    fs.writeFileSync(process.env.SHOT || '/tmp/pl-shot.png', (await w.webContents.capturePage()).toPNG());
    // walk the wizard through the real IPC layer
    const r = await w.webContents.executeJavaScript('(async()=>{const a=await api.invoke("acct:offline","Steve");const v=await api.invoke("inst:list");const c=await api.invoke("cfg:set",{first:false});let bad="allowed";try{await api.invoke("nope")}catch(e){bad="blocked"}return JSON.stringify({a:a.ok,v:v.ok&&v.data.length,c:c.ok&&c.data.first,bad})})()');
    console.log('IPC', r);
    await w.webContents.executeJavaScript('api.invoke("cfg:set",{theme:"dark",accent:"green"})');
    const shot = n => w.webContents.capturePage().then(i => fs.writeFileSync((process.env.SHOT || '/tmp/pl-shot.png').replace('.png', '-' + n + '.png'), i.toPNG()));
    w.webContents.reload(); await new Promise(r => setTimeout(r, 4500));
    console.log('HOME', await w.webContents.executeJavaScript('!!document.querySelector(".shell")'));
    await shot('home');
    for (const v of ['library', 'browse', 'settings']) {
      await w.webContents.executeJavaScript(`document.querySelector('[data-a=nav][data-v=${v}]').click()`); await new Promise(r => setTimeout(r, 700)); await shot(v);
    }
    await w.webContents.executeJavaScript(`document.querySelector('[data-a=about]').click()`); await new Promise(r => setTimeout(r, 500)); await shot('about');
  } catch (e) { console.log('SMOKE-ERR', e.message); }
  app.exit(0);
}, 4000));
