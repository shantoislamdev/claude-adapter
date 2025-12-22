# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2025-12-22

### Added

- **Token Usage Logging**: Track API usage in `~/.claude-adapter/token_usage/YYYY-MM-DD.jsonl` with modelName, actual model, input/output tokens, cached tokens
- **Error Logging**: Store API errors in `~/.claude-adapter/error_logs/YYYY-MM-DD.jsonl` with full error details (skips 401, 402, 404, 429)
- **Metadata Storage**: Create `~/.claude-adapter/metadata.json` on first run with unique userId, platform, platformRelease, and version info
- **Update Notifier**: CLI checks npm registry for new versions with 24-hour caching
- **Smart Update Prompts**: When a new version is available, Claude Code is instructed to prompt users to run `npm i -g claude-adapter`

### Improved

- Shared `fileStorage.ts` utility for race-safe JSON Lines writes
- Zero-dependency update checking using native `https` module
- Non-blocking update checks with 3-second timeout

## [1.1.5] - 2025-12-21

### Fixed

- **Azure OpenAI Compatibility**: Fixed strict validation errors by automatically converting `max_tokens: 1` (used for prompt caching) to `max_tokens: 32` for providers with stricter limits

## [1.1.4] - 2025-12-20

### Fixed

- **Smart Tool ID Deduplication**: Re-implemented ID deduplication that matches original ID length for provider compatibility (Mistral needs 9 chars, Bedrock accepts longer). For IDs >11 chars, keeps first 8 chars; for shorter IDs, generates new ID of same length

## [1.1.3] - 2025-12-20

### Fixed

- **Tool Call ID Handling**: Removed ID repair logic that was incorrectly modifying tool_use IDs on each request, causing tool_use/result pairing failures across conversation turns

## [1.1.2] - 2025-12-20

### Fixed

- **Tool Call ID Format**: Attempted fix for 400 errors with 9-character alphanumeric IDs (superseded by v1.1.3)

## [1.1.1] - 2025-12-20

### Fixed

- **OpenAI-Compatible API Support**: Fixed 422 errors with providers like Mistral that strictly reject unsupported parameters (removed `user` field from requests)
- **Assistant Prefill Compatibility**: Fixed 400 errors by detecting and skipping Anthropic-specific assistant prefill messages (e.g., `{` for JSON output) that other providers don't support

### Improved

- **Simplified Logging**: Cleaner log output in non-debug mode with simple `→ model [sent]` / `← model [received]` format
- **Debug Logging**: Full timestamps and metadata preserved in debug mode (`LOG_LEVEL=debug`)

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

[Unreleased]: https://github.com/shantoislamdev/claude-adapter/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.5...v1.2.0
[1.1.5]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/shantoislamdev/claude-adapter/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/shantoislamdev/claude-adapter/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shantoislamdev/claude-adapter/releases/tag/v1.0.0
