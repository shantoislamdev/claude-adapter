// Tests for configuration utilities
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'claude-adapter-config-test-' + Date.now());
const ADAPTER_DIR = join(TEST_DIR, '.claude-adapter');
const CLAUDE_DIR = join(TEST_DIR, '.claude');

// Mock os.homedir to use test directory
jest.mock('os', () => {
    const actual = jest.requireActual('os');
    return {
        ...actual,
        homedir: () => TEST_DIR
    };
});

import {
    loadConfig,
    saveConfig,
    configExists,
    getConfigDir,
    updateClaudeJson,
    updateClaudeSettings,
    getClaudePaths
} from '../src/utils/config';

describe('Config Utilities', () => {
    beforeEach(() => {
        // Create test directory structure
        if (!existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
        if (!existsSync(ADAPTER_DIR)) {
            mkdirSync(ADAPTER_DIR, { recursive: true });
        }
        if (!existsSync(CLAUDE_DIR)) {
            mkdirSync(CLAUDE_DIR, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test files
        try {
            const configPath = join(ADAPTER_DIR, 'config.json');
            if (existsSync(configPath)) rmSync(configPath);

            const claudeJsonPath = join(TEST_DIR, '.claude.json');
            if (existsSync(claudeJsonPath)) rmSync(claudeJsonPath);

            const settingsPath = join(CLAUDE_DIR, 'settings.json');
            if (existsSync(settingsPath)) rmSync(settingsPath);
        } catch {
            // Ignore cleanup errors
        }
    });

    afterAll(() => {
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    describe('loadConfig', () => {
        it('should return null if config file does not exist', () => {
            const configPath = join(ADAPTER_DIR, 'config.json');
            if (existsSync(configPath)) rmSync(configPath);

            const result = loadConfig();
            expect(result).toBeNull();
        });

        it('should load and parse existing config', () => {
            const config = {
                baseUrl: 'https://api.example.com',
                apiKey: 'test-key',
                models: { opus: 'gpt-4', sonnet: 'gpt-3.5', haiku: 'gpt-3.5' }
            };
            writeFileSync(join(ADAPTER_DIR, 'config.json'), JSON.stringify(config));

            const result = loadConfig();
            expect(result).toEqual(config);
        });

        it('should return null for corrupted config', () => {
            writeFileSync(join(ADAPTER_DIR, 'config.json'), 'not valid json{');

            const result = loadConfig();
            expect(result).toBeNull();
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', () => {
            const config = {
                baseUrl: 'https://api.test.com',
                apiKey: 'key-123',
                models: { opus: 'model-1', sonnet: 'model-2', haiku: 'model-3' }
            };

            saveConfig(config);

            const content = readFileSync(join(ADAPTER_DIR, 'config.json'), 'utf-8');
            expect(JSON.parse(content)).toEqual(config);
        });

        it('should create directory if not exists', () => {
            if (existsSync(ADAPTER_DIR)) rmSync(ADAPTER_DIR, { recursive: true });

            const config = {
                baseUrl: 'https://api.test.com',
                apiKey: 'key-456',
                models: { opus: 'a', sonnet: 'b', haiku: 'c' }
            };

            saveConfig(config);

            expect(existsSync(ADAPTER_DIR)).toBe(true);
        });
    });

    describe('configExists', () => {
        it('should return false if config does not exist', () => {
            const configPath = join(ADAPTER_DIR, 'config.json');
            if (existsSync(configPath)) rmSync(configPath);

            expect(configExists()).toBe(false);
        });

        it('should return true if config exists', () => {
            writeFileSync(join(ADAPTER_DIR, 'config.json'), '{}');

            expect(configExists()).toBe(true);
        });
    });

    describe('getConfigDir', () => {
        it('should return config directory path', () => {
            const dir = getConfigDir();
            expect(dir).toContain('.claude-adapter');
        });
    });

    describe('updateClaudeJson', () => {
        it('should create claude.json with hasCompletedOnboarding', () => {
            const claudeJsonPath = join(TEST_DIR, '.claude.json');
            if (existsSync(claudeJsonPath)) rmSync(claudeJsonPath);

            updateClaudeJson();

            const content = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
            expect(content.hasCompletedOnboarding).toBe(true);
        });

        it('should preserve existing properties', () => {
            const claudeJsonPath = join(TEST_DIR, '.claude.json');
            writeFileSync(claudeJsonPath, JSON.stringify({ existingProp: 'value' }));

            updateClaudeJson();

            const content = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
            expect(content.existingProp).toBe('value');
            expect(content.hasCompletedOnboarding).toBe(true);
        });

        it('should handle corrupted file gracefully', () => {
            const claudeJsonPath = join(TEST_DIR, '.claude.json');
            writeFileSync(claudeJsonPath, 'corrupted{json');

            updateClaudeJson();

            const content = JSON.parse(readFileSync(claudeJsonPath, 'utf-8'));
            expect(content.hasCompletedOnboarding).toBe(true);
        });
    });

    describe('updateClaudeSettings', () => {
        it('should create settings.json with env variables', () => {
            const settingsPath = join(CLAUDE_DIR, 'settings.json');
            if (existsSync(settingsPath)) rmSync(settingsPath);

            updateClaudeSettings('http://localhost:3080', {
                opus: 'gpt-4',
                sonnet: 'gpt-3.5',
                haiku: 'gpt-3.5-mini'
            });

            const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            expect(content.env.ANTHROPIC_BASE_URL).toBe('http://localhost:3080');
            expect(content.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('gpt-4');
        });

        it('should preserve existing settings', () => {
            const settingsPath = join(CLAUDE_DIR, 'settings.json');
            writeFileSync(settingsPath, JSON.stringify({
                otherSetting: true,
                env: { EXISTING_VAR: 'keep' }
            }));

            updateClaudeSettings('http://localhost:3080', {
                opus: 'a', sonnet: 'b', haiku: 'c'
            });

            const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            expect(content.otherSetting).toBe(true);
            expect(content.env.EXISTING_VAR).toBe('keep');
            expect(content.env.ANTHROPIC_BASE_URL).toBe('http://localhost:3080');
        });

        it('should handle corrupted file gracefully', () => {
            const settingsPath = join(CLAUDE_DIR, 'settings.json');
            writeFileSync(settingsPath, 'not{valid}json');

            updateClaudeSettings('http://test:8080', {
                opus: 'x', sonnet: 'y', haiku: 'z'
            });

            const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            expect(content.env.ANTHROPIC_BASE_URL).toBe('http://test:8080');
        });
    });

    describe('getClaudePaths', () => {
        it('should return paths for claude files', () => {
            const paths = getClaudePaths();
            expect(paths.claudeJson).toContain('.claude.json');
            expect(paths.claudeSettings).toContain('settings.json');
        });
    });
});
