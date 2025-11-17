# Code Graph SSE - Agent Integration Guide

This guide explains how agents should interact with the SSE service instead of the direct MCP server.

## Overview

**Old Way**: Each agent gets its own MCP server instance
```
Agent → stdio → MCP Server (in-process)
```

**New Way**: All agents share one SSE service
```
Agent 1 → HTTP → codegraph-sse (port 8050)
Agent 2 → HTTP → codegraph-sse (port 8050)  ← Shared instance!
Agent 3 → HTTP → codegraph-sse (port 8050)
```

## Service URL

The codegraph-sse service runs at:
```
http://localhost:8050   (local development)
http://codegraph-sse:8050   (docker-compose network)
```

## API Endpoints

### 1. List Available Graphs

**Use this when**: You need to know what codebases are indexed

```bash
GET http://codegraph-sse:8050/graphs
```

**Response**:
```json
{
  "graphs": [
    {
      "id": "memchain",
      "path": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json",
      "target": "/home/user/nabia/memchain",
      "size": 70079,
      "timestamp": "2025-10-28T01:30:00Z"
    },
    {
      "id": "codegraph-mcp",
      "path": "/home/user/.local/state/nabi/codegraph/graphs/codegraph-mcp/graph.json",
      "target": "/home/user/mcp-servers/codegraph-mcp/src",
      "size": 196,
      "timestamp": "2025-10-27T22:30:00Z"
    }
  ],
  "current_active": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json"
}
```

**Example in agent code**:
```python
import httpx

async def list_indexed_codebases():
    async with httpx.AsyncClient() as client:
        response = await client.get("http://codegraph-sse:8050/graphs")
        graphs = response.json()["graphs"]
        return [g["id"] for g in graphs]
```

### 2. Index a New Codebase

**Use this when**: You want to analyze a codebase that hasn't been indexed yet

```bash
POST http://codegraph-sse:8050/graphs/ingest
Content-Type: application/json

{
  "target": "/path/to/codebase",
  "id": "my-project"  # Optional, defaults to directory name
}
```

**Response**:
```json
{
  "status": "queued",
  "target": "/path/to/codebase",
  "graph_id": "my-project",
  "message": "Ingestion queued, check /health or Loki for status"
}
```

**Notes**:
- Returns immediately while ingestion runs in background
- Check Loki for completion: `{job="codegraph-sse",event_type="ingest"}`
- Ingestion emits `codegraph.ingest_started` → `codegraph.ingest_success` events
- Graph is automatically activated when ingestion completes

**Example in agent code**:
```python
async def index_codebase(target_path: str, graph_id: str = None):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://codegraph-sse:8050/graphs/ingest",
            json={"target": target_path, "id": graph_id}
        )
        return response.json()
```

### 3. Set Active Graph

**Use this when**: You want to switch which codebase to analyze

```bash
POST http://codegraph-sse:8050/graphs/set-active
Content-Type: application/json

{
  "id_or_path": "memchain"  # Can be graph ID or full path
}
```

**Response**:
```json
{
  "status": "success",
  "active_graph": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json"
}
```

**Example in agent code**:
```python
async def switch_codebase(graph_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://codegraph-sse:8050/graphs/set-active",
            json={"id_or_path": graph_id}
        )
        if response.status_code == 200:
            return response.json()["active_graph"]
        else:
            raise ValueError(f"Failed to switch: {response.text}")
```

### 4. Execute Queries

**Use this when**: You want to analyze the code (resolve symbols, find references, etc.)

```bash
POST http://codegraph-sse:8050/query
Content-Type: application/json

{
  "tool": "graph_resolve_symbol",
  "params": {"q": "authenticate"}
}
```

**Response**:
```json
{
  "status": "success",
  "tool": "graph_resolve_symbol",
  "graph": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json",
  "results": [...]
}
```

**Supported tools** (from codegraph-mcp):
- `graph_resolve_symbol` - Fuzzy search for symbols
- `graph_references` - Find all references to a symbol
- `graph_related` - Find related symbols (neighbors)
- `graph_impact_from_diff` - Analyze impact of code changes

**Example in agent code**:
```python
async def find_symbols(query: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://codegraph-sse:8050/query",
            json={
                "tool": "graph_resolve_symbol",
                "params": {"q": query}
            }
        )
        return response.json()
```

### 5. Health Check

**Use this when**: You want to verify the service is available

```bash
GET http://codegraph-sse:8050/health
```

**Response**:
```json
{
  "status": "healthy",
  "service": "codegraph-sse",
  "version": "0.2.0",
  "timestamp": "2025-10-28T01:35:42.123456Z",
  "current_graph": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json"
}
```

### 6. Metrics

**Use this when**: You want to monitor service performance

```bash
GET http://codegraph-sse:8050/metrics
```

