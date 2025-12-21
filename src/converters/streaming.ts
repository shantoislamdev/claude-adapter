// Streaming converter: OpenAI SSE → Anthropic SSE
import { FastifyReply } from 'fastify';
import { Stream } from 'openai/streaming';
import {
    AnthropicMessageResponse,
    AnthropicUsage,
} from '../types/anthropic';
import { OpenAIStreamChunk, OpenAIStreamToolCall } from '../types/openai';
import { generateToolUseId } from './tools';

// Global counter and set for unique tool IDs within this process
let toolIdCounter = 0;
const usedToolIds = new Set<string>();

function generateUniqueToolId(): string {
    let id: string;
    do {
        toolIdCounter++;
        const timestamp = Date.now().toString(36);
        const counter = toolIdCounter.toString(36).padStart(4, '0');
        const random = Math.random().toString(36).substring(2, 10);
        id = `call_${timestamp}_${counter}_${random}`;
    } while (usedToolIds.has(id));

    usedToolIds.add(id);

    // Clean up old IDs periodically to prevent memory leak (keep last 10000)
    if (usedToolIds.size > 10000) {
        const idsArray = Array.from(usedToolIds);
        for (let i = 0; i < 5000; i++) {
            usedToolIds.delete(idsArray[i]);
        }
    }

    return id;
}

interface StreamingState {
    messageId: string;
    model: string;
    contentBlockIndex: number;
    currentToolCalls: Map<number, {
        id: string;
        name: string;
        arguments: string;
    }>;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    hasStarted: boolean;
    textContent: string;
}

/**
 * Transform OpenAI streaming response to Anthropic SSE format
 */
export async function streamOpenAIToAnthropic(
    openaiStream: Stream<OpenAIStreamChunk>,
    reply: FastifyReply,
    originalModel: string
): Promise<void> {
    const state: StreamingState = {
        messageId: `msg_${Date.now().toString(36)}`,
        model: originalModel,
        contentBlockIndex: 0,
        currentToolCalls: new Map(),
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        hasStarted: false,
        textContent: '',
    };

    // Access the underlying Node.js response for SSE streaming
    const raw = reply.raw;

    // Set SSE headers
    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('X-Accel-Buffering', 'no');

    try {
        for await (const chunk of openaiStream) {
            processChunk(chunk, state, raw);
        }

        // Send final events
        finishStream(state, raw);
    } catch (error) {
        sendErrorEvent(error as Error, raw);
    }
}

function processChunk(
    chunk: OpenAIStreamChunk,
    state: StreamingState,
    raw: any
): void {
    const choice = chunk.choices[0];
    if (!choice) return;

    // Send message_start on first chunk
    if (!state.hasStarted) {
        sendMessageStart(state, raw);
        state.hasStarted = true;
    }

    const delta = choice.delta;

    // Handle text content
    if (delta.content) {
        // If this is the first text content, start a text block
        if (state.textContent === '' && state.contentBlockIndex === 0) {
            sendContentBlockStart(state.contentBlockIndex, 'text', '', raw);
        }

        state.textContent += delta.content;
        sendTextDelta(state.contentBlockIndex, delta.content, raw);
    }

    // Handle tool calls
    if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
            processToolCallDelta(toolCall, state, raw);
        }
    }

    // Update usage if present
    if (chunk.usage) {
        state.inputTokens = chunk.usage.prompt_tokens;
        state.outputTokens = chunk.usage.completion_tokens;
        state.cachedInputTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
    }

    // Handle finish reason
    if (choice.finish_reason) {
        // Close any open text block
        if (state.textContent !== '') {
            sendContentBlockStop(state.contentBlockIndex, raw);
            state.contentBlockIndex++;
        }

        // Close any open tool calls
        for (const [index, toolCall] of state.currentToolCalls) {
            sendContentBlockStop(index, raw);
        }
    }
}

