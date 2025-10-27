"""
FastAPI-based SSE server for code graph queries
- Wraps existing codegraph-mcp instance with HTTP/SSE interface
- Handles multiple concurrent sessions sharing single graph instance
- Persists graphs to mounted volume
- Emits federation events
"""

import json
import logging
import os
import sys
import subprocess
import time
import asyncio
from pathlib import Path
from typing import Optional, AsyncGenerator, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings
import httpx
import psutil  # type: ignore[import-untyped]

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Service configuration from environment variables"""
    host: str = "0.0.0.0"
    port: int = 8050
    log_level: str = "info"

    # Federation configuration
    federation_enabled: bool = True
    agent_id: str = "codegraph-sse-docker"
    loki_url: str = "http://memchain-loki:3100"
    heartbeat_interval: int = 60
    environment: str = "production"

    # Storage configuration
    state_dir: Path = Path.home() / ".local/state/nabi/codegraph"
    graphs_dir: Path | None = None
    cache_dir: Path | None = None
    logs_dir: Path | None = None

    # MCP backend configuration
    mcp_graph_json: Optional[Path] = None
    mcp_root: Optional[Path] = None

    class Config:
        env_file = ".env"
        env_prefix = "CODEGRAPH_"
        case_sensitive = False

    def __init__(self, **data):  # type: ignore[no-untyped-def]
        super().__init__(**data)
        # Set derived paths (guaranteed non-None after init)
        if not self.graphs_dir:
            self.graphs_dir = self.state_dir / "graphs"
        if not self.cache_dir:
            self.cache_dir = self.state_dir / "cache"
        if not self.logs_dir:
            logs_home = os.getenv("XDG_DATA_HOME") or Path.home() / ".local/share"
            self.logs_dir = Path(logs_home) / "nabi" / "logs"

        # Type narrowing: these are guaranteed Path, not None
        assert self.graphs_dir is not None
        assert self.cache_dir is not None
        assert self.logs_dir is not None

        # Ensure directories exist
        self.graphs_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
app = FastAPI(
    title="Code Graph SSE Service",
    description="HTTP/SSE interface to shared code graph MCP instance",
    version="0.2.0"
)


# ============================================================================
# Models
# ============================================================================

class GraphIngestRequest(BaseModel):
    """Request to ingest a new codebase"""
    target: str
    id: Optional[str] = None


class GraphSetActiveRequest(BaseModel):
    """Request to switch active graph"""
    id_or_path: str


class QueryRequest(BaseModel):
    """Generic code graph query request"""
    tool: str
    params: dict


# ============================================================================
# State Management
# ============================================================================

class CodeGraphState:
    """Manages shared graph instance and registry"""

    def __init__(self) -> None:
        self.current_graph_path: Optional[Path] = None
        self.registry_path = settings.state_dir / "registry.json"
        self.registry: dict = {}  # type: ignore[assignment]
        self.load_registry()

    def load_registry(self) -> None:
        """Load graph registry from disk"""
        if self.registry_path.exists():
            with open(self.registry_path) as f:
                self.registry = json.load(f)
        else:
            self.registry = {"graphs": []}

    def save_registry(self) -> None:
        """Save graph registry to disk"""
        with open(self.registry_path, "w") as f:
            json.dump(self.registry, f, indent=2)

    def get_graph_path(self, graph_id: str) -> Optional[Path]:
        """Get path for a registered graph"""
        for g in self.registry.get("graphs", []):
            if g.get("id") == graph_id:
                return Path(g.get("path", ""))
        return None

    def set_active_graph(self, graph_path: Path) -> bool:
        """Update MCP backend to use specified graph"""
        if not graph_path.exists():
            return False
        self.current_graph_path = graph_path
        logger.info(f"Active graph set to: {graph_path}")
        return True


state = CodeGraphState()


# ============================================================================
# Federation & Logging
# ============================================================================

async def emit_loki_event(event_type: str, labels: dict[str, str], message: str) -> None:
    """Emit event to Loki for federation visibility"""
    if not settings.federation_enabled:
        return

    try:
        timestamp = int(time.time() * 1_000_000_000)  # nanoseconds

        # Construct Loki push request
        event_labels = {
            "job": "codegraph-sse",
            "agent_id": settings.agent_id,
            "environment": settings.environment,
            **labels
        }

        label_str = "{" + ",".join(f'{k}="{v}"' for k, v in event_labels.items()) + "}"

        payload = {
            "streams": [
                {
                    "stream": event_labels,
                    "values": [
                        [str(timestamp), message]
                    ]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.loki_url}/loki/api/v1/push",
                json=payload,
                timeout=5.0
            )
    except Exception as e:
        logger.warning(f"Failed to emit Loki event: {e}")


# ============================================================================
# HTTP Endpoints
# ============================================================================

@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "codegraph-sse",
        "version": "0.2.0",
        "timestamp": datetime.utcnow().isoformat(),
        "current_graph": str(state.current_graph_path) if state.current_graph_path else None
    }


@app.get("/graphs")
async def list_graphs() -> dict[str, Any]:
    """List all available indexed graphs"""
    state.load_registry()

    await emit_loki_event(
        "query",
        {"operation": "list_graphs"},
        f"Listed {len(state.registry.get('graphs', []))} graphs"
    )

    return {
        "graphs": state.registry.get("graphs", []),
        "current_active": str(state.current_graph_path) if state.current_graph_path else None
    }


@app.post("/graphs/ingest")
async def ingest_graph(request: GraphIngestRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Trigger code ingestion for a target directory"""

    await emit_loki_event(
        "ingest",
        {"target": request.target, "graph_id": request.id or request.target},
        f"Ingest started for {request.target}"
    )

    # Queue ingestion as background task
    background_tasks.add_task(
        _run_ingest_background,
        request.target,
        request.id
    )

    return {
        "status": "queued",
        "target": request.target,
        "graph_id": request.id,
        "message": "Ingestion queued, check /health or Loki for status"
    }


