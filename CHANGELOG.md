# Changelog

All notable changes to this project are documented in this file.

The format follows **Keep a Changelog** and this project adheres to **Semantic Versioning (SemVer)**.

---

## [2.0.0] — 2025-12-30

### Breaking Changes

- **Node.js Requirement**: Raised minimum supported Node.js version to **v20.0.0**.

### Added

- **XML Tool Calling**: Added support for models lacking native tool usage via XML injection, output parsing, and history reconstruction.
- **Deterministic Output**: Enforced `temperature: 0` and `<think>` block filtering for XML mode to ensure reliability.
- **CLI Setup**: Added interactive configuration for tool styles (`native` vs `xml`) and model capabilities.

### Fixed

- **XML History**: Resolved conversation history mismatches during multi-turn tool interactions.
- **XML Parsing**: Improved resilience against whitespace variations and case sensitivity in model outputs.

---

## [1.2.1] — 2025-12-26

### Fixed

- **Streaming Usage**: Fixed zero-token reporting and handled usage data in empty end-of-stream chunks.
- **Update Logic**: Switched to Semantic Versioning for accurate update detection.

---

## [1.2.0] — 2025-12-22

### Added

- **Logging**: Added tracking for token usage (input/output/cache) and detailed error reporting.
- **Update System**: Added non-blocking update checks, smart upgrade prompts, and metadata storage.

### Improved

- **Performance**: Implemented zero-dependency update checks and race-safe JSON utilities to prevent CLI blocking.

---

## [1.1.5] — 2025-12-21

### Fixed

- **Azure OpenAI**: Adjusted prompt caching limits to comply with stricter provider constraints.

---

## [1.1.4] — 2025-12-20

### Fixed

- **ID Deduplication**: Reworked ID generation to preserve constraints while ensuring uniqueness.

---

## [1.1.3] — 2025-12-20

### Fixed

- **ID Handling**: Removed logic that caused ID mismatches across tool/result pairs.

---

## [1.1.2] — 2025-12-20

### Fixed

- **ID Format**: Initial fix for strict identifier formats (superseded by v1.1.3).

---

## [1.1.1] — 2025-12-20

### Fixed

- **API Compatibility**: Removed unsupported fields to prevent validation errors with strict providers.
- **Assistant Prefill**: Disabled prefill messages for providers that do not support them.

### Improved

- **Logging**: Simplified standard output while preserving details in debug mode.

---

## [1.1.0] — 2025-12-18

### Added

- **Core**: Added comprehensive request validation, ID tracing, and graceful server shutdown.
- **Logging**: implemented structured logging with timestamps and color support.
- **Docs**: Added complete API documentation.

### Improved

- **Internal**: Migrated to a high-performance web framework and significantly increased test coverage.

---

## [1.0.0] — 2025-12-17

### Added

- **Initial Release**: Launched **Claude Adapter** with CLI, proxy server, and persistent config.
- **Core Features**: Included Anthropic-to-OpenAI conversion, SSE streaming, and bidirectional tool support.