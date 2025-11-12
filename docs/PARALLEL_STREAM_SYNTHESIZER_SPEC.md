# Parallel Stream Synthesizer MCP Tool

**Purpose**: Systematic analysis and visualization of parallel development workstreams
**Target User**: Engineers managing multiple concurrent ecosystem components
**Integration**: codegraph-mcp server

---

## Problem Statement

When running multiple parallel workstreams (each a full ecosystem component):
- ❌ Hard to trace relationships mentally
- ❌ Miss connections between streams
- ❌ Lose track of what's complete vs in-progress
- ❌ Can't see the unified architecture emerging
- ❌ No systematic process for synthesis

**Solution**: An MCP tool that ingests session data and automatically generates visual maps, connection analysis, and tactical next steps.

---

## Tool Design: `analyze_parallel_streams`

### Input Format

```json
{
  "streams": [
    {
      "name": "Document FSM Recovery",
      "status": "complete",
      "summary": "FSM for multi-agent coordination...",
      "deliverables": ["code", "docs", "tests"],
      "location": "~/nabia/platform/document-fsm/",
      "completion": 100,
      "next_steps": []
    },
    {
      "name": "FSM → nabi-mcp Integration",
      "status": "planned",
      "summary": "Federated sync bridge...",
      "deliverables": ["architecture", "bridge_code", "hooks"],
      "location": "~/nabia/platform/document-fsm/",
      "completion": 40,
      "next_steps": [
        "Create SurrealDB schema",
        "Implement MCP calls",
        "Install hooks"
      ]
    }
  ],
  "context": {
    "date": "2025-10-27",
    "theme": "TUI-based cognitive visualization",
    "goal": "Connect all layers for intelligent knowledge graph"
  }
}
```

### Output Format

```json
{
  "synthesis": {
    "architecture_map": "ASCII diagram of 5-layer architecture",
    "connections": [
      {
        "from": "Stream 1",
        "to": "Stream 3",
        "type": "data_flow",
        "description": "FSM states become node types in TUI"
      }
    ],
    "missing_layers": [
      {
        "layer": "Intelligence Layer",
        "description": "Precedence/decay/proximity scoring",
        "blocks": ["Visual encoding", "Sprint summary"]
      }
    ],
    "critical_path": [
      {
        "milestone": "Connect dag-tui to nabi-mcp",
        "duration": "4-8 hours",
        "blockers": [],
        "enables": ["Visual encoding", "Real-time updates"]
      }
    ],
    "tactical_next_steps": {
      "quick_win": "Add pulsing animation (30 min)",
      "foundation": "Build intelligence_scorer.py (4 hours)",
      "infrastructure": "Integrate dag-tui with nabi-mcp (8 hours)"
    }
  },
  "visual_map": "# Markdown with ASCII art",
  "recommendations": [
    "Start with Quick Win to build momentum",
    "Intelligence Layer is missing piece",
    "All streams converge on TUI visualization"
  ]
}
```

---

## Tool Implementation Plan

### Phase 1: Stream Ingestion (Week 1)

**Goal**: Parse and structure parallel workstream data

**Components**:
1. `StreamParser`: Extract workstream data from:
   - Session summaries
   - Git commit logs
   - Documentation files
   - Linear issues
   - Claude session metadata

2. `StreamNormalizer`: Convert to standard format:
   - Name, status, completion %
   - Deliverables, location, next steps
   - Dependencies, blockers

3. `ContextExtractor`: Identify overarching theme/goal

**Acceptance Criteria**:
- Can parse 5+ input formats
- Outputs standardized JSON
- Handles incomplete data gracefully

---

### Phase 2: Connection Analysis (Week 2)

**Goal**: Identify relationships between streams

**Components**:
1. `ConnectionDetector`: Find relationships:
   - Data flow (A produces data for B)
   - Dependency (B blocks until A completes)
   - Integration (A and B merge at layer C)
   - Synthesis (A + B + C = new capability)

