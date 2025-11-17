# Codegraph-MCP Architecture Quick Reference

## The Pattern You Already Have

Your infrastructure solved this via **memchain-sse**:
- Long-running service (FastAPI + Uvicorn)
- Multiplexes multiple sessions to shared backend
- Uses Loki for federation events
- State in XDG-compliant directories
- Registered in port-registry.json

**Codegraph should adopt the exact same pattern.**

---

## One-Diagram Summary

```
Claude Session 1, 2, 3, ...
         ↓ (HTTP GET /sse)
    codegraph-sse:8050 (FastAPI)
         ↓ (MCP routing)
    codegraph-mcp (Shared instance)
         ↓ (Memory: ~5MB, loaded once)
    $XDG_STATE_HOME/nabi/codegraph/ (~/.local/state/nabi/codegraph/)
    ├── graphs/json
    ├── indexes/
    ├── cache/
    └── logs/ (NDJSON federation events)
         ↓ (Emit to)
    Loki:3100 (codegraph.* events)
```

---

## Essential Configuration

### Port Registry Entry (8050)
```json
"codegraph-sse": {
  "port": 8050,
  "protocol": "http+sse",
  "transport": "sse",
  "mcp_server": "codegraph-mcp",
  "storage": "$XDG_STATE_HOME/nabi/codegraph",
  "federation_enabled": true
}
```

### State Directories
```
~/.local/state/nabi/codegraph/
├── graphs/         # Persistent graph JSONs
├── indexes/        # Computed (regenerable)
├── cache/          # Ephemeral (clearable)
└── logs/           # Federation events (NDJSON)
```

### Agent Spec (codegraph-enabled.toml)
```toml
[agent]
capabilities = ["codegraph", "code-analysis"]

[tools.codegraph]
sse_url = "http://127.0.0.1:8050/sse"
timeout = 30
cache_enabled = true

[memory]
layers = ["L1", "L2", "L3"]
session_scoped_cleanup = true
```

---

## Federation Events to Emit

```python
# Every operation should emit to Loki
emit_loki("codegraph.ingest_started",
  {"agent_id": "...", "target": "...", "timestamp": "..."})
emit_loki("codegraph.ingest_completed",
  {"agent_id": "...", "symbol_count": 150, "duration_seconds": 2.5, ...})
emit_loki("codegraph.query_resolved",
  {"agent_id": "...", "query": "handle*", "result_count": 2, "latency_ms": 12, ...})
```

---

## Memory Integration (L1/L2/L3)

### L1 (Coordination - Ephemeral)
- memchain-based
- Session-scoped
- Agent communication, task claims
- Auto-cleanup at session end

### L2 (Knowledge - Task-Scoped)
- Currently: ~/Sync/memory/memory.json (150+ entities)
- Planned: SurrealDB at port 8284
- **Codegraph**: Store analysis findings here with session_id
- Auto-cleanup based on retention policy

### L3 (Long-Term - Permanent)
- Anytype workspace
- **Codegraph**: Promote high-confidence findings to L3
- Manual curation

---

## Key Patterns (Already Proven)

### Pattern 1: SSE Transport
- Template: memchain-sse in ~/nabia/memchain/
- Architecture: FastAPI + Uvicorn
- Multiplexing: 50+ concurrent sessions tested
- Performance: ~1000 msg/sec, <50ms latency

### Pattern 2: Mounted Volumes
- Template: SurrealDB at ~/.local/state/nabi/surreal/
- Benefits: Persistent, debuggable, synced via Syncthing
- Access: Multiple containers, same volume

### Pattern 3: Event Emission
- Template: link-mapper emits 5+ events
- Destination: Loki HTTP API (localhost:3100)
- Format: Standard federation event schema

### Pattern 4: XDG Compliance
- All paths: ~/.config/, ~/.local/state/, ~/.cache/
- No hardcoded /Users/tryk/ paths
- Portable across macOS/WSL/Linux/RPi

---

## Implementation Checklist

### Phase 1: SSE Wrapper (Week 1)
- [ ] Create codegraph-sse directory
- [ ] Base on memchain-sse architecture
- [ ] FastAPI + Uvicorn on port 8050
- [ ] MCP message routing
- [ ] Health endpoint (/health)

