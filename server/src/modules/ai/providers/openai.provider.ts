import { IAiProvider, AiRequestOptions, AiResponse } from '@/modules/ai/types/ai.types';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' }); // Adjust path relative to dist

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = 'https://api.openai.com/v1';
// Default model from .env.example, can be overridden by env var
const DEFAULT_MODEL = process.env.FALLBACK_AI_PROVIDER || 'gpt-4o-mini';

export class OpenAiProvider implements IAiProvider {
  readonly providerName = 'openai';
  private modelName: string;

  constructor(modelName?: string) {
    this.modelName = modelName || DEFAULT_MODEL;
    if (!API_KEY) {
      console.warn('[OpenAiProvider] OPENAI_API_KEY environment variable not set. Provider will likely fail.');
    }
  }

  async generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse> {
    if (!API_KEY) {
      return { content: null, errorMessage: 'OpenAI API key not configured.' };
    }

    const apiUrl = `${BASE_URL}/chat/completions`;

    const requestBody = {
      model: this.modelName,
      messages: [
        // Add system prompt if provided
        ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      // Map options
      ...(options?.temperature && { temperature: options.temperature }),
      ...(options?.maxOutputTokens && { max_tokens: options.maxOutputTokens }),
      ...(options?.jsonMode && { response_format: { type: 'json_object' } }),
      // Add other parameters like top_p if needed
    };

    try {
      console.log(`[OpenAiProvider] Calling model ${this.modelName}...`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[OpenAiProvider] API Error Response:', responseData);
        const errorMessage = responseData?.error?.message || `API request failed with status ${response.status}`;
        return { content: null, errorMessage };
      }

      // Extract content safely
      const generatedText = responseData?.choices?.[0]?.message?.content || null;
      
      // Extract usage data if available
      const usage = responseData?.usage ? {
          promptTokens: responseData.usage.prompt_tokens || 0,
          completionTokens: responseData.usage.completion_tokens || 0,
          totalTokens: responseData.usage.total_tokens || 0,
      } : undefined;

      console.log(`[OpenAiProvider] Received response from ${this.modelName}.`);
      return {
        content: generatedText,
        usage: usage,
      };

    } catch (error) {
      console.error('[OpenAiProvider] Fetch Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      return { content: null, errorMessage: `Failed to fetch OpenAI API: ${message}` };
    }
  }
} 