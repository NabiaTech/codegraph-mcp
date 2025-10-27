"""
Code Graph SSE Service
- Provides HTTP/SSE interface to shared code graph instance
- Multiplexes multiple agent sessions to single MCP backend
- Stores graphs in mounted volume for persistence
- Emits federation events to Loki
"""

__version__ = "0.2.0"
