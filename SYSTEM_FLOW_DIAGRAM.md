# System Flow Diagram - The Cognitive Federation

**Date:** 2025-11-18
**Purpose:** One-page visual reference for how everything connects

---

## 🌊 The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER / AGENT LAYER                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  Claude    │  │  Claude    │  │  Claude    │  │  Agent     │       │
│  │  Session 1 │  │  Session 2 │  │  Session 3 │  │  Process   │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
│        │               │               │               │               │
└────────┼───────────────┼───────────────┼───────────────┼───────────────┘
         │               │               │               │
         │ HTTP/SSE      │ HTTP/SSE      │ HTTP/SSE      │ HTTP/SSE
         │               │               │               │
         ├───────────────┴───────────────┴───────────────┘
         │
┌────────▼───────────────────────────────────────────────────────────────┐
│                     FEDERATION SERVICE LAYER                            │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │ codegraph-sse    │  │ memchain-sse     │  │ (Agent D SSE)    │     │
│  │ Port: 8050       │  │ Port: 8051       │  │ Port: 8052       │     │
│  │ Memory: ~150 MB  │  │ Memory: ~100 MB  │  │ (Planned)        │     │
│  │ ──────────────── │  │ ──────────────── │  │ ──────────────── │     │
│  │ • Code analysis  │  │ • L1 coordination│  │ • Event acks     │     │
│  │ • Symbol search  │  │ • Task claims    │  │ • Vector clocks  │     │
│  │ • Impact check   │  │ • Agent comms    │  │ • Causality      │     │
│  │ • Multi-graph    │  │ • Session state  │  │ • Priorities     │     │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘     │
│           │                     │                     │               │
└───────────┼─────────────────────┼─────────────────────┼───────────────┘
            │                     │                     │
            │                     │                     │
┌───────────▼─────────────────────▼─────────────────────▼───────────────┐
│                    PERSISTENT STATE LAYER                               │
│                   ~/.local/state/nabi/                                  │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│  │ codegraph/          │  │ surreal/            │  │ memchain/      │ │
│  │ ├─ registry.json    │  │ ├─ database/        │  │ ├─ sessions/  │ │
│  │ ├─ graphs/          │  │ │  └─ data.db       │  │ └─ tasks.json │ │
│  │ │  ├─ memchain/     │  │ └─ config.toml      │  └────────────────┘ │
│  │ │  │  graph.json    │  │                     │                     │
│  │ │  │  (70K symbols) │  │  SurrealDB          │  L1 Ephemeral       │
│  │ │  └─ codegraph/    │  │  L2 Knowledge Graph │  Session State      │
│  │ │     graph.json    │  │  Port: 8284         │                     │
│  │ │     (196 symbols) │  │  ──────────────────  │                     │
│  │ ├─ cache/           │  │  • 498 entities     │                     │
│  │ └─ logs/            │  │  • Recovery patterns│                     │
│  │                     │  │  • Code findings    │                     │
│  │  Code Intelligence  │  │  • FSM states       │                     │
│  │  Multi-Graph Store  │  │  • Event registry   │                     │
│  └─────────────────────┘  └─────────────────────┘                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
            │                     │
            │                     │
┌───────────▼─────────────────────▼────────────────────────────────────────┐
│                      FEDERATION EVENT BUS                                 │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Loki @ Port 3100                                                   │  │
│  │  ──────────────────────────────────────────────────────────────────  │  │
│  │  Event Streams:                                                     │  │
│  │  • codegraph.ingest_*     → Graph indexing lifecycle               │  │
│  │  • codegraph.query_*      → Code analysis operations               │  │
│  │  • fsm.transition_*       → Document state changes                 │  │
│  │  • agent.event_*          → Federation event coordination          │  │
│  │  • memchain.*             → L1 coordination events                 │  │
│  │  • nabi.*                 → System-wide operations                 │  │
│  │                                                                     │  │
│  │  Uses: Audit trail, performance monitoring, debugging              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
            │
            │ Events consumed by
            │
┌───────────▼────────────────────────────────────────────────────────────┐
│                    VISUALIZATION & ANALYSIS                             │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  dag-tui         │  │  nabi CLI        │  │  Sprint Summary  │     │
│  │  ──────────────  │  │  ──────────────  │  │  ──────────────  │     │
│  │  • Canvas render │  │  • repo analyze  │  │  • Multi-source  │     │
│  │  • Node symbols  │  │  • events ack    │  │  • Intelligence  │     │
│  │  • Rotation anim │  │  • graph search  │  │    scoring       │     │
│  │  • Data from L3  │  │  • fsm status    │  │  • JSONL export  │     │
│  │  ❌ Need pipeline│  │  ❌ Some pending │  │  ❌ Not built    │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Codegraph-MCP Specific Flow

