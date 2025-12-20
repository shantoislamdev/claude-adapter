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

    // Repair duplicate tool_use IDs in the conversation history
    // This handles cases where previous buggy versions created history with duplicates
    // We need to track the sequence of IDs to properly map results to uses
    const toolUseIds = new Set<string>();
    const idReplacements = new Map<string, string[]>();

    // First pass: Deduplicate tool_use IDs and record the sequence
    for (const msg of anthropicRequest.messages) {
        if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === 'tool_use') {
                    const toolUse = block as AnthropicToolUseBlock;
                    const originalId = toolUse.id;

                    let idToUse = originalId;

                    // If we've seen this ID before, we must generate a new unique one
                    if (toolUseIds.has(originalId)) {
                        idToUse = `repaired_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
                        console.log(`[adapter] ID repair: ${originalId} → ${idToUse}`);
                        toolUse.id = idToUse;
                    }

                    toolUseIds.add(idToUse);

                    // Track the sequence of IDs for this original ID
                    if (!idReplacements.has(originalId)) {
                        idReplacements.set(originalId, []);
                    }
                    idReplacements.get(originalId)!.push(idToUse);
                }
            }
        }
    }

    // Second pass: Update tool_result IDs to match the repaired sequences
    const resultConsumption = new Map<string, number>();

    for (const msg of anthropicRequest.messages) {
        if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === 'tool_result') {
                    const toolResult = block as AnthropicToolResultBlock;
                    const originalId = toolResult.tool_use_id;

                    if (idReplacements.has(originalId)) {
                        const replacements = idReplacements.get(originalId)!;
                        const validIndex = resultConsumption.get(originalId) || 0;

                        if (validIndex < replacements.length) {
                            const newId = replacements[validIndex];
                            if (newId !== originalId) {
                                console.log(`[adapter] ID update: ${originalId} → ${newId}`);
                                toolResult.tool_use_id = newId;
                            }
                            resultConsumption.set(originalId, validIndex + 1);
                        }
                    }
                }
            }
        }
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
