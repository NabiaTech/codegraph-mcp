import fs from 'node:fs';
import path from 'node:path';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

type Range = { startLine: number; startCol: number; endLine: number; endCol: number };
type SymbolKind = 'function'|'class'|'method'|'variable'|'module';
type Language = 'typescript'|'python';
type SymbolRec = {
  id: string; kind: SymbolKind; name: string; file: string; range: Range; language: Language; signature?: string; parentId?: string|null;
};
type EdgeType = 'defines'|'call'|'import'|'member_of';
type EdgeRec = { src: string; type: EdgeType; dst: string };
type Graph = { symbols: SymbolRec[]; edges: EdgeRec[] };

const GRAPH_PATH = process.env.NABI_GRAPH_JSON || path.resolve('./data/graph.json');
const ROOT = process.env.NABI_ROOT || process.cwd();

function loadGraph(): Graph | null {
  try {
    const txt = fs.readFileSync(GRAPH_PATH, 'utf8');
    const g = JSON.parse(txt) as Graph;
    return g;
  } catch (err) {
    console.error(`[code-graph] Failed to load graph from ${GRAPH_PATH}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function buildIndexes(g: Graph) {
  const id2sym = new Map<string, SymbolRec>();
  const name2ids = new Map<string, string[]>();
  const outEdges = new Map<string, EdgeRec[]>();
  const inEdges = new Map<string, EdgeRec[]>();
  for (const s of g.symbols) {
    id2sym.set(s.id, s);
    const arr = name2ids.get(s.name) ?? [];
    arr.push(s.id); name2ids.set(s.name, arr);
  }
  for (const e of g.edges) {
    const a = outEdges.get(e.src) ?? []; a.push(e); outEdges.set(e.src, a);
    const b = inEdges.get(e.dst) ?? []; b.push(e); inEdges.set(e.dst, b);
  }
  return { id2sym, name2ids, outEdges, inEdges };
}

function scoreName(q: string, name: string) {
  const Q = q.toLowerCase(); const N = name.toLowerCase();
  if (Q === N) return 100;
  if (N.startsWith(Q)) return 80;
  if (N.includes(Q)) return 60;
  return 0;
}

let graph = loadGraph();
const idx = graph ? buildIndexes(graph) : null;

const server = new McpServer({ name: 'code-graph', version: '0.1.0' });

// resources: code://file/{path}?s=..&e=..
server.registerResource(
  'code-snippet',
  new ResourceTemplate('code://file/{path}', { list: undefined }),
  { title: 'Source snippet', description: 'Load code ranges by file path relative to project root' },
  async (uri) => {
    try {
      const url = new URL(uri);
      const p = url.pathname;

      // Validate line numbers
      const s = Number(url.searchParams.get('s') || '1');
      const e = Number(url.searchParams.get('e') || (s + 80));
      if (!Number.isFinite(s) || !Number.isFinite(e) || s < 1 || e < 1) {
        return { contents: [{ uri: uri.href, text: 'Error: invalid line numbers' }] };
      }
      if (e > s + 500) {
        return { contents: [{ uri: uri.href, text: 'Error: range too large (max 500 lines)' }] };
      }

      // Prevent directory traversal: resolve and ensure it's within ROOT
      const resolvedPath = path.resolve(ROOT, p);
      const normalizedRoot = path.resolve(ROOT);
      if (!resolvedPath.startsWith(normalizedRoot + path.sep) && resolvedPath !== normalizedRoot) {
        return { contents: [{ uri: uri.href, text: 'Error: access denied (path outside root)' }] };
      }

      let text = '';
      try {
        text = fs.readFileSync(resolvedPath, 'utf8');
      } catch (err) {
        return { contents: [{ uri: uri.href, text: `Error: ${err instanceof Error ? err.message : 'Failed to read file'}` }] };
      }

      const lines = text.split('\n').slice(s - 1, e).join('\n');
      return { contents: [{ uri: uri.href, text: lines }] };
    } catch (err) {
      return { contents: [{ uri: uri, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }] };
    }
  }
);

// tool: resolve_symbol
server.registerTool(
  'graph.resolve_symbol',
  { description: 'Resolve a symbol by fuzzy name', inputSchema: { q: z.string().max(256) } },
  async ({ q }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };
    if (!q.trim()) return { content: [{ type: 'text', text: 'Error: empty query' }] };

    const scored: { id: string; score: number }[] = [];
    for (const s of graph.symbols) {
      const score = scoreName(q, s.name);
      if (score > 0) scored.push({ id: s.id, score });
    }
    scored.sort((a,b) => b.score - a.score);
    const top = scored.slice(0, 20).map(x => idx.id2sym.get(x.id)).filter((x): x is SymbolRec => x !== undefined);
    return { content: [{ type: 'text', text: JSON.stringify(top, null, 2) }] };
  }
);

// tool: references (inbound edges)
server.registerTool(
  'graph.references',
  { description: 'Inbound edges (who calls/imports this symbol)', inputSchema: { id: z.string().min(1) } },
  async ({ id }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };
    const inbound = (idx.inEdges.get(id) || []).filter(e => e.type === 'call' || e.type === 'import');
    const rows = inbound
      .map(e => {
        const src = idx.id2sym.get(e.src);
        const dst = idx.id2sym.get(e.dst);
        return src && dst ? { edge: e, src, dst } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// tool: related (neighbors)
server.registerTool(
  'graph.related',
  { description: 'Nearest neighbors by call/import edges', inputSchema: { id: z.string().min(1), k: z.number().int().min(1).max(100).default(10) } },
  async ({ id, k }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };
    const outs = (idx.outEdges.get(id) || []).filter(e => e.type === 'call' || e.type === 'import');
    const inb  = (idx.inEdges.get(id)  || []).filter(e => e.type === 'call' || e.type === 'import');
    const neigh = [...outs, ...inb]
      .slice(0, k)
      .map(e => {
        const src = idx.id2sym.get(e.src);
        const dst = idx.id2sym.get(e.dst);
        return src && dst ? { edge: e, src, dst } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { content: [{ type: 'text', text: JSON.stringify(neigh, null, 2) }] };
  }
);

// tool: impact_from_diff (parse a unified diff and compute 1-hop impacted neighbors)
server.registerTool(
  'graph.impact_from_diff',
  { description: 'Given a unified diff, compute changed files and 1-hop impacted neighbors', inputSchema: { patch: z.string().max(100000) } },
  async ({ patch }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };

    const changedFiles = new Set<string>();
    for (const line of patch.split('\n')) {
      // Parse unified diff format: diff --git a/file b/file
      const md = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (md) { changedFiles.add(md[1]); changedFiles.add(md[2]); continue; }

      // Also handle +++ and --- headers
      const m1 = line.match(/^\+\+\+ b\/(.+)$/);
      if (m1) { changedFiles.add(m1[1]); continue; }

      const m2 = line.match(/^--- a\/(.+)$/);
      if (m2) { changedFiles.add(m2[1]); continue; }
    }

    // Normalize paths (handle backslashes)
    const changedFileSet = new Set([...changedFiles].map(p => p.replace(/\\/g, '/')));
    if (changedFileSet.size === 0) {
      return { content: [{ type: 'text', text: JSON.stringify({ changedFiles: [], changedSymbols: [], impactedFiles: [] }, null, 2) }] };
    }

    // collect symbols in changed files
    const changedSymbols = graph.symbols.filter(s => changedFileSet.has(s.file));

    // neighbors via one hop
    const impacted = new Set<string>();
    for (const s of changedSymbols) {
      const outs = idx.outEdges.get(s.id) || [];
      const ins  = idx.inEdges.get(s.id) || [];
      for (const e of outs.concat(ins)) {
        if (e.type === 'call' || e.type === 'import') {
          impacted.add(e.src); impacted.add(e.dst);
        }
      }
    }

    // map to files
    const impactedFiles = new Set<string>();
    for (const id of impacted) {
      const sym = idx.id2sym.get(id);
      if (sym) impactedFiles.add(sym.file);
    }

    const payload = {
      changedFiles: [...changedFileSet],
      changedSymbols: changedSymbols.map(s => ({ id: s.id, name: s.name, kind: s.kind, file: s.file })),
      impactedFiles: [...impactedFiles]
    };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  }
);

async function main() {
  if (!graph) {
    console.error(`[code-graph] No graph at ${GRAPH_PATH}. Run: npm run ingest -- --target <dir>`);
  } else {
    console.error(`[code-graph] Loaded graph: ${graph.symbols.length} symbols, ${graph.edges.length} edges`);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
