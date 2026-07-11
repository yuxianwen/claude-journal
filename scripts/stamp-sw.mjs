import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(scriptDir, '..', 'public', 'sw.js');
const version = Date.now();

const content = fs.readFileSync(swPath, 'utf8');
const stamped = content.replace(
  /const CACHE = '(?:claude|ai)-journal-[^']+';/,
  `const CACHE = 'ai-journal-${version}';`,
);

fs.writeFileSync(swPath, stamped);
console.log(`[SW] Build version stamped: ${version}`);
