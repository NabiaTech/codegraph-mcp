# nabi-codegraph-mcp — Code Graph MCP Server

A lightweight code graph service with MCP (Model Context Protocol) interface for analyzing codebases and understanding dependencies.

## 🎯 Overview

This MCP server provides programmatic access to code analysis capabilities, allowing agents and tools to:

- **Index codebases** into persistent graphs stored in NABI state
- **Search symbols** across multiple programming languages
- **Analyze dependencies** and relationships between code elements
- **Assess change impact** from diffs and patches

## 🏗️ Architecture

### Data Storage
- **Graphs stored in**: `~/.local/state/nabi/codegraph/graphs/{id}/graph.json`
- **Registry**: `~/.local/state/nabi/codegraph/registry.json`
- **XDG compliant**: Follows NABI state directory conventions

### Supported Languages
- **Python** (primary focus for NABI kernel)
- **TypeScript** (for tooling and web components)
- **Future**: Rust, Go, and other languages

### MCP Tools
- **`graph.resolve_symbol({ q })`** → fuzzy lookup of symbols by name
- **`graph.references({ id })`** → inbound edges (who calls/imports this symbol)
- **`graph.related({ id, k })`** → k neighbors (imports/calls)
- **`graph.impact_from_diff({ patch })`** → changed files + 1-hop neighbor impact set
- **`analyze_parallel_streams({ streams, context })`** → analyze parallel workstreams and generate visual synthesis
- **`graph_ingest({ target, id })`** → index a codebase and register the graph
- **`graph_list_available()`** → list all available indexed graphs
- **`graph_set_active({ id_or_path })`** → switch to a different graph
- **Resource**: `code://file/{path}?s=..&e=..` → stream code snippets for context windows

## 🛠️ MCP Tools

### Graph Management
- **`graph_ingest`** - Index a codebase and register the graph
  - Input: `target` (directory path), optional `id`
  - Creates persistent graph in NABI state directory
  - Automatically switches to new graph

- **`graph_list_available`** - List all available indexed graphs
  - Returns registry of all indexed codebases with metadata

- **`graph_set_active`** - Switch to a different graph
  - Input: `id_or_path` (graph ID or path)
  - Switches active graph for all subsequent queries

### Code Analysis
- **`graph_resolve_symbol`** - Fuzzy search for symbols
  - Input: `q` (search query)
  - Returns matching symbols with file locations and ranges

- **`graph_references`** - Find inbound references to a symbol
  - Input: `id` (symbol ID)
  - Shows what calls/imports the given symbol

- **`graph_related`** - Find related symbols (neighbors)
  - Input: `id` (symbol ID), `k` (neighbor count, default 10)
  - Returns symbols that call or are called by the target

- **`graph_impact_from_diff`** - Analyze change impact
  - Input: `patch` (unified diff)
  - Returns changed files, symbols, and impacted dependencies

### Advanced Analysis
- **`analyze_parallel_streams`** - Analyze parallel workstreams
  - Input: `streams`, `context`
  - Generates visual synthesis of parallel development activities

## 🚀 Usage

### Configuration
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "bun",
      "args": ["/path/to/nabia/platform/codegraph-mcp/dist/mcp/server.js"],
      "env": {
        "NABI_GRAPH_JSON": "/Users/{user}/.local/state/nabi/codegraph/graphs/core/graph.json"
      }
    }
  }
}
```

### Workflow
1. **Index a codebase**: `graph_ingest(target="/path/to/code")`
2. **Search for symbols**: `graph_resolve_symbol(q="AgentType")`
3. **Analyze relationships**: `graph_references(id="symbol_id")`
4. **Check impact**: `graph_impact_from_diff(patch="...")`

## 🔄 Integration with NABI CLI

This MCP server mirrors the functionality of `nabi repo` commands:

| NABI CLI | MCP Tool | Purpose |
|----------|----------|---------|
| `repo analyze <path>` | `graph_ingest` | Index codebase |
| `repo graph search <symbol>` | `graph_resolve_symbol` | Find symbols |
| `repo graph references <symbol>` | `graph_references` | Find references |
| `repo graph related <symbol>` | `graph_related` | Find related symbols |

## 📊 Data Model

### Symbol
```typescript
{
  id: string;           // Unique identifier
  kind: "class" | "function" | "method" | "variable" | "module";
  name: string;         // Symbol name
  file: string;         // Relative file path
  range: {              // Source location
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  language: "python" | "typescript";
}
```

### Edge (Relationship)
```typescript
{
  src: string;          // Source symbol ID
  type: "defines" | "call" | "import" | "member_of";
  dst: string;          // Destination symbol ID
}
```

## 🧪 Development

### Prerequisites
- **Node.js 20+**
- **Python 3.10+** (for Python code analysis)
- **Bun** (for running/building)

### Setup
```bash
bun install
bun run build
```

### Testing
```bash
# Start dev server
bun run dev:server

# Test ingestion
bun run ingest -- --target ./example
```

## 🔒 Security & Performance

### Security
- **Path validation**: Prevents directory traversal attacks
- **File access**: Only reads source files, no execution
- **Resource limits**: Line range limits, reasonable timeouts

### Performance
- **Memory efficient**: Loads graphs into memory for fast queries
- **Incremental**: Registry system supports multiple codebases
- **Streaming**: Large results can be streamed via MCP

## 🤝 Contributing

### Adding Language Support
1. Create analysis module in `src/ingest/`
2. Implement AST walker for the language
3. Extract symbols and edges following the data model
4. Update ingestion orchestrator

### Adding Analysis Tools
1. Register new tool in `src/mcp/server.ts`
2. Follow MCP tool schema with Zod validation
3. Access loaded graph and indexes
4. Return JSON-compatible results

## 📋 Roadmap

- [ ] Multi-language support (Rust, Go)
- [ ] Cross-repository analysis
- [ ] Semantic search with embeddings
- [ ] Graph visualization integration
- [ ] Incremental updates
- [ ] SQLite backend for large graphs

---

**Built for NABI**: This MCP server is designed specifically for the NABI ecosystem, providing agents with deep code understanding capabilities for kernel development and orchestration tasks.
