# API Reference

Complete API documentation for **Claude Adapter** — *Adapt any model for Claude Code*.

## Endpoints

### POST /v1/messages

The main API endpoint that accepts Anthropic Messages API requests and proxies them to an OpenAI-compatible backend.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```typescript
{
  model: string;           // Required: Model name (passed through directly)
  max_tokens: number;      // Required: Maximum tokens in response
  messages: Message[];     // Required: Array of conversation messages
  system?: string;         // Optional: System prompt
  temperature?: number;    // Optional: 0-1, sampling temperature
  top_p?: number;          // Optional: 0-1, nucleus sampling
  stream?: boolean;        // Optional: Enable streaming responses
  stop_sequences?: string[]; // Optional: Stop sequences
  tools?: Tool[];          // Optional: Tool definitions
  tool_choice?: ToolChoice; // Optional: Tool selection preference
}
```

**Message Format:**
```typescript
{
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}
```

**Response (Non-streaming):**
```typescript
{
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

**Response (Streaming):**
Server-Sent Events (SSE) with the following event types:
- `message_start` - Initial message metadata
- `content_block_start` - Start of a content block
- `content_block_delta` - Content update
- `content_block_stop` - End of a content block
- `message_delta` - Final message metadata with stop_reason
- `message_stop` - Stream complete

---

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "adapter": "claude-adapter"
}
```

---

## Converter Functions

### convertRequestToOpenAI

Converts an Anthropic Messages API request to OpenAI Chat Completions format.

```typescript
import { convertRequestToOpenAI } from 'claude-adapter';

const openaiRequest = convertRequestToOpenAI(anthropicRequest, 'gpt-4');
```

**Parameters:**
- `anthropicRequest: AnthropicMessageRequest` - The incoming request
- `targetModel: string` - The OpenAI model to use

**Returns:** `OpenAIChatRequest`

---

### convertResponseToAnthropic

Converts an OpenAI Chat Completion response to Anthropic format.

```typescript
import { convertResponseToAnthropic } from 'claude-adapter';

const anthropicResponse = convertResponseToAnthropic(openaiResponse, 'claude-4-opus');
```

**Parameters:**
- `openaiResponse: OpenAIChatResponse` - The OpenAI response
- `originalModelRequested: string` - Model name to include in response

**Returns:** `AnthropicMessageResponse`

---

### streamOpenAIToAnthropic

Transforms an OpenAI streaming response to Anthropic SSE format.

```typescript
import { streamOpenAIToAnthropic } from 'claude-adapter';

await streamOpenAIToAnthropic(openaiStream, fastifyReply, 'claude-4-opus');
```

---

## Error Responses

All errors follow Anthropic's error format:

```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "Description of the error"
  }
}
```

**Error Types:**
| Status Code | Error Type              |
| ----------- | ----------------------- |
| 400         | `invalid_request_error` |
| 401         | `authentication_error`  |
| 403         | `permission_error`      |
| 404         | `not_found_error`       |
| 429         | `rate_limit_error`      |
| 500         | `api_error`             |

---

## Configuration Types

```typescript
interface AdapterConfig {
  baseUrl: string;    // OpenAI-compatible API base URL
  apiKey: string;     // API key for authentication
  models: {
    opus: string;     // Model for Claude Opus requests
    sonnet: string;   // Model for Claude Sonnet requests
    haiku: string;    // Model for Claude Haiku requests
  };
}
```

---

## Example Usage

```typescript
import { createServer } from 'claude-adapter';

const config = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
  models: {
    opus: 'gpt-4-turbo',
    sonnet: 'gpt-4',
    haiku: 'gpt-3.5-turbo',
  },
};

const server = createServer(config);
await server.start(3080);

// Server now accepts Anthropic API requests at http://localhost:3080
```