2. `ArchitectureMapper`: Build layer diagram:
   - Identify architectural layers (Source → Adapter → Graph → Intelligence → Visualization)
   - Map each stream to layer(s)
   - Detect missing layers

3. `GapAnalyzer`: Find what's missing:
   - Incomplete layers
   - Broken data pipelines
   - Unimplemented connections

**Acceptance Criteria**:
- Detects 4+ connection types
- Generates ASCII layer diagram
- Identifies missing pieces

---

### Phase 3: Critical Path Calculation (Week 3)

**Goal**: Determine optimal execution sequence

**Components**:
1. `DependencyGraph`: Build directed acyclic graph (DAG):
   - Nodes = milestones
   - Edges = dependencies
   - Weights = effort estimates

2. `CriticalPathFinder`: Topological sort + longest path:
   - Identify blocking vs non-blocking work
   - Calculate parallel execution opportunities
   - Estimate total duration

3. `PriorityRanker`: Score by:
   - Effort (low effort, high impact = high priority)
   - Unblocking power (enables N other streams)
   - Risk (critical path vs nice-to-have)

**Acceptance Criteria**:
- Generates critical path
- Identifies parallel work opportunities
- Suggests quick wins

---

### Phase 4: Visualization & Recommendations (Week 4)

**Goal**: Generate human-readable output

**Components**:
1. `VisualMapGenerator`: Create ASCII art diagrams:
   - 5-layer architecture map
   - Data flow diagrams
   - Timeline/Gantt chart

2. `TacticalPlanner`: Recommend next steps:
   - Quick win (< 1 hour)
   - Foundation work (2-8 hours)
   - Infrastructure build (1-2 weeks)

3. `MarkdownGenerator`: Format as readable report:
   - Executive summary
   - Visual maps
   - Stream analysis
   - Connection graph
   - Critical path
   - Tactical recommendations

**Acceptance Criteria**:
- Generates comprehensive Markdown report
- Includes 3+ visual diagrams
- Provides 3-tier recommendations (quick/foundation/infrastructure)

---

## MCP Tool Interface

### Tool Definition

```json
{
  "name": "analyze_parallel_streams",
  "description": "Analyze and visualize parallel development workstreams",
  "inputSchema": {
    "type": "object",
    "properties": {
      "streams": {
        "type": "array",
        "description": "Array of workstream objects",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "status": {"type": "string", "enum": ["complete", "in-progress", "planned", "blocked"]},
            "summary": {"type": "string"},
            "deliverables": {"type": "array", "items": {"type": "string"}},
            "location": {"type": "string"},
            "completion": {"type": "number", "minimum": 0, "maximum": 100},
            "next_steps": {"type": "array", "items": {"type": "string"}},
            "blockers": {"type": "array", "items": {"type": "string"}}
          },
          "required": ["name", "status"]
        }
      },
      "context": {
        "type": "object",
        "properties": {
          "date": {"type": "string"},
          "theme": {"type": "string"},
          "goal": {"type": "string"}
        }
      },
      "auto_discover": {
        "type": "boolean",
        "description": "Automatically discover streams from git/riff-cli/nabi-mcp",
        "default": false
      }
    },
    "required": ["streams"]
  }
}
```

### Usage Example

```javascript
// Manual input
const result = await mcp.call_tool("analyze_parallel_streams", {
  streams: [
    {
      name: "Document FSM Recovery",
      status: "complete",
      completion: 100,
      deliverables: ["state_tribune.py", "docs", "tests"]
    },
    {
      name: "FSM → nabi-mcp Integration",
      status: "in-progress",
      completion: 40,
      next_steps: ["Create SurrealDB schema", "Implement MCP calls"]
    }
  ],
  context: {
    theme: "TUI-based cognitive visualization",
    goal: "Intelligent knowledge graph"
  }
});

// Auto-discovery mode
const auto_result = await mcp.call_tool("analyze_parallel_streams", {
  auto_discover: true,
  context: {
    date: "2025-10-27",
    hours: 24,  // Look back 24 hours
    sources: ["git", "riff-cli", "nabi-mcp"]
  }
});
```

