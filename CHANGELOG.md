# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/shantoislamdev/claude-adapter/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/shantoislamdev/claude-adapter/releases/tag/v1.0.0
