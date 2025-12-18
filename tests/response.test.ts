// Tests for response converter: OpenAI → Anthropic
import { convertResponseToAnthropic, createErrorResponse } from '../src/converters/response';
import { OpenAIChatResponse } from '../src/types/openai';

describe('Response Converter', () => {
    describe('convertResponseToAnthropic', () => {
        it('should convert a simple text response', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-5.2-codex',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: 'Hello!' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude-4.5-sonnet');

            expect(result.id).toContain('msg_');
            expect(result.type).toBe('message');
            expect(result.role).toBe('assistant');
            expect(result.model).toBe('claude-4.5-sonnet');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
            expect(result.stop_reason).toBe('end_turn');
            expect(result.usage.input_tokens).toBe(10);
            expect(result.usage.output_tokens).toBe(15);
        });

        it('should map stop finish_reason to end_turn', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'test',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: 'Test' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
            };

            expect(convertResponseToAnthropic(openaiResponse, 'claude').stop_reason).toBe('end_turn');
        });

        it('should map length finish_reason to max_tokens', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'test',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: 'Test' },
                    finish_reason: 'length'
                }],
                usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
            };

            expect(convertResponseToAnthropic(openaiResponse, 'claude').stop_reason).toBe('max_tokens');
        });

        it('should map tool_calls finish_reason to tool_use', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'test',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } }] },
                    finish_reason: 'tool_calls'
                }],
                usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
            };

            expect(convertResponseToAnthropic(openaiResponse, 'claude').stop_reason).toBe('tool_use');
        });

        it('should convert tool calls to tool_use blocks', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-456',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [{
                            id: 'call_abc123',
                            type: 'function',
                            function: { name: 'get_weather', arguments: '{"location": "NYC"}' }
                        }]
                    },
                    finish_reason: 'tool_calls'
                }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('tool_use');
            expect((result.content[0] as any).id).toBe('call_abc123');
            expect((result.content[0] as any).name).toBe('get_weather');
        });

        it('should handle multiple tool calls', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-multi',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                            { id: 'call_1', type: 'function', function: { name: 'tool_a', arguments: '{}' } },
                            { id: 'call_2', type: 'function', function: { name: 'tool_b', arguments: '{}' } }
                        ]
                    },
                    finish_reason: 'tool_calls'
                }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude');
            expect(result.content).toHaveLength(2);
        });

        it('should handle text with tool calls', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-combo',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Let me check.',
                        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }]
                    },
                    finish_reason: 'tool_calls'
                }],
                usage: { prompt_tokens: 30, completion_tokens: 25, total_tokens: 55 }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude');
            expect(result.content).toHaveLength(2);
            expect(result.content[0].type).toBe('text');
            expect(result.content[1].type).toBe('tool_use');
        });
    });

    describe('createErrorResponse', () => {
        it('should create error with correct type for 400', () => {
            const result = createErrorResponse(new Error('Bad request'), 400);
            expect(result.status).toBe(400);
            expect(result.error.type).toBe('invalid_request_error');
            expect(result.error.message).toBe('Bad request');
        });

        it('should map 401 to authentication_error', () => {
            expect(createErrorResponse(new Error(''), 401).error.type).toBe('authentication_error');
        });

        it('should map 403 to permission_error', () => {
            expect(createErrorResponse(new Error(''), 403).error.type).toBe('permission_error');
        });

        it('should map 404 to not_found_error', () => {
            expect(createErrorResponse(new Error(''), 404).error.type).toBe('not_found_error');
        });

        it('should map 429 to rate_limit_error', () => {
            expect(createErrorResponse(new Error(''), 429).error.type).toBe('rate_limit_error');
        });

        it('should map 500 to api_error', () => {
            expect(createErrorResponse(new Error(''), 500).error.type).toBe('api_error');
        });

        it('should default to api_error for unknown codes', () => {
            expect(createErrorResponse(new Error(''), 502).error.type).toBe('api_error');
        });
    });
});
