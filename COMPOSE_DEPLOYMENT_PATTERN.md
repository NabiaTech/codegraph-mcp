# Multi-Compose-File Deployment Pattern

## Overview

Your federation uses **multiple docker-compose files in different directories** that share a common network (`nabi-net`). This guide explains the pattern and best practices.

## Architecture

```
~/nabia/memchain/
├── docker-compose.sse.yml         ← memchain-sse + memchain-loki
├── docker-compose.coordination.yml ← SurrealDB, Redis, etc.
└── ...

~/mcp-servers/codegraph-mcp/
├── docker-compose.sse.yml         ← codegraph-sse
└── ...

Network: nabi-net (shared, external)
```

## Key Principle: External Network

All compose files reference the same **external network** that's created once:

```bash
# Create the shared network (do this once)
docker network create nabi-net
```

Then each compose file defines it as external:

```yaml
# ~/nabia/memchain/docker-compose.sse.yml
networks:
  nabi-net:
    external: true

# ~/mcp-servers/codegraph-mcp/docker-compose.sse.yml
networks:
  nabi-net:
    external: true
```

## Service Discovery

With external network, services find each other via **Docker DNS**:

```
Service Name: memchain-loki
Container: memchain-mcp-loki (running in ~/nabia/memchain)
Network: nabi-net
DNS Resolution: memchain-loki → 172.20.0.5 (or similar)

Access from codegraph-sse:
  http://memchain-loki:3100  ✓ Works!
```

**Why it works**:
- Both services are on `nabi-net` (same virtual network)
- Docker daemon maintains internal DNS for all services on that network
- Container A can reach Container B by service name, regardless of compose file

## Startup Order

Since `depends_on` doesn't work across compose files, you control order manually:

```bash
# 1. Start memchain (provides Loki)
cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml up -d

# 2. Wait for it to be healthy
docker-compose -f docker-compose.sse.yml logs memchain-loki | grep "HTTP listen"

# 3. Start codegraph-sse
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml up -d
```

**Or use wait-for scripts**:

```bash
# In a hook or startup script
wait_for_service() {
  local host=$1 port=$2 timeout=${3:-30}
  echo "Waiting for $host:$port..."
  timeout $timeout bash -c "until nc -z $host $port; do sleep 1; done"
}

# Start memchain first
cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml up -d

# Wait for Loki
wait_for_service memchain-loki 3100

# Start codegraph-sse
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml up -d
```

## Health Checks Across Compose Files

You **can** check health from one compose context:

```bash
# Check codegraph-sse health
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml exec codegraph-sse \
  curl http://memchain-loki:3100/ready  # Reaches memchain's Loki!
```

## Communication Patterns

### ✅ Works: Service-to-Service via DNS

```python
# codegraph-sse (running in mcp-servers/codegraph-mcp)
async def emit_loki_event(message: str):
    async with httpx.AsyncClient() as client:
        # This works! Reaches memchain-loki via DNS
        await client.post(
            "http://memchain-loki:3100/loki/api/v1/push",
            json={"streams": [{"stream": {}, "values": [[timestamp, message]]}]}
        )
```

### ✅ Works: Shared Volume Mounts

Both compose files can mount the same host directory:

```yaml
# ~/nabia/memchain/docker-compose.sse.yml
volumes:
  - ${SYNCTHING_PATH:-$HOME/Sync}:/app/sync:ro

# ~/mcp-servers/codegraph-mcp/docker-compose.sse.yml
volumes:
  - ${SYNCTHING_PATH:-$HOME/Sync}:/app/sync:ro
```

Services can share data via host filesystem.

### ❌ Doesn't Work: depends_on Across Files

```yaml
# This FAILS because memchain-loki is in a different compose file
depends_on:
  - memchain-loki  # ERROR: Service not in current compose context
```

### ❌ Doesn't Work: Service Link Names

```yaml
# Don't try to reference other compose file's services this way
links:
  - memchain-loki:loki  # Won't resolve, not in same compose file
```

Use DNS names instead: `http://memchain-loki:3100`

## Practical Workflow

### Deploy All Services

