import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(scriptDir, 'sw-template.js');
const outPath = path.join(scriptDir, '..', 'public', 'sw.js');
const version = Date.now();

const template = fs.readFileSync(templatePath, 'utf8');
const stamped = template.replace('__BUILD_VERSION__', `ai-journal-${version}`);

fs.writeFileSync(outPath, stamped);
console.log(`[SW] Build version stamped: ${version}`);
