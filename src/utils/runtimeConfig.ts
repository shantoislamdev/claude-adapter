import { AdapterConfig, ModelConfig } from '../types/config';

type ConfigSource = 'env' | 'file' | 'prompt' | 'fallback';

export interface RuntimeConfigSources {
    baseUrl: ConfigSource;
    apiKey: string;
    models: {
        opus: ConfigSource;
        sonnet: ConfigSource;
        haiku: ConfigSource;
    };
}

export interface RuntimeConfigResult {
    config: Partial<AdapterConfig>;
    sources: RuntimeConfigSources;
    warnings: string[];
}

function readNonEmptyEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
    const value = env[key]?.trim();
    return value ? value : undefined;
}

function resolveModelTier(
    envValue: string | undefined,
    defaultModel: string | undefined,
    fileValue: string | undefined,
    fallbackValue?: string
): { value: string | undefined; source: ConfigSource } {
    if (envValue) {
        return { value: envValue, source: 'env' };
    }
    if (defaultModel) {
        return { value: defaultModel, source: 'fallback' };
    }
    if (fileValue) {
        return { value: fileValue, source: 'file' };
    }
    if (fallbackValue) {
        return { value: fallbackValue, source: 'fallback' };
    }
    return { value: undefined, source: 'prompt' };
}

export function resolveRuntimeConfig(
    fileConfig: AdapterConfig | null,
    env: NodeJS.ProcessEnv = process.env
): RuntimeConfigResult {
    const warnings: string[] = [];

    const envBaseUrl = readNonEmptyEnv(env, 'ANTHROPIC_BASE_URL');
    const envApiKey = readNonEmptyEnv(env, 'ANTHROPIC_API_KEY');
    const envAuthToken = readNonEmptyEnv(env, 'ANTHROPIC_AUTH_TOKEN');
    const envDefaultModel = readNonEmptyEnv(env, 'ANTHROPIC_DEFAULT_MODEL');

    if (envApiKey && envAuthToken) {
        warnings.push('ANTHROPIC_AUTH_TOKEN ignored because ANTHROPIC_API_KEY is set');
    }

    const opus = resolveModelTier(
        readNonEmptyEnv(env, 'ANTHROPIC_DEFAULT_OPUS_MODEL'),
        envDefaultModel,
        fileConfig?.models?.opus
    );
    const sonnet = resolveModelTier(
        readNonEmptyEnv(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL'),
        envDefaultModel,
        fileConfig?.models?.sonnet,
        opus.value
    );
    const haiku = resolveModelTier(
        readNonEmptyEnv(env, 'ANTHROPIC_DEFAULT_HAIKU_MODEL'),
        envDefaultModel,
        fileConfig?.models?.haiku,
        sonnet.value
    );

    const resolvedModels: ModelConfig | undefined = opus.value
        ? {
            opus: opus.value,
            sonnet: sonnet.value || opus.value,
            haiku: haiku.value || sonnet.value || opus.value,
        }
        : undefined;

    const resolvedApiKey = envApiKey ?? envAuthToken ?? fileConfig?.apiKey;

    return {
        config: {
            baseUrl: envBaseUrl ?? fileConfig?.baseUrl,
            apiKey: resolvedApiKey,
            models: resolvedModels,
            toolFormat: fileConfig?.toolFormat,
            port: fileConfig?.port,
        },
        sources: {
            baseUrl: envBaseUrl ? 'env' : fileConfig?.baseUrl ? 'file' : 'prompt',
            apiKey: envApiKey
                ? 'env(ANTHROPIC_API_KEY)'
                : envAuthToken
                    ? 'env(ANTHROPIC_AUTH_TOKEN)'
                    : fileConfig?.apiKey
                        ? 'file'
                        : 'prompt',
            models: {
                opus: opus.source,
                sonnet: sonnet.source,
                haiku: haiku.source,
            },
        },
        warnings,
    };
}
