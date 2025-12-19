// Fastify proxy server setup
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdapterConfig } from '../types/config';
import { createMessagesHandler } from './handlers';
import { logger } from '../utils/logger';

export interface ProxyServer {
    app: FastifyInstance;
    start: (port: number) => Promise<string>;
    stop: (timeout?: number) => Promise<void>;
}

// Default graceful shutdown timeout in milliseconds
const DEFAULT_SHUTDOWN_TIMEOUT = 10000;

/**
 * Create the proxy server with configured routes
 */
export function createServer(config: AdapterConfig): ProxyServer {
    const app = Fastify({ logger: false });

    // CORS headers for local development
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');

        if (request.method === 'OPTIONS') {
            reply.code(200).send();
            return;
        }
    });

    // Health check endpoint
    app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
        return { status: 'ok', adapter: 'claude-adapter' };
    });

    // Main messages endpoint (matches Anthropic API)
    app.post('/v1/messages', createMessagesHandler(config));

    return {
        app,
        start: async (port: number): Promise<string> => {
            try {
                await app.listen({ port, host: '0.0.0.0' });
                const url = `http://localhost:${port}`;
                return url;
            } catch (err: any) {
                if (err.code === 'EADDRINUSE') {
                    throw new Error(`Port ${port} is already in use. Try a different port.`);
                }
                throw err;
            }
        },
        stop: async (timeout: number = DEFAULT_SHUTDOWN_TIMEOUT): Promise<void> => {
            logger.info('Initiating graceful shutdown', { timeout });

            // Create a timeout promise for force shutdown
            const forceShutdown = new Promise<void>((resolve) => {
                setTimeout(() => {
                    logger.warn('Graceful shutdown timeout exceeded, forcing close');
                    resolve();
                }, timeout);
            });

            // Race between graceful close and timeout
            await Promise.race([
                app.close().then(() => {
                    logger.info('Server stopped gracefully');
                }),
                forceShutdown,
            ]);
        },
    };
}

/**
 * Find an available port starting from the preferred port
 */
export async function findAvailablePort(preferredPort: number): Promise<number> {
    const net = await import('net');

    return new Promise((resolve) => {
        const server = net.createServer();

        server.listen(preferredPort, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : preferredPort;
            server.close(() => resolve(port));
        });

        server.on('error', () => {
            // Port is in use, try next port
            resolve(findAvailablePort(preferredPort + 1));
        });
    });
}
