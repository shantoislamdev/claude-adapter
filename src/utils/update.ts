import https from 'https';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { version as currentVersion } from '../../package.json';

export interface UpdateInfo {
    current: string;
    latest: string;
    hasUpdate: boolean;
}

interface VersionCache {
    version: string;
    timestamp: number;
}

const CACHE_DIR = join(homedir(), '.claude-adapter');
const CACHE_FILE = join(CACHE_DIR, 'version.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Load cached version info
 */
function loadCache(): VersionCache | null {
    try {
        if (existsSync(CACHE_FILE)) {
            const data = readFileSync(CACHE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        // Ignore cache read errors
    }
    return null;
}

/**
 * Save version to cache
 */
function saveCache(version: string): void {
    try {
        if (!existsSync(CACHE_DIR)) {
            mkdirSync(CACHE_DIR, { recursive: true });
        }
        const cache: VersionCache = {
            version,
            timestamp: Date.now()
        };
        writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch {
        // Ignore cache write errors
    }
}

/**
 * Check if cache is still valid (within 24 hours)
 */
function isCacheValid(cache: VersionCache): boolean {
    return Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Fetch latest version from npm registry
 */
function fetchLatestVersion(): Promise<string | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000); // 3s timeout

        https.get('https://registry.npmjs.org/claude-adapter/latest', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeout);
                try {
                    const { version } = JSON.parse(data);
                    resolve(version);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => {
            clearTimeout(timeout);
            resolve(null);
        });
    });
}

/**
 * Check for updates with 24-hour caching
 * Non-blocking, fails silently on errors
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
    try {
        // Check cache first
        const cache = loadCache();
        if (cache && isCacheValid(cache)) {
            return {
                current: currentVersion,
                latest: cache.version,
                hasUpdate: cache.version !== currentVersion
            };
        }

        // Fetch from registry
        const latest = await fetchLatestVersion();
        if (!latest) {
            return null;
        }

        // Update cache
        saveCache(latest);

        return {
            current: currentVersion,
            latest,
            hasUpdate: latest !== currentVersion
        };
    } catch {
        return null;
    }
}

/**
 * Get cached update info synchronously (for use in request converter)
 * Returns null if cache doesn't exist or is expired
 */
export function getCachedUpdateInfo(): UpdateInfo | null {
    try {
        const cache = loadCache();
        if (cache && isCacheValid(cache)) {
            return {
                current: currentVersion,
                latest: cache.version,
                hasUpdate: cache.version !== currentVersion
            };
        }
    } catch {
        // Ignore errors
    }
    return null;
}
