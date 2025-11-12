# Codegraph-MCP Infrastructure Architecture Analysis

**Date**: 2025-10-27  
**Status**: Comprehensive Analysis - Actionable Integration Design  
**Scope**: Infrastructure patterns for centralized code graph service  
**Audience**: Architecture reviewers, implementation stakeholders

---

## Executive Summary

Your infrastructure is **designed for exactly this problem**: shared, persistent, multi-session services accessed by ephemeral agents. The codegraph-mcp service should follow established patterns already proven in your federation:

1. **SSE Transport Layer** (like memchain-sse) for multi-session access
2. **Mounted volumes** (like SurrealDB) for persistent graph state
3. **Event emission** to Loki for coordination visibility
4. **Port allocation** in federation registry (port 8050 suggested)
5. **XDG-compliant state** in `~/.local/state/nabi/codegraph/`

**Key Insight**: Your architecture already solved the "shared service" problem via memchain-sse. Codegraph should reuse this pattern rather than reinventing it.

---

## Part 1: Current Infrastructure Architecture Overview

### 1.1 Three-Tier Runtime State Organization

Your system separates configuration, runtime state, and derived data according to XDG Base Directory Specification:

```
~/.config/nabi/              [SOURCE OF TRUTH - User-editable schemas]
├── agents/                  Agent definitions (TOML schemas)
├── auras/                   Personality/theme schemas  
├── hooks/                   Hook configurations
├── governance/              Federation rules
└── tools/                   Tool definitions

~/.local/state/nabi/         [DERIVED STATE - Generated from schemas]
├── agents/                  Agent runtime state (JSON)
├── codegraph/               Code graph caches (target for codegraph)
├── hooks/                   Hook runtime state
├── tools/                   Tool runtime state
├── venvs/                   Python virtual environments
└── memory-backups/          Knowledge layer snapshots

~/.cache/nabi/               [EPHEMERAL - Regenerable]
├── derived_configs/         Computed configurations
└── build_artifacts/         Compilation outputs

~/Sync/ (Syncthing-synced)   [PERSISTENT FEDERATION STATE]
├── docs/                    Documentation (git-managed)
├── memory/                  Knowledge layer (memory.json - 150+ entities)
└── scripts/                 Federation tools
```

**Critical Pattern**: XDG compliance is MANDATORY. All hardcoded `/Users/tryk/` paths are explicitly forbidden.

### 1.2 Federation Service Architecture

Your federation runs **persistent shared services** accessed by ephemeral agents:

```
┌─────────────────────────────────────────────────────────┐
│          Federation Service Stack (Persistent)          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Port 3100: Loki (Event Bus)                           │
│  │  └─ Coordination layer for all agents               │
│  │     Stores federation events (agent spawn, task     │
│  │     completion, knowledge updates)                  │
│                                                         │
│  Port 8001: memchain-sse (Multi-session MCP transport) │
│  │  └─ Allows 50+ concurrent Claude sessions          │
│  │     to share coordination state                     │
│  │     Pattern: FastAPI + Uvicorn + shared backend    │
│                                                         │
│  Port 8284: SurrealDB (Knowledge Graph + L2 Memory)   │
│  │  └─ Three-tier memory backend:                     │
│  │     • L1 (ephemeral): memchain                     │
│  │     • L2 (task-scoped): SurrealDB memory.nabi      │
│  │     • L3 (persistent): Anytype                     │
│                                                         │
│  Port 5380: NABIKernel (Coordination Server)           │
│  │  └─ Agent spawn requests, task queuing,            │
│  │     federation registry management                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ↑
        ┌───────────────┼───────────────┐
        │               │               │
    Agent 1          Agent 2          Agent 3
   (ephemeral)    (ephemeral)     (ephemeral)
   (session-       (session-       (session-
    scoped)        scoped)         scoped)
```

**Key Characteristics**:
- **Service Longevity**: Services run continuously (hours to months)
- **Session Isolation**: Each Claude session gets unique agent ID
- **Shared State**: Multiple agents access same backend
- **Event Coordination**: Loki provides async coordination

