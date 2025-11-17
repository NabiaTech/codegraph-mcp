# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**nabi-codegraph-mcp** is a lightweight code graph service with dual deployment modes:

1. **Direct MCP** (stdio): Traditional MCP server for single-session clients
2. **SSE Service** (HTTP): Memory-efficient shared backend for multi-session deployments

The server uses AST parsing (not LSIF/SCIP) to extract symbols, edges, and relationships, storing them in a JSON graph file.

**Key characteristics:**
- **Minimal dependencies**: Uses stdlib AST for Python, TypeScript compiler API for TS
- **Dual deployment**: Choose between direct MCP (simple) or SSE (scalable)
- **Memory-efficient**: SSE service enables 60-80% memory reduction across agent sessions
- **Federation-ready**: Integrated with Loki events, SurrealDB, and nabi-net
- **XDG-compliant**: Portable across macOS/Linux/WSL with consistent paths
- **Extensible architecture**: Data model supports future swaps to SQLite, SCIP, or other backends

---

## Quick Start

### Installation & Build
```bash
# Install dependencies with bun
bun install

# Build for production
bun run build            # Creates ./dist/mcp/server.js

# Run dev server (TypeScript, hot-reload)
bun run dev:server
```

### Ingestion (Index a codebase)
```bash
# Basic usage
bun run ingest -- --target ./example

# Target your own codebase
bun run ingest -- --target /path/to/my/repo

# Result: creates ./data/graph.json with symbols and edges
```

### Testing with Claude (Direct MCP)
1. Add to `~/.config/Claude/claude_desktop_config.json` (or macOS/Windows equivalent)
2. Replace absolute path:
   ```jsonc
   {
     "mcpServers": {
       "code-graph": {
         "command": "bun",
         "args": ["run", "/ABSOLUTE/PATH/TO/dist/mcp/server.js"],
         "environment": {
           "NABI_GRAPH_JSON": "/ABSOLUTE/PATH/TO/data/graph.json"
         }
       }
     }
   }
   ```
3. Restart Claude
4. Try tools: `graph_resolve_symbol`, `graph_related`, `graph_impact_from_diff`

### Deployment: SSE Service (Docker Compose)

For multi-session agent deployments, use the memory-efficient SSE service:

```bash
# Deploy to docker-compose network (alongside memchain)
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml up -d

# Verify
curl http://localhost:8050/health
```

**Benefits**:
- ✅ Single shared backend (~150 MB)
- ✅ Support for 50+ concurrent agent sessions
- ✅ Multi-codebase switching at runtime
- ✅ 60-80% memory reduction vs. per-session MCP
- ✅ Federation integration (Loki events)

**See**: `SSE_DEPLOYMENT.md` for architecture and `SSE_AGENT_INTEGRATION.md` for API details

### Multi-Graph Workflow (Agent-Driven)

The system now supports **dynamic graph management**, allowing agents to index multiple codebases and switch between them:

```bash
# Agent can trigger ingestion directly (no CLI needed)
# - Targets any codebase
# - Automatically registers in graph registry
# - Switches to new graph upon completion

# Agent workflow:
1. graph_ingest(target="/path/to/codebase", id="myproject")
   → Indexes code, registers in ~/.local/state/nabi/codegraph/registry.json
   → Automatically switches to new graph
2. graph_list_available()
   → Shows all indexed graphs with metadata (size, timestamp, target)
3. graph_set_active(id_or_path="myproject")
   → Switches active graph for all subsequent queries
```

---

## Architecture & Design

### Data Model

The entire system revolves around three core concepts:

**Symbol** (represents a code definition)
```typescript
type Symbol = {
  id: string;                              // Unique identifier (hash-based)
  name: string;                            // Function/class/variable name
  kind: 'function'|'class'|'method'|'variable'|'module';
  file: string;                            // Relative path to source
  range: { startLine, startCol, endLine, endCol };
  language: 'typescript'|'python';
  signature?: string;                      // Optional: function signature
  parentId?: string | null;                // Optional: for nested symbols
};
```

