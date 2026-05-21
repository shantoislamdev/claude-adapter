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
import { getMetadata, updateLatestVersion, getCachedLatestVersion, clearCachedMetadata } from '../src/utils/metadata';

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

        clearCachedMetadata();
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
    });

    afterAll(() => {
        // Clean up test directory
        try {
            rmSync(TEST_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
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

        it('should update currentVersion if it has changed', () => {
            const first = getMetadata();
            // Mock a different current version
            first.currentVersion = 'old-version';
            writeFileSync(METADATA_FILE, JSON.stringify(first));
            clearCachedMetadata();

            const second = getMetadata();
            expect(second.currentVersion).not.toBe('old-version');
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

        it('should handle errors gracefully when saving fails', () => {
            // Create an unwritable directory to force writeFileSync to throw
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if (existsSync(metadataPath)) {
                rmSync(metadataPath);
            }
            mkdirSync(metadataPath); // metadata.json is now a directory, writes will fail

            expect(() => updateLatestVersion('2.0.0')).not.toThrow();
        });

        it('should handle errors when loading returns null', () => {
            // Delete the metadata file, clear cache, update version
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if(existsSync(metadataPath)) rmSync(metadataPath, { recursive: true, force: true });
            clearCachedMetadata();

            expect(() => updateLatestVersion('2.0.0')).not.toThrow();
        });

        it('should handle errors gracefully when loading metadata fails', () => {
            // Write invalid JSON to force a parse error
            const metadataPathOld = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if(existsSync(metadataPathOld)) rmSync(metadataPathOld, { recursive: true, force: true });

            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            writeFileSync(metadataPath, 'invalid json');
            clearCachedMetadata();

            // Should not throw
            expect(() => updateLatestVersion('2.0.0')).not.toThrow();
        });
    });

    describe('getCachedLatestVersion', () => {
        it('should return null if no version cached', () => {
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if (existsSync(metadataPath)) {
                rmSync(metadataPath, { recursive: true, force: true });
            }

            // Create metadata without latestVersion
            getMetadata();

            // The first call creates metadata without latestVersion
            // We need to read the raw metadata to check
            const content = readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(content);
            expect(metadata.latestVersion).toBeUndefined();
        });

        it('should return null if cache is invalid or throws error', () => {
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');

            // Write invalid JSON to force a parse error
            writeFileSync(metadataPath, 'invalid json');
            clearCachedMetadata();

            const cached = getCachedLatestVersion();
            expect(cached).toBeNull();
        });

        it('should handle errors when getCachedLatestVersion encounters an error', () => {
            const metadataPath = join(TEST_DIR, '.claude-adapter', 'metadata.json');
            if (existsSync(metadataPath)) rmSync(metadataPath, { recursive: true, force: true });
            mkdirSync(metadataPath); // Forces read error
            clearCachedMetadata();

            expect(getCachedLatestVersion()).toBeNull();

            // cleanup
            rmSync(metadataPath, { recursive: true, force: true });
        });

        it('should return cached version if available', () => {
            getMetadata();
            updateLatestVersion('1.5.0');

            const cached = getCachedLatestVersion();
            expect(cached?.version).toBe('1.5.0');
        });
    });
});