### 1.3 Port Registry System

All services register in `/Users/tryk/.local/state/nabi/port-registry.json`:

```json
{
  "port_ranges": {
    "federation_core": {"start": 8000, "end": 8099},
    "storage": {"start": 8200, "end": 8299},
    "development": {"start": 8400, "end": 8499}
  },
  "standard_allocations": {
    "memchain-mcp-sse": {"port": 8001, "protocol": "http+sse"},
    "surrealdb-primary": {"port": 8284, "protocol": "websocket"},
    // ... more services
  }
}
```

**Codegraph Allocation** (recommended):
```json
"codegraph-sse": {
  "port": 8050,
  "container_port": 8000,
  "protocol": "http+sse",
  "transport": "sse",
  "mcp_server": "codegraph-mcp",
  "status": "proposed"
}
```

---

## Part 2: Memory/Federation Architecture Patterns

### 2.1 Three-Tier Memory System (L1/L2/L3)

Your architecture enforces **strict separation** of memory layers:

**L1 - Coordination (Ephemeral, Session-Scoped)**
- **Backend**: memchain service (Redis-backed)
- **Lifetime**: Session duration (~1-2 hours)
- **Purpose**: Agent communication, task claims, federation state
- **Access Pattern**: MCP tools (`mcp__memchain__*`)
- **Auto-cleanup**: Session end triggers cleanup
- **Status**: ✅ Operational

**L2 - Knowledge (Task-Scoped, Syncthing-Synced)**
- **Backend**: Originally `~/Sync/memory/memory.json` (JSON, 150+ entities)
- **Planned**: SurrealDB at `surrealdb://localhost:8284/memory/nabi`
- **Lifetime**: Task-scoped with retention policy
- **Purpose**: Cross-agent collaboration context, patterns
- **Access Pattern**: MCP queries, federation events
- **Size**: 665 KB, 1,803 lines, 104 relations
- **Status**: ⚠️ Migration in progress (JSON → SurrealDB)

**L3 - Long-Term (Permanent, Anytype)**
- **Backend**: Anytype workspace (local-first, offline)
- **Lifetime**: Permanent, manually curated
- **Purpose**: Semantic knowledge base, insights, patterns
- **Access Pattern**: Manual curation (not MCP-accessible yet)
- **Status**: ⚠️ Disconnected from L1/L2

**Critical Rule**: "Don't pollute knowledge with coordination noise"
- L1 is ephemeral—don't store there expecting persistence
- L2 cleanup is automatic—only store task-scoped knowledge
- L3 is curated—only promote high-confidence entities

### 2.2 Session-Scoped Cleanup Architecture

Your agents are **ephemeral**, but their work is **persistent**:

```
Session Lifecycle:
  [Agent Spawned]
    ↓
  [Register in L1] ← memchain creates session_id
    ↓
  [Work Phase] ← Create L2 entities (observation, patterns)
    ↓
  [Cleanup Phase] ← Delete L1 coordination state
    ↓
  [Promote Valuable] ← Move high-confidence to L3
    ↓
  [Session Ends]
```

**Codegraph Integration Point**: 
- During work phase, agents create/update code graph entities in L2
- On cleanup, graph entities with `session_id` are evaluated for promotion to L3
- Graph queries should filter by `promoted_to_l3` flag and session retention

### 2.3 Event Bus Coordination (Loki)

Your federation uses **Loki as the event bus**:

```
Agent:  "I indexed repo X, found 150 symbols"
   ↓
Emit: {
  "timestamp": "2025-10-27T...",
  "job": "federation",
  "agent_id": "analyst-20251027-...",
  "event_type": "codegraph.symbols_indexed",
  "payload": {
    "repo": "codegraph-mcp",
    "symbol_count": 150,
    "graph_path": "~/.local/state/nabi/codegraph/graphs/repo-hash.json"
  }
}
   ↓
Loki: { "3100/loki/api/v1/push" }
   ↓
Query: curl -s 'http://localhost:3100/loki/api/v1/query?query={job="federation"}'
```

