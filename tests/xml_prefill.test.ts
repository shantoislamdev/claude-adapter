
import { convertRequestToOpenAI } from '../src/converters/request';
import { AnthropicMessageRequest } from '../src/types/anthropic';

describe('XML Prefill Handling', () => {
    // Helper to create a request with a specific prefill
    const createRequest = (prefill: string): AnthropicMessageRequest => ({
        model: 'claude-4.5-sonnet',
        max_tokens: 1024,
        messages: [
            { role: 'user', content: 'Do something' },
            { role: 'assistant', content: prefill }
        ]
    });

    it('should strip "<" prefill', () => {
        // This is currently covered by length check <= 2, validating regression
        const result = convertRequestToOpenAI(createRequest('<'), 'gpt-4');
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
    });

    it('should strip "<tool_code" prefill', () => {
        // This requires the NEW logic
        const result = convertRequestToOpenAI(createRequest('<tool_code'), 'gpt-4');
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
    });

    it('should strip "<tool_code>" prefill', () => {
        // This requires the NEW logic
        const result = convertRequestToOpenAI(createRequest('<tool_code>'), 'gpt-4');
        expect(result.messages).toHaveLength(1);
    });

    it('should strip "<tool_code " prefill with trailing space', () => {
        // This requires the NEW logic
        const result = convertRequestToOpenAI(createRequest('<tool_code '), 'gpt-4');
        expect(result.messages).toHaveLength(1);
    });

    it('should strip specific tool prefill "<tool_code name=\\"foo\\">"', () => {
        // Prefilling a specific tool to force it
        const result = convertRequestToOpenAI(createRequest('<tool_code name="foo">'), 'gpt-4');
        expect(result.messages).toHaveLength(1);
    });

    it('should NOT strip a complete tool call (sanity check)', () => {
        const result = convertRequestToOpenAI(createRequest('<tool_code name="foo">{}</tool_code>'), 'gpt-4');
        expect(result.messages).toHaveLength(2);
        expect(result.messages[1].role).toBe('assistant');
    });
});