### Phase 2: Storage (Week 2)
- [ ] Mount volume ~/.local/state/nabi/codegraph/
- [ ] Graph.json persistence
- [ ] Index building
- [ ] Graceful reload logic

### Phase 3: Federation Events (Week 2-3)
- [ ] Loki HTTP client (emit events)
- [ ] Event schema (codegraph.* prefix)
- [ ] Port registry update
- [ ] Agent spec creation

### Phase 4: Hook Integration (Week 3-4)
- [ ] CODEGRAPH_SSE_URL injection
- [ ] Agent capability declaration
- [ ] Session-scoped L2 entity marking
- [ ] Cleanup pipeline

### Phase 5: Optimization (Week 4+)
- [ ] Index building optimization
- [ ] Query caching
- [ ] Loki performance monitoring
- [ ] Syncthing backup to ~/Sync/codegraph/

---

## Why This Works

1. **Memory Efficient**: One instance, N sessions (not N copies)
2. **Federation-Ready**: Loki events for visibility
3. **Session-Aware**: Auto-cleanup via session_id
4. **XDG-Portable**: Works on macOS/WSL/Linux/RPi
5. **Proven Pattern**: Identical architecture to memchain-sse
6. **Scalable**: 50+ concurrent sessions
7. **Debuggable**: Files visible on host filesystem
8. **Backed Up**: Syncthing replication to federation

---

## Critical Decision: SSE vs Direct MCP

| Aspect | Direct MCP | SSE Wrapper |
|--------|-----------|------------|
| Multiple Sessions | ❌ Single-session | ✅ N sessions |
| Memory Duplication | ❌ N copies | ✅ 1 shared copy |
| Network Access | ❌ Stdio only | ✅ HTTP |
| Proven in Federation | ❌ No | ✅ Yes (memchain-sse) |
| Scalability | ❌ Poor | ✅ 50+ sessions |

**Verdict**: SSE Wrapper (proven pattern, memory efficient)

---

## Related Systems (Already Working)

- **memchain-sse** (port 8001): Multi-session MCP transport blueprint
- **SurrealDB** (port 8284): Mounted volume persistence template
- **Loki** (port 3100): Federation event bus
- **NABIKernel** (port 5380): Agent spawning coordination
- **Port registry**: `/Users/tryk/.local/state/nabi/port-registry.json`
- **Hook system**: `~/.config/nabi/governance/hooks/`
- **Aura system**: `~/.config/nabi/auras/*.toml`

---

## Files to Reference

### Implementations
- memchain-sse: `~/nabia/memchain/` (SSE pattern)
- SurrealDB: `~/.local/state/nabi/surreal/` (mounted volume)
- link-mapper: `~/.config/nabi/tools/link-mapper/` (federation events)

### Documentation
- Full Analysis: `/Users/tryk/mcp-servers/codegraph-mcp/CODEGRAPH_ARCHITECTURE_ANALYSIS.md`
- Memchain-sse Guide: `~/Sync/docs/tools/memchain-sse-user-guide.md`
- Port Registry: `~/.local/state/nabi/port-registry.json`
- Memory Architecture: `~/Sync/docs/architecture/memory-layer/MEMORY_ARCHITECTURE_SUMMARY.md`
- Federation Architecture: `~/Sync/docs/architecture/SUBAGENTS_HOOKS_NABIKERNEL_ARCHITECTURE.md`

---

## Contact Points

**Architecture Questions**:
- Review: `/Users/tryk/mcp-servers/codegraph-mcp/CODEGRAPH_ARCHITECTURE_ANALYSIS.md`
- Patterns: memchain-sse (reference impl) or SurrealDB (mounted volumes)

**Implementation Questions**:
- SSE transport: See memchain-sse in ~/nabia/memchain/
- Mounted volumes: See SurrealDB in ~/.local/state/nabi/surreal/
- Federation events: See link-mapper tools/integration

**Integration Questions**:
- Port registry: Add codegraph-sse on port 8050
- Agent specs: Create ~/.config/nabi/agents/codegraph-enabled.toml
- Hooks: Inject CODEGRAPH_SSE_URL in session_start.py
- Memory: Mark L2 entities with session_id for cleanup

---

**Status**: Ready for Phase 1 implementation
**Next**: Build SSE wrapper (Week 1)