**Edge** (represents a relationship)
```typescript
type Edge = {
  src: string;                             // Source symbol ID
  type: 'defines'|'call'|'import'|'member_of';
  dst: string;                             // Destination symbol ID
};
```

**Graph** (the complete index)
```typescript
type Graph = {
  symbols: Symbol[];
  edges: Edge[];                           // All relationships
};
```

### Ingestion Pipeline

**High-level flow** (see `src/ingest/make_graph.ts`):

1. **File Discovery**: `listFiles(target, ['.ts', '.tsx', '.py'])`
2. **TypeScript Ingestion** → `ingestTypeScriptFiles()` using TS compiler API
   - Walks AST for each file
   - Extracts function/class/method/variable definitions
   - Records `import` and `call` edges
   - Creates per-file module symbols as anchors
3. **Python Ingestion** → spawns `py/ingest_py.py` (async subprocess)
   - Uses Python's `ast` module
   - Emits NDJSON (newline-delimited JSON) to stdout
   - Node orchestrator collects and merges
4. **Edge Resolution**: Naive name matching
   - Unresolved call edges matched by symbol name
   - Preference: same-file match > first match globally
5. **Deduplication** & **Serialization** → `./data/graph.json`

**Design rationale:**
- Why subprocesses? Keeps Python and Node isolated, avoids native bindings
- Why naive name matching? Fast bootstrap; can plug in SCIP later for precision
- Why module symbols? Create a stable anchor for file-level imports/organization

### MCP Server (`src/mcp/server.ts`)

Exposes **1 resource** and **7 tools** (4 analysis + 3 management):

#### Resource: Code Snippets
- **URI Pattern**: `code://file/{path}?s={startLine}&e={endLine}`
- **Purpose**: Stream code ranges for context windows
- **Security**: Path traversal validation, line bounds checking (max 500 lines)
- **Usage**: Client can ask AI to "show me lines 10-30 of src/foo.ts"

#### Tools

**1. `graph_resolve_symbol`**
- **Input**: `{ q: string }` — fuzzy query (max 256 chars)
- **Output**: Top 20 symbols matching the query
- **Scoring**: Exact > startsWith > contains
- **Use case**: "Find all functions related to authentication"

**2. `graph_references`**
- **Input**: `{ id: string }` — symbol ID
- **Output**: All inbound edges (who calls/imports this?)
- **Edge types filtered**: `call`, `import` only
- **Use case**: Impact analysis — "what breaks if I remove this function?"

**3. `graph_related`**
- **Input**: `{ id: string, k: number }` — symbol ID, neighbor count (default 10)
- **Output**: Up to k nearest neighbors via call/import edges
- **Combines**: Both outgoing (calls/imports this symbol makes) and incoming (who depends on it)
- **Use case**: Context gathering — "show me related code"

**4. `graph_impact_from_diff`**
- **Input**: `{ patch: string }` — unified diff (max 100KB)
- **Output**: `{ changedFiles, changedSymbols, impactedFiles }`
- **Parsing**: Extracts filenames from `diff --git`, `+++`, `---` headers
- **Impact calculation**: 1-hop neighbors of symbols in changed files
- **Use case**: "What code paths are affected by this PR?"

#### Graph Management Tools

**5. `graph_ingest`** (Agent-driven ingestion)
- **Input**: `{ target: string, id?: string }` — directory to index, optional graph ID
- **Output**: Ingestion stats and registry confirmation
- **Behavior**:
  1. Validates target directory exists
  2. Runs ingest pipeline (TypeScript + Python)
  3. Stores graph in `~/.local/state/nabi/codegraph/graphs/{id}/graph.json`
  4. Registers in registry with metadata (size, timestamp, target)
  5. **Automatically switches** to the new graph
- **Use case**: Agent wants to analyze a different codebase without CLI commands
- **Example**: `graph_ingest(target="~/nabia/memchain", id="memchain")`

