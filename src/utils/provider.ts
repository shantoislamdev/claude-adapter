export function isAzureOpenAIEndpoint(baseUrl: string): boolean {
    try {
        const url = new URL(baseUrl);
        const hostname = url.hostname.toLowerCase();

        return hostname.endsWith('.openai.azure.com') || hostname.includes('.services.ai.azure.com');
    } catch {
        return false;
    }
}
