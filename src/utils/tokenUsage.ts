// Token usage storage utility
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

const USAGE_DIR = join(homedir(), '.claude-adapter', 'token_usage');

/**
 * Get today's date as YYYY-MM-DD
 */
function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get the file path for a given date
 */
function getUsageFilePath(dateStr: string): string {
    return join(USAGE_DIR, `${dateStr}.json`);
}

/**
 * Ensure the token usage directory exists
 */
function ensureUsageDir(): void {
    if (!existsSync(USAGE_DIR)) {
        mkdirSync(USAGE_DIR, { recursive: true });
    }
}

/**
 * Record token usage to the daily file
 * Non-blocking, fails silently on errors
 */
export function recordUsage(data: Omit<TokenUsageRecord, 'timestamp'>): void {
    try {
        ensureUsageDir();

        const record: TokenUsageRecord = {
            timestamp: new Date().toISOString(),
            ...data
        };

        const filePath = getUsageFilePath(getTodayDateString());

        // Read existing records or start fresh
        let records: TokenUsageRecord[] = [];
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                records = JSON.parse(content);
            } catch {
                // If file is corrupted, start fresh
                records = [];
            }
        }

        // Append new record and write
        records.push(record);
        writeFileSync(filePath, JSON.stringify(records, null, 2));
    } catch {
        // Fail silently - don't interrupt API flow for usage tracking
    }
}