**Codegraph Events to Emit**:
- `codegraph.ingest_started` - Repository indexing begins
- `codegraph.ingest_completed` - Graph created, symbol count
- `codegraph.ingest_failed` - Error details
- `codegraph.query_resolved` - Symbol resolution result
- `codegraph.impact_analyzed` - Diff impact analysis

---

## Part 3: Proven Service Patterns in Your Federation

### 3.1 The memchain-sse Pattern (Blueprint for Codegraph)

**memchain-sse** is THE reference implementation for multi-session shared services:

```
Architecture:
┌─────────────────────────────────────────────┐
│     Multiple Claude Sessions (Ephemeral)    │
├─────────────────────────────────────────────┤
│                                             │
│  Session 1        Session 2        Session 3
│    │                 │                 │
│    └─────────────────┼─────────────────┘
│                      │
│         HTTP GET /sse (SSE connection)
│                      │
│    ┌─────────────────▼─────────────────┐
│    │   memchain-sse Server              │
│    │  (FastAPI + Uvicorn)               │
│    │  • Port 8001 (HTTP + SSE)         │
│    │  • Handles concurrent sessions     │
│    │  • Routes MCP protocol messages    │
│    │  • Federation event emission       │
│    └─────────────────┬─────────────────┘
│                      │
│    ┌─────────────────▼─────────────────┐
│    │  memchain MCP Server (Shared)      │
│    │  • Actually handles requests       │
│    │  • Session-scoped state            │
│    │  • Persistent coordination store   │
│    └─────────────────────────────────────┘
```

**Key Features**:
- ✅ Multiplexes N sessions → 1 backend
- ✅ SSE protocol (HTTP, works behind proxies)
- ✅ FastAPI/Uvicorn (pure Python, easy to extend)
- ✅ MCP protocol passthrough (transparent to clients)
- ✅ Loki integration (federation events)
- ✅ XDG compliance (state in `~/.local/state/nabi/memchain-sse/`)
- ✅ Environment-driven (FEDERATION_ENABLED, STORAGE_BACKEND, etc.)

**Performance**: 
- ~1000 messages/sec per connection
- <50ms typical latency (SSE overhead)
- 50+ concurrent sessions tested
- ~10MB baseline + ~2MB per active connection

### 3.2 Codegraph Should Adopt memchain-sse Pattern

**Why NOT direct MCP**: 
- ❌ Stdio transport is single-session only
- ❌ Cannot have multiple Claude sessions querying same graph
- ❌ No HTTP access for cross-machine agents
- ❌ Hard to monitor/debug

**Why SSE Wrapper**:
- ✅ Multiple Claude sessions access same graph concurrently
- ✅ HTTP protocol works over networks (WSL, RPi, macOS)
- ✅ Session multiplexing prevents memory duplication
- ✅ Matches federation event patterns
- ✅ Proven pattern already operational

**Example Codegraph-SSE Flow**:
```
Claude Desktop 1: "graph.resolve_symbol q=handleRequest"
     ↓
HTTP GET /sse (SSE connection opens)
     ↓
codegraph-sse server routes to codegraph-mcp
     ↓
MCP tool graph_resolve_symbol executes
     ↓
Returns: [ { id: "...", name: "handleRequest", ... } ]
     ↓
SSE event pushed to session 1
     ↓
Emit Loki: { event: "codegraph.query_resolved", agent: "...", result_count: 1 }
```

---

## Part 4: Shared Service State Patterns (Mounted Volumes)

### 4.1 How SurrealDB Uses Mounted Volumes

SurrealDB (L2 memory backend) demonstrates the mounted volume pattern:

