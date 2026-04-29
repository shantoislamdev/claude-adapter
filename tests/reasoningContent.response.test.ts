import { convertResponseToAnthropic } from '../src/converters/response';
import { OpenAIChatResponse } from '../src/types/openai';

describe('Reasoning Content Response Bridge', () => {
    it('maps reasoning_content to thinking block when enabled', () => {
        const response: OpenAIChatResponse = {
            id: 'chatcmpl-reasoning',
            object: 'chat.completion',
            created: Date.now(),
            model: 'deepseek-v4-pro',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Final answer',
                        reasoning_content: 'reasoning trace',
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        };

        const result = convertResponseToAnthropic(response, 'claude-4-opus');

        expect(result.content[0]).toEqual({
            type: 'thinking',
            thinking: 'reasoning trace',
        });
        expect(result.content[1]).toEqual({
            type: 'text',
            text: 'Final answer',
        });
    });

    it('maps reasoning_signature to thinking signature', () => {
        const response: OpenAIChatResponse = {
            id: 'chatcmpl-reasoning-sig',
            object: 'chat.completion',
            created: Date.now(),
            model: 'deepseek-v4-pro',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Final answer',
                        reasoning_content: 'reasoning trace',
                        reasoning_signature: 'sig-xyz',
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        };

        const result = convertResponseToAnthropic(response, 'claude-4-opus');

        expect(result.content[0]).toEqual({
            type: 'thinking',
            thinking: 'reasoning trace',
            signature: 'sig-xyz',
        });
    });

    it('keeps old behavior when reasoning_content is absent', () => {
        const response: OpenAIChatResponse = {
            id: 'chatcmpl-reasoning-off',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Final answer'
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        };

        const result = convertResponseToAnthropic(response, 'claude-4-opus');

        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toEqual({
            type: 'text',
            text: 'Final answer',
        });
    });
});
