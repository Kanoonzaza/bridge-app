// Hash logic shared by `npm run stamp` and the service-worker test.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BINARY = /\.(png|jpe?g|gif|webp|ico)$/i;

export function listedFiles(swSource) {
  const m = swSource.match(/const FILES = \[([\s\S]*?)\];/);
  if (!m) throw new Error('sw.js: could not find the FILES list');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

// sha256 over every listed file's contents (except './'), CRLF normalised to LF for text files; first 8 hex chars.
export function hashFiles(root, files) {
  const h = createHash('sha256');
  for (const f of files) {
    if (f === './') continue;
    let buf = readFileSync(join(root, f));
    if (!BINARY.test(f)) buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(buf);
  }
  return h.digest('hex').slice(0, 8);
}

export const cacheName = (root, swSource) => `bc-${hashFiles(root, listedFiles(swSource))}`;

export const currentCache = (swSource) => swSource.match(/^const CACHE = '([^']*)';/m)?.[1];

export const stampSource = (swSource, name) => swSource.replace(/^const CACHE = '[^']*';/m, `const CACHE = '${name}';`);
