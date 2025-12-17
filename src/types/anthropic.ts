// Anthropic API Types for Messages endpoint

export interface AnthropicMessageRequest {
    model: string;
    messages: AnthropicMessage[];
    system?: string | AnthropicSystemContent[];
    max_tokens: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop_sequences?: string[];
    stream?: boolean;
    tools?: AnthropicToolDefinition[];
    tool_choice?: AnthropicToolChoice;
    metadata?: {
        user_id?: string;
    };
}

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

export interface AnthropicSystemContent {
    type: 'text';
    text: string;
    cache_control?: {
        type: 'ephemeral';
    };
}

// Content blocks in responses
export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

export interface AnthropicTextBlock {
    type: 'text';
    text: string;
}

export interface AnthropicToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string | AnthropicContentBlock[];
    is_error?: boolean;
}

// Tool definitions
export interface AnthropicToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export interface AnthropicToolChoice {
    type: 'auto' | 'any' | 'tool';
    name?: string; // Only when type is 'tool'
}

// Message response
export interface AnthropicMessageResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: AnthropicContentBlock[];
    model: string;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
    stop_sequence: string | null;
    usage: AnthropicUsage;
}

export interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

// Streaming event types
export type AnthropicStreamEvent =
    | AnthropicMessageStartEvent
    | AnthropicContentBlockStartEvent
    | AnthropicContentBlockDeltaEvent
    | AnthropicContentBlockStopEvent
    | AnthropicMessageDeltaEvent
    | AnthropicMessageStopEvent
    | AnthropicPingEvent
    | AnthropicErrorEvent;

export interface AnthropicMessageStartEvent {
    type: 'message_start';
    message: Omit<AnthropicMessageResponse, 'content'> & { content: [] };
}

export interface AnthropicContentBlockStartEvent {
    type: 'content_block_start';
    index: number;
    content_block: AnthropicContentBlock;
}

export interface AnthropicContentBlockDeltaEvent {
    type: 'content_block_delta';
    index: number;
    delta: AnthropicTextDelta | AnthropicInputJsonDelta;
}

export interface AnthropicTextDelta {
    type: 'text_delta';
    text: string;
}

export interface AnthropicInputJsonDelta {
    type: 'input_json_delta';
    partial_json: string;
}

export interface AnthropicContentBlockStopEvent {
    type: 'content_block_stop';
    index: number;
}

export interface AnthropicMessageDeltaEvent {
    type: 'message_delta';
    delta: {
        stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
        stop_sequence?: string;
    };
    usage: {
        output_tokens: number;
    };
}

export interface AnthropicMessageStopEvent {
    type: 'message_stop';
}

export interface AnthropicPingEvent {
    type: 'ping';
}

export interface AnthropicErrorEvent {
    type: 'error';
    error: {
        type: string;
        message: string;
    };
}
