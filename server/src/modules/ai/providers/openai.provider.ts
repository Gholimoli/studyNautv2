import { IAiProvider, AiRequestOptions, AiResponse } from '@/modules/ai/types/ai.types';
import { config } from '@/core/config/config'; // Import validated config

const BASE_URL = 'https://api.openai.com/v1';
// Get default model from validated config
const DEFAULT_MODEL = config.ai.fallbackProvider || 'gpt-4o-mini'; // Use fallback as default here

export class OpenAiProvider implements IAiProvider {
  readonly providerName = 'openai';
  private modelName: string;
  private apiKey: string | undefined; // Store API key from config

  constructor(modelName?: string) {
    this.modelName = modelName || DEFAULT_MODEL;
    this.apiKey = config.ai.openaiApiKey; // Get key from config
    if (!this.apiKey) {
      console.warn('[OpenAiProvider] OPENAI_API_KEY not found in config. Provider will likely fail.');
    }
  }

  async generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse> {
    if (!this.apiKey) { // Check stored key
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
          'Authorization': `Bearer ${this.apiKey}`, // Use stored key
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