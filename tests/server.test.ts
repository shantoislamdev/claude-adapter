// Tests for server setup (no port binding)
import { createServer } from '../src/server';
import { AdapterConfig } from '../src/types/config';

// Mock logger
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        withRequestId: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        })),
    },
    LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}));

const testConfig: AdapterConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    models: {
        opus: 'gpt-4',
        sonnet: 'gpt-4',
        haiku: 'gpt-3.5-turbo',
    },
};

describe('Server', () => {
    describe('createServer', () => {
        it('should create a server with app instance', () => {
            const server = createServer(testConfig);
            expect(server).toBeDefined();
            expect(server.app).toBeDefined();
            expect(typeof server.start).toBe('function');
            expect(typeof server.stop).toBe('function');
        });

        it('should register health endpoint', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('ok');
            expect(body.adapter).toBe('claude-adapter');
        });

        it('should register messages endpoint', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'POST',
                url: '/v1/messages',
                payload: {},
            });

            expect(response.statusCode).toBe(400);
        });

        it('should handle OPTIONS for CORS', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'OPTIONS',
                url: '/v1/messages',
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBe('*');
            expect(response.headers['access-control-allow-methods']).toContain('POST');
        });

        it('should set CORS headers on GET', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.headers['access-control-allow-origin']).toBe('*');
        });

        it('should set CORS headers on POST', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'POST',
                url: '/v1/messages',
                payload: {},
            });

            expect(response.headers['access-control-allow-origin']).toBe('*');
        });

        it('should include all CORS headers', async () => {
            const server = createServer(testConfig);
            const response = await server.app.inject({
                method: 'OPTIONS',
                url: '/v1/messages',
            });

            expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
            expect(response.headers['access-control-allow-headers']).toContain('Authorization');
        });
    });
});
