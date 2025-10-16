import fs from 'node:fs';
import path from 'node:path';

export async function readFileText(p: string) {
  return fs.promises.readFile(p, 'utf8');
}

export function listFiles(root: string, exts: string[]): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
        walk(p);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.includes(ext)) results.push(p);
      }
    }
  }
  walk(root);
  return results;
}

export function normalizePath(p: string) {
  return p.split(path.sep).join('/');
}
