import path from 'node:path';
import fs from 'node:fs';
import minimist from 'minimist';
import { ingestTypeScriptFiles } from './ingest_ts.js';
import { listFiles, normalizePath } from '../util/fs.js';
import { makeId } from '../util/hash.js';
import type { EdgeRec, Graph, SymbolRec } from './types.js';
import { spawn } from 'node:child_process';

const args = minimist(process.argv.slice(2));
const target = path.resolve(String(args.target ?? process.env.TARGET ?? './example'));
const outDir = path.resolve('./data');
const outJson = path.join(outDir, 'graph.json');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

function uniq<T>(arr: T[], key: (t: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()];
}

async function ingestPython(root: string): Promise<{ symbols: SymbolRec[]; edges: EdgeRec[]; calls: { name: string; file: string; modId: string }[]; }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [path.resolve('./py/ingest_py.py'), root], { stdio: ['ignore', 'pipe', 'pipe'] });
    const symbols: SymbolRec[] = [];
    const edges: EdgeRec[] = [];
    const calls: { name: string; file: string; modId: string }[] = [];
    const nameIndexPerFile = new Map<string, Record<string, any[]>>();

    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line);
          if (rec.type === 'symbol') symbols.push(rec.symbol);
          else if (rec.type === 'edge') edges.push(rec.edge);
          else if (rec.type === 'call') calls.push({ name: rec.calleeName, file: rec.file, modId: rec.modId });
          else if (rec.type === 'name_index') nameIndexPerFile.set(rec.file, rec.index);
        } catch {}
      }
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('python ingest failed with code ' + code));
      }
      resolve({ symbols, edges, calls });
    });
  });
}

async function main() {
  console.log('[ingest] target:', target);
  fs.mkdirSync(outDir, { recursive: true });

  // --- TypeScript ingestion
  const tsFiles = listFiles(target, ['.ts', '.tsx']);
  const tsGraph = ingestTypeScriptFiles(tsFiles, target);
  console.log(`[ingest] TS files: ${tsFiles.length}, symbols: ${tsGraph.symbols.length}, edges: ${tsGraph.edges.length}`);

  // --- Python ingestion
  const py = await ingestPython(target);
  console.log(`[ingest] PY symbols: ${py.symbols.length}, edges: ${py.edges.length}, calls: ${py.calls.length}`);

  // Merge
  let symbols: SymbolRec[] = [...tsGraph.symbols, ...py.symbols];
  let edges: EdgeRec[] = [...tsGraph.edges, ...py.edges];

  // Name index for naive resolution
  const byName = new Map<string, SymbolRec[]>();
  for (const s of symbols) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s); byName.set(s.name, arr);
  }

  // Resolve Python calls by name
  for (const c of py.calls) {
    const arr = byName.get(c.name);
    if (arr && arr.length) {
      const sameFile = arr.find(x => x.file === c.file);
      const dst = (sameFile ?? arr[0]).id;
      edges.push({ src: c.modId, type: 'call', dst });
    }
  }

  // Dedup
  symbols = uniq(symbols, s => s.id);
  edges = uniq(edges, e => `${e.src}|${e.type}|${e.dst}`);

  const graph: Graph = { symbols, edges };
  fs.writeFileSync(outJson, JSON.stringify(graph, null, 2), 'utf8');
  console.log('[ingest] wrote', outJson);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
