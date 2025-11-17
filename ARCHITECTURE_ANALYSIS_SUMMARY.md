# Architecture Analysis Summary

**Complete Analysis**: `/Users/tryk/mcp-servers/codegraph-mcp/CODEGRAPH_ARCHITECTURE_ANALYSIS.md` (926 lines)

## Key Findings

### 1. Your Infrastructure is Purpose-Built for This
Your federation already solved the "shared service" problem via **memchain-sse**. The codegraph-mcp service should reuse this pattern, not reinvent it.

### 2. Recommended Architecture

```
Multiple Claude Sessions (Ephemeral)
           ↓
    codegraph-sse (SSE Wrapper)
    Port 8050 (HTTP + Server-Sent Events)
           ↓
    codegraph-mcp (Shared MCP Instance)
    Graph loaded once in memory (~5MB)
           ↓
    $XDG_STATE_HOME/nabi/codegraph/ (~/.local/state/nabi/codegraph/) (Mounted Volume)
    ├── graphs/        (persistent JSON)
    ├── indexes/       (computed, regenerable)
    ├── cache/         (ephemeral)
    └── logs/          (audit trail)
           ↓
    Loki (Federation Event Bus)
    Emit codegraph.* events for visibility
```

**Key Insight**: Multiple sessions share **one graph instance**, not separate copies.

### 3. Three Proven Patterns from Your Federation

#### Pattern 1: SSE Transport (memchain-sse template)
- ✅ FastAPI + Uvicorn on port 8050
- ✅ Multiplexes N sessions → 1 backend
- ✅ Works over HTTP (not stdio)
- ✅ 50+ concurrent sessions tested
- Performance: ~1000 msg/sec, <50ms latency

#### Pattern 2: Mounted Volumes (SurrealDB template)
- ✅ State in `$XDG_STATE_HOME/nabi/codegraph/` (~/.local/state/nabi/codegraph/)
- ✅ Persistent across service restarts
- ✅ Visible on host filesystem (debuggable)
- ✅ Syncthing can backup to RPi
- ✅ Multiple containers access same volume

#### Pattern 3: Event Emission to Loki
- ✅ Every operation emits event (codegraph.ingest_started, etc.)
- ✅ Federation visibility across agents
- ✅ Audit trail (who, what, when)
- ✅ Performance monitoring (latency, cache hit rates)

### 4. Memory Efficiency

**Without SSE** (each session gets own instance):
```
Session 1: 5 MB
Session 2: 5 MB (duplicate)
Session 3: 5 MB (duplicate)
Total: 15 MB waste!
```

**With SSE** (shared instance):
```
codegraph-sse: 5 MB (loaded once)
Session 1: ← accesses via SSE
Session 2: ← accesses via SSE
Session 3: ← accesses via SSE
Total: 5 MB shared (efficient!)
```

### 5. Three-Tier Memory Integration

Your L1/L2/L3 memory system:

**L1** (Coordination - Ephemeral):
- memchain-based, session-scoped
- Agent communication, task claims

**L2** (Knowledge - Task-Scoped):
- Currently: ~/Sync/memory/memory.json (150+ entities)
- Planned: SurrealDB at port 8284
- **Codegraph Integration**: Store code analysis findings here with session_id

**L3** (Long-Term - Permanent):
- Anytype workspace
- **Codegraph Integration**: Promote high-confidence findings to L3

### 6. Session-Scoped Cleanup Pattern

```
Agent Spawned
  ↓
Register in L1 (memchain creates session_id)
  ↓
Work Phase (create/update L2 entities)
  ├─ Code analysis findings
  └─ Mark with session_id
  ↓
Cleanup Phase (auto-delete L1 state)
  ├─ Evaluate L2 entities
  └─ Promote valuable findings to L3
  ↓
Session Ends
```

### 7. Port Registry Entry (Recommended)

```json
"codegraph-sse": {
  "port": 8050,
  "container_port": 8000,
  "protocol": "http+sse",
  "transport": "sse",
  "mcp_server": "codegraph-mcp",
  "storage": "$XDG_STATE_HOME/nabi/codegraph",
  "federation_enabled": true,
  "loki_url": "http://localhost:3100",
  "status": "active"
}
```

### 8. State Organization (XDG Compliant)