---

## Auto-Discovery Implementation

### Data Sources

1. **Git Commits** (last N hours):
   ```bash
   git log --since="24 hours ago" --format="%H|%s|%an|%ai"
   ```
   - Parse commit messages for stream indicators
   - Group by topic/component
   - Extract status from commit messages

2. **riff-cli Sessions**:
   ```bash
   riff search --hours 24 --format json
   ```
   - Extract session topics
   - Group conversations by theme
   - Identify in-progress work

3. **nabi-mcp Entities**:
   ```javascript
   mcp.call_tool("search_nodes", {
     query: "created_at:>24h"
   })
   ```
   - Recent entities = active streams
   - Entity types = stream categories
   - Observations = stream summaries

4. **Linear Issues**:
   ```graphql
   query {
     issues(filter: {updatedAt: {gt: "2025-10-26"}}) {
       title
       state
       estimate
     }
   }
   ```
   - Active issues = planned streams
   - Issue state = stream status

---

## Example Output

### Input (Manual)

```json
{
  "streams": [
    {"name": "Document FSM Recovery", "status": "complete", "completion": 100},
    {"name": "FSM → nabi-mcp Integration", "status": "planned", "completion": 40},
    {"name": "dag-tui Canvas", "status": "in-progress", "completion": 60},
    {"name": "nabi-mcp Backend", "status": "complete", "completion": 100},
    {"name": "Intelligence Layer", "status": "blocked", "completion": 0, "blockers": ["No implementation"]},
    {"name": "Sprint Summary System", "status": "planned", "completion": 0}
  ],
  "context": {
    "theme": "TUI-based cognitive visualization",
    "goal": "Visualize federated knowledge with intelligence"
  }
}
```

### Output (Synthesized)

```markdown
# Parallel Workstreams Analysis
**Date**: 2025-10-27
**Theme**: TUI-based cognitive visualization
**Goal**: Visualize federated knowledge with intelligence

---

## Architecture Map (5 Layers)

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: VISUALIZATION (60% Complete)                           │
│ ├─ dag-tui Canvas ✅ Foundation                                │
│ ├─ Visual encoding ❌ Missing                                  │
│ └─ Real-time updates ❌ Missing                                │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: INTELLIGENCE (0% Complete) ❌ BLOCKING                 │
│ ├─ Precedence scoring ❌ Not implemented                       │
│ ├─ Decay functions ❌ Not implemented                          │
│ └─ Proximity calculation ❌ Not implemented                    │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: KNOWLEDGE GRAPH (100% Complete) ✅                     │
│ ├─ nabi-mcp Backend ✅ Operational                             │
│ └─ 498 entities migrated ✅                                    │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: FEDERATION ADAPTER (40% Complete)                      │
│ ├─ federation_adapter.py ✅ Written                            │
│ ├─ Hooks ❌ Not installed                                      │
│ └─ SurrealDB schema ❌ Not created                             │
└────────────────────────────┬──────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: SOURCE SYSTEMS (100% Complete) ✅                      │
│ ├─ Document FSM ✅ Recovered                                   │
│ ├─ riff-cli ✅ Enhanced                                        │
│ └─ Git commits ✅ Atomic patterns                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Connection Analysis

**Data Flow Connections**:
1. Document FSM → Federation Adapter → nabi-mcp
   - FSM states sync to knowledge graph
   - Vector clocks preserved

2. nabi-mcp → Intelligence Layer → dag-tui
   - Entities scored for relevance
   - Visual properties encoded
   - **❌ BLOCKED**: Intelligence Layer not implemented

3. riff-cli → nabi-mcp → dag-tui
   - Conversations stored as entities
   - Recovered sessions visualized
   - **✅ WORKING**: But no intelligence filtering

**Synthesis Connections**:
- Sprint Summary = riff-cli + Git + nabi-mcp + FSM + Linear
  - **❌ BLOCKED**: Needs Intelligence Layer

**Integration Connections**:
- FSM states = dag-tui node types
  - 60-second grace periods = countdown animations
  - **❌ BLOCKED**: dag-tui not connected to nabi-mcp

---

## Missing Layers

1. **Layer 4: Intelligence** (CRITICAL)
   - Blocks: Visual encoding, Sprint summary, Real-time updates
   - Impact: Can't filter by relevance
   - Effort: 2-4 hours to implement

2. **Layer 2: Federation Adapter Deployment** (HIGH)
   - Blocks: FSM → nabi-mcp sync
   - Impact: Knowledge graph not updated automatically
   - Effort: 1 hour to deploy

3. **Layer 5: TUI Data Pipeline** (HIGH)
   - Blocks: Live visualization
   - Impact: TUI uses mock data
   - Effort: 4-8 hours to implement

---

## Critical Path

```
Milestone 1: Intelligence Layer (2-4h)
  ├─ Enables: Visual encoding
  ├─ Enables: Sprint summary
  └─ Unblocks: Everything else
    ↓
