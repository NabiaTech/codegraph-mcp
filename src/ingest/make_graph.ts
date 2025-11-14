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
const outDir = path.resolve(String(args.output ?? process.env.OUTPUT ?? './data'));
const outJson = path.join(outDir, 'graph.json');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

// Print usage info
if (args.help || args.h) {
  console.error(`
Usage: ingest [options]

Options:
  --target <path>    Codebase to index (default: ./example)
  --output <path>    Output directory for graph.json (default: ./data)
  --help, -h         Show this help message

Environment variables:
  TARGET             Override default target
  OUTPUT             Override default output directory
  PYTHON_BIN         Python interpreter (default: python3)

Examples:
  bun run ingest -- --target ~/nabia/memchain
  bun run ingest -- --target ~/nabia/memchain --output ~/graphs/memchain
  bun run ingest -- --target ./src --output /tmp/graph
  `);
  process.exit(0);
}

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
    let stderrBuf = '';

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
    proc.stderr.on('data', (d) => {
      stderrBuf += d.toString('utf8');
    });
    proc.on('error', (err) => {
      reject(new Error(`Python ingest process error: ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        const errorMsg = stderrBuf.trim() || 'Unknown error';
        return reject(new Error(`Python ingest failed with exit code ${code}\n${errorMsg}`));
      }
      resolve({ symbols, edges, calls });
    });
  });
}

async function main() {
  console.log('[ingest] target:', target);
  fs.mkdirSync(outDir, { recursive: true });

  let tsGraph: Graph = { symbols: [], edges: [] };
  let pyResult: { symbols: SymbolRec[]; edges: EdgeRec[]; calls: { name: string; file: string; modId: string }[] } = { symbols: [], edges: [], calls: [] };

  // --- TypeScript ingestion
  try {
    const tsFiles = listFiles(target, ['.ts', '.tsx']);
    tsGraph = ingestTypeScriptFiles(tsFiles, target);
    console.log(`[ingest] TS files: ${tsFiles.length}, symbols: ${tsGraph.symbols.length}, edges: ${tsGraph.edges.length}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] TypeScript ingestion failed: ${errorMsg}`);
    // Continue with Python ingestion even if TS fails
  }

  // --- Python ingestion
  try {
    pyResult = await ingestPython(target);
    console.log(`[ingest] PY symbols: ${pyResult.symbols.length}, edges: ${pyResult.edges.length}, calls: ${pyResult.calls.length}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] Python ingestion failed: ${errorMsg}`);
    // Continue with merging even if Python fails
  }

  // Merge
  let symbols: SymbolRec[] = [...tsGraph.symbols, ...pyResult.symbols];
  let edges: EdgeRec[] = [...tsGraph.edges, ...pyResult.edges];

  // Name index for naive resolution
  const byName = new Map<string, SymbolRec[]>();
  for (const s of symbols) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s); byName.set(s.name, arr);
  }

  // Resolve Python calls by name
  for (const c of pyResult.calls) {
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
  console.log(`[ingest] Final stats: ${symbols.length} symbols, ${edges.length} edges`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
