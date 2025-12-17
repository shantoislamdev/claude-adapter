// Tests for tool conversion utilities
import {
    convertToolsToOpenAI,
    convertToolChoiceToOpenAI,
    generateToolUseId
} from '../src/converters/tools';
import { AnthropicToolDefinition, AnthropicToolChoice } from '../src/types/anthropic';

describe('Tool Converters', () => {
    describe('convertToolsToOpenAI', () => {
        it('should convert Anthropic tool to OpenAI function format', () => {
            const anthropicTools: AnthropicToolDefinition[] = [
                {
                    name: 'get_weather',
                    description: 'Get the current weather for a location',
                    input_schema: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City name' },
                            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
                        },
                        required: ['location']
                    }
                }
            ];

            const result = convertToolsToOpenAI(anthropicTools);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get the current weather for a location',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City name' },
                            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
                        },
                        required: ['location']
                    }
                }
            });
        });

        it('should convert multiple tools', () => {
            const anthropicTools: AnthropicToolDefinition[] = [
                {
                    name: 'tool_one',
                    description: 'First tool',
                    input_schema: { type: 'object', properties: {} }
                },
                {
                    name: 'tool_two',
                    description: 'Second tool',
                    input_schema: { type: 'object', properties: { param: { type: 'string' } } }
                }
            ];

            const result = convertToolsToOpenAI(anthropicTools);

            expect(result).toHaveLength(2);
            expect(result[0].function.name).toBe('tool_one');
            expect(result[1].function.name).toBe('tool_two');
        });
    });

    describe('convertToolChoiceToOpenAI', () => {
        it('should convert auto choice', () => {
            const choice: AnthropicToolChoice = { type: 'auto' };
            expect(convertToolChoiceToOpenAI(choice)).toBe('auto');
        });

        it('should convert any choice to required', () => {
            const choice: AnthropicToolChoice = { type: 'any' };
            expect(convertToolChoiceToOpenAI(choice)).toBe('required');
        });

        it('should convert specific tool choice', () => {
            const choice: AnthropicToolChoice = { type: 'tool', name: 'get_weather' };
            const result = convertToolChoiceToOpenAI(choice);

            expect(result).toEqual({
                type: 'function',
                function: { name: 'get_weather' }
            });
        });

        it('should fallback to auto for tool choice without name', () => {
            const choice: AnthropicToolChoice = { type: 'tool' };
            expect(convertToolChoiceToOpenAI(choice)).toBe('auto');
        });
    });

    describe('generateToolUseId', () => {
        it('should generate ID with toolu_ prefix', () => {
            const id = generateToolUseId();
            expect(id).toMatch(/^toolu_[a-zA-Z0-9]{24}$/);
        });

        it('should generate unique IDs', () => {
            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(generateToolUseId());
            }
            expect(ids.size).toBe(100);
        });
    });
});
