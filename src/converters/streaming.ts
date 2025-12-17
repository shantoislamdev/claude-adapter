// Streaming converter: OpenAI SSE → Anthropic SSE
import { Response } from 'express';
import { Stream } from 'openai/streaming';
import {
    AnthropicMessageResponse,
    AnthropicUsage,
} from '../types/anthropic';
import { OpenAIStreamChunk, OpenAIStreamToolCall } from '../types/openai';
import { generateToolUseId } from './tools';

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
    hasStarted: boolean;
    textContent: string;
}

/**
 * Transform OpenAI streaming response to Anthropic SSE format
 */
export async function streamOpenAIToAnthropic(
    openaiStream: Stream<OpenAIStreamChunk>,
    res: Response,
    originalModel: string
): Promise<void> {
    const state: StreamingState = {
        messageId: `msg_${Date.now().toString(36)}`,
        model: originalModel,
        contentBlockIndex: 0,
        currentToolCalls: new Map(),
        inputTokens: 0,
        outputTokens: 0,
        hasStarted: false,
        textContent: '',
    };

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        for await (const chunk of openaiStream) {
            processChunk(chunk, state, res);
        }

        // Send final events
        finishStream(state, res);
    } catch (error) {
        sendErrorEvent(error as Error, res);
    }
}

function processChunk(
    chunk: OpenAIStreamChunk,
    state: StreamingState,
    res: Response
): void {
    const choice = chunk.choices[0];
    if (!choice) return;

    // Send message_start on first chunk
    if (!state.hasStarted) {
        sendMessageStart(state, res);
        state.hasStarted = true;
    }

    const delta = choice.delta;

    // Handle text content
    if (delta.content) {
        // If this is the first text content, start a text block
        if (state.textContent === '' && state.contentBlockIndex === 0) {
            sendContentBlockStart(state.contentBlockIndex, 'text', '', res);
        }

        state.textContent += delta.content;
        sendTextDelta(state.contentBlockIndex, delta.content, res);
    }

    // Handle tool calls
    if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
            processToolCallDelta(toolCall, state, res);
        }
    }

    // Update usage if present
    if (chunk.usage) {
        state.inputTokens = chunk.usage.prompt_tokens;
        state.outputTokens = chunk.usage.completion_tokens;
    }

    // Handle finish reason
    if (choice.finish_reason) {
        // Close any open text block
        if (state.textContent !== '') {
            sendContentBlockStop(state.contentBlockIndex, res);
            state.contentBlockIndex++;
        }

        // Close any open tool calls
        for (const [index, toolCall] of state.currentToolCalls) {
            sendContentBlockStop(index, res);
        }
    }
}

function processToolCallDelta(
    toolCall: OpenAIStreamToolCall,
    state: StreamingState,
    res: Response
): void {
    const index = toolCall.index;

    // Check if this is a new tool call
    if (!state.currentToolCalls.has(index)) {
        // Close any previous text block first
        if (state.textContent !== '' && state.contentBlockIndex === 0) {
            sendContentBlockStop(state.contentBlockIndex, res);
            state.contentBlockIndex++;
        }

        const newToolCall = {
            id: toolCall.id || generateToolUseId(),
            name: toolCall.function?.name || '',
            arguments: '',
        };
        state.currentToolCalls.set(index, newToolCall);

        // Use content block index based on tool call position
        const blockIndex = state.contentBlockIndex + index;
        sendContentBlockStart(blockIndex, 'tool_use', newToolCall.name, res, newToolCall.id);
    }

    // Update tool call data
    const currentCall = state.currentToolCalls.get(index)!;

    if (toolCall.function?.name) {
        currentCall.name = toolCall.function.name;
    }

    if (toolCall.function?.arguments) {
        currentCall.arguments += toolCall.function.arguments;
        const blockIndex = state.contentBlockIndex + index;
        sendInputJsonDelta(blockIndex, toolCall.function.arguments, res);
    }
}

function sendMessageStart(state: StreamingState, res: Response): void {
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
            },
        },
    };
    sendSSE(event, res);
}

function sendContentBlockStart(
    index: number,
    type: 'text' | 'tool_use',
    textOrName: string,
    res: Response,
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
    sendSSE(event, res);
}

function sendTextDelta(index: number, text: string, res: Response): void {
    const event = {
        type: 'content_block_delta',
        index,
        delta: {
            type: 'text_delta',
            text,
        },
    };
    sendSSE(event, res);
}

function sendInputJsonDelta(index: number, partialJson: string, res: Response): void {
    const event = {
        type: 'content_block_delta',
        index,
        delta: {
            type: 'input_json_delta',
            partial_json: partialJson,
        },
    };
    sendSSE(event, res);
}

function sendContentBlockStop(index: number, res: Response): void {
    const event = {
        type: 'content_block_stop',
        index,
    };
    sendSSE(event, res);
}

function finishStream(state: StreamingState, res: Response): void {
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
        },
    };
    sendSSE(deltaEvent, res);

    // Send message_stop
    sendSSE({ type: 'message_stop' }, res);

    res.end();
}

function sendErrorEvent(error: Error, res: Response): void {
    const event = {
        type: 'error',
        error: {
            type: 'api_error',
            message: error.message,
        },
    };
    sendSSE(event, res);
    res.end();
}

function sendSSE(data: any, res: Response): void {
    res.write(`event: ${data.type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
