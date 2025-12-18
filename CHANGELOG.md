# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-12-18

### Added

- **Request Input Validation**: Comprehensive validation for incoming Anthropic API requests with detailed error messages
- **Structured Logging**: Logger utility with log levels (DEBUG/INFO/WARN/ERROR), timestamps, and colored output
- **Request ID Tracing**: Unique request IDs (`X-Request-Id` header) for debugging and log correlation
- **Graceful Shutdown**: Server shutdown with configurable timeout for in-flight requests
- **API Documentation**: Complete API reference at `docs/API.md`

### Improved

- Test coverage increased from ~30% to ~70%
- Added 98 unit tests covering converters, validation, logging, and server
- Migrated from Express to Fastify for improved performance

### New Test Files

- `tests/validation.test.ts` - Request validation tests
- `tests/streaming.test.ts` - SSE streaming tests
- `tests/logger.test.ts` - Logger utility tests
- `tests/server.test.ts` - Server setup tests

## [1.0.0] - 2025-12-17

### Added

- Initial release of Claude Adapter
- CLI tool for interactive configuration
- Proxy server converting Anthropic Messages API to OpenAI Chat Completions
- Full streaming support with SSE event transformation
- Tool/function calling conversion between APIs
- Automatic Claude Code settings configuration
- Support for model mapping (Opus, Sonnet, Haiku)
- Configuration persistence in `~/.claude-adapter/config.json`
- Onboarding skip for Claude Code via `~/.claude.json`
- Comprehensive type definitions for both APIs
- Unit tests for all converters

### Features

- **Request Conversion**: Anthropic → OpenAI format
- **Response Conversion**: OpenAI → Anthropic format  
- **Streaming**: Real-time SSE transformation
- **Tools**: Bidirectional tool/function call conversion
- **CLI**: Interactive setup with guided prompts

---

[Unreleased]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/shantoislamdev/claude-adapter/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shantoislamdev/claude-adapter/releases/tag/v1.0.0