```
┌───────────────────────────────────────────────────────────────┐
│  STEP 1: INDEXING (One-time or on-demand)                     │
└───────────────────────────────────────────────────────────────┘
         │
         │  bun run ingest -- --target ~/nabia/memchain
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  make_graph.ts (Orchestrator)               │
    │  ├─→ Find .ts/.tsx/.py files               │
    │  ├─→ Spawn ingest_ts.ts                    │
    │  │   └─→ TypeScript AST parsing            │
    │  │       └─→ Symbols + Edges                │
    │  ├─→ Spawn py/ingest_py.py (subprocess)    │
    │  │   └─→ Python AST parsing                │
    │  │       └─→ NDJSON → Symbols + Edges      │
    │  ├─→ Merge graphs                           │
    │  ├─→ Resolve edges (naive name matching)   │
    │  ├─→ Deduplicate symbols/edges             │
    │  └─→ Write data/graph.json                 │
    └────────────────┬───────────────────────────┘
                     │
                     │  Result: graph.json (33 MB for memchain)
                     │  - 70,079 symbols
                     │  - 104,501 edges
                     │
         ┌───────────▼──────────────────────────────────────────┐
         │  STEP 2: SERVER STARTUP                               │
         └───────────────────────────────────────────────────────┘
                     │
                     │  bun run dev:server
                     │  OR
                     │  docker-compose up codegraph-sse
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │  src/mcp/server.ts (MCP Protocol)        │
         │  OR                                       │
         │  src/codegraph_sse/server.py (SSE)       │
         │  ──────────────────────────────────────   │
         │  1. Load data/graph.json into memory     │
         │  2. Build indexes:                        │
         │     • id2sym: Map<id, Symbol>            │
         │     • name2ids: Map<name, id[]>          │
         │     • outEdges: Map<id, Edge[]>          │
         │     • inEdges: Map<id, Edge[]>           │
         │  3. Register MCP tools:                   │
         │     • graph_resolve_symbol               │
         │     • graph_references                    │
         │     • graph_related                       │
         │     • graph_impact_from_diff             │
         │  4. Register resource:                    │
         │     • code://file/{path}                 │
         │  5. Listen (stdio OR port 8050)          │
         └──────────────┬───────────────────────────┘
                        │
                        │  Server Ready
                        │
         ┌──────────────▼──────────────────────────────────────┐
         │  STEP 3: QUERY EXECUTION                             │
         └──────────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┬───────────────────┐
         │                             │                   │
         ▼                             ▼                   ▼
    ┌─────────────┐         ┌──────────────────┐    ┌─────────────┐
    │ Claude asks │         │ Agent queries    │    │ CLI command │
    │ "Find auth" │         │ via MCP tool     │    │ impact test │
    └──────┬──────┘         └────────┬─────────┘    └──────┬──────┘
           │                         │                     │
           │  graph_resolve_symbol({q: "auth"})           │
           │                         │                     │
           ▼                         ▼                     ▼
    ┌────────────────────────────────────────────────────────┐
    │  MCP Server / SSE Service                               │
    │  ────────────────────────────────────────────────────   │
    │  1. Parse input with Zod validation                    │
    │  2. Query indexes:                                      │
    │     • Fuzzy search: name2ids lookup                    │
    │     • References: inEdges lookup                        │
    │     • Related: outEdges + inEdges                      │
    │     • Impact: parse diff → find symbols → neighbors    │
    │  3. Format response (JSON)                             │
    │  4. Emit Loki event (codegraph.query_*)                │
    │  5. Return to client                                    │
    └──────────────┬─────────────────────────────────────────┘
                   │
                   │  Result: Symbols/edges/metadata
                   │
                   ▼
         ┌──────────────────────────────────────┐
         │  Claude receives results              │
         │  • Top 20 symbols matching "auth"    │
         │  • With file paths and line ranges   │
         │  • Can request code snippets via     │
         │    code://file/{path}?s=10&e=50      │
         └──────────────────────────────────────┘
```

---

## 🧬 The Vector Clock Coordination Pattern

