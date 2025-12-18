// Request validation utilities
import { AnthropicMessageRequest, AnthropicMessage, AnthropicContentBlock } from '../types/anthropic';

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validate an incoming Anthropic Messages API request
 */
export function validateAnthropicRequest(body: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    // Check if body is an object
    if (!body || typeof body !== 'object') {
        return { valid: false, errors: [{ field: 'body', message: 'Request body must be an object' }] };
    }

    const request = body as Record<string, unknown>;

    // Required field: model
    if (!request.model || typeof request.model !== 'string') {
        errors.push({ field: 'model', message: 'model is required and must be a string' });
    }

    // Required field: max_tokens
    if (request.max_tokens === undefined || typeof request.max_tokens !== 'number') {
        errors.push({ field: 'max_tokens', message: 'max_tokens is required and must be a number' });
    } else if (request.max_tokens <= 0) {
        errors.push({ field: 'max_tokens', message: 'max_tokens must be a positive number' });
    }

    // Required field: messages
    if (!request.messages) {
        errors.push({ field: 'messages', message: 'messages is required' });
    } else if (!Array.isArray(request.messages)) {
        errors.push({ field: 'messages', message: 'messages must be an array' });
    } else if (request.messages.length === 0) {
        errors.push({ field: 'messages', message: 'messages array cannot be empty' });
    } else {
        // Validate each message
        const messageErrors = validateMessages(request.messages);
        errors.push(...messageErrors);
    }

    // Optional field validations
    if (request.temperature !== undefined) {
        if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 1) {
            errors.push({ field: 'temperature', message: 'temperature must be a number between 0 and 1' });
        }
    }

    if (request.top_p !== undefined) {
        if (typeof request.top_p !== 'number' || request.top_p < 0 || request.top_p > 1) {
            errors.push({ field: 'top_p', message: 'top_p must be a number between 0 and 1' });
        }
    }

    if (request.stream !== undefined && typeof request.stream !== 'boolean') {
        errors.push({ field: 'stream', message: 'stream must be a boolean' });
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate message array structure
 */
function validateMessages(messages: unknown[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        if (!msg || typeof msg !== 'object') {
            errors.push({ field: `messages[${i}]`, message: 'message must be an object' });
            continue;
        }

        const message = msg as Record<string, unknown>;

        // Validate role
        if (!message.role || typeof message.role !== 'string') {
            errors.push({ field: `messages[${i}].role`, message: 'role is required and must be a string' });
        } else if (!['user', 'assistant'].includes(message.role)) {
            errors.push({ field: `messages[${i}].role`, message: 'role must be "user" or "assistant"' });
        }

        // Validate content
        if (message.content === undefined || message.content === null) {
            errors.push({ field: `messages[${i}].content`, message: 'content is required' });
        } else if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
            errors.push({ field: `messages[${i}].content`, message: 'content must be a string or array' });
        } else if (Array.isArray(message.content)) {
            const contentErrors = validateContentBlocks(message.content, i);
            errors.push(...contentErrors);
        }
    }

    return errors;
}

/**
 * Validate content blocks array
 */
function validateContentBlocks(blocks: unknown[], messageIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];

    for (let j = 0; j < blocks.length; j++) {
        const block = blocks[j];

        if (!block || typeof block !== 'object') {
            errors.push({
                field: `messages[${messageIndex}].content[${j}]`,
                message: 'content block must be an object'
            });
            continue;
        }

        const contentBlock = block as Record<string, unknown>;

        if (!contentBlock.type || typeof contentBlock.type !== 'string') {
            errors.push({
                field: `messages[${messageIndex}].content[${j}].type`,
                message: 'content block type is required'
            });
        }
    }

    return errors;
}

/**
 * Format validation errors into a human-readable message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
    return errors.map(e => `${e.field}: ${e.message}`).join('; ');
}
