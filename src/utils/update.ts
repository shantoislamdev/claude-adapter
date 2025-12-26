import https from 'https';
import { version as currentVersion } from '../../package.json';
import { getCachedLatestVersion, updateLatestVersion } from './metadata';

export interface UpdateInfo {
    current: string;
    latest: string;
    hasUpdate: boolean;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Compare two semantic versions
 * Returns true if latest is greater than current
 */
function isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
    const [latestParts, currentParts] = [parseVersion(latest), parseVersion(current)];

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

/**
 * Check if cached version is still valid (within 24 hours)
 */
function isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL;
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
        const cache = getCachedLatestVersion();
        if (cache && isCacheValid(cache.timestamp)) {
            return {
                current: currentVersion,
                latest: cache.version,
                hasUpdate: isNewerVersion(cache.version, currentVersion)
            };
        }

        // Fetch from registry
        const latest = await fetchLatestVersion();
        if (!latest) {
            return null;
        }

        // Update cache in metadata
        updateLatestVersion(latest);

        return {
            current: currentVersion,
            latest,
            hasUpdate: isNewerVersion(latest, currentVersion)
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
        const cache = getCachedLatestVersion();
        if (cache && isCacheValid(cache.timestamp)) {
            return {
                current: currentVersion,
                latest: cache.version,
                hasUpdate: isNewerVersion(cache.version, currentVersion)
            };
        }
    } catch {
        // Ignore errors
    }
    return null;
}
