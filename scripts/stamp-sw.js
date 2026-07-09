// Stamps the current build timestamp into public/sw.js so the browser detects a new SW on every deploy.
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const version = Date.now();

const content = fs.readFileSync(swPath, 'utf8');
// Replace any existing version (placeholder or previous timestamp)
const stamped = content.replace(/const CACHE = 'claude-journal-[^']+';/, `const CACHE = 'claude-journal-${version}';`);
fs.writeFileSync(swPath, stamped);
console.log(`[SW] Build version stamped: ${version}`);
