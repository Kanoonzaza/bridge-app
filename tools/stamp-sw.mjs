// Rewrites the CACHE name in sw.js from the content of every cached file. Run via `npm run stamp`.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheName, stampSource, currentCache } from './sw-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = join(root, 'sw.js');
const src = readFileSync(path, 'utf8');
const name = cacheName(root, src);
if (currentCache(src) === name) {
  console.log(`sw.js already stamped: ${name}`);
} else {
  writeFileSync(path, stampSource(src, name));
  console.log(`sw.js CACHE ${currentCache(src)} -> ${name}`);
}
