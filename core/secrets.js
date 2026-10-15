// Built-in API keys. core/secrets.json is git-ignored and generated in CI from GitHub Secrets.
const fs = require('fs'), path = require('path');
let s = {};
try { s = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf8')); } catch {}
module.exports = { cfKey: s.cfKey || process.env.CF_API_KEY || '' };
