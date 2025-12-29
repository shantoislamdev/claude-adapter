// Tests for XML Prompt Generator
import { generateXmlToolInstructions, hasXmlToolInstructions } from '../src/converters/xmlPrompt';
import { AnthropicToolDefinition } from '../src/types/anthropic';

describe('XML Prompt Generator', () => {
    describe('generateXmlToolInstructions', () => {
        it('should return empty string for empty tools array', () => {
            const result = generateXmlToolInstructions([]);
            expect(result).toBe('');
        });

        it('should return empty string for undefined tools', () => {
            const result = generateXmlToolInstructions(undefined as any);
            expect(result).toBe('');
        });

        it('should generate instructions for single tool', () => {
            const tools: AnthropicToolDefinition[] = [{
                name: 'get_weather',
                description: 'Get the current weather',
                input_schema: {
                    type: 'object',
                    properties: {
                        city: { type: 'string' }
                    },
                    required: ['city']
                }
            }];

            const result = generateXmlToolInstructions(tools);

            expect(result).toContain('get_weather');
            expect(result).toContain('Get the current weather');
            expect(result).toContain('<tool_code name="TOOL_NAME">');
            expect(result).toContain('</tool_code>');
            expect(result).toContain('CRITICAL EXECUTION RULES');
            expect(result).toContain('Available Tools');
        });

        it('should generate instructions for multiple tools', () => {
            const tools: AnthropicToolDefinition[] = [
                {
                    name: 'read_file',
                    description: 'Read a file',
                    input_schema: { type: 'object', properties: { path: { type: 'string' } } }
                },
                {
                    name: 'write_file',
                    description: 'Write a file',
                    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
                }
            ];

            const result = generateXmlToolInstructions(tools);

            expect(result).toContain('read_file');
            expect(result).toContain('write_file');
            expect(result).toContain('Read a file');
            expect(result).toContain('Write a file');
        });

        it('should escape XML special characters', () => {
            const tools: AnthropicToolDefinition[] = [{
                name: 'test_tool',
                description: 'Handle <script> tags & "quotes"',
                input_schema: { type: 'object', properties: {} }
            }];

            const result = generateXmlToolInstructions(tools);

            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;quotes&quot;');
            expect(result).not.toContain('<script>');
        });

        it('should include parameter schema', () => {
            const tools: AnthropicToolDefinition[] = [{
                name: 'complex_tool',
                description: 'A complex tool',
                input_schema: {
                    type: 'object',
                    properties: {
                        nested: {
                            type: 'object',
                            properties: {
                                value: { type: 'number' }
                            }
                        }
                    },
                    required: ['nested']
                }
            }];

            const result = generateXmlToolInstructions(tools);

            expect(result).toContain('"nested"');
            expect(result).toContain('"type": "object"');
        });
    });

    describe('hasXmlToolInstructions', () => {
        it('should return true when instructions are present', () => {
            const prompt = `You are an AI assistant.
            
# TOOL CALLING FORMAT

You have tools available. To call a tool, you MUST use this EXACT format:

<tool_code name="TOOL_NAME">
{"param": "value"}
</tool_code>`;

            expect(hasXmlToolInstructions(prompt)).toBe(true);
        });

        it('should return false for regular prompts', () => {
            const prompt = 'You are a helpful assistant.';
            expect(hasXmlToolInstructions(prompt)).toBe(false);
        });

        it('should return false when only partial match', () => {
            const prompt = '# TOOL CALLING FORMAT';
            expect(hasXmlToolInstructions(prompt)).toBe(false);
        });
    });
});
