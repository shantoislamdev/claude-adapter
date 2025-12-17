# API Reference

Complete API documentation for Claude Adapter.

## Table of Contents

- [Server](#server)
- [Converters](#converters)
- [Configuration](#configuration)
- [Types](#types)

---

## Server

### `createServer(config)`

Creates a new proxy server instance.

```typescript
import { createServer } from 'claude-adapter';

const server = createServer({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-...',
  models: {
    opus: 'gpt-4-turbo',
    sonnet: 'gpt-4-turbo',
    haiku: 'gpt-3.5-turbo'
  }
});
```

**Parameters:**

| Name     | Type            | Description          |
| -------- | --------------- | -------------------- |
| `config` | `AdapterConfig` | Server configuration |

**Returns:** `ProxyServer`

---

### `ProxyServer`

Server instance with the following methods:

#### `start(port: number): Promise<string>`

Starts the server on the specified port.

```typescript
const url = await server.start(8080);
console.log(`Server running at ${url}`);
```

**Returns:** Promise resolving to the server URL.

#### `stop(): void`

Stops the server gracefully.

```typescript
server.stop();
```

---

### `findAvailablePort(preferredPort)`

Finds an available port starting from the preferred port.

```typescript
import { findAvailablePort } from 'claude-adapter';

const port = await findAvailablePort(8080);
// Returns 8080 if available, otherwise next available port
```

---

## Converters

### `convertRequestToOpenAI(request, targetModel)`

Converts an Anthropic Messages API request to OpenAI Chat Completions format.

```typescript
import { convertRequestToOpenAI } from 'claude-adapter';

const anthropicRequest = {
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
};

const openaiRequest = convertRequestToOpenAI(anthropicRequest, 'gpt-4');
```

**Parameters:**

| Name          | Type                      | Description              |
| ------------- | ------------------------- | ------------------------ |
| `request`     | `AnthropicMessageRequest` | Anthropic request        |
| `targetModel` | `string`                  | Target OpenAI model name |

**Returns:** `OpenAIChatRequest`

---

### `convertResponseToAnthropic(response, originalModel)`

Converts an OpenAI Chat Completion response to Anthropic format.

```typescript
import { convertResponseToAnthropic } from 'claude-adapter';

const anthropicResponse = convertResponseToAnthropic(
  openaiResponse, 
  'claude-3-sonnet-20240229'
);
```

**Parameters:**

| Name            | Type                 | Description                        |
| --------------- | -------------------- | ---------------------------------- |
| `response`      | `OpenAIChatResponse` | OpenAI response                    |
| `originalModel` | `string`             | Original Anthropic model requested |

**Returns:** `AnthropicMessageResponse`

---

### `convertToolsToOpenAI(tools)`

Converts Anthropic tool definitions to OpenAI function format.

```typescript
import { convertToolsToOpenAI } from 'claude-adapter';

const anthropicTools = [{
  name: 'get_weather',
  description: 'Get current weather',
  input_schema: {
    type: 'object',
    properties: {
      location: { type: 'string' }
    },
    required: ['location']
  }
}];

const openaiTools = convertToolsToOpenAI(anthropicTools);
```

---

## Configuration

### `loadConfig()`

Loads configuration from `~/.claude-adapter/config.json`.

```typescript
import { loadConfig } from 'claude-adapter';

const config = loadConfig();
if (config) {
  console.log('Config loaded:', config.baseUrl);
}
```

**Returns:** `AdapterConfig | null`

---

### `saveConfig(config)`

Saves configuration to `~/.claude-adapter/config.json`.

```typescript
import { saveConfig } from 'claude-adapter';

saveConfig({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-...',
  models: { opus: 'gpt-4', sonnet: 'gpt-4', haiku: 'gpt-3.5-turbo' }
});
```

---

### `updateClaudeSettings(proxyUrl, models)`

Updates Claude Code settings at `~/.claude/settings.json`.

```typescript
import { updateClaudeSettings } from 'claude-adapter';

updateClaudeSettings('http://localhost:8080', {
  opus: 'gpt-4-turbo',
  sonnet: 'gpt-4-turbo',
  haiku: 'gpt-3.5-turbo'
});
```

---

## Types

### `AdapterConfig`

```typescript
interface AdapterConfig {
  baseUrl: string;      // OpenAI-compatible API base URL
  apiKey: string;       // API key
  models: ModelConfig;  // Model mappings
  port?: number;        // Optional server port
}
```

### `ModelConfig`

```typescript
interface ModelConfig {
  opus: string;    // Model for Claude Opus
  sonnet: string;  // Model for Claude Sonnet
  haiku: string;   // Model for Claude Haiku
}
```

### `AnthropicMessageRequest`

```typescript
interface AnthropicMessageRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: AnthropicToolDefinition[];
}
```

### `AnthropicMessageResponse`

```typescript
interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | null;
  usage: AnthropicUsage;
}
```

See [types/](../src/types/) for complete type definitions.
