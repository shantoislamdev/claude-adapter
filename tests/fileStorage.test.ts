// Tests for file storage utilities
import { existsSync, mkdirSync, appendFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the module to use temp directory
const TEST_DIR = join(tmpdir(), 'claude-adapter-test-' + Date.now());

// We need to mock the module before importing
jest.mock('../src/utils/fileStorage', () => {
    const actual = jest.requireActual('../src/utils/fileStorage');
    return {
        ...actual,
        getBaseDir: () => TEST_DIR
    };
});

import { getTodayDateString, ensureDirExists, appendJsonLine, getBaseDir } from '../src/utils/fileStorage';

describe('File Storage Utilities', () => {
    beforeAll(() => {
        // Ensure test directory exists
        if (!existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        // Clean up test directory
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('getTodayDateString', () => {
        it('should return date in YYYY-MM-DD format', () => {
            const result = getTodayDateString();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should match today\'s date', () => {
            const result = getTodayDateString();
            const expected = new Date().toISOString().split('T')[0];
            expect(result).toBe(expected);
        });
    });

    describe('ensureDirExists', () => {
        it('should create directory if it does not exist', () => {
            const testPath = join(TEST_DIR, 'new-dir-' + Date.now());
            expect(existsSync(testPath)).toBe(false);

            ensureDirExists(testPath);

            expect(existsSync(testPath)).toBe(true);
        });

        it('should not throw if directory already exists', () => {
            const testPath = join(TEST_DIR, 'existing-dir');
            mkdirSync(testPath, { recursive: true });

            expect(() => ensureDirExists(testPath)).not.toThrow();
        });
    });

    describe('appendJsonLine', () => {
        it('should append JSON record to file', () => {
            const testFile = join(TEST_DIR, 'test-append.jsonl');
            const record = { name: 'test', value: 123 };

            appendJsonLine(testFile, record);

            const content = readFileSync(testFile, 'utf-8');
            expect(content).toContain(JSON.stringify(record));
            expect(content.endsWith('\n')).toBe(true);
        });

        it('should append multiple records on separate lines', () => {
            const testFile = join(TEST_DIR, 'test-multi.jsonl');
            const record1 = { id: 1 };
            const record2 = { id: 2 };

            appendJsonLine(testFile, record1);
            appendJsonLine(testFile, record2);

            const content = readFileSync(testFile, 'utf-8');
            const lines = content.trim().split('\n');
            expect(lines.length).toBe(2);
            expect(JSON.parse(lines[0])).toEqual(record1);
            expect(JSON.parse(lines[1])).toEqual(record2);
        });
    });

    describe('getBaseDir', () => {
        it('should return the base directory path', () => {
            const result = getBaseDir();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
