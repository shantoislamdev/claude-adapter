// Error logging utility
import { join } from 'path';
import { getTodayDateString, ensureDirExists, getBaseDir, appendJsonLine } from './fileStorage';

export interface ErrorLogRecord {
    timestamp: string;        // ISO 8601
    requestId: string;
    provider: string;
    modelName: string;
    streaming: boolean;
    error: {
        message: string;
        status?: number;
        code?: string;
        type?: string;
        response?: unknown;   // Complete error response from endpoint
    };
}

const ERROR_DIR = join(getBaseDir(), 'error_logs');

/**
 * Get the file path for a given date
 */
function getErrorFilePath(dateStr: string): string {
    return join(ERROR_DIR, `${dateStr}.jsonl`);
}

/**
 * Extract error details from various error types
 */
function extractErrorDetails(error: Error): ErrorLogRecord['error'] {
    const details: ErrorLogRecord['error'] = {
        message: error.message
    };

    // Extract OpenAI SDK error properties
    if ('status' in error) {
        details.status = (error as any).status;
    }
    if ('code' in error) {
        details.code = (error as any).code;
    }
    if ('type' in error) {
        details.type = (error as any).type;
    }
    // Capture complete error response if available
    if ('error' in error) {
        details.response = (error as any).error;
    }
    // Some APIs return response body
    if ('response' in error) {
        details.response = (error as any).response;
    }

    return details;
}

/**
 * Error codes that should not be logged (user errors, not API issues)
 */
const SKIP_ERROR_CODES = [401, 402, 404, 429];

/**
 * Record error to the daily file
 * Non-blocking, fails silently on errors
 * Skips common user errors like auth failures and rate limits
 */
export function recordError(
    error: Error,
    context: Omit<ErrorLogRecord, 'timestamp' | 'error'>
): void {
    try {
        // Skip logging for common user-related errors
        if ('status' in error && SKIP_ERROR_CODES.includes((error as any).status)) {
            return;
        }

        ensureDirExists(ERROR_DIR);

        const record: ErrorLogRecord = {
            timestamp: new Date().toISOString(),
            ...context,
            error: extractErrorDetails(error)
        };

        const filePath = getErrorFilePath(getTodayDateString());
        appendJsonLine(filePath, record);
    } catch {
        // Fail silently - don't interrupt API flow for error logging
    }
}