```
Configuration (Source of Truth):
  $XDG_CONFIG_HOME/nabi/services/codegraph.toml (~/.config/nabi/services/codegraph.toml)

Runtime State (Persistent):
  $XDG_STATE_HOME/nabi/codegraph/ (~/.local/state/nabi/codegraph/)
  ├── graphs/              (persistent graph JSONs)
  ├── indexes/             (computed, regenerable)
  ├── cache/               (ephemeral, clearable)
  └── logs/                (audit trail, NDJSON)

Ephemeral Cache:
  $XDG_CACHE_HOME/nabi/codegraph/ (~/.cache/nabi/codegraph/)
  ├── build-artifacts/
  └── temp-indexes/

Syncthing-Synced (Backup):
  ~/Sync/codegraph/
  └── important-graphs/
```

### 9. Codegraph Events to Emit

- `codegraph.ingest_started` - Repository indexing begins
- `codegraph.ingest_completed` - Symbol count, duration
- `codegraph.ingest_failed` - Error details
- `codegraph.query_resolved` - Symbol resolution result
- `codegraph.impact_analyzed` - Diff impact analysis
- `codegraph.cache_hit` / `codegraph.cache_miss`

### 10. Implementation Roadmap

**Phase 1** (Week 1): SSE wrapper based on memchain-sse
**Phase 2** (Week 2): Mount volume configuration
**Phase 3** (Week 2-3): Loki event integration
**Phase 4** (Week 3-4): Hook system + agent specs
**Phase 5** (Week 4+): Optimization & backup

---

## Critical Integration Points

### Port Registry
Add codegraph-sse (port 8050) to `$XDG_STATE_HOME/nabi/port-registry.json` (~/.local/state/nabi/port-registry.json)

### Agent Specs
Create `$XDG_CONFIG_HOME/nabi/agents/codegraph-enabled.toml` (~/.config/nabi/agents/codegraph-enabled.toml) with:
- `capabilities = ["codegraph", "code-analysis"]`
- `sse_url = "http://127.0.0.1:8050/sse"`
- `memory_layers = ["L1", "L2", "L3"]`

### Hook Integration
Inject `CODEGRAPH_SSE_URL` in session_start.py hook

### Claude Desktop
Configure MCP server to use `http://127.0.0.1:8050/sse`

---

## Why This Architecture Works

1. **Memory Efficient**: One graph instance shared across sessions
2. **Federation-Aware**: Events emitted to Loki for visibility
3. **Session-Scoped**: Cleanup automatic, findings persistent
4. **XDG Compliant**: Portable across macOS/WSL/Linux/RPi
5. **Proven Pattern**: Identical to memchain-sse (already operational)
6. **Scalable**: Handles 50+ concurrent sessions
7. **Debuggable**: State visible on host filesystem
8. **Backed Up**: Syncthing can replicate to federation

---

## Key Decision: SSE vs Direct MCP

**Chose**: SSE Wrapper

**Why NOT Direct MCP**:
- ❌ Stdio is single-session only
- ❌ Cannot have multiple Claude sessions querying same graph
- ❌ No HTTP access for cross-machine agents
- ❌ Memory duplication per session

**Why SSE Wrapper**:
- ✅ Multiple sessions access one graph instance
- ✅ HTTP works over networks (WSL, RPi, macOS)
- ✅ Session multiplexing prevents waste
- ✅ Matches proven federation pattern (memchain-sse)

---

## Alignment with Your Federation Philosophy

Your system follows **five pillars of noble architecture** (from NORTH_STAR.md):

1. **Longevity Over Expedience** ← Persistent service, mount volumes
2. **Clarity Over Cleverness** ← XDG paths, schema-driven config
3. **Resilience Over Rigidity** ← Session cleanup, event emission
4. **Coherence Over Coupling** ← L1/L2/L3 separation, event bus
5. **Evolution Over Revolution** ← JSON → SurrealDB migration path

---

## Full Analysis Document

**Location**: `/Users/tryk/mcp-servers/codegraph-mcp/CODEGRAPH_ARCHITECTURE_ANALYSIS.md`

**Contents** (926 lines):
- Part 1: Infrastructure overview (XDG, services, ports)
- Part 2: Memory/federation patterns (L1/L2/L3, Loki)
- Part 3: Proven patterns (memchain-sse, SurrealDB)
- Part 4: Mounted volumes for state
- Part 5: Agent coordination
- Part 6: Aura/schema transformation
- Part 7: Design recommendations
- Part 8: Implementation roadmap
- Part 9: Critical integration points
- Part 10: Architectural decisions
- Part 11: Proven patterns summary
- Part 12: Risk mitigation

---

**Status**: Ready for implementation

**Next Step**: Execute Phase 1 (SSE wrapper based on memchain-sse pattern)
