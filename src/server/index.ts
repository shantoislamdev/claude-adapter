// Express proxy server setup
import express, { Application } from 'express';
import { AdapterConfig } from '../types/config';
import { createMessagesHandler } from './handlers';

export interface ProxyServer {
    app: Application;
    start: (port: number) => Promise<string>;
    stop: () => void;
}

/**
 * Create the proxy server with configured routes
 */
export function createServer(config: AdapterConfig): ProxyServer {
    const app = express();

    // Middleware
    app.use(express.json({ limit: '50mb' }));

    // CORS headers for local development
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', adapter: 'claude-adapter' });
    });

    // Main messages endpoint (matches Anthropic API)
    app.post('/v1/messages', createMessagesHandler(config));

    let server: ReturnType<Application['listen']> | null = null;

    return {
        app,
        start: (port: number): Promise<string> => {
            return new Promise((resolve, reject) => {
                try {
                    server = app.listen(port, () => {
                        const url = `http://localhost:${port}`;
                        resolve(url);
                    });

                    server.on('error', (err: NodeJS.ErrnoException) => {
                        if (err.code === 'EADDRINUSE') {
                            reject(new Error(`Port ${port} is already in use. Try a different port.`));
                        } else {
                            reject(err);
                        }
                    });
                } catch (error) {
                    reject(error);
                }
            });
        },
        stop: () => {
            if (server) {
                server.close();
                server = null;
            }
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
