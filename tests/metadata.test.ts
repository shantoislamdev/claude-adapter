// Tests for metadata utilities
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'claude-adapter-metadata-test-' + Date.now());
const METADATA_FILE = join(TEST_DIR, 'metadata.json');

// Mock the home directory to use test directory
jest.mock('os', () => {
    const actual = jest.requireActual('os');
    return {
        ...actual,
        homedir: () => TEST_DIR,
        platform: () => 'test-platform',
        release: () => '1.2.3'
    };
});

// Import after mocking
import { getMetadata, updateLatestVersion, getCachedLatestVersion, clearMetadataCache } from '../src/utils/metadata';

describe('Metadata Utilities', () => {
    beforeEach(() => {
        // Create test directory
        if (!existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
        // Create .claude-adapter subdirectory
        const adapterDir = join(TEST_DIR, '.claude-adapter');
        if (!existsSync(adapterDir)) {
            mkdirSync(adapterDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test files
        try {
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if (existsSync(metadataPath)) {
                rmSync(metadataPath);
            }
        } catch {
            // Ignore cleanup errors
        }
        clearMetadataCache();
    });

    afterAll(() => {
        // Clean up test directory
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('ensureMetadataDir error handling', () => {
        it('should handle ensureMetadataDir errors gracefully', () => {
            clearMetadataCache();
            const adapterDir = join(TEST_DIR, '.claude-adapter');
            if (existsSync(adapterDir)) {
                rmSync(adapterDir, { recursive: true });
            }
            writeFileSync(adapterDir, 'file-not-dir'); // Create a file instead of dir to trigger mkdirSync error
            getMetadata();
            rmSync(adapterDir); // cleanup
        });
    });

    describe('loadMetadata error handling', () => {
        it('should handle read errors gracefully', () => {
            clearMetadataCache();
            // Create an invalid JSON file to trigger a parse error
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            writeFileSync(metadataPath, 'invalid-json');
            const metadata = getMetadata();
            expect(metadata).toBeDefined();
        });
    });

    describe('saveMetadata error handling', () => {
        it('should handle write errors gracefully', () => {
            clearMetadataCache();
            getMetadata(); // Create a valid cache first
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            // Replace file with directory to trigger write error
            rmSync(metadataPath);
            mkdirSync(metadataPath, { recursive: true });
            updateLatestVersion('3.0.0');
            rmSync(metadataPath, { recursive: true });
        });
    });

    describe('updateLatestVersion error handling', () => {
        it('should handle loadMetadata errors gracefully during updateLatestVersion', () => {
            clearMetadataCache();
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            writeFileSync(metadataPath, 'invalid-json');
            updateLatestVersion('3.0.0');
        });
    });

    describe('getCachedLatestVersion error handling', () => {
        it('should handle loadMetadata errors gracefully during getCachedLatestVersion', () => {
            clearMetadataCache();
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            writeFileSync(metadataPath, 'invalid-json');
            expect(getCachedLatestVersion()).toBeNull();
        });
    });

    describe('getMetadata', () => {
        it('should create new metadata on first run', () => {
            const metadata = getMetadata();

            expect(metadata).toBeDefined();
            expect(metadata.userId).toBeDefined();
            expect(metadata.userId.length).toBe(32); // 16 bytes = 32 hex chars
            expect(metadata.platform).toBe('test-platform');
            expect(metadata.platformRelease).toBe('1.2.3');
            expect(metadata.currentVersion).toBeDefined();
            expect(metadata.createdAt).toBeDefined();
        });

        it('should return existing metadata on subsequent calls', () => {
            const first = getMetadata();
            const second = getMetadata();

            expect(first.userId).toBe(second.userId);
            expect(first.createdAt).toBe(second.createdAt);
        });
    });

    describe('updateLatestVersion', () => {
        it('should update latest version in metadata', () => {
            getMetadata(); // Ensure metadata exists

            updateLatestVersion('2.0.0');

            const cached = getCachedLatestVersion();
            expect(cached).not.toBeNull();
            expect(cached?.version).toBe('2.0.0');
            expect(cached?.timestamp).toBeDefined();
        });
    });

    describe('getCachedLatestVersion', () => {
        it('should return null if no version cached', () => {
            clearMetadataCache();
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if (existsSync(metadataPath)) {
                rmSync(metadataPath);
            }

            // Create metadata without latestVersion
            getMetadata();

            // The first call creates metadata without latestVersion
            // We need to read the raw metadata to check
            const content = readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(content);
            expect(metadata.latestVersion).toBeUndefined();
        });

        it('should return cached version if available', () => {
            getMetadata();
            updateLatestVersion('1.5.0');

            const cached = getCachedLatestVersion();
            expect(cached?.version).toBe('1.5.0');
        });
    });
});
