const { contextBridge, ipcRenderer } = require('electron');
const INVOKE = new Set(['cfg:get', 'cfg:set', 'inst:list', 'inst:create', 'inst:update', 'inst:delete', 'inst:launch', 'inst:kill', 'inst:repair', 'inst:open', 'inst:icon',
  'inst:files', 'inst:toggle', 'inst:del', 'inst:worlds', 'inst:shots', 'inst:install', 'inst:modpack', 'mc:versions', 'mc:news', 'loader:versions', 'content:search',
  'acct:offline', 'acct:ms', 'acct:select', 'acct:remove', 'skin:list', 'skin:add', 'skin:remove', 'skin:apply', 'java:list', 'shell:open', 'app:info', 'pick:image', 'pick:dir']);
const ON = new Set(['progress', 'log', 'exit', 'ms-code']);
contextBridge.exposeInMainWorld('api', {
  invoke: (c, ...a) => INVOKE.has(c) ? ipcRenderer.invoke(c, ...a) : Promise.reject(new Error('blocked')),
  on: (c, cb) => { if (ON.has(c)) ipcRenderer.on(c, (_e, d) => cb(d)); }
});