```
Host Filesystem:
  ~/Sync/memory/              [Syncthing-synced source]
    ├── memory.json           (150+ entities, 665 KB)
    ├── relations.json        (104 relations)
    └── sessions.json         (cleanup metadata)
        ↓
  ~/.local/state/nabi/        [XDG state location]
    └── memory-backups/       (auto-backups before migration)
        ↓
  SurrealDB Container Mount:
    -v ~/.local/state/nabi/surreal:/data
    ├── /data/nabi.db         (SurrealDB file store)
    ├── /data/backups/        (automated backups)
    └── /data/logs/           (transaction logs)
```

**Benefits**:
- ✅ Persistent across service restarts
- ✅ Visible on host filesystem (debuggable)
- ✅ Syncthing can backup to RPi
- ✅ Atomicity via file transactions
- ✅ Multiple containers can access same volume

### 4.2 Codegraph Graph Storage Pattern

Codegraph should use **mounted volumes** for persistent graph state:

```
Host Filesystem:
  ~/.local/state/nabi/codegraph/        [XDG state]
    ├── graphs/                         (mounted in container)
    │   ├── codegraph-mcp.json         (main working graph)
    │   ├── example.json                (example repo graph)
    │   ├── memchain.json               (memchain repo graph)
    │   └── registry.json               (graph metadata registry)
    │
    ├── indexes/                        (computed indexes)
    │   ├── symbol-index.json           (fast lookups)
    │   ├── edge-index.json             (relationship lookups)
    │   └── file-index.json             (file→symbols mapping)
    │
    ├── cache/                          (ephemeral caches)
    │   ├── diff-cache/                 (impact analysis results)
    │   └── query-cache/                (recent queries)
    │
    └── logs/                           (federation events)
        ├── ingest.log                  (NDJSON federation events)
        └── queries.log                 (query audit trail)

Container Runtime:
  docker run \
    -v ~/.local/state/nabi/codegraph:/workspace/data \
    codegraph-sse
```

