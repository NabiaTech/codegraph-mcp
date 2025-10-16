# Changelog

All notable changes to codegraph-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-16

### Added
- Initial release of codegraph MCP server
- Symbol resolution by fuzzy name matching
- Reference/dependency analysis (inbound edges)
- Neighbor discovery (call/import relationships)
- Diff impact analysis for change propagation
- Code snippet resource handler
- Support for TypeScript and Python code analysis

### Security
- Path traversal protection in file resource handler
- Input validation for all parameters (line numbers, query strings, diff patches)
- Bounds checking to prevent DoS attacks (max 500 lines per snippet, max 100KB diffs)
- Proper error handling with sanitized error messages
- Stderr logging to preserve JSON-RPC protocol integrity

### Fixed
- Fixed stdout/stderr logging corruption of JSON-RPC protocol
- Fixed undefined value propagation in map operations
- Improved error handling with detailed logging
- Fixed line number validation (prevents NaN attacks)

### Changed
- Migrated logging to stderr for MCP protocol compliance
- Enhanced resource handler with comprehensive error handling
- Improved diff parsing with better edge case handling
