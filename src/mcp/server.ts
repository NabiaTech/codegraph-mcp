import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { StreamAnalyzer, type WorkStream, type StreamContext } from './stream_analyzer.js';

type Range = { startLine: number; startCol: number; endLine: number; endCol: number };
type SymbolKind = 'function'|'class'|'method'|'variable'|'module';
type Language = 'typescript'|'python';
type SymbolRec = {
  id: string; kind: SymbolKind; name: string; file: string; range: Range; language: Language; signature?: string; parentId?: string|null;
};
type EdgeType = 'defines'|'call'|'import'|'member_of';
type EdgeRec = { src: string; type: EdgeType; dst: string };
type Graph = { symbols: SymbolRec[]; edges: EdgeRec[] };
type GraphRegistry = { graphs: Array<{ id: string; path: string; target: string; size: number; timestamp: string }> };

const GRAPH_PATH = process.env.NABI_GRAPH_JSON || path.resolve('./data/graph.json');
const ROOT = process.env.NABI_ROOT || process.cwd();
const REGISTRY_DIR = path.resolve(process.env.HOME || '~', '.local/state/nabi/codegraph');

function ensureRegistryDir() {
  try {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  } catch {
    // Ignore if already exists
  }
}

function loadRegistry(): GraphRegistry {
  ensureRegistryDir();
  const regPath = path.join(REGISTRY_DIR, 'registry.json');
  try {
    const txt = fs.readFileSync(regPath, 'utf8');
    return JSON.parse(txt) as GraphRegistry;
  } catch {
    return { graphs: [] };
  }
}

function saveRegistry(reg: GraphRegistry) {
  ensureRegistryDir();
  const regPath = path.join(REGISTRY_DIR, 'registry.json');
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2), 'utf8');
}

function loadGraph(graphPath: string = GRAPH_PATH): Graph | null {
  try {
    const txt = fs.readFileSync(graphPath, 'utf8');
    const g = JSON.parse(txt) as Graph;
    return g;
  } catch (err) {
    console.error(`[code-graph] Failed to load graph from ${graphPath}:`, err instanceof Error ? err.message : String(err));
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
let idx = graph ? buildIndexes(graph) : null;

// Function to dynamically reload a graph
function setActiveGraph(graphPath: string): string {
  const newGraph = loadGraph(graphPath);
  if (!newGraph) {
    return `Failed to load graph from ${graphPath}`;
  }
  graph = newGraph;
  idx = buildIndexes(newGraph);
  console.error(`[code-graph] Switched to graph: ${graphPath} (${newGraph.symbols.length} symbols)`);
  return `Switched to graph: ${graphPath} (${newGraph.symbols.length} symbols, ${newGraph.edges.length} edges)`;
}

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
      return { contents: [{ uri: uri.href, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }] };
    }
  }
);

// tool: resolve_symbol
server.registerTool(
  'graph_resolve_symbol',
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
    const currentIdx = idx; // Capture for closure
    const top = scored.slice(0, 20).map(x => currentIdx.id2sym.get(x.id)).filter((x): x is SymbolRec => x !== undefined);
    return { content: [{ type: 'text', text: JSON.stringify(top, null, 2) }] };
  }
);

