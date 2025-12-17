// Tool/Function conversion utilities
import { AnthropicToolDefinition, AnthropicToolChoice } from '../types/anthropic';
import { OpenAITool, OpenAIToolChoice } from '../types/openai';

/**
 * Convert Anthropic tool definitions to OpenAI function format
 */
export function convertToolsToOpenAI(tools: AnthropicToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
        },
    }));
}

/**
 * Convert Anthropic tool choice to OpenAI format
 */
export function convertToolChoiceToOpenAI(
    toolChoice: AnthropicToolChoice
): OpenAIToolChoice {
    switch (toolChoice.type) {
        case 'auto':
            return 'auto';
        case 'any':
            return 'required'; // OpenAI's equivalent - forces tool use
        case 'tool':
            if (toolChoice.name) {
                return {
                    type: 'function',
                    function: { name: toolChoice.name },
                };
            }
            return 'auto';
        default:
            return 'auto';
    }
}

/**
 * Generate a unique tool use ID in Anthropic format
 */
export function generateToolUseId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'toolu_';
    for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
