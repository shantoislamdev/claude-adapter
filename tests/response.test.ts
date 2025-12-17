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
                model: 'gpt-4',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'Hello! I am doing well, thank you for asking.'
                        },
                        finish_reason: 'stop'
                    }
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 15,
                    total_tokens: 25
                }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude-3-sonnet-20240229');

            expect(result.id).toContain('msg_');
            expect(result.type).toBe('message');
            expect(result.role).toBe('assistant');
            expect(result.model).toBe('claude-3-sonnet-20240229');
            expect(result.content).toHaveLength(1);
            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Hello! I am doing well, thank you for asking.'
            });
            expect(result.stop_reason).toBe('end_turn');
            expect(result.usage.input_tokens).toBe(10);
            expect(result.usage.output_tokens).toBe(15);
        });

        it('should map finish_reason correctly', () => {
            const createResponse = (finishReason: string): OpenAIChatResponse => ({
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [
                    {
                        index: 0,
                        message: { role: 'assistant', content: 'Test' },
                        finish_reason: finishReason as any
                    }
                ],
                usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 }
            });

            expect(convertResponseToAnthropic(createResponse('stop'), 'claude').stop_reason).toBe('end_turn');
            expect(convertResponseToAnthropic(createResponse('length'), 'claude').stop_reason).toBe('max_tokens');
            expect(convertResponseToAnthropic(createResponse('tool_calls'), 'claude').stop_reason).toBe('tool_use');
        });

        it('should convert tool calls to tool_use blocks', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-456',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [
                                {
                                    id: 'call_abc123',
                                    type: 'function',
                                    function: {
                                        name: 'get_weather',
                                        arguments: '{"location": "San Francisco", "unit": "celsius"}'
                                    }
                                }
                            ]
                        },
                        finish_reason: 'tool_calls'
                    }
                ],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 20,
                    total_tokens: 70
                }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude-3-opus-20240229');

            expect(result.stop_reason).toBe('tool_use');
            expect(result.content).toHaveLength(1);
            expect(result.content[0]).toEqual({
                type: 'tool_use',
                id: 'call_abc123',
                name: 'get_weather',
                input: { location: 'San Francisco', unit: 'celsius' }
            });
        });

        it('should handle response with both text and tool calls', () => {
            const openaiResponse: OpenAIChatResponse = {
                id: 'chatcmpl-789',
                object: 'chat.completion',
                created: 1677652288,
                model: 'gpt-4',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'Let me check the weather for you.',
                            tool_calls: [
                                {
                                    id: 'call_xyz789',
                                    type: 'function',
                                    function: {
                                        name: 'get_weather',
                                        arguments: '{"location": "New York"}'
                                    }
                                }
                            ]
                        },
                        finish_reason: 'tool_calls'
                    }
                ],
                usage: { prompt_tokens: 30, completion_tokens: 25, total_tokens: 55 }
            };

            const result = convertResponseToAnthropic(openaiResponse, 'claude-3-sonnet-20240229');

            expect(result.content).toHaveLength(2);
            expect(result.content[0]).toEqual({
                type: 'text',
                text: 'Let me check the weather for you.'
            });
            expect(result.content[1].type).toBe('tool_use');
        });
    });

    describe('createErrorResponse', () => {
        it('should create error response with correct type', () => {
            const error = new Error('Invalid request');
            const result = createErrorResponse(error, 400);

            expect(result.status).toBe(400);
            expect(result.error.type).toBe('invalid_request_error');
            expect(result.error.message).toBe('Invalid request');
        });

        it('should map status codes to error types', () => {
            expect(createErrorResponse(new Error(''), 401).error.type).toBe('authentication_error');
            expect(createErrorResponse(new Error(''), 403).error.type).toBe('permission_error');
            expect(createErrorResponse(new Error(''), 404).error.type).toBe('not_found_error');
            expect(createErrorResponse(new Error(''), 429).error.type).toBe('rate_limit_error');
            expect(createErrorResponse(new Error(''), 500).error.type).toBe('api_error');
        });
    });
});