function processToolCallDelta(
    toolCall: OpenAIStreamToolCall,
    state: StreamingState,
    raw: any
): void {
    const index = toolCall.index;

    // Check if this is a new tool call
    if (!state.currentToolCalls.has(index)) {
        // Close any previous text block first
        if (state.textContent !== '' && state.contentBlockIndex === 0) {
            sendContentBlockStop(state.contentBlockIndex, raw);
            state.contentBlockIndex++;
        }

        // IMPORTANT: Use the original OpenAI tool ID to maintain consistency
        // This ID must match when tool results are sent back
        // If OpenAI doesn't provide an ID, generate a guaranteed unique one
        let toolId: string;
        if (toolCall.id && !usedToolIds.has(toolCall.id)) {
            toolId = toolCall.id;
            usedToolIds.add(toolId);
        } else {
            toolId = generateUniqueToolId();
        }

        const newToolCall = {
            id: toolId,
            name: toolCall.function?.name || '',
            arguments: '',
        };
        state.currentToolCalls.set(index, newToolCall);

        // Use content block index based on tool call position
        const blockIndex = state.contentBlockIndex + index;
        sendContentBlockStart(blockIndex, 'tool_use', newToolCall.name, raw, newToolCall.id);
    }

    // Update tool call data
    const currentCall = state.currentToolCalls.get(index)!;

    if (toolCall.function?.name) {
        currentCall.name = toolCall.function.name;
    }

    if (toolCall.function?.arguments) {
        currentCall.arguments += toolCall.function.arguments;
        const blockIndex = state.contentBlockIndex + index;
        sendInputJsonDelta(blockIndex, toolCall.function.arguments, raw);
    }
}

function sendMessageStart(state: StreamingState, raw: any): void {
    const event = {
        type: 'message_start',
        message: {
            id: state.messageId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: state.model,
            stop_reason: null,
            stop_sequence: null,
            usage: {
                input_tokens: state.inputTokens,
                output_tokens: state.outputTokens,
                cache_read_input_tokens: state.cachedInputTokens,
            },
        },
    };
    sendSSE(event, raw);
}

function sendContentBlockStart(
    index: number,
    type: 'text' | 'tool_use',
    textOrName: string,
    raw: any,
    id?: string
): void {
    let contentBlock: any;

    if (type === 'text') {
        contentBlock = { type: 'text', text: '' };
    } else {
        contentBlock = {
            type: 'tool_use',
            id: id || generateToolUseId(),
            name: textOrName,
            input: {},
        };
    }

    const event = {
        type: 'content_block_start',
        index,
        content_block: contentBlock,
    };
    sendSSE(event, raw);
}

function sendTextDelta(index: number, text: string, raw: any): void {
    const event = {
        type: 'content_block_delta',
        index,
        delta: {
            type: 'text_delta',
            text,
        },
    };
    sendSSE(event, raw);
}

function sendInputJsonDelta(index: number, partialJson: string, raw: any): void {
    const event = {
        type: 'content_block_delta',
        index,
        delta: {
            type: 'input_json_delta',
            partial_json: partialJson,
        },
    };
    sendSSE(event, raw);
}

function sendContentBlockStop(index: number, raw: any): void {
    const event = {
        type: 'content_block_stop',
        index,
    };
    sendSSE(event, raw);
}

function finishStream(state: StreamingState, raw: any): void {
    // Determine stop reason
    const hasToolCalls = state.currentToolCalls.size > 0;
    const stopReason = hasToolCalls ? 'tool_use' : 'end_turn';

    // Send message_delta
    const deltaEvent = {
        type: 'message_delta',
        delta: {
            stop_reason: stopReason,
            stop_sequence: null,
        },
        usage: {
            output_tokens: state.outputTokens,
            cache_read_input_tokens: state.cachedInputTokens,
        },
    };
    sendSSE(deltaEvent, raw);

    // Send message_stop
    sendSSE({ type: 'message_stop' }, raw);

    raw.end();
}

function sendErrorEvent(error: Error, raw: any): void {
    const event = {
        type: 'error',
        error: {
            type: 'api_error',
            message: error.message,
        },
    };
    sendSSE(event, raw);
    raw.end();
}

function sendSSE(data: any, raw: any): void {
    raw.write(`event: ${data.type}\n`);
    raw.write(`data: ${JSON.stringify(data)}\n\n`);
}
