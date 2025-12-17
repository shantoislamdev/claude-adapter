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
            expect(result.messages[1]).toEqual({
                role: 'user',
                content: 'Hi there!'
            });
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
            // Should flatten or handle multiple text blocks
            expect(result.messages[0].role).toBe('user');
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
    });
});
