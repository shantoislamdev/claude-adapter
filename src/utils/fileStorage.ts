// Shared file storage utilities for daily JSON files
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Base directory for all claude-adapter data
const BASE_DIR = join(homedir(), '.claude-adapter');

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Get the base storage directory
 */
export function getBaseDir(): string {
    return BASE_DIR;
}

/**
 * Append a JSON record to a file (one JSON object per line)
 * This is atomic on most filesystems and avoids race conditions
 */
export function appendJsonLine(filePath: string, record: object): void {
    const line = JSON.stringify(record) + '\n';
    appendFileSync(filePath, line, 'utf-8');
}
