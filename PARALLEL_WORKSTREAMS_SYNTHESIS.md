# Parallel Workstreams Synthesis: The Cognitive Federation TUI

**Date**: October 27, 2025
**Session Analysis**: Mapping parallel development streams and their convergence

---

## Executive Summary: What You Actually Built

You didn't build separate systems - you built **layers of a unified cognitive architecture** where the TUI is the sensory cortex for federated knowledge visualization.

**The Central Insight**: Everything resolves around the TUI because the TUI is where **intelligence becomes visible**.

---

## Visual Architecture Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 5: VISUALIZATION                       │
│                    (The Sensory Cortex)                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  dag-tui (Cognitive Interface)                            │   │
│  │  ├─ Canvas rendering ✅                                   │   │
│  │  ├─ Node symbols & colors ✅                              │   │
│  │  ├─ Rotation animation ✅                                 │   │
│  │  ├─ Data pipeline from Layer 3 ❌ MISSING                │   │
│  │  └─ Visual encoding of Layer 4 ❌ MISSING                │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ↓ [Intelligence Scoring]
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 4: INTELLIGENCE (MISSING) ❌                  │
│                   (The Prefrontal Cortex)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  intelligence_scorer.py (NOT YET BUILT)                   │   │
│  │  ├─ Precedence scoring (what matters NOW)                 │   │
│  │  ├─ Decay functions (what's stale)                        │   │
│  │  └─ Relational proximity (what's connected)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ↓ [Query & Filter]
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 3: KNOWLEDGE GRAPH (Memory)                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  nabi-mcp (SurrealDB) ✅ OPERATIONAL                      │   │
│  │  ├─ 498 entities migrated                                 │   │
│  │  ├─ Recovery entities queryable                           │   │
│  │  ├─ Semantic relationships preserved                      │   │
│  │  └─ Backend: ws://localhost:8284/rpc                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ↓ [Async Sync]
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 2: FEDERATION ADAPTER (Bridge)                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  federation_adapter.py ✅ WRITTEN, NOT DEPLOYED           │   │
│  │  ├─ FSM → nabi-mcp synchronization                        │   │
│  │  ├─ Vector clock preservation                             │   │
│  │  ├─ Non-blocking hooks                                    │   │
│  │  └─ post_fsm_transition.sh ✅ READY                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ↓ [Event Streams]
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 1: SOURCE SYSTEMS (Sensory Inputs)              │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Document FSM ✅ │  │ riff-cli ✅  │  │ Git commits ✅   │   │
│  │ State           │  │ Enhanced     │  │ Atomic           │   │
│  │ transitions     │  │ recovery     │  │ patterns         │   │
│  └─────────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────┐                          │
│  │ Linear issues   │  │ Loki events  │                          │
│  │ Sprint tracking │  │ Federation   │                          │
│  └─────────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workstream Analysis: What Was Built Yesterday

### Workstream 1: Document State Tribune Recovery ✅ COMPLETE

**What**: FSM for multi-agent documentation coordination
**Status**: 100% recovered and integrated
**Location**: `~/nabia/platform/document-fsm/`

**Deliverables**:
- ✅ 7/7 recovery tasks completed
- ✅ 44 KB of code migrated from orphaned location
- ✅ XDG-compliant configuration
- ✅ 3,800+ lines of documentation
- ✅ 18/18 unit tests passing
- ✅ Tool registration with nabi system

**FSM States** (these become node types in TUI):
```
embryonic → drafting → stabilizing → validating →
transformable → transforming → published
```

**Key Feature**: 60-second grace periods for multi-agent coordination
**TUI Integration Potential**: Grace periods can become visual countdown animations!

---

### Workstream 2: Document FSM → nabi-mcp Integration 📋 PLANNED

**What**: Federated synchronization bridge
**Status**: Phase 1 complete (architecture & documentation)
**Location**: `~/nabia/platform/document-fsm/`

**Architecture**:
```
FSM State Files (Source of Truth)
  ↓ [post_fsm_transition hook]
Federation Adapter (Bridge)
  ↓ [async, non-blocking]
nabi-mcp SurrealDB (Derived Cache)
  ↓ [Vector clocks preserved]
Loki Events (Federation Bus)
```

**Phase 1 Deliverables** (✅ Complete):
1. `_MCP_INTEGRATION_INDEX.md` - Quick reference
2. `NABI_MCP_IMPLEMENTATION_SUMMARY.md` - Step-by-step HOW-TO
3. `NABI_MCP_INTEGRATION.md` - Detailed architecture
4. `federation_adapter.py` - Bridge implementation (stubs)
5. `HOOK_TEMPLATE.sh` - Post-transition hook template

**Phase 2 Requirements** (⏳ Next):
1. Create SurrealDB schema (`document_workflows`, `state_transitions`)
2. Implement actual MCP calls in federation_adapter.py
3. Install post_fsm_transition hook to `~/.config/nabi/governance/hooks/`
4. Test end-to-end integration

**Estimated Effort**: 1 week for Phase 2

---

### Workstream 3: Enhanced riff-cli Recovery ✅ OPERATIONAL

**What**: Improved conversation DAG recovery and search
**Status**: Operational with reliability improvements
**Integration**: Feeds data into nabi-mcp knowledge graph

**Key Features**:
- Intent-based semantic search: `riff search --intent 'TUI/enhance'`
- Direct tmux window recovery: `ccr UUID`
- Session portability across directory moves
- Recovery pattern: search → browse → recover → continue

**Knowledge Graph Entities** (verified via `query recovery`):
1. "Atomic Commits - Recovery Enhancement Wave" (37 commits)
2. "Riff TUI Enhancement - Session Recovery Path"
3. "Session Recovery Enhancement - 2025-10-26"

**TUI Integration**: riff-cli outputs JSONL that dag-tui can visualize

---

### Workstream 4: nabi-mcp SurrealDB Backend ✅ OPERATIONAL

**What**: Knowledge graph with semantic entities
**Status**: Operational, 498 entities migrated
**Backend**: ws://localhost:8284/rpc

**Capabilities**:
- ✅ Full-text search across entities
- ✅ Recovery workflow patterns stored
- ✅ Semantic relationships (not just keywords)
- ✅ Commit narratives with session IDs
- ✅ Atomic action observations

**Missing**: Intelligence filtering layer (precedence, decay, proximity)

**Key Insight**: The graph has the data; it needs scoring algorithms to filter by relevance.

---

### Workstream 5: dag-tui Canvas Visualization ✅ FOUNDATION COMPLETE

**What**: Animated graph visualization TUI
**Status**: Foundation complete, data pipeline missing
**Location**: `~/nabia/tui/production/dag-tui/`

**Implemented** (✅):
- Canvas-based rendering
- Node symbols (○ □ ◇ △ ●) with colors
- Rotation animation (2D trigonometry)
- Navigation (j/k, arrow keys)
- Selection highlighting

**Missing** (❌):
- Data loader from nabi-mcp
- Intelligence scoring integration
- Visual encoding of scores (pulsing, opacity, size)
- FSM state countdown animations
- Real-time updates from knowledge graph

**Current State**: Visualizes mock data, animations work, no live data pipeline

---

### Workstream 6: Sprint Summary System 📋 DESIGNED, NOT IMPLEMENTED

**What**: Multi-source synthesis engine
**Status**: Conceptually designed, not built
**Proposed Command**: `nabi sprint summary --date 2025-10-26 --repos riff-cli,nabi-cli,memchain`

**Input Sources**:
- riff-cli: Conversation histories
- Git: Commit logs with atomic patterns
- nabi-mcp: Knowledge graph entities
- Document FSM: State transition logs
- Linear: Sprint issues and tasks

**Processing** (would use Layer 4 intelligence):
- Precedence: What was worked on most recently/intensely
- Decay: Filter out stale conversations from last week
- Proximity: Group related work (e.g., auth recovery entities cluster)

**Output Formats**:
- Markdown summary for documentation
- JSONL for dag-tui visualization
- Loki events for federation
- Linear issue synthesis

**Integration Point**: This would be the primary use case for the complete 5-layer architecture!

---

## The Missing Piece: Layer 4 Intelligence

### Why It Matters

Right now, querying nabi-mcp returns ALL matching entities:
- `query recovery` → 3 recovery entities (all relevant)

But imagine you're debugging an authentication issue:
- ❌ Recovery entities from last week rank equally
- ❌ Auth-related recovery should rank higher
- ❌ No visual indication of what's connected to current work

**The intelligence layer would filter and score**:
- ✅ Auth recovery entities → high precedence (pulsing, bright, large)
- ✅ Recovery from last week → decayed (fading, transparent)
- ✅ Related workflows → spatial clustering (close together)

### Intelligence Scoring Algorithm (Proposed)

```python
def score_entities(entities, context):
    """Score entities for visual encoding"""

    for entity in entities:
        # 1. Precedence (what matters NOW)
        precedence = (
            session_match(entity, context) * 0.5 +
            recent_access(entity) * 0.3 +
            frequency(entity) * 0.2
        )

        # 2. Decay (what's stale)
        age = now() - entity.created_at
        if age < 1_day:
            freshness = 1.0
        elif age < 7_days:
            freshness = linear_decay(1.0, 0.7, age)
        elif age < 30_days:
            freshness = exponential_decay(0.7, 0.3, age)
        else:
            freshness = 0.1

        # 3. Proximity (what's connected)
        proximity = graph_distance(entity, context.selected_node) ** -1

        # 4. Composite score
        entity.intelligence_score = (
            precedence * 0.4 +
            freshness * 0.3 +
            proximity * 0.3
        )

    return entities
```

### Visual Encoding Strategy

Map intelligence scores to animation properties:

| Score Component | Visual Property | Formula |
|-----------------|----------------|---------|
| **Precedence** | Pulse frequency | `0.5 + (score * 2.0)` Hz |
| **Freshness** | Opacity | `score` (1.0 = solid, 0.1 = ghost) |
| **Composite** | Size | `1.5 + (score * 2.5)` radius |
| **Proximity** | Spatial layout | Force-directed with proximity as spring |
| **Relevance** | Color saturation | `base_color * score` |

**Result**: A living, breathing knowledge graph where important information **literally jumps out at you**.

---

## How Everything Connects: The Data Flow

### End-to-End Pipeline (When Complete)

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Data Collection (Continuous)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Document FSM State Transition                                   │
│    ↓                                                              │
│  post_fsm_transition hook fires                                  │
│    ↓                                                              │
│  federation_adapter.py executes (async)                          │
│    ↓                                                              │
│  nabi-mcp entity created (with vector clock)                     │
│    ↓                                                              │
│  Loki event emitted (federation bus)                             │
│                                                                   │
│  [Parallel streams from riff-cli, git, Linear...]                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Query & Scoring (On-Demand)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User runs: dag-tui --source nabi-mcp --context "sprint 6A"     │
│    ↓                                                              │
│  dag-tui queries nabi-mcp via MCP                                │
│    ↓                                                              │
│  Gets 498 entities matching context                              │
│    ↓                                                              │
│  Passes to intelligence_layer.score()                            │
│    ↓                                                              │
│  Receives scored entities with visual properties                 │
│    ↓                                                              │
│  Renders in Canvas with animations                               │
│    • Pulsing = precedence                                        │
│    • Opacity = decay                                             │
│    • Size = importance                                           │
│    • Layout = proximity                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Real-Time Updates (Live)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Every 200ms tick:                                               │
│    ↓                                                              │
│  Check nabi-mcp for new entities                                 │
│    ↓                                                              │
│  Recalculate intelligence scores (precedence changes!)           │
│    ↓                                                              │
│  Update visual properties                                        │
│    ↓                                                              │
│  Animate transitions smoothly                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Interactive Exploration                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User navigates (j/k) → Selected node changes                    │
│    ↓                                                              │
│  Proximity scores recalculate (graph distance from new node)     │
│    ↓                                                              │
│  Nodes rearrange spatially (force-directed layout)               │
│    ↓                                                              │
│  Related entities highlight/pulse                                │
│    ↓                                                              │
│  User drills down into entity details (right pane)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Document FSM Integration Pattern

### Why This Is Exciting

The Document FSM states are **literally node types** for document entities in dag-tui!

### FSM States → Visual Animations

| FSM State | Transition | Visual Encoding |
|-----------|------------|-----------------|
| `embryonic` | Document created | Fade in (new entity) |
| `embryonic → drafting` | First edit | Color change, pulse starts |
| `drafting → stabilizing` | 5 sec inactivity | **60-second countdown begins!** |
| `stabilizing → validating` | Grace period expired | Pulse faster, color → yellow |
| `validating → transformable` | Validation passed | Color → green, grow larger |
| `transformable → transforming` | Processing | Spinning animation |
| `transforming → published` | Complete | Fade to archive opacity |

### The 60-Second Grace Period Visualization

This is where it gets really cool:

```rust
// In dag-tui rendering loop
if node.state == "stabilizing" {
    let elapsed = now - node.transition_time;
    let remaining = 60.0 - elapsed;
    let urgency = 1.0 - (remaining / 60.0);

    // Pulse faster as deadline approaches
    let pulse_freq = 0.5 + (urgency * 2.0); // 0.5 Hz → 2.5 Hz
    let radius = 2.0 + 1.0 * (elapsed * pulse_freq).sin().abs();

    // Color shifts: blue → yellow → red
    let color = interpolate_color(BLUE, RED, urgency);

    // Draw urgency indicator
    canvas.draw_circle(x, y, radius, color);
}
```

**Result**: You can **literally watch** the multi-agent coordination happening in real-time!

---

## Implementation Roadmap: The Critical Path

### Milestone 1: Connect dag-tui to nabi-mcp (FOUNDATIONAL)

**Duration**: 4-8 hours
**Blockers**: None
**Dependencies**: nabi-mcp operational (✅ done)

**Tasks**:
1. Add nabi-mcp MCP client to dag-tui's `Cargo.toml`
2. Create data loader module that queries nabi-mcp
3. Map nabi-mcp entity structure → dag-tui NodeData
4. Test: dag-tui renders actual knowledge graph entities

**Acceptance Criteria**:
- dag-tui loads real entities from SurrealDB
- Node types map correctly (Work, Feature, Architecture, etc.)
- Relationships render as edges
- Navigation works with real data

---

### Milestone 2: Implement Intelligence Layer (CORE VALUE)

**Duration**: 2-4 hours
**Blockers**: None
**Dependencies**: None (standalone module)

**Tasks**:
1. Create `intelligence_scorer.py` module
2. Implement precedence scoring algorithm
3. Implement decay function (age-based)
4. Implement proximity calculation (graph distance)
5. Expose: `score_entities(entities, context) → scored_entities`
6. Unit tests with real nabi-mcp data

**Acceptance Criteria**:
- Scores range 0.0-1.0 for all entities
- Precedence scores favor recent/relevant entities
- Decay function works correctly for age ranges
- Proximity scores reflect graph distance

---

### Milestone 3: Visual Encoding (THE MAGIC)

**Duration**: 2-4 hours
**Blockers**: Milestone 1 (needs real data)
**Dependencies**: Milestone 2 (needs scores)

**Tasks**:
1. Add pulsing animation (frequency = f(precedence))
2. Add opacity/alpha (alpha = f(decay))
3. Add size scaling (radius = f(composite_score))
4. Add color saturation (saturation = f(relevance))
5. Test: High-score entities visually dominate

**Acceptance Criteria**:
- Important entities pulse faster
- Stale entities fade to ghostly transparency
- Relevant entities are larger and more saturated
- Visual hierarchy is immediately obvious

---

### Milestone 4: Sprint Summary Integration (SYNTHESIS)

**Duration**: 4-8 hours
**Blockers**: Milestone 2 (needs intelligence layer)
**Dependencies**: riff-cli, git logs, Linear API

**Tasks**:
1. Create `nabi sprint summary` command
2. Query multiple sources (riff-cli, git, nabi-mcp, FSM, Linear)
3. Build unified graph (conversations ← commits ← documents ← issues)
4. Score with intelligence layer
5. Export JSONL for dag-tui
6. Test: Sprint visualization shows work topology

**Acceptance Criteria**:
- Command generates JSONL from multiple sources
- Graph shows relationships between commits, conversations, tasks
- Intelligence layer ranks entities appropriately
- dag-tui visualizes the entire sprint's work

---

### Milestone 5: Real-Time Updates (LIVE SYSTEM)

**Duration**: 2-4 hours
**Blockers**: Milestones 1-3 (needs full pipeline)
**Dependencies**: WebSocket or polling mechanism

**Tasks**:
1. Add polling to dag-tui for new nabi-mcp entities
2. Implement smooth property transitions (interpolation)
3. Cache scored entities with TTL
4. Test: Live changes visible without restart

**Acceptance Criteria**:
- New entities appear in TUI within 200ms
- Property changes animate smoothly
- No performance degradation over time
- Cache invalidation works correctly

---

## Immediate Next Steps: Choose Your Path

### Option A: Quick Win (30 minutes) - RECOMMENDED FOR MOMENTUM

**Goal**: Demonstrate visual intelligence encoding

**Task**: Add pulsing animation to dag-tui

```rust
// In rendering loop, add:
let pulse = (elapsed * 1.0).sin().abs();
let radius = if node.is_selected() {
    3.0 + pulse
} else {
    2.0
};
```

**Why This First**:
- ✅ Immediate visual feedback
- ✅ Teaches the pattern for encoding intelligence
- ✅ User sees the concept working
- ✅ Low effort, high impact

---

### Option B: Foundation (2-4 hours) - STRATEGIC

**Goal**: Build the brain of the system

**Task**: Implement `intelligence_scorer.py` module

```python
# Create standalone module
# Implement precedence, decay, proximity algorithms
# Test with real nabi-mcp data
# Make reusable for sprint summary system
```

**Why Second**:
- ✅ Enables all downstream work
- ✅ Standalone, testable component
- ✅ Can be used by sprint summary system
- ✅ Foundation for visual encoding

---

### Option C: Integration (4-8 hours) - INFRASTRUCTURE

**Goal**: Connect dag-tui to real data

**Task**: Add nabi-mcp MCP client to dag-tui

```rust
// Add to Cargo.toml: mcp-client = "..."
// Create data loader
// Map entities to NodeData
// Test with live SurrealDB
```

**Why Third**:
- ✅ Unlocks everything downstream
- ✅ Enables real-world testing
- ✅ Shows the full vision
- ✅ Critical dependency for Milestones 3-5

---

## Recommended Sequence

### Session 1 (Today, 30 min): Quick Win
- Add pulsing animation to dag-tui
- See the concept working immediately
- Builds momentum and confidence

### Session 2 (Tomorrow, 4 hours): Foundation
- Build intelligence_scorer.py
- Test with real nabi-mcp entities
- Validate scoring algorithms make sense

### Session 3 (Next, 8 hours): Integration
- Connect dag-tui to nabi-mcp
- Implement visual encoding (Milestone 3)
- See the full pipeline working

### Session 4+ (Future): Synthesis
- Sprint summary system (Milestone 4)
- Real-time updates (Milestone 5)
- FSM state countdown animations

**Total Time to Full System**: ~12-16 hours of focused work

---

## The End-State Vision: Cognitive Visualization

When complete, you'll have a **living, breathing knowledge graph** where you can:

### SEE What's Important NOW
- Bright, pulsing, large nodes = high precedence
- Color-coded by type (Work, Feature, Architecture)
- Size reflects composite intelligence score

### FEEL What's Connected to Your Work
- Spatially clustered = high relational proximity
- Force-directed layout groups related entities
- Selected node becomes center of attention

### WATCH Knowledge Decay in Real-Time
- Fading nodes = stale entities (30+ days)
- Transparent ghosts = archived knowledge
- Opacity reflects freshness score

### OBSERVE Multi-Agent Coordination
- FSM state countdown animations (60-second grace periods)
- Pulse frequency increases as deadlines approach
- Color shifts (blue → yellow → red) show urgency

### EXPLORE the Federation's Collective Memory
- Navigate graph with j/k keys
- Drill down into entity details
- Follow relationships between commits, conversations, tasks
- Search and filter by context

---

## Why This Is NextGen Cognitive Tooling

This isn't just viewing data - it's **experiencing intelligence**.

### Traditional Tools
- Static dashboards
- Manual filtering
- No temporal awareness
- No spatial encoding
- No intelligence layer

### Your Cognitive Federation TUI
- ✅ Dynamic, living visualization
- ✅ Automatic relevance filtering
- ✅ Temporal decay (freshness matters)
- ✅ Spatial clustering (proximity matters)
- ✅ Intelligence layer (precedence matters)
- ✅ Real-time updates (always current)
- ✅ Multi-source synthesis (complete picture)

**Result**: You don't just see the data - you **experience the intelligence** of the federation.

---

## Summary: The Coherence You're Sensing

What you built yesterday forms a **complete cognitive architecture**:

1. **Perception Layer** (riff-cli): Extract patterns from conversations
2. **Memory Layer** (nabi-mcp): Store entities in knowledge graph
3. **Coordination Layer** (Document FSM): Manage multi-agent workflows
4. **Intelligence Layer** (NOT YET BUILT): Score and filter
5. **Visualization Layer** (dag-tui): Render cognitive state

**The missing piece**: Layer 4 (Intelligence) - the prefrontal cortex that decides what matters NOW.

**The coherence you sense**: Every layer was designed to support the others. The TUI is the sensory cortex where **intelligence becomes visible**.

---

## Next Action: Choose Your Path

Which milestone do you want to tackle first?

**A. Quick Win (30 min)**: Add pulsing animation - see the magic
**B. Foundation (4 hours)**: Build intelligence_scorer.py - the brain
**C. Integration (8 hours)**: Connect dag-tui to nabi-mcp - full pipeline
**D. Strategy (discuss)**: Review and plan the full roadmap

What's your priority? 🎯
