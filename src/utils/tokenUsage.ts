// Token usage storage utility
import { join } from 'path';
import { getTodayDateString, ensureDirExists, getBaseDir, appendJsonLine } from './fileStorage';

export interface TokenUsageRecord {
    timestamp: string;        // ISO 8601
    provider: string;         // API endpoint/provider
    modelName: string;        // Requested model name
    model?: string;           // Actual model ID from API response
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    streaming: boolean;
}

const USAGE_DIR = join(getBaseDir(), 'token_usage');

/**
 * Get the file path for a given date
 */
function getUsageFilePath(dateStr: string): string {
    return join(USAGE_DIR, `${dateStr}.jsonl`);
}

/**
 * Record token usage to the daily file
 * Non-blocking, fails silently on errors
 */
export function recordUsage(data: Omit<TokenUsageRecord, 'timestamp'>): void {
    try {
        ensureDirExists(USAGE_DIR);

        const record: TokenUsageRecord = {
            timestamp: new Date().toISOString(),
            ...data
        };

        const filePath = getUsageFilePath(getTodayDateString());
        appendJsonLine(filePath, record);
    } catch {
        // Fail silently - don't interrupt API flow for usage tracking
    }
}
