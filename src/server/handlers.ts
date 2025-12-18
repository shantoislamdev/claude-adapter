// Proxy server request handlers
import { FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import { AnthropicMessageRequest } from '../types/anthropic';
import { AdapterConfig } from '../types/config';
import { convertRequestToOpenAI } from '../converters/request';
import { convertResponseToAnthropic, createErrorResponse } from '../converters/response';
import { streamOpenAIToAnthropic } from '../converters/streaming';
import { validateAnthropicRequest, formatValidationErrors } from '../utils/validation';
import { logger, RequestLogger } from '../utils/logger';

// Request ID counter for unique identification
let requestIdCounter = 0;

function generateRequestId(): string {
    requestIdCounter++;
    const timestamp = Date.now().toString(36);
    const counter = requestIdCounter.toString(36).padStart(4, '0');
    return `req_${timestamp}_${counter}`;
}

/**
 * Handle POST /v1/messages requests
 */
export function createMessagesHandler(config: AdapterConfig) {
    const openai = new OpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
    });

    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const requestId = generateRequestId();
        const log = logger.withRequestId(requestId);

        // Add request ID to response headers for client tracing
        reply.header('X-Request-Id', requestId);

        try {
            // Validate request before processing
            const validation = validateAnthropicRequest(request.body);
            if (!validation.valid) {
                const errorMessage = formatValidationErrors(validation.errors);
                log.warn('Invalid request', { errors: validation.errors });
                const errorResponse = createErrorResponse(new Error(errorMessage), 400);
                reply.code(400).send({ error: errorResponse.error });
                return;
            }

            const anthropicRequest = request.body as AnthropicMessageRequest;
            const targetModel = anthropicRequest.model;
            const isStreaming = anthropicRequest.stream ?? false;

            log.info('Request received', {
                model: targetModel,
                streaming: isStreaming,
                messageCount: anthropicRequest.messages.length
            });

            // Convert request to OpenAI format
            const openaiRequest = convertRequestToOpenAI(anthropicRequest, targetModel);

            if (isStreaming) {
                log.debug('Starting streaming response');
                await handleStreamingRequest(openai, openaiRequest, reply, anthropicRequest.model, log);
            } else {
                await handleNonStreamingRequest(openai, openaiRequest, reply, anthropicRequest.model, log);
            }

            log.info('Request completed', { model: targetModel });
        } catch (error) {
            handleError(error as Error, reply, log);
        }
    };
}

/**
 * Handle non-streaming API request
 */
async function handleNonStreamingRequest(
    openai: OpenAI,
    openaiRequest: any,
    reply: FastifyReply,
    originalModel: string,
    log: RequestLogger
): Promise<void> {
    log.debug('Making non-streaming request to OpenAI');

    const response = await openai.chat.completions.create({
        ...openaiRequest,
        stream: false,
    });

    log.debug('Response received', {
        finishReason: response.choices[0]?.finish_reason,
        usage: response.usage
    });

    const anthropicResponse = convertResponseToAnthropic(response as any, originalModel);
    reply.send(anthropicResponse);
}

/**
 * Handle streaming API request
 */
async function handleStreamingRequest(
    openai: OpenAI,
    openaiRequest: any,
    reply: FastifyReply,
    originalModel: string,
    log: RequestLogger
): Promise<void> {
    log.debug('Making streaming request to OpenAI');

    const stream = await openai.chat.completions.create({
        ...openaiRequest,
        stream: true,
    } as OpenAI.ChatCompletionCreateParamsStreaming);

    await streamOpenAIToAnthropic(stream as any, reply, originalModel);
    log.debug('Streaming completed');
}

/**
 * Handle errors and send appropriate response
 */
function handleError(error: Error, reply: FastifyReply, log: RequestLogger): void {
    let statusCode = 500;

    // Try to extract status code from OpenAI error
    if ('status' in error) {
        statusCode = (error as any).status;
    }

    log.error('Request failed', error, { statusCode });

    const errorResponse = createErrorResponse(error, statusCode);
    reply.code(errorResponse.status).send({ error: errorResponse.error });
}

