"""
CLI entry point for codegraph-sse service
"""

import click
from .server import run_server, settings


@click.command()
@click.option(
    "--host",
    default="0.0.0.0",
    help="Server host address",
    envvar="CODEGRAPH_HOST"
)
@click.option(
    "--port",
    default=8050,
    type=int,
    help="Server port",
    envvar="CODEGRAPH_PORT"
)
@click.option(
    "--log-level",
    default="info",
    type=click.Choice(["debug", "info", "warning", "error"]),
    help="Logging level",
    envvar="CODEGRAPH_LOG_LEVEL"
)
def main(host: str, port: int, log_level: str):
    """Run Code Graph SSE service

    This service provides an HTTP/SSE interface to a shared code graph instance.
    Multiple agent sessions connect to the same backend, reducing memory usage.

    Environment Variables:
        CODEGRAPH_HOST: Server host (default: 0.0.0.0)
        CODEGRAPH_PORT: Server port (default: 8050)
        CODEGRAPH_LOG_LEVEL: Log level (default: info)
        CODEGRAPH_FEDERATION_ENABLED: Enable federation (default: true)
        CODEGRAPH_AGENT_ID: Agent ID for federation (default: codegraph-sse-docker)
        CODEGRAPH_LOKI_URL: Loki URL for events
        CODEGRAPH_ENVIRONMENT: Environment name (default: production)
    """
    # Update settings if provided
    if host != "0.0.0.0":
        settings.host = host
    if port != 8050:
        settings.port = port
    if log_level != "info":
        settings.log_level = log_level

    run_server()


if __name__ == "__main__":
    main()