```
┌──────────────────────────────────────────────────────────────┐
│         HOW VECTOR CLOCKS UNIFY THE SYSTEM                    │
└──────────────────────────────────────────────────────────────┘

Every subsystem uses the SAME causality algorithm:

┌─────────────────────────────────────────────────────────────┐
│  reconcile.py::compare_vector_clocks(vc1, vc2)              │
│  ──────────────────────────────────────────────────────────  │
│  Returns: "before" | "after" | "concurrent" | "equal"       │
│                                                              │
│  Used by:                                                    │
│  1. NABIKernel      → Task ordering (heartbeat_sequence)    │
│  2. Document-FSM    → State transition causality            │
│  3. Agent D         → Event acknowledgment ordering         │
│  4. Aura System     → Personality version checkpoints       │
│  5. DAG-TUI         → Node version metadata                 │
│  6. codegraph       → Graph version tracking (can enhance)  │
└─────────────────────────────────────────────────────────────┘

Example: Agent D Event Acknowledgment (when implemented)

┌──────────────────────────────────────────────────────────────┐
│  Event Published                                              │
│  ├─ event_id: "evt_123"                                      │
│  ├─ vector_clock: {"agent_a": 5, "agent_b": 3}              │
│  └─ payload: { type: "code_change", file: "auth.ts" }       │
│         │                                                     │
│         │  Delivered via Agent C (SSE notification)          │
│         ▼                                                     │
│  Claude Session Receives Event                               │
│  ├─ Acknowledges via: nabi events ack evt_123               │
│  │                                                            │
│  │  CLI calls:                                                │
│  │  ├─ Load event vector_clock                               │
│  │  ├─ Load session vector_clock                             │
│  │  ├─ reconcile.py::compare_vector_clocks()                │
│  │  │   → Returns "after" (event causally precedes ack)     │
│  │  ├─ Advance session VC: {"agent_a": 5, "agent_b": 3,     │
│  │  │                        "session_x": 1}                 │
│  │  ├─ Store acknowledgment in SurrealDB (L2)               │
│  │  ├─ Record causal ancestors: [evt_122, evt_121]          │
│  │  └─ Emit: agent.event_acknowledged                       │
│  │                                                            │
│  └─→ Result: Causal ordering maintained across federation   │
└──────────────────────────────────────────────────────────────┘

This is architectural coherence: ONE algorithm, SIX use cases.
```

---

## 🎯 The Missing Piece: Intelligence Scorer

```
┌──────────────────────────────────────────────────────────────┐
│         LAYER 4: WHAT'S IMPORTANT NOW                         │
│         (NOT YET BUILT - BLOCKS EVERYTHING)                   │
└──────────────────────────────────────────────────────────────┘

Current State:
  Query nabi-mcp → Get 498 entities → All equal priority ❌

With Intelligence Layer:
  Query nabi-mcp → Score entities → Ranked by relevance ✅

┌─────────────────────────────────────────────────────────────┐
│  intelligence_scorer.py                                      │
│  ──────────────────────────────────────────────────────────  │
│  Input:                                                      │
│    • entities: List[Entity]                                 │
│    • context: { focus: "authentication", session_id: "..." }│
│                                                              │
│  Processing:                                                 │
│    For each entity:                                          │
│      1. Precedence (what matters NOW)                       │
│         • Session match: 50%                                │
│         • Recent access: 30%                                │
│         • Frequency: 20%                                    │
│                                                              │
│      2. Freshness (age-based decay)                         │
│         • <1 day: 1.0                                       │
│         • 1-7 days: linear 1.0 → 0.7                       │
│         • 7-30 days: exponential 0.7 → 0.3                 │
│         • >30 days: 0.1 (ghost)                            │
│                                                              │
│      3. Proximity (graph distance from focus)               │
│         • Direct connection: 1.0                            │
│         • 1-hop: 0.5                                        │
│         • 2-hop: 0.25                                       │
│         • >2-hop: 0.1                                       │
│                                                              │
│      4. Composite score                                     │
│         score = precedence * 0.4 +                          │
│                 freshness * 0.3 +                           │
│                 proximity * 0.3                             │
│                                                              │
│  Output:                                                     │
│    • entities (sorted by score, descending)                 │
│    • visual_properties: {                                   │
│        pulse_freq: 0.5 + (precedence * 2.0),               │
│        opacity: freshness,                                  │
│        size: 1.5 + (score * 2.5),                          │
│        color_saturation: score                              │
│      }                                                       │
└─────────────────────────────────────────────────────────────┘

Used by:
  • dag-tui        → Visual encoding (pulsing, fading, sizing)
  • Agent D        → Event priority queue
  • Sprint Summary → Relevance filtering
  • nabi-mcp       → Query result ranking

Estimated effort: 2-4 hours
Unlocks: 3+ downstream systems
```