// tool: references (inbound edges)
server.registerTool(
  'graph_references',
  { description: 'Inbound edges (who calls/imports this symbol)', inputSchema: { id: z.string().min(1) } },
  async ({ id }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };
    const currentIdx = idx; // Capture for closure
    const inbound = (currentIdx.inEdges.get(id) || []).filter(e => e.type === 'call' || e.type === 'import');
    const rows = inbound
      .map(e => {
        const src = currentIdx.id2sym.get(e.src);
        const dst = currentIdx.id2sym.get(e.dst);
        return src && dst ? { edge: e, src, dst } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// tool: related (neighbors)
server.registerTool(
  'graph_related',
  { description: 'Nearest neighbors by call/import edges', inputSchema: { id: z.string().min(1), k: z.number().int().min(1).max(100).default(10) } },
  async ({ id, k }) => {
    if (!graph || !idx) return { content: [{ type: 'text', text: 'No graph loaded. Run: npm run ingest' }] };
    const currentIdx = idx; // Capture for closure
    const outs = (currentIdx.outEdges.get(id) || []).filter(e => e.type === 'call' || e.type === 'import');
    const inb  = (currentIdx.inEdges.get(id)  || []).filter(e => e.type === 'call' || e.type === 'import');
    const neigh = [...outs, ...inb]
      .slice(0, k)
      .map(e => {
        const src = currentIdx.id2sym.get(e.src);
        const dst = currentIdx.id2sym.get(e.dst);
        return src && dst ? { edge: e, src, dst } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { content: [{ type: 'text', text: JSON.stringify(neigh, null, 2) }] };
  }
);

// tool: impact_from_diff (parse a unified diff and compute 1-hop impacted neighbors)
server.registerTool(
  'graph_impact_from_diff',
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
    const currentIdx = idx; // Capture for closure
    const impacted = new Set<string>();
    for (const s of changedSymbols) {
      const outs = currentIdx.outEdges.get(s.id) || [];
      const ins  = currentIdx.inEdges.get(s.id) || [];
      for (const e of outs.concat(ins)) {
        if (e.type === 'call' || e.type === 'import') {
          impacted.add(e.src); impacted.add(e.dst);
        }
      }
    }

    // map to files
    const impactedFiles = new Set<string>();
    for (const id of impacted) {
      const sym = currentIdx.id2sym.get(id);
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

// tool: analyze_parallel_streams
server.registerTool(
  'analyze_parallel_streams',
  {
    description: 'Analyze and visualize parallel development workstreams',
    inputSchema: {
      streams: z.array(z.object({
        name: z.string(),
        status: z.enum(['complete', 'in-progress', 'planned', 'blocked']),
        summary: z.string().optional(),
        deliverables: z.array(z.string()).optional(),
        location: z.string().optional(),
        completion: z.number().min(0).max(100).optional(),
        next_steps: z.array(z.string()).optional(),
        blockers: z.array(z.string()).optional(),
      })),
      context: z.object({
        date: z.string().optional(),
        theme: z.string().optional(),
        goal: z.string().optional(),
      }).optional(),
    }
  },
  async ({ streams, context }) => {
    try {
      const result = StreamAnalyzer.analyze(streams as WorkStream[], context as StreamContext | undefined);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${err instanceof Error ? err.message : 'Analysis failed'}`
        }]
      };
    }
  }
);

// tool: list_available (discover indexed graphs)
server.registerTool(
  'graph_list_available',
  { description: 'List all available indexed graphs in the registry', inputSchema: {} },
  async () => {
    const reg = loadRegistry();
    if (reg.graphs.length === 0) {
      return { content: [{ type: 'text', text: 'No indexed graphs available. Use graph_ingest to create one.' }] };
    }
    const rows = reg.graphs.map(g => ({
      id: g.id,
      path: g.path,
      target: g.target,
      size: g.size,
      timestamp: g.timestamp
    }));
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// tool: set_active (switch to a different graph)
server.registerTool(
  'graph_set_active',
  { description: 'Set active graph by ID or path', inputSchema: { id_or_path: z.string().min(1).max(500) } },
  async ({ id_or_path }) => {
    const reg = loadRegistry();
    let graphPath = '';

    // Check if it's an ID in the registry
    const found = reg.graphs.find(g => g.id === id_or_path);
    if (found) {
      graphPath = found.path;
    } else {
      // Assume it's a direct path
      graphPath = id_or_path;
    }

    // Normalize the path
    graphPath = path.resolve(graphPath.replace(/^~/, process.env.HOME || '/root'));

    const result = setActiveGraph(graphPath);
    if (result.includes('Failed')) {
      return { content: [{ type: 'text', text: result }] };
    }
    return { content: [{ type: 'text', text: result }] };
  }
);

// tool: ingest (trigger ingestion from within agent)
server.registerTool(
  'graph_ingest',
  { description: 'Trigger code ingestion for a target directory and register the graph', inputSchema: { target: z.string().min(1).max(500), id: z.string().min(1).max(64).optional() } },
  async ({ target, id }) => {
    try {
      const targetPath = path.resolve(target.replace(/^~/, process.env.HOME || '/root'));

      // Validate target exists
      if (!fs.existsSync(targetPath)) {
        return { content: [{ type: 'text', text: `Error: target directory does not exist: ${targetPath}` }] };
      }

      // Generate ID if not provided
      const graphId = id || path.basename(targetPath);

      // Create output directory
      const outputDir = path.join(REGISTRY_DIR, 'graphs', graphId);
      fs.mkdirSync(outputDir, { recursive: true });

      // Spawn ingestion via bun (assumes codegraph-mcp is available)
      const ingestPath = path.resolve(__dirname, '../ingest/make_graph.js');
      const cmd = `bun run "${ingestPath}" --target "${targetPath}" --output "${outputDir}" 2>&1`;

      console.error(`[code-graph] Running ingest: ${cmd}`);
      let output = '';
      try {
        output = execSync(cmd, { encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (execErr: any) {
        // Capture stdout and stderr from the failed process
        const stdout = execErr.stdout ? execErr.stdout.toString('utf8') : '';
        const stderr = execErr.stderr ? execErr.stderr.toString('utf8') : '';
        const fullOutput = stdout + stderr;
        return { content: [{ type: 'text', text: `Ingestion failed!\n\nCommand: ${cmd}\n\nOutput:\n${fullOutput}\n\nError: ${execErr.message}` }] };
      }

      // Load the generated graph to get stats
      const graphFile = path.join(outputDir, 'graph.json');
      const newGraph = loadGraph(graphFile);
      if (!newGraph) {
        return { content: [{ type: 'text', text: `Ingestion completed but failed to load result graph` }] };
      }

      // Register in the registry
      const reg = loadRegistry();
      const existing = reg.graphs.findIndex(g => g.id === graphId);
      const entry = {
        id: graphId,
        path: graphFile,
        target: targetPath,
        size: newGraph.symbols.length,
        timestamp: new Date().toISOString()
      };

      if (existing >= 0) {
        reg.graphs[existing] = entry;
      } else {
        reg.graphs.push(entry);
      }
      saveRegistry(reg);

      // Automatically switch to the new graph
      const switchResult = setActiveGraph(graphFile);

      return { content: [{ type: 'text', text: `Ingestion completed!\n\n${output}\n\nStats: ${newGraph.symbols.length} symbols, ${newGraph.edges.length} edges\n\nRegistry: ${switchResult}` }] };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Ingestion failed: ${errorMsg}` }] };
    }
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