**Lifetime of Data in Mounted Volume**:
- **graphs/*.json**: Persistent (never deleted, only updated)
- **indexes/**: Regenerable (rebuilt on graph changes)
- **cache/**: Ephemeral (can be cleared without impact)
- **logs/**: Persistent (audit trail, can be compressed after 30d)

### 4.3 Memory Efficiency via Mounted Volumes

**Problem Without Mounts**:
```
Session 1 spawns Codegraph Agent 1:
  Graph loaded in memory: 5 MB
Session 2 spawns Codegraph Agent 2:
  Graph loaded in memory: 5 MB (duplicate)
Session 3 spawns Codegraph Agent 3:
  Graph loaded in memory: 5 MB (duplicate)
Total: 15 MB for same graph (waste!)
```

**Solution With SSE + Mounted Volumes**:
```
Codegraph-SSE Server (Long-running):
  Graph loaded in memory: 5 MB (ONCE)
  ├── Session 1 accesses via SSE
  ├── Session 2 accesses via SSE
  └── Session 3 accesses via SSE
Total: 5 MB shared (efficient!)
```

**Additional Efficiency**:
- Mounted volume allows mmap (memory-map) of graph file
- Can lazy-load symbols instead of parsing entire JSON
- Indexes (symbol lookup, edges) cached in memory, regenerable

---

## Part 5: Agent Coordination Architecture

### 5.1 Subagent Lifecycle with Codegraph

Your agents follow a strict lifecycle:

```
[User: "Analyze this code"]
     ↓
[Orchestrator spawns Worker Agent]
     ↓
[Hook: spawn_coherence_task()]
  • Creates agent ID: worker-20251027-abc
  • Sends to NABIKernel /spawn
  • Agent registered in L1 coordination
     ↓
[Hook: session_start()]
  • Agent registers with federation
  • Gets session_id (for cleanup)
  • Setup memory layers (L1, L2, L3 access)
     ↓
[Agent: Active Phase]
  1. Query Codegraph: "mcp__codegraph_sse__graph_resolve_symbol(q='handle*')"
  2. Get results: [ Symbol1, Symbol2, ... ]
  3. Analyze impact: "mcp__codegraph_sse__graph_impact_from_diff(patch=...)"
  4. Create L2 entity: { type: "code-analysis", observations: [...] }
  5. Emit Loki: { event: "analysis_completed", symbols_found: 2 }
     ↓
[Hook: session_end()]
  • Cleanup L1 state
  • Evaluate L2 entities for promotion to L3
  • Final federation event
     ↓
[Session terminates]
```

**Key Points**:
- Each agent has unique session_id (for cleanup)
- Codegraph accessed via MCP tools (same as any tool)
- Results stored in L2 with session_id
- Loki events track analysis activities

### 5.2 NABIKernel + Hook System Integration

NABIKernel (port 5380) manages agent spawning:

```
Hook (pre_tool_use):
  Check: "Can I spawn a subagent for this task?"
  
  if (task needs deep analysis):
    response = POST http://localhost:5380/spawn {
      "role": "analyst",
      "prompt": "Analyze code impact for this PR",
      "capabilities": ["codegraph", "impact-analysis"],
      "parent_id": current_agent_id
    }
    return: { agent_id: "analyst-20251027-xyz", task_id: "task-123" }
```

**Codegraph Integration**:
- Agent spec can declare `codegraph` as capability
- Hooks inject CODEGRAPH_SSE_URL environment variable
- Agent accesses codegraph via standard MCP pattern

---

## Part 6: Schema Transformation Patterns (Aura System)

### 6.1 Aura System: Schema → Runtime Transformation

Your system uses declarative schemas (auras) that transform to runtime state:

```
User Configuration (Source of Truth):
  ~/.config/nabi/agents/research.toml
  ├── [agent]
  │   name = "research-agent"
  │   role = "analyst"
  │   capabilities = ["codegraph", "web-search", "embedding"]
  │   memory_layers = ["L1", "L2", "L3"]
  │
  └── [tools]
      codegraph = {
        enabled = true,
        sse_url = "http://127.0.0.1:8050/sse",
        timeout = 30,
        cache = true
      }
          ↓
Transformation (nabi aura apply):
  ~/.local/state/nabi/agents/research.json
  ├── "agent_id": "research-agent-...",
  ├── "capabilities": ["codegraph", "web-search", ...],
  ├── "tools": {
  │   "codegraph": {
  │     "sse_url": "http://127.0.0.1:8050/sse",
  │     "timeout": 30,
  │     "cache": true
  │   }
  │ }
  └── "session_id": "sess-...", "created": "..."
```

**For Codegraph**: Configuration should be schema-driven:

```toml
# ~/.config/nabi/services/codegraph-sse.toml
[service]
name = "codegraph-sse"
version = "0.1.0"
type = "mcp-sse-wrapper"
status = "active"

[ports]
http = 8050
mcp = 8051

[storage]
graphs = "~/.local/state/nabi/codegraph/graphs"
indexes = "~/.local/state/nabi/codegraph/indexes"
cache = "~/.local/state/nabi/codegraph/cache"
logs = "~/.local/state/nabi/codegraph/logs"

[federation]
loki_url = "http://localhost:3100"
emit_events = true
event_prefix = "codegraph"

[performance]
max_graph_size_mb = 100
cache_ttl_seconds = 3600
index_rebuild_threshold = 0.8
```

---

## Part 7: Design Recommendations for Centralized Codegraph Service

### 7.1 Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│              Codegraph Service Architecture              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Runtime Layer (Long-running, Port 8050):              │
│  ┌──────────────────────────────────────────────┐     │
│  │  codegraph-sse (FastAPI + Uvicorn)          │     │
│  │  • SSE multiplexer for multiple sessions    │     │
│  │  • Routes to codegraph-mcp                  │     │
│  │  • Emits Loki events                        │     │
│  │  • Session tracking & rate limiting         │     │
│  └──────────────────────────────────────────────┘     │
│               ↓                                         │
│  MCP Server Layer:                                     │
│  ┌──────────────────────────────────────────────┐     │
│  │  codegraph-mcp (Shared instance)             │     │
│  │  • graph_resolve_symbol(q)                   │     │
│  │  • graph_references(id)                      │     │
│  │  • graph_related(id, k)                      │     │
│  │  • graph_impact_from_diff(patch)             │     │
│  │  • graph_ingest(target)                      │     │
│  │  • graph_list_graphs()                       │     │
│  └──────────────────────────────────────────────┘     │
│               ↓                                         │
│  Storage Layer (Persistent, Mounted):                  │
│  ┌──────────────────────────────────────────────┐     │
│  │  ~/.local/state/nabi/codegraph/              │     │
│  │  ├── graphs/ (JSON graph files)              │     │
│  │  ├── indexes/ (computed symbol indexes)      │     │
│  │  ├── cache/ (ephemeral query results)        │     │
│  │  └── logs/ (federation events NDJSON)        │     │
│  └──────────────────────────────────────────────┘     │
│               ↓                                         │
│  Event Layer (Federation):                             │
│  ┌──────────────────────────────────────────────┐     │
│  │  Loki (http://localhost:3100)                │     │
│  │  • codegraph.ingest_* events                 │     │
│  │  • codegraph.query_* events                  │     │
│  │  • codegraph.cache_* events                  │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Multi-Session Access Pattern

```
Claude Session 1              Claude Session 2
   │                                │
   └────────────┬───────────────────┘
                │
        GET /sse (stream)
                │
    ┌───────────▼───────────┐
    │  codegraph-sse:8050   │  ← Single service instance
    │  ┌─────────────────┐  │     (shared across sessions)
    │  │ Session Manager │  │
    │  │ • Mux/demux     │  │
    │  │ • Rate limiting │  │
    │  │ • Event emit    │  │
    │  └────────┬────────┘  │
    │           │           │
    │  ┌────────▼────────┐  │
    │  │ codegraph-mcp   │  │  ← Single MCP instance
    │  │ (shared state)  │  │     (loaded once, used by both)
    │  └────────┬────────┘  │
    │           │           │
    │  ┌────────▼────────┐  │
    │  │ Mount volume    │  │
    │  │ graphs/ indexes/│  │
    │  │ cache/ logs/    │  │
    │  └─────────────────┘  │
    └───────────────────────┘
                │
         5 MB graph memory
         (shared, not duplicated)
```

### 7.3 Event Emission to Loki

Every operation should emit federation events:

```typescript
// graph_resolve_symbol → emit event
emit_loki("codegraph.query_resolved", {
  agent_id: context.agent_id,
  session_id: context.session_id,
  query: "handle*",
  result_count: 2,
  latency_ms: 12,
  timestamp: new Date().toISOString()
});

// graph_ingest → emit events
emit_loki("codegraph.ingest_started", {
  agent_id: context.agent_id,
  target: "/path/to/repo",
  timestamp: new Date().toISOString()
});

// ... later ...

emit_loki("codegraph.ingest_completed", {
  agent_id: context.agent_id,
  symbol_count: 150,
  edge_count: 300,
  duration_seconds: 2.5,
  graph_path: "~/.local/state/nabi/codegraph/graphs/repo-hash.json",
  timestamp: new Date().toISOString()
});
```

### 7.4 State Organization (XDG Compliance)

```
Configuration (Source of Truth):
  ~/.config/nabi/services/codegraph.toml

Runtime State (Persistent, Mounted):
  ~/.local/state/nabi/codegraph/
  ├── graphs/                    (persistent graph JSONs)
  ├── indexes/                   (computed, regenerable)
  ├── cache/                     (ephemeral, can clear)
  └── logs/                      (audit trail)

Ephemeral Cache:
  ~/.cache/nabi/codegraph/
  ├── build-artifacts/
  └── temp-indexes/

Syncthing-Synced (if needed):
  ~/Sync/codegraph/
  └── important-graphs/          (backed up to federation)
```

---

## Part 8: Implementation Roadmap

### Phase 1: SSE Wrapper (Week 1)
- [ ] Create `codegraph-sse` based on memchain-sse pattern
- [ ] FastAPI + Uvicorn HTTP server on port 8050
- [ ] MCP message routing to codegraph-mcp
- [ ] Session multiplexing logic
- [ ] Basic health endpoint

### Phase 2: Storage Integration (Week 2)
- [ ] Mount volume configuration in docker-compose
- [ ] Persistent graph.json in ~/.local/state/nabi/codegraph/graphs/
- [ ] Index caching strategy
- [ ] Graceful reload on graph changes

### Phase 3: Federation Events (Week 2-3)
- [ ] Loki integration (emit events for all operations)
- [ ] Event schema definition (codegraph.* prefix)
- [ ] Port registry update (register codegraph-sse on port 8050)
- [ ] Agent spec with codegraph capability

### Phase 4: Agent Integration (Week 3-4)
- [ ] Hook system integration (inject CODEGRAPH_SSE_URL)
- [ ] Agent specs with codegraph capability
- [ ] Session-scoped cleanup (mark L2 entities with session_id)
- [ ] Promotion pipeline for high-value findings

### Phase 5: Optimization (Week 4+)
- [ ] Index building and incremental updates
- [ ] Caching strategies (query cache, diff cache)
- [ ] Performance monitoring via Loki
- [ ] Backup to ~/Sync/codegraph/ for federation

---

## Part 9: Critical Integration Points

### 9.1 Port Registry Update

Add to `/Users/tryk/.local/state/nabi/port-registry.json`:

```json
{
  "standard_allocations": {
    "codegraph-sse": {
      "port": 8050,
      "container_port": 8000,
      "protocol": "http+sse",
      "transport": "sse",
      "mcp_server": "codegraph-mcp",
      "storage": "~/.local/state/nabi/codegraph",
      "federation_enabled": true,
      "loki_url": "http://localhost:3100",
      "status": "active"
    }
  }
}
```

### 9.2 Agent Spec (Capability Declaration)

Create `~/.config/nabi/agents/codegraph-enabled.toml`:

```toml
[agent]
name = "codegraph-enabled"
role = "analyst"
capabilities = ["codegraph", "code-analysis"]

[tools.codegraph]
sse_url = "http://127.0.0.1:8050/sse"
timeout = 30
cache_enabled = true

[memory]
layers = ["L1", "L2", "L3"]
session_scoped_cleanup = true
```

### 9.3 Hook Integration

Codegraph-SSE URL injected via hook:

```bash
# Hook: session_start.py
export CODEGRAPH_SSE_URL="http://127.0.0.1:8050/sse"
export CODEGRAPH_ENABLED=true
```

### 9.4 Claude Desktop Configuration

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "curl",
      "args": ["http://127.0.0.1:8050/sse"],
      "description": "Codegraph SSE transport - multi-session code graph analysis"
    }
  }
}
```

---

## Part 10: Key Architectural Decisions

### Decision 1: SSE vs Direct MCP
**Choice**: SSE Wrapper Layer

**Rationale**:
- ✅ Multiple sessions share same graph instance (memory efficient)
- ✅ HTTP protocol (works over networks, behind proxies)
- ✅ Matches federation patterns (memchain-sse is proven)
- ❌ Stdio is single-session only (not federation-aware)

### Decision 2: Storage Backend
**Choice**: Mounted JSON volumes (near-term), SurrealDB (long-term)

**Rationale**:
- ✅ JSON is portable and debuggable
- ✅ Mounted volumes allow Syncthing backup
- ✅ SurrealDB adds query capabilities and semantic search
- ✅ Can migrate from JSON to SurrealDB without breaking clients

### Decision 3: Memory Lifecycle
**Choice**: Persistent service + XDG-compliant state + session-scoped L2 entities

**Rationale**:
- ✅ Service runs continuously (avoid repeated parsing)
- ✅ State in ~/.local/state/nabi/ (XDG compliant, portable)
- ✅ L2 entities tied to session_id (enables cleanup)
- ✅ Follows federation memory model (L1/L2/L3 separation)

### Decision 4: Event Emission
**Choice**: Emit to Loki for all operations

**Rationale**:
- ✅ Federation visibility (agents coordinate via events)
- ✅ Audit trail (who queried what, when)
- ✅ Performance monitoring (latency, cache hit rates)
- ✅ Enables alerting (e.g., "query timeout, retrying")

---

## Part 11: Federation Patterns Already Proven in Your System

### Pattern 1: Persistent Shared Services
**Example**: memchain-sse (already working)
**Codegraph Applies**: SSE wrapper runs 24/7, shared by multiple agents

### Pattern 2: Mounted Volumes for State
**Example**: SurrealDB at ~/.local/state/nabi/surreal/
**Codegraph Applies**: Graph JSON at ~/.local/state/nabi/codegraph/graphs/

### Pattern 3: Event Emission to Loki
**Example**: Link mapper emits 5+ federation events
**Codegraph Applies**: Emit codegraph.* events for all operations

### Pattern 4: XDG Compliance
**Example**: All paths via ~/.config/, ~/.local/state/, ~/.cache/
**Codegraph Applies**: No hardcoded /Users/tryk/ paths

### Pattern 5: Session-Scoped Cleanup
**Example**: memchain cleanup after session ends
**Codegraph Applies**: L2 entities marked with session_id, auto-cleanup

### Pattern 6: Hook System Integration
**Example**: session_start.py injects environment variables
**Codegraph Applies**: Inject CODEGRAPH_SSE_URL, CODEGRAPH_CACHE_DIR

### Pattern 7: Port Registry
**Example**: memchain-mcp-sse registered on port 8001
**Codegraph Applies**: Register codegraph-sse on port 8050

---

## Part 12: Risk Mitigation

### Risk 1: Multiple Sessions Accessing Same Graph
**Mitigation**: Use read-only mmap + write locks on graph rebuild
- Only one ingest can happen at a time (lock file)
- Readers can access while ingest happens (copy-on-write)

### Risk 2: Graph Size Exceeding Available Memory
**Mitigation**: Lazy-load symbols, implement streaming queries
- Don't load entire graph on startup
- Stream symbol lookups from disk
- Cache recently used symbols

### Risk 3: Stale Graph (Not Re-ingested After Repo Change)
**Mitigation**: Implement version tracking and cache invalidation
- Track graph hash in registry
- Compare against repo hash on each query
- Emit warning if graph is >1 day old

### Risk 4: Port Conflicts
**Mitigation**: Port registry system + health checks
- Register port 8050 in federation registry
- Health endpoint returns conflict error if port taken
- Startup script checks registry before binding

### Risk 5: Event Emission Overload
**Mitigation**: Batch events, async emission, sampling
- Batch events every 100ms
- Emit async (don't block query)
- Sample high-frequency events (every Nth query)

---

## Conclusion

Your infrastructure is **purpose-built for this pattern**. The codegraph-mcp service should:

1. **Adopt SSE transport** layer (proven by memchain-sse)
2. **Use mounted volumes** for persistent state (like SurrealDB)
3. **Emit Loki events** for federation visibility
4. **Store state in ~/.local/state/nabi/codegraph/** (XDG compliant)
5. **Mark L2 entities with session_id** (enable cleanup)
6. **Register on port 8050** in federation registry
7. **Support multi-session access** (multiple agents querying same graph)

This design achieves:
- ✅ Memory efficiency (shared graph instance)
- ✅ Federation visibility (Loki events)
- ✅ Session cleanup (auto-remove temporary work)
- ✅ Cross-machine access (HTTP, not stdio)
- ✅ Persistent knowledge (SurrealDB-ready)
- ✅ XDG compliance (portable, discoverable)

**North Star**: Every agent operates in **aligned reality**—shared code graph, coherent analysis, federated coordination.

---

**Analysis Completed**: 2025-10-27  
**Status**: Ready for implementation  
**Next Step**: Execute Phase 1 (SSE wrapper) and validate against this architecture

