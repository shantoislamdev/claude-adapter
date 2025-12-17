// Response converter: OpenAI → Anthropic format
import {
    AnthropicMessageResponse,
    AnthropicContentBlock,
    AnthropicUsage,
} from '../types/anthropic';
import {
    OpenAIChatResponse,
    OpenAIToolCall,
} from '../types/openai';

/**
 * Convert OpenAI Chat Completion response to Anthropic Messages format
 */
export function convertResponseToAnthropic(
    openaiResponse: OpenAIChatResponse,
    originalModelRequested: string
): AnthropicMessageResponse {
    const choice = openaiResponse.choices[0];
    const message = choice.message;

    // Build content blocks
    const content: AnthropicContentBlock[] = [];

    // Add text content if present
    if (message.content) {
        content.push({
            type: 'text',
            text: message.content,
        });
    }

    // Add tool use blocks if present
    if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
            content.push(convertToolCallToToolUse(toolCall));
        }
    }

    // Map finish reason
    const stopReason = mapFinishReason(choice.finish_reason);

    // Build usage
    const usage: AnthropicUsage = {
        input_tokens: openaiResponse.usage.prompt_tokens,
        output_tokens: openaiResponse.usage.completion_tokens,
    };

    return {
        id: `msg_${openaiResponse.id}`,
        type: 'message',
        role: 'assistant',
        content,
        model: originalModelRequested,
        stop_reason: stopReason,
        stop_sequence: null,
        usage,
    };
}

/**
 * Convert OpenAI tool call to Anthropic tool_use block
 */
function convertToolCallToToolUse(toolCall: OpenAIToolCall): AnthropicContentBlock {
    let input: Record<string, unknown>;
    try {
        input = JSON.parse(toolCall.function.arguments);
    } catch {
        input = { raw: toolCall.function.arguments };
    }

    return {
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input,
    };
}

/**
 * Map OpenAI finish_reason to Anthropic stop_reason
 */
function mapFinishReason(
    finishReason: string | null
): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null {
    if (!finishReason) return null;

    switch (finishReason) {
        case 'stop':
            return 'end_turn';
        case 'length':
            return 'max_tokens';
        case 'tool_calls':
            return 'tool_use';
        case 'content_filter':
            return 'end_turn'; // Map to end_turn as closest equivalent
        default:
            return 'end_turn';
    }
}

/**
 * Create an error response in Anthropic format
 */
export function createErrorResponse(
    error: Error,
    statusCode: number = 500
): { error: { type: string; message: string }; status: number } {
    return {
        error: {
            type: mapErrorType(statusCode),
            message: error.message,
        },
        status: statusCode,
    };
}

function mapErrorType(statusCode: number): string {
    switch (statusCode) {
        case 400:
            return 'invalid_request_error';
        case 401:
            return 'authentication_error';
        case 403:
            return 'permission_error';
        case 404:
            return 'not_found_error';
        case 429:
            return 'rate_limit_error';
        case 500:
        default:
            return 'api_error';
    }
}
