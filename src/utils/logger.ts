// Structured logger with levels and timestamps
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

const levelNames: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};

const levelColors: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '\x1b[90m',  // gray
    [LogLevel.INFO]: '\x1b[36m',   // cyan
    [LogLevel.WARN]: '\x1b[33m',   // yellow
    [LogLevel.ERROR]: '\x1b[31m',  // red
};

const RESET = '\x1b[0m';

class Logger {
    private level: LogLevel;
    private prefix: string;

    constructor(prefix: string = 'adapter') {
        this.prefix = prefix;
        // Default to INFO, can be overridden by LOG_LEVEL env var
        const envLevel = process.env.LOG_LEVEL?.toUpperCase();
        this.level = this.parseLevel(envLevel) ?? LogLevel.INFO;
    }

    private parseLevel(level?: string): LogLevel | undefined {
        switch (level) {
            case 'DEBUG': return LogLevel.DEBUG;
            case 'INFO': return LogLevel.INFO;
            case 'WARN': return LogLevel.WARN;
            case 'ERROR': return LogLevel.ERROR;
            default: return undefined;
        }
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        if (level < this.level) return;

        const color = levelColors[level];
        const levelName = levelNames[level].padEnd(5);
        const timestamp = this.formatTimestamp();

        let output = `${color}[${timestamp}] [${this.prefix}] ${levelName}${RESET} ${message}`;

        if (meta && Object.keys(meta).length > 0) {
            output += ` ${JSON.stringify(meta)}`;
        }

        if (level === LogLevel.ERROR) {
            console.error(output);
        } else {
            console.log(output);
        }
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, meta);
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.log(LogLevel.WARN, message, meta);
    }

    error(message: string, error?: Error, meta?: Record<string, unknown>): void {
        const errorMeta = error ? { error: error.message, ...meta } : meta;
        this.log(LogLevel.ERROR, message, errorMeta);
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Create a child logger with request context
     */
    withRequestId(requestId: string): RequestLogger {
        return new RequestLogger(this, requestId);
    }
}

/**
 * Logger bound to a specific request ID for tracing
 */
class RequestLogger {
    private parent: Logger;
    private requestId: string;

    constructor(parent: Logger, requestId: string) {
        this.parent = parent;
        this.requestId = requestId;
    }

    private addContext(meta?: Record<string, unknown>): Record<string, unknown> {
        return { requestId: this.requestId, ...meta };
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.parent.debug(message, this.addContext(meta));
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.parent.info(message, this.addContext(meta));
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.parent.warn(message, this.addContext(meta));
    }

    error(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.parent.error(message, error, this.addContext(meta));
    }
}

// Export singleton instance
export const logger = new Logger();

// Export types for consumers
export { Logger, RequestLogger };
