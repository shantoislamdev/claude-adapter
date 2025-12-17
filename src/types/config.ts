// Configuration types for claude-adapter

export interface AdapterConfig {
    baseUrl: string;
    apiKey: string;
    models: ModelConfig;
    port?: number;
}

export interface ModelConfig {
    opus: string;
    sonnet: string;
    haiku: string;
}

export interface ClaudeSettings {
    env?: Record<string, string>;
    [key: string]: unknown; // Preserve other settings
}

export interface ClaudeJson {
    hasCompletedOnboarding?: boolean;
    [key: string]: unknown; // Preserve other settings
}
