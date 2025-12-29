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

You are required to use tools to fetch information or perform actions.
To invoke a tool, you MUST use the following EXACT XML format.
ANY deviation from this format will cause the tool call to fail.

<tool_code name="TOOL_NAME">
{"argument_name": "value"}
</tool_code>

## CRITICAL EXECUTION RULES:
1. **NO Markdown**: Do NOT wrap the XML in \`\`\`xml or \`\`\` code blocks. Output the raw XML tags directly.
2. **Valid JSON**: The content between the tags MUST be valid, parseable JSON.
   - Use double quotes for keys and string values.
   - No trailing commas.
   - No comments using // or /*.
3. **Exact Name Match**: The \`name\` attribute MUST match a tool name from the "Available Tools" list exactly (case-sensitive).
4. **No Nested Content**: The JSON parameters must be the direct child of \`tool_code\`. Do not nest another \`tool\` or \`function\` tag inside.
5. **Thinking**: If you need to think or explain your reasoning, do so in text BEFORE the \`<tool_code>\` block. Do NOT put thoughts inside the tool code.
6. **Multiple Tools**: You may call multiple tools in sequence by outputting multiple \`<tool_code>\` blocks.

## EXAMPLE (Correct):
Thinking: I need to read the file.
<tool_code name="Read">
{"file_path": "src/utils.ts"}
</tool_code>

## EXAMPLES (Incorrect - DO NOT USE):
Wrapped in code blocks:
\`\`\`xml
<tool_code name="Read">...</tool_code>
\`\`\`

Nested tags:
<tool_code><tool name="Read">...</tool></tool_code>

Invalid JSON (keys not quoted):
<tool_code name="Read">
{file_path: "src/utils.ts"}
</tool_code>

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
