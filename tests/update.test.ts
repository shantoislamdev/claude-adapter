// Tests for update utilities
import { version as currentVersion } from '../package.json';

// Mock metadata module
jest.mock('../src/utils/metadata', () => ({
    getCachedLatestVersion: jest.fn(),
    updateLatestVersion: jest.fn()
}));

// Mock https module for fetchLatestVersion testing
const mockHttpsGet = jest.fn();
jest.mock('https', () => ({
    get: mockHttpsGet
}));

import { checkForUpdates, getCachedUpdateInfo } from '../src/utils/update';
import { getCachedLatestVersion, updateLatestVersion } from '../src/utils/metadata';

const mockGetCachedLatestVersion = getCachedLatestVersion as jest.Mock;
const mockUpdateLatestVersion = updateLatestVersion as jest.Mock;

describe('Update Utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('getCachedUpdateInfo', () => {
        it('should return null if no cache exists', () => {
            mockGetCachedLatestVersion.mockReturnValue(null);

            const result = getCachedUpdateInfo();

            expect(result).toBeNull();
        });

        it('should return null if cache is expired (25 hours old)', () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: '2.0.0',
                timestamp: Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
            });

            const result = getCachedUpdateInfo();

            expect(result).toBeNull();
        });

        it('should return update info if cache is valid (1 hour old)', () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: '2.0.0',
                timestamp: Date.now() - 1 * 60 * 60 * 1000 // 1 hour ago
            });

            const result = getCachedUpdateInfo();

            expect(result).not.toBeNull();
            expect(result?.current).toBe(currentVersion);
            expect(result?.latest).toBe('2.0.0');
            expect(result?.hasUpdate).toBe(true);
        });

        it('should return hasUpdate false if versions match', () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: currentVersion,
                timestamp: Date.now()
            });

            const result = getCachedUpdateInfo();

            expect(result?.hasUpdate).toBe(false);
        });

        it('should handle cache at exactly 24 hours as expired', () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: '2.0.0',
                timestamp: Date.now() - 24 * 60 * 60 * 1000 // Exactly 24 hours ago
            });

            const result = getCachedUpdateInfo();

            expect(result).toBeNull();
        });

        it('should handle cache just before 24 hours as valid', () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: '2.0.0',
                timestamp: Date.now() - (24 * 60 * 60 * 1000 - 1000) // 1 second before 24 hours
            });

            const result = getCachedUpdateInfo();

            expect(result).not.toBeNull();
            expect(result?.latest).toBe('2.0.0');
        });
    });

    describe('checkForUpdates', () => {
        it('should return cached info if cache is valid', async () => {
            mockGetCachedLatestVersion.mockReturnValue({
                version: '2.0.0',
                timestamp: Date.now() - 1000 // 1 second ago
            });

            const result = await checkForUpdates();

            expect(result?.latest).toBe('2.0.0');
            expect(result?.hasUpdate).toBe(true);
            expect(mockHttpsGet).not.toHaveBeenCalled();
        });

        it('should fetch from npm if no valid cache', async () => {
            mockGetCachedLatestVersion.mockReturnValue(null);

            // Mock successful npm response
            const mockResponse = {
                on: jest.fn().mockImplementation((event: string, callback: Function) => {
                    if (event === 'data') {
                        callback(JSON.stringify({ version: '3.0.0' }));
                    }
                    if (event === 'end') {
                        callback();
                    }
                    return mockResponse;
                })
            };

            mockHttpsGet.mockImplementation((_url: string, callback: Function) => {
                callback(mockResponse);
                return { on: jest.fn().mockReturnThis() };
            });

            const promise = checkForUpdates();
            jest.runAllTimers();
            const result = await promise;

            expect(mockHttpsGet).toHaveBeenCalled();
            expect(mockUpdateLatestVersion).toHaveBeenCalledWith('3.0.0');
            expect(result?.latest).toBe('3.0.0');
        });

        it('should return null on network error', async () => {
            mockGetCachedLatestVersion.mockReturnValue(null);

            mockHttpsGet.mockImplementation((_url: string, _callback: Function) => {
                return {
                    on: jest.fn().mockImplementation((event: string, errorCallback: Function) => {
                        if (event === 'error') {
                            errorCallback(new Error('Network error'));
                        }
                        return { on: jest.fn() };
                    })
                };
            });

            const promise = checkForUpdates();
            jest.runAllTimers();
            const result = await promise;

            expect(result).toBeNull();
        });

        it('should return null on timeout', async () => {
            mockGetCachedLatestVersion.mockReturnValue(null);

            mockHttpsGet.mockImplementation(() => {
                // Never complete - will timeout
                return { on: jest.fn().mockReturnThis() };
            });

            const promise = checkForUpdates();
            jest.advanceTimersByTime(3500); // Advance past the 3s timeout
            const result = await promise;

            expect(result).toBeNull();
        });

        it('should return null on invalid JSON response', async () => {
            mockGetCachedLatestVersion.mockReturnValue(null);

            const mockResponse = {
                on: jest.fn().mockImplementation((event: string, callback: Function) => {
                    if (event === 'data') {
                        callback('not valid json');
                    }
                    if (event === 'end') {
                        callback();
                    }
                    return mockResponse;
                })
            };

            mockHttpsGet.mockImplementation((_url: string, callback: Function) => {
                callback(mockResponse);
                return { on: jest.fn().mockReturnThis() };
            });

            const promise = checkForUpdates();
            jest.runAllTimers();
            const result = await promise;

            expect(result).toBeNull();
        });
    });
});
