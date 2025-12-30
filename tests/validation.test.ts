// Tests for request validation utilities
import { validateAnthropicRequest, formatValidationErrors } from '../src/utils/validation';

describe('Request Validation', () => {
    describe('validateAnthropicRequest', () => {
        it('should validate a correct minimal request', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 'Hello' }
                ]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject null body', () => {
            const result = validateAnthropicRequest(null);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('body');
        });

        it('should reject missing model', () => {
            const request = {
                max_tokens: 1024,
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'model')).toBe(true);
        });

        it('should reject missing max_tokens', () => {
            const request = {
                model: 'claude-4-opus',
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'max_tokens')).toBe(true);
        });

        it('should reject negative max_tokens', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: -1,
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'max_tokens')).toBe(true);
        });

        it('should reject missing messages field', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024
                // messages missing
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'messages')).toBe(true);
        });

        it('should reject non-array messages', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: 'not-an-array'
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'messages')).toBe(true);
        });

        it('should reject empty messages array', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: []
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'messages')).toBe(true);
        });

        it('should reject missing role', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [{ content: 'Hello' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('role'))).toBe(true);
        });

        it('should reject invalid message role', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [{ role: 'invalid', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('role'))).toBe(true);
        });

        it('should reject non-object message in array', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: ['not-an-object']
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('messages['))).toBe(true);
        });

        it('should reject missing content', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [{ role: 'user' }]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('content'))).toBe(true);
        });

        it('should accept content as array', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
                ]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid content block without type', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: [{ text: 'Hello' }] }
                ]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('type'))).toBe(true);
        });

        it('should reject invalid content type (number)', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 123 }
                ]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('content'))).toBe(true);
        });

        it('should reject non-object content block', () => {
            const request = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: ['not-an-object'] }
                ]
            };

            const result = validateAnthropicRequest(request);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field.includes('content['))).toBe(true);
        });

        it('should validate optional temperature range', () => {
            const invalidRequest = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                temperature: 2.0,
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'temperature')).toBe(true);
        });

        it('should validate optional top_p range', () => {
            const invalidRequest = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                top_p: -0.5,
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'top_p')).toBe(true);
        });

        it('should validate stream must be boolean', () => {
            const invalidRequest = {
                model: 'claude-4-opus',
                max_tokens: 1024,
                stream: 'yes',
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = validateAnthropicRequest(invalidRequest);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'stream')).toBe(true);
        });
    });

    describe('formatValidationErrors', () => {
        it('should format single error', () => {
            const errors = [{ field: 'model', message: 'is required' }];
            const result = formatValidationErrors(errors);
            expect(result).toBe('model: is required');
        });

        it('should format multiple errors with semicolons', () => {
            const errors = [
                { field: 'model', message: 'is required' },
                { field: 'max_tokens', message: 'must be positive' }
            ];
            const result = formatValidationErrors(errors);
            expect(result).toBe('model: is required; max_tokens: must be positive');
        });
    });
});