**6. `graph_list_available`**
- **Input**: None
- **Output**: Array of registered graphs with metadata
- **Registry location**: `~/.local/state/nabi/codegraph/registry.json`
- **Metadata per graph**: `{ id, path, target, size (symbol count), timestamp }`
- **Use case**: Discover what codebases have been indexed
- **Example output**:
  ```json
  [
    {
      "id": "codegraph-mcp",
      "path": "/Users/tryk/.local/state/nabi/codegraph/graphs/codegraph-mcp/graph.json",
      "target": "/Users/tryk/mcp-servers/codegraph-mcp/src",
      "size": 196,
      "timestamp": "2025-10-27T22:30:15.000Z"
    }
  ]
  ```

**7. `graph_set_active`**
- **Input**: `{ id_or_path: string }` — graph ID from registry OR full path to graph.json
- **Output**: Confirmation of switch with new graph stats
- **Behavior**:
  1. Looks up ID in registry (if not found, assumes it's a path)
  2. Resolves path (handles `~` expansion)
  3. Loads graph and rebuilds indexes in-memory
  4. All subsequent queries use the new graph
- **Use case**: Switch between multiple indexed codebases
- **Example**: `graph_set_active(id_or_path="memchain")` OR `graph_set_active(id_or_path="/tmp/graphs/my-project/graph.json")`

---

## Development Workflow

### Running Tests
No formal test suite exists yet. Manual validation approach:

```bash
# 1. Ingest the example repo
bun run ingest -- --target ./example

# 2. Start dev server
bun run dev:server

# 3. In another terminal, test with curl or MCP client
curl -X POST http://localhost:5000/tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "graph_resolve_symbol", "input": {"q": "greet"}}'
```

### Common Development Tasks

**Inspect the generated graph**
```bash
# Pretty-print the graph structure
cat data/graph.json | jq '.symbols | length'  # Count symbols
cat data/graph.json | jq '.edges | length'    # Count edges
cat data/graph.json | jq '.symbols[0]'        # Examine one symbol
```

**Modify ingestion logic**
- TypeScript: Edit `src/ingest/ingest_ts.ts` (uses TS compiler API)
- Python: Edit `py/ingest_py.py` (uses ast module)
- Common issues:
  - Missing symbol kinds → add to `SymbolKind` type and ingest logic
  - Edge type not captured → add edge creation in appropriate visitor

**Debug symbol resolution**
- Edit `scoreName()` in `src/mcp/server.ts` to adjust fuzzy matching
- Current scoring: exact match (100) > startsWith (80) > contains (60)

**Add new tools**
- Register via `server.registerTool()` in `src/mcp/server.ts`
- Follow pattern: parse input with Zod, check graph/index loaded, return JSON
- Remember: all tools must be JSON-compatible (no streaming data structures)

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NABI_GRAPH_JSON` | Path to graph.json | `./data/graph.json` |
| `NABI_ROOT` | Root for path traversal validation | `process.cwd()` |
| `TARGET` | Ingest target directory | `./example` |
| `PYTHON_BIN` | Python binary to use for ingest | `python3` |

Set these when deploying to non-standard environments.

---

## Key Files & Their Roles

| File | Purpose |
|------|---------|
| `src/ingest/make_graph.ts` | Orchestrator: discovers files, calls TS/Python ingesters, merges, dedupes, writes graph.json |
| `src/ingest/ingest_ts.ts` | TypeScript AST walker using compiler API |
| `src/ingest/types.ts` | Shared TypeScript definitions (Symbol, Edge, Graph types) |
| `src/mcp/server.ts` | MCP server: loads graph, exposes resource + 4 tools |
| `src/util/fs.ts` | File utilities: listFiles, normalizePath |
| `src/util/hash.ts` | ID generation: hash-based symbol IDs for stability |
| `py/ingest_py.py` | Python AST walker, emits NDJSON |
| `data/graph.json` | Generated: the indexed code graph (created by ingest, consumed by server) |
| `example/` | Sample repository for testing ingestion |

---

## Important Design Decisions

### 1. Hash-based Symbol IDs
**Decision**: Symbol IDs are deterministic hashes of (file + name + kind)

**Why**: Ensures same symbol always gets same ID across re-ingestions
**Implication**: Renaming a symbol changes its ID; tools must use name resolution first
**See**: `src/util/hash.ts`

### 2. Naive Edge Resolution
**Decision**: Unresolved calls matched by symbol name only

**Why**: Bootstrap speed; no need for full type inference
**Limitation**: Name collisions (two `greet` functions) → all get linked
**Future**: Replace with SCIP for precision

### 3. Subprocess-based Python Ingestion
**Decision**: Python ingest runs in separate process, emits NDJSON to stdout

**Why**: Avoids native bindings (Node.js FFI issues); language agnostic
**Implication**: NDJSON parsing is critical; stdout must stay JSON-clean
**See**: `src/ingest/make_graph.ts` lines 25-56

### 4. In-Memory Graph
**Decision**: Entire graph loaded into memory for MCP operations

**Why**: Fast lookups; server stays responsive
**Limitation**: Not suitable for graphs >10M symbols (future: SQLite)
**Optimization**: Indexes built at startup: id→symbol, name→ids, edges in/out

### 5. No Incremental Updates
**Decision**: Graph is rebuilt completely on each ingest

**Why**: Simplicity; no delta tracking, no state conflicts
**Trade-off**: ~1-5s ingest time for typical repos
**Future**: Support incremental if needed

---

## Extending the System

### Adding a New Language (e.g., Go, Rust)

1. **Create ingest module** (e.g., `src/ingest/ingest_go.ts`)
2. **Implement parser** (use language-specific AST library)
3. **Extract symbols & edges** following the SymbolRec/EdgeRec types
4. **Integrate into orchestrator** (`make_graph.ts`):
   ```typescript
   const goFiles = listFiles(target, ['.go']);
   const goGraph = ingestGoFiles(goFiles, target);
   symbols.push(...goGraph.symbols);
   edges.push(...goGraph.edges);
   ```
5. **Test** with a small example directory

### Adding a New Edge Type (e.g., `extends`, `implements`)

1. **Update EdgeType** in `src/ingest/types.ts`
2. **Record edges** during ingestion in appropriate visitor
3. **Update MCP tools** if new edge type should affect results
   - Example: `graph.references()` might want to include `extends` edges

### Swapping Backend Storage (JSON → SQLite)

1. **Create schema** (tables: symbols, edges)
2. **Modify graph loading** in `src/mcp/server.ts`
3. **Rebuild indexes** from SQLite instead of in-memory
4. **Update ingest output** to write to DB instead of JSON
5. **Minimal change to tools** (they use the indexes, not the storage layer)

---

## Known Limitations & Future Directions

### Current Limitations

1. **No type information**: Calls matched by name only; no type inference
2. ~~**No cross-repo support**: Single graph per server instance~~ → **FIXED**: Now supports dynamic graph switching via registry
3. **No semantic search**: Only fuzzy name matching
4. **No incremental updates**: Full re-ingest required
5. **Limited edge types**: Only `call`, `import`, `defines`, `member_of`

### Roadmap

**Recently Completed:**
- [x] **Multi-graph support**: Three new MCP tools enable dynamic graph switching
  - `graph_ingest`: Agent-driven ingestion (no CLI needed)
  - `graph_list_available`: Discover indexed graphs
  - `graph_set_active`: Switch between graphs at runtime

**Future Enhancements:**
- [ ] **SCIP integration**: Plug in scip-ts / scip-python for precise edges
- [ ] **SQLite backend**: Support larger graphs with proper indexing
- [ ] **Structural rewrites**: Add `graph_codemods` tool for batch transformations
- [ ] **Semantic search**: Integrate embeddings for "find similar code"
- [ ] **Cross-repo linking**: Support edges between multiple repositories
- [ ] **Incremental updates**: Cache symbols/edges, update only changed files
- [ ] **Type-aware resolution**: Integrate SCIP for precise call/import edges

---

## Performance & Scaling

### Ingestion Time
- **Typical repo** (10-50 TS/Py files): ~1-2 seconds
- **Large repo** (1000+ files): ~5-30 seconds
- **Bottleneck**: Python subprocess communication (NDJSON parsing)

### Server Response Time
- **resolve_symbol**: O(symbols) fuzzy search, ~10ms for typical graphs
- **references / related**: O(edges) index lookup, <1ms
- **impact_from_diff**: O(changed files × neighbors), ~100ms for typical diffs

### Memory Usage
- **Typical 50-file repo**: ~2-5MB (JSON + indexes)
- **Large 1000-file repo**: ~50-100MB
- **Index overhead**: ~2x base JSON size (id→sym, name→ids, edge maps)

**Scaling strategy**: When graph exceeds available memory, migrate to SQLite with streaming results.

---

## Relationship to Larger Federation

This MCP server is part of the **nabi federation** ecosystem:

- **Layer 1 (Perception)**: riff-cli extracts patterns from conversation history
- **Layer 2 (Memory)**: nabi-mcp knowledge graph stores entities
- **Layer 3 (Code Intelligence)**: **codegraph-mcp** (this project) provides code structure queries
- **Layer 4 (Orchestration)**: Agents coordinate via federation bus (Loki)
- **Layer 5 (Visualization)**: dag-tui renders the collective knowledge

**Integration points:**
- codegraph MCP could feed into nabi-mcp as entities (if needed)
- Agents query codegraph to understand code context for tasks
- Impact analysis helps coordinate multi-agent changes

---

## Testing the Visualization Connection

The `PARALLEL_WORKSTREAMS_SYNTHESIS.md` document outlines an ambitious vision for visualizing code graphs in a TUI. Key integration points:

1. **dag-tui needs a data loader** that queries this MCP server
2. **Intelligence scoring** could use code metrics (symbol count, depth, complexity)
3. **Visual encoding** could map symbol kinds to shapes, edge types to line styles

Future Claude sessions should consider how codegraph queries feed into that pipeline.

---

## Graph Registry System

**Location**: `~/.local/state/nabi/codegraph/registry.json`

The registry maintains a persistent list of indexed graphs with metadata:

```json
{
  "graphs": [
    {
      "id": "memchain",
      "path": "/Users/tryk/.local/state/nabi/codegraph/graphs/memchain/graph.json",
      "target": "/Users/tryk/nabia/memchain",
      "size": 70079,
      "timestamp": "2025-10-27T22:45:30.000Z"
    },
    {
      "id": "codegraph-mcp",
      "path": "/Users/tryk/.local/state/nabi/codegraph/graphs/codegraph-mcp/graph.json",
      "target": "/Users/tryk/mcp-servers/codegraph-mcp/src",
      "size": 196,
      "timestamp": "2025-10-27T22:30:15.000Z"
    }
  ]
}
```

**Key behaviors:**
- Registry is automatically created/updated by `graph_ingest`
- `graph_list_available` reads from registry to show available graphs
- `graph_set_active` can reference graphs by ID or direct path
- Each ingestion stores the graph in a dedicated subdirectory

---

## Summary for Future Sessions

**This is a working, pragmatic code graph MCP server.** Use it to:

1. **Index code** with agent-driven `graph_ingest` (no CLI needed)
2. **Discover graphs** with `graph_list_available` (show all indexed codebases)
3. **Switch contexts** with `graph_set_active` (analyze different projects)
4. **Analyze changes** with `graph_impact_from_diff`
5. **Explore codebase** with `graph_resolve_symbol`, `graph_references`, `graph_related`
6. **Build on top** with additional tools or backends

**The design is intentionally minimal to maximize flexibility.** Extensions (SCIP, SQLite, semantic search) should follow the pattern: add logic without breaking the core symbol/edge/graph abstraction.

When making changes, preserve the MCP protocol invariants (JSON-only output, deterministic IDs, efficient indexing).
