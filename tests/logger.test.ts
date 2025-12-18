// Tests for structured logger
import { logger, Logger, LogLevel } from '../src/utils/logger';

describe('Logger', () => {
    // Capture console output
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Singleton logger', () => {
        it('should be defined', () => {
            expect(logger).toBeDefined();
        });

        it('should have all log methods', () => {
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });

    describe('Log levels', () => {
        let testLogger: Logger;

        beforeEach(() => {
            testLogger = new Logger('test');
        });

        it('should log info messages', () => {
            testLogger.info('Test info message');
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy.mock.calls[0][0]).toContain('INFO');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('Test info message');
        });

        it('should log warn messages', () => {
            testLogger.warn('Test warning');
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy.mock.calls[0][0]).toContain('WARN');
        });

        it('should log error messages to console.error', () => {
            testLogger.error('Test error');
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR');
        });

        it('should log error with Error object', () => {
            const error = new Error('Something went wrong');
            testLogger.error('Failed operation', error);
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('Something went wrong');
        });

        it('should include metadata in log output', () => {
            testLogger.info('Request received', { model: 'gpt-4', count: 5 });
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy.mock.calls[0][0]).toContain('model');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('gpt-4');
        });

        it('should include timestamp in log output', () => {
            testLogger.info('Timestamped message');
            expect(consoleLogSpy).toHaveBeenCalled();
            // ISO timestamp format check
            expect(consoleLogSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('Debug level filtering', () => {
        it('should not log debug when level is INFO', () => {
            const infoLogger = new Logger('test');
            infoLogger.setLevel(LogLevel.INFO);
            infoLogger.debug('This should not appear');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should log debug when level is DEBUG', () => {
            const debugLogger = new Logger('test');
            debugLogger.setLevel(LogLevel.DEBUG);
            debugLogger.debug('Debug message');
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy.mock.calls[0][0]).toContain('DEBUG');
        });

        it('should not log info when level is WARN', () => {
            const warnLogger = new Logger('test');
            warnLogger.setLevel(LogLevel.WARN);
            warnLogger.info('This should not appear');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should log warn when level is WARN', () => {
            const warnLogger = new Logger('test');
            warnLogger.setLevel(LogLevel.WARN);
            warnLogger.warn('Warning message');
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should only log error when level is ERROR', () => {
            const errorLogger = new Logger('test');
            errorLogger.setLevel(LogLevel.ERROR);
            errorLogger.info('Info');
            errorLogger.warn('Warn');
            expect(consoleLogSpy).not.toHaveBeenCalled();

            errorLogger.error('Error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('Request logger', () => {
        let testLogger: Logger;

        beforeEach(() => {
            testLogger = new Logger('test');
        });

        it('should create request logger with ID', () => {
            const reqLogger = testLogger.withRequestId('req_123');
            expect(reqLogger).toBeDefined();
        });

        it('should include request ID in logs', () => {
            const reqLogger = testLogger.withRequestId('req_abc123');
            reqLogger.info('Processing request');
            expect(consoleLogSpy).toHaveBeenCalled();
            expect(consoleLogSpy.mock.calls[0][0]).toContain('req_abc123');
        });

        it('should have all log methods on request logger', () => {
            const reqLogger = testLogger.withRequestId('req_test');
            expect(typeof reqLogger.debug).toBe('function');
            expect(typeof reqLogger.info).toBe('function');
            expect(typeof reqLogger.warn).toBe('function');
            expect(typeof reqLogger.error).toBe('function');
        });

        it('should log debug with request ID', () => {
            testLogger.setLevel(LogLevel.DEBUG);
            const reqLogger = testLogger.withRequestId('req_debug');
            reqLogger.debug('Debug with ID');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('req_debug');
        });

        it('should log warn with request ID', () => {
            const reqLogger = testLogger.withRequestId('req_warn');
            reqLogger.warn('Warning with ID');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('req_warn');
        });

        it('should log error with request ID', () => {
            const reqLogger = testLogger.withRequestId('req_error');
            reqLogger.error('Error with ID', new Error('Test'));
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('req_error');
        });

        it('should merge request ID with additional metadata', () => {
            const reqLogger = testLogger.withRequestId('req_meta');
            reqLogger.info('With extra data', { extra: 'value' });
            expect(consoleLogSpy.mock.calls[0][0]).toContain('req_meta');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('extra');
        });
    });
});
