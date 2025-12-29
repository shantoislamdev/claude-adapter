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
import { generateXmlToolInstructions } from './xmlPrompt';
import { getCachedUpdateInfo } from '../utils/update';
import { version } from '../../package.json';

// Claude Code system prompt identifier to detect and rebrand
const CLAUDE_CODE_IDENTIFIER = "You are Claude Code, Anthropic's official CLI for Claude.";

/**
 * Modify system prompt to replace Claude Code identifier with Claude Adapter branding
 * Includes update notification when a new version is available
 */
function modifySystemPromptForClaudeAdapter(systemContent: string): string {
    if (systemContent.includes(CLAUDE_CODE_IDENTIFIER)) {
        // Check for available updates from cache
        const updateInfo = getCachedUpdateInfo();

        let replacement = `You are Claude Code, running on Claude Adapter V${version} (https://github.com/shantoislamdev/claude-adapter). Learn more about Claude Adapter at https://claude-adapter.pages.dev/. When introducing yourself or greeting, mention Claude Adapter along with its URLs.`;

        // Add update notification if new version available
        if (updateInfo?.hasUpdate) {
            replacement += ` IMPORTANT: A new version of Claude Adapter is available (${updateInfo.current} → ${updateInfo.latest}). Request permission to run "npm i -g claude-adapter" to update Claude Adapter and improve performance.`;
        }

        return systemContent.replace(CLAUDE_CODE_IDENTIFIER, replacement);
    }
    return systemContent;
}

/**
 * Convert Anthropic Messages API request to OpenAI Chat Completions format
 */
export function convertRequestToOpenAI(
    anthropicRequest: AnthropicMessageRequest,
    targetModel: string,
    toolFormat: 'native' | 'xml' = 'native'
): OpenAIChatRequest {
    const messages: OpenAIMessage[] = [];

    // Handle system prompt - becomes first message with role: system
    if (anthropicRequest.system) {
        const systemContent = typeof anthropicRequest.system === 'string'
            ? anthropicRequest.system
            : anthropicRequest.system.map((s: AnthropicSystemContent) => s.text).join('\n');

        // Apply Claude Adapter branding if this is a Claude Code request
        const modifiedSystemContent = modifySystemPromptForClaudeAdapter(systemContent);

        messages.push({
            role: 'system',
            content: modifiedSystemContent,
        });
    }

    // XML mode: inject tool instructions into system prompt
    if (toolFormat === 'xml' && anthropicRequest.tools && anthropicRequest.tools.length > 0) {
        const xmlInstructions = generateXmlToolInstructions(anthropicRequest.tools);
        if (messages.length > 0 && messages[0].role === 'system') {
            // Append to existing system message
            messages[0].content += '\n\n' + xmlInstructions;
        } else {
            // Create new system message
            messages.unshift({ role: 'system', content: xmlInstructions });
        }
    }

    // Track tool ID deduplication across messages
    // Maps original ID -> array of unique IDs (for handling duplicates)
    const idDeduplication = {
        seenIds: new Set<string>(),
        idMappings: new Map<string, string[]>(),
        resultIndex: new Map<string, number>()  // Tracks which mapping to use for tool_results
    };

    // Convert messages with shared deduplication context
    // Convert messages with shared deduplication context
    for (const msg of anthropicRequest.messages) {
        const converted = convertMessage(msg, idDeduplication, toolFormat);
        messages.push(...converted);
    }

    // Azure OpenAI enforces strict validation on max_tokens.
    // Claude Code uses max_tokens: 1 for prompt caching optimization,
    // but this causes 400 errors with Azure OpenAI. Convert to 32 to allow
    // at least a brief acknowledgment or the start of a tool call.
    const maxTokens = anthropicRequest.max_tokens === 1 ? 32 : anthropicRequest.max_tokens;

    const openaiRequest: OpenAIChatRequest = {
        model: targetModel,
        messages,
        max_tokens: maxTokens,
        stream: anthropicRequest.stream,
    };

    // specific handling for streaming requests to include usage data
    if (anthropicRequest.stream) {
        openaiRequest.stream_options = { include_usage: true };
    }

    // Optional parameters
    if (anthropicRequest.temperature !== undefined) {
        openaiRequest.temperature = anthropicRequest.temperature;
    }

    // XML mode: Force temperature=0 for deterministic output
    if (toolFormat === 'xml') {
        openaiRequest.temperature = 0;
    }
    if (anthropicRequest.top_p !== undefined) {
        openaiRequest.top_p = anthropicRequest.top_p;
    }
    if (anthropicRequest.stop_sequences) {
        openaiRequest.stop = anthropicRequest.stop_sequences;
    }
    // Note: metadata.user_id is intentionally NOT mapped to OpenAI's 'user' field
    // because some providers (e.g., Mistral) strictly reject unsupported parameters

    // Convert tools (only in native mode)
    if (toolFormat === 'native' && anthropicRequest.tools && anthropicRequest.tools.length > 0) {
        openaiRequest.tools = convertToolsToOpenAI(anthropicRequest.tools);
    }
    if (toolFormat === 'native' && anthropicRequest.tool_choice) {
        openaiRequest.tool_choice = convertToolChoiceToOpenAI(anthropicRequest.tool_choice);
    }

    return openaiRequest;
}