async def _run_ingest_background(target: str, graph_id: Optional[str]) -> None:
    """Background task to run ingestion"""
    try:
        graph_id = graph_id or Path(target).name
        output_dir = settings.graphs_dir / graph_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # Run ingest command via bun (from container perspective)
        cmd = [
            "bun", "run",
            "/app/src/ingest/make_graph.ts",
            "--target", target,
            "--output", str(output_dir)
        ]

        logger.info(f"Running ingest: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            error_msg = f"Ingest failed: {result.stderr}"
            logger.error(error_msg)
            await emit_loki_event(
                "ingest",
                {"status": "failed", "graph_id": graph_id},
                error_msg
            )
            return

        # Load graph and register
        graph_json = output_dir / "graph.json"
        if not graph_json.exists():
            error_msg = f"Graph file not created: {graph_json}"
            logger.error(error_msg)
            await emit_loki_event(
                "ingest",
                {"status": "failed", "graph_id": graph_id},
                error_msg
            )
            return

        # Register in registry
        with open(graph_json) as f:
            graph_data = json.load(f)
            size = len(graph_data.get("symbols", []))

        # Update registry
        state.load_registry()
        existing = next((i for i, g in enumerate(state.registry["graphs"]) if g["id"] == graph_id), None)
        entry = {
            "id": graph_id,
            "path": str(graph_json),
            "target": target,
            "size": size,
            "timestamp": datetime.utcnow().isoformat()
        }

        if existing is not None:
            state.registry["graphs"][existing] = entry
        else:
            state.registry["graphs"].append(entry)

        state.save_registry()

        # Set as active
        state.set_active_graph(graph_json)

        logger.info(f"Ingestion complete: {graph_id} ({size} symbols)")
        await emit_loki_event(
            "ingest",
            {"status": "success", "graph_id": graph_id, "size": str(size)},
            f"Ingest complete: {size} symbols"
        )

    except Exception as e:
        logger.exception(f"Ingest failed: {e}")
        await emit_loki_event(
            "ingest",
            {"status": "error", "graph_id": graph_id or "unknown"},
            f"Ingest error: {str(e)}"
        )


@app.post("/graphs/set-active")
async def set_active_graph(request: GraphSetActiveRequest) -> dict[str, Any]:
    """Switch active graph"""

    # Resolve graph path
    graph_path = state.get_graph_path(request.id_or_path)
    if not graph_path:
        # Try as direct path
        graph_path = Path(request.id_or_path).expanduser().resolve()

    if not graph_path.exists():
        await emit_loki_event(
            "query",
            {"operation": "set_active", "status": "failed"},
            f"Graph not found: {request.id_or_path}"
        )
        raise HTTPException(status_code=404, detail=f"Graph not found: {request.id_or_path}")

    success = state.set_active_graph(graph_path)

    await emit_loki_event(
        "query",
        {"operation": "set_active", "graph": request.id_or_path},
        f"Active graph set to: {graph_path}"
    )

    return {
        "status": "success",
        "active_graph": str(graph_path)
    }


@app.post("/query")
async def execute_query(request: QueryRequest) -> dict[str, Any]:
    """Execute a code graph query on active graph"""

    if not state.current_graph_path:
        raise HTTPException(
            status_code=400,
            detail="No active graph. Use /graphs/set-active first."
        )

    # Forward to MCP server instance (would communicate via IPC/socket in container)
    # For now, this is a placeholder for the actual MCP communication

    await emit_loki_event(
        "query",
        {"tool": request.tool, "graph": str(state.current_graph_path)},
        f"Query: {request.tool}"
    )

    return {
        "status": "success",
        "tool": request.tool,
        "graph": str(state.current_graph_path),
        "message": "Query execution would happen here"
    }


@app.get("/events")
async def stream_events() -> StreamingResponse:
    """Stream events as Server-Sent Events (SSE)"""

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events"""
        try:
            while True:
                # In production, would stream actual events from Loki or event queue
                event = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "service": "codegraph-sse",
                    "status": "healthy"
                }
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(30)  # Heartbeat every 30s
        except asyncio.CancelledError:
            logger.info("SSE client disconnected")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/metrics")
async def get_metrics() -> dict[str, Any]:
    """Export service metrics"""
    process = psutil.Process(os.getpid())
    memory_bytes = process.memory_info().rss
    memory_mb = memory_bytes / (1024 * 1024)

    return {
        "service": "codegraph-sse",
        "uptime_seconds": time.time() - process.create_time(),
        "memory_mb": memory_mb,
        "cpu_percent": process.cpu_percent(interval=1),
        "graph_registry_size": len(state.registry.get("graphs", [])),
        "active_graph": str(state.current_graph_path) if state.current_graph_path else None
    }


# ============================================================================
# Startup/Shutdown
# ============================================================================

@app.on_event("startup")
async def startup_event() -> None:
    """Initialize service on startup"""
    logger.info(f"Code Graph SSE Service starting...")
    logger.info(f"Federation enabled: {settings.federation_enabled}")
    logger.info(f"State directory: {settings.state_dir}")
    logger.info(f"Graphs directory: {settings.graphs_dir}")

    # Emit startup event
    await emit_loki_event(
        "startup",
        {"service": "codegraph-sse"},
        "Service starting up"
    )


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Cleanup on shutdown"""
    logger.info("Code Graph SSE Service shutting down...")

    await emit_loki_event(
        "shutdown",
        {"service": "codegraph-sse"},
        "Service shutting down"
    )


# ============================================================================
# CLI Entry Point
# ============================================================================

def run_server() -> None:
    """Run the SSE server via Uvicorn"""
    import uvicorn

    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=True
    )


if __name__ == "__main__":
    run_server()
