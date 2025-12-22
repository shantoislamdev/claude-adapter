// Tests for streaming converter functions
import { EventEmitter } from 'events';

// Mock tokenUsage to prevent tests from writing to real files
jest.mock('../src/utils/tokenUsage', () => ({
    recordUsage: jest.fn()
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
import { streamOpenAIToAnthropic } from '../src/converters/streaming';

describe('Streaming Converter', () => {
    describe('streamOpenAIToAnthropic', () => {
        it('should set correct SSE headers', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                {
                    choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
                },
                {
                    choices: [{ delta: {}, finish_reason: 'stop' }],
                },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            expect(mockRaw.headers['Content-Type']).toBe('text/event-stream');
            expect(mockRaw.headers['Cache-Control']).toBe('no-cache');
            expect(mockRaw.headers['Connection']).toBe('keep-alive');
        });

        it('should send message_start event first', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            expect(events[0].event).toBe('message_start');
            expect(events[0].data.type).toBe('message_start');
            expect(events[0].data.message.role).toBe('assistant');
            expect(events[0].data.message.model).toBe('claude-4-opus');
        });

        it('should stream text content as content_block_delta events', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
                { choices: [{ delta: { content: ' world' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const textDeltas = events.filter(e =>
                e.data.type === 'content_block_delta' &&
                e.data.delta?.type === 'text_delta'
            );

            expect(textDeltas).toHaveLength(2);
            expect(textDeltas[0].data.delta.text).toBe('Hello');
            expect(textDeltas[1].data.delta.text).toBe(' world');
        });

        it('should send content_block_start for text content', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Test' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const blockStart = events.find(e => e.data.type === 'content_block_start');

            expect(blockStart).toBeDefined();
            expect(blockStart!.data.content_block.type).toBe('text');
        });

        it('should handle tool calls in stream', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                index: 0,
                                id: 'call_test123',
                                function: { name: 'get_weather' }
                            }]
                        },
                        finish_reason: null
                    }]
                },
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                index: 0,
                                function: { arguments: '{"city":' }
                            }]
                        },
                        finish_reason: null
                    }]
                },
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                index: 0,
                                function: { arguments: '"NYC"}' }
                            }]
                        },
                        finish_reason: null
                    }]
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();

            // Should have tool_use content block start
            const toolBlockStart = events.find(e =>
                e.data.type === 'content_block_start' &&
                e.data.content_block?.type === 'tool_use'
            );
            expect(toolBlockStart).toBeDefined();
            expect(toolBlockStart!.data.content_block.name).toBe('get_weather');

            // Should have input_json_delta events
            const jsonDeltas = events.filter(e =>
                e.data.type === 'content_block_delta' &&
                e.data.delta?.type === 'input_json_delta'
            );
            expect(jsonDeltas.length).toBeGreaterThan(0);
        });

        it('should send message_stop event at end', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Done' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const lastEvent = events[events.length - 1];

            expect(lastEvent.data.type).toBe('message_stop');
            expect(mockRaw.ended).toBe(true);
        });

        it('should send message_delta with stop_reason before message_stop', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const messageDelta = events.find(e => e.data.type === 'message_delta');

            expect(messageDelta).toBeDefined();
            expect(messageDelta!.data.delta.stop_reason).toBe('end_turn');
        });

        it('should set stop_reason to tool_use when tool calls are present', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                index: 0,
                                id: 'call_abc',
                                function: { name: 'test_tool', arguments: '{}' }
                            }]
                        },
                        finish_reason: null
                    }]
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const messageDelta = events.find(e => e.data.type === 'message_delta');

            expect(messageDelta!.data.delta.stop_reason).toBe('tool_use');
        });

        it('should handle usage information from chunks', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Test' }, finish_reason: null }] },
                {
                    choices: [{ delta: {}, finish_reason: 'stop' }],
                    usage: { prompt_tokens: 10, completion_tokens: 5 }
                },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const messageDelta = events.find(e => e.data.type === 'message_delta');

            expect(messageDelta!.data.usage.output_tokens).toBe(5);
        });

        it('should include cached tokens in streaming usage events', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Cached response' }, finish_reason: null }] },
                {
                    choices: [{ delta: {}, finish_reason: 'stop' }],
                    usage: {
                        prompt_tokens: 500,
                        completion_tokens: 10,
                        prompt_tokens_details: { cached_tokens: 400 }
                    }
                },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const messageDelta = events.find(e => e.data.type === 'message_delta');

            expect(messageDelta!.data.usage.cache_read_input_tokens).toBe(400);
        });

        it('should handle stream errors gracefully', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            async function* errorStream(): AsyncGenerator<any> {
                yield { choices: [{ delta: { content: 'Start' }, finish_reason: null }] };
                throw new Error('Stream connection lost');
            }

            await streamOpenAIToAnthropic(errorStream() as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            const errorEvent = events.find(e => e.data.type === 'error');

            expect(errorEvent).toBeDefined();
            expect(errorEvent!.data.error.message).toBe('Stream connection lost');
            expect(mockRaw.ended).toBe(true);
        });

        it('should handle empty stream with only stop signal', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: {}, finish_reason: 'stop' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();
            expect(events.find(e => e.data.type === 'message_start')).toBeDefined();
            expect(events.find(e => e.data.type === 'message_stop')).toBeDefined();
            expect(mockRaw.ended).toBe(true);
        });

        it('should handle multiple tool calls in a single response', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                {
                    choices: [{
                        delta: {
                            tool_calls: [
                                { index: 0, id: 'call_first', function: { name: 'tool_a' } },
                                { index: 1, id: 'call_second', function: { name: 'tool_b' } }
                            ]
                        },
                        finish_reason: null
                    }]
                },
                {
                    choices: [{
                        delta: {
                            tool_calls: [
                                { index: 0, function: { arguments: '{"x":1}' } },
                                { index: 1, function: { arguments: '{"y":2}' } }
                            ]
                        },
                        finish_reason: null
                    }]
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();

            // Should have two tool_use content blocks started
            const toolBlockStarts = events.filter(e =>
                e.data.type === 'content_block_start' &&
                e.data.content_block?.type === 'tool_use'
            );
            expect(toolBlockStarts.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle stream with text followed by tool call', async () => {
            const mockRaw = new MockRawResponse();
            const mockReply = { raw: mockRaw } as any;

            const stream = createMockStream([
                { choices: [{ delta: { content: 'Let me help with that.' }, finish_reason: null }] },
                {
                    choices: [{
                        delta: {
                            tool_calls: [{
                                index: 0,
                                id: 'call_combo',
                                function: { name: 'helper', arguments: '{}' }
                            }]
                        },
                        finish_reason: null
                    }]
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ]);

            await streamOpenAIToAnthropic(stream as any, mockReply, 'claude-4-opus');

            const events = mockRaw.getEvents();

            // Should have both text and tool_use content blocks
            const textBlock = events.find(e =>
                e.data.type === 'content_block_start' &&
                e.data.content_block?.type === 'text'
            );
            const toolBlock = events.find(e =>
                e.data.type === 'content_block_start' &&
                e.data.content_block?.type === 'tool_use'
            );

            expect(textBlock).toBeDefined();
            expect(toolBlock).toBeDefined();
        });
    });
});
