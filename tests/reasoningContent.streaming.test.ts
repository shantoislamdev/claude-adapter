class MockRawResponse {
    public chunks: string[] = [];
    public headers: Record<string, string> = {};
    public ended = false;

    setHeader(name: string, value: string): void {
        this.headers[name] = value;
    }

    write(data: string): void {
        this.chunks.push(data);
    }

    end(): void {
        this.ended = true;
    }

    getEvents(): Array<{ event: string; data: any }> {
        const events: Array<{ event: string; data: any }> = [];
        let currentEvent = '';

        for (const chunk of this.chunks) {
            if (chunk.startsWith('event: ')) {
                currentEvent = chunk.slice(7).trim();
            } else if (chunk.startsWith('data: ')) {
                const data = JSON.parse(chunk.slice(6).trim());
                events.push({ event: currentEvent, data });
            }
        }

        return events;
    }
}

async function* createMockStream(chunks: any[]): AsyncGenerator<any> {
    for (const chunk of chunks) {
        yield chunk;
    }
}

jest.mock('../src/utils/tokenUsage', () => ({
    recordUsage: jest.fn(),
}));

jest.mock('../src/utils/errorLog', () => ({
    recordError: jest.fn(),
}));

import { streamOpenAIToAnthropic } from '../src/converters/streaming';

describe('Reasoning Content Streaming Bridge', () => {
    it('streams reasoning deltas as thinking content blocks when enabled', async () => {
        const mockRaw = new MockRawResponse();
        const mockReply = { raw: mockRaw } as any;

        const stream = createMockStream([
            { choices: [{ delta: { reasoning_content: 'step 1' }, finish_reason: null }] },
            { choices: [{ delta: { reasoning_content: ' step 2' }, finish_reason: null }] },
            { choices: [{ delta: { content: 'final answer' }, finish_reason: null }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]);

        await streamOpenAIToAnthropic(
            stream as any,
            mockReply,
            'claude-4-opus',
            'https://api.deepseek.com/v1'
        );

        const events = mockRaw.getEvents();
        const thinkingBlockStart = events.find(e =>
            e.data.type === 'content_block_start' &&
            e.data.content_block?.type === 'thinking'
        );
        const reasoningDeltas = events.filter(e =>
            e.data.type === 'content_block_delta' &&
            e.data.delta?.type === 'thinking_delta' &&
            (e.data.delta.thinking === 'step 1' || e.data.delta.thinking === ' step 2')
        );

        expect(thinkingBlockStart).toBeDefined();
        expect(reasoningDeltas).toHaveLength(2);
    });

    it('streams reasoning signature as signature_delta when present', async () => {
        const mockRaw = new MockRawResponse();
        const mockReply = { raw: mockRaw } as any;

        const stream = createMockStream([
            { choices: [{ delta: { reasoning_content: 'step 1' }, finish_reason: null }] },
            { choices: [{ delta: { reasoning_signature: 'sig-123' }, finish_reason: null }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]);

        await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus', 'https://example.com/v1');

        const events = mockRaw.getEvents();
        const signatureDelta = events.find(e =>
            e.data.type === 'content_block_delta' &&
            e.data.delta?.type === 'signature_delta' &&
            e.data.delta.signature === 'sig-123'
        );

        expect(signatureDelta).toBeDefined();
    });

    it('does not emit thinking blocks when stream has no reasoning delta', async () => {
        const mockRaw = new MockRawResponse();
        const mockReply = { raw: mockRaw } as any;

        const stream = createMockStream([
            { choices: [{ delta: { content: 'final answer' }, finish_reason: null }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]);

        await streamOpenAIToAnthropic(
            stream as any,
            mockReply,
            'claude-4-opus',
            'https://api.openai.com/v1'
        );

        const events = mockRaw.getEvents();
        const thinkingBlockStart = events.find(e =>
            e.data.type === 'content_block_start' &&
            e.data.content_block?.type === 'thinking'
        );

        expect(thinkingBlockStart).toBeUndefined();
    });

    it('closes thinking block before text and re-opens for later reasoning', async () => {
        const mockRaw = new MockRawResponse();
        const mockReply = { raw: mockRaw } as any;

        const stream = createMockStream([
            { choices: [{ delta: { reasoning_content: 'r1' }, finish_reason: null }] },
            { choices: [{ delta: { content: 'a1' }, finish_reason: null }] },
            { choices: [{ delta: { reasoning_content: 'r2' }, finish_reason: null }] },
            { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]);

        await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus', 'https://example.com/v1');

        const events = mockRaw.getEvents();
        const starts = events.filter(e => e.data.type === 'content_block_start').map(e => e.data.content_block?.type);
        const deltas = events.filter(e => e.data.type === 'content_block_delta').map(e => e.data.delta?.type);

        expect(starts).toEqual(['thinking', 'text', 'thinking']);
        expect(deltas).toContain('thinking_delta');
        expect(deltas).toContain('text_delta');
    });
});
