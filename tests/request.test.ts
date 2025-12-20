// Tests for request converter: Anthropic → OpenAI
import { convertRequestToOpenAI } from '../src/converters/request';
import { AnthropicMessageRequest } from '../src/types/anthropic';

describe('Request Converter', () => {
    describe('convertRequestToOpenAI', () => {
        it('should convert a simple text message', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 'Hello, how are you?' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-codex');

            expect(result.model).toBe('gpt-5.2-codex');
            expect(result.max_tokens).toBe(1024);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({
                role: 'user',
                content: 'Hello, how are you?'
            });
        });

        it('should convert system prompt to system message', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-opus',
                max_tokens: 2048,
                system: 'You are a helpful assistant.',
                messages: [
                    { role: 'user', content: 'Hi there!' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-codex');

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toEqual({
                role: 'system',
                content: 'You are a helpful assistant.'
            });
        });

        it('should convert system array to concatenated system message', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-opus',
                max_tokens: 2048,
                system: [
                    { type: 'text', text: 'You are helpful.' },
                    { type: 'text', text: 'Be concise.' }
                ],
                messages: [
                    { role: 'user', content: 'Hi!' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('You are helpful.');
            expect(result.messages[0].content).toContain('Be concise.');
        });

        it('should convert multi-turn conversation', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-haiku',
                max_tokens: 512,
                messages: [
                    { role: 'user', content: 'What is 2+2?' },
                    { role: 'assistant', content: '2+2 equals 4.' },
                    { role: 'user', content: 'And 3+3?' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-mini');

            expect(result.messages).toHaveLength(3);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[1].role).toBe('assistant');
            expect(result.messages[2].role).toBe('user');
        });

        it('should convert content blocks array in user message', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'First part.' },
                            { type: 'text', text: 'Second part.' }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-codex');

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
        });

        it('should collapse single text block to string', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Only one block' }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.messages[0].content).toBe('Only one block');
        });

        it('should include optional parameters when provided', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 0.9,
                stop_sequences: ['END', 'STOP'],
                messages: [
                    { role: 'user', content: 'Test message' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-codex');

            expect(result.temperature).toBe(0.7);
            expect(result.top_p).toBe(0.9);
            expect(result.stop).toEqual(['END', 'STOP']);
        });

        it('should handle stream parameter', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                stream: true,
                messages: [
                    { role: 'user', content: 'Stream this' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-5.2-codex');

            expect(result.stream).toBe(true);
        });

        it('should NOT include user metadata (for provider compatibility)', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                metadata: { user_id: 'user_123' },
                messages: [
                    { role: 'user', content: 'Hello' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            // user field should NOT be set - some providers (Mistral) reject unknown params
            expect(result.user).toBeUndefined();
        });

        it('should convert tool definitions', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                tools: [
                    {
                        name: 'get_weather',
                        description: 'Get weather',
                        input_schema: { type: 'object', properties: {} }
                    }
                ],
                messages: [
                    { role: 'user', content: 'Hello' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.tools).toBeDefined();
            expect(result.tools).toHaveLength(1);
            expect(result.tools![0].function.name).toBe('get_weather');
        });

        it('should convert tool_choice', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                tool_choice: { type: 'auto' },
                messages: [
                    { role: 'user', content: 'Hello' }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.tool_choice).toBe('auto');
        });
    });

    describe('Tool use conversion', () => {
        it('should convert assistant tool_use blocks to tool_calls', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 'Get the weather' },
                    {
                        role: 'assistant',
                        content: [
                            {
                                type: 'tool_use',
                                id: 'toolu_123',
                                name: 'get_weather',
                                input: { city: 'NYC' }
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.messages).toHaveLength(2);
            const assistantMsg = result.messages[1] as any;
            expect(assistantMsg.role).toBe('assistant');
            expect(assistantMsg.tool_calls).toBeDefined();
            expect(assistantMsg.tool_calls[0].id).toBe('toolu_123');
            expect(assistantMsg.tool_calls[0].function.name).toBe('get_weather');
        });

        it('should convert user tool_result blocks to tool messages', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'toolu_123',
                                content: 'Sunny, 72°F'
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('tool');
            expect((result.messages[0] as any).tool_call_id).toBe('toolu_123');
            expect((result.messages[0] as any).content).toBe('Sunny, 72°F');
        });

        it('should handle tool_result with array content', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'toolu_456',
                                content: [
                                    { type: 'text', text: 'Result 1' },
                                    { type: 'text', text: 'Result 2' }
                                ]
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect((result.messages[0] as any).content).toContain('Result 1');
            expect((result.messages[0] as any).content).toContain('Result 2');
        });

        it('should handle tool_result with is_error flag', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'toolu_789',
                                content: 'Connection failed',
                                is_error: true
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect((result.messages[0] as any).content).toContain('Error:');
        });

        it('should handle tool_result with empty content', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'toolu_empty',
                                content: undefined as any
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            expect((result.messages[0] as any).content).toBe('');
        });

        it('should handle mixed text and tool_result in user message', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: 'toolu_mix',
                                content: 'Tool output'
                            },
                            { type: 'text', text: 'Now process this' }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            // Should have tool message + user message
            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('tool');
            expect(result.messages[1].role).toBe('user');
        });

        it('should handle assistant with text and tool_use', () => {
            const anthropicRequest: AnthropicMessageRequest = {
                model: 'claude-4.5-sonnet',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'assistant',
                        content: [
                            { type: 'text', text: 'Let me check that.' },
                            {
                                type: 'tool_use',
                                id: 'toolu_combo',
                                name: 'search',
                                input: { query: 'test' }
                            }
                        ]
                    }
                ]
            };

            const result = convertRequestToOpenAI(anthropicRequest, 'gpt-4');

            const assistantMsg = result.messages[0] as any;
            expect(assistantMsg.content).toBe('Let me check that.');
            expect(assistantMsg.tool_calls).toHaveLength(1);
        });
    });
});

