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

    // Track tool ID deduplication across messages
    // Maps original ID -> array of unique IDs (for handling duplicates)
    const idDeduplication = {
        seenIds: new Set<string>(),
        idMappings: new Map<string, string[]>(),
        resultIndex: new Map<string, number>()  // Tracks which mapping to use for tool_results
    };

    // Convert messages with shared deduplication context
    for (const msg of anthropicRequest.messages) {
        const converted = convertMessage(msg, idDeduplication);
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
    // Note: metadata.user_id is intentionally NOT mapped to OpenAI's 'user' field
    // because some providers (e.g., Mistral) strictly reject unsupported parameters

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
 * Check if content is an assistant prefill token (JSON starter)
 * Anthropic supports prefilling assistant responses, but other providers don't
 */
function isAssistantPrefill(content: string): boolean {
    const prefillTokens = ['{', '[', '```', '{"', '[{'];
    const trimmed = content.trim();
    return prefillTokens.includes(trimmed) || trimmed.length <= 2;
}

/**
 * Context for tracking tool ID deduplication across messages
 */
interface IdDeduplicationContext {
    seenIds: Set<string>;
    idMappings: Map<string, string[]>;
    resultIndex: Map<string, number>;
}

/**
 * Convert a single Anthropic message to OpenAI format
 * May return multiple messages (e.g., tool results become separate messages)
 */
function convertMessage(msg: AnthropicMessage, ctx: IdDeduplicationContext): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (typeof msg.content === 'string') {
        // Simple string content
        if (msg.role === 'user') {
            result.push({ role: 'user', content: msg.content });
        } else {
            // Skip assistant prefill messages (e.g., "{" for JSON output)
            // These are Anthropic-specific and cause 400 errors with other providers
            if (isAssistantPrefill(msg.content)) {
                return result; // Return empty - skip this message
            }
            result.push({ role: 'assistant', content: msg.content });
        }
    } else {
        // Array of content blocks
        if (msg.role === 'user') {
            const { userContent, toolResults } = processUserContentBlocks(msg.content, ctx);

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
            const { textContent, toolCalls } = processAssistantContentBlocks(msg.content, ctx);

            // Skip assistant prefill messages when content is just a JSON starter
            // These are Anthropic-specific and cause 400 errors with other providers
            if (toolCalls.length === 0 && textContent && isAssistantPrefill(textContent)) {
                return result; // Return empty - skip this message
            }

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
function processUserContentBlocks(
    blocks: AnthropicContentBlock[],
    ctx: IdDeduplicationContext
): {
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

            // Look up the deduplicated ID if one exists
            let toolCallId = toolResult.tool_use_id;
            if (ctx.idMappings.has(toolResult.tool_use_id)) {
                const mappings = ctx.idMappings.get(toolResult.tool_use_id)!;
                const idx = ctx.resultIndex.get(toolResult.tool_use_id) || 0;
                if (idx < mappings.length) {
                    toolCallId = mappings[idx];
                    ctx.resultIndex.set(toolResult.tool_use_id, idx + 1);
                }
            }

            toolResults.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: toolResult.is_error ? `Error: ${content}` : content,
            });
        }
        // Images would need special handling for vision models - not implemented here
    }

    return { userContent, toolResults };
}

/**
 * Process assistant content blocks, extracting text and tool calls
 * Deduplicates tool IDs to prevent errors with providers that reject duplicates
 */
function processAssistantContentBlocks(
    blocks: AnthropicContentBlock[],
    ctx: IdDeduplicationContext
): {
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
            let idToUse = toolUse.id;

            // If we've seen this ID before, generate a unique one
            // This handles duplicate IDs without mutating the original request
            if (ctx.seenIds.has(toolUse.id)) {
                const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const originalLen = toolUse.id.length;

                if (originalLen > 11) {
                    // Keep first 8 chars, randomize the rest
                    idToUse = toolUse.id.substring(0, 8);
                    for (let i = 8; i < originalLen; i++) {
                        idToUse += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                } else {
                    // Generate entirely new ID of same length
                    idToUse = '';
                    for (let i = 0; i < originalLen; i++) {
                        idToUse += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                }
                console.log(`[adapter] Repair ID: ${toolUse.id} → ${idToUse}`);
            }
            ctx.seenIds.add(idToUse);

            // Track the mapping for tool_result matching
            if (!ctx.idMappings.has(toolUse.id)) {
                ctx.idMappings.set(toolUse.id, []);
            }
            ctx.idMappings.get(toolUse.id)!.push(idToUse);

            toolCalls.push({
                id: idToUse,
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
