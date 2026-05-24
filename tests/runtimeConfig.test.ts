import { AdapterConfig } from '../src/types/config';
import { resolveRuntimeConfig } from '../src/utils/runtimeConfig';

function baseFileConfig(): AdapterConfig {
    return {
        baseUrl: 'https://file.example/v1',
        apiKey: 'file-api-key',
        models: {
            opus: 'file-opus',
            sonnet: 'file-sonnet',
            haiku: 'file-haiku',
        },
        toolFormat: 'xml',
    };
}

describe('resolveRuntimeConfig', () => {
    it('uses file values when env is not set', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {});
        expect(result.config.baseUrl).toBe('https://file.example/v1');
        expect(result.config.apiKey).toBe('file-api-key');
        expect(result.config.models).toEqual({
            opus: 'file-opus',
            sonnet: 'file-sonnet',
            haiku: 'file-haiku',
        });
        expect(result.sources.baseUrl).toBe('file');
        expect(result.sources.apiKey).toBe('file');
    });

    it('uses ANTHROPIC_BASE_URL over file config', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_BASE_URL: 'https://env.example/v1',
        });
        expect(result.config.baseUrl).toBe('https://env.example/v1');
        expect(result.sources.baseUrl).toBe('env');
    });

    it('uses ANTHROPIC_API_KEY over ANTHROPIC_AUTH_TOKEN', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_API_KEY: 'env-api-key',
            ANTHROPIC_AUTH_TOKEN: 'env-auth-token',
        });
        expect(result.config.apiKey).toBe('env-api-key');
        expect(result.sources.apiKey).toBe('env(ANTHROPIC_API_KEY)');
        expect(result.warnings).toContain('ANTHROPIC_AUTH_TOKEN ignored because ANTHROPIC_API_KEY is set');
    });

    it('uses ANTHROPIC_AUTH_TOKEN when ANTHROPIC_API_KEY is missing', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_AUTH_TOKEN: 'env-auth-token',
        });
        expect(result.config.apiKey).toBe('env-auth-token');
        expect(result.sources.apiKey).toBe('env(ANTHROPIC_AUTH_TOKEN)');
    });

    it('uses ANTHROPIC_DEFAULT_MODEL as fallback for tiers', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_DEFAULT_MODEL: 'env-default',
        });
        expect(result.config.models).toEqual({
            opus: 'env-default',
            sonnet: 'env-default',
            haiku: 'env-default',
        });
        expect(result.sources.models.opus).toBe('fallback');
        expect(result.sources.models.sonnet).toBe('fallback');
        expect(result.sources.models.haiku).toBe('fallback');
    });

    it('prioritizes tier-specific model over ANTHROPIC_DEFAULT_MODEL', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_DEFAULT_MODEL: 'env-default',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'env-sonnet',
        });
        expect(result.config.models).toEqual({
            opus: 'env-default',
            sonnet: 'env-sonnet',
            haiku: 'env-default',
        });
        expect(result.sources.models.sonnet).toBe('env');
    });

    it('uses all tier-specific model overrides when provided', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'env-opus',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'env-sonnet',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'env-haiku',
        });
        expect(result.config.models).toEqual({
            opus: 'env-opus',
            sonnet: 'env-sonnet',
            haiku: 'env-haiku',
        });
        expect(result.sources.models.opus).toBe('env');
        expect(result.sources.models.sonnet).toBe('env');
        expect(result.sources.models.haiku).toBe('env');
    });

    it('ignores blank env values', () => {
        const result = resolveRuntimeConfig(baseFileConfig(), {
            ANTHROPIC_BASE_URL: '   ',
            ANTHROPIC_API_KEY: '',
            ANTHROPIC_DEFAULT_MODEL: '   ',
        });
        expect(result.config.baseUrl).toBe('https://file.example/v1');
        expect(result.config.apiKey).toBe('file-api-key');
        expect(result.config.models).toEqual({
            opus: 'file-opus',
            sonnet: 'file-sonnet',
            haiku: 'file-haiku',
        });
    });

    it('returns prompt sources when no file and env are available', () => {
        const result = resolveRuntimeConfig(null, {});
        expect(result.config.baseUrl).toBeUndefined();
        expect(result.config.apiKey).toBeUndefined();
        expect(result.sources.baseUrl).toBe('prompt');
        expect(result.sources.apiKey).toBe('prompt');
        expect(result.sources.models.opus).toBe('prompt');
    });

    it('falls back sonnet and haiku to opus when only opus is available', () => {
        const fileOnlyOpus: AdapterConfig = {
            baseUrl: 'https://x',
            apiKey: 'k',
            models: {
                opus: 'file-opus',
                sonnet: '',
                haiku: '',
            },
        };
        const result = resolveRuntimeConfig(fileOnlyOpus, {});
        expect(result.config.models).toEqual({
            opus: 'file-opus',
            sonnet: 'file-opus',
            haiku: 'file-opus',
        });
    });
});