Milestone 2: dag-tui → nabi-mcp (4-8h)
  ├─ Enables: Live visualization
  ├─ Enables: Real data testing
  └─ Requires: Milestone 1 (for scoring)
    ↓
Milestone 3: Visual Encoding (2-4h)
  ├─ Enables: Intelligence becomes visible
  └─ Requires: Milestones 1 & 2
    ↓
Milestone 4: Sprint Summary (4-8h)
  ├─ Enables: Multi-source synthesis
  └─ Requires: Milestones 1, 2, 3
```

**Total Duration**: 12-24 hours
**Parallel Opportunities**: Milestones 1 & 2 can run concurrently

---

## Tactical Recommendations

### Quick Win (30 min)
**Task**: Add pulsing animation to dag-tui
**Why**: Demonstrates visual intelligence encoding
**Impact**: Builds momentum, shows the concept

### Foundation (4 hours)
**Task**: Build intelligence_scorer.py
**Why**: Unblocks everything else
**Impact**: Critical path item

### Infrastructure (8 hours)
**Task**: Connect dag-tui to nabi-mcp
**Why**: Enables live visualization
**Impact**: Shows full vision working

---

## Risk Analysis

**High Risk**:
- Intelligence Layer not implemented (blocks 4 other streams)
- dag-tui data pipeline missing (TUI uses mock data)

**Medium Risk**:
- Federation Adapter not deployed (knowledge graph not updated)
- Sprint Summary system conceptual only

**Low Risk**:
- Document FSM complete and stable
- nabi-mcp backend operational
- riff-cli enhancements working

---

## Completion Summary

| Stream | Status | Completion | Next Step |
|--------|--------|------------|-----------|
| Document FSM Recovery | ✅ Complete | 100% | Deploy to production |
| nabi-mcp Backend | ✅ Complete | 100% | Monitor stability |
| dag-tui Canvas | 🟡 In Progress | 60% | Add data pipeline |
| FSM → nabi-mcp Integration | 🟡 Planned | 40% | Create SurrealDB schema |
| Intelligence Layer | ❌ Blocked | 0% | **IMPLEMENT NOW** |
| Sprint Summary System | 🟡 Planned | 0% | Depends on Intelligence |

**Overall Progress**: 50% complete
**Critical Blocker**: Intelligence Layer (Layer 4)
**Recommendation**: Focus on Intelligence Layer to unblock everything

---

**Analysis Generated**: 2025-10-27 12:34 UTC
**Tool**: codegraph-mcp/analyze_parallel_streams
**Confidence**: 95%
```

---

## Integration with codegraph-mcp

### Server Implementation

