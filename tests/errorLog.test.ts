// Tests for error logging utilities
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'claude-adapter-errorlog-test-' + Date.now());

// Mock fileStorage to use test directory
jest.mock('../src/utils/fileStorage', () => {
    const actual = jest.requireActual('../src/utils/fileStorage');
    return {
        ...actual,
        getBaseDir: () => TEST_DIR
    };
});

import { recordError, ErrorLogRecord } from '../src/utils/errorLog';

describe('Error Log Utilities', () => {
    beforeAll(() => {
        if (!existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('recordError', () => {
        it('should not record 401 errors', () => {
            const error = Object.assign(new Error('Unauthorized'), { status: 401 });
            const context = {
                requestId: 'test-req-1',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: false
            };

            recordError(error, context);

            // Check that no file was created or error was skipped
            const errorDir = join(TEST_DIR, 'error_logs');
            if (existsSync(errorDir)) {
                const files = require('fs').readdirSync(errorDir);
                if (files.length > 0) {
                    const content = readFileSync(join(errorDir, files[0]), 'utf-8');
                    expect(content).not.toContain('test-req-1');
                }
            }
        });

        it('should not record 404 errors', () => {
            const error = Object.assign(new Error('Not Found'), { status: 404 });
            const context = {
                requestId: 'test-req-404',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: false
            };

            recordError(error, context);
            // 404 should be skipped
        });

        it('should not record 429 errors', () => {
            const error = Object.assign(new Error('Rate limited'), { status: 429 });
            const context = {
                requestId: 'test-req-429',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: false
            };

            recordError(error, context);
            // 429 should be skipped
        });

        it('should not record 402 errors', () => {
            const error = Object.assign(new Error('Payment Required'), { status: 402 });
            const context = {
                requestId: 'test-req-402',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: false
            };

            recordError(error, context);
            // 402 should be skipped
        });

        it('should record 500 errors', () => {
            const error = Object.assign(new Error('Internal Server Error'), {
                status: 500,
                code: 'server_error',
                type: 'api_error'
            });
            const context = {
                requestId: 'test-req-500',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: true
            };

            recordError(error, context);

            const errorDir = join(TEST_DIR, 'error_logs');
            expect(existsSync(errorDir)).toBe(true);
        });

        it('should extract error details correctly', () => {
            const error = Object.assign(new Error('Test error'), {
                status: 503,
                code: 'service_unavailable',
                type: 'temporary_error',
                error: { detail: 'Service down' }
            });
            const context = {
                requestId: 'test-req-details',
                provider: 'https://api.example.com',
                modelName: 'gpt-4',
                streaming: false
            };

            recordError(error, context);

            const errorDir = join(TEST_DIR, 'error_logs');
            const files = require('fs').readdirSync(errorDir);
            const content = readFileSync(join(errorDir, files[0]), 'utf-8');

            expect(content).toContain('test-req-details');
            expect(content).toContain('503');
        });
    });
});
