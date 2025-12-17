<div align="center">

# Claude Adapter

**Transform your OpenAI API into an Anthropic-compatible endpoint for Claude Code**

[![npm version](https://img.shields.io/npm/v/claude-adapter.svg)](https://www.npmjs.com/package/claude-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-adapter.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[Getting Started](#getting-started) •
[Installation](#installation) •
[Configuration](#configuration) •
[API Reference](#api-reference) •
[Contributing](#contributing)

</div>

---

## Overview

**Claude Adapter** is a lightweight proxy that converts [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) requests to [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat) format, enabling you to use OpenAI-compatible APIs with [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

### Key Features

- 🔄 **Seamless Conversion** — Automatic request/response format transformation
- 🌊 **Streaming Support** — Real-time SSE event translation
- 🛠️ **Tool Calling** — Full function/tool calling compatibility
- ⚡ **Zero Config** — Interactive CLI guides you through setup
- 🔌 **Drop-in Proxy** — Works transparently with Claude Code

---

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│             │      │                 │      │                 │
│ Claude Code │─────▶│  Claude Adapter │─────▶│   OpenAI API    │
│             │      │     (Proxy)     │      │  (or compatible)│
│             │◀─────│                 │◀─────│                 │
└─────────────┘      └─────────────────┘      └─────────────────┘
   Anthropic              Converts              OpenAI
    Format               Formats                Format
```

---

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- An OpenAI API key (or compatible API)

### Installation

```bash
# Install globally
npm install -g claude-adapter

# Or run directly with npx
npx claude-adapter
```

### Quick Start

1. **Run the CLI:**
   ```bash
   claude-adapter
   ```

2. **Follow the prompts:**
   - Enter your OpenAI-compatible base URL
   - Provide your API key
   - Map Claude models to OpenAI models

3. **Start Claude Code** — It will automatically route through the proxy.

---

## Configuration

### CLI Options

| Option              | Description           | Default |
| ------------------- | --------------------- | ------- |
| `-p, --port <port>` | Port for proxy server | `8080`  |
| `-r, --reconfigure` | Force reconfiguration | `false` |
| `-V, --version`     | Display version       | —       |
| `-h, --help`        | Display help          | —       |

### Configuration File

Configuration is stored in `~/.claude-adapter/config.json`:

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "models": {
    "opus": "gpt-4-turbo",
    "sonnet": "gpt-4-turbo", 
    "haiku": "gpt-3.5-turbo"
  }
}
```

### Model Mapping

| Claude Model | Description  | Suggested OpenAI Model         |
| ------------ | ------------ | ------------------------------ |
| `opus`       | Most capable | `gpt-4-turbo`, `gpt-4o`        |
| `sonnet`     | Balanced     | `gpt-4-turbo`, `gpt-4o-mini`   |
| `haiku`      | Fast & light | `gpt-3.5-turbo`, `gpt-4o-mini` |

---

## API Reference

### Programmatic Usage

```typescript
import { createServer, AdapterConfig } from 'claude-adapter';

const config: AdapterConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY!,
  models: {
    opus: 'gpt-4-turbo',
    sonnet: 'gpt-4-turbo',
    haiku: 'gpt-3.5-turbo'
  }
};

const server = createServer(config);
await server.start(8080);

console.log('Proxy running on http://localhost:8080');
```

### Converter Functions

```typescript
import { 
  convertRequestToOpenAI,
  convertResponseToAnthropic 
} from 'claude-adapter';

// Convert Anthropic request to OpenAI format
const openaiRequest = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

// Convert OpenAI response to Anthropic format
const anthropicResponse = convertResponseToAnthropic(openaiResponse, 'claude-3-sonnet');
```

See [API Documentation](./docs/API.md) for complete reference.

---

## Supported Features

| Feature                  | Status | Notes                       |
| ------------------------ | ------ | --------------------------- |
| Text messages            | ✅      | Full support                |
| System prompts           | ✅      | Converted to system message |
| Streaming                | ✅      | SSE event transformation    |
| Tool/Function calling    | ✅      | Bidirectional conversion    |
| Multi-turn conversations | ✅      | Full context preserved      |
| Max tokens               | ✅      | Direct mapping              |
| Temperature              | ✅      | Direct mapping              |
| Top P                    | ✅      | Direct mapping              |
| Stop sequences           | ✅      | Array mapping               |
| Images/Vision            | 🔜      | Planned                     |

---

## Troubleshooting

### Common Issues

<details>
<summary><strong>Port already in use</strong></summary>

Use a different port:
```bash
claude-adapter --port 3000
```
</details>

<details>
<summary><strong>API key not working</strong></summary>

Reconfigure with a new key:
```bash
claude-adapter --reconfigure
```
</details>

<details>
<summary><strong>Claude Code not connecting</strong></summary>

Verify the proxy is running and check `~/.claude/settings.json` contains:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8080"
  }
}
```
</details>

---

## Development

```bash
# Clone the repository
git clone https://github.com/shantoislamdev/claude-adapter.git
cd claude-adapter

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

**[Report Bug](https://github.com/shantoislamdev/claude-adapter/issues)** •
**[Request Feature](https://github.com/shantoislamdev/claude-adapter/issues)** •
**[Documentation](./docs/)**

Made with ❤️ by [Shanto Islam](https://shantoislamdev.web.app/)

</div>
