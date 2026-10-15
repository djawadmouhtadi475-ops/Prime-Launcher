// Electron smoke test: boots the real app, drives the UI and saves screenshots.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
require('../main.js');
const out = n => (process.env.SHOT || '/tmp/pl-shot.png').replace('.png', '-' + n + '.png');
const sleep = ms => new Promise(r => setTimeout(r, ms));
app.whenReady().then(() => setTimeout(async () => {
  const w = BrowserWindow.getAllWindows()[0], js = c => w.webContents.executeJavaScript(c);
  const shot = async n => fs.writeFileSync(out(n), (await w.webContents.capturePage()).toPNG());
  try {
    console.log('SMOKE', JSON.stringify(await js('({title:document.title,welcome:!!document.querySelector(".wel"),api:typeof window.api})')));
    console.log('IPC', await js(`(async()=>{const r=[];r.push((await api.invoke("acct:offline","Steve")).ok);
      r.push((await api.invoke("inst:create",{name:"Survival 1.21",mc:"1.21.1",loader:{type:"vanilla"}})).ok);
      r.push((await api.invoke("inst:create",{name:"Fabric Mods",mc:"1.20.1",loader:{type:"fabric",version:"0.16.9"}})).ok);
      r.push((await api.invoke("cfg:set",{first:false,theme:"dark",accent:"orange"})).ok);
      let bad="allowed";try{await api.invoke("nope")}catch(e){bad="blocked"}return JSON.stringify({r,bad})})()`));
    w.webContents.reload(); await sleep(4500);
    console.log('HOME', await js('!!document.querySelector(".stage")'));
    await shot('home');
    await js(`document.querySelector('[data-a=selToggle]').click()`); await sleep(500); await shot('menu');
    await js(`document.querySelector('.stage .tx').click()`);
    await js(`document.querySelector('[data-a=newInst]') ? document.querySelector('[data-a=newInst]').click() : 0`);
    await js(`(()=>{const b=document.querySelector('.btn.p.play');b&&b.dataset.a==='newInst'&&b.click()})()`);
    await js(`document.querySelector('[data-a=nav][data-v=library]').click()`); await sleep(500);
    await js(`document.querySelector('[data-a=newInst]').click()`); await sleep(900); await shot('create');
    await js(`document.querySelector('[data-a=moreToggle]').click()`); await sleep(400); await shot('create-more');
    await js(`document.querySelector('[data-a=cancelCreate]').click()`);
    await js(`api.invoke("cfg:set",{lang:"en",accent:"blue"})`); w.webContents.reload(); await sleep(4000); await shot('home-en');
  } catch (e) { console.log('SMOKE-ERR', e.message); }
  app.exit(0);
}, 4000));
