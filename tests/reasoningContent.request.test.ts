import { convertRequestToOpenAI } from '../src/converters/request';
import { AnthropicMessageRequest } from '../src/types/anthropic';

describe('Reasoning Content Request Bridge', () => {
    it('maps assistant thinking block to reasoning_content', () => {
        const request: AnthropicMessageRequest = {
            model: 'claude-4-opus',
            max_tokens: 1024,
            messages: [
                {
                    role: 'assistant',
                    content: [
                        { type: 'thinking', thinking: 'internal chain of thought' },
                        { type: 'text', text: 'Previous answer' },
                    ],
                },
                { role: 'user', content: 'Follow-up question' },
            ],
        };

        const result = convertRequestToOpenAI(
            request,
            'deepseek-v4-pro',
            'native'
        );

        const assistantMessage = result.messages[0] as any;
        expect(assistantMessage.role).toBe('assistant');
        expect(assistantMessage.content).toBe('Previous answer');
        expect(assistantMessage.reasoning_content).toBe('internal chain of thought');
    });

    it('maps assistant thinking signature to reasoning_signature', () => {
        const request: AnthropicMessageRequest = {
            model: 'claude-4-opus',
            max_tokens: 1024,
            messages: [
                {
                    role: 'assistant',
                    content: [
                        { type: 'thinking', thinking: 'internal chain of thought', signature: 'sig-abc' },
                        { type: 'text', text: 'Previous answer' },
                    ],
                },
                { role: 'user', content: 'Follow-up question' },
            ],
        };

        const result = convertRequestToOpenAI(request, 'deepseek-v4-pro', 'native');
        const assistantMessage = result.messages[0] as any;

        expect(assistantMessage.reasoning_signature).toBe('sig-abc');
    });

    it('does not add reasoning_content when there is no thinking block', () => {
        const request: AnthropicMessageRequest = {
            model: 'claude-4-opus',
            max_tokens: 1024,
            messages: [
                {
                    role: 'assistant',
                    content: [
                        { type: 'text', text: 'Previous answer' },
                    ],
                },
                { role: 'user', content: 'Follow-up question' },
            ],
        };

        const result = convertRequestToOpenAI(
            request,
            'gpt-4',
            'native'
        );

        const assistantMessage = result.messages[0] as any;
        expect(assistantMessage.reasoning_content).toBeUndefined();
    });
});
