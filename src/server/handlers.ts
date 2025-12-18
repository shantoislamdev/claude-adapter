// Proxy server request handlers
import { FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import { AnthropicMessageRequest } from '../types/anthropic';
import { AdapterConfig } from '../types/config';
import { convertRequestToOpenAI } from '../converters/request';
import { convertResponseToAnthropic, createErrorResponse } from '../converters/response';
import { streamOpenAIToAnthropic } from '../converters/streaming';

/**
 * Handle POST /v1/messages requests
 */
export function createMessagesHandler(config: AdapterConfig) {
    const openai = new OpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
    });

    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const anthropicRequest = request.body as AnthropicMessageRequest;

            // Pass through the model directly from the request
            // Claude Code is already configured with the correct model via settings.json
            const targetModel = anthropicRequest.model;

            // Log request for debugging
            console.log(`[claude-adapter] Forwarding request for model: ${targetModel}`);

            // Convert request to OpenAI format
            const openaiRequest = convertRequestToOpenAI(anthropicRequest, targetModel);

            if (anthropicRequest.stream) {
                // Handle streaming response
                await handleStreamingRequest(openai, openaiRequest, reply, anthropicRequest.model);
            } else {
                // Handle non-streaming response
                await handleNonStreamingRequest(openai, openaiRequest, reply, anthropicRequest.model);
            }
        } catch (error) {
            handleError(error as Error, reply);
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
    originalModel: string
): Promise<void> {
    const response = await openai.chat.completions.create({
        ...openaiRequest,
        stream: false,
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
    originalModel: string
): Promise<void> {
    const stream = await openai.chat.completions.create({
        ...openaiRequest,
        stream: true,
    } as OpenAI.ChatCompletionCreateParamsStreaming);

    await streamOpenAIToAnthropic(stream as any, reply, originalModel);
}

/**
 * Handle errors and send appropriate response
 */
function handleError(error: Error, reply: FastifyReply): void {
    console.error('[claude-adapter] Error:', error.message);

    let statusCode = 500;

    // Try to extract status code from OpenAI error
    if ('status' in error) {
        statusCode = (error as any).status;
    }

    const errorResponse = createErrorResponse(error, statusCode);
    reply.code(errorResponse.status).send({ error: errorResponse.error });
}
