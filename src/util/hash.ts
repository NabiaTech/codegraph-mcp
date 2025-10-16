import { createHash } from 'node:crypto';

export function makeId(parts: (string|number|undefined|null)[]) {
  const h = createHash('sha1');
  for (const p of parts) h.update(String(p ?? ''));
  return h.digest('hex').slice(0, 16); // short but stable
}
