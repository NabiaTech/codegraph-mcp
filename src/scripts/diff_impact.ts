import fs from 'node:fs';
import path from 'node:path';

const GRAPH_PATH = process.env.NABI_GRAPH_JSON || path.resolve('./data/graph.json');
type Range = { startLine: number; startCol: number; endLine: number; endCol: number };
type SymbolKind = 'function'|'class'|'method'|'variable'|'module';
type Language = 'typescript'|'python';
type SymbolRec = { id: string; kind: SymbolKind; name: string; file: string; range: Range; language: Language; };
type EdgeType = 'defines'|'call'|'import'|'member_of';
type EdgeRec = { src: string; type: EdgeType; dst: string };
type Graph = { symbols: SymbolRec[]; edges: EdgeRec[] };

function loadGraph(): Graph {
  return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
}

function main() {
  const patch = fs.readFileSync(0, 'utf8'); // stdin
  const g = loadGraph();
  const id2sym = new Map(g.symbols.map(s => [s.id, s]));
  const outEdges = new Map<string, EdgeRec[]>();
  const inEdges = new Map<string, EdgeRec[]>();
  for (const e of g.edges) {
    const a = outEdges.get(e.src) ?? []; a.push(e); outEdges.set(e.src, a);
    const b = inEdges.get(e.dst) ?? []; b.push(e); inEdges.set(e.dst, b);
  }
  const changedFiles = new Set<string>();
  for (const line of patch.split('\n')) {
    const m1 = line.match(/^\+\+\+ b\/(.*)$/);
    const m2 = line.match(/^\-\-\- a\/(.*)$/);
    const md = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (m1) changedFiles.add(m1[1]);
    if (m2) changedFiles.add(m2[1]);
    if (md) { changedFiles.add(md[1]); changedFiles.add(md[2]); }
  }
  const changedSymbols = g.symbols.filter(s => changedFiles.has(s.file));
  const impacted = new Set<string>();
  for (const s of changedSymbols) {
    const outs = outEdges.get(s.id) || [];
    const ins  = inEdges.get(s.id) || [];
    for (const e of outs.concat(ins)) {
      if (e.type === 'call' || e.type === 'import') { impacted.add(e.src); impacted.add(e.dst); }
    }
  }
  const impactedFiles = new Set<string>();
  for (const id of impacted) {
    const sym = id2sym.get(id);
    if (sym) impactedFiles.add(sym.file);
  }
  console.log(JSON.stringify({
    changedFiles: [...changedFiles],
    impactedFiles: [...impactedFiles],
    changedSymbols: changedSymbols.map(s => ({ id: s.id, name: s.name, file: s.file }))
  }, null, 2));
}

main();