**Response**:
```json
{
  "service": "codegraph-sse",
  "uptime_seconds": 3600,
  "memory_mb": 234.5,
  "cpu_percent": 2.1,
  "graph_registry_size": 3,
  "active_graph": "/home/user/.local/state/nabi/codegraph/graphs/memchain/graph.json"
}
```

## Typical Agent Workflow

```python
import httpx
from datetime import datetime

class CodeGraphAgent:
    def __init__(self, service_url: str = "http://codegraph-sse:8050"):
        self.service_url = service_url
        self.client = httpx.AsyncClient()
        self.active_graph = None

    async def initialize(self):
        """Check service and list available graphs"""
        response = await self.client.get(f"{self.service_url}/health")
        assert response.status_code == 200, "Service unavailable"

        graphs = await self.client.get(f"{self.service_url}/graphs")
        self.available_graphs = graphs.json()["graphs"]

    async def analyze_codebase(self, graph_id: str, query: str):
        """Analyze a codebase"""
        # Switch to codebase if needed
        if self.active_graph != graph_id:
            await self.client.post(
                f"{self.service_url}/graphs/set-active",
                json={"id_or_path": graph_id}
            )
            self.active_graph = graph_id

        # Execute query
        response = await self.client.post(
            f"{self.service_url}/query",
            json={
                "tool": "graph_resolve_symbol",
                "params": {"q": query}
            }
        )

        return response.json()

    async def index_new_project(self, target_path: str, project_id: str = None):
        """Index a new project"""
        response = await self.client.post(
            f"{self.service_url}/graphs/ingest",
            json={"target": target_path, "id": project_id}
        )

        result = response.json()
        assert result["status"] == "queued"

        # Wait for completion via Loki or polling
        return result["graph_id"]
```

## Federation Integration

All agent operations are emitted as Loki events:

```
codegraph.ingest_started    - When indexing begins
codegraph.ingest_success    - When indexing completes
codegraph.query_*           - When queries are executed
codegraph.status_*          - Status changes
```

**Query Loki to see agent activity**:
```bash
curl 'http://localhost:3100/loki/api/v1/query_range?query={job="codegraph-sse"}'
```

## Error Handling

### Service Unavailable (503)

```python
try:
    response = await client.get("http://codegraph-sse:8050/health")
except httpx.ConnectError:
    print("codegraph-sse service is down")
    # Fallback to direct MCP or fail gracefully
```

### Graph Not Found (404)

```python
response = await client.post(
    "http://codegraph-sse:8050/graphs/set-active",
    json={"id_or_path": "nonexistent-graph"}
)

if response.status_code == 404:
    print("Graph not indexed yet, use /graphs/ingest first")
```

### No Active Graph (400)

```python
response = await client.post(
    "http://codegraph-sse:8050/query",
    json={"tool": "graph_resolve_symbol", "params": {"q": "foo"}}
)

if response.status_code == 400:
    # Set a graph first
    await client.post(
        "http://codegraph-sse:8050/graphs/set-active",
        json={"id_or_path": "memchain"}
    )
```

## Performance Notes

**Latency** (p99):
- Symbol resolution: <50ms
- Reference finding: <10ms
- Graph switching: <100ms (reloads in-memory indexes)
- Ingestion: 5-30s depending on codebase size

**Memory** (shared across agents):
- Service baseline: ~150 MB
- Per additional agent: ~10 MB (HTTP connection overhead)

**Throughput**:
- ~1000 queries/sec per tool
- Support for 50+ concurrent sessions

## Migration from Direct MCP

If you have existing code using direct MCP:

**Before** (stdio-based MCP):
```python
async with await open_stdio_mcp() as mcp:
    result = await mcp.call_tool("graph_resolve_symbol", q="authenticate")
```

**After** (HTTP-based SSE):
```python
async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://codegraph-sse:8050/query",
        json={"tool": "graph_resolve_symbol", "params": {"q": "authenticate"}}
    )
    result = response.json()
```

Benefits:
- ✅ Shared instance (60-80% memory reduction)
- ✅ Multi-codebase support (switch at runtime)
- ✅ Federation visibility (Loki events)
- ✅ Better monitoring (metrics endpoint)
- ✅ Scales to 8+ concurrent sessions

## Summary

| Task | Endpoint | Notes |
|------|----------|-------|
| List indexed graphs | `GET /graphs` | See what's available |
| Index new codebase | `POST /graphs/ingest` | Async, emits Loki events |
| Switch codebase | `POST /graphs/set-active` | For multi-project analysis |
| Query code | `POST /query` | Same tools as direct MCP |
| Check health | `GET /health` | Verify service is ready |
| Monitor metrics | `GET /metrics` | Memory, CPU, uptime |

---

**Learn More**: See `SSE_DEPLOYMENT.md` for deployment and architecture details.
