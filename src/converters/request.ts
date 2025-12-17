// Request converter: Anthropic → OpenAI format
import {
    AnthropicMessageRequest,
    AnthropicMessage,
    AnthropicContentBlock,
    AnthropicToolUseBlock,
    AnthropicToolResultBlock,
    AnthropicSystemContent,
} from '../types/anthropic';
import {
    OpenAIChatRequest,
    OpenAIMessage,
    OpenAIUserContentPart,
    OpenAIToolMessage,
} from '../types/openai';
import { convertToolsToOpenAI, convertToolChoiceToOpenAI } from './tools';

/**
 * Convert Anthropic Messages API request to OpenAI Chat Completions format
 */
export function convertRequestToOpenAI(
    anthropicRequest: AnthropicMessageRequest,
    targetModel: string
): OpenAIChatRequest {
    const messages: OpenAIMessage[] = [];

    // Handle system prompt - becomes first message with role: system
    if (anthropicRequest.system) {
        const systemContent = typeof anthropicRequest.system === 'string'
            ? anthropicRequest.system
            : anthropicRequest.system.map((s: AnthropicSystemContent) => s.text).join('\n');

        messages.push({
            role: 'system',
            content: systemContent,
        });
    }

    // Convert messages
    for (const msg of anthropicRequest.messages) {
        const converted = convertMessage(msg);
        messages.push(...converted);
    }

    const openaiRequest: OpenAIChatRequest = {
        model: targetModel,
        messages,
        max_tokens: anthropicRequest.max_tokens,
        stream: anthropicRequest.stream,
    };

    // Optional parameters
    if (anthropicRequest.temperature !== undefined) {
        openaiRequest.temperature = anthropicRequest.temperature;
    }
    if (anthropicRequest.top_p !== undefined) {
        openaiRequest.top_p = anthropicRequest.top_p;
    }
    if (anthropicRequest.stop_sequences) {
        openaiRequest.stop = anthropicRequest.stop_sequences;
    }
    if (anthropicRequest.metadata?.user_id) {
        openaiRequest.user = anthropicRequest.metadata.user_id;
    }

    // Convert tools
    if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
        openaiRequest.tools = convertToolsToOpenAI(anthropicRequest.tools);
    }
    if (anthropicRequest.tool_choice) {
        openaiRequest.tool_choice = convertToolChoiceToOpenAI(anthropicRequest.tool_choice);
    }

    return openaiRequest;
}

/**
 * Convert a single Anthropic message to OpenAI format
 * May return multiple messages (e.g., tool results become separate messages)
 */
function convertMessage(msg: AnthropicMessage): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (typeof msg.content === 'string') {
        // Simple string content
        if (msg.role === 'user') {
            result.push({ role: 'user', content: msg.content });
        } else {
            result.push({ role: 'assistant', content: msg.content });
        }
    } else {
        // Array of content blocks
        if (msg.role === 'user') {
            const { userContent, toolResults } = processUserContentBlocks(msg.content);

            // Add tool results as separate tool messages
            result.push(...toolResults);

            // Add user content if any
            if (userContent.length > 0) {
                result.push({
                    role: 'user',
                    content: userContent.length === 1 && userContent[0].type === 'text'
                        ? userContent[0].text
                        : userContent,
                });
            }
        } else {
            // Assistant message with content blocks
            const { textContent, toolCalls } = processAssistantContentBlocks(msg.content);

            const assistantMsg: OpenAIMessage = {
                role: 'assistant',
                content: textContent || null,
            };

            if (toolCalls.length > 0) {
                (assistantMsg as any).tool_calls = toolCalls;
            }

            result.push(assistantMsg);
        }
    }

    return result;
}

/**
 * Process user content blocks, separating tool results from regular content
 */
function processUserContentBlocks(blocks: AnthropicContentBlock[]): {
    userContent: OpenAIUserContentPart[];
    toolResults: OpenAIToolMessage[];
} {
    const userContent: OpenAIUserContentPart[] = [];
    const toolResults: OpenAIToolMessage[] = [];

    for (const block of blocks) {
        if (block.type === 'text') {
            userContent.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_result') {
            const toolResult = block as AnthropicToolResultBlock;
            let content: string;

            if (typeof toolResult.content === 'string') {
                content = toolResult.content;
            } else if (Array.isArray(toolResult.content)) {
                content = toolResult.content
                    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
            } else {
                content = '';
            }

            toolResults.push({
                role: 'tool',
                tool_call_id: toolResult.tool_use_id,
                content: toolResult.is_error ? `Error: ${content}` : content,
            });
        }
        // Images would need special handling for vision models - not implemented here
    }

    return { userContent, toolResults };
}

/**
 * Process assistant content blocks, extracting text and tool calls
 */
function processAssistantContentBlocks(blocks: AnthropicContentBlock[]): {
    textContent: string;
    toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
} {
    let textContent = '';
    const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

    for (const block of blocks) {
        if (block.type === 'text') {
            textContent += block.text;
        } else if (block.type === 'tool_use') {
            const toolUse = block as AnthropicToolUseBlock;
            toolCalls.push({
                id: toolUse.id,
                type: 'function',
                function: {
                    name: toolUse.name,
                    arguments: JSON.stringify(toolUse.input),
                },
            });
        }
    }

    return { textContent, toolCalls };
}