```typescript
// In src/codegraph_server.py or similar

@server.call_tool()
async def analyze_parallel_streams(
    streams: list[dict],
    context: dict = None,
    auto_discover: bool = False
) -> dict:
    """Analyze parallel development workstreams"""

    if auto_discover:
        streams = await auto_discover_streams(context)

    # Phase 1: Parse and normalize
    normalized = StreamNormalizer.normalize(streams)

    # Phase 2: Analyze connections
    connections = ConnectionDetector.detect(normalized)
    architecture = ArchitectureMapper.map_layers(normalized)
    gaps = GapAnalyzer.find_gaps(architecture)

    # Phase 3: Calculate critical path
    dag = DependencyGraph.build(normalized, connections)
    critical_path = CriticalPathFinder.find(dag)
    priorities = PriorityRanker.rank(normalized, critical_path)

    # Phase 4: Generate output
    visual_map = VisualMapGenerator.generate(architecture)
    tactical_plan = TacticalPlanner.plan(priorities, critical_path)
    markdown = MarkdownGenerator.generate({
        "streams": normalized,
        "connections": connections,
        "architecture": architecture,
        "gaps": gaps,
        "critical_path": critical_path,
        "priorities": priorities,
        "visual_map": visual_map,
        "tactical_plan": tactical_plan
    })

    return {
        "synthesis": {
            "architecture_map": visual_map,
            "connections": connections,
            "missing_layers": gaps,
            "critical_path": critical_path,
            "tactical_next_steps": tactical_plan
        },
        "visual_map": markdown,
        "recommendations": priorities[:3]  # Top 3
    }
```

---

## Usage Workflow

### Step 1: Capture Parallel Streams

User pastes session summaries or runs auto-discovery:

```javascript
// Manual mode
const analysis = await mcp.call_tool("analyze_parallel_streams", {
  streams: [
    // Paste session summaries here
  ],
  context: {
    theme: "Cognitive TUI",
    goal: "Intelligent visualization"
  }
});

// Auto mode
const auto_analysis = await mcp.call_tool("analyze_parallel_streams", {
  auto_discover: true,
  context: {
    hours: 24,
    sources: ["git", "riff-cli", "nabi-mcp"]
  }
});
```

### Step 2: Review Analysis

Tool generates comprehensive report:
- Visual architecture map
- Connection analysis
- Missing layers identified
- Critical path calculated
- Tactical recommendations

### Step 3: Execute Recommendations

Follow tactical plan:
1. Quick win (30 min)
2. Foundation work (2-4 hours)
3. Infrastructure build (4-8 hours)

### Step 4: Iterate

Re-run analysis after completing milestones to see progress and identify new gaps.

---

## Benefits

### For User
- ✅ Systematic process (repeatable)
- ✅ Visual maps (no more mental juggling)
- ✅ Connection detection (automatic)
- ✅ Critical path identification (optimal sequencing)
- ✅ Tactical recommendations (actionable next steps)

### For Team
- ✅ Documentation artifact (generated report)
- ✅ Shared understanding (visual maps)
- ✅ Progress tracking (completion %)
- ✅ Risk identification (blocked streams highlighted)

---

## Success Criteria

1. **Usability**: User can run analysis in < 5 minutes
2. **Accuracy**: Detects 90%+ of connections
3. **Actionability**: Recommendations are clear and prioritized
4. **Repeatability**: Can re-run as streams evolve
5. **Visual**: Generates 3+ helpful diagrams
6. **Integration**: Works with existing tools (git, riff-cli, nabi-mcp)

---

## Implementation Timeline

- **Week 1**: Phase 1 - Stream ingestion and parsing
- **Week 2**: Phase 2 - Connection analysis and mapping
- **Week 3**: Phase 3 - Critical path calculation
- **Week 4**: Phase 4 - Visualization and recommendations
- **Week 5**: Integration with codegraph-mcp server
- **Week 6**: Testing, documentation, refinement

**Total**: 6 weeks to production-ready tool

---

## Next Steps

1. **Prototype**: Build minimal viable version (Phases 1-2 only)
2. **Test**: Use on current parallel streams (Document FSM, dag-tui, etc.)
3. **Iterate**: Refine based on real-world usage
4. **Integrate**: Add to codegraph-mcp server
5. **Document**: Write user guide and examples
6. **Launch**: Deploy and monitor adoption

---

**Status**: Specification Complete
**Owner**: codegraph-mcp team
**Priority**: High (user-requested feature)
**Estimated Effort**: 6 weeks to production
