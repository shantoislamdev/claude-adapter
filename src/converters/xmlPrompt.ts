// XML Prompt Generator for models without native tool calling
import { AnthropicToolDefinition } from '../types/anthropic';

/**
 * Escape special XML characters in a string
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate XML tool instructions to inject into system prompt.
 * This enables models without native function calling to use tools via XML output.
 */
export function generateXmlToolInstructions(tools: AnthropicToolDefinition[]): string {
    if (!tools || tools.length === 0) {
        return '';
    }

    const toolDefinitions = tools.map(t => {
        const schemaJson = JSON.stringify(t.input_schema, null, 2);
        return `- **${t.name}**: ${escapeXml(t.description)}
  Parameters: ${schemaJson}`;
    }).join('\n\n');

    return `
# TOOL CALLING FORMAT

You have tools available. To call a tool, you MUST use this EXACT format:

<tool_code name="TOOL_NAME">
{"param": "value"}
</tool_code>

## CRITICAL RULES:
1. The tool name MUST be in the name="" attribute of the <tool_code> tag
2. The JSON arguments go INSIDE the <tool_code> tags
3. Do NOT use any other format like <tool>, <function>, or JSON blocks
4. Do NOT include thinking or explanation inside <tool_code> tags

## CORRECT EXAMPLE:
<tool_code name="Read">
{"file_path": "/path/to/file.ts"}
</tool_code>

## WRONG EXAMPLES (DO NOT USE):
- <tool_code><tool name="Read">...</tool></tool_code>  ❌
- {"tool": "Read", "args": {...}}  ❌
- \`\`\`json {...} \`\`\`  ❌

## Available Tools:

${toolDefinitions}
`;
}

/**
 * Check if a system prompt already contains XML tool instructions
 */
export function hasXmlToolInstructions(systemPrompt: string): boolean {
    return systemPrompt.includes('# TOOL CALLING FORMAT') &&
        systemPrompt.includes('<tool_code');
}
