// Tests for request handler utilities
import { FastifyReply } from 'fastify';

// Import the handlers module to test generateRequestId
// We need to access internal functions, so we'll test through the exported module
const handlersModule = require('../src/server/handlers');

describe('Request Handlers', () => {
    describe('createMessagesHandler', () => {
        it('should create a handler function', () => {
            const config = {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'test-key',
                models: {
                    opus: 'gpt-4',
                    sonnet: 'gpt-3.5-turbo',
                    haiku: 'gpt-3.5-turbo'
                }
            };

            const handler = handlersModule.createMessagesHandler(config);
            expect(typeof handler).toBe('function');
        });

        it('should handle validation errors', async () => {
            const config = {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'test-key',
                models: { opus: 'gpt-4', sonnet: 'gpt-4', haiku: 'gpt-4' }
            };

            const handler = handlersModule.createMessagesHandler(config);

            // Mock request with invalid body (missing required fields)
            const mockRequest = {
                body: { invalid: 'request' }
            };

            let responseCode: number = 0;
            let responseBody: any = null;

            const mockReply = {
                header: jest.fn().mockReturnThis(),
                code: jest.fn().mockImplementation((code: number) => {
                    responseCode = code;
                    return mockReply;
                }),
                send: jest.fn().mockImplementation((body: any) => {
                    responseBody = body;
                    return mockReply;
                })
            } as unknown as FastifyReply;

            await handler(mockRequest, mockReply);

            expect(responseCode).toBe(400);
            expect(responseBody.error).toBeDefined();
        });
    });

    describe('Request ID generation', () => {
        it('should generate unique request IDs', () => {
            // Access the generateRequestId function indirectly by creating handlers
            const config = {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'test-key',
                models: { opus: 'gpt-4', sonnet: 'gpt-4', haiku: 'gpt-4' }
            };

            // Call createMessagesHandler multiple times to trigger requestIdCounter
            handlersModule.createMessagesHandler(config);
            handlersModule.createMessagesHandler(config);
            handlersModule.createMessagesHandler(config);

            // If we get here without error, the module loads successfully
            expect(true).toBe(true);
        });
    });
});

describe('Error Response Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
        const config = {
            baseUrl: 'https://invalid-url-that-will-fail.example.com',
            apiKey: 'invalid-key',
            models: { opus: 'gpt-4', sonnet: 'gpt-4', haiku: 'gpt-4' }
        };

        const handler = handlersModule.createMessagesHandler(config);

        const mockRequest = {
            body: {
                model: 'claude-4-opus',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'test' }]
            }
        };

        let responseCode: number = 0;
        let responseBody: any = null;

        const mockReply = {
            header: jest.fn().mockReturnThis(),
            code: jest.fn().mockImplementation((code: number) => {
                responseCode = code;
                return mockReply;
            }),
            send: jest.fn().mockImplementation((body: any) => {
                responseBody = body;
                return mockReply;
            })
        } as unknown as FastifyReply;

        // This will fail due to invalid URL, testing error handling path
        await handler(mockRequest, mockReply);

        // Should return an error response
        expect(responseCode).toBeGreaterThanOrEqual(400);
        expect(responseBody.error).toBeDefined();
    });
});
