# Transport Mechanism Decision: SSE over Alternatives

**Date**: November 17, 2025
**Status**: Implemented and Deployed
**Decision**: Use SSE (Server-Sent Events) as the transport mechanism for the codegraph MCP server

## Context

The codegraph MCP server needs to support multiple concurrent agent sessions while maintaining shared state (graph registry, active graph selection). We evaluated several transport mechanisms for this multi-session architecture.

## Decision

**Chosen**: Server-Sent Events (SSE) over HTTP
- Single SSE server process running on `localhost:8050`
- Multiple MCP clients (Claude, Cursor) connect via `mcp-remote` proxy
- Shared graph state across all sessions

## Alternatives Considered

### 1. Docker Container Deployment
**Description**: Run SSE server in Docker container with persistent volumes
**Pros**:
- Isolated environment
- Consistent deployment
- Easy scaling
- XDG-compliant volume mounting

**Cons**:
- Docker credential issues on macOS
- Slower startup and debugging
- Additional complexity
- Resource overhead

**Why Rejected**: Setup complexity outweighed benefits for local development. Direct process execution is simpler and more maintainable.

### 2. File-Based Transport
**Description**: MCP clients write requests to temp files, server polls and responds via files
**Pros**:
- No networking required
- Atomic filesystem operations
- Simple to implement

**Cons**:
- Requires polling (inefficient)
- Race conditions and file locking issues
- Not a standard MCP transport
- Complex concurrency control
- No real-time capabilities

**Why Rejected**: Polling overhead and lack of MCP standard compliance made this unsuitable.

### 3. Unix Domain Sockets
**Description**: Use local Unix sockets for client-server communication
**Pros**:
- Fast local IPC
- Secure (local only)
- No port conflicts

**Cons**:
- Not a standard MCP transport
- Complex client-side socket management
- Permission management issues
- Not portable across systems
- Requires custom MCP client implementation

**Why Rejected**: Lack of MCP client support and portability issues.

### 4. WebSockets
**Description**: Bidirectional WebSocket communication
**Pros**:
- Bidirectional real-time communication
- Efficient for frequent updates
- Good for streaming

**Cons**:
- Overkill for request/response pattern
- More complex server implementation
- Requires WebSocket server
- Not a standard MCP transport
- Heavier protocol than needed

**Why Rejected**: Over-engineered for this use case; SSE provides sufficient real-time capabilities.

## Rationale

### Why SSE is Optimal

1. **MCP Standard Compliance**: SSE is a recognized MCP transport mechanism (Streamable HTTP), ensuring compatibility with existing MCP client tooling.

2. **Perfect Multi-Session Support**:
   - Single server process maintains shared state
   - All clients see same graph registry and active graph
   - Efficient memory usage (one graph instance vs per-session)

3. **HTTP-Based Simplicity**:
   - Works with existing `mcp-remote` proxy
   - No custom client implementations needed
   - Standard HTTP tooling for debugging

4. **Appropriate for Use Case**:
   - Code analysis is request/response oriented
   - Occasional real-time updates (graph changes, events)
   - Not requiring full bidirectional communication

### Current Implementation

**Server**: Direct Python process (`uv run codegraph-sse`)
- Fast startup and debugging
- Direct filesystem access
- Easy environment management

**Clients**:
- Claude Desktop: `mcp-remote` proxy to `http://localhost:8050/sse`
- Cursor: Direct HTTP connection to `http://localhost:8050/sse`

**State Management**:
- Global graph registry in `$XDG_STATE_HOME/nabi/codegraph/registry.json` (falls back to `~/.local/state/nabi/codegraph/registry.json`)
- Shared active graph across all sessions
- Persistent graph storage in XDG-compliant directories

## Consequences

### Positive
- ✅ Efficient multi-session support with shared state
- ✅ MCP standard compliant transport
- ✅ Simple deployment and debugging
- ✅ HTTP-based tooling compatibility
- ✅ Real-time event streaming capability

### Risks
- ⚠️ HTTP adds minor latency vs direct IPC
- ⚠️ Requires server process management
- ⚠️ SSE is unidirectional (server→client), suitable for this use case

## Implementation Details

```bash
# Server startup
cd ~/nabia/platform/codegraph-mcp
uv run codegraph-sse

# Health check
curl http://localhost:8050/health

# Graph management
curl http://localhost:8050/graphs                    # List available
curl -X POST http://localhost:8050/graphs/set-active \
  -H "Content-Type: application/json" \
  -d '{"id_or_path": "nabi-kernel"}'                 # Switch active graph
```

## Future Considerations

If the server needs to support:
- **High-frequency real-time updates**: Consider WebSockets
- **Cross-machine deployment**: Revisit Docker
- **Ultra-low latency**: Consider Unix sockets with custom MCP client

For current requirements (multi-session code analysis with shared state), SSE provides the optimal balance of functionality, standards compliance, and simplicity.

---

**Decision Made By**: Autonomous agent coordination
**Implemented In**: v0.2.0
**Last Reviewed**: November 17, 2025
