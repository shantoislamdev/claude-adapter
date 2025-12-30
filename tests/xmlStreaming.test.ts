// Tests for XML Streaming Converter

// Mock tokenUsage to prevent tests from writing to real files
jest.mock('../src/utils/tokenUsage', () => ({
    recordUsage: jest.fn()
}));

// Mock errorLog to prevent tests from writing to real files
jest.mock('../src/utils/errorLog', () => ({
    recordError: jest.fn()
}));

// Mock raw response for SSE
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

// Mock async iterator for OpenAI stream
async function* createMockStream(chunks: any[]): AsyncGenerator<any> {
    for (const chunk of chunks) {
        yield chunk;
    }
}

// Import after mocks are set up
import { streamXmlOpenAIToAnthropic } from '../src/converters/xmlStreaming';

describe('XML Streaming Converter', () => {
    describe('streamXmlOpenAIToAnthropic', () => {
        it('should set correct SSE headers', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            expect(mockRaw.headers['Content-Type']).toBe('text/event-stream');
            expect(mockRaw.headers['Cache-Control']).toBe('no-cache');
        });

        it('should stream plain text without tool calls', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Hello world' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();

            expect(events[0].data.type).toBe('message_start');

            const textDelta = events.find(e =>
                e.data.type === 'content_block_delta' &&
                e.data.delta?.type === 'text_delta'
            );
            expect(textDelta).toBeDefined();
            expect(textDelta!.data.delta.text).toBe('Hello world');
        });

        it('should detect XML tool call and emit tool_use events', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: '<tool_code name="get_weather">{"city": "NYC"}</tool_code>' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();

            // Should have tool_use content block start
            const toolBlockStart = events.find(e =>
                e.data.type === 'content_block_start' &&
                e.data.content_block?.type === 'tool_use'
            );
            expect(toolBlockStart).toBeDefined();
            expect(toolBlockStart!.data.content_block.name).toBe('get_weather');

            // Should have input_json_delta
            const jsonDelta = events.find(e =>
                e.data.type === 'content_block_delta' &&
                e.data.delta?.type === 'input_json_delta'
            );
            expect(jsonDelta).toBeDefined();
        });

        it('should handle text before tool call', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Let me help. <tool_code name="helper">{"a":1}</tool_code>' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();

            // Should have text content (trimmed by new implementation)
            const textDelta = events.find(e =>
                e.data.type === 'content_block_delta' &&
                e.data.delta?.type === 'text_delta'
            );
            expect(textDelta?.data.delta.text).toBe('Let me help.');

            // Should also have tool_use
            const toolBlock = events.find(e =>
                e.data.content_block?.type === 'tool_use'
            );
            expect(toolBlock).toBeDefined();
        });

        it('should handle streaming tool call across multiple chunks', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: '<tool_code name="test">' }, finish_reason: null }] },
                { choices: [{ delta: { content: '{"key": ' }, finish_reason: null }] },
                { choices: [{ delta: { content: '"value"}' }, finish_reason: null }] },
                { choices: [{ delta: { content: '</tool_code>' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();

            // Should have tool_use block
            const toolBlock = events.find(e =>
                e.data.content_block?.type === 'tool_use'
            );
            expect(toolBlock).toBeDefined();
            expect(toolBlock!.data.content_block.name).toBe('test');

            // Should have multiple input_json_delta events
            const jsonDeltas = events.filter(e =>
                e.data.delta?.type === 'input_json_delta'
            );
            expect(jsonDeltas.length).toBeGreaterThan(0);
        });

        it('should send message_stop at end', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Done' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamXmlOpenAIToAnthropic(stream as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();
            const lastEvent = events[events.length - 1];

            expect(lastEvent.data.type).toBe('message_stop');
            expect(mockRaw.ended).toBe(true);
        });

        it('should handle stream errors', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            async function* errorStream(): AsyncGenerator<any> {
                yield { choices: [{ delta: { content: 'Start' }, finish_reason: null }] };
                throw new Error('Connection lost');
            }

            await streamXmlOpenAIToAnthropic(errorStream() as any, mockReply, 'test-model');

            const events = mockRaw.getEvents();
            const errorEvent = events.find(e => e.data.type === 'error');

            expect(errorEvent).toBeDefined();
            expect(errorEvent!.data.error.message).toBe('Connection lost');
            expect(mockRaw.ended).toBe(true);
        });
    });
});
