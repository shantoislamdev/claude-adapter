// Metadata storage utility
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir, platform, release } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { version as currentVersion } from '../../package.json';

export interface Metadata {
    userId: string;                    // Unique user ID (generated once)
    platform: string;                 // 'win32' | 'darwin' | 'linux'
    platformRelease: string;           // OS version (e.g., '10.0.22631')
    currentVersion: string;            // From package.json
    latestVersion?: string;            // From npm registry
    latestVersionTimestamp?: number;   // Cache timestamp for latest version
    createdAt: string;                 // First run timestamp
}

const METADATA_DIR = join(homedir(), '.claude-adapter');
const METADATA_FILE = join(METADATA_DIR, 'metadata.json');

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Get OS name
 */
function getOsName(): string {
    return platform();
}

/**
 * Ensure metadata directory exists
 */
function ensureMetadataDir(): void {
    if (!existsSync(METADATA_DIR)) {
        mkdirSync(METADATA_DIR, { recursive: true });
    }
}

/**
 * Load metadata from file
 */
function loadMetadata(): Metadata | null {
    try {
        if (existsSync(METADATA_FILE)) {
            const data = readFileSync(METADATA_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        // Ignore read errors
    }
    return null;
}

/**
 * Save metadata to file
 */
function saveMetadata(metadata: Metadata): void {
    try {
        ensureMetadataDir();
        writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch {
        // Ignore write errors
    }
}

/**
 * Get or create metadata
 * Creates new metadata on first run, updates currentVersion on subsequent runs
 */
export function getMetadata(): Metadata {
    let metadata = loadMetadata();

    if (!metadata) {
        // First run - create new metadata
        metadata = {
            userId: generateUserId(),
            platform: getOsName(),
            platformRelease: release(),
            currentVersion,
            createdAt: new Date().toISOString()
        };
        saveMetadata(metadata);
    } else {
        // Update current version if changed
        if (metadata.currentVersion !== currentVersion) {
            metadata.currentVersion = currentVersion;
            saveMetadata(metadata);
        }
    }

    return metadata;
}

/**
 * Update latest version in metadata (called after npm registry check)
 */
export function updateLatestVersion(version: string): void {
    try {
        const metadata = loadMetadata();
        if (metadata) {
            metadata.latestVersion = version;
            metadata.latestVersionTimestamp = Date.now();
            saveMetadata(metadata);
        }
    } catch {
        // Ignore errors
    }
}

/**
 * Get cached latest version info
 */
export function getCachedLatestVersion(): { version: string; timestamp: number } | null {
    try {
        const metadata = loadMetadata();
        if (metadata?.latestVersion && metadata?.latestVersionTimestamp) {
            return {
                version: metadata.latestVersion,
                timestamp: metadata.latestVersionTimestamp
            };
        }
    } catch {
        // Ignore errors
    }
    return null;
}
