// Tests for configuration utilities
import * as os from 'os';
import * as path from 'path';

describe('Configuration Utils', () => {
    // Import the actual module - we'll test the real paths based on actual home directory
    const { getConfigDir, getClaudePaths } = require('../src/utils/config');
    const actualHomedir = os.homedir();

    describe('getConfigDir', () => {
        it('should return path inside home directory', () => {
            const configDir = getConfigDir();

            expect(configDir).toContain('.claude-adapter');
            expect(configDir).toContain(actualHomedir);
        });

        it('should return absolute path', () => {
            const configDir = getConfigDir();

            expect(path.isAbsolute(configDir)).toBe(true);
        });
    });

    describe('getClaudePaths', () => {
        it('should return correct Claude JSON path', () => {
            const paths = getClaudePaths();

            expect(paths.claudeJson).toBe(path.join(actualHomedir, '.claude.json'));
        });

        it('should return correct Claude settings path', () => {
            const paths = getClaudePaths();

            expect(paths.claudeSettings).toBe(path.join(actualHomedir, '.claude', 'settings.json'));
        });

        it('should return object with both paths', () => {
            const paths = getClaudePaths();

            expect(paths).toHaveProperty('claudeJson');
            expect(paths).toHaveProperty('claudeSettings');
        });
    });

    describe('Path structure', () => {
        it('config directory should end with .claude-adapter', () => {
            const configDir = getConfigDir();

            expect(configDir.endsWith('.claude-adapter')).toBe(true);
        });

        it('Claude settings should be inside .claude directory', () => {
            const paths = getClaudePaths();

            expect(paths.claudeSettings).toContain('.claude');
            expect(paths.claudeSettings).toContain('settings.json');
        });
    });
});
