// Proxy server request handlers
import { Request, Response } from 'express';
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

    return async (req: Request, res: Response): Promise<void> => {
        try {
            const anthropicRequest = req.body as AnthropicMessageRequest;

            // Pass through the model directly from the request
            // Claude Code is already configured with the correct model via settings.json
            const targetModel = anthropicRequest.model;

            // Log request for debugging
            console.log(`[claude-adapter] Forwarding request for model: ${targetModel}`);

            // Convert request to OpenAI format
            const openaiRequest = convertRequestToOpenAI(anthropicRequest, targetModel);

            if (anthropicRequest.stream) {
                // Handle streaming response
                await handleStreamingRequest(openai, openaiRequest, res, anthropicRequest.model);
            } else {
                // Handle non-streaming response
                await handleNonStreamingRequest(openai, openaiRequest, res, anthropicRequest.model);
            }
        } catch (error) {
            handleError(error as Error, res);
        }
    };
}

/**
 * Handle non-streaming API request
 */
async function handleNonStreamingRequest(
    openai: OpenAI,
    openaiRequest: any,
    res: Response,
    originalModel: string
): Promise<void> {
    const response = await openai.chat.completions.create({
        ...openaiRequest,
        stream: false,
    });

    const anthropicResponse = convertResponseToAnthropic(response as any, originalModel);

    res.json(anthropicResponse);
}

/**
 * Handle streaming API request
 */
async function handleStreamingRequest(
    openai: OpenAI,
    openaiRequest: any,
    res: Response,
    originalModel: string
): Promise<void> {
    const stream = await openai.chat.completions.create({
        ...openaiRequest,
        stream: true,
    } as OpenAI.ChatCompletionCreateParamsStreaming);

    await streamOpenAIToAnthropic(stream as any, res, originalModel);
}

/**
 * Handle errors and send appropriate response
 */
function handleError(error: Error, res: Response): void {
    console.error('[claude-adapter] Error:', error.message);

    let statusCode = 500;

    // Try to extract status code from OpenAI error
    if ('status' in error) {
        statusCode = (error as any).status;
    }

    const errorResponse = createErrorResponse(error, statusCode);
    res.status(errorResponse.status).json({ error: errorResponse.error });
}