---

## 🚀 Memory Efficiency Pattern

```
┌──────────────────────────────────────────────────────────────┐
│        TRADITIONAL: PER-SESSION MCP (WASTEFUL)                │
└──────────────────────────────────────────────────────────────┘

Session 1:  [MCP Server] ← 150 MB (graph loaded)
Session 2:  [MCP Server] ← 150 MB (duplicate!)
Session 3:  [MCP Server] ← 150 MB (duplicate!)
────────────────────────────────────────────────────
Total:      450 MB for 3 sessions

At 8 sessions:  1.2 GB wasted memory! ❌

┌──────────────────────────────────────────────────────────────┐
│        SSE PATTERN: SHARED BACKEND (EFFICIENT)                │
└──────────────────────────────────────────────────────────────┘

           [codegraph-sse @ port 8050]
                ↑ 150 MB (once)
                │
    ┌───────────┼───────────┬───────────┐
    │           │           │           │
Session 1    Session 2  Session 3  Session N
(10 MB)      (10 MB)    (10 MB)    (10 MB)
────────────────────────────────────────────────────
Total:      150 + (N × 10) MB

At 8 sessions:  230 MB (80% reduction!) ✅

This is why SSE pattern is used everywhere:
  • memchain-sse (proven, operational)
  • codegraph-sse (this repo, deployed)
  • Agent D SSE (planned)
```

---

## 📊 Current Completion Status

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM READINESS                                            │
├─────────────────────────┬───────────────────────────────────┤
│ Component               │ Status                            │
├─────────────────────────┼───────────────────────────────────┤
│ Layer 1: Sources        │ ✅ 100% (FSM, riff, git, events) │
│ Layer 2: Federation     │ ✅  90% (SSE, Agent C complete)  │
│ Layer 3: Knowledge      │ ✅  95% (nabi-mcp, codegraph OK) │
│ Layer 4: Intelligence   │ ❌   0% (MISSING - CRITICAL)     │
│ Layer 5: Visualization  │ ✅  70% (dag-tui foundation)     │
├─────────────────────────┼───────────────────────────────────┤
│ codegraph-mcp           │ ✅ 100% (Production ready)       │
│ Agent C → D bridge      │ ✅  70% (CLI glue missing)       │
│ Vector clock unity      │ ✅  95% (6 layers coordinated)   │
│ Memory efficiency       │ ✅ 100% (SSE pattern proven)     │
│ Federation integration  │ ✅  95% (XDG + Loki operational) │
└─────────────────────────┴───────────────────────────────────┘

OVERALL: 80% Complete

BLOCKING PIECES:
  1. Layer 4: intelligence_scorer.py (2-4 hours)
  2. Agent D: nabi events ack CLI (1 week)
```

---

## 🎯 Critical Path Forward

```
┌──────────────────────────────────────────────────────────────┐
│  OPTION A: Quick Win (30 minutes)                            │
├──────────────────────────────────────────────────────────────┤
│  Add pulsing animation to dag-tui                            │
│  → Demonstrates visual intelligence concept                  │
│  → Low effort, high impact                                   │
│  → User sees the magic immediately                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  OPTION B: Foundation (2-4 hours) ⭐ RECOMMENDED             │
├──────────────────────────────────────────────────────────────┤
│  Build intelligence_scorer.py                                │
│  → Unlocks Layer 4 (the brain of the system)                │
│  → Enables all downstream work                               │
│  → Reusable across 3+ systems                                │
│  → Fills the critical 5% architectural gap                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  OPTION C: Integration (8 hours)                             │
├──────────────────────────────────────────────────────────────┤
│  Connect dag-tui to nabi-mcp                                 │
│  → Full data pipeline working end-to-end                     │
│  → Requires Layer 4 intelligence scorer first                │
│  → Shows the complete vision                                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  OPTION D: Agent D (1 week)                                  │
├──────────────────────────────────────────────────────────────┤
│  Implement nabi events ack CLI                               │
│  → Completes Agent C → D bridge                              │
│  → Adds sixth vector clock coordination layer                │
│  → Full federation event system operational                  │
└──────────────────────────────────────────────────────────────┘
```

---

**Generated:** 2025-11-18
**Next:** Choose your path - what matters most right now?
