// OpenAI Chat Completions API Types

export interface OpenAIChatRequest {
    model: string;
    messages: OpenAIMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
    tools?: OpenAITool[];
    tool_choice?: OpenAIToolChoice;
}

export type OpenAIMessage =
    | OpenAISystemMessage
    | OpenAIUserMessage
    | OpenAIAssistantMessage
    | OpenAIToolMessage;

export interface OpenAISystemMessage {
    role: 'system';
    content: string;
}

export interface OpenAIUserMessage {
    role: 'user';
    content: string | OpenAIUserContentPart[];
}

export interface OpenAIAssistantMessage {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
}

export interface OpenAIToolMessage {
    role: 'tool';
    content: string;
    tool_call_id: string;
}

export type OpenAIUserContentPart = OpenAITextContentPart | OpenAIImageContentPart;

export interface OpenAITextContentPart {
    type: 'text';
    text: string;
}

export interface OpenAIImageContentPart {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}

// Tool definitions
export interface OpenAITool {
    type: 'function';
    function: OpenAIFunction;
}

export interface OpenAIFunction {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export type OpenAIToolChoice =
    | 'none'
    | 'auto'
    | 'required'
    | { type: 'function'; function: { name: string } };

// Tool calls in response
export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

// Chat completion response
export interface OpenAIChatResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage: OpenAIUsage;
    system_fingerprint?: string;
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIAssistantMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

// Streaming types
export interface OpenAIStreamChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: OpenAIStreamChoice[];
    usage?: OpenAIUsage;
}

export interface OpenAIStreamChoice {
    index: number;
    delta: OpenAIStreamDelta;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface OpenAIStreamDelta {
    role?: 'assistant';
    content?: string;
    tool_calls?: OpenAIStreamToolCall[];
}

export interface OpenAIStreamToolCall {
    index: number;
    id?: string;
    type?: 'function';
    function?: {
        name?: string;
        arguments?: string;
    };
}