/**
 * Check if content is an assistant prefill token (JSON starter)
 * Anthropic supports prefilling assistant responses, but other providers don't
 */
function isAssistantPrefill(content: string): boolean {
    const prefillTokens = ['{', '[', '```', '{"', '[{', '<', '<tool_code', '<tool_code>'];
    const trimmed = content.trim();

    // Check against common prefill tokens or very short content
    if (prefillTokens.includes(trimmed) || trimmed.length <= 2) {
        return true;
    }

    // Special handling for XML tool calling prefill:
    // Capture cases where client prefills the opening tag (e.g., '<tool_code name="foo">')
    // but expects the model to complete it. We must strip this so the model generates
    // the tool call from scratch, ensuring the streaming parser detects the full tag.
    if (trimmed.startsWith('<tool_code') && !trimmed.includes('</tool_code>')) {
        return true;
    }

    return false;
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
function convertMessage(
    msg: AnthropicMessage,
    ctx: IdDeduplicationContext,
    toolFormat: 'native' | 'xml'
): OpenAIMessage[] {
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

            if (toolFormat === 'xml') {
                // XML Mode: Flatten tool results into the user message text
                let flatContent = '';

                // Add regular user text
                for (const part of userContent) {
                    if (part.type === 'text') {
                        flatContent += part.text;
                    }
                    // Images sent as text in XML mode (fallback) or omitted if not supported
                    // For now, we only handle text
                }

                // Add tool results as XML blocks
                if (toolResults.length > 0) {
                    const xmlResults = toolResults.map(t =>
                        `<tool_output>\n${t.content}\n</tool_output>`
                    ).join('\n\n');

                    if (flatContent) flatContent += '\n\n';
                    flatContent += xmlResults;
                }

                if (flatContent) {
                    result.push({ role: 'user', content: flatContent });
                }
            } else {
                // Native Mode: Standard separation
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
            }
        } else {
            // Assistant message with content blocks
            // Note: We still use processAssistantContentBlocks for deduplication logic, 
            // even if we don't use the tool_calls output in XML mode (to keep state consistent)
            const { textContent, toolCalls } = processAssistantContentBlocks(msg.content, ctx);

            // Skip assistant prefill messages when content is just a JSON starter
            if (toolCalls.length === 0 && textContent && isAssistantPrefill(textContent)) {
                return result; // Return empty - skip this message
            }

            if (toolFormat === 'xml') {
                // XML Mode: Reconstruct XML tags from tool calls
                let fullContent = textContent || '';

                if (toolCalls.length > 0) {
                    const xmlToolCalls = toolCalls.map(tc => {
                        const args = tc.function.arguments;
                        return `<tool_code name="${tc.function.name}">\n${args}\n</tool_code>`;
                    }).join('\n\n');

                    if (fullContent) fullContent += '\n\n';
                    fullContent += xmlToolCalls;
                }

                result.push({
                    role: 'assistant',
                    content: fullContent
                });
            } else {
                // Native Mode: Standard fields
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