```bash
# 1. Create network once
docker network create nabi-net || true

# 2. Start memchain (has Loki, Redis, SurrealDB, etc.)
cd ~/nabia/memchain
docker-compose -f docker-compose.coordination.yml up -d
docker-compose -f docker-compose.sse.yml up -d

# 3. Start codegraph-sse
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml up -d

# 4. Verify all running
docker ps | grep -E 'memchain|codegraph'
```

### Check Inter-Service Communication

```bash
# Can codegraph reach memchain-loki?
docker-compose -f docker-compose.sse.yml exec codegraph-sse \
  curl http://memchain-loki:3100/loki/api/v1/labels

# Should return: {"status":"success","data":["job",...]}
```

### View Logs Across Services

```bash
# Logs from memchain
cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml logs -f memchain-loki

# Logs from codegraph (in another terminal)
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml logs -f codegraph-sse
```

### Stop All Services

```bash
# Stop in reverse order
cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml down

cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml down
docker-compose -f docker-compose.coordination.yml down

# Optionally clean network
# docker network rm nabi-net
```

## Troubleshooting

### "memchain-loki: Name or service not known"

**Cause**: Services not on same network or DNS hasn't propagated yet

**Fix**:
```bash
# Check that both are on nabi-net
docker network inspect nabi-net | grep -E 'codegraph|memchain'

# Restart if needed
docker-compose -f docker-compose.sse.yml restart codegraph-sse
```

### "Connection refused" on http://memchain-loki:3100

**Cause**: Loki service isn't ready yet

**Fix**:
```bash
# Check if memchain-loki is actually running
docker ps | grep memchain-loki

# Check its logs
cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml logs memchain-loki
```

### "Unable to create external network"

**Cause**: Network already exists or naming conflict

**Fix**:
```bash
# Check existing networks
docker network ls | grep nabi-net

# Remove and recreate if corrupted
docker network rm nabi-net
docker network create nabi-net
```

## Advanced: Custom Network Names

If you want to use a different network name, update all compose files:

```yaml
# All files must use same external network
networks:
  my-federation-net:  # New name
    external: true
```

Then create with that name:
```bash
docker network create my-federation-net
```

## Environment Variable Expansion

Both compose files can use the same env variables:

```bash
# Set once in shell
export FEDERATION_ENABLED=true
export LOKI_URL=http://memchain-loki:3100

# Both compose files will use these
cd ~/nabia/memchain
docker-compose -f docker-compose.sse.yml up -d  # Uses LOKI_URL

cd ~/mcp-servers/codegraph-mcp
docker-compose -f docker-compose.sse.yml up -d  # Uses LOKI_URL
```

Or load from `.env` file in each directory:

```bash
# ~/nabia/memchain/.env
FEDERATION_ENABLED=true
LOKI_URL=http://memchain-loki:3100

# ~/mcp-servers/codegraph-mcp/.env
FEDERATION_ENABLED=true
LOKI_URL=http://memchain-loki:3100
```

## Summary

| Aspect | Pattern |
|--------|---------|
| **Network** | Single external `nabi-net` |
| **Service Discovery** | Docker DNS (service_name:port) |
| **File Location** | Can be in any directory |
| **Startup Order** | Manual or via wait-for scripts |
| **depends_on** | Only works within same compose file |
| **Communication** | Via DNS names (e.g., `http://memchain-loki:3100`) |
| **Shared Storage** | Via mounted volumes |
| **Logs** | Each compose file has its own context |

## Your Specific Setup

```
Create Network:
  docker network create nabi-net

Start Services:
  ~/nabia/memchain/
    docker-compose -f docker-compose.coordination.yml up -d
    docker-compose -f docker-compose.sse.yml up -d

  ~/mcp-servers/codegraph-mcp/
    docker-compose -f docker-compose.sse.yml up -d

Services on nabi-net:
  memchain-sse (port 8001)
  memchain-loki (port 3100)
  codegraph-sse (port 8050)
  ... others ...

Access Patterns:
  codegraph-sse → Loki: http://memchain-loki:3100
  Agents → codegraph: http://localhost:8050
  Agents → memchain: http://localhost:8001
```

This pattern scales to N services across M directories, all communicating via the shared network.
