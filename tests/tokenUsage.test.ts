// Tests for token usage utilities
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'claude-adapter-tokenusage-test-' + Date.now());

// Mock fileStorage to use test directory
jest.mock('../src/utils/fileStorage', () => {
    const actual = jest.requireActual('../src/utils/fileStorage');
    return {
        ...actual,
        getBaseDir: () => TEST_DIR
    };
});

import { recordUsage, TokenUsageRecord } from '../src/utils/tokenUsage';

describe('Token Usage Utilities', () => {
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

    describe('recordUsage', () => {
        it('should record token usage to file', () => {
            const usage = {
                provider: 'https://api.openai.com/v1',
                modelName: 'claude-4-opus',
                model: 'gpt-4-turbo',
                inputTokens: 100,
                outputTokens: 50,
                streaming: false
            };

            recordUsage(usage);

            const usageDir = join(TEST_DIR, 'token_usage');
            expect(existsSync(usageDir)).toBe(true);
        });

        it('should include timestamp in record', () => {
            const usage = {
                provider: 'https://api.example.com',
                modelName: 'test-model',
                inputTokens: 200,
                outputTokens: 100,
                streaming: true
            };

            recordUsage(usage);

            const usageDir = join(TEST_DIR, 'token_usage');
            const files = require('fs').readdirSync(usageDir);
            expect(files.length).toBeGreaterThan(0);

            const content = readFileSync(join(usageDir, files[0]), 'utf-8');
            expect(content).toContain('timestamp');
            expect(content).toContain('test-model');
        });

        it('should handle optional cached tokens', () => {
            const usage = {
                provider: 'https://api.example.com',
                modelName: 'cached-model',
                inputTokens: 300,
                outputTokens: 150,
                cachedInputTokens: 50,
                streaming: false
            };

            recordUsage(usage);

            const usageDir = join(TEST_DIR, 'token_usage');
            const files = require('fs').readdirSync(usageDir);
            const content = readFileSync(join(usageDir, files[0]), 'utf-8');

            expect(content).toContain('cachedInputTokens');
            expect(content).toContain('50');
        });

        it('should handle optional model field', () => {
            const usage = {
                provider: 'https://api.example.com',
                modelName: 'requested-model',
                model: 'actual-model-id',
                inputTokens: 400,
                outputTokens: 200,
                streaming: true
            };

            recordUsage(usage);

            const usageDir = join(TEST_DIR, 'token_usage');
            const files = require('fs').readdirSync(usageDir);
            const content = readFileSync(join(usageDir, files[0]), 'utf-8');

            expect(content).toContain('actual-model-id');
        });

        it('should append multiple records', () => {
            // Clear previous records by using unique identifiers
            const usage1 = {
                provider: 'provider-1',
                modelName: 'model-1',
                inputTokens: 10,
                outputTokens: 5,
                streaming: false
            };
            const usage2 = {
                provider: 'provider-2',
                modelName: 'model-2',
                inputTokens: 20,
                outputTokens: 10,
                streaming: true
            };

            recordUsage(usage1);
            recordUsage(usage2);

            const usageDir = join(TEST_DIR, 'token_usage');
            const files = require('fs').readdirSync(usageDir);
            const content = readFileSync(join(usageDir, files[0]), 'utf-8');

            expect(content).toContain('model-1');
            expect(content).toContain('model-2');
        });
    });
});
